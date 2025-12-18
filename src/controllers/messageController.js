const { pool } = require('../models/db');
const { sendMessage: sendMessageService } = require('../services/messagesService');
const { addNotification } = require('../services/notifications');

async function ensureMessageDeleteColumns(connection) {
  try {
    await connection.execute('ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by_sender BOOLEAN DEFAULT FALSE');
    await connection.execute('ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by_receiver BOOLEAN DEFAULT FALSE');
  } catch (e) {}
}

async function sendMessage(req, res) {
  try {
    const { receiver_id, item_id, message } = req.body;
    const sender_id = req.user.id;
    if (!receiver_id || !message) {
      return res.status(400).json({ error: 'Receiver and message are required' });
    }
    if (Number(receiver_id) === Number(sender_id)) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }
    const connection = await pool().getConnection();
    const [receiver] = await connection.execute('SELECT id, role FROM users WHERE id = ? AND is_active = TRUE', [receiver_id]);
    if (receiver.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'Receiver not found' });
    }
    if (receiver[0].role === 'admin' && req.user.role !== 'admin') {
      connection.release();
      return res.status(403).json({ error: 'Messaging admin is not allowed' });
    }
    const itemId = (item_id === undefined || item_id === '' ? null : item_id);
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    const insertedId = await sendMessageService(sender_id, receiver_id, itemId, message, imageUrl);
    const [sender] = await connection.execute('SELECT full_name FROM users WHERE id = ?', [sender_id]);
    await addNotification(receiver_id, 'New Message', `You have a new message from ${sender[0].full_name}`, 'message', insertedId);
    connection.release();
    res.json({ success: true, message: 'Message sent successfully', messageId: insertedId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function getConversation(req, res) {
  try {
    const userId = req.user.id;
    const otherId = req.params.otherId;
    const connection = await pool().getConnection();
    await ensureMessageDeleteColumns(connection);
    const [messages] = await connection.execute(
      `SELECT m.*, s.full_name as sender_name, r.full_name as receiver_name, i.item_name, i.image_url as item_image_url, i.image_base64 as item_image_base64
       FROM messages m
       LEFT JOIN users s ON m.sender_id = s.id
       LEFT JOIN users r ON m.receiver_id = r.id
       LEFT JOIN items i ON m.item_id = i.id
       WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
       AND m.reported = FALSE
       AND NOT (m.sender_id = ? AND m.deleted_by_sender = TRUE)
       AND NOT (m.receiver_id = ? AND m.deleted_by_receiver = TRUE)
       ORDER BY m.created_at ASC`,
      [userId, otherId, otherId, userId, userId, userId]
    );
    await connection.execute('UPDATE messages SET is_read = TRUE WHERE receiver_id = ? AND sender_id = ? AND is_read = FALSE', [userId, otherId]);
    connection.release();
    res.json({ success: true, messages: messages || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function listMessages(req, res) {
  try {
    const userId = req.user.id;
    const connection = await pool().getConnection();
    await ensureMessageDeleteColumns(connection);
    const [messages] = await connection.execute(
      `SELECT m.*, s.full_name as sender_name, r.full_name as receiver_name, i.item_name, i.image_url as item_image_url, i.image_base64 as item_image_base64
       FROM messages m
       LEFT JOIN users s ON m.sender_id = s.id
       LEFT JOIN users r ON m.receiver_id = r.id
       LEFT JOIN items i ON m.item_id = i.id
       WHERE (m.sender_id = ? OR m.receiver_id = ?)
       AND m.reported = FALSE
       AND NOT (m.sender_id = ? AND m.deleted_by_sender = TRUE)
       AND NOT (m.receiver_id = ? AND m.deleted_by_receiver = TRUE)
       ORDER BY m.created_at DESC`,
      [userId, userId, userId, userId]
    );
    connection.release();
    res.json({ success: true, messages: messages || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function deleteMessage(req, res) {
  let connection;
  try {
    const messageId = req.params.id;
    const userId = req.user.id;
    connection = await pool().getConnection();
    await ensureMessageDeleteColumns(connection);
    const [rows] = await connection.execute('SELECT sender_id, receiver_id FROM messages WHERE id = ?', [messageId]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    const msg = rows[0];
    if (Number(msg.sender_id) !== Number(userId) && Number(msg.receiver_id) !== Number(userId)) {
      connection.release();
      return res.status(403).json({ success: false, error: 'Not allowed' });
    }
    if (Number(msg.sender_id) === Number(userId)) {
      await connection.execute('UPDATE messages SET deleted_by_sender = TRUE WHERE id = ?', [messageId]);
    } else {
      await connection.execute('UPDATE messages SET deleted_by_receiver = TRUE WHERE id = ?', [messageId]);
    }
    connection.release();
    res.json({ success: true });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function deleteAllMessages(req, res) {
  try {
    const userId = req.user.id;
    const connection = await pool().getConnection();
    const [result] = await connection.execute('DELETE FROM messages WHERE (sender_id = ? OR receiver_id = ?) AND reported = FALSE', [userId, userId]);
    connection.release();
    res.json({ success: true, deleted: result?.affectedRows || 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function reportMessage(req, res) {
  let connection;
  try {
    const messageId = req.params.id;
    const { reason } = req.body || {};
    const userId = req.user.id;
    connection = await pool().getConnection();
    const [rows] = await connection.execute('SELECT sender_id, receiver_id, message FROM messages WHERE id = ?', [messageId]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    const msg = rows[0];
    if (Number(msg.sender_id) !== Number(userId) && Number(msg.receiver_id) !== Number(userId)) {
      connection.release();
      return res.status(403).json({ success: false, error: 'Not allowed' });
    }
    await connection.execute('UPDATE messages SET reported = TRUE, reported_at = CURRENT_TIMESTAMP, reported_reason = ? WHERE id = ?', [reason || null, messageId]);
    const [admins] = await connection.execute('SELECT id FROM users WHERE role = "admin" AND is_active = TRUE');
    for (const admin of admins) {
      const snippet = (msg.message || '').slice(0, 120);
      await connection.execute('INSERT INTO notifications (user_id, title, message, related_id) VALUES (?, ?, ?, ?)', [admin.id, 'Message Reported', snippet ? `Reported: "${snippet}"` : 'A message has been reported.', messageId]);
    }
    connection.release();
    res.json({ success: true });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

module.exports = { reportMessage, sendMessage, getConversation, listMessages, deleteMessage, deleteAllMessages };
