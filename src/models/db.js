const mysql = require('mysql2/promise');

let _pool;

async function initializeDatabase() {
  try {
    const hostEnv = process.env.DB_HOST || '127.0.0.1';
    const resolvedHost = (String(hostEnv).toLowerCase() === 'localhost') ? '127.0.0.1' : hostEnv;
    _pool = mysql.createPool({
      host: resolvedHost,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'csu_lost_found',
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000
    });

    const connection = await _pool.getConnection();
    try {
      const [imgUrlCol] = await connection.execute(`SHOW COLUMNS FROM items LIKE 'image_url'`);
      if (imgUrlCol.length === 0) {
        await connection.execute(`ALTER TABLE items ADD COLUMN image_url VARCHAR(500) NULL`);
      }
    } catch (e) {}
    try {
      const [collegeCol] = await connection.execute(`SHOW COLUMNS FROM users LIKE 'college'`);
      if (collegeCol.length === 0) {
        await connection.execute(`ALTER TABLE users ADD COLUMN college VARCHAR(50) NULL AFTER phone_number`);
      }
    } catch (e) {}
    try {
      const [programCol] = await connection.execute(`SHOW COLUMNS FROM users LIKE 'program'`);
      if (programCol.length === 0) {
        await connection.execute(`ALTER TABLE users ADD COLUMN program VARCHAR(200) NULL AFTER college`);
      }
    } catch (e) {}
    try {
      const [msgImgCol] = await connection.execute(`SHOW COLUMNS FROM messages LIKE 'image_url'`);
      if (msgImgCol.length === 0) {
        await connection.execute(`ALTER TABLE messages ADD COLUMN image_url VARCHAR(500) NULL`);
      }
    } catch (e) {}
    connection.release();
    return true;
  } catch (error) {
    try {
      _pool = mysql.createPool({
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'csu_lost_found',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 10000
      });
      const connection = await _pool.getConnection();
      connection.release();
      return true;
    } catch (error2) {
      return false;
    }
  }
}

function pool() {
  return _pool;
}

module.exports = { initializeDatabase, pool };
