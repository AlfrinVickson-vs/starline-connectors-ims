const { Storage } = require('@google-cloud/storage');
const path = require('path');

// On Cloud Run, Application Default Credentials (ADC) are used automatically.
// If GOOGLE_APPLICATION_CREDENTIALS is set (local dev), it will be picked up too.
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

/**
 * Upload a PDF buffer to GCS under invoices/<filename>
 * @param {Buffer} pdfBuffer  - The PDF data
 * @param {string} filename   - Destination filename (e.g. "SC-2024-0001.pdf")
 * @returns {string}          - GCS object path (e.g. "invoices/SC-2024-0001.pdf")
 */
const uploadInvoicePdf = async (pdfBuffer, filename) => {
  const bucket = storage.bucket(bucketName);
  const gcsPath = `invoices/${filename}`;
  const file = bucket.file(gcsPath);

  await file.save(pdfBuffer, {
    metadata: { contentType: 'application/pdf' },
    resumable: false,
  });

  return gcsPath;
};

/**
 * Generate a V4 signed URL for temporary, private access to a GCS object.
 * @param {string} gcsPath    - Object path in the bucket
 * @param {number} [expiryMinutes] - Expiry duration in minutes (default: 60)
 * @returns {string}          - Signed URL
 */
const getSignedUrl = async (gcsPath, expiryMinutes) => {
  const expiry = parseInt(expiryMinutes || process.env.GCS_SIGNED_URL_EXPIRY_MINUTES || '60', 10);
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(gcsPath);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiry * 60 * 1000,
  });

  return url;
};

/**
 * Delete an object from GCS (for cleanup on errors)
 */
const deleteFile = async (gcsPath) => {
  const bucket = storage.bucket(bucketName);
  await bucket.file(gcsPath).delete({ ignoreNotFound: true });
};

module.exports = { uploadInvoicePdf, getSignedUrl, deleteFile };
