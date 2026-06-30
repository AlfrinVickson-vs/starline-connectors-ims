const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const ctrl = require('../controllers/invoiceController');

router.use(authenticate);

router.post('/',                  requireRole('admin'), ctrl.createInvoice);
router.get('/',                   ctrl.listInvoices);
router.get('/:id',                ctrl.getInvoice);
router.get('/:id/download',       ctrl.downloadInvoice);
router.patch('/:id/status',       requireRole('admin'), ctrl.updateInvoiceStatus);

module.exports = router;
