const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All manager routes require authentication and Manager role
router.use(authenticateToken);
router.use(requireRole(['Manager']));

// Manager dashboard
router.get('/dashboard', managerController.getManagerDashboard);

// Submit manager review for a checklist
router.post('/checklist/:id/review', managerController.submitManagerReview);

// Get manager reviews for a checklist
router.get('/checklist/:id/reviews', managerController.getManagerReviews);

module.exports = router;