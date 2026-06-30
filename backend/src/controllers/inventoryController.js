const inventoryModel    = require('../models/inventoryModel');
const stageHistoryModel = require('../models/stageHistoryModel');
const { getClient }     = require('../config/db');

// POST /api/inventory
const createItem = async (req, res) => {
  const { item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes, variant } = req.body;

  if (!item_name || !quantity) {
    return res.status(400).json({ success: false, message: 'item_name and quantity are required' });
  }

  const item = await inventoryModel.create({
    item_name,
    sku:           sku           || null,
    quantity:      parseFloat(quantity),
    unit:          unit          || 'pcs',
    received_date: received_date || new Date().toISOString().split('T')[0],
    supplier_name: supplier_name || null,
    batch_number:  batch_number  || null,
    notes:         notes         || null,
    variant:       variant       || null,
    created_by:    req.user.id,
  });

  // Record initial history entry
  await stageHistoryModel.create({
    item_id:    item.id,
    from_stage: null,
    to_stage:   'inventory_entry',
    status:     'pending',
    comments:   'Item entered into inventory',
    changed_by: req.user.id,
  });

  return res.status(201).json({ success: true, item });
};

// GET /api/inventory
const listItems = async (req, res) => {
  const { page = 1, limit = 20, stage, status } = req.query;
  const result = await inventoryModel.findAll({
    page:   parseInt(page, 10),
    limit:  parseInt(limit, 10),
    stage:  stage  || undefined,
    status: status || undefined,
  });
  return res.json({ success: true, ...result });
};

// GET /api/inventory/:id
const getItem = async (req, res) => {
  const item = await inventoryModel.findById(parseInt(req.params.id, 10));
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  const history = await stageHistoryModel.findByItemId(item.id);
  return res.json({ success: true, item, history });
};

// GET /api/inventory/stage/:stage  (dashboard view per role)
const getItemsByStage = async (req, res) => {
  const { stage } = req.params;
  const validStages = ['inventory_entry','qc_incoming','production','qc_outgoing','finished_goods'];
  if (!validStages.includes(stage)) {
    return res.status(400).json({ success: false, message: 'Invalid stage' });
  }
  const items = await inventoryModel.findByStage(stage);
  return res.json({ success: true, items });
};

// POST /api/inventory/bulk
const bulkCreateItems = async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
  }
  if (items.length > 500) {
    return res.status(400).json({ success: false, message: 'Maximum 500 items per import' });
  }

  const VALID_UNITS = ['pcs', 'kg', 'g', 'm', 'mm', 'litre', 'box', 'set'];
  const today = new Date().toISOString().split('T')[0];

  // ── Per-row validation (collect errors, don't abort) ──────
  const validItems = [];
  const errors = [];

  items.forEach((item, idx) => {
    const rowErrors = [];
    const name = (item.item_name || '').trim();
    const qty  = parseFloat(item.quantity);

    if (!name)           rowErrors.push('item_name is required');
    if (isNaN(qty) || qty < 0) rowErrors.push('quantity must be a non-negative number');

    if (item.unit && !VALID_UNITS.includes(item.unit)) {
      rowErrors.push(`unit must be one of: ${VALID_UNITS.join(', ')}`);
    }
    if (item.received_date && !/^\d{4}-\d{2}-\d{2}$/.test(item.received_date)) {
      rowErrors.push('received_date must be YYYY-MM-DD');
    }

    if (rowErrors.length > 0) {
      errors.push({ row: idx + 1, item_name: item.item_name || '', errors: rowErrors });
    } else {
      validItems.push({ ...item, item_name: name, quantity: qty });
    }
  });

  if (validItems.length === 0) {
    return res.status(422).json({
      success: false,
      message: 'No valid items to import',
      errors,
    });
  }

  // ── Transactional bulk insert ──────────────────────────────
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const inserted = await inventoryModel.bulkCreate(validItems, req.user.id, client);

    // Stage history for every inserted item
    if (inserted.length > 0) {
      const historyValues = [];
      const historyPlaceholders = inserted.map((item, i) => {
        const base = i * 6;
        historyValues.push(
          item.id,
          null,
          'inventory_entry',
          'pending',
          'Bulk import',
          req.user.id
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`;
      });

      await client.query(
        `INSERT INTO stage_history (item_id, from_stage, to_stage, status, comments, changed_by)
         VALUES ${historyPlaceholders.join(',')}`,
        historyValues
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `${inserted.length} item(s) imported successfully`,
      inserted_count: inserted.length,
      error_count:    errors.length,
      errors,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[bulk-import] Transaction failed:', err.message);
    return res.status(500).json({ success: false, message: 'Bulk import failed: ' + err.message });
  } finally {
    client.release();
  }
};

module.exports = { createItem, listItems, getItem, getItemsByStage, bulkCreateItems };

