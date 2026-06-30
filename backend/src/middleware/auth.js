const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

/**
 * JWT authentication middleware with single-session enforcement.
 * Expects header: Authorization: Bearer <token>
 * Attaches decoded payload to req.user on success.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Enforce single-device login
    const user = await userModel.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated' });
    }

    // Only validate if a session_id is present (allows transitional state)
    if (decoded.session_id && user.current_session_id !== decoded.session_id) {
      return res.status(401).json({ success: false, message: 'Session expired: logged in from another location' });
    }

    // Use the role from the database, not the potentially stale token
    req.user = { ...decoded, role: user.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = { authenticate };
