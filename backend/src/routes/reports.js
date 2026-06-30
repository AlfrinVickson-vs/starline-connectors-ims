const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const ctrl = require('../controllers/reportsController');

router.use(authenticate);
router.use(requireRole('admin', 'inventory_manager'));

router.get('/summary',          ctrl.stageSummary);
router.get('/avg-time',         ctrl.avgTimePerStage);
router.get('/rejection-rate',   ctrl.rejectionRate);
router.get('/invoices-summary', ctrl.invoicesSummary);
router.get('/throughput',       ctrl.throughput);

// Detailed report tables
router.get('/inventory-detail',      ctrl.inventoryDetailReport);
router.get('/production-detail',     ctrl.productionDetailReport);
router.get('/quality-detail',        ctrl.qualityDetailReport);
router.get('/finished-goods-detail', ctrl.finishedGoodsDetailReport);

module.exports = router;
