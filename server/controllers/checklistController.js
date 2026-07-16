const Checklist = require('../models/Checklist');
const Category = require('../models/Category');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Name = require('../models/Name');
const ChecklistItem = require('../models/ChecklistItem');
const ChecklistData = require('../models/ChecklistData');
const User = require('../models/User');
const { enqueueEmail } = require('../services/emailQueueService');
const { buildPptBuffer } = require('../services/analyticsPptService');
const { formatDate, formatDateTime } = require('../utils/dateFormatter');
const logger = require('../config/logger');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { imageUpload, compressImages, cameraFileUpload, combinedUpload, processUploads } = require('../middleware/upload');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/checklists';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});



const getCategories = async (req, res) => {
  try {
    const categories = await Category.getAllWithFields();
    res.json({
      message: 'Categories retrieved successfully',
      categories
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
  }
};

const getLocations = async (req, res) => {
  try {
    const { category_name } = req.query;
    let locations;
    if (category_name) {
      const catNames = category_name.split('|||').map(v => v.trim()).filter(Boolean);
      const knex = require('../config/database');
      locations = await knex('locations')
        .select('locations.id', 'locations.name')
        .join('checklists', 'checklists.location_id', 'locations.id')
        .join('categories', 'checklists.category_id', 'categories.id')
        .whereIn('categories.name', catNames)
        .where('locations.is_active', 1)
        .where('checklists.is_active', 1)
        .whereNull('checklists.deleted_at')
        .whereNotExists(function() {
          this.select('*').from('daily_checklist_instances')
            .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
        })
        .groupBy('locations.id', 'locations.name')
        .orderBy('locations.name');
    } else {
      locations = await Location.getLocation();
    }
    res.json({ message: 'Locations retrieved successfully', locations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Locations', details: error.message });
  }
};

const getDepartments = async (req, res) => {
  try {
    const { locationId, nameId, location_name, category_name } = req.query;
    if (location_name) {
      const knex = require('../config/database');
      const locNames = location_name.split('|||').map(v => v.trim()).filter(Boolean);
      let deptQuery = knex('departments')
        .select('departments.id', 'departments.name')
        .join('checklists', 'checklists.department_id', 'departments.id')
        .join('locations', 'checklists.location_id', 'locations.id')
        .whereIn('locations.name', locNames)
        .where('checklists.is_active', 1)
        .whereNull('checklists.deleted_at')
        .whereNotExists(function() {
          this.select('*').from('daily_checklist_instances')
            .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
        });
      if (category_name) {
        const catNames = category_name.split('|||').map(v => v.trim()).filter(Boolean);
        deptQuery.join('categories', 'checklists.category_id', 'categories.id').whereIn('categories.name', catNames);
      }
      const departments = await deptQuery
        .where(function() { this.where('departments.is_active', 1).orWhereNull('departments.is_active'); })
        .groupBy('departments.id', 'departments.name')
        .orderBy('departments.name');
      return res.json({ message: 'Departments retrieved successfully', departments });
    }
    let query = Department.query().where(function() {
      this.where('is_active', 1).orWhereNull('is_active');
    });
    if (locationId) query = query.where('location_id', locationId);
    if (nameId) query = query.where('name_id', nameId);
    const departments = await query;
    res.json({ message: 'Departments retrieved successfully', departments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Department', details: error.message });
  }
};

const getLocationsByCategory = async (req, res) => {
  try {
    const knex = require('../config/database');
    const locations = await knex('locations')
      .select('locations.id', 'locations.name')
      .join('checklists', 'checklists.location_id', 'locations.id')
      .where('checklists.category_id', req.params.categoryId)
      .where('checklists.is_active', 1)
      .whereNull('checklists.deleted_at')
      .where('locations.is_active', 1)
      .whereNotExists(function() {
        this.select('*').from('daily_checklist_instances')
          .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      })
      .groupBy('locations.id', 'locations.name')
      .orderBy('locations.name');

    res.json({ locations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch location', details: error.message });
  }
};

const getDepartmentsByCategoryLocation = async (req, res) => {
  try {
    const knex = require('../config/database');
    const departments = await knex('departments')
      .select('departments.id', 'departments.name')
      .join('checklists', 'checklists.department_id', 'departments.id')
      .where('checklists.category_id', req.params.categoryId)
      .where('checklists.location_id', req.params.locationId)
      .where('checklists.is_active', 1)
      .whereNull('checklists.deleted_at')
      .where(function() { this.where('departments.is_active', 1).orWhereNull('departments.is_active'); })
      .whereNotExists(function() {
        this.select('*').from('daily_checklist_instances')
          .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      })
      .groupBy('departments.id', 'departments.name')
      .orderBy('departments.name');

    res.json({ departments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch department', details: error.message });
  }
};


const getNames = async (req, res) => {
  try {
    const { locationId } = req.query;
    let query = require('../config/database')('names');
    query = query.where('is_active', 1);
    if (locationId) query = query.where('location_id', locationId);
    const names = await query.orderBy('name');
    res.json({
      message: 'Names retrieved successfully',
      names
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch facility names', details: error.message });
  }
};

const createChecklist = async (req, res) => {
  try {
    const { FileProcessorService, BulkChecklistProcessor } = require('../services/FileProcessorService');

    // logger.info('[CHECKLIST-CREATE] Form submission received:', {
    //   checklist_name: req.body.checklist_name,
    //   user_id: req.user.id
    // });

    // Validate required fields
    if (!req.body.category_id || !req.body.checklist_name || !req.body.frequency || !req.body.audit_count || !req.body.alert_time) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const checklistData = { ...req.body };
    const assignments = req.body.roster_assignments ? JSON.parse(req.body.roster_assignments) : [];

    // Handle location/department/name creation
    await processLocationData(checklistData, req.body);

    // Add user tracking and clean data
    checklistData.created_by = req.user.id;
    checklistData.updated_by = req.user.id;
    cleanChecklistData(checklistData);

    // Process uploaded file using service
    const fileResult = await FileProcessorService.process(req.file);

    if (req.file) {
      checklistData.checklist_file = req.file.filename;

      // Handle bulk creation if CSV has bulk columns
      if (BulkChecklistProcessor.hasBulkColumns(fileResult.items)) {
        const createdChecklists = await BulkChecklistProcessor.processBulkCreation(
          fileResult.items, checklistData, req.user.id
        );

        return res.status(201).json({
          message: `${createdChecklists.length} checklists created successfully from CSV`,
          checklists: createdChecklists
        });
      }
      const hasSCItems = fileResult.items.some(item =>
        (item.data.Type && item.data.Type.toLowerCase() === 'sc') ||
        (item.data.type && item.data.type.toLowerCase() === 'sc')
      );
      checklistData.type = hasSCItems ? 'SC' : 'NSC';
      // Process checklist items for single checklist
      if (fileResult.items.length > 0) {
        checklistData.checklist_items = fileResult.items.map((item, index) => ({
          id: (index + 1).toString(),
          description: item.data.ACTIVITIES || item.data.Type || `Item ${index + 1}`
        }));
      }
    } else {
      checklistData.type = '';
    }

    const checklist = await Checklist.create(checklistData);

    // Store file items in database
    if (fileResult.items.length > 0) {
      const allItems = fileResult.items.map(item => item.data);
      await ChecklistItem.createFromCSV(checklist.id, allItems);
    }

    // Create roster assignments
    await createRosterAssignments(assignments, checklist.id, req.user.id);

    // Sync roster supervisor/manager IDs for any existing rosters on this checklist
    const { syncRosterAssignments } = require('../utils/userService');
    await syncRosterAssignments();
    logger.info('[CHECKLIST-CREATE] Done', { checklist_id: checklist.id });

    res.status(201).json({
      message: 'Checklist created successfully',
      checklist
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Failed to create checklist',
      details: error.message
    });
  }
};

// Helper methods
const processLocationData = async (checklistData, body) => {
  let locationId = null;
 const knex = require('../config/database');
  // Handle location - check both location_id (existing) and location_input (new)
  if (body.location_id) {
    locationId = body.location_id;
    checklistData.location_id = body.location_id;
  } else if (body.location_input && body.location_input.trim()) {
    const location = await Location.findOrCreate(body.location_input.trim());
    checklistData.location_id = location.id;
    locationId = location.id;
  }

  // Process name/facility BEFORE department so name_id is available
  let nameId = body.name_id || null;
  if (body.name_input && body.name_input.trim()) {
    const name = await Name.findOrCreateWithLocation(body.name_input.trim(), locationId);
    checklistData.name_id = name.id;
    checklistData.name = body.name_input.trim();
    nameId = name.id;
  }

  if (body.department_input && body.department_input.trim() && locationId) {
    const titleCaseName = body.department_input.trim().toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    // Check if this location already has this department
    const existing = await knex('departments')
      .where('name', titleCaseName)
      .where('location_id', locationId)
      .first();
    
    if (existing) {
      checklistData.department_id = existing.id;
      // Update name_id if missing
      if (!existing.name_id && nameId) {
        await knex('departments').where('id', existing.id).update({ name_id: nameId });
      }
    } else {
      const [id] = await knex('departments').insert({ 
        name: titleCaseName, 
        location_id: locationId,
        name_id: nameId,
        created_at: new Date(), 
        updated_at: new Date() 
      });
      checklistData.department_id = id;
    }
  }
};

const cleanChecklistData = (checklistData) => {
  const fieldsToRemove = ['new_location', 'new_department', 'location_input', 'department_input', 'name_input', 'location_name', 'department_name', 'roster_assignments'];

  fieldsToRemove.forEach(field => delete checklistData[field]);

  Object.keys(checklistData).forEach(key => {
    if (checklistData[key] === '' || checklistData[key] === 'undefined') {
      if (key !== 'type') {
        delete checklistData[key];
      }
    }
  });
};

const createRosterAssignments = async (assignments, checklistId, userId) => {
  if (assignments.length > 0) {
    const Roster = require('../models/Roster');
    const { getAutoAssignedUsers } = require('../utils/userService');
    const today = formatDate(new Date());

    for (const assignment of assignments) {
      // Auto-assign ALL supervisors and managers based on auditor
      const autoAssigned = await getAutoAssignedUsers(assignment.auditor_id);

      const rosterData = {
        checklist_id: checklistId,
        auditor_id: assignment.auditor_id,
        manager_ids: autoAssigned.managers.map(m => m.id).join(','),
        supervisor_ids: autoAssigned.supervisors.map(s => s.id).join(','),
        assigned_date: today,
        created_by: userId
      };
      await Roster.createRosterAssignment(rosterData);
    }
  }
};

const getChecklists = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    const knex = require('../config/database');


    let query = Checklist.query()
      .select(
        'checklists.*',
        'categories.name as category_name',
        'locations.name as location_name',
        'departments.name as department_name',
        'names.name as facility_name',
        Checklist.db.raw('(SELECT type FROM checklist_items WHERE checklist_items.checklist_id = checklists.id LIMIT 1) as item_type')
      )
      .leftJoin('categories', 'checklists.category_id', 'categories.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .where('checklists.is_active', 1)
      .whereNull('checklists.deleted_at')
      .where('checklists.checklist_name', 'not like', '%-%-%User%')
      .whereNotExists(function() {
        this.select('*')
          .from('daily_checklist_instances')
          .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      });
    
    if (search) {
      query = query.where(function () {
        this.where('checklists.checklist_name', 'like', `%${search}%`)
          .orWhere('categories.name', 'like', `%${search}%`)
          .orWhere('locations.name', 'like', `%${search}%`);
      });
    }

    let countQuery = Checklist.query()
      .where('is_active', 1)
      .whereNull('deleted_at')
      .where('checklist_name', 'not like', '%-%-%User%');
    if (search) {
      countQuery = countQuery
        .leftJoin('categories', 'checklists.category_id', 'categories.id')
        .leftJoin('locations', 'checklists.location_id', 'locations.id')
        .where(function () {
          this.where('checklists.checklist_name', 'like', `%${search}%`)
            .orWhere('categories.name', 'like', `%${search}%`)
            .orWhere('locations.name', 'like', `%${search}%`);
        });
    }
    const totalResult = await countQuery.count('checklists.id as total').first();
    const total = totalResult?.total || 0;

    const checklists = await query
      .orderBy('checklists.created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const pages = Math.ceil(total / limit);

    // Get rotation checklist IDs for read-only flag
    const RotationService = require('../services/RotationService');
    const rotationChecklistIds = await RotationService.getRotationChecklistIds();

    const checklistsWithRotation = checklists.map(c => ({
      ...c,
      is_rotation: rotationChecklistIds.includes(c.id)
    }));
    
    // logger.info('[CHECKLIST-LIST] Displaying checklists:', {
    //   count: checklists.length,
    //   total: parseInt(total)
    // });


    res.json({
      message: 'Checklists retrieved successfully',
      data: checklistsWithRotation,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        pages: parseInt(pages)
      }
    });
  } catch (error) {
    logger.error('Error fetching checklists:', error);
    res.status(500).json({ error: 'Failed to fetch checklists', details: error.message });
  }
};

const getChecklist = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this is a daily checklist ID or template ID
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    let dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);

    let checklistId = id;
    let templateChecklistId = id;

    if (!dailyInstance) {
      // This might be a template ID, try to get daily instance
      dailyInstance = await DailyAssignmentService.getDailyChecklistInstance(id, req.user?.id || 1);
      if (dailyInstance) {
        checklistId = dailyInstance.daily_checklist_id;
        templateChecklistId = dailyInstance.template_checklist_id;
      }
    } else {
      templateChecklistId = dailyInstance.template_checklist_id;
    }

    const checklists = await Checklist.getChecklistsWithDetails({
      'checklists.id': checklistId,
      'checklists.deleted_at': null
    });
    const checklist = checklists[0];

    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    // Get template name for display
    if (templateChecklistId && templateChecklistId !== checklistId) {
      const templateChecklist = await Checklist.findById(templateChecklistId);
      if (templateChecklist) {
        checklist.checklist_name = templateChecklist.checklist_name;
      }
    }

    if (checklist.checklist_items) {
      checklist.checklist_items = JSON.parse(checklist.checklist_items);
    }

    // Include assigned_date if it exists from the daily instance
    if (dailyInstance && dailyInstance.assigned_date) {
      checklist.assigned_date = dailyInstance.assigned_date;
    }

    res.json({
      message: 'Checklist retrieved successfully',
      checklist: checklist,
      template_id: templateChecklistId
    });
  } catch (error) {
    logger.error('Error fetching checklist:', error);
    res.status(500).json({ error: 'Failed to fetch checklist', details: error.message });
  }
};

const assignUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignments } = req.body;

    const checklist = await Checklist.findById(id);
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    // Block assignment if checklist is managed by rotation roster
    const RotationService = require('../services/RotationService');
    const rotationIds = await RotationService.getRotationChecklistIds();
    if (rotationIds.includes(parseInt(id))) {
      return res.status(403).json({ error: 'This checklist is managed by Rotation Roster. Please use the Rotation Roster page to change assignments.' });
    }

    const Roster = require('../models/Roster');
    const { getAutoAssignedUsers } = require('../utils/userService');
    const knex = require('../config/database');
    const today = formatDate(new Date());
    const formattedToday = new Date();
    const formattedTodayStr = `${formattedToday.getFullYear()}-${(formattedToday.getMonth() + 1).toString().padStart(2, '0')}-${formattedToday.getDate().toString().padStart(2, '0')}`;

    // Process only the FIRST assignment to prevent duplicates
    const assignment = assignments[0];
    if (!assignment) {
      return res.json({ message: 'No assignment provided' });
    }

    const auditorId = assignment.auditor_id;

    // Get existing roster
    const existingRoster = await knex('rosters')
      .where('checklist_id', id)
      .first();
    

    // Handle UNASSIGN (auditorId is null or empty)
    if (!auditorId || auditorId === '' || auditorId === 'null') {
      if (existingRoster) {
        const oldAuditorId = existingRoster.auditor_id;

        // Update instances to set auditor_id to null instead of deleting
        await knex('daily_checklist_instances')
          .where('template_checklist_id', id)
          .where('auditor_id', oldAuditorId)
          .where('assigned_date', '>=', formattedTodayStr)
          .update({ auditor_id: null, updated_at: new Date() });

        // Update daily checklists assigned_auditor_id to null
        const instancesToUpdate = await knex('daily_checklist_instances')
          .where('template_checklist_id', id)
          .where('assigned_date', '>=', formattedTodayStr)
          .select('daily_checklist_id');
        
        const dailyChecklistIds = instancesToUpdate.map(inst => inst.daily_checklist_id);
        if (dailyChecklistIds.length > 0) {
          await knex('checklists')
            .whereIn('id', dailyChecklistIds)
            .update({ assigned_auditor_id: null, updated_at: new Date() });
        }

        // Delete roster
        await knex('rosters').where('id', existingRoster.id).del();
      }
      return res.json({ message: 'User unassigned successfully' });
    }

    // Auto-assign supervisors/managers
    const autoAssigned = await getAutoAssignedUsers(auditorId, id);

    const rosterData = {
      auditor_id: auditorId,
      manager_id: JSON.stringify(autoAssigned.managers.map(m => m.id)),
      supervisor_id: JSON.stringify(autoAssigned.supervisors.map(s => s.id)),
      updated_at: new Date()
    };

    // Handle CHANGE (existing roster with different auditor)
    if (existingRoster && existingRoster.auditor_id !== auditorId) {
      const oldAuditorId = existingRoster.auditor_id;

      // Update roster
      await knex('rosters').where('id', existingRoster.id).update(rosterData);

      // Delete old auditor's ALL FUTURE instances
      const deletedInstances = await knex('daily_checklist_instances')
        .where('template_checklist_id', id)
        .where('auditor_id', oldAuditorId)
        .where('assigned_date', '>=', formattedTodayStr)
        .del();
    }
    // Handle UPDATE (same auditor, maybe different supervisors/managers)
    else if (existingRoster) {
      await knex('rosters').where('id', existingRoster.id).update(rosterData);
    }
    // Handle NEW ASSIGNMENT
    else {
      rosterData.checklist_id = id;
      rosterData.assigned_date = today;
      rosterData.created_by = req.user?.id || 1;
      rosterData.created_at = new Date();
      
      const [insertedId] = await knex('rosters').insert(rosterData);
    }


    res.json({
      message: 'User assigned successfully',
      assignment
    });
  } catch (error) {
    logger.error('Error assigning user to checklist:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

const { getUsersByRole } = require('../utils/userService');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { log } = require('console');
const { text } = require('pdfkit');
const { Knex } = require('knex');

const getUsers = async (req, res) => {
  try {
    const users = await getUsersByRole();
    sendSuccess(res, 'Users retrieved successfully', { users });
  } catch (error) {
    logger.error('Error retrieving users:', error);
    sendError(res, 500, 'Failed to fetch users', { details: error.message });
  }
};

const getAssignments = async (req, res) => {
  try {
    const { id } = req.params;
    const Roster = require('../models/Roster');
    const assignments = await Roster.getRosterWithDetails({ 'rosters.checklist_id': id });

    res.json({
      message: 'Assignments retrieved successfully',
      assignments
    });
  } catch (error) {
    logger.error('Error retrieving assignments:', error);
    res.status(500).json({ error: 'Failed to fetch Assignments', details: error.message });
  }
};

const getChecklistItems = async (req, res) => {
  try {
    const { id } = req.params;
    const checklist = await Checklist.findById(id);
    const items = await ChecklistItem.getByChecklistId(id);

    res.json({
      message: 'Checklist items retrieved successfully',
      checklist: checklist ? { id: checklist.id, name: checklist.name } : null,
      items
    });
  } catch (error) {
    logger.error('Error retrieving checklist items:', error);
    res.status(500).json({ error: 'Failed to fetch checklist Items', details: error.message });
  }
};

const saveChecklistForm = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if this is a daily checklist ID or template ID
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    let dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);

    let dailyChecklistId = id;

    if (!dailyInstance) {
      // This might be a template ID, try to get daily instance
      dailyInstance = await DailyAssignmentService.getDailyChecklistInstance(id, req.user.id);
      if (dailyInstance) {
        dailyChecklistId = dailyInstance.daily_checklist_id;
      } else {
        return res.status(404).json({ error: 'Daily checklist instance not found' });
      }
    }

    const formData = JSON.parse(req.body.formData || '{}');
    const timeTaken = req.body.timeTaken ? parseInt(req.body.timeTaken) : null;
    const additionalFields = JSON.parse(req.body.additionalFields || '{}');
    const files = req.files?.images || [];
    const cameraFile = req.file;
    const items = JSON.parse(req.body.items || '[]');

    // Fetch existing draft data to preserve images
    const existingData = await ChecklistData.query()
      .where('checklist_id', dailyChecklistId)
      .where('user_id', req.user.id)
      .where('submission_status', 'draft');

    const existingImagesMap = {};
    existingData.forEach(data => {
      if (data.image_name) {
        existingImagesMap[data.checklist_item_id] = data.image_name;
      }
    });

    // First, save new items to checklist_items table
    const newItemIds = {};
    for (const item of items) {
      if (item.isNew) {
        const [insertedId] = await ChecklistItem.query().insert({
          checklist_id: dailyChecklistId,
          activities: item.activities,
          process: item.process,
          criticality: 'New',
          status: 1,
          created_at: new Date(),
          updated_at: new Date()
        });
        newItemIds[item.id] = insertedId;
      }
    }

    const responses = [];
    Object.entries(formData).forEach(([itemId, itemData]) => {
      let actualItemId = itemId;
      if (itemId.startsWith('new_')) {
        actualItemId = newItemIds[itemId];
        if (!actualItemId) return;
      } else if (!itemId || isNaN(itemId)) {
        return;
      }

      // Update activities/process in checklist_items if provided
      if (itemData.activities !== undefined || itemData.process !== undefined) {
        const updateFields = { updated_at: new Date() };
        if (itemData.activities !== undefined) updateFields.activities = itemData.activities || null;
        if (itemData.process !== undefined) updateFields.process = itemData.process || null;
        ChecklistItem.query().where('id', parseInt(actualItemId)).update(updateFields).then(() => {});
      }

      const itemImages = Array.isArray(files) ? files.filter(f => f.originalname && f.originalname.startsWith(`${itemId}_`)) : [];
      const newImageNames = itemImages.map(img => img.filename);

      // Get current images from form data (preserved images)
      const currentImages = itemData.images || [];

      const preservedImages = currentImages
        .filter(img => {
          if (typeof img === 'string') return true;
          return typeof img === 'object' && (img.name || img.url);
        })
        .map(img => typeof img === 'string' ? img : (img.name || img.url?.split('/').pop()));

      // Combine preserved and new images
      const allImages = [...preservedImages, ...newImageNames].filter(img => img);
      const imageNames = allImages.join(',');

      // Delete removed images
      const existingImages = existingImagesMap[parseInt(actualItemId)] ?
        existingImagesMap[parseInt(actualItemId)].split(',').filter(img => img.trim()) : [];
      const removedImages = existingImages.filter(img => !allImages.includes(img));
      removedImages.forEach(imageName => {
        const imagePath = path.join(__dirname, '../uploads/images', imageName.trim());
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });

      responses.push({
        checklist_id: dailyChecklistId,
        user_id: req.user.id,
        checklist_item_id: parseInt(actualItemId),
        status: itemData.status || null,
        category: itemData.category || null,
        reason: itemData.reason || null,
        image_name: imageNames || null,
        textbox: itemData.textbox || null,
        submission_status: 'draft'
      });
    });

    // Save to checklist_data table
    if (responses.length > 0) {
      await ChecklistData.saveMultipleChecklistData(dailyChecklistId, req.user.id, responses);
    }

    // Update daily checklist with additional fields
    await Checklist.update(dailyChecklistId, {
      camera_count: parseInt(additionalFields.totalCameraCount) || null,
      total_camera_audited: parseInt(additionalFields.totalCameraAudited) || null,
      total_camera_random_audited: parseInt(additionalFields.totalCameraRandomAudited) || null,
      total_camera_not_audited: parseInt(additionalFields.totalCameraNotAudited) || null,
      total_camera_offline: parseInt(additionalFields.totalCameraOffline) || null,
      total_camera_offline_percent: parseFloat(additionalFields.totalCameraOfflinePercent) || null,
      total_camera_technical_issues: parseInt(additionalFields.totalCameraTechnicalIssues) || null,
      total_camera_technical_issues_percent: parseFloat(additionalFields.totalCameraTechnicalIssuesPercent) || null,
      total_ncs: parseInt(additionalFields.totalNCs) || null,
      camera_file: cameraFile ? cameraFile.filename : null,
      remark: additionalFields.remark,
      status: '',
      time_taken_seconds: timeTaken,
      updated_by: req.user.id
    });

    res.status(201).json({
      message: 'Form saved successfully'
    });
  } catch (error) {
    logger.error('Error saving checklist form:', error);
    res.status(500).json({ error: 'Failed to save checklist', details: error.message });
  }
};

const completeChecklistForm = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if this is a daily checklist ID or template ID
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    let dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);

    let dailyChecklistId = id;

    if (!dailyInstance) {
      // This might be a template ID, try to get daily instance
      dailyInstance = await DailyAssignmentService.getDailyChecklistInstance(id, req.user.id);
      if (dailyInstance) {
        dailyChecklistId = dailyInstance.daily_checklist_id;
      } else {
        return res.status(404).json({ error: 'Daily checklist instance not found' });
      }
    }

    const formData = JSON.parse(req.body.formData || '{}');
    const timeTaken = req.body.timeTaken ? parseInt(req.body.timeTaken) : null;
    const additionalFields = JSON.parse(req.body.additionalFields || '{}');
    const files = req.files?.images || [];
    const cameraFile = req.file;
    const items = JSON.parse(req.body.items || '[]');

    // Fetch existing draft data to preserve images
    const existingData = await ChecklistData.query()
      .where('checklist_id', dailyChecklistId)
      .where('user_id', req.user.id);

    const existingImagesMap = {};
    existingData.forEach(data => {
      if (data.image_name) {
        existingImagesMap[data.checklist_item_id] = data.image_name;
      }
    });

    // First, save new items to checklist_items table
    const newItemIds = {};
    for (const item of items) {
      if (item.isNew) {
        const [insertedId] = await ChecklistItem.query().insert({
          checklist_id: dailyChecklistId,
          activities: item.activities,
          process: item.process,
          criticality: 'High',
          status: 1,
          created_at: new Date(),
          updated_at: new Date()
        });
        newItemIds[item.id] = insertedId;
      }
    }

    const responses = [];
    Object.entries(formData).forEach(([itemId, itemData]) => {
      let actualItemId = itemId;
      if (itemId.startsWith('new_')) {
        actualItemId = newItemIds[itemId];
        if (!actualItemId) return;
      } else if (!itemId || isNaN(itemId)) {
        return;
      }

      const itemImages = Array.isArray(files) ? files.filter(f => f.originalname && f.originalname.startsWith(`${itemId}_`)) : [];
      const newImageNames = itemImages.map(img => img.filename);

      // Get current images from form data (preserved images)
      const currentImages = itemData.images || [];
      const preservedImages = currentImages
        .filter(img => typeof img === 'object' && img.name)
        .map(img => img.name);

      // Combine preserved and new images
      const allImages = [...preservedImages, ...newImageNames];
      const imageNames = allImages.join(',');

      // Delete removed images
      const existingImages = existingImagesMap[parseInt(actualItemId)] ?
        existingImagesMap[parseInt(actualItemId)].split(',').filter(img => img.trim()) : [];
      const removedImages = existingImages.filter(img => !allImages.includes(img));
      removedImages.forEach(imageName => {
        const imagePath = path.join(__dirname, '../uploads/images', imageName.trim());
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });

      responses.push({
        checklist_id: dailyChecklistId,
        user_id: req.user.id,
        checklist_item_id: parseInt(actualItemId),
        status: itemData.status || null,
        category: itemData.category || null,
        reason: itemData.reason || null,
        image_name: imageNames || null,
        textbox: itemData.textbox || null,
        submission_status: 'completed'
      });
    });

    // Save to checklist_data table
    if (responses.length > 0) {
      await ChecklistData.saveMultipleChecklistData(dailyChecklistId, req.user.id, responses);
    }

    // Determine status based on form data - FIXED LOGIC
    const hasNoStatus = Object.values(formData).some(item => item.status === 'No');
    let checklistStatus;
    let dailyStatus;

    if (hasNoStatus) {
      checklistStatus = 'Awaiting for NC response';
      dailyStatus = 'awaiting_supervisor';
    } else {
      checklistStatus = 'Completed without NCs';
      dailyStatus = 'completed';
    }

    // Handle location and department updates
    let locationId, departmentId;
    if (additionalFields.location) {
      const location = await Location.findOrCreate(additionalFields.location);
      locationId = location.id;
    }
    if (additionalFields.department) {
      const department = await Department.findOrCreate(additionalFields.department);
      departmentId = department.id;
      // Set name_id on department if missing
      if (department && !department.name_id) {
        const knexDb = require('../config/database');
        const cl = await knexDb('checklists').where('id', dailyChecklistId).select('name_id').first();
        if (cl && cl.name_id) {
          await knexDb('departments').where('id', department.id).update({ name_id: cl.name_id });
        }
      }
    }

    // Update daily checklist with all fields and status using direct knex query
    const knex = require('../config/database');
    const updateData = {
      camera_count: parseInt(additionalFields.totalCameraCount) || null,
      total_camera_audited: parseInt(additionalFields.totalCameraAudited) || null,
      total_camera_random_audited: parseInt(additionalFields.totalCameraRandomAudited) || null,
      total_camera_not_audited: parseInt(additionalFields.totalCameraNotAudited) || null,
      total_camera_offline: parseInt(additionalFields.totalCameraOffline) || null,
      total_camera_offline_percent: parseFloat(additionalFields.totalCameraOfflinePercent) || null,
      total_camera_technical_issues: parseInt(additionalFields.totalCameraTechnicalIssues) || null,
      total_camera_technical_issues_percent: parseFloat(additionalFields.totalCameraTechnicalIssuesPercent) || null,
      total_ncs: parseInt(additionalFields.totalNCs) || null,
      camera_file: cameraFile ? cameraFile.filename : null,
      remark: additionalFields.remark,
      status: checklistStatus,
      time_taken_seconds: timeTaken,
      updated_by: req.user.id,
      updated_at: new Date()
    };

    if (locationId) updateData.location_id = locationId;
    if (departmentId) updateData.department_id = departmentId;

    await knex('checklists').where('id', dailyChecklistId).update(updateData);

    // Update daily instance status
    await DailyAssignmentService.updateDailyInstanceStatus(dailyInstance.id, dailyStatus);

    const checklistCategory = await knex('checklists')
    .select(
        'checklists.category_id',
        'categories.name as category_name'
    )
    .join('categories', function () {
        this.on('checklists.category_id', '=', 'categories.id');
    })
    .where('checklists.id', dailyChecklistId)
    .first();

    if(checklistCategory.category_name === 'Bakery' || checklistCategory.category_name === 'Food Outlet'){
    // Calculate and save checklist score
    const yesCount = Object.values(formData).filter(item => item.status === 'Yes').length;
    const noCount = Object.values(formData).filter(item => item.status === 'No').length;

    const checklist = await knex('checklists')
      .select('checklists.checklist_name', 'categories.name as category_name', 'locations.name as location_name', 'departments.name as department_name')
      .leftJoin('categories', 'checklists.category_id', 'categories.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .where('checklists.id', dailyChecklistId)
      .first();

    const cleanName = (checklist?.checklist_name || '-').replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*User\d+$/i, '');

    await knex('checklist_scores').insert({
      checklist_id: dailyChecklistId,
      user_id: req.user.id,
      checklist_name: cleanName,
      category_name: checklist?.category_name || null,
      location_name: checklist?.location_name || null,
      department_name: checklist?.department_name || null,
      yes_count: yesCount,
      no_count: noCount,
      yes_score: yesCount * 10,
      no_score: noCount * 10,
      score_date: new Date().toISOString().split('T')[0]
    });
  }

    res.status(201).json({
      message: 'Checklist completed successfully'
    });
  } catch (error) {
    
    logger.error(`Error completing checklist form , ${error}`, );
    return res.status(500).json({ error: 'Failed to submit checklist form', details: error.message });
  }
};

const getChecklistResponses = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this is a daily checklist ID or template ID
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);

    let checklistId = id;
    if (dailyInstance) {
      // This is a daily checklist ID, use it directly
      checklistId = id;
    } else {
      // This might be a template ID, try to get daily instance
      const userDailyInstance = await DailyAssignmentService.getDailyChecklistInstance(id, req.user?.id || 1);
      if (userDailyInstance) {
        checklistId = userDailyInstance.daily_checklist_id;
      }
    }

    const responses = await ChecklistData.query().where('checklist_id', checklistId);

    // Process image names to work with frontend logic
    const processedResponses = responses.map(response => {
      if (response.image_name) {
        const imageNames = response.image_name.split(',');
        const images = imageNames.map(imageName => ({
          name: imageName.trim()
        }));
        return {
          ...response,
          images
        };
      }
      return response;
    });

    res.json({
      message: 'Responses retrieved successfully',
      responses: processedResponses
    });
  } catch (error) {
    logger.error('Error retrieving checklist responses:', error);
    res.status(500).json({ error: 'Failed to fetch checklist Data', details: error.message });
  }
};

const getAllChecklistsData = async (req, res) => {
  try {
    const { fromDate,toDate } = req.query;
    const targetDate = new Date().toISOString().split('T')[0];
    const userId = req.user.id;
    // Use same logic as dashboard - get daily assignments for the date
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const dailyAssignments = await DailyAssignmentService.getAllDailyAssignments(targetDate,fromDate,toDate);

    // Filter by current user's assignments only
    const userAssignments = dailyAssignments.filter(assignment =>
      assignment.auditor_id === userId
    );

    // Filter only completed assignments
    const completedAssignments = userAssignments.filter(assignment =>
      assignment.status === 'awaiting_supervisor' ||
      assignment.status === 'awaiting_manager' ||
      assignment.status === 'completed' ||
      assignment.status === 'Completed' ||
      assignment.status === 'Completed without NCs' ||
      assignment.status === 'Awaiting for NC response' ||
      assignment.status === 'Accepted by Supervisor' ||
      assignment.status === 'Pending Manager Verification'
    );

    // Get checklist data with images for each completed assignment
    const formattedData = [];
    for (let i = 0; i < completedAssignments.length; i++) {
      const assignment = completedAssignments[i];

      // Get checklist responses with images
      const responses = await ChecklistData.query().where('checklist_id', assignment.checklist_id);
      const processedResponses = responses.map(response => {
        if (response.image_name) {
          const imageNames = response.image_name.split(',');
          const images = imageNames.map(imageName => ({
            name: imageName.trim(),
            url: `/uploads/images/${imageName.trim()}`
          }));
          return {
            ...response,
            images
          };
        }
        return response;
      });

      formattedData.push({
        sno: i + 1,
        checklist_date: formatDate(new Date(targetDate)),
        checklist_type: assignment.category_name || 'N/A',
        division: assignment.location_name || assignment.department_name || 'N/A',
        total_hours: '00:00:00',
        status: assignment.status || 'Active',
        created_by: assignment.auditor_name || 'N/A',
        date_created: formatDateTime(new Date()),
        id: assignment.checklist_id,
        checklist_name: assignment.checklist_name,
        department: assignment.department_name || 'N/A',
        responses: processedResponses
      });
    }

    res.json({
      message: 'All checklists data retrieved successfully',
      data: formattedData,
      date: targetDate
    });
  } catch (error) {
    logger.error('getAllChecklistsData error:', error);
    res.status(500).json({ error: 'Failed to fetch Checklist Data', details: error.message });
  }
};

const getSupervisorChecklistsData = async (req, res) => {
  try {
    const { fromDate,toDate } = req.query;
    const targetDate = new Date().toISOString().split('T')[0];
    const userId = req.user.id;
    const knex = require('../config/database');

    // Get supervisor's departments
    const supervisorUser = await knex('users').where('id', userId).first();
    let supervisorDepartments = [];
    try {
      supervisorDepartments = JSON.parse(supervisorUser.department_id || '[]');
    } catch (e) {
      supervisorDepartments = supervisorUser.department_id ? [supervisorUser.department_id] : [];
    }

    // Use same logic as dashboard - get daily assignments for the date
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const dailyAssignments = await DailyAssignmentService.getDailyAssignmentsByUser(userId, targetDate, fromDate, toDate);

    // Filter only completed assignments (same logic as dashboard)
    const completedAssignments = dailyAssignments.filter(a =>
      ['awaiting_manager', 'completed', 'Completed without NCs', 'Completed', 'Accepted by Supervisor'].includes(a.status)
    );

    // Get checklist data with images for each completed assignment
    const formattedData = [];
    for (let i = 0; i < completedAssignments.length; i++) {
      const assignment = completedAssignments[i];

      // Get checklist responses with images
      const responses = await ChecklistData.query().where('checklist_id', assignment.checklist_id);
      const processedResponses = responses.map(response => {
        if (response.image_name) {
          const imageNames = response.image_name.split(',');
          const images = imageNames.map(imageName => ({
            name: imageName.trim(),
            url: `/uploads/images/${imageName.trim()}`
          }));
          return {
            ...response,
            images
          };
        }
        return response;
      });

      formattedData.push({
        sno: i + 1,
        checklist_date: assignment.assigned_date ? formatDate(new Date(assignment.assigned_date)) : formatDate(new Date(targetDate)),
        checklist_type: assignment.category_name || 'N/A',
        division: assignment.location_name || assignment.department_name || 'N/A',
        total_hours: '00:00:00',
        status: assignment.status || 'Active',
        created_by: assignment.auditor_name || 'N/A',
        date_created: formatDateTime(new Date()),
        id: assignment.checklist_id,
        checklist_name: assignment.checklist_name,
        department: assignment.department_name || 'N/A',
        responses: processedResponses
      });
    }

    res.json({
      message: 'Supervisor checklists data retrieved successfully',
      data: formattedData,
      date: targetDate
    });
  } catch (error) {
    logger.error('getSupervisorChecklistsData error:', error);
    res.status(500).json({ error: 'Failed to fetch supervisor data', details: error.message });
  }
};

const getManagerChecklistsData = async (req, res) => {
  try {
    const { fromDate,toDate } = req.query;
    const targetDate = new Date().toISOString().split('T')[0];
    const userId = req.user.id;
    const knex = require('../config/database');

    // Get manager's departments
    const managerUser = await knex('users').where('id', userId).first();
    let managerDepartments = [];
    try {
      managerDepartments = JSON.parse(managerUser.department_id || '[]');
    } catch (e) {
      managerDepartments = managerUser.department_id ? [managerUser.department_id] : [];
    }

    // Use same logic as dashboard - get daily assignments for the date
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const dailyAssignments = await DailyAssignmentService.getDailyAssignmentsByUser(userId, targetDate, fromDate, toDate);

    // Filter only completed assignments (same logic as dashboard)
    const completedAssignments = [];

    for (const assignment of dailyAssignments) {
      // Check if ANY manager has reviewed this checklist
      const anyManagerReview = await knex('manager_reviews')
        .where('checklist_id', assignment.checklist_id)
        .first();

      const anyManagerApproved = anyManagerReview && anyManagerReview.manager_status === 'Approved';

      // Show in completed if ANY manager approved it OR completed without NCs
      if (anyManagerApproved || assignment.status === 'Completed without NCs' || assignment.status === 'Completed') {
        completedAssignments.push(assignment);
      }
    }

    // Get checklist data with images for each completed assignment
    const formattedData = [];
    for (let i = 0; i < completedAssignments.length; i++) {
      const assignment = completedAssignments[i];

      // Get checklist responses with images
      const responses = await ChecklistData.query().where('checklist_id', assignment.checklist_id);
      const processedResponses = responses.map(response => {
        if (response.image_name) {
          const imageNames = response.image_name.split(',');
          const images = imageNames.map(imageName => ({
            name: imageName.trim(),
            url: `/uploads/images/${imageName.trim()}`
          }));
          return {
            ...response,
            images
          };
        }
        return response;
      });

      formattedData.push({
        sno: i + 1,
        checklist_date: formatDate(new Date(targetDate)),
        checklist_type: assignment.category_name || 'N/A',
        division: assignment.location_name || assignment.department_name || 'N/A',
        total_hours: '00:00:00',
        status: assignment.status || 'Active',
        created_by: assignment.auditor_name || 'N/A',
        date_created: formatDateTime(new Date()),
        id: assignment.checklist_id,
        checklist_name: assignment.checklist_name,
        department: assignment.department_name || 'N/A',
        responses: processedResponses
      });
    }

    res.json({
      message: 'Manager checklists data retrieved successfully',
      data: formattedData,
      date: targetDate
    });
  } catch (error) {
    logger.error('getManagerChecklistsData error:', error);
    res.status(500).json({ error: 'Failed to fetch manager checklist Data', details: error.message });
  }
};

const getDraftChecklist = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this is a daily checklist ID or template ID
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    let dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);

    let dailyChecklistId = id;

    if (!dailyInstance) {
      // This might be a template ID, try to get daily instance
      dailyInstance = await DailyAssignmentService.getDailyChecklistInstance(id, req.user.id);
      if (dailyInstance) {
        dailyChecklistId = dailyInstance.daily_checklist_id;
      } else {
        return res.json({
          message: 'No daily instance found',
          data: []
        });
      }
    }

    // Check if there's any data for this daily checklist and user
    const existingData = await ChecklistData.query()
      .where('checklist_id', dailyChecklistId)
      .where('user_id', req.user.id)
      .first();

    // Only fetch draft data if submission_status is 'draft'
    if (existingData && existingData.submission_status === 'draft') {
      const draftData = await ChecklistData.query()
        .where('checklist_id', dailyChecklistId)
        .where('user_id', req.user.id)
        .where('submission_status', 'draft');

      return res.json({
        message: 'Draft data retrieved successfully',
        data: draftData
      });
    }

    // Return empty data if not draft
    res.json({
      message: 'No draft data available',
      data: []
    });
  } catch (error) {
    logger.error('Error retrieving draft checklist:', error);
    res.status(500).json({ error: 'Failed to fetch draft checklist', details: error.message });
  }
};

const downloadSampleTemplate = async (req, res) => {
  try {
    const filePath = path.resolve('server/uploads/checklists/sample-checklist-template.csv');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Sample template not found' });
    }

    res.download(filePath, 'sample-checklist-template.csv');
  } catch (error) {
    logger.error('Error downloading sample template:', error);
    res.status(500).json({ error: 'sample download failed', details: error.message });
  }
};

const getSupervisorReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const knex = require('../config/database');

    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);
    const dailyChecklistId = dailyInstance ? id : id;


    // Get non-conformance items
    const nonConformanceItems = await knex('checklist_data')
      .where('checklist_id', dailyChecklistId)
      .where('status', 'No')
      .where('submission_status', 'completed');


    if (nonConformanceItems.length === 0) {
      return res.json({
        message: 'No non-conformance items found',
        reviews: []
      });
    }

    // Get all supervisor reviews for this checklist
    const allSupervisorReviews = await knex('supervisor_reviews')
      .where('checklist_id', dailyChecklistId)
      .where('supervisor_id', req.user.id);


    let itemsToShow = [];
    
    if (allSupervisorReviews.length === 0) {
      // First time: Show all NC items
      itemsToShow = nonConformanceItems.map(ncItem => ({
        checklist_item_id: ncItem.checklist_item_id
      }));
    } else {
      // Show items that are rejected with status 'Open' OR items not yet reviewed
      for (const ncItem of nonConformanceItems) {
        const itemReview = allSupervisorReviews.find(r => r.checklist_item_id === ncItem.checklist_item_id);
        
        
        // Show if: no review exists OR review exists with rejected status and open status
        if (!itemReview || (itemReview && itemReview.status === 'Open' )) {
          itemsToShow.push({
            checklist_item_id: ncItem.checklist_item_id,
            supervisor_review: itemReview
          });
        }
      }
    }


    const itemIds = itemsToShow.map(item => item.checklist_item_id).filter(id => id);
    
    let reviews = [];
    if (itemIds.length > 0) {
      reviews = await knex('checklist_items')
        .select(
          'checklist_items.*',
          'checklist_data.status as auditor_status',
          'checklist_data.category',
          'checklist_data.reason',
          'checklist_data.textbox',
          'checklist_data.image_name'
        )
        .leftJoin('checklist_data', function() {
          this.on('checklist_data.checklist_item_id', '=', 'checklist_items.id')
              .andOn('checklist_data.checklist_id', '=', knex.raw('?', [dailyChecklistId]));
        })
        .where('checklist_items.checklist_id', dailyChecklistId)
        .whereIn('checklist_items.id', itemIds);

      reviews = reviews.map(review => {
        const supervisorReview = itemsToShow.find(item => item.checklist_item_id === review.id)?.supervisor_review;
        
        let auditorImages = [];
        if (review.image_name) {
          const imageNames = review.image_name.split(',');
          auditorImages = imageNames.map(imageName => ({
            name: imageName.trim()
          }));
        }

        let supervisorImages = [];
        if (supervisorReview && supervisorReview.supervisor_images) {
          const imageNames = supervisorReview.supervisor_images.split(',');
          supervisorImages = imageNames.map(imageName => ({
            name: imageName.trim()
          }));
        }

        // Only show 'Accepted' if previously rejected
        let availableStatusOptions = supervisorReview ? ['Accepted'] : ['Accepted', 'Rejected'];

        return {
          ...review,
          status: review.auditor_status,
          images: auditorImages,
          textbox: review.textbox || null,
          supervisor_reason: supervisorReview?.reason || null,
          supervisor_images: supervisorImages,
          supervisor_status: supervisorReview?.supervisor_status || null,
          supervisor_item_status: supervisorReview?.status || null,
          available_status_options: availableStatusOptions,
          previous_supervisor_reason: supervisorReview?.reason || null,
          previous_supervisor_images: supervisorImages,
          manager_reason: null // Will be populated below
        };
      });

      // Get manager reasons for rejected items
      for (let i = 0; i < reviews.length; i++) {
        const review = reviews[i];
        const supervisorReview = itemsToShow.find(item => item.checklist_item_id === review.id)?.supervisor_review;
        
        if (supervisorReview && supervisorReview.supervisor_status === 'Rejected' && supervisorReview.status === 'Open') {
          const managerReview = await knex('manager_reviews')
            .where('checklist_id', dailyChecklistId)
            .where('checklist_item_id', review.id)
            .where('manager_status', 'Rejected')
            .first();
          reviews[i].manager_reason = managerReview ? managerReview.reason : null;
        }
      }
    }

    res.json({
      message: 'Supervisor reviews retrieved successfully',
      reviews
    });
  } catch (error) {
    logger.error('Error retrieving supervisor reviews:', error);
    res.status(500).json({ error: 'Failed to get supervisor checklist', details: error.message });
  }
};

const submitSupervisorReview = async (req, res) => {
  try {
    const { id } = req.params;
    const supervisorData = JSON.parse(req.body.supervisorData || '{}');
    const files = req.files || [];
    const knex = require('../config/database');

    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);
    const dailyChecklistId = dailyInstance ? id : id;

    // First time review: Insert existing items only
    const existingReviews = await knex('supervisor_reviews')
      .where('checklist_id', parseInt(dailyChecklistId))
      .where('supervisor_id', req.user.id);

    const isFirstTimeReview = existingReviews.length === 0;

    for (const [itemId, reviewData] of Object.entries(supervisorData)) {
      if (reviewData) {
        
        const supervisorImages = files.filter(f => f.originalname.startsWith(`supervisor_${itemId}_`));
        const imageNames = supervisorImages.map(img => img.filename).join(',');
        const supervisorStatus = reviewData.supervisorStatus || reviewData.status;

        // Check if review already exists
        const existingReview = await knex('supervisor_reviews')
          .where('checklist_id', parseInt(dailyChecklistId))
          .where('checklist_item_id', parseInt(itemId))
          .where('supervisor_id', req.user.id)
          .first();

        if (existingReview) {
          // Only update if open items (for subsequent reviews)
          if (existingReview.status) {
            await knex('supervisor_reviews')
              .where('id', existingReview.id)
              .update({
                status: reviewData.status,
                reason: reviewData.reason || existingReview.reason,
                supervisor_images: imageNames || existingReview.supervisor_images,
                reason_category: reviewData.reasonCategory || existingReview.reason_category,
                supervisor_status: supervisorStatus,
                updated_at: new Date()
              });
          }
        } else {
          // Insert new review only for existing items (first time) or new items
          const itemExists = await knex('checklist_items')
            .where('id', parseInt(itemId))
            .where('checklist_id', parseInt(dailyChecklistId))
            .first();

          if (itemExists || !isFirstTimeReview) {
            await knex('supervisor_reviews').insert({
              checklist_id: parseInt(dailyChecklistId),
              checklist_item_id: parseInt(itemId),
              supervisor_id: req.user.id,
              status: reviewData.status,
              reason: reviewData.reason || null,
              supervisor_images: imageNames || null,
              reason_category: reviewData.reasonCategory || null,
              supervisor_status: supervisorStatus,
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        }

        // Note: supervisor data is stored in supervisor_reviews table only
      }
    }

    // Determine checklist status based on individual item status
    const allReviews = await knex('supervisor_reviews')
      .where('checklist_id', dailyChecklistId)
      .where('supervisor_id', req.user.id);

    const closedItems = allReviews.filter(review => review.status === 'Close');
    const openItems = allReviews.filter(review => review.status === 'Open');

    // Only count existing NC items for status determination
    const totalNCItems = await knex('checklist_data')
      .where('checklist_id', dailyChecklistId)
      .where('status', 'No')
      .where('submission_status', 'completed')
      .count('* as count')
      .first();

    let newStatus, checklistStatus;

    if (openItems.length === 0 && closedItems.length === parseInt(totalNCItems.count)) {
      newStatus = 'awaiting_manager';
      checklistStatus = 'Accepted by Supervisor';
    } else {
      newStatus = 'awaiting_supervisor';
      checklistStatus = 'Awaiting for NC response';
    }

    await knex('checklists')
      .where('id', dailyChecklistId)
      .update({
        status: checklistStatus,
        updated_by: req.user.id,
        updated_at: new Date()
      });

    if (dailyInstance) {
      await DailyAssignmentService.updateDailyInstanceStatus(dailyInstance.id, newStatus);
    }

    res.status(200).json({
      message: 'Supervisor review submitted successfully',
      status: newStatus,
      checklistStatus,
      closedItems: closedItems.length,
      openItems: openItems.length,
      isFirstTimeReview
    });
  } catch (error) {
    logger.error('Error submitting supervisor review:', error);
    res.status(500).json({ error: 'Failed to submit supervisor form', details: error.message });
  }
};

const submitManagerReview = async (req, res) => {
  try {
    const { id } = req.params;
    const managerData = JSON.parse(req.body.managerData || '{}');
    const files = req.files || [];
    const knex = require('../config/database');

    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);
    const dailyChecklistId = dailyInstance ? id : id;

    for (const [itemId, reviewData] of Object.entries(managerData)) {
      if (reviewData) {
        const managerImages = files.filter(f => f.originalname.startsWith(`manager_${itemId}_`));
        const imageNames = managerImages.map(img => img.filename).join(',');
        const managerStatus = reviewData.status;

        // Check if manager review already exists
        const existingManagerReview = await knex('manager_reviews')
          .where('checklist_id', parseInt(dailyChecklistId))
          .where('checklist_item_id', parseInt(itemId))
          .where('manager_id', req.user.id)
          .first();

        if (existingManagerReview) {
          // Update existing manager review - only allow one rejection
          if (existingManagerReview.manager_status !== 'Rejected') {
            await knex('manager_reviews')
              .where('id', existingManagerReview.id)
              .update({
                status: managerStatus,
                reason: reviewData.reason || null,
                manager_images: imageNames || null,
                reason_category: reviewData.reasonCategory || null,
                manager_status: managerStatus,
                updated_at: new Date()
              });
          }
        } else {
          // Insert new manager review
          await knex('manager_reviews').insert({
            checklist_id: parseInt(dailyChecklistId),
            checklist_item_id: parseInt(itemId),
            manager_id: req.user.id,
            status: managerStatus,
            reason: reviewData.reason || null,
            manager_images: imageNames || null,
            reason_category: reviewData.reasonCategory || null,
            manager_status: managerStatus,
            created_at: new Date(),
            updated_at: new Date()
          });
        }

        // If manager rejects, update supervisor review status back to 'Open'
        if (managerStatus === 'Rejected') {
          await knex('supervisor_reviews')
            .where('checklist_id', parseInt(dailyChecklistId))
            .where('checklist_item_id', parseInt(itemId))
            .update({
              status: 'Open',
              updated_at: new Date()
            });
        }
      }
    }

    // Get all manager reviews for status determination
    const allManagerReviews = await knex('manager_reviews')
      .where('checklist_id', dailyChecklistId)
      .where('manager_id', req.user.id);

    const allApproved = allManagerReviews.every(review => review.manager_status === 'Approved');
    const hasRejected = allManagerReviews.some(review => review.manager_status === 'Rejected');

    let newStatus, checklistStatus;

    if (allApproved) {
      newStatus = 'completed';
      checklistStatus = 'Completed';
    } else if (hasRejected) {
      newStatus = 'awaiting_supervisor';
      checklistStatus = 'Awaiting for NC response';
    } else {
      newStatus = 'awaiting_manager';
      checklistStatus = 'Pending Manager Verification';
    }
    await knex('checklists')
      .where('id', dailyChecklistId)
      .update({
        status: checklistStatus,
        updated_at: new Date()
      });

    if (dailyInstance) {
      await DailyAssignmentService.updateDailyInstanceStatus(dailyInstance.id, newStatus);
    }

    res.status(200).json({
      message: 'Manager review submitted successfully',
      status: newStatus,
      checklistStatus
    });
  } catch (error) {
    logger.error('Error submitting manager review:', error);
    res.status(500).json({ error: 'Failed to submit manager checklist form', details: error.message });
  }
};

const getManagerReviewItems = async (req, res) => {
  try {
    const { id } = req.params;
    const knex = require('../config/database');

    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);
    const dailyChecklistId = dailyInstance ? id : id;

    // Only show items where status='Close'
    const managerReviewItems = await knex('supervisor_reviews')
      .select(
        'supervisor_reviews.*',
        'checklist_items.*',
        'checklist_data.status as auditor_status',
        'checklist_data.category',
        'checklist_data.reason',
        'checklist_data.textbox',
        'checklist_data.image_name',
        'supervisor_reviews.reason as supervisor_reason',
        'manager_reviews.manager_status as manager_status'
      )
      .leftJoin('checklist_items', 'supervisor_reviews.checklist_item_id', 'checklist_items.id')
      .leftJoin('manager_reviews', 'manager_reviews.checklist_item_id', 'checklist_items.id')
      .leftJoin('checklist_data', function() {
        this.on('checklist_data.checklist_item_id', '=', 'checklist_items.id')
            .andOn('checklist_data.checklist_id', '=', knex.raw('?', [dailyChecklistId]));
      })
      .where('supervisor_reviews.checklist_id', dailyChecklistId)
      .where('supervisor_reviews.status', 'Close');

    const reviews = managerReviewItems.map(review => {
      let auditorImages = [];
      if (review.image_name) {
        const imageNames = review.image_name.split(',');
        auditorImages = imageNames.map(imageName => ({
          name: imageName.trim()
        }));
      }

      let supervisorImages = [];
      if (review.supervisor_images) {
        const imageNames = review.supervisor_images.split(',');
        supervisorImages = imageNames.map(imageName => ({
          name: imageName.trim()
        }));
      }

      return {
        id: review.checklist_item_id,
        activities: review.activities,
        process: review.process,
        criticality: review.criticality,
        status: review.auditor_status,
        category: review.category,
        reason: review.reason,
        textbox: review.textbox || null,
        images: auditorImages,
        supervisor_reason: review.supervisor_reason,
        supervisor_images: supervisorImages,
        supervisor_status: review.supervisor_status,
        manager_status: review.manager_status,
        supervisor_item_status: review.status
      };
    });

    res.json({
      message: 'Manager review items retrieved successfully',
      reviews
    });
  } catch (error) {
    logger.error('Error retrieving manager review items:', error);
    res.status(500).json({ error: 'Failed to get manager checklist items', details: error.message });
  }
};

const getAllSupervisorReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const knex = require('../config/database');

    const reviews = await knex('supervisor_reviews')
      .select(
        'supervisor_reviews.*',
        'checklist_items.activities',
        'checklist_items.process',
        'checklist_items.criticality',
        'checklist_data.reason as auditor_reason',
        'checklist_data.image_name',
        'users.username as supervisor_name'
      )
      .leftJoin('checklist_items', 'supervisor_reviews.checklist_item_id', 'checklist_items.id')
      .leftJoin('checklist_data', function() {
        this.on('checklist_data.checklist_item_id', '=', 'supervisor_reviews.checklist_item_id')
            .andOn('checklist_data.checklist_id', '=', knex.raw('?', [id]));
      })
      .leftJoin('users', 'supervisor_reviews.supervisor_id', 'users.id')
      .where('supervisor_reviews.checklist_id', id);

    res.json({
      message: 'Supervisor reviews retrieved successfully',
      reviews
    });
  } catch (error) {
    logger.error('Error retrieving all supervisor reviews:', error);
    res.status(500).json({ error: 'Failed to fetch supervisor checklists' });
  }
};

const getManagerReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const knex = require('../config/database');

    // Get daily checklist instance to use daily checklist ID
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);
    const dailyChecklistId = dailyInstance ? id : id; // Use provided ID as daily checklist ID

    const reviews = await knex('manager_reviews')
      .select(
        'manager_reviews.*',
        'checklist_items.activities',
        'checklist_items.process',
        'users.username as manager_name'
      )
      .leftJoin('checklist_items', 'manager_reviews.checklist_item_id', 'checklist_items.id')
      .leftJoin('users', 'manager_reviews.manager_id', 'users.id')
      .where('manager_reviews.checklist_id', dailyChecklistId);

    res.json({
      message: 'Manager reviews retrieved successfully',
      reviews
    });
  } catch (error) {
    logger.error('Error retrieving manager reviews:', error);
    res.status(500).json({ error: 'Failed to fetch manager checklists', details: error.message });
  }
};

const deleteChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const knex = require('../config/database');


    const checklist = await Checklist.findById(id);
    if (!checklist || checklist.deleted_at) {
      return res.status(404).json({ error: 'Checklist not found' });
    }


    const deletionDate = new Date();
    deletionDate.setHours(0, 0, 0, 0);
    const formattedDeletionDate = `${deletionDate.getFullYear()}-${(deletionDate.getMonth()+1).toString().padStart(2,'0')}-${deletionDate.getDate().toString().padStart(2,'0')}`;

    // 1. Get ALL instances BEFORE deletion
    const allInstances = await knex('daily_checklist_instances')
      .where('template_checklist_id', id)
      .select('id', 'assigned_date', 'daily_checklist_id');
    
    // 2. Categorize by date
    const pastInstances = [];
    const futureInstances = [];
    
    allInstances.forEach(inst => {
      const instDate = new Date(inst.assigned_date);
      instDate.setHours(0, 0, 0, 0);
      
      if (instDate < deletionDate) {
        pastInstances.push(inst);
      } else {
        futureInstances.push(inst);
      }
    });

    // 3. SOFT DELETE template checklist
    await knex('checklists').where('id', id).update({
      is_active: 0,
      deleted_at: new Date(),
      updated_by: req.user.id,
      updated_at: new Date()
    });

    // 4. HARD DELETE today and future instances
    for (const instance of futureInstances) {
      await knex('checklist_items').where('checklist_id', instance.daily_checklist_id).del();
      await knex('checklists').where('id', instance.daily_checklist_id).del();
      await knex('daily_checklist_instances').where('id', instance.id).del();
    }

    // 5. SOFT DELETE roster
    const rosterUpdate = await knex('rosters').where('checklist_id', id).update({
      is_active: 0,
      updated_at: new Date()
    });

    // 6. Remove from rotation_checklists (so it no longer appears in Rotation Roster)
    const rotationEntries = await knex('rotation_checklists').where('checklist_id', id).select('id');
    if (rotationEntries.length > 0) {
      const rcIds = rotationEntries.map(r => r.id);
      await knex('rotation_temp_swaps').whereIn('rotation_checklist_id', rcIds).del();
      await knex('rotation_checklists').where('checklist_id', id).del();
    }

    // 7. Verify past instances still exist
    const remainingInstances = await knex('daily_checklist_instances')
      .where('template_checklist_id', id)
      .select('id', 'assigned_date');
    


    res.json({ 
      message: 'Checklist deleted successfully (past history preserved)',
      deleted_future_instances: futureInstances.length,
      preserved_past_instances: pastInstances.length,
      deletion_date: formattedDeletionDate
    });
  } catch (error) {
    logger.error('Error deleting checklist:', error);
    res.status(500).json({ error: 'Failed to delete checklist', details: error.message });
  }
};



const restoreChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const knex = require('../config/database');

    const checklist = await knex('checklists').where('id', id).where('is_active', 0).whereNotNull('deleted_at').first();
    if (!checklist) {
      return res.status(404).json({ error: 'Deleted checklist not found' });
    }

    await knex('checklists').where('id', id).update({
      is_active: 1,
      deleted_at: null,
      updated_by: req.user.id,
      updated_at: new Date()
    });

    await knex('rosters').where('checklist_id', id).update({
      is_active: 1,
      updated_at: new Date()
    });


    res.json({ message: 'Checklist restored successfully' });
  } catch (error) {
    logger.error('Error restoring checklist:', error);
    res.status(500).json({ error: 'Failed to restore checklist', details: error.message });
  }
};



const updateChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const { FileProcessorService } = require('../services/FileProcessorService');

    // Check if checklist exists
    const existingChecklist = await Checklist.findById(id);
    if (!existingChecklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    // Validate required fields
    if (!req.body.category_id || !req.body.checklist_name || !req.body.frequency || !req.body.audit_count || !req.body.alert_time) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const checklistData = { ...req.body };

    // console.log('Checklist data before processing location/department:', checklistData);

    // Handle location/department/name updates
    await processLocationData(checklistData, req.body);

    // Add user tracking and clean data
    checklistData.updated_by = req.user.id;
    cleanChecklistData(checklistData);

    // Process uploaded file if provided
    let fileResult = null;
    if (req.file) {
      fileResult = await FileProcessorService.process(req.file);
      checklistData.checklist_file = req.file.filename;

      // Update checklist items if new file provided
      if (fileResult.items.length > 0) {
        // Delete existing items in TEMPLATE
        await ChecklistItem.query().where('checklist_id', id).del();

        // Insert new items to TEMPLATE
        const allItems = fileResult.items.map(item => item.data);
        await ChecklistItem.createFromCSV(id, allItems);
      }
    }
    // Update TEMPLATE checklist
    const updatedChecklist = await Checklist.update(id, checklistData);

    // Re-sync roster supervisor/manager IDs since location/department may have changed
    const { syncRosterAssignments } = require('../utils/userService');
    await syncRosterAssignments();

    // ========================================
    // UPDATE ALL PENDING DAILY INSTANCES
    // ========================================
    const knex = require('../config/database');

    // Find all daily instances from this template
    const dailyInstances = await knex('daily_checklist_instances')
      .select('daily_checklist_instances.*', 'checklists.status as checklist_status')
      .leftJoin('checklists', 'daily_checklist_instances.daily_checklist_id', 'checklists.id')
      .where('daily_checklist_instances.template_checklist_id', id);


    // Filter ONLY pending instances (not completed/submitted)
    const pendingInstances = dailyInstances.filter(instance => {
      const status = instance.status || instance.checklist_status;
      return status === 'assigned' ||
        status === 'draft' ||
        status === '' ||
        status === null ||
        status === 'Draft';
    });


    // Also sync orphaned daily checklists (no instance) that belong to this template
    const templateChecklist = await knex('checklists').where('id', id).first();
    const orphanedDailies = await knex('checklists')
      .where('checklist_name', 'like', `${templateChecklist.checklist_name} - %`)
      .whereNotExists(function() {
        this.select('*').from('daily_checklist_instances')
          .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      });
    if (orphanedDailies.length > 0) {
      const orphanedIds = orphanedDailies.map(o => o.id);
      await knex('checklists').whereIn('id', orphanedIds).update({
        category_id: checklistData.category_id,
        location_id: checklistData.location_id,
        department_id: checklistData.department_id,
        name_id: checklistData.name_id,
        camera_count: checklistData.camera_count,
        frequency: checklistData.frequency,
        audit_count: checklistData.audit_count,
        alert_time: checklistData.alert_time,
        updated_at: new Date()
      });
      // Sync items for each orphaned daily
      const templateItems = await knex('checklist_items').where('checklist_id', id);
      if (templateItems.length > 0) {
        for (const orphanId of orphanedIds) {
          await knex('checklist_items').where('checklist_id', orphanId).del();
          await knex('checklist_items').insert(templateItems.map(item => ({
            checklist_id: orphanId, type: item.type, activities: item.activities,
            process: item.process, criticality: item.criticality, status: item.status,
            created_at: new Date(), updated_at: new Date()
          })));
        }
      }
    }

    if (pendingInstances.length > 0) {
      const dailyChecklistIds = pendingInstances.map(i => i.daily_checklist_id);

      // Get current auditor from roster for this template (if exists)
      const activeRoster = await knex('rosters')
        .where('checklist_id', id)
        .first();
      
      // Update daily_checklist_instances auditor_id for ALL pending instances
      const pendingInstanceIds = pendingInstances.map(i => i.id);
      if (activeRoster && activeRoster.auditor_id) {
        // Has roster - update ONLY instances without auditor
        // Group instances by date to handle duplicates
        const instancesByDate = {};
        pendingInstances.forEach(inst => {
          const dateKey = inst.assigned_date;
          if (!instancesByDate[dateKey]) {
            instancesByDate[dateKey] = [];
          }
          instancesByDate[dateKey].push(inst);
        });

        // For each date, keep only one instance per template and delete others
        for (const [date, instances] of Object.entries(instancesByDate)) {
          if (instances.length > 1) {
            // Keep the first instance, delete the rest
            const toKeep = instances[0].id;
            const toDelete = instances.slice(1).map(i => i.id);
            
            if (toDelete.length > 0) {
              // Delete duplicate daily checklists
              const duplicateDailyIds = instances.slice(1).map(i => i.daily_checklist_id);
              await knex('checklist_items').whereIn('checklist_id', duplicateDailyIds).del();
              await knex('checklists').whereIn('id', duplicateDailyIds).del();
              
              // Delete duplicate instances
              await knex('daily_checklist_instances').whereIn('id', toDelete).del();
            }
          }
        }

        // Now update remaining instances - ONLY those without auditor
        const remainingInstances = await knex('daily_checklist_instances')
          .whereIn('id', pendingInstanceIds)
          .select('id', 'auditor_id');
        const instancesToUpdate = remainingInstances.filter(i => !i.auditor_id).map(i => i.id);
        
        if (instancesToUpdate.length > 0) {
          await knex('daily_checklist_instances')
            .whereIn('id', instancesToUpdate)
            .update({ auditor_id: activeRoster.auditor_id, updated_at: new Date() });
        }
      } else {
        // No roster - DON'T clear existing auditor_id, leave as is
        logger.info('No roster found, keeping existing auditor assignments');
      }

      // Prepare update data for daily checklists (DON'T update checklist_name to preserve unique suffix)
      const dailyUpdateData = {
        category_id: checklistData.category_id,
        location_id: checklistData.location_id,
        department_id: checklistData.department_id,
        name_id: checklistData.name_id,
        camera_count: checklistData.camera_count,
        frequency: checklistData.frequency,
        audit_count: checklistData.audit_count,
        alert_time: checklistData.alert_time,
        type: checklistData.type,
        assigned_auditor_id: activeRoster?.auditor_id || null,
        updated_at: new Date()
      };

      // Add checklist_file if new file uploaded
      if (req.file && checklistData.checklist_file) {
        dailyUpdateData.checklist_file = checklistData.checklist_file;
      }

      // Remove undefined/null values
      Object.keys(dailyUpdateData).forEach(key => {
        if (dailyUpdateData[key] === undefined || dailyUpdateData[key] === 'undefined') {
          delete dailyUpdateData[key];
        }
      });


      // Update all pending daily checklists
      await knex('checklists')
        .whereIn('id', dailyChecklistIds)
        .update(dailyUpdateData);

      // ========================================
      // ALWAYS SYNC CHECKLIST ITEMS (whether file uploaded or not)
      // ========================================

      // Get current template items
      const templateItems = await ChecklistItem.query().where('checklist_id', id);

      if (templateItems.length > 0) {
        for (const dailyChecklistId of dailyChecklistIds) {
          // Delete existing items in daily checklist
          await ChecklistItem.query().where('checklist_id', dailyChecklistId).del();

          // Copy items from template
          const itemsToInsert = templateItems.map(item => ({
            checklist_id: dailyChecklistId,
            type: item.type,
            activities: item.activities,
            process: item.process,
            criticality: item.criticality,
            status: item.status,
            created_at: new Date(),
            updated_at: new Date()
          }));

          await knex('checklist_items').insert(itemsToInsert);
        }
      }
    }

    res.json({
      message: 'Checklist updated successfully',
      checklist: updatedChecklist,
      updated_instances: pendingInstances.length
    });
  } catch (error) {
    logger.error('UPDATE CHECKLIST ERROR', error);
    res.status(500).json({
      error: error.message || 'checklist update failed',
      details: error.message
    });
  }
};

const createChecklistItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { activities, process, criticality } = req.body;
    const knex = require('../config/database');

    // Check if checklist exists
    const checklist = await Checklist.findById(id);
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    const itemData = {
      checklist_id: id,
      activities: activities || null,
      process: process || null,
      criticality: criticality || 'Medium',
      status: 1,
      created_at: new Date(),
      updated_at: new Date()
    };

    const [insertedId] = await ChecklistItem.query().insert(itemData);
    const newItem = await ChecklistItem.query().where('id', insertedId).first();
    // console.log('New Item Created in Template - ID:', insertedId);

    // Sync to pending daily instances
    const dailyInstances = await knex('daily_checklist_instances')
      .select('daily_checklist_instances.*', 'checklists.status as checklist_status')
      .leftJoin('checklists', 'daily_checklist_instances.daily_checklist_id', 'checklists.id')
      .where('daily_checklist_instances.template_checklist_id', id);

    // console.log('Total Daily Instances Found:', dailyInstances.length);
    dailyInstances.forEach(inst => {
      // console.log(`  - Daily ID: ${inst.daily_checklist_id}, Status: ${inst.status || inst.checklist_status}, Auditor: ${inst.auditor_id}`);
    });

    const pendingInstances = dailyInstances.filter(instance => {
      const status = instance.status || instance.checklist_status;
      return status === 'assigned' || status === 'draft' || status === '' || status === null || status === 'Draft';
    });

    // console.log('Pending Instances to Sync:', pendingInstances.length);

    if (pendingInstances.length > 0) {
      for (const instance of pendingInstances) {
        const insertedItem = await knex('checklist_items').insert({
          checklist_id: instance.daily_checklist_id,
          type: itemData.type,
          activities: itemData.activities,
          process: itemData.process,
          criticality: itemData.criticality,
          status: itemData.status,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    } else {
      logger.info('No pending instances found for checklist item');
    }

    res.status(201).json({
      message: 'Checklist item created successfully',
      item: newItem,
      synced_to_instances: pendingInstances.length
    });
  } catch (error) {
    logger.error('ERROR in createChecklistItem:', error);
    res.status(500).json({ error: 'Failed to create checklist Items', details: error.message });
  }
};

const updateChecklistItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { activities, process, criticality } = req.body;
    const knex = require('../config/database');

    // Check if item exists
    const existingItem = await ChecklistItem.query().where('id', itemId).first();
    if (!existingItem) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    const updateData = {
      activities: activities || null,
      process: process || null,
      criticality: criticality || null,
      updated_at: new Date()
    };

    // Update template item
    await ChecklistItem.query().where('id', itemId).update(updateData);
    const updatedItem = await ChecklistItem.query().where('id', itemId).first();

    // Sync to pending daily instances
    const templateChecklistId = existingItem.checklist_id;
    const dailyInstances = await knex('daily_checklist_instances')
      .select('daily_checklist_instances.*', 'checklists.status as checklist_status')
      .leftJoin('checklists', 'daily_checklist_instances.daily_checklist_id', 'checklists.id')
      .where('daily_checklist_instances.template_checklist_id', templateChecklistId);

    const pendingInstances = dailyInstances.filter(instance => {
      const status = instance.status || instance.checklist_status;
      return status === 'assigned' || status === 'draft' || status === '' || status === null || status === 'Draft';
    });

    if (pendingInstances.length > 0) {
      for (const instance of pendingInstances) {
        // Find corresponding item in daily checklist by activities/process match
        const dailyItem = await knex('checklist_items')
          .where('checklist_id', instance.daily_checklist_id)
          .where('activities', existingItem.activities)
          .where('process', existingItem.process)
          .first();

        if (dailyItem) {
          await knex('checklist_items').where('id', dailyItem.id).update(updateData);
        }
      }
    }

    res.json({
      message: 'Checklist item updated successfully',
      item: updatedItem,
      updated_instances: pendingInstances.length
    });
  } catch (error) {
    logger.error('checklist item update error:', error);
    res.status(500).json({ error: 'Checklist Items update Failed', details: error.message });
  }
};

const deleteChecklistItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const knex = require('../config/database');

    // Check if item exists
    const existingItem = await ChecklistItem.query().where('id', itemId).first();
    if (!existingItem) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    // Delete related checklist_data (draft responses) for this item
    await knex('checklist_data').where('checklist_item_id', itemId).del();

    // Delete from template
    await ChecklistItem.query().where('id', itemId).del();

    // Sync deletion to pending daily instances
    const templateChecklistId = existingItem.checklist_id;
    const dailyInstances = await knex('daily_checklist_instances')
      .select('daily_checklist_instances.*', 'checklists.status as checklist_status')
      .leftJoin('checklists', 'daily_checklist_instances.daily_checklist_id', 'checklists.id')
      .where('daily_checklist_instances.template_checklist_id', templateChecklistId);

    const pendingInstances = dailyInstances.filter(instance => {
      const status = instance.status || instance.checklist_status;
      return status === 'assigned' || status === 'draft' || status === '' || status === null || status === 'Draft';
    });

    if (pendingInstances.length > 0) {
      for (const instance of pendingInstances) {
        // Find and delete corresponding item in daily checklist
        await knex('checklist_items')
          .where('checklist_id', instance.daily_checklist_id)
          .where('activities', existingItem.activities)
          .where('process', existingItem.process)
          .del();
      }
    }
    

    res.json({
      message: 'Checklist item deleted successfully',
      deleted_from_instances: pendingInstances.length
    });
  } catch (error) {
    logger.error('checklist item deleted error:' , error);
    res.status(500).json({ error: 'checklist item deleted failed', details: error.message });
  }
};

const getDeletedChecklists = async (req, res) => {
  try {
    const knex = require('../config/database');
    
    const deletedChecklists = await knex('checklists')
      .select(
        'checklists.id',
        'checklists.checklist_name',
        'checklists.deleted_at',
        'categories.name as category_name',
        'locations.name as location_name',
        'departments.name as department_name',
        'names.name as facility_name'
      )
      .leftJoin('categories', 'checklists.category_id', 'categories.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .where('checklists.is_active', 0)
      .whereNotNull('checklists.deleted_at')
      .orderBy('checklists.deleted_at', 'desc');

    res.json({
      message: 'Deleted checklists retrieved successfully',
      checklists: deletedChecklists
    });
  } catch (error) {
    logger.error('Error retrieving deleted checklists:', error);
    res.status(500).json({ error: 'failed to fetch the deleted checklist', details: error.message });
  }
};

const getDeletedChecklistById = async (req, res) => {
  try {
    const { id } = req.params;
    const knex = require('../config/database');
    
    const checklist = await knex('checklists')
      .select(
        'checklists.*',
        'categories.name as category_name',
        'locations.name as location_name',
        'departments.name as department_name',
        'names.name as facility_name'
      )
      .leftJoin('categories', 'checklists.category_id', 'categories.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .where('checklists.id', id)
      .where('checklists.is_active', 0)
      .whereNotNull('checklists.deleted_at')
      .first();

    if (!checklist) {
      return res.status(404).json({ error: 'Deleted checklist not found' });
    }

    const items = await knex('checklist_items')
      .where('checklist_id', id)
      .orderBy('id');

    res.json({
      message: 'Deleted checklist details retrieved successfully',
      ...checklist,
      items
    });
  } catch (error) {
    logger.error('Error retrieving deleted checklist details:', error);
    res.status(500).json({ error: 'Failed to fetch the checklist6', details: error.message });
  }
};

const exportChecklistPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const knex = require('../config/database');
    const { generateChecklistPDF } = require('../services/pdfService');

    const checklist = await knex('checklists')
      .select('checklists.*', 'locations.name as location_name', 'departments.name as department_name')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .where('checklists.id', id)
      .first();

    if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

    const items = await knex('checklist_items').where('checklist_id', id).orderBy('id');
    const responses = await knex('checklist_data').where('checklist_id', id);

    const pdfBuffer = await generateChecklistPDF(checklist, items, responses);
    const cleanName = (checklist.checklist_name || 'checklist').replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*User\d+$/i, '').replace(/[^a-zA-Z0-9_\- ]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanName}_NC_Report.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error exporting checklist PDF:', error);
    res.status(500).json({ error: 'Failed to export Pdf', details: error.message });
  }
};

const sendChecklistMail = async (req, res) => {
  try {
    const { id } = req.params;
    const { to, cc } = req.body;
    const knex = require('../config/database');
    const { enqueueEmail } = require('../services/emailQueueService');

    if (!to) return res.status(400).json({ error: 'Recipient email is required' });

    const toEmails = to.split(',').map(e => e.trim()).filter(Boolean).join(', ');
    const ccEmails = cc ? cc.split(',').map(e => e.trim()).filter(Boolean).join(', ') : '';

    const checklist = await knex('checklists')
      .select('checklists.*', 'locations.name as location_name', 'departments.name as department_name', 'categories.name as category_name')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('categories', 'checklists.category_id', 'categories.id')
      .where('checklists.id', id)
      .first();

    if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

    const items = await knex('checklist_items').where('checklist_id', id).orderBy('id');
    const responses = await knex('checklist_data').where('checklist_id', id);

    // Clean checklist name
    const cleanName = (checklist.checklist_name || '-').replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*User\d+$/i, '');

    // Generate NC PDF
    const { generateChecklistPDF } = require('../services/pdfService');
    const pdfBuffer = await generateChecklistPDF(checklist, items, responses);

    // Build HTML email body with NC items only
    const ncResponses = responses.filter(r => r.status === 'No');
    const itemMap = {};
    items.forEach(i => { itemMap[i.id] = i; });

    const rows = ncResponses.map(r => {
      const item = itemMap[r.checklist_item_id] || {};
      return `<tr>
        <td style="border:1px solid #ddd;padding:8px">${item.activities || ''}</td>
        <td style="border:1px solid #ddd;padding:8px">${item.process || ''}</td>
        <td style="border:1px solid #ddd;padding:8px">${r.reason || '-'}</td>
      </tr>`;
    }).join('');

    const html = `
      <h3>Hi Team</h3>
      <h4>Checklist Report for ${cleanName}</h4>
      <p><strong>Location:</strong> ${checklist.location_name || '-'} | <strong>Department:</strong> ${checklist.department_name || '-'} | <strong>Status:</strong> ${checklist.status || '-'}</p>
      <p><strong>Total NCs:</strong> ${ncResponses.length}</p>
      ${checklist.category_id !== 6 ? `<p><strong>Score Yes:</strong> ${responses.filter(r => r.status === 'Yes').length * 10} | <strong>Score No:</strong> ${ncResponses.length * 10}</p>` : ''}
      <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px">
        <thead><tr style="background:#f0f0f0">
          <th style="border:1px solid #ddd;padding:8px;text-align:left">Activities</th>
          <th style="border:1px solid #ddd;padding:8px;text-align:left">Process</th>
          <th style="border:1px solid #ddd;padding:8px;text-align:left">Reason</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#888;font-size:12px;margin-top:16px">Full report with images attached as PDF.</p>
      <p style="margin:0; line-height:1.2;">Regards,</p>
      <p style="margin:0; line-height:1.2;">Virtual Auditor</p>
      <p style="margin:0; line-height:1.2;">HEPL</p>
          `;

    const fileName = cleanName.replace(/[^a-zA-Z0-9_\- ]/g, '_');

    await enqueueEmail({
      to: toEmails,
      cc: ccEmails || undefined,
      subject: `NC Report: ${cleanName}`,
      html,
      attachments: [{ filename: `${fileName}_NC_Report.pdf`, content: pdfBuffer }],
      checklistName: cleanName,
      categoryName: checklist.category_name,
      locationName: checklist.location_name,
      departmentName: checklist.department_name
    });

    res.json({ message: 'Email queued successfully' });
  } catch (error) {
    logger.error('Error sending checklist email:', error);
    res.status(500).json({ error: 'Failed to send mail', details: error.message });
  }
};
const sendAnalyticsMail = async (req, res) => {
  try {
    const { to, cc, subject, fromDate, toDate, categoryId, locationId, departmentId } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient email is required' });

    // Resolve locationName from locationId if not provided
    let locName = 'All Locations';
    if (locationId) {
      const knex = require('../config/database');
      const loc = await knex('locations').where('id', locationId).first('name');
      if (loc) locName = loc.name;
    }

    const pptBuffer = await buildPptBuffer({ fromDate, toDate, categoryId, locationId, departmentId, locationName: locName });

    const fileName = `Virtual_Audit_${locName.replace(/\s+/g, '_')}_${fromDate || 'report'}.pptx`;
    const toEmails = to.split(',').map(e => e.trim()).filter(Boolean).join(', ');
    const ccEmails = cc ? cc.split(',').map(e => e.trim()).filter(Boolean).join(', ') : '';
    const mailSubject = subject || `Virtual Audit Analytics Report - ${locName} (${fromDate} to ${toDate})`;

    await enqueueEmail({
      to: toEmails,
      cc: ccEmails || undefined,
      subject: mailSubject,
      html: `<p>Hi Team,</p><p>Please find the attached Virtual Audit Analytics Report for <strong>${locName}</strong> from <strong>${fromDate}</strong> to <strong>${toDate}</strong>.</p><p>Regards,<br/>Virtual Auditor<br/>HEPL</p>`,
      attachments: [{ filename: fileName, content: pptBuffer }]
    });

    res.json({ message: 'Email queued successfully' });
  } catch (error) {
    logger.error('Error sending analytics mail:', error);
    res.status(500).json({ error: 'Failed to send mail', details: error.message });
  }
};

const closeRandomChecklist = async (req, res) => {
  try {
    const checklistId = req.params.id;
    const knex = require('../config/database');

    const dailyInstance = await knex('daily_checklist_instances')
      .select('daily_checklist_id')
      .where('daily_checklist_id', checklistId)
      .first();

    if (!dailyInstance) {
      return res.status(404).json({ error: 'Daily checklist instance not found' });
    }

    const dailyChecklistId = dailyInstance.daily_checklist_id;

    const checklist = await knex('checklists').where('id', dailyChecklistId).first();
    const totalCameraCount = checklist?.camera_count || 0;

    await knex('checklists').where('id', dailyChecklistId).update({
      total_camera_random_audited: totalCameraCount,
      status: 'Completed without NCs',
      updated_at: new Date()
    });

    await knex('daily_checklist_instances')
      .where('daily_checklist_id', dailyChecklistId)
      .update({ status: 'completed', updated_at: new Date() });

    const checklistItems = await knex('checklist_items').where('checklist_id', dailyChecklistId).select('id');

    for (const item of checklistItems) {
      const existing = await knex('checklist_data')
        .where({ checklist_id: dailyChecklistId, checklist_item_id: item.id })
        .first();

      if (existing) {
        await knex('checklist_data')
          .where({ checklist_id: dailyChecklistId, checklist_item_id: item.id })
          .update({ status: 'Yes', submission_status: 'completed', updated_at: new Date() });
      } else {
        await knex('checklist_data').insert({
          checklist_id: dailyChecklistId,
          user_id: req.user.id,
          checklist_item_id: item.id,
          status: 'Yes',
          submission_status: 'completed',
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }

    return res.status(200).json({ message: 'Checklist closed successfully', checklistId: dailyChecklistId });
  } catch (error) {
    logger.error('Error closing checklist:', error);
    res.status(500).json({ error: 'Failed to close checklist', details: error.message });
  }
}

module.exports = {
  getCategories,
  getLocations,
  getDepartments,
  getLocationsByCategory,
  getDepartmentsByCategoryLocation,
  getNames,
  createChecklist: [upload.single('checklist_file'), createChecklist],
  getChecklists,
  getChecklist,
  assignUsers,
  getUsers,
  getAssignments,
  getChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  saveChecklistForm: [combinedUpload, processUploads, saveChecklistForm],
  completeChecklistForm: [combinedUpload, processUploads, completeChecklistForm],
  getChecklistResponses,
  getDraftChecklist,
  getAllChecklistsData,
  getSupervisorChecklistsData,
  getManagerChecklistsData,
  downloadSampleTemplate,
  submitSupervisorReview: [imageUpload.array('supervisorImages', 50), compressImages, submitSupervisorReview],
  getSupervisorReviews,
  getAllSupervisorReviews,
  getManagerReviewItems,
  submitManagerReview,
  getManagerReviews,
  updateChecklist: [upload.single('checklist_file'), updateChecklist],
  deleteChecklist,
  restoreChecklist,
  getDeletedChecklists,
  getDeletedChecklistById,
  exportChecklistPDF,
  sendChecklistMail,
  sendAnalyticsMail,
  closeRandomChecklist
};