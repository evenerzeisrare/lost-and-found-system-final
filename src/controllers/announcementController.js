const { pool } = require('../models/db');

async function listAnnouncements(req, res) {
  try {
    const connection = await pool().getConnection();
    const [announcements] = await connection.execute(
      `SELECT a.*, u.full_name as admin_name 
       FROM announcements a 
       LEFT JOIN users u ON a.admin_id = u.id 
       WHERE a.is_active = TRUE 
       ORDER BY a.created_at DESC`
    );
    connection.release();
    res.json({ success: true, announcements: announcements || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function adminCreateAnnouncement(req, res) {
  try {
    const { title, content } = req.body;
    const adminId = req.user.id;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const connection = await pool().getConnection();
    const [result] = await connection.execute(
      'INSERT INTO announcements (admin_id, title, content) VALUES (?, ?, ?)',
      [adminId, title, content]
    );
    await connection.execute(
      `INSERT INTO notifications (user_id, title, message, type, related_id)
       SELECT id, 'New Announcement', ?, 'info', ?
       FROM users WHERE role = 'student' AND is_active = TRUE`,
      [title, result.insertId]
    );
    connection.release();
    res.json({ success: true, message: 'Announcement created successfully', announcementId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function adminListAllAnnouncements(req, res) {
  try {
    const connection = await pool().getConnection();
    const [announcements] = await connection.execute(
      `SELECT a.*, u.full_name as admin_name 
       FROM announcements a 
       LEFT JOIN users u ON a.admin_id = u.id 
       ORDER BY a.created_at DESC`
    );
    connection.release();
    res.json({ success: true, announcements: announcements || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function toggleAnnouncementActive(req, res) {
  try {
    const announcementId = req.params.id;
    const connection = await pool().getConnection();
    const [announcement] = await connection.execute('SELECT is_active FROM announcements WHERE id = ?', [announcementId]);
    if (announcement.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Announcement not found' });
    }
    const newStatus = !announcement[0].is_active;
    await connection.execute('UPDATE announcements SET is_active = ? WHERE id = ?', [newStatus, announcementId]);
    connection.release();
    res.json({ success: true, message: `Announcement ${newStatus ? 'activated' : 'deactivated'} successfully`, is_active: newStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function deleteAnnouncement(req, res) {
  try {
    const announcementId = req.params.id;
    const connection = await pool().getConnection();
    await connection.execute('DELETE FROM announcements WHERE id = ?', [announcementId]);
    connection.release();
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function updateAnnouncement(req, res) {
  try {
    const announcementId = req.params.id;
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }
    const connection = await pool().getConnection();
    const [exists] = await connection.execute('SELECT id FROM announcements WHERE id = ?', [announcementId]);
    if (exists.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Announcement not found' });
    }
    await connection.execute('UPDATE announcements SET title = ?, content = ? WHERE id = ?', [title, content, announcementId]);
    connection.release();
    res.json({ success: true, message: 'Announcement updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

module.exports = {
  listAnnouncements,
  adminCreateAnnouncement,
  adminListAllAnnouncements,
  toggleAnnouncementActive,
  deleteAnnouncement,
  updateAnnouncement
};
