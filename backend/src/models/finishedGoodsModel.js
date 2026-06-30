const { query } = require('../config/db');

const finishedGoodsModel = {
  /**
   * Create a finished_goods record when item passes outgoing QC
   */
  async create({ item_id, quantity, approved_date, batch_reference }) {
    const { rows } = await query(
      `INSERT INTO finished_goods (item_id, quantity, approved_date, batch_reference)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [item_id, quantity, approved_date, batch_reference]
    );
    return rows[0];
  },

  /**
   * List finished goods available for invoicing
   */
  async findAll({ ready_for_invoice } = {}) {
    const cond = ready_for_invoice !== undefined
      ? `WHERE fg.ready_for_invoice = ${ready_for_invoice}`
      : '';

    const { rows } = await query(
      `SELECT fg.*, i.item_name, i.sku, i.unit
       FROM finished_goods fg
       JOIN inventory_items i ON i.id = fg.item_id
       ${cond}
       ORDER BY fg.approved_date DESC`
    );
    return rows;
  },

  /**
   * Find a finished_goods record by its item_id
   */
  async findByItemId(item_id) {
    const { rows } = await query(
      `SELECT fg.*, i.item_name, i.sku, i.unit
       FROM finished_goods fg
       JOIN inventory_items i ON i.id = fg.item_id
       WHERE fg.item_id = $1
       LIMIT 1`,
      [item_id]
    );
    return rows[0] || null;
  },

  /**
   * Mark as invoiced (set ready_for_invoice = false)
   */
  async markInvoiced(id) {
    const { rows } = await query(
      `UPDATE finished_goods
       SET ready_for_invoice = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0];
  },
};

module.exports = finishedGoodsModel;
