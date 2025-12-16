const { pool } = require('../models/db');

async function sendMessage(senderId, receiverId, itemId, message, imageUrl) {
  const connection = await pool().getConnection();
  try {
    const [result] = await connection.execute(
      'INSERT INTO messages (sender_id, receiver_id, item_id, message, image_url) VALUES (?, ?, ?, ?, ?)',
      [senderId, receiverId, itemId, message, imageUrl]
    );
    return result.insertId;
  } finally {
    connection.release();
  }
}

module.exports = { sendMessage };
