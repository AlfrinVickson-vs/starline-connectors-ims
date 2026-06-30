const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const ctrl = require('../controllers/settingsController');

router.get('/public', ctrl.getPublicSettings);
router.get('/', authenticate, requireRole('super_admin'), ctrl.getSettings);
router.put('/', authenticate, requireRole('super_admin'), ctrl.updateSettings);

module.exports = router;
