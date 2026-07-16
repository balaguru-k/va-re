const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Apply authentication middleware to all report routes
router.use(authenticateToken);

// NC Report Endpoint (Admin and Super Admin only)
router.get('/ncs', requireRole(['Admin', 'Super Admin']), reportController.getNCReport);
router.get('/ncs/export', requireRole(['Admin', 'Super Admin']), reportController.exportNCReport);

// Reason Analysis Report Endpoint (Admin and Super Admin only)
router.get('/analysis', requireRole(['Admin', 'Super Admin','Manager','Supervisor']), reportController.getReasonAnalysisReport);
router.get('/analysis/export', requireRole(['Admin', 'Super Admin','Manager','Supervisor']), reportController.exportReasonAnalysisReport);

// Checklist Items Report Endpoint
router.get('/items', requireRole(['Admin', 'Super Admin']), reportController.getChecklistItemsReport);
router.get('/items/export', requireRole(['Admin', 'Super Admin']), reportController.exportChecklistItemsReport);

// User Status Report Endpoint
router.get('/users-status', requireRole(['Admin', 'Super Admin','Supervisor']), reportController.getUserStatusReport);
router.get('/users-status/export', requireRole(['Admin', 'Super Admin','Supervisor']), reportController.exportUserStatusReport);

// Manager/Supervisor NC Counts
router.get('/nc-counts', requireRole(['Admin', 'Super Admin','Manager']), reportController.getManagerSupervisorNCCounts);
router.get('/nc-counts/export', requireRole(['Admin', 'Super Admin','Manager']), reportController.exportManagerSupervisorNCCounts);

// Audit Status Report Endpoint
router.get('/audit-status', requireRole(['Admin', 'Super Admin','Supervisor']), reportController.getAuditStatusReport);
router.get('/audit-status/export', requireRole(['Admin', 'Super Admin','Supervisor']), reportController.exportAuditStatusReport);
router.get('/audit-status/export-detailed', requireRole(['Admin', 'Super Admin','Supervisor']), reportController.exportAuditStatusReportDetailed);
router.get('/audit-status/email-config', requireRole(['Admin', 'Super Admin']), reportController.getAuditStatusEmailConfig);
router.post('/audit-status/send-email', requireRole(['Admin', 'Super Admin']), reportController.sendAuditStatusEmail);

// Mail Tracker Report Endpoint
router.get('/mail-tracker', requireRole(['Admin', 'Super Admin']), reportController.getMailTrackerReport);
router.get('/mail-tracker/export', requireRole(['Admin', 'Super Admin']), reportController.exportMailTrackerReport);

// Checklist Score Report Endpoint
router.get('/checklist-scores', requireRole(['Admin', 'Super Admin']), reportController.getChecklistScoreReport);
router.get('/checklist-scores/export', requireRole(['Admin', 'Super Admin']), reportController.exportChecklistScoreReport);

// Supervisor Report Endpoint (Supervisor only)
router.get('/supervisor-report', requireRole(['Supervisor']), reportController.getSupervisorReport);
router.get('/supervisor-report/export', requireRole(['Supervisor']), reportController.exportSupervisorReport);
router.get('/supervisor-executives', requireRole(['Supervisor']), reportController.getSupervisorExecutives);

// Supervisor Checklist Report
router.get('/supervisor-checklist-list', requireRole(['Supervisor','Manager','Business Head']), reportController.getSupervisorChecklistList);
router.get('/supervisor-checklist-report', requireRole(['Supervisor','Manager','Business Head']), reportController.getSupervisorChecklistReport);
router.get('/supervisor-checklist-report/export', requireRole(['Supervisor','Manager','Business Head']), reportController.exportSupervisorChecklistReport);

// Admin checklist view endpoint
router.get('/checklist/:checklistId/view', reportController.getChecklistView);

// Dashboard NC Chart (Admin)
router.get('/dashboard-nc-chart', requireRole(['Admin', 'Super Admin']), reportController.getDashboardNCChart);
router.get('/checklist-nc-summary', requireRole(['Admin', 'Super Admin']), reportController.getChecklistNCSummary);

// manager reports
router.get('/va-report', requireRole(['Super Admin']), reportController.getVAReport);
router.get('/departments', requireRole(['Manager','Business Head']), reportController.getDepartments);
router.get('/departments/user', requireRole(['Manager','Business Head']), reportController.getDepartmentsByUser);
router.get('/business-report', requireRole(['Manager','Business Head']), reportController.getBusinessReport);
router.get('/business-report/export', requireRole(['Manager','Business Head']), reportController.exportBusinessReport);
router.get('/', requireRole(['Manager','Business Head']), reportController.getNCReports);
router.get('/locations/user', requireRole('Manager'), reportController.getLocationByUser);

// Filter options scoped to user role
router.get('/filter-options', reportController.getFilterOptions);

// Weekly NC Report
router.get('/weekly-nc', requireRole(['Admin', 'Super Admin']), reportController.getWeeklyNCReport);

module.exports = router;
