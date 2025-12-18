const { pool } = require('../models/db');
const { sendMessage: sendMessageService } = require('../services/messagesService');
const { addNotification } = require('../services/notifications');

async function ensureItemDeleteColumn(connection) {
  try {
    await connection.execute('ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_by_reporter BOOLEAN DEFAULT FALSE');
  } catch (e) {}
}

async function listItems(req, res) {
  try {
    const connection = await pool().getConnection();
    await ensureItemDeleteColumn(connection);
    const [items] = await connection.execute(`
      SELECT i.*, u.full_name as reporter_name, c.full_name as claimed_by_name
      FROM items i 
      LEFT JOIN users u ON i.reported_by = u.id 
      LEFT JOIN users c ON i.claimed_by = c.id 
      WHERE i.status IN ('lost', 'found')
      AND (i.deleted_by_reporter IS NULL OR i.deleted_by_reporter = FALSE)
      ORDER BY i.created_at DESC
    `);
    connection.release();
    res.json({ success: true, items: items || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function listMyItems(req, res) {
  try {
    const userId = req.user.id;
    const connection = await pool().getConnection();
    await ensureItemDeleteColumn(connection);
    const [items] = await connection.execute('SELECT * FROM items WHERE reported_by = ? AND (deleted_by_reporter IS NULL OR deleted_by_reporter = FALSE) ORDER BY created_at DESC', [userId]);
    connection.release();
    res.json({ success: true, items: items || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function reportItem(req, res) {
  let connection;
  try {
    const userId = req.user.id;
    const [userRows] = await (await pool().getConnection()).execute('SELECT is_active FROM users WHERE id = ?', [userId]);
    if (!userRows.length || userRows[0].is_active !== 1) {
      return res.status(403).json({ success: false, error: 'Banned users cannot report items' });
    }
    const { itemName, category, description, place, dateLostFound, status, contactInfo } = req.body;
    if (!itemName || !category || !description || !place || !dateLostFound || !status || !contactInfo) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    connection = await pool().getConnection();
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    const [result] = await connection.execute(`
      INSERT INTO items (
        item_name, category, description, place, 
        date_lost_found, status, contact_info, reported_by, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [itemName, category, description, place, dateLostFound, status, contactInfo, userId, imageUrl]);
    const [lastInsert] = await connection.execute('SELECT LAST_INSERT_ID() as id');
    const itemId = lastInsert[0].id;
    await connection.execute(`
      INSERT INTO notifications (user_id, title, message, type, related_id)
      SELECT id, 'New Item Report', ?, 'info', ?
      FROM users WHERE role = 'admin'
    `, [`New ${status} item reported: ${itemName}`, itemId]);
    connection.release();
    res.json({ success: true, message: 'Item reported successfully.', itemId: itemId });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function updateItem(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    const userId = req.user.id;
    const { itemName, category, description, place, dateLostFound, status, contactInfo } = req.body;
    connection = await pool().getConnection();
    const [items] = await connection.execute('SELECT * FROM items WHERE id = ? AND reported_by = ?', [itemId, userId]);
    if (items.length === 0) {
      connection.release();
      return res.status(403).json({ error: 'Not authorized to edit this item' });
    }
    let imageUrl = items[0].image_url;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    await connection.execute(`
      UPDATE items SET 
        item_name = ?, category = ?, description = ?, place = ?, 
        date_lost_found = ?, status = ?, contact_info = ?, image_url = ?
      WHERE id = ?
    `, [itemName, category, description, place, dateLostFound, status, contactInfo, imageUrl, itemId]);
    connection.release();
    res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function deleteItem(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    const userId = req.user.id;
    connection = await pool().getConnection();
    await ensureItemDeleteColumn(connection);
    const [items] = await connection.execute('SELECT * FROM items WHERE id = ? AND reported_by = ?', [itemId, userId]);
    if (items.length === 0) {
      connection.release();
      return res.status(403).json({ error: 'Not authorized to delete this item' });
    }
    await connection.execute('UPDATE items SET deleted_by_reporter = TRUE WHERE id = ?', [itemId]);
    connection.release();
    res.json({ success: true, message: 'Item marked deleted for admin review' });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function getItem(req, res) {
  try {
    const itemId = req.params.id;
    const connection = await pool().getConnection();
    const [items] = await connection.execute(`
      SELECT i.*, 
             u.full_name as reporter_name,
             u.student_id as reporter_student_id,
             c.full_name as claimed_by_name
      FROM items i
      LEFT JOIN users u ON i.reported_by = u.id
      LEFT JOIN users c ON i.claimed_by = c.id
      WHERE i.id = ?
    `, [itemId]);
    connection.release();
    if (items.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, item: items[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function getItemImage(req, res) {
  try {
    const itemId = req.params.id;
    const connection = await pool().getConnection();
    const [rows] = await connection.execute('SELECT image_base64, image_url FROM items WHERE id = ?', [itemId]);
    connection.release();
    if (rows.length === 0) {
      return res.status(404).send('Item not found');
    }
    const item = rows[0];
    if (item.image_base64) {
      const imgBuffer = Buffer.from(item.image_base64, 'base64');
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': imgBuffer.length });
      return res.end(imgBuffer);
    }
    if (item.image_url) {
      if (item.image_url.startsWith('data:image')) {
        const base64Data = item.image_url.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': imgBuffer.length });
        return res.end(imgBuffer);
      } else {
        return res.redirect(item.image_url);
      }
    }
    return res.status(404).send('Image not found');
  } catch (error) {
    res.status(500).send('Server error');
  }
}

async function submitClaimProof(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    const userId = req.user.id;
    const { note } = req.body;
    connection = await pool().getConnection();
    const [userRows] = await connection.execute('SELECT is_active FROM users WHERE id = ?', [userId]);
    if (!userRows.length || userRows[0].is_active !== 1) {
      connection.release();
      return res.status(403).json({ success: false, error: 'Banned users cannot claim' });
    }
    const [itemRows] = await connection.execute('SELECT * FROM items WHERE id = ?', [itemId]);
    if (itemRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Item not found' });
    }
    const item = itemRows[0];
    if (item.reported_by === userId) {
      connection.release();
      return res.status(403).json({ error: 'Reporter cannot submit claim proof' });
    }
    let imageUrl = null;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;
    const appendedMessage = note ? note : null;
    if (item.reported_by) {
      await sendMessageService(userId, item.reported_by, itemId, appendedMessage || 'Claim proof submitted', imageUrl);
      await addNotification(item.reported_by, 'Claim Proof', `A claimant submitted proof for your item "${item.item_name}"`, 'claim', itemId);
    }
<<<<<<< HEAD
=======
    const [admins] = await connection.execute('SELECT id FROM users WHERE role = "admin" AND is_active = TRUE');
    for (const admin of admins) {
      await sendMessageService(userId, admin.id, itemId, appendedMessage || 'Claim proof submitted', imageUrl);
      await addNotification(admin.id, 'Claim Proof', `A claimant submitted proof for item "${item.item_name}"`, 'claim', itemId);
    }
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
    connection.release();
    res.json({ success: true });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

module.exports = { listItems, listMyItems, reportItem, updateItem, deleteItem, getItem, getItemImage, submitClaimProof, updateItemStatusByOwner, claimProofStatus, reportItemIssue };
async function updateItemStatusByOwner(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    const { status } = req.body;
    const userId = req.user.id;
    if (!['claimed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    connection = await pool().getConnection();
    const [rows] = await connection.execute('SELECT reported_by FROM items WHERE id = ?', [itemId]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const item = rows[0];
    if (Number(item.reported_by) !== Number(userId)) {
      connection.release();
      return res.status(403).json({ success: false, error: 'Not allowed' });
    }
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
    const claimerId = proofRows[0].sender_id;
    const [claimerRows] = await connection.execute('SELECT id, is_active, full_name FROM users WHERE id = ?', [claimerId]);
    if (!claimerRows.length || claimerRows[0].is_active !== 1) {
      connection.release();
      return res.status(400).json({ success: false, error: 'Claimer not found or banned' });
    }
    await connection.execute('UPDATE items SET status = ?, claimed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, claimerId, itemId]);
    await addNotification(userId, 'Item Claimed', 'Your item was marked as claimed', 'claim', itemId);
    await addNotification(claimerId, 'Claim Approved', 'Your claim was approved by the owner', 'success', itemId);
    connection.release();
    res.json({ success: true, message: `Item marked as ${status}` });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function claimProofStatus(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    const userId = req.user.id;
    connection = await pool().getConnection();
    const [rows] = await connection.execute(
      `SELECT id FROM messages WHERE sender_id = ? AND item_id = ? AND image_url IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [userId, itemId]
    );
    connection.release();
    res.json({ success: true, submitted: rows.length > 0 });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function reportItemIssue(req, res) {
  let connection;
  try {
    const itemId = req.params.id;
    const userId = req.user.id;
    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, error: 'Reason is required' });
    }
    connection = await pool().getConnection();
    const [items] = await connection.execute('SELECT id, item_name, reported_by FROM items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const item = items[0];
    const [admins] = await connection.execute('SELECT id FROM users WHERE role = "admin" AND is_active = TRUE');
    for (const admin of admins) {
      await addNotification(admin.id, 'Item Reported', `Item "${item.item_name}" was reported: ${String(reason).trim()}`, 'report', itemId);
    }
    if (item.reported_by && Number(item.reported_by) !== Number(userId)) {
      await addNotification(item.reported_by, 'Your Item Was Reported', `Your item "${item.item_name}" was reported to admin for review`, 'warning', itemId);
    }
    connection.release();
    res.json({ success: true, message: 'Item reported to admin' });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
