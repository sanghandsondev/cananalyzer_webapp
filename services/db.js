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
    console.log('Connected to PostgreSQL and table "paypal_orders" is ready.');
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
