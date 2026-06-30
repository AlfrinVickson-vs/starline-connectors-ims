const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const userModel = require('../models/userModel');

/**
 * Sign a JWT for a user record
 */
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// POST /api/auth/register
const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required' });
  }

  const existing = await userModel.findByEmail(email);
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const validRoles = ['inventory_manager', 'qc_inspector', 'production_manager', 'admin'];
  const assignedRole = validRoles.includes(role) ? role : 'inventory_manager';

  const user = await userModel.create({ name, email, password_hash, role: assignedRole });
  const token = signToken(user);

  return res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = signToken(user);

  return res.json({
    success: true,
    message: 'Login successful',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};

// GET /api/auth/me
const getProfile = async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json({ success: true, user });
};

// GET /api/auth/users  (admin only)
const listUsers = async (req, res) => {
  const users = await userModel.findAll();
  return res.json({ success: true, users });
};

// PATCH /api/auth/users/:id/status  (admin only)
const toggleUserStatus = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  const user = await userModel.setActive(parseInt(id, 10), is_active);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json({ success: true, user });
};

module.exports = { register, login, getProfile, listUsers, toggleUserStatus };
