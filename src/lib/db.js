const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, '../../schema.sql'), 'utf8');
  await pool.query(schema);

  // Seed admin padrão
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Administrador', 'admin@fotorank.com', $1, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [hash]
  );
}

module.exports = { pool, initDb };
