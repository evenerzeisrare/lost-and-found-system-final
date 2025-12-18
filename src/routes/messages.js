const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/authMiddleware');
const { upload, handleMulterError } = require('../middlewares/upload');
const { reportMessage, sendMessage, getConversation, listMessages, deleteMessage, deleteAllMessages } = require('../controllers/messageController');

router.post('/api/messages/:id/report', ensureAuthenticated, reportMessage);
router.post('/api/messages/send', ensureAuthenticated, upload.single('image'), handleMulterError, sendMessage);
router.get('/api/messages/conversation/:otherId', ensureAuthenticated, getConversation);
router.get('/api/messages', ensureAuthenticated, listMessages);
router.delete('/api/messages/:id', ensureAuthenticated, deleteMessage);
router.post('/api/messages/delete-all', ensureAuthenticated, deleteAllMessages);

module.exports = router;
