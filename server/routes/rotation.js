const express = require('express');
const router = express.Router();
const rotationController = require('../controllers/rotationController');
const dailyExtraController = require('../controllers/dailyExtraController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// All rotation routes are Super Admin and Lead-Auditor
router.get('/options', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.getRotationOptions);
router.post('/options', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.createOption);
router.delete('/options/:id', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.deleteOption);

router.get('/available-checklists', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.getAvailableChecklists);
router.post('/checklists', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.addChecklistToOption);
router.delete('/checklists/:id', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.removeChecklistFromOption);
router.put('/checklists/:id/assign', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.assignAuditor);

router.post('/switch', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.switchActiveOption);
router.post('/temp-swap', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.tempSwapAuditor);
router.post('/temp-unassign', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.tempUnassign);
router.get('/history', requireRole(['Super Admin', 'Lead-Auditor']), rotationController.getSwitchHistory);

// Daily Extra Assignments (one-day-only)
router.get('/daily-extra/available-checklists', requireRole(['Super Admin', 'Lead-Auditor']), dailyExtraController.getAvailableChecklistsForExtra);
router.post('/daily-extra', requireRole(['Super Admin', 'Lead-Auditor']), dailyExtraController.createExtraAssignment);
router.get('/daily-extra', requireRole(['Super Admin', 'Lead-Auditor']), dailyExtraController.getExtraAssignments);
router.delete('/daily-extra/:id', requireRole(['Super Admin', 'Lead-Auditor']), dailyExtraController.deleteExtraAssignment);

module.exports = router;
