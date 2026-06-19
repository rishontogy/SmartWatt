const mysql = require('./backend/node_modules/mysql2/promise');

async function run() {
  try {
    const pool = await mysql.createPool({ 
      host: 'localhost', user: 'root', password: '', 
      database: 'smartwatt', port: 3307 
    });
    const [res] = await pool.query('SELECT * FROM daily_energy_tracking');
    console.log(res);
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
}
run();
