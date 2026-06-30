const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/stageController');

router.use(authenticate);

// Advance to next stage (role validation inside controller)
router.post('/advance/:itemId', ctrl.advanceStage);
// Reject at QC stage (role validation inside controller)
router.post('/reject/:itemId',  ctrl.rejectItem);

module.exports = router;
