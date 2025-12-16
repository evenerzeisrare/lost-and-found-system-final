const { pool } = require('../models/db');
const { addNotification } = require('../services/notifications');
const bcrypt = require('bcryptjs');

async function adminDashboardData(req, res) {
  let connection;
  try {
    connection = await pool().getConnection();
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_verification,
        COUNT(CASE WHEN status = 'found' THEN 1 END) as ready_for_claim,
        COUNT(CASE WHEN status = 'claimed' AND MONTH(created_at) = MONTH(CURRENT_DATE()) THEN 1 END) as claimed_this_month,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as unresolved_reports,
        COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned_items,
        0 as reported_messages,
        0 as inactive_users
      FROM items
    `);
    const [recentReports] = await connection.execute(`
      SELECT i.*, u.full_name as reporter_name 
      FROM items i 
      LEFT JOIN users u ON i.reported_by = u.id 
      ORDER BY i.created_at DESC LIMIT 10
    `);
    connection.release();
    res.json({ success: true, stats: stats[0] || { pending_verification: 0, ready_for_claim: 0, claimed_this_month: 0, unresolved_reports: 0, returned_items: 0, reported_messages: 0, inactive_users: 0 }, recentReports: recentReports || [] });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function adminUsers(req, res) {
  try {
    const connection = await pool().getConnection();
    const [users] = await connection.execute(`
      SELECT id, full_name, email, student_id, role, is_active, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    connection.release();
    res.json({ success: true, users: users || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function adminItems(req, res) {
  try {
    const connection = await pool().getConnection();
  const [items] = await connection.execute(`
      SELECT i.*, u.full_name, u.student_id, c.full_name as claimed_by_name 
      FROM items i 
      LEFT JOIN users u ON i.reported_by = u.id 
      LEFT JOIN users c ON i.claimed_by = c.id 
      ORDER BY i.created_at DESC
    `);
    connection.release();
    res.json({ success: true, items: items || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function latestClaimProof(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    connection = await pool().getConnection();
    const [items] = await connection.execute('SELECT id, item_name, reported_by FROM items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const item = items[0];
    const [proofRows] = await connection.execute(`
      SELECT m.id, m.sender_id, m.message, m.image_url, m.created_at,
             s.full_name as sender_name
      FROM messages m
      LEFT JOIN users s ON m.sender_id = s.id
      WHERE m.item_id = ? AND m.image_url IS NOT NULL AND m.sender_id <> ?
      ORDER BY m.created_at DESC
      LIMIT 1
    `, [itemId, item.reported_by]);
    connection.release();
    res.json({ success: true, proof: proofRows[0] || null });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function allClaimProofs(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    connection = await pool().getConnection();
    const [items] = await connection.execute('SELECT id, reported_by FROM items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const item = items[0];
    const [rows] = await connection.execute(`
      SELECT m.id, m.sender_id, m.message, m.image_url, m.created_at,
             u.full_name AS sender_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.item_id = ? AND m.image_url IS NOT NULL AND m.sender_id <> ?
      ORDER BY m.created_at DESC
    `, [itemId, item.reported_by]);
    connection.release();
    res.json({ success: true, proofs: rows || [] });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function approveClaim(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    const { claimer_id } = req.body;
    connection = await pool().getConnection();
    const [items] = await connection.execute('SELECT id, item_name, reported_by, claimed_by, status FROM items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const item = items[0];
    if (item.status === 'claimed' && item.claimed_by) {
      connection.release();
      return res.status(400).json({ success: false, error: 'Item already claimed' });
    }
    let finalClaimerId = claimer_id;
    if (!finalClaimerId) {
      const [proofRows] = await connection.execute(`
        SELECT m.sender_id
        FROM messages m
        WHERE m.item_id = ? AND m.image_url IS NOT NULL AND m.sender_id <> ?
        ORDER BY m.created_at DESC
        LIMIT 1
      `, [itemId, item.reported_by]);
      if (proofRows.length === 0) {
        connection.release();
        return res.status(400).json({ success: false, error: 'No proof available to determine claimer' });
      }
      finalClaimerId = proofRows[0].sender_id;
    }
    const [userRows] = await connection.execute('SELECT id FROM users WHERE id = ? AND is_active = TRUE', [finalClaimerId]);
    if (userRows.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, error: 'Claimer not found or inactive' });
    }
    await connection.execute('UPDATE items SET claimed_by = ?, status = "claimed" WHERE id = ?', [finalClaimerId, itemId]);
    await addNotification(item.reported_by, 'Item Claimed', `Your item "${item.item_name}" was approved as claimed by admin`, 'claim', itemId);
    await addNotification(finalClaimerId, 'Claim Approved', `Your claim for item "${item.item_name}" was approved by admin`, 'success', itemId);
    connection.release();
    res.json({ success: true, message: 'Claim approved and item marked as claimed' });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function rejectProof(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    const { claimer_id, reason } = req.body;
    if (!claimer_id) {
      return res.status(400).json({ success: false, error: 'claimer_id is required' });
    }
    connection = await pool().getConnection();
    const [items] = await connection.execute('SELECT id, item_name, reported_by FROM items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const item = items[0];
    const msg = reason && reason.trim() ? reason.trim() : `Your proof for item "${item.item_name}" was rejected by admin`;
    await addNotification(claimer_id, 'Claim Proof Rejected', msg, 'warning', itemId);
    connection.release();
    res.json({ success: true, message: 'Proof rejected and user notified' });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function rejectClaim(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    connection = await pool().getConnection();
    const [items] = await connection.execute('SELECT id, item_name, reported_by, claimed_by FROM items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const item = items[0];
    if (!item.claimed_by) {
      await connection.execute('UPDATE items SET status = "found" WHERE id = ?', [itemId]);
      await addNotification(item.reported_by, 'Claim Rejected', `The claim for your item "${item.item_name}" was rejected by admin`, 'warning', itemId);
      connection.release();
      return res.json({ success: true, message: 'Claim rejection applied (item not currently claimed)' });
    }
    await connection.execute('UPDATE items SET claimed_by = NULL, status = "found" WHERE id = ?', [itemId]);
    await addNotification(item.claimed_by, 'Claim Rejected', `Your claim for item "${item.item_name}" was rejected by admin`, 'warning', itemId);
    await addNotification(item.reported_by, 'Claim Rejected', `The claim for your item "${item.item_name}" was rejected by admin`, 'warning', itemId);
    connection.release();
    res.json({ success: true, message: 'Claim rejected and item reset to found' });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function adminUpdateItem(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    const { itemName, category, description, place, dateLostFound, status, contactInfo } = req.body;
    connection = await pool().getConnection();
    const [items] = await connection.execute('SELECT * FROM items WHERE id = ?', [itemId]);
    let imageUrl = items[0]?.image_url || null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    await connection.execute(`UPDATE items SET item_name = ?, category = ?, description = ?, place = ?, date_lost_found = ?, status = ?, contact_info = ?, image_url = ? WHERE id = ?`, [itemName, category, description, place, dateLostFound, status, contactInfo, imageUrl, itemId]);
    connection.release();
    res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function adminDeleteItem(req, res) {
  let connection;
  try {
    const path = require('path');
    const fs = require('fs');
    const { uploadsDir } = require('../middlewares/upload');
    const itemId = req.params.id;
    connection = await pool().getConnection();
    const [items] = await connection.execute('SELECT image_url FROM items WHERE id = ?', [itemId]);
    await connection.execute('DELETE FROM items WHERE id = ?', [itemId]);
    connection.release();
    const imageUrl = items[0]?.image_url;
    if (imageUrl && imageUrl.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, path.basename(imageUrl));
      fs.unlink(filePath, () => {});
    }
    res.json({ success: true });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function claimItem(req, res) {
  try {
    const itemId = req.params.id;
    const { claimer_id } = req.body;
    const connection = await pool().getConnection();
    const [item] = await connection.execute('SELECT * FROM items WHERE id = ? AND status = "found"', [itemId]);
    if (item.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'Item not found or cannot be claimed' });
    }
    if (!claimer_id) {
      connection.release();
      return res.status(400).json({ error: 'claimer_id is required' });
    }
    const [userRows] = await connection.execute('SELECT id FROM users WHERE id = ? AND is_active = TRUE', [claimer_id]);
    if (userRows.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'Claimer not found or inactive' });
    }
    await connection.execute('UPDATE items SET claimed_by = ?, status = "claimed" WHERE id = ?', [claimer_id, itemId]);
    await addNotification(item[0].reported_by, 'Item Claimed', `Your item "${item[0].item_name}" has been marked claimed by admin`, 'claim', itemId);
    await addNotification(claimer_id, 'Claim Approved', `Your claim for item "${item[0].item_name}" was approved by admin`, 'success', itemId);
    await connection.execute('INSERT INTO notifications (user_id, title, message, type, related_id) SELECT id, ' + "'Item Claimed'" + ', ' + "'Item \"" + item[0].item_name + "\" was approved as claimed" + ', ' + "'info'" + ', ? FROM users WHERE role = ' + "'admin'", [itemId]);
    connection.release();
    res.json({ success: true, message: 'Claim approved and item marked as claimed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function reportedMessages(req, res) {
  try {
    const connection = await pool().getConnection();
    const [messages] = await connection.execute(`
      SELECT m.*, s.full_name as sender_name, s.email as sender_email, r.full_name as receiver_name, r.email as receiver_email, i.item_name
      FROM messages m
      LEFT JOIN users s ON m.sender_id = s.id
      LEFT JOIN users r ON m.receiver_id = r.id
      LEFT JOIN items i ON m.item_id = i.id
      WHERE m.reported = TRUE
      ORDER BY m.reported_at DESC`);
    connection.release();
    res.json({ success: true, messages: messages || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function deleteAdminMessage(req, res) {
  try {
    const messageId = req.params.id;
    const connection = await pool().getConnection();
    await connection.execute('DELETE FROM messages WHERE id = ?', [messageId]);
    connection.release();
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function toggleUserActive(req, res) {
  try {
    const userId = req.params.id;
    const connection = await pool().getConnection();
    const [user] = await connection.execute('SELECT is_active, full_name, email FROM users WHERE id = ?', [userId]);
    if (user.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'User not found' });
    }
    const newStatus = !user[0].is_active;
    await connection.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);
    const statusText = newStatus ? 'activated' : 'deactivated';
    await addNotification(userId, 'Account Status Updated', `Your account has been ${statusText} by an administrator`, newStatus ? 'success' : 'warning');
    connection.release();
    res.json({ success: true, message: `User ${statusText} successfully`, is_active: newStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function adminCheck(req, res) {
  try {
    const connection = await pool().getConnection();
    const [adminUsers] = await connection.execute('SELECT id, email, role, is_active FROM users WHERE email = ? AND role = "admin"', ['lostfound.devteam@gmail.com']);
    connection.release();
    res.json({ adminExists: adminUsers.length > 0, adminUser: adminUsers[0] || null });
  } catch (error) {
    res.json({ error: error.message });
  }
}

async function adminSetup(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const connection = await pool().getConnection();
    const hashedPassword = await bcrypt.hash(password, 10);
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? AND role = "admin"', [email]);
    if (existing.length > 0) {
      await connection.execute('UPDATE users SET password = ?, is_active = TRUE WHERE id = ?', [hashedPassword, existing[0].id]);
      connection.release();
      return res.json({ success: true, message: 'Admin password updated' });
    } else {
      await connection.execute('INSERT INTO users (full_name, email, password, role, is_active) VALUES (?, ?, ?, "admin", TRUE)', ['Admin User', email, hashedPassword]);
      connection.release();
      return res.json({ success: true, message: 'Admin user created' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

async function setupAdmin(req, res) {
  try {
    const connection = await pool().getConnection();
    const adminEmail = 'lostfound.devteam@gmail.com';
    const adminPassword = 'lost@!found$#developement1234@team*&^';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? AND role = "admin"', [adminEmail]);
    if (existing.length > 0) {
      await connection.execute('UPDATE users SET password = ?, is_active = TRUE WHERE id = ?', [hashedPassword, existing[0].id]);
      connection.release();
      return res.json({ success: true, message: 'Admin password reset', credentials: { email: adminEmail, password: adminPassword } });
    } else {
      await connection.execute('INSERT INTO users (full_name, email, password, role, is_active) VALUES (?, ?, ?, "admin", TRUE)', ['Admin User', adminEmail, hashedPassword]);
      connection.release();
      return res.json({ success: true, message: 'Admin user created', credentials: { email: adminEmail, password: adminPassword } });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

async function health(req, res) {
  try {
    const _pool = pool();
    if (!_pool) {
      return res.json({ status: 'error', message: 'Database pool not initialized', pool: 'not initialized' });
    }
    const connection = await _pool.getConnection();
    await connection.ping();
    connection.release();
    res.json({ status: 'ok', message: 'Server is running', database: 'connected', session: req.sessionID ? 'active' : 'none', authenticated: req.isAuthenticated() ? 'yes' : 'no' });
  } catch (error) {
    res.json({ status: 'error', message: 'Database connection failed', error: error.message });
  }
}

async function testDb(req, res) {
  try {
    const _pool = pool();
    if (!_pool) {
      return res.json({ success: false, error: 'Database pool not initialized' });
    }
    const connection = await _pool.getConnection();
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('users', 'items', 'messages', 'notifications', 'announcements')
    `, [process.env.DB_NAME || 'csu_lost_found']);
    const [adminUsers] = await connection.execute('SELECT id, email, role, is_active FROM users WHERE email = ? AND role = "admin"', ['lostfound.devteam@gmail.com']);
    const [itemColumns] = await connection.execute('SHOW COLUMNS FROM items');
    connection.release();
    res.json({ success: true, tables: tables.map(t => t.TABLE_NAME), adminExists: adminUsers.length > 0, adminUser: adminUsers[0] || null, itemColumns: itemColumns.map(c => c.Field), hasImageBase64: itemColumns.some(c => c.Field === 'image_base64'), hasImageUrl: itemColumns.some(c => c.Field === 'image_url') });
  } catch (error) {
    res.json({ success: false, error: error.message, code: error.code });
  }
}

module.exports = { adminDashboardData, adminUsers, adminItems, latestClaimProof, allClaimProofs, approveClaim, rejectProof, rejectClaim, adminUpdateItem, adminDeleteItem, claimItem, reportedMessages, deleteAdminMessage, toggleUserActive, adminCheck, adminSetup, setupAdmin, health, testDb };
