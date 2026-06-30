const nodemailer = require('nodemailer');

// Lazy-initialized transporter (avoids startup failures if SMTP not configured)
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Send a stage-change notification email.
 * @param {Object} opts
 * @param {string[]} opts.to        - Array of recipient email addresses
 * @param {string}   opts.subject   - Email subject
 * @param {string}   opts.itemName  - Name of the inventory item
 * @param {string}   opts.fromStage - Previous stage
 * @param {string}   opts.toStage   - New stage
 * @param {string}   opts.status    - approved | rejected | pending
 * @param {string}   [opts.comments]- Optional reviewer comments
 * @param {string}   opts.changedBy - Name of the user who changed the stage
 */
const sendStageChangeNotification = async ({
  to, subject, itemName, fromStage, toStage, status, comments, changedBy,
}) => {
  if (!to || to.length === 0) return;

  const stageLabel = (s) =>
    (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const statusColor = status === 'approved' ? '#22c55e' : status === 'rejected' ? '#ef4444' : '#f59e0b';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
    .card { background: #fff; border-radius: 12px; max-width: 560px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 28px 32px; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; }
    .header p  { color: #94a3b8; margin: 4px 0 0; font-size: 13px; }
    .body   { padding: 28px 32px; }
    .badge  { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #fff; background: ${statusColor}; }
    .field  { margin: 16px 0; }
    .label  { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
    .value  { color: #0f172a; font-size: 15px; font-weight: 500; }
    .arrow  { color: #94a3b8; margin: 0 8px; }
    .comments { background: #f8fafc; border-left: 3px solid #6366f1; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 8px; color: #475569; font-style: italic; font-size: 14px; }
    .footer { background: #f8fafc; padding: 16px 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Starline Connectors IMS</h1>
      <p>Inventory Management System — Automated Notification</p>
    </div>
    <div class="body">
      <p style="margin-top:0; color:#475569;">An inventory item has changed stage:</p>
      <div class="field">
        <div class="label">Item</div>
        <div class="value">${itemName}</div>
      </div>
      <div class="field">
        <div class="label">Stage Transition</div>
        <div class="value">
          ${fromStage ? stageLabel(fromStage) : 'New Entry'}
          <span class="arrow">→</span>
          ${stageLabel(toStage)}
        </div>
      </div>
      <div class="field">
        <div class="label">Status</div>
        <span class="badge">${status.toUpperCase()}</span>
      </div>
      ${comments ? `<div class="field"><div class="label">Comments</div><div class="comments">${comments}</div></div>` : ''}
      <div class="field">
        <div class="label">Changed By</div>
        <div class="value">${changedBy}</div>
      </div>
    </div>
    <div class="footer">This is an automated notification from Starline Connectors IMS. Do not reply to this email.</div>
  </div>
</body>
</html>`;

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'IMS <noreply@starlineconnectors.com>',
      to: to.join(', '),
      subject,
      html,
    });
  } catch (err) {
    // Log but don't crash the request if email fails
    console.error('[emailService] Failed to send email:', err.message);
  }
};

/**
 * Send an invoice email with PDF attached or linked.
 */
const sendInvoiceEmail = async ({ to, invoiceNumber, customerName, signedUrl, totalAmount }) => {
  if (!to || to.length === 0) return;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f5; margin:0; padding:20px; }
  .card { background:#fff; border-radius:12px; max-width:560px; margin:0 auto; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,.08); }
  .header { background: linear-gradient(135deg,#1e293b 0%,#334155 100%); padding:28px 32px; }
  .header h1 { color:#fff; margin:0; font-size:22px; }
  .body { padding:28px 32px; }
  .btn { display:inline-block; background:#6366f1; color:#fff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px; margin-top:16px; }
  .footer { background:#f8fafc; padding:16px 32px; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; }
</style>
</head>
<body>
  <div class="card">
    <div class="header"><h1>Invoice from Starline Connectors</h1></div>
    <div class="body">
      <p>Dear <strong>${customerName}</strong>,</p>
      <p>Please find your invoice <strong>${invoiceNumber}</strong> amounting to <strong>₹${totalAmount.toLocaleString('en-IN')}</strong>.</p>
      <a class="btn" href="${signedUrl}">Download Invoice PDF</a>
      <p style="color:#94a3b8; font-size:12px; margin-top:16px;">Link expires in 60 minutes.</p>
    </div>
    <div class="footer">Starline Connectors — IMS Automated Invoice System</div>
  </div>
</body>
</html>`;

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'IMS <noreply@starlineconnectors.com>',
      to: to.join(', '),
      subject: `Invoice ${invoiceNumber} from Starline Connectors`,
      html,
    });
  } catch (err) {
    console.error('[emailService] Failed to send invoice email:', err.message);
  }
};

module.exports = { sendStageChangeNotification, sendInvoiceEmail };
