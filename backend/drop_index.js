const mysql = require('mysql2/promise');

async function fix() {
  const pool = mysql.createPool({ 
    host: 'localhost', user: 'root', password: '', database: 'smartwatt' 
  });
  try {
    await pool.query('ALTER TABLE devices DROP INDEX unique_master_per_user;');
    console.log('Index dropped successfully!');
  } catch(e) {
    console.log('Error dropping index (it might not exist):', e.message);
  }
  process.exit(0);
}
fix();
