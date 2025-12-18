const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/authMiddleware');
const { upload, handleMulterError } = require('../middlewares/upload');
const { adminDashboardData, adminUsers, adminItems, latestClaimProof, allClaimProofs, approveClaim, rejectProof, rejectClaim, adminUpdateItem, adminDeleteItem, claimItem, reportedMessages, deleteAdminMessage } = require('../controllers/adminController');
const { toggleUserActive, deleteUser, adminCheck, adminSetup, setupAdmin, health, testDb } = require('../controllers/adminController');

router.get('/api/admin/dashboard-data', ensureAuthenticated, ensureAdmin, adminDashboardData);
router.get('/api/admin/users', ensureAuthenticated, ensureAdmin, adminUsers);
router.get('/api/admin/items', ensureAuthenticated, ensureAdmin, adminItems);
router.get('/api/admin/items/:id/claim-proof', ensureAuthenticated, ensureAdmin, latestClaimProof);
router.get('/api/admin/items/:id/claim-proofs', ensureAuthenticated, ensureAdmin, allClaimProofs);
router.post('/api/admin/items/:id/approve-claim', ensureAuthenticated, ensureAdmin, approveClaim);
router.post('/api/admin/items/:id/reject-proof', ensureAuthenticated, ensureAdmin, rejectProof);
router.post('/api/admin/items/:id/reject-claim', ensureAuthenticated, ensureAdmin, rejectClaim);
router.post('/api/items/:id/claim', ensureAuthenticated, ensureAdmin, claimItem);
router.put('/api/admin/items/:id', ensureAuthenticated, ensureAdmin, upload.single('itemImage'), handleMulterError, adminUpdateItem);
router.delete('/api/admin/items/:id', ensureAuthenticated, ensureAdmin, adminDeleteItem);
router.get('/api/admin/reported-messages', ensureAuthenticated, ensureAdmin, reportedMessages);
router.delete('/api/admin/messages/:id', ensureAuthenticated, ensureAdmin, deleteAdminMessage);
router.post('/api/admin/users/:id/toggle-active', ensureAuthenticated, ensureAdmin, toggleUserActive);
router.delete('/api/admin/users/:id', ensureAuthenticated, ensureAdmin, deleteUser);
router.get('/api/debug/admin-check', adminCheck);
router.post('/api/admin/setup', adminSetup);
router.post('/api/setup-admin', setupAdmin);
router.get('/api/health', health);
router.get('/api/test-db', testDb);

module.exports = router;
