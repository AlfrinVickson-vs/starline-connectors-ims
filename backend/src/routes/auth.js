const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const ctrl = require('../controllers/authController');

router.post('/register', ctrl.register);
router.post('/login',    ctrl.login);
router.get('/me',        authenticate, ctrl.getProfile);
router.get('/users',     authenticate, requireRole('admin'), ctrl.listUsers);
router.patch('/users/:id/status', authenticate, requireRole('admin'), ctrl.toggleUserStatus);

module.exports = router;
