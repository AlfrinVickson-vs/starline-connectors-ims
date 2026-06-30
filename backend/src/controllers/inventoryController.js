const inventoryModel  = require('../models/inventoryModel');
const stageHistoryModel = require('../models/stageHistoryModel');

// POST /api/inventory
const createItem = async (req, res) => {
  const { item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes } = req.body;

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

module.exports = { createItem, listItems, getItem, getItemsByStage };
