const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/authMiddleware');
const { listNotifications, deleteNotification, markRead, markAllRead } = require('../controllers/notificationController');

router.get('/api/notifications', ensureAuthenticated, listNotifications);
router.delete('/api/notifications/:id', ensureAuthenticated, deleteNotification);
router.post('/api/notifications/:id/read', ensureAuthenticated, markRead);
router.post('/api/notifications/read-all', ensureAuthenticated, markAllRead);

module.exports = router;
