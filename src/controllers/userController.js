const { pool } = require('../models/db');

async function studentDashboardData(req, res) {
  try {
    const userId = req.user.id;
    const connection = await pool().getConnection();
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_count,
        COUNT(CASE WHEN status = 'found' THEN 1 END) as found_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN claimed_by = ? THEN 1 END) as claimed_count
      FROM items WHERE reported_by = ?
    `, [userId, userId]);
    const [recentItems] = await connection.execute(`
      SELECT i.*, u.full_name as reporter_name 
      FROM items i 
      LEFT JOIN users u ON i.reported_by = u.id 
      WHERE i.status IN ('lost', 'found')
      ORDER BY i.created_at DESC LIMIT 8
    `);
    const [notifCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );
    const [announcements] = await connection.execute(`
      SELECT a.*, u.full_name as admin_name 
      FROM announcements a 
      LEFT JOIN users u ON a.admin_id = u.id 
      WHERE a.is_active = TRUE 
      ORDER BY a.created_at DESC LIMIT 3
    `);
    connection.release();
    res.json({ success: true, stats: stats[0] || { lost_count: 0, found_count: 0, pending_count: 0, claimed_count: 0 }, recentItems: recentItems || [], unreadNotifications: notifCount[0]?.count || 0, announcements: announcements || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function studentProfile(req, res) {
  try {
    const userId = req.user.id;
    const connection = await pool().getConnection();
    const [userInfo] = await connection.execute('SELECT id, full_name, email, student_id, phone_number, contact_method, avatar_url FROM users WHERE id = ?', [userId]);
    const [userItems] = await connection.execute('SELECT * FROM items WHERE reported_by = ? ORDER BY created_at DESC LIMIT 6', [userId]);
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_count,
        COUNT(CASE WHEN status = 'found' THEN 1 END) as found_count,
        COUNT(CASE WHEN claimed_by = ? THEN 1 END) as claimed_count
      FROM items WHERE reported_by = ? OR claimed_by = ?
    `, [userId, userId, userId]);
    connection.release();
    res.json({ success: true, user: userInfo[0] || {}, items: userItems || [], stats: stats[0] || { lost_count: 0, found_count: 0, claimed_count: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { phoneNumber, contactMethod } = req.body;
    let avatarUrl = null;
    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;
    }
    const connection = await pool().getConnection();
    await connection.execute('UPDATE users SET phone_number = ?, contact_method = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?', [phoneNumber, contactMethod, avatarUrl, userId]);
    connection.release();
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

module.exports = { studentDashboardData, studentProfile, updateProfile };
