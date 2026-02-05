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
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        orderId TEXT UNIQUE,
        email TEXT,
        status TEXT,
        payerId TEXT,
        payerEmail TEXT,
        payerGivenName TEXT,
        payerSurname TEXT,
        payerCountryCode TEXT,
        webhookEventType TEXT,
        webhookResourceType TEXT,
        webhookResourceVersion TEXT,
        webhookSummary TEXT,
        licenseStatus TEXT DEFAULT 'NOT_CREATED',
        createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Connected to PostgreSQL and table "orders" is ready.');
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
