const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { authenticateToken } = require('../middleware/auth');
const { combinedUpload, processUploads } = require('../middleware/upload');

router.use(authenticateToken);

router.get('/', complaintController.getComplaints);
router.post('/', combinedUpload, processUploads, complaintController.createComplaint);
router.put('/:id/complete', complaintController.completeComplaint);
router.delete('/:id', complaintController.deleteComplaint);

module.exports = router;
