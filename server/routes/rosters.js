const express = require('express');
const router = express.Router();
const rosterController = require('../controllers/rosterController');
const adminRosterController = require('../controllers/adminRosterController');
const adminDashboardController = require('../controllers/adminDashboardController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Data routes (must come before parameterized routes) - Super Admin and Lead-Auditor
router.get('/users', requireRole(['Super Admin', 'Lead-Auditor', 'Manager']), rosterController.getUsers);
router.get('/checklists', requireRole(['Super Admin', 'Lead-Auditor']), rosterController.getChecklists);

// Roster management routes (Super Admin and Lead-Auditor)
router.post('/', requireRole(['Super Admin', 'Lead-Auditor']), rosterController.createRoster);
router.get('/', requireRole(['Super Admin', 'Lead-Auditor']), rosterController.getRosters);
router.post('/bulk', requireRole(['Super Admin', 'Lead-Auditor']), rosterController.bulkAssignRoster);
router.post('/manual-assign', requireRole(['Super Admin', 'Lead-Auditor']), rosterController.manualAssignRoster);

// Admin routes (Super Admin and Lead-Auditor)
router.get('/admin', requireRole(['Super Admin', 'Lead-Auditor']), adminRosterController.getAdminRosterView);
router.get('/admin/email-config', requireRole(['Super Admin', 'Lead-Auditor']), adminRosterController.getRosterEmailConfig);
router.post('/admin/send-email', requireRole(['Super Admin', 'Lead-Auditor']), adminRosterController.sendRosterEmail);
router.get('/random-checklists', requireRole(['Super Admin','Lead-Auditor']), rosterController.getRandomChecklists);
router.put('/:id', requireRole(['Super Admin', 'Lead-Auditor']), adminRosterController.updateRosterAssignment);
router.delete('/:id', requireRole(['Super Admin', 'Lead-Auditor']), adminRosterController.deleteRosterAssignment);

// Dashboard routes
router.get('/admin-dashboard', requireRole(['Super Admin']), adminDashboardController.getAdminDashboardData);
router.get('/lead-auditor-dashboard', requireRole(['Lead-Auditor']), rosterController.getLeadAuditorDashboard);
router.get('/completed-checklists-by-date', requireRole(['Lead-Auditor']), rosterController.getCompletedChecklistsByDate);
router.get('/dashboard/:user_id', rosterController.getUserDashboard);
router.get('/completed/:user_id', rosterController.getDailyReport);

module.exports = router;