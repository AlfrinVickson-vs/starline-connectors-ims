const { query } = require('../config/db');

// GET /api/settings
const getSettings = async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM company_settings WHERE id = 1');
    return res.json({ success: true, settings: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/settings/public
const getPublicSettings = async (req, res) => {
  try {
    const { rows } = await query('SELECT company_name, company_logo FROM company_settings WHERE id = 1');
    return res.json({ success: true, settings: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/settings
const updateSettings = async (req, res) => {
  const { company_name, company_address, company_email, company_contact, company_gstin, company_logo } = req.body;
  const { role } = req.user;

  if (role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Only Super Administrators can modify settings' });
  }

  if (!company_name || !company_address || !company_email || !company_contact || !company_gstin) {
    return res.status(400).json({ success: false, message: 'All company settings fields (including GSTIN) are required' });
  }

  try {
    const { rows } = await query(
      `UPDATE company_settings
       SET company_name = $1, company_address = $2, company_email = $3, company_contact = $4, company_gstin = $5, company_logo = COALESCE($6, company_logo)
       WHERE id = 1
       RETURNING *`,
      [company_name, company_address, company_email, company_contact, company_gstin, company_logo]
    );
    return res.json({ success: true, message: 'Company settings updated successfully', settings: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSettings, getPublicSettings, updateSettings };
