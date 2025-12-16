const { pool } = require('../models/db');
const bcrypt = require('bcryptjs');

async function toggleUserActive(userId) {
  const connection = await pool().getConnection();
  try {
    const [user] = await connection.execute('SELECT is_active FROM users WHERE id = ?', [userId]);
    if (user.length === 0) return { notFound: true };
    const newStatus = !user[0].is_active;
    await connection.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);
    return { is_active: newStatus };
  } finally {
    connection.release();
  }
}

async function adminCheck() {
  const connection = await pool().getConnection();
  try {
    const [adminUsers] = await connection.execute('SELECT id, email, role, is_active FROM users WHERE email = ? AND role = "admin"', ['lostfound.devteam@gmail.com']);
    return { adminExists: adminUsers.length > 0, adminUser: adminUsers[0] || null };
  } finally {
    connection.release();
  }
}

async function adminSetup(email, password) {
  const connection = await pool().getConnection();
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? AND role = "admin"', [email]);
    if (existing.length > 0) {
      await connection.execute('UPDATE users SET password = ?, is_active = TRUE WHERE id = ?', [hashedPassword, existing[0].id]);
      return { updated: true };
    } else {
      await connection.execute('INSERT INTO users (full_name, email, password, role, is_active) VALUES (?, ?, ?, "admin", TRUE)', ['Admin User', email, hashedPassword]);
      return { created: true };
    }
  } finally {
    connection.release();
  }
}

async function setupAdminDefault() {
  const adminEmail = 'lostfound.devteam@gmail.com';
  const adminPassword = 'lost@!found$#developement1234@team*&^';
  const connection = await pool().getConnection();
  try {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? AND role = "admin"', [adminEmail]);
    if (existing.length > 0) {
      await connection.execute('UPDATE users SET password = ?, is_active = TRUE WHERE id = ?', [hashedPassword, existing[0].id]);
      return { reset: true, credentials: { email: adminEmail, password: adminPassword } };
    } else {
      await connection.execute('INSERT INTO users (full_name, email, password, role, is_active) VALUES (?, ?, ?, "admin", TRUE)', ['Admin User', adminEmail, hashedPassword]);
      return { created: true, credentials: { email: adminEmail, password: adminPassword } };
    }
  } finally {
    connection.release();
  }
}

async function healthInfo(sessionID, isAuthenticated) {
  const _pool = pool();
  if (!_pool) {
    return { status: 'error', message: 'Database pool not initialized', pool: 'not initialized' };
  }
  const connection = await _pool.getConnection();
  try {
    await connection.ping();
    return { status: 'ok', message: 'Server is running', database: 'connected', session: sessionID ? 'active' : 'none', authenticated: isAuthenticated ? 'yes' : 'no' };
  } finally {
    connection.release();
  }
}

async function testDbInfo(dbName) {
  const _pool = pool();
  if (!_pool) {
    return { success: false, error: 'Database pool not initialized' };
  }
  const connection = await _pool.getConnection();
  try {
    const [tables] = await connection.execute(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (\'users\', \'items\', \'messages\', \'notifications\', \'announcements\')',
      [dbName || 'csu_lost_found']
    );
    const [adminUsers] = await connection.execute('SELECT id, email, role, is_active FROM users WHERE email = ? AND role = "admin"', ['lostfound.devteam@gmail.com']);
    const [itemColumns] = await connection.execute('SHOW COLUMNS FROM items');
    return { success: true, tables: tables.map(t => t.TABLE_NAME), adminExists: adminUsers.length > 0, adminUser: adminUsers[0] || null, itemColumns: itemColumns.map(c => c.Field), hasImageBase64: itemColumns.some(c => c.Field === 'image_base64'), hasImageUrl: itemColumns.some(c => c.Field === 'image_url') };
  } finally {
    connection.release();
  }
}

module.exports = { toggleUserActive, adminCheck, adminSetup, setupAdminDefault, healthInfo, testDbInfo };
