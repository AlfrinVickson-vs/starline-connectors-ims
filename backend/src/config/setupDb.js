require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function setupDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL is not set in your .env file.');
    process.exit(1);
  }

  console.log('🔌 Connecting to the database...');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Required for Supabase/hosted databases
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('📖 Reading schema.sql...');
    const schemaPath = path.join(__dirname, '../../db/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('🚀 Running schema script...');
    // We execute the SQL schema. Simple pg client query executes multi-statement strings.
    await client.query(sql);
    console.log('🎉 Database schema applied successfully! Admin user created.');
  } catch (err) {
    console.error('❌ Database setup failed:', err);
  } finally {
    await client.end();
  }
}

setupDatabase();
