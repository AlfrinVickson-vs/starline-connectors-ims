// Vercel Serverless Function entry point
// Wraps the Express app so Vercel can invoke it as a serverless handler
const app = require('../src/app');

module.exports = app;
