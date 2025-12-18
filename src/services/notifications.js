const { pool } = require('../models/db');

async function addNotification(userId, title, message, type = null, relatedId = null) {
  const connection = await pool().getConnection();
  try {
    const [result] = await connection.execute(
      'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
      [userId, title, message, type, relatedId]
    );
    return result.insertId;
  } finally {
    connection.release();
  }
}

module.exports = { addNotification };
