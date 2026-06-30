const { query } = require('../config/db');

const userModel = {
  /**
   * Find a user by email (for login)
   */
  async findByEmail(email) {
    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Find a user by ID (for JWT payload validation)
   */
  async findById(id) {
    const { rows } = await query(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create a new user
   */
  async create({ name, email, password_hash, role }) {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, password_hash, role]
    );
    return rows[0];
  },

  /**
   * List all users (admin use)
   */
  async findAll() {
    const { rows } = await query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    return rows;
  },

  /**
   * Get all users with a specific role (for notifications)
   */
  async findByRole(role) {
    const { rows } = await query(
      'SELECT id, name, email FROM users WHERE role = $1 AND is_active = TRUE',
      [role]
    );
    return rows;
  },

  /**
   * Deactivate / reactivate a user
   */
  async setActive(id, isActive) {
    const { rows } = await query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, name, email, role, is_active',
      [isActive, id]
    );
    return rows[0];
  },
};

module.exports = userModel;
