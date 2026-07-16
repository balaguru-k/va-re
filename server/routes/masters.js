const express = require('express');
const router = express.Router();
const mastersController = require('../controllers/mastersController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireRole(['Super Admin','Admin']));

// Categories
router.get('/categories', mastersController.getCategories);
router.post('/categories', mastersController.createCategory);
router.put('/categories/:id', mastersController.updateCategory);
router.delete('/categories/:id', mastersController.deleteCategory);

// Locations
router.get('/locations', mastersController.getLocations);
router.post('/locations', mastersController.createLocation);
router.put('/locations/:id', mastersController.updateLocation);
router.delete('/locations/:id', mastersController.deleteLocation);

// Names / Facility Names
router.get('/names', mastersController.getNames);
router.post('/names', mastersController.createName);
router.put('/names/:id', mastersController.updateName);
router.delete('/names/:id', mastersController.deleteFacilityName);

// Departments
router.get('/departments', mastersController.getDepartments);
router.post('/departments', mastersController.createDepartment);
router.put('/departments/:id', mastersController.updateDepartment);
router.delete('/departments/:id', mastersController.deleteDepartment);

module.exports = router;
