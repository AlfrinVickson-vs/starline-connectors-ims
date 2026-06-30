const inventoryModel     = require('../models/inventoryModel');
const stageHistoryModel  = require('../models/stageHistoryModel');
const finishedGoodsModel = require('../models/finishedGoodsModel');
const notificationModel  = require('../models/notificationModel');
const userModel          = require('../models/userModel');
const { canActOnStage }  = require('../middleware/roles');
const { sendStageChangeNotification } = require('../services/emailService');
const { getClient }      = require('../config/db');

/**
 * Stage transition map:
 *   current stage → { next stage, notify role, approved_label }
 */
const TRANSITIONS = {
  inventory_entry: { next: 'qc_incoming',   notifyRole: 'qc_inspector',        label: 'Sent to QC (Incoming)' },
  qc_incoming:     { next: 'production',     notifyRole: 'production_manager',  label: 'Approved — Sent to Production' },
  production:      { next: 'qc_outgoing',    notifyRole: 'qc_inspector',        label: 'Sent to QC (Outgoing)' },
  qc_outgoing:     { next: 'finished_goods', notifyRole: 'admin',               label: 'Approved — Moved to Finished Goods' },
};

/**
 * POST /api/stages/advance/:itemId
 * Advance an item to the next stage (approved path).
 * At qc_outgoing, accepts optional `approved_qty` in body for partial approval.
 */
const advanceStage = async (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  const { comments, approved_qty: rawApprovedQty } = req.body;
  const { id: userId, role, name: userName } = req.user;

  const item = await inventoryModel.findById(itemId);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  if (!canActOnStage(role, item.current_stage)) {
    return res.status(403).json({
      success: false,
      message: `Your role (${role}) cannot act on items at stage: ${item.current_stage}`,
    });
  }

  const transition = TRANSITIONS[item.current_stage];
  if (!transition) {
    return res.status(400).json({ success: false, message: 'Item is already at final stage (finished_goods)' });
  }

  const fromStage    = item.current_stage;
  const toStage      = transition.next;
  const totalQty     = parseFloat(item.quantity);
  const isQcOutgoing = fromStage === 'qc_outgoing';

  // ── Partial approval (qc_outgoing only) ─────────────────────
  let approved_qty  = totalQty;   // default: full quantity
  let rejected_qty  = 0;
  let historyComment = comments || transition.label;

  if (isQcOutgoing && rawApprovedQty !== undefined && rawApprovedQty !== null && rawApprovedQty !== '') {
    approved_qty = parseFloat(rawApprovedQty);

    if (isNaN(approved_qty) || approved_qty <= 0) {
      return res.status(400).json({ success: false, message: 'approved_qty must be a positive number' });
    }
    if (approved_qty > totalQty) {
      return res.status(400).json({
        success: false,
        message: `approved_qty (${approved_qty}) cannot exceed item quantity (${totalQty})`,
      });
    }

    rejected_qty = parseFloat((totalQty - approved_qty).toFixed(4));

    if (rejected_qty > 0) {
      historyComment = `Partial approval: ${approved_qty} ${item.unit} approved, ${rejected_qty} ${item.unit} rejected` +
        (comments ? ` — ${comments}` : '');
    }
  }

  // ── Update item ──────────────────────────────────────────────
  let updated;
  if (isQcOutgoing && rejected_qty > 0) {
    // Partial: update qty + rejected_qty together
    updated = await inventoryModel.updateQuantityAndStage(itemId, {
      approved_qty,
      rejected_qty,
      current_stage: toStage,
      status: 'approved',
    });
  } else {
    // Full approval (all stages, or qc_outgoing with full qty)
    updated = await inventoryModel.updateStage(itemId, {
      current_stage: toStage,
      status: 'approved',
    });
  }

  // ── Record history ───────────────────────────────────────────
  await stageHistoryModel.create({
    item_id:    itemId,
    from_stage: fromStage,
    to_stage:   toStage,
    status:     'approved',
    comments:   historyComment,
    changed_by: userId,
  });

  // ── Finished goods record ────────────────────────────────────
  if (toStage === 'finished_goods') {
    await finishedGoodsModel.create({
      item_id:         itemId,
      quantity:        approved_qty,         // only approved portion
      approved_date:   new Date().toISOString().split('T')[0],
      batch_reference: item.batch_number,
    });
  }

  // ── Notify next role ─────────────────────────────────────────
  const notifyUsers = await userModel.findByRole(transition.notifyRole);
  const notifyIds   = notifyUsers.map((u) => u.id);

  if (notifyIds.length > 0) {
    const notifMsg = rejected_qty > 0
      ? `Item "${item.item_name}" — ${approved_qty} ${item.unit} approved, ${rejected_qty} ${item.unit} rejected at QC Outgoing`
      : `Item "${item.item_name}" has been moved to ${toStage.replace(/_/g, ' ')} stage`;

    await notificationModel.createBulk({
      userIds:           notifyIds,
      message:           notifMsg,
      related_item_id:   itemId,
      notification_type: 'stage_change',
    });

    sendStageChangeNotification({
      to:        notifyUsers.map((u) => u.email),
      subject:   `[Starline IMS] Item "${item.item_name}" — ${transition.label}`,
      itemName:  item.item_name,
      fromStage,
      toStage,
      status:    'approved',
      comments:  historyComment,
      changedBy: userName,
    });
  }

  return res.json({ success: true, message: transition.label, item: updated, approved_qty, rejected_qty });
};

/**
 * POST /api/stages/reject/:itemId
 * Reject an item at QC stage. If rework=true and stage is qc_outgoing, loops back to production.
 */
const rejectItem = async (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  const { comments, rework } = req.body;
  const { id: userId, role, name: userName } = req.user;

  if (!comments) {
    return res.status(400).json({ success: false, message: 'Comments are required when rejecting an item' });
  }

  const item = await inventoryModel.findById(itemId);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  if (!canActOnStage(role, item.current_stage)) {
    return res.status(403).json({
      success: false,
      message: `Your role (${role}) cannot act on items at stage: ${item.current_stage}`,
    });
  }

  // Only QC stages can reject
  if (!['qc_incoming', 'qc_outgoing'].includes(item.current_stage)) {
    return res.status(400).json({
      success: false,
      message: 'Items can only be rejected at QC stages',
    });
  }

  let targetStage = item.current_stage;
  let status = 'rejected';
  let commentsPrefix = '';

  if (item.current_stage === 'qc_outgoing' && rework === true) {
    targetStage = 'production';
    commentsPrefix = '[Rework] ';
  }

  // Update status and target stage
  const updated = await inventoryModel.updateStage(itemId, {
    current_stage: targetStage,
    status: status,
  });

  await stageHistoryModel.create({
    item_id:    itemId,
    from_stage: item.current_stage,
    to_stage:   targetStage,
    status:     status,
    comments:   commentsPrefix + comments,
    changed_by: userId,
  });

  // Notify next role
  const notifyRole = (item.current_stage === 'qc_outgoing' && rework === true)
    ? 'production_manager'
    : 'inventory_manager';

  const notifyUsers = await userModel.findByRole(notifyRole);
  const notifyIds   = notifyUsers.map((u) => u.id);

  if (notifyIds.length > 0) {
    const notifMsg = (item.current_stage === 'qc_outgoing' && rework === true)
      ? `Item "${item.item_name}" was sent back to production for REWORK — ${comments}`
      : `Item "${item.item_name}" was REJECTED at ${item.current_stage.replace(/_/g, ' ')} — ${comments}`;

    await notificationModel.createBulk({
      userIds:           notifyIds,
      message:           notifMsg,
      related_item_id:   itemId,
      notification_type: 'rejection',
    });

    sendStageChangeNotification({
      to:        notifyUsers.map((u) => u.email),
      subject:   `[Starline IMS] ${rework ? 'REWORK REQUIRED' : 'REJECTED'}: "${item.item_name}"`,
      itemName:  item.item_name,
      fromStage: item.current_stage,
      toStage:   targetStage,
      status:    status,
      comments:  commentsPrefix + comments,
      changedBy: userName,
    });
  }

  return res.json({ success: true, message: rework ? 'Item sent for rework' : 'Item rejected', item: updated });
};

/**
 * POST /api/stages/bulk-advance
 * Advance multiple items to their next stages simultaneously.
 * Designed for bulk pushing items from inventory_entry to qc_incoming.
 */
const bulkAdvanceStages = async (req, res) => {
  const { itemIds } = req.body;
  const { id: userId, role, name: userName } = req.user;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ success: false, message: 'itemIds must be a non-empty array' });
  }

  // Pre-validate all items
  const itemsToAdvance = [];
  for (const id of itemIds) {
    const item = await inventoryModel.findById(parseInt(id, 10));
    if (!item) {
      return res.status(404).json({ success: false, message: `Item with ID ${id} not found` });
    }
    if (!canActOnStage(role, item.current_stage)) {
      return res.status(403).json({
        success: false,
        message: `Your role (${role}) cannot act on item "${item.item_name}" at stage: ${item.current_stage}`,
      });
    }
    const transition = TRANSITIONS[item.current_stage];
    if (!transition) {
      return res.status(400).json({ success: false, message: `Item "${item.item_name}" is already at final stage (finished_goods)` });
    }
    itemsToAdvance.push({ item, transition });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const { item, transition } of itemsToAdvance) {
      const fromStage = item.current_stage;
      const toStage   = transition.next;

      // Update stage & status
      await client.query(
        `UPDATE inventory_items
         SET current_stage = $1, status = $2, updated_at = NOW()
         WHERE id = $3`,
        [toStage, 'approved', item.id]
      );

      // Create history
      await client.query(
        `INSERT INTO stage_history (item_id, from_stage, to_stage, status, comments, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [item.id, fromStage, toStage, 'approved', transition.label, userId]
      );

      // Create finished goods if necessary
      if (toStage === 'finished_goods') {
        await client.query(
          `INSERT INTO finished_goods (item_id, quantity, approved_date, batch_reference)
           VALUES ($1, $2, $3, $4)`,
          [item.id, parseFloat(item.quantity), new Date().toISOString().split('T')[0], item.batch_number]
        );
      }

      // Send notifications
      const notifyUsers = await userModel.findByRole(transition.notifyRole);
      const notifyIds   = notifyUsers.map((u) => u.id);

      if (notifyIds.length > 0) {
        const notifValues = [];
        const notifPlaceholders = notifyIds.map((uid, idx) => {
          const base = idx * 4;
          notifValues.push(
            uid,
            `Item "${item.item_name}" has been moved to ${toStage.replace(/_/g, ' ')} stage`,
            item.id,
            'stage_change'
          );
          return `($${base + 1},$${base + 2},$${base + 3},$${base + 4})`;
        });

        await client.query(
          `INSERT INTO notifications (user_id, message, related_item_id, notification_type)
           VALUES ${notifPlaceholders.join(',')}`,
          notifValues
        );

        // Async email notification (non-blocking)
        sendStageChangeNotification({
          to:        notifyUsers.map((u) => u.email),
          subject:   `[Starline IMS] Item "${item.item_name}" — ${transition.label}`,
          itemName:  item.item_name,
          fromStage,
          toStage,
          status:    'approved',
          comments:  transition.label,
          changedBy: userName,
        });
      }
    }

    await client.query('COMMIT');
    return res.json({ success: true, message: `Successfully advanced ${itemsToAdvance.length} item(s)` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[bulk-advance] Transaction failed:', err.message);
    return res.status(500).json({ success: false, message: 'Bulk advance failed: ' + err.message });
  } finally {
    client.release();
  }
};

module.exports = { advanceStage, rejectItem, bulkAdvanceStages };

