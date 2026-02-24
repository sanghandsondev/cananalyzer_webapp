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
    // ========== DROP OLD TABLES (one-time migration) ==========
    // Uncomment below lines if you need to recreate tables
    // await client.query(`DROP TABLE IF EXISTS licenses CASCADE`);
    // await client.query(`DROP TABLE IF EXISTS orders CASCADE`);
    // await client.query(`DROP TABLE IF EXISTS comments CASCADE`);
    // await client.query(`DROP TABLE IF EXISTS users CASCADE`);

    // ========== USERS TABLE ==========
    // Main user table for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table "users" is ready.');

    // ========== COMMENTS TABLE ==========
    // User feedback/comments
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT NULL
      )
    `);
    console.log('Table "comments" is ready.');

    // ========== ORDERS TABLE ==========
    // PayPal orders - using snake_case (PostgreSQL convention)
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        email TEXT,
        product_name TEXT NOT NULL,
        product_price NUMERIC(10, 2) NOT NULL,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'CREATED',
        license_status TEXT DEFAULT 'NOT_CREATED',
        payer_id TEXT,
        payer_email TEXT,
        payer_given_name TEXT,
        payer_surname TEXT,
        payer_country_code TEXT,
        webhook_event_type TEXT,
        webhook_resource_type TEXT,
        webhook_resource_version TEXT,
        webhook_summary TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table "orders" is ready.');

    // ========== LICENSES TABLE ==========
    // Purchased licenses linked to users
    await client.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
        product_name VARCHAR(100) NOT NULL,
        license_key VARCHAR(255),
        purchased_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'active'
      )
    `);
    console.log('Table "licenses" is ready.');

    // ========== INDEXES ==========
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)
    `);

    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err.stack);
    process.exit(1);
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initializeDatabase,
};
