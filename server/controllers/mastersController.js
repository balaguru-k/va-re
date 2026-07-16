const Category = require('../models/Category');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Name = require('../models/Name');
const knex = require('../config/database');
const logger = require('../config/logger');

// Categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.query().orderBy('id', 'desc').where('is_active', 1);
    res.json({ categories });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const required_fields = ["location", "name", "department", "camera_count", "checklist"];
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const existing = await Category.findByName(name);
    if (existing) return res.status(409).json({ error: 'Category already exists' });
    const category = await Category.create({ name, required_fields: JSON.stringify(required_fields || []) });
    res.status(201).json({ category });
  } catch (error) {
    logger.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { name, required_fields } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const existing = await Category.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    const oldName = existing.name;
    const data = { name };
    if (required_fields !== undefined) data.required_fields = JSON.stringify(required_fields);
    const category = await Category.update(req.params.id, data);
    if (oldName !== name) {
      await knex('checklist_scores').where('category_name', oldName).update({ category_name: name });
    }
    res.json({ category });
  } catch (error) {
    logger.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

// Locations
const getLocations = async (req, res) => {
  try {
    const locations = await Location.query().orderBy('id', 'desc').where('is_active', 1);
    res.json({ locations });
  } catch (error) {
    logger.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
};

const createLocation = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const existing = await Location.findByName(name);
    if (existing) return res.status(409).json({ error: 'Location already exists' });
    const location = await Location.create({ name, created_at: new Date(), updated_at: new Date() });
    res.status(201).json({ location });
  } catch (error) {
    logger.error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const existing = await Location.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Location not found' });
    const oldName = existing.name;
    const location = await Location.update(req.params.id, { name, updated_at: new Date() });
    if (oldName !== name) {
      await knex('checklist_scores').where('location_name', oldName).update({ location_name: name });
    }
    res.json({ location });
  } catch (error) {
    logger.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
};

// Names / Facility Names (mapped to location_id)
const getNames = async (req, res) => {
  try {
    const { location_id } = req.query;
    let query = knex('names')
      .select('names.*', 'locations.name as location_name')
      .leftJoin('locations', 'names.location_id', 'locations.id')
      .where('names.is_active', 1);
    if (location_id) query = query.where('names.location_id', location_id);
    const names = await query.orderBy('names.id', 'desc');
    res.json({ names });
  } catch (error) {
    logger.error('Error fetching names:', error);
    res.status(500).json({ error: 'Failed to fetch facility names' });
  }
};

const createName = async (req, res) => {
  try {
    const { name, location_id } = req.body;
    if (!name || !location_id) return res.status(400).json({ error: 'Name and location are required' });
    const existing = await knex('names').where({ name, location_id }).first();
    if (existing) return res.status(409).json({ error: 'Facility name already exists for this location' });
    const [id] = await knex('names').insert({ name, location_id, created_at: new Date(), updated_at: new Date() });
    res.status(201).json({ name: { id, name, location_id } });
  } catch (error) {
    logger.error('Error creating name:', error);
    res.status(500).json({ error: 'Failed to create facility name' });
  }
};

const updateName = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const updated = await knex('names').where('id', req.params.id).update({ name, updated_at: new Date() });
    if (!updated) return res.status(404).json({ error: 'Facility name not found' });
    const result = await knex('names').where('id', req.params.id).first();
    res.json({ name: result });
  } catch (error) {
    logger.error('Error updating name:', error);
    res.status(500).json({ error: 'Failed to update facility name' });
  }
};

// Departments (mapped to location_id + name_id)
const getDepartments = async (req, res) => {
  try {
    const { location_id, name_id } = req.query;
    let query = Department.db('departments')
      .select('departments.*', 'locations.name as location_name', 'names.name as facility_name')
      .leftJoin('locations', 'departments.location_id', 'locations.id')
      .leftJoin('names', 'departments.name_id', 'names.id')
      .where(function() {
        this.where('departments.is_active', 1).orWhereNull('departments.is_active');
      });
    if (location_id) query = query.where('departments.location_id', location_id);
    if (name_id) query = query.where('departments.name_id', name_id);
    const departments = await query.orderBy('departments.id', 'desc');
    res.json({ departments });
  } catch (error) {
    logger.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const updated = await knex('departments').where('id', req.params.id).update({ is_active: 0, updated_at: new Date() });
    if (!updated) return res.status(404).json({ error: 'Department not found' });
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    logger.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, location_id, name_id } = req.body;
    if (!name || !location_id || !name_id) return res.status(400).json({ error: 'Name, location and facility are required' });
    const existing = await Department.query().where({ name, location_id, name_id }).first();
    if (existing) return res.status(409).json({ error: 'Department already exists for this location and facility' });
    const department = await Department.create({ name, location_id, name_id, created_at: new Date(), updated_at: new Date() });
    res.status(201).json({ department });
  } catch (error) {
    logger.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { name, location_id, name_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const existing = await Department.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Department not found' });
    const oldName = existing.name;
    const data = { name, updated_at: new Date() };
    if (location_id) data.location_id = location_id;
    if (name_id) data.name_id = name_id;
    const department = await Department.update(req.params.id, data);
    if (oldName !== name) {
      await knex('checklist_scores').where('department_name', oldName).update({ department_name: name });
    }
    res.json({ department });
  } catch (error) {
    logger.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
};

const deleteCategory = async (req, res) => {
  try{
    const categoryId = req.params.id;
    const updated = await knex('categories').where('id', categoryId).update({ is_active: 0, updated_at: new Date() });
    if (!updated) return res.status(404).json({ error: 'category not found' });
    res.json({ message: 'category deleted successfully' });
  } catch (error) {
    logger.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
}

const deleteLocation = async (req, res) => {
  try{
    const locationId = req.params.id;
    const updated = await knex('locations').where('id', locationId).update({ is_active: 0, updated_at: new Date() });
    if (!updated) return res.status(404).json({ error: 'location not found' });
    res.json({ message: 'location deleted successfully' });
  } catch (error) {
    logger.error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
}

const deleteFacilityName = async (req, res) => {
  try{
    const nameId = req.params.id;
    const updated = await knex('names').where('id', nameId).update({ is_active: 0, updated_at: new Date() });
    if (!updated) return res.status(404).json({ error: 'facility name not found' });
    res.json({ message: 'facility name deleted successfully' });
  } catch (error) {
    logger.error('Error deleting facility name:', error);
    res.status(500).json({ error: 'Failed to delete facility name' });
  }
}

module.exports = {
  getCategories, createCategory, updateCategory,
  getLocations, createLocation, updateLocation,
  getNames, createName, updateName,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  deleteCategory, deleteLocation, deleteFacilityName
};
