const { query, getClient } = require('../config/db');

const invoiceModel = {
  /**
   * Generate the next sequential invoice number: SC-YYYY-NNNN
   */
  async nextInvoiceNumber() {
    const year = new Date().getFullYear();
    const { rows } = await query(
      `SELECT COUNT(*) AS cnt FROM invoices WHERE invoice_number LIKE $1`,
      [`SC-${year}-%`]
    );
    const seq = parseInt(rows[0].cnt, 10) + 1;
    return `SC-${year}-${String(seq).padStart(4, '0')}`;
  },

  /**
   * Create invoice with line items in a transaction
   */
  async create({ invoice, lineItems }) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { rows: invRows } = await client.query(
        `INSERT INTO invoices
           (invoice_number, customer_name, customer_address, customer_gstin, customer_state,
            invoice_date, subtotal, cgst, sgst, igst, total_amount, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          invoice.invoice_number, invoice.customer_name, invoice.customer_address,
          invoice.customer_gstin, invoice.customer_state, invoice.invoice_date,
          invoice.subtotal, invoice.cgst, invoice.sgst, invoice.igst,
          invoice.total_amount, 'draft', invoice.created_by,
        ]
      );
      const newInvoice = invRows[0];

      for (const li of lineItems) {
        await client.query(
          `INSERT INTO invoice_line_items
             (invoice_id, item_id, description, hsn_code, quantity, unit_price, gst_rate, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [newInvoice.id, li.item_id, li.description, li.hsn_code,
           li.quantity, li.unit_price, li.gst_rate, li.line_total]
        );
      }

      await client.query('COMMIT');
      return newInvoice;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Update PDF URL and GCS path after upload, set status to 'issued'
   */
  async setPdfUrl(id, { pdf_url, pdf_gcs_path }) {
    const { rows } = await query(
      `UPDATE invoices
       SET pdf_url = $1, pdf_gcs_path = $2, status = 'issued', updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [pdf_url, pdf_gcs_path, id]
    );
    return rows[0];
  },

  /**
   * List invoices with filters and pagination
   */
  async findAll({ page = 1, limit = 20, customer, status, from_date, to_date } = {}) {
    const conditions = [];
    const params = [];

    if (customer)  { params.push(`%${customer}%`);  conditions.push(`customer_name ILIKE $${params.length}`); }
    if (status)    { params.push(status);            conditions.push(`status = $${params.length}`); }
    if (from_date) { params.push(from_date);         conditions.push(`invoice_date >= $${params.length}`); }
    if (to_date)   { params.push(to_date);           conditions.push(`invoice_date <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const { rows } = await query(
      `SELECT i.*, u.name AS created_by_name
       FROM invoices i
       JOIN users u ON u.id = i.created_by
       ${where}
       ORDER BY i.invoice_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM invoices ${where}`,
      params.slice(0, -2)
    );

    return { invoices: rows, total: parseInt(countRows[0].count, 10) };
  },

  /**
   * Find invoice by ID with line items
   */
  async findById(id) {
    const { rows } = await query(
      `SELECT i.*, u.name AS created_by_name
       FROM invoices i JOIN users u ON u.id = i.created_by
       WHERE i.id = $1`,
      [id]
    );
    if (!rows[0]) return null;

    const { rows: lineItems } = await query(
      `SELECT li.*, inv.item_name
       FROM invoice_line_items li
       LEFT JOIN inventory_items inv ON inv.id = li.item_id
       WHERE li.invoice_id = $1`,
      [id]
    );

    return { ...rows[0], line_items: lineItems };
  },

  /**
   * Update status (paid / cancelled)
   */
  async updateStatus(id, status) {
    const { rows } = await query(
      `UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0];
  },
};

module.exports = invoiceModel;
