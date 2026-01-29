const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT UNIQUE,
      email TEXT,
      status TEXT,
      payerId TEXT,
      payerEmail TEXT,
      payerGivenName TEXT,
      payerSurname TEXT,
      payerCountryCode TEXT,
      webhookData TEXT,
      licenseStatus TEXT DEFAULT 'NOT_CREATED',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating table "orders"', err.message);
      } else {
        console.log('Table "orders" is already.');
      }
    });
  }
});

module.exports = db;
