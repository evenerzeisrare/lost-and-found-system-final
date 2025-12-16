const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/authMiddleware');
const { studentDashboardData, studentProfile, updateProfile } = require('../controllers/userController');
const { upload, handleMulterError } = require('../middlewares/upload');

router.get('/api/student/dashboard-data', ensureAuthenticated, studentDashboardData);
router.get('/api/student/profile', ensureAuthenticated, studentProfile);
router.post('/api/student/update-profile', ensureAuthenticated, upload.single('profileImage'), handleMulterError, updateProfile);

module.exports = router;
