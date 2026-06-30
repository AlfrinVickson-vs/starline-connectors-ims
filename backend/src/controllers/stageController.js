const inventoryModel     = require('../models/inventoryModel');
const stageHistoryModel  = require('../models/stageHistoryModel');
const finishedGoodsModel = require('../models/finishedGoodsModel');
const notificationModel  = require('../models/notificationModel');
const userModel          = require('../models/userModel');
const { canActOnStage }  = require('../middleware/roles');
const { sendStageChangeNotification } = require('../services/emailService');

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
 * Validates role can act on current stage.
 */
const advanceStage = async (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  const { comments } = req.body;
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

  const fromStage = item.current_stage;
  const toStage   = transition.next;

  // Update item
  const updated = await inventoryModel.updateStage(itemId, {
    current_stage: toStage,
    status: 'approved',
  });

  // Record history
  await stageHistoryModel.create({
    item_id:    itemId,
    from_stage: fromStage,
    to_stage:   toStage,
    status:     'approved',
    comments:   comments || transition.label,
    changed_by: userId,
  });

  // If moved to finished_goods, create finished_goods record
  if (toStage === 'finished_goods') {
    await finishedGoodsModel.create({
      item_id:         itemId,
      quantity:        item.quantity,
      approved_date:   new Date().toISOString().split('T')[0],
      batch_reference: item.batch_number,
    });
  }

  // Notify next role's users
  const notifyUsers = await userModel.findByRole(transition.notifyRole);
  const notifyIds   = notifyUsers.map((u) => u.id);

  if (notifyIds.length > 0) {
    await notificationModel.createBulk({
      userIds:          notifyIds,
      message:          `Item "${item.item_name}" has been moved to ${toStage.replace(/_/g, ' ')} stage`,
      related_item_id:  itemId,
      notification_type: 'stage_change',
    });

    // Fire & forget email
    sendStageChangeNotification({
      to:         notifyUsers.map((u) => u.email),
      subject:    `[Starline IMS] Item "${item.item_name}" — ${transition.label}`,
      itemName:   item.item_name,
      fromStage,
      toStage,
      status:     'approved',
      comments:   comments || transition.label,
      changedBy:  userName,
    });
  }

  return res.json({ success: true, message: transition.label, item: updated });
};

/**
 * POST /api/stages/reject/:itemId
 * Reject an item at QC stage. Item stays in current stage with status = rejected.
 */
const rejectItem = async (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);
  const { comments } = req.body;
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

  // Update status to rejected (stays at current stage)
  const updated = await inventoryModel.updateStage(itemId, {
    current_stage: item.current_stage,
    status: 'rejected',
  });

  await stageHistoryModel.create({
    item_id:    itemId,
    from_stage: item.current_stage,
    to_stage:   item.current_stage,
    status:     'rejected',
    comments,
    changed_by: userId,
  });

  // Notify inventory manager of rejection
  const invManagers = await userModel.findByRole('inventory_manager');
  const notifyIds   = invManagers.map((u) => u.id);

  if (notifyIds.length > 0) {
    await notificationModel.createBulk({
      userIds:           notifyIds,
      message:           `Item "${item.item_name}" was REJECTED at ${item.current_stage.replace(/_/g, ' ')} — ${comments}`,
      related_item_id:   itemId,
      notification_type: 'rejection',
    });

    sendStageChangeNotification({
      to:        invManagers.map((u) => u.email),
      subject:   `[Starline IMS] REJECTED: "${item.item_name}" at ${item.current_stage}`,
      itemName:  item.item_name,
      fromStage: item.current_stage,
      toStage:   item.current_stage,
      status:    'rejected',
      comments,
      changedBy: userName,
    });
  }

  return res.json({ success: true, message: 'Item rejected', item: updated });
};

module.exports = { advanceStage, rejectItem };
