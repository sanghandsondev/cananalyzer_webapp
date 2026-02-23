const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    // Create paypal_orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS paypal_orders (
        id SERIAL PRIMARY KEY,
        orderId TEXT UNIQUE,
        email TEXT,
        productName TEXT,
        productPrice NUMERIC(10, 2),
        currency TEXT DEFAULT 'USD',
        status TEXT,
        licenseStatus TEXT DEFAULT 'NOT_CREATED',
        payerId TEXT,
        payerEmail TEXT,
        payerGivenName TEXT,
        payerSurname TEXT,
        payerCountryCode TEXT,
        webhookEventType TEXT,
        webhookResourceType TEXT,
        webhookResourceVersion TEXT,
        webhookSummary TEXT,
        createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table "paypal_orders" is ready.');

    // Create feedback_users table for authentication (separate from any existing users table)
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table "feedback_users" is ready.');

    // Create feedback_comments table for feedback
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback_comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES feedback_users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT NULL
      )
    `);
    console.log('Table "feedback_comments" is ready.');

    // Add updated_at column if it doesn't exist (for existing tables)
    await client.query(`
      ALTER TABLE feedback_comments 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NULL
    `);

    // Create index on comments for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_comments_created_at ON feedback_comments(created_at DESC)
    `);

    console.log('Connected to PostgreSQL and all tables are ready.');
  } catch (err) {
    console.error('Error initializing database', err.stack);
    // Exit the process if DB initialization fails
    process.exit(1);
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initializeDatabase,
};
