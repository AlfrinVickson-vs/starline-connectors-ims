const { query } = require('../config/db');

const inventoryModel = {
  /**
   * Create a new inventory item (stage: inventory_entry)
   */
  async create({ item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes, created_by }) {
    const { rows } = await query(
      `INSERT INTO inventory_items
         (item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes, created_by]
    );
    return rows[0];
  },

  /**
   * List all items with creator info (paginated)
   */
  async findAll({ page = 1, limit = 20, stage, status } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (stage)  { params.push(stage);  conditions.push(`i.current_stage = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const { rows } = await query(
      `SELECT i.*, u.name AS created_by_name, u.email AS created_by_email
       FROM inventory_items i
       JOIN users u ON u.id = i.created_by
       ${where}
       ORDER BY i.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM inventory_items i ${where}`,
      conditions.length ? params.slice(0, -2) : []
    );

    return { items: rows, total: parseInt(countRows[0].count, 10) };
  },

  /**
   * Find a single item by ID with full creator info
   */
  async findById(id) {
    const { rows } = await query(
      `SELECT i.*, u.name AS created_by_name, u.email AS created_by_email
       FROM inventory_items i
       JOIN users u ON u.id = i.created_by
       WHERE i.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Items currently at a specific stage (for role dashboards)
   */
  async findByStage(stage) {
    const { rows } = await query(
      `SELECT i.*, u.name AS created_by_name
       FROM inventory_items i
       JOIN users u ON u.id = i.created_by
       WHERE i.current_stage = $1
       ORDER BY i.updated_at ASC`,
      [stage]
    );
    return rows;
  },

  /**
   * Advance an item to the next stage
   */
  async updateStage(id, { current_stage, status }) {
    const { rows } = await query(
      `UPDATE inventory_items
       SET current_stage = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [current_stage, status, id]
    );
    return rows[0] || null;
  },

  /**
   * Summary counts per stage (for reports)
   */
  async countByStage() {
    const { rows } = await query(
      `SELECT current_stage, status, COUNT(*) AS count
       FROM inventory_items
       GROUP BY current_stage, status`
    );
    return rows;
  },
};

module.exports = inventoryModel;
