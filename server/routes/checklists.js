const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { imageUpload} = require('../middleware/upload');

// All checklist routes require authentication
router.use(authenticateToken);

// Get categories (Super Admin, Auditor, Manager, Supervisor for viewing)
router.get('/categories', requireRole(['Super Admin', 'Admin', 'Auditor', 'Manager', 'Supervisor']), checklistController.getCategories);

// Get locations by category
router.get('/locations-by-category/:categoryId', requireRole(['Super Admin', 'Admin', 'Auditor', 'Manager', 'Supervisor']), checklistController.getLocationsByCategory);

// Get departments by category + location
router.get('/departments-by-category-location/:categoryId/:locationId', requireRole(['Super Admin', 'Admin', 'Auditor', 'Manager', 'Supervisor']), checklistController.getDepartmentsByCategoryLocation);

router.get('/locations', requireRole(['Super Admin', 'Admin', 'Auditor', 'Manager', 'Supervisor']), checklistController.getLocations);

// Get departments (Super Admin, Auditor, Manager, Supervisor for viewing)
router.get('/departments', requireRole(['Super Admin', 'Admin', 'Auditor', 'Manager', 'Supervisor']), checklistController.getDepartments);

// Get names (Super Admin, Auditor, Manager, Supervisor for viewing)
router.get('/names', requireRole(['Super Admin', 'Admin', 'Auditor', 'Manager', 'Supervisor']), checklistController.getNames);

// User assignment routes (Super Admin only) - Must come before /:id route
router.get('/users', requireRole(['Super Admin', 'Admin', 'Auditor', 'Manager', 'Supervisor', 'Lead-Auditor']), checklistController.getUsers);

// Get all checklists data (All authenticated users)
router.get('/data/all', checklistController.getAllChecklistsData);

// Get deleted checklists (Super Admin only)
router.get('/deleted', requireRole(['Super Admin']), checklistController.getDeletedChecklists);

// Get deleted checklist details by ID (Super Admin only)
router.get('/deleted/:id', requireRole(['Super Admin']), checklistController.getDeletedChecklistById);

// Get supervisor checklists data
router.get('/data/supervisor', checklistController.getSupervisorChecklistsData);

// Get manager checklists data
router.get('/data/manager', checklistController.getManagerChecklistsData);

// Get all checklists (Super Admin, Auditor, Manager, Supervisor)
router.get('/', requireRole(['Super Admin', 'Auditor', 'Manager', 'Supervisor']), checklistController.getChecklists);

// Send analytics mail with PPT attachment
router.post('/send-analytics-mail', requireRole(['Super Admin', 'Admin']), checklistController.sendAnalyticsMail);

// Complete random checklist (Lead-Auditor)
router.post('/completeRandomChecklist/:id', requireRole(['Lead-Auditor']), checklistController.closeRandomChecklist);

// Get specific checklist (All authenticated users)
router.get('/:id', checklistController.getChecklist);

// Create checklist (Super Admin only)
router.post('/', requireRole(['Super Admin']), checklistController.createChecklist);

// Update checklist (Super Admin only)
router.put('/:id', requireRole(['Super Admin']), checklistController.updateChecklist);

// Delete checklist (Super Admin only)
router.delete('/:id', requireRole(['Super Admin']), checklistController.deleteChecklist);

// Restore deleted checklist (Super Admin only)
router.put('/:id/restore', requireRole(['Super Admin']), checklistController.restoreChecklist);

router.post('/:id/assign', requireRole(['Super Admin']), checklistController.assignUsers);
router.get('/:id/assignments', checklistController.getAssignments);

// Get checklist items (All authenticated users)
router.get('/:id/items', checklistController.getChecklistItems);

// Create checklist item (Super Admin only)
router.post('/:id/items', requireRole(['Super Admin']), checklistController.createChecklistItem);

// Update checklist item (Super Admin only)
router.put('/items/:itemId', requireRole(['Super Admin']), checklistController.updateChecklistItem);

// Delete checklist item (Super Admin, Auditor, Lead-Auditor)
router.delete('/items/:itemId', requireRole(['Super Admin', 'Auditor', 'Lead-Auditor']), checklistController.deleteChecklistItem);

// Save checklist form (draft)
router.post('/:id/save', requireRole(['Auditor', 'Lead-Auditor']), checklistController.saveChecklistForm);

// Complete checklist form
router.post('/:id/complete', requireRole(['Auditor', 'Lead-Auditor']), checklistController.completeChecklistForm);


// Get checklist responses
router.get('/:id/responses', checklistController.getChecklistResponses);

// Get draft checklist data for current user
router.get('/:id/draft', checklistController.getDraftChecklist);

// Submit supervisor review
router.post('/:id/supervisor-review', requireRole(['Supervisor']), checklistController.submitSupervisorReview);

// Get supervisor reviews
router.get('/:id/supervisor-reviews', checklistController.getSupervisorReviews);

// Submit manager review
router.post('/:id/manager-review', requireRole(['Manager']), (req, res, next) => {
//   const { debugLog } = require('../utils/debugLogger');
//   debugLog(`Manager review route called: ${req.params.id}`);
//   debugLog(`Request body keys: ${Object.keys(req.body).join(', ')}`);
  next();
}, checklistController.submitManagerReview);

// Get manager review items (only items with supervisor status='Close' and supervisor_status='Accepted')
router.get('/:id/manager-review-items', checklistController.getManagerReviewItems);

// Get manager reviews for a checklist
router.get('/:id/manager-reviews', checklistController.getManagerReviews);

// Get all supervisor reviews for a checklist (view-only, no user filter)
router.get('/:id/all-supervisor-reviews', checklistController.getAllSupervisorReviews);

router.get('/:id/export-pdf', checklistController.exportChecklistPDF);
router.post('/:id/send-email', checklistController.sendChecklistMail);

module.exports = router;
