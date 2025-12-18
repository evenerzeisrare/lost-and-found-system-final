const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/authMiddleware');
const {
  listAnnouncements,
  adminCreateAnnouncement,
  adminListAllAnnouncements,
  toggleAnnouncementActive,
  deleteAnnouncement,
  updateAnnouncement
} = require('../controllers/announcementController');

router.get('/api/announcements', ensureAuthenticated, listAnnouncements);
router.post('/api/admin/announcements', ensureAuthenticated, ensureAdmin, adminCreateAnnouncement);
router.get('/api/admin/all-announcements', ensureAuthenticated, ensureAdmin, adminListAllAnnouncements);
router.post('/api/admin/announcements/:id/toggle-active', ensureAuthenticated, ensureAdmin, toggleAnnouncementActive);
router.delete('/api/admin/announcements/:id', ensureAuthenticated, ensureAdmin, deleteAnnouncement);
router.put('/api/admin/announcements/:id', ensureAuthenticated, ensureAdmin, updateAnnouncement);

module.exports = router;
