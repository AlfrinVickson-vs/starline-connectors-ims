const inventoryModel    = require('../models/inventoryModel');
const stageHistoryModel = require('../models/stageHistoryModel');
const invoiceModel      = require('../models/invoiceModel');
const { query }         = require('../config/db');

// GET /api/reports/summary
const stageSummary = async (req, res) => {
  const counts = await inventoryModel.countByStage();

  // Reshape into stage-keyed object
  const summary = {};
  for (const row of counts) {
    if (!summary[row.current_stage]) {
      summary[row.current_stage] = { total: 0, pending: 0, approved: 0, rejected: 0, in_progress: 0 };
    }
    summary[row.current_stage].total += parseInt(row.count, 10);
    summary[row.current_stage][row.status] = parseInt(row.count, 10);
  }

  return res.json({ success: true, summary });
};

// GET /api/reports/avg-time
const avgTimePerStage = async (req, res) => {
  const data = await stageHistoryModel.avgTimePerStage();
  return res.json({ success: true, data });
};

// GET /api/reports/rejection-rate
const rejectionRate = async (req, res) => {
  const data = await stageHistoryModel.rejectionRatePerStage();
  return res.json({ success: true, data });
};

// GET /api/reports/invoices-summary
const invoicesSummary = async (req, res) => {
  const { rows } = await query(`
    SELECT
      status,
      COUNT(*)                              AS count,
      COALESCE(SUM(total_amount), 0)        AS total_value
    FROM invoices
    GROUP BY status
  `);
  return res.json({ success: true, data: rows });
};

// GET /api/reports/throughput?days=30
const throughput = async (req, res) => {
  const days = parseInt(req.query.days || '30', 10);
  const { rows } = await query(
    `SELECT
       DATE(changed_at) AS date,
       COUNT(*) FILTER (WHERE status = 'approved') AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
     FROM stage_history
     WHERE changed_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(changed_at)
     ORDER BY date ASC`
    );
  return res.json({ success: true, data: rows });
};

// GET /api/reports/inventory-detail
const inventoryDetailReport = async (req, res) => {
  const { rows } = await query(`
    SELECT 
      i.id, i.item_name, i.sku, i.variant, i.quantity, i.unit, i.status, i.current_stage, i.received_date, 
      u.name AS created_by_name, i.created_by
    FROM inventory_items i
    JOIN users u ON u.id = i.created_by
    WHERE i.current_stage IN ('inventory_entry', 'qc_incoming')
    ORDER BY i.created_at DESC
  `);
  return res.json({ success: true, data: rows });
};

// GET /api/reports/production-detail
const productionDetailReport = async (req, res) => {
  const { rows } = await query(`
    SELECT 
      i.id, i.item_name, i.sku, i.variant, i.quantity, i.unit, i.status, i.updated_at AS started_at,
      u.name AS created_by_name, i.created_by
    FROM inventory_items i
    JOIN users u ON u.id = i.created_by
    WHERE i.current_stage = 'production'
    ORDER BY i.updated_at DESC
  `);
  return res.json({ success: true, data: rows });
};

// GET /api/reports/quality-detail
const qualityDetailReport = async (req, res) => {
  const { rows } = await query(`
    SELECT 
      sh.id, sh.item_id, sh.from_stage, sh.to_stage, sh.status, sh.comments, sh.changed_at,
      i.item_name, i.sku, i.variant, i.quantity, i.unit,
      u.name AS operator_name, u.role AS operator_role
    FROM stage_history sh
    JOIN inventory_items i ON i.id = sh.item_id
    JOIN users u ON u.id = sh.changed_by
    WHERE sh.to_stage IN ('qc_incoming', 'qc_outgoing', 'production', 'finished_goods') 
      AND sh.from_stage IN ('inventory_entry', 'qc_incoming', 'production', 'qc_outgoing')
    ORDER BY sh.changed_at DESC
  `);
  return res.json({ success: true, data: rows });
};

// GET /api/reports/finished-goods-detail
const finishedGoodsDetailReport = async (req, res) => {
  const { rows } = await query(`
    SELECT 
      fg.id, fg.quantity, fg.approved_date, fg.batch_reference, fg.ready_for_invoice,
      i.item_name, i.sku, i.variant, i.unit
    FROM finished_goods fg
    JOIN inventory_items i ON i.id = fg.item_id
    ORDER BY fg.approved_date DESC
  `);
  return res.json({ success: true, data: rows });
};

module.exports = {
  stageSummary,
  avgTimePerStage,
  rejectionRate,
  invoicesSummary,
  throughput,
  inventoryDetailReport,
  productionDetailReport,
  qualityDetailReport,
  finishedGoodsDetailReport
};
