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

module.exports = { stageSummary, avgTimePerStage, rejectionRate, invoicesSummary, throughput };
