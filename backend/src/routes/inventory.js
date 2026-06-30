const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const ctrl = require('../controllers/inventoryController');

// All inventory routes require authentication
router.use(authenticate);

router.post('/',                  requireRole('inventory_manager', 'admin'), ctrl.createItem);
router.get('/',                   ctrl.listItems);
router.get('/stage/:stage',       ctrl.getItemsByStage);
router.get('/:id',                ctrl.getItem);

module.exports = router;
