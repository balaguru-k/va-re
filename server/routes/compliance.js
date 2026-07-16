const express = require('express');
const router = express.Router();
const ComplianceController = require('../controllers/complianceController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/dashboard', ComplianceController.getDashboard);
router.get('/masters/users', ComplianceController.getUsers);
router.post('/masters/users', ComplianceController.createUser);
router.put('/masters/users/:id', ComplianceController.updateUser);
router.delete('/masters/users/:id', ComplianceController.deleteUser);

// Locations routes
router.get('/masters/locations', ComplianceController.getLocations);
router.post('/masters/locations', ComplianceController.createLocation);
router.put('/masters/locations/:id', ComplianceController.updateLocation);
router.delete('/masters/locations/:id', ComplianceController.deleteLocation);

// Departments routes
router.get('/masters/departments', ComplianceController.getDepartments);
router.post('/masters/departments', ComplianceController.createDepartment);
router.put('/masters/departments/:id', ComplianceController.updateDepartment);
router.delete('/masters/departments/:id', ComplianceController.deleteDepartment);

router.get('/masters/checklists', ComplianceController.getChecklists);

// Divisions routes
router.get('/masters/divisions', ComplianceController.getDivisions);
router.get('/masters/categories', ComplianceController.getCategories);
router.get('/masters/locations-list', ComplianceController.getLocationsList);
router.get('/masters/departments-list', ComplianceController.getDepartmentsList);
router.post('/masters/divisions', ComplianceController.createDivision);
router.put('/masters/divisions/:id', ComplianceController.updateDivision);
router.delete('/masters/divisions/:id', ComplianceController.deleteDivision);


module.exports = router;
