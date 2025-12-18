const { pool } = require('../models/db');

async function listNotifications(req, res) {
  try {
    const userId = req.user.id;
    const connection = await pool().getConnection();
    const [notifications] = await connection.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [userId]);
    const unreadCount = notifications.filter(n => !n.is_read).length;
    connection.release();
    res.json({ success: true, notifications: notifications || [], unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function deleteNotification(req, res) {
  try {
    const notificationId = req.params.id;
    const connection = await pool().getConnection();
    await connection.execute('DELETE FROM notifications WHERE id = ? AND user_id = ?', [notificationId, req.user.id]);
    connection.release();
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function markRead(req, res) {
  try {
    const notificationId = req.params.id;
    const connection = await pool().getConnection();
    await connection.execute('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [notificationId, req.user.id]);
    connection.release();
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function markAllRead(req, res) {
  try {
    const userId = req.user.id;
    const connection = await pool().getConnection();
    await connection.execute('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
    connection.release();
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

module.exports = { listNotifications, deleteNotification, markRead, markAllRead };
