const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const ctrl = require('../controllers/authController');

router.post('/register', ctrl.register);
router.post('/login',    ctrl.login);
router.get('/me',        authenticate, ctrl.getProfile);
router.get('/users',     authenticate, requireRole('super_admin'), ctrl.listUsers);
router.patch('/users/:id/status', authenticate, requireRole('super_admin'), ctrl.toggleUserStatus);
router.put('/users/:id', authenticate, requireRole('super_admin'), ctrl.updateUser);

module.exports = router;
