const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/authMiddleware');
const { upload, handleMulterError } = require('../middlewares/upload');
const { listItems, listMyItems, reportItem, updateItem, deleteItem, getItem, getItemImage, submitClaimProof, updateItemStatusByOwner, claimProofStatus, reportItemIssue } = require('../controllers/itemController');

router.get('/api/items', ensureAuthenticated, listItems);
router.get('/api/student/my-items', ensureAuthenticated, listMyItems);
router.post('/api/items/report', ensureAuthenticated, upload.single('itemImage'), handleMulterError, reportItem);
router.put('/api/items/:id', ensureAuthenticated, upload.single('itemImage'), handleMulterError, updateItem);
router.delete('/api/items/:id', ensureAuthenticated, deleteItem);
router.get('/api/items/:id', ensureAuthenticated, getItem);
router.get('/api/items/:id/image', getItemImage);
router.post('/api/items/:id/claim-proof', ensureAuthenticated, upload.single('proof'), handleMulterError, submitClaimProof);
router.get('/api/items/:id/claim-proof/status', ensureAuthenticated, claimProofStatus);
router.post('/api/items/:id/status', ensureAuthenticated, updateItemStatusByOwner);
router.post('/api/items/:id/report-issue', ensureAuthenticated, reportItemIssue);

module.exports = router;
