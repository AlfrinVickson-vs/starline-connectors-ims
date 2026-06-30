const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }  // Cloud SQL proxy / SSL
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

/**
 * Helper: run a single query with automatic connection management.
 * @param {string} text   - SQL statement
 * @param {Array}  params - Parameterized values
 */
const query = (text, params) => pool.query(text, params);

/**
 * Helper: get a dedicated client for transactions.
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
