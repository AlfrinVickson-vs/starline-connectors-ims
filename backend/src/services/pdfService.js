const puppeteer = require('puppeteer');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Cache compiled template for performance
let compiledTemplate = null;

const getTemplate = () => {
  if (!compiledTemplate) {
    const templatePath = path.join(__dirname, '../../templates/invoice.html');
    const source = fs.readFileSync(templatePath, 'utf8');
    compiledTemplate = Handlebars.compile(source);
  }
  return compiledTemplate;
};

// Register Handlebars helpers
Handlebars.registerHelper('inr', (value) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(value)
);

Handlebars.registerHelper('formatDate', (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
});

Handlebars.registerHelper('sno', (index) => index + 1);

/**
 * Generate a PDF buffer from invoice data using Puppeteer.
 *
 * @param {Object} invoiceData - Full invoice object including line_items array
 * @returns {Buffer}           - PDF file as a buffer
 */
const generateInvoicePdf = async (invoiceData) => {
  const template = getTemplate();
  const html = template(invoiceData);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '16mm', bottom: '16mm', left: '16mm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

module.exports = { generateInvoicePdf };
