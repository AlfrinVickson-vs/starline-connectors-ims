const { query, getClient } = require('../config/db');

const inventoryModel = {
  /**
   * Create a new inventory item (stage: inventory_entry)
   */
  async create({ item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes, variant, created_by }) {
    const { rows } = await query(
      `INSERT INTO inventory_items
         (item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes, variant, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes, variant, created_by]
    );
    return rows[0];
  },

  /**
   * Bulk-insert multiple items within an existing transaction client.
   * Each item: { item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes, variant }
   * @param {Array}  items      - validated item objects
   * @param {number} created_by - user id
   * @param {object} client     - pg PoolClient (transaction must be managed by caller)
   */
  async bulkCreate(items, created_by, client) {
    if (!items || items.length === 0) return [];

    const today = new Date().toISOString().split('T')[0];
    const values = [];
    const placeholders = items.map((item, i) => {
      const base = i * 10;
      values.push(
        item.item_name,
        item.sku           || null,
        parseFloat(item.quantity),
        item.unit          || 'pcs',
        item.received_date || today,
        item.supplier_name || null,
        item.batch_number  || null,
        item.notes         || null,
        item.variant        || null,
        created_by
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`;
    });

    const { rows } = await client.query(
      `INSERT INTO inventory_items
         (item_name, sku, quantity, unit, received_date, supplier_name, batch_number, notes, variant, created_by)
       VALUES ${placeholders.join(',')}
       RETURNING *`,
      values
    );
    return rows;
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
   * Partial-approval update (QC Outgoing only).
   * Simultaneously sets approved qty, rejected qty, stage and status.
   * @param {number} id
   * @param {object} opts
   * @param {number} opts.approved_qty    - quantity that passed QC
   * @param {number} opts.rejected_qty    - quantity that failed QC
   * @param {string} opts.current_stage   - new stage (finished_goods)
   * @param {string} opts.status          - 'approved'
   */
  async updateQuantityAndStage(id, { approved_qty, rejected_qty, current_stage, status }) {
    const { rows } = await query(
      `UPDATE inventory_items
       SET quantity          = $1,
           rejected_quantity = $2,
           current_stage     = $3,
           status            = $4,
           updated_at        = NOW()
       WHERE id = $5
       RETURNING *`,
      [approved_qty, rejected_qty, current_stage, status, id]
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
