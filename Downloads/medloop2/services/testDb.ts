import pool from './db.ts';

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Database time:', res.rows[0]);
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await pool.end();
  }
}

testConnection();
