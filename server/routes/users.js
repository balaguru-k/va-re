const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { userValidation, userUpdateValidation } = require('../middleware/validation');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// All user routes require authentication
router.use(authenticateToken);

// Get all users (Super Admin only)
router.get('/', requireRole(['Super Admin']), userController.getUsers);

// Get roles (Super Admin only)
router.get('/roles', requireRole(['Super Admin']), userController.getRoles);

// Get assigned departments by location (Super Admin only)
router.get('/assigned-departments/:locationId', requireRole(['Super Admin']), userController.getAssignedDepartments);

// Bulk Upload Users (Super Admin only)
router.post('/bulk-upload', requireRole(['Super Admin']), upload.single('file'), userController.bulkUploadUsers);

// Get Bulk Upload Sample (Super Admin only)
router.get('/bulk-upload-sample', requireRole(['Super Admin']), userController.getBulkUploadSample);

// Export Users (Super Admin only)
router.get('/export', requireRole(['Super Admin']), userController.exportUsers);

// Get specific user (Super Admin only)
router.get('/:id', requireRole(['Super Admin']), userController.getUser);

// Create user (Super Admin only)
router.post('/', requireRole(['Super Admin']), userValidation, userController.createUser);

// Update user (Super Admin only)
router.put('/:id', requireRole(['Super Admin']), userUpdateValidation, userController.updateUser);

// Delete user (Super Admin only)
router.delete('/:id', requireRole(['Super Admin']), userController.deleteUser);


module.exports = router;