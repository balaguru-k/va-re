const express = require('express');
const router = express.Router();
const executiveController = require('../controllers/executiveController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { imageUpload, compressImages } = require('../middleware/upload');

router.use(authenticateToken);

router.get('/dashboard', requireRole(['Executive']), executiveController.getChecklist);
router.get('/completed', requireRole(['Executive', 'Super Admin']), executiveController.getCompletedChecklists);
router.get('/sc-audit-trail', requireRole(['Executive']), executiveController.getSCAuditTrail);
router.get('/sc-audit-trail/:id', requireRole(['Executive']), executiveController.getSCAuditTrailDetails);
router.get('/checklist/:id/data', requireRole(['Executive']), executiveController.getExecutiveData);
router.get('/checklist/:id/data/auditor', requireRole(['Auditor', 'Supervisor', 'Manager', 'Lead-Auditor', 'Super Admin']), executiveController.getExecutiveData);
router.get('/checklist/:id/status-data', requireRole(['Executive']), executiveController.getExecutiveDataByStatus);
router.post('/checklist/:id/save', requireRole(['Executive']), imageUpload.array('images'), compressImages, executiveController.saveChecklist);
router.post('/checklist/:id/complete', requireRole(['Executive']), imageUpload.array('images'), compressImages, executiveController.completeChecklist);

module.exports = router;