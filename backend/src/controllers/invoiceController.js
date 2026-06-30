const invoiceModel       = require('../models/invoiceModel');
const finishedGoodsModel = require('../models/finishedGoodsModel');
const { generateInvoicePdf } = require('../services/pdfService');
const { uploadInvoicePdf, getSignedUrl } = require('../services/gcsService');
const { sendInvoiceEmail } = require('../services/emailService');

// Company home state for GST calculation (intra = CGST+SGST, inter = IGST)
const COMPANY_STATE = process.env.COMPANY_STATE || 'Maharashtra';

/**
 * Calculate GST breakdown.
 * @param {number} subtotal
 * @param {number} gstRate     - e.g. 18 for 18%
 * @param {string} customerState
 */
const calculateGst = (subtotal, gstRate, customerState) => {
  const gstAmount = parseFloat(((subtotal * gstRate) / 100).toFixed(2));
  const isIntraState = customerState.trim().toLowerCase() === COMPANY_STATE.trim().toLowerCase();

  if (isIntraState) {
    const half = parseFloat((gstAmount / 2).toFixed(2));
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: gstAmount };
};

// POST /api/invoices
const createInvoice = async (req, res) => {
  const {
    customer_name, customer_address, customer_gstin, customer_state,
    invoice_date, line_items,           // array of { item_id, description, hsn_code, quantity, unit_price, gst_rate }
    send_email_to,                      // optional array of emails
  } = req.body;

  if (!customer_name || !customer_address || !customer_state || !line_items?.length) {
    return res.status(400).json({
      success: false,
      message: 'customer_name, customer_address, customer_state, and line_items are required',
    });
  }

  // Build line items with totals
  let subtotal = 0;
  const processedLines = line_items.map((li) => {
    const lineTotal = parseFloat((li.quantity * li.unit_price).toFixed(2));
    subtotal += lineTotal;
    return { ...li, line_total: lineTotal };
  });

  // Use the first line item's gst_rate for overall GST (simplification; could average)
  const gstRate = parseFloat(line_items[0]?.gst_rate || 18);
  const { cgst, sgst, igst } = calculateGst(subtotal, gstRate, customer_state);
  const total_amount = parseFloat((subtotal + cgst + sgst + igst).toFixed(2));

  const invoice_number = await invoiceModel.nextInvoiceNumber();

  const invoiceData = {
    invoice_number,
    customer_name,
    customer_address,
    customer_gstin: customer_gstin || null,
    customer_state,
    invoice_date:   invoice_date || new Date().toISOString().split('T')[0],
    subtotal:       parseFloat(subtotal.toFixed(2)),
    cgst, sgst, igst,
    total_amount,
    created_by:     req.user.id,
  };

  // Create DB record
  const invoice = await invoiceModel.create({ invoice: invoiceData, lineItems: processedLines });

  // Generate PDF
  const fullInvoice = { ...invoice, line_items: processedLines };
  const pdfBuffer = await generateInvoicePdf(fullInvoice);

  // Upload to GCS
  const filename   = `${invoice_number}.pdf`;
  const gcsPath    = await uploadInvoicePdf(pdfBuffer, filename);
  const signedUrl  = await getSignedUrl(gcsPath);

  // Update invoice with PDF info
  const updatedInvoice = await invoiceModel.setPdfUrl(invoice.id, {
    pdf_url:      signedUrl,
    pdf_gcs_path: gcsPath,
  });

  // Mark finished goods as invoiced
  for (const li of line_items) {
    if (li.item_id) {
      const fg = await finishedGoodsModel.findByItemId(li.item_id);
      if (fg) await finishedGoodsModel.markInvoiced(fg.id);
    }
  }

  // Optional invoice email
  if (send_email_to?.length) {
    sendInvoiceEmail({
      to:            send_email_to,
      invoiceNumber: invoice_number,
      customerName:  customer_name,
      signedUrl,
      totalAmount:   total_amount,
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Invoice created successfully',
    invoice: updatedInvoice,
    pdf_url: signedUrl,
  });
};

// GET /api/invoices
const listInvoices = async (req, res) => {
  const { page = 1, limit = 20, customer, status, from_date, to_date } = req.query;
  const result = await invoiceModel.findAll({
    page:      parseInt(page, 10),
    limit:     parseInt(limit, 10),
    customer:  customer  || undefined,
    status:    status    || undefined,
    from_date: from_date || undefined,
    to_date:   to_date   || undefined,
  });
  return res.json({ success: true, ...result });
};

// GET /api/invoices/:id
const getInvoice = async (req, res) => {
  const invoice = await invoiceModel.findById(parseInt(req.params.id, 10));
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
  return res.json({ success: true, invoice });
};

// GET /api/invoices/:id/download   — fresh signed URL
const downloadInvoice = async (req, res) => {
  const invoice = await invoiceModel.findById(parseInt(req.params.id, 10));
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
  if (!invoice.pdf_gcs_path) {
    return res.status(404).json({ success: false, message: 'PDF not yet generated for this invoice' });
  }
  const signedUrl = await getSignedUrl(invoice.pdf_gcs_path);
  return res.json({ success: true, signed_url: signedUrl });
};

// PATCH /api/invoices/:id/status
const updateInvoiceStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'issued', 'paid', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  const invoice = await invoiceModel.updateStatus(parseInt(req.params.id, 10), status);
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
  return res.json({ success: true, invoice });
};

module.exports = { createInvoice, listInvoices, getInvoice, downloadInvoice, updateInvoiceStatus };
