const mysql = require("mysql2");

// create connection pool (BEST PRACTICE)
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "", // default in XAMPP
    database: "smartwatt",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// test connection
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ DB Connection Failed:", err);
    } else {
        console.log("✅ Connected to MySQL database");
        connection.release();
    }
});

module.exports = db;