/**
 * Role-based access control middleware factory.
 *
 * Usage:
 *   router.post('/advance', authenticate, requireRole('inventory_manager', 'admin'), handler)
 *
 * @param  {...string} roles - One or more allowed roles
 * @returns Express middleware
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role) && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role(s): ${roles.join(', ')}`,
    });
  }
  next();
};

/**
 * Stage-to-allowed-role mapping for workflow transitions.
 * Key   = stage the item is currently IN
 * Value = role allowed to advance/act on it
 */
const STAGE_ROLE_MAP = {
  inventory_entry: 'inventory_manager',
  qc_incoming:     'qc_inspector',
  production:      'production_manager',
  qc_outgoing:     'qc_inspector',
  finished_goods:  'admin',
};

/**
 * Validates that the current user's role may act on an item at a given stage.
 */
const canActOnStage = (userRole, stage) => {
  const allowed = STAGE_ROLE_MAP[stage];
  return userRole === allowed || userRole === 'admin' || userRole === 'super_admin';
};

module.exports = { requireRole, canActOnStage, STAGE_ROLE_MAP };
