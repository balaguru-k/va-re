const { log } = require('winston');
const knex = require('../config/database');
const logger = require('../config/logger');
const {newFormatDateTime} = require('../utils/dateFormatter');


class DailyAssignmentService {

  // Reset daily instance status to 'assigned' for fresh daily rotation
  static async resetDailyInstanceStatus(instanceId) {
    // const { debugLog } = require('../utils/debugLogger');
    // debugLog(`Resetting instance ${instanceId} status to assigned for fresh daily rotation`);

    await knex('daily_checklist_instances')
      .where('id', instanceId)
      .update({
        status: 'assigned',
        updated_at: new Date()
      });
  }

  // Get daily checklist instance for a user
  static async getDailyChecklistInstance(templateChecklistId, userId) {
    try{
    // Fix date parsing for today
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    let instance = await knex('daily_checklist_instances')
      .where('template_checklist_id', templateChecklistId)
      .where('auditor_id', userId)
      .where('assigned_date', formattedToday)
      .first();

    // Create if not exists
    if (!instance) {
      // Skip creation on Sunday
      const dayOfWeek = new Date(formattedToday).getDay();
      if (dayOfWeek === 0) return null;

      // Find roster for this user and checklist
      const roster = await knex('rosters')
        .where('checklist_id', templateChecklistId)
        .where('auditor_id', userId)
        .first();

      if (roster) {
        instance = await this.createDailyChecklistInstanceFromRoster(
          templateChecklistId,
          userId,
          roster.id,
          formattedToday
        );
      }
    }

    return instance;
  }
  catch(error){
    logger.error('Error in getDailyChecklistInstance:', error);
    return null;
  }
  }

  // Create daily checklist instance if not exists
  static async createDailyChecklistInstance(templateChecklistId, userId, assignedDate) {
    try{
    const existing = await knex('daily_checklist_instances')
      .where('template_checklist_id', templateChecklistId)
      .where('auditor_id', userId)
      .where('assigned_date', assignedDate)
      .first();

    if (existing) return existing;

    const [instanceId] = await knex('daily_checklist_instances').insert({
      template_checklist_id: templateChecklistId,
      roster_id: 1,
      auditor_id: userId,
      assigned_date: assignedDate,
      daily_key: `${templateChecklistId}_${userId}_${assignedDate}`,
      status: 'assigned',
      created_at: new Date(),
      updated_at: new Date()
    });
    return await knex('daily_checklist_instances').where('id', instanceId).first();
  }
  catch(error){
    logger.error('Error in createDailyChecklistInstance:', error);
  }
}


  // Create daily instances from all roster assignments for a date
  static async createDailyInstancesFromRosters(targetDate) {
    try{
    const dateObj = new Date(targetDate);
    if (dateObj.getDay() === 0) {
      logger.info('Skipping daily instance creation for Sunday:', targetDate);
      return;
    }

    const rosters = await knex('rosters')
      .where('is_active', 1) // Only active rosters
      .select('*');
    // rosters.forEach(r => {
    //   debugLog(`  Roster: ID=${r.id}, Checklist=${r.checklist_id}, Auditor=${r.auditor_id}`);
    //   logger.info(`Roster ID ${r.id}: checklist_id=${r.checklist_id}, auditor_id=${r.auditor_id}`);
    // });

    // OPTIMIZED: Use Promise.all with map instead of sequential for loop
    const rosterPromises = rosters.map(async (roster) => {
      try {
        return await this.createDailyChecklistInstanceFromRoster(
          roster.checklist_id,
          roster.auditor_id,
          roster.id,
          targetDate
        );
      } catch (error) {
        logger.error('Error creating daily checklist instance from roster:', error.message);
      }
    });

    // Execute all roster processing in parallel
    await Promise.all(rosterPromises);
  }
    catch(error){
      logger.error('Error in createDailyInstancesFromRosters:', error);
    }
  }

  // Create executive daily instances for SC checklists
  static async createExecutiveSCInstances(targetDate) {
    // Create daily instances for SC checklists that don't have rosters yet
    // This allows executives to see and work on SC checklists immediately after creation

    // Get all SC checklists
    try{
    const scChecklists = await knex('checklists')
      .where('type', 'SC')
      .where('is_active', true);

    for (const scChecklist of scChecklists) {
      // Check if daily instance already exists (from roster)
      const existingInstance = await knex('daily_checklist_instances')
        .where('template_checklist_id', scChecklist.id)
        .where('assigned_date', targetDate)
        .first();

      if (!existingInstance) {
        // No roster assigned yet - create instance with placeholder auditor
        await this.createDailyChecklistInstanceFromRoster(
          scChecklist.id,
          null, // No auditor yet
          null, // No roster yet
          targetDate
        );
      }
    }
  }
  catch(error){
    logger.error('Error in createExecutiveSCInstances:', error);
  }
}

  // Create daily checklist instance from roster
  static async createDailyChecklistInstanceFromRoster(templateChecklistId, userId, rosterId, assignedDate, executiveId = null) {
    // const { debugLog } = require('../utils/debugLogger');

    try {
      const instanceKey = userId
        ? `${templateChecklistId}_${userId}_${assignedDate}`
        : rosterId
          ? `${templateChecklistId}_roster${rosterId}_${assignedDate}`
          : `${templateChecklistId}_SC_${assignedDate}`;


      // CRITICAL: Check if instance already exists for this roster and date FIRST
      if (rosterId) {
        const existsByRoster = await knex('daily_checklist_instances')
          .where('roster_id', rosterId)
          .where('assigned_date', assignedDate)
          .first();

        if (existsByRoster) {
          return existsByRoster;
        }
      }

      // Secondary check by template + user + date (only when no rosterId to avoid SC key collision)
      if (!rosterId) {
        const existing = await knex('daily_checklist_instances')
          .where('template_checklist_id', templateChecklistId)
          .where('assigned_date', assignedDate)
          .where(function() {
            this.whereNull('auditor_id').orWhere('auditor_id', 0);
          })
          .first();

        if (existing) {
          logger.info('[DAS] Instance already exists by template+date (SC), skipping', { templateChecklistId, assigned_date: assignedDate, instance_id: existing.id });
          return existing;
        }
      }

      if (rosterId) {
        const rosterExists = await knex('rosters').where('id', rosterId).first();
        if (!rosterExists) {
          return null;
        }
      }

      const roster = await knex('rosters').where('id', rosterId).first();

      const result = await knex.transaction(async (trx) => {
        // Create unique daily checklist copy for this user and date
        const templateChecklist = await trx('checklists').where('id', templateChecklistId).first();
        
        if (!templateChecklist) {
          throw new Error(`Template checklist ${templateChecklistId} not found`);
        }

        // Create daily checklist with unique name including user and date
        const dailyChecklistName = `${templateChecklist.checklist_name} - ${assignedDate}${userId ? ` - User${userId}` : ' - SC'}`;

        const [newDailyChecklistId] = await trx('checklists').insert({
          checklist_name: dailyChecklistName,
          category_id: templateChecklist.category_id,
          location_id: templateChecklist.location_id,
          department_id: templateChecklist.department_id,
          name_id: templateChecklist.name_id,
          camera_count: templateChecklist.camera_count, // Copy camera count from template
          type: templateChecklist.type, // Copy type from template
          frequency: templateChecklist.frequency,
          audit_count: templateChecklist.audit_count,
          alert_time: templateChecklist.alert_time,
          assigned_auditor_id: userId, // Snapshot auditor at creation (null for SC without roster)
          assigned_supervisor_id: roster?.supervisor_id ? JSON.parse(roster.supervisor_id)[0] : null, // Extract first ID from JSON array
          assigned_manager_id: roster?.manager_id ? JSON.parse(roster.manager_id)[0] : null, // Extract first ID from JSON array
          assigned_executive_id: executiveId, // Snapshot executive if provided
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        });

        // debugLog('Created daily checklist with ID:', newDailyChecklistId);

        // Copy checklist items to new daily checklist - OPTIMIZED with map
        const templateItems = await trx('checklist_items').where('checklist_id', templateChecklistId);
        if (templateItems.length > 0) {
          const itemsToInsert = templateItems.map(item => ({
            checklist_id: newDailyChecklistId,
            type: item.type,
            activities: item.activities,
            process: item.process,
            criticality: item.criticality,
            created_at: new Date(),
            updated_at: new Date()
          }));
          await trx('checklist_items').insert(itemsToInsert);
        }

        // Create daily instance pointing to the new daily checklist
        const [instanceId] = await trx('daily_checklist_instances').insert({
          template_checklist_id: templateChecklistId,
          roster_id: rosterId,
          auditor_id: userId, // Can be null for SC without roster
          executive_id: executiveId, // Store executive_id if provided
          supervisor_id: roster?.supervisor_id || null, // Store as JSON string from roster
          manager_id: roster?.manager_id || null, // Store as JSON string from roster
          assigned_date: assignedDate,
          daily_checklist_id: newDailyChecklistId,
          daily_key: instanceKey,
          status: userId ? 'assigned' : 'unassigned',
          created_at: new Date(),
          updated_at: new Date()
        });

        // debugLog('Created instance with ID:', instanceId);

        return await trx('daily_checklist_instances').where('id', instanceId).first();
      });

      return result;
    } catch (error) {
      // debugLog('Error creating instance:', error.message);
      if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Deadlock')) {
        // Return existing instance on duplicate or deadlock
        return await knex('daily_checklist_instances')
          .where('template_checklist_id', templateChecklistId)
          .where('auditor_id', userId)
          .where('assigned_date', assignedDate)
          .first();
      }
      throw error;
    }
  }

  // Get all daily assignments for a date (create if not exist)
  static async getAllDailyAssignments(targetDate, startDate, endDate) {
    // First create daily instances from rosters
    try{
    await this.createDailyInstancesFromRosters(targetDate);

    // Also create rotation daily instances
    const RotationService = require('./RotationService');
    await RotationService.createRotationDailyInstances(targetDate);

    // Process one-day extra assignments
    const DailyExtraService = require('./DailyExtraService');
    await DailyExtraService.processExtrasForDate(targetDate);

    const today = new Date().toISOString().split('T')[0];

    let query = knex('daily_checklist_instances as dci')
      .select(
        'dci.*',
        'dci.assigned_date',
        'dci.daily_checklist_id as checklist_id',
        'dci.status as instance_status',
        'dc.status as status',
        'tc.checklist_name',
        'dc.time_taken_seconds',
        'tc.category_id',
        'tc.location_id',
        'tc.name_id',
        'tc.department_id',
        'cat.name as category_name',
        'u.username as auditor_name',
        'l.name as location_name',
        'd.name as department_name',
        'n.name as facility_name',
        'r.supervisor_id',
        'r.manager_id'
      )
      .leftJoin('checklists as dc', 'dci.daily_checklist_id', 'dc.id')
      .leftJoin('checklists as tc', 'dci.template_checklist_id', 'tc.id')
      .leftJoin('categories as cat', 'tc.category_id', 'cat.id')
      .leftJoin('users as u', 'dci.auditor_id', 'u.id')
      .leftJoin('locations as l', 'tc.location_id', 'l.id')
      .leftJoin('departments as d', 'tc.department_id', 'd.id')
      .leftJoin('names as n', 'tc.name_id', 'n.id')
      .leftJoin('rosters as r', 'dci.roster_id', 'r.id')
      .whereBetween('dci.assigned_date', [startDate, endDate])
      .whereRaw('DAYOFWEEK(dci.assigned_date) != 1');
    if (startDate < today && endDate < today) {
      query = query.where(knex.raw('DATE(dci.created_at)'), '!=', today);
    }

    return await query;
  }
  catch(error){
    logger.error('Error in getAllDailyAssignments:', error);
    return [];
  }
}

  // Get all daily assignments up to and including a date (for Supervisor/Manager pending view)
  static async getAllDailyAssignmentsUpToDate(startDate, endDate) {
    // Get assignments from all dates up to and including toDate
    try{
    const today = new Date();
    const formatDate = newFormatDateTime(today);
    let query = knex('daily_checklist_instances as dci')
      .select(
        'dci.*',
        'dci.daily_checklist_id as checklist_id',
        'dci.assigned_date',
        'dc.status as status',
        'dc.time_taken_seconds',
        'tc.checklist_name',
        'tc.category_id',
        'tc.location_id',
        'tc.name_id',
        'tc.department_id',
        'cat.name as category_name',
        'u.username as auditor_name',
        'l.name as location_name',
        'd.name as department_name',
        'n.name as facility_name',
        'r.supervisor_id',
        'r.manager_id'
      )
      .leftJoin('checklists as dc', 'dci.daily_checklist_id', 'dc.id')
      .leftJoin('checklists as tc', 'dci.template_checklist_id', 'tc.id')
      .leftJoin('categories as cat', 'tc.category_id', 'cat.id')
      .leftJoin('users as u', 'dci.auditor_id', 'u.id')
      .leftJoin('locations as l', 'tc.location_id', 'l.id')
      .leftJoin('departments as d', 'tc.department_id', 'd.id')
      .leftJoin('names as n', 'tc.name_id', 'n.id')
      .leftJoin('rosters as r', 'dci.roster_id', 'r.id')
      .whereRaw('DAYOFWEEK(dci.assigned_date) != 1')
      .orderBy('dci.assigned_date', 'desc');

      if (startDate && endDate !== formatDate ) {
      query = query.where('dci.assigned_date', '>=', startDate) .where('dci.assigned_date', '<=', endDate)
  }
      return await query;
}
catch(error){   
    logger.error('Error in getAllDailyAssignmentsUpToDate:', error);
    return [];
  }
}

  // Read-only: Get daily assignments for a date range (no instance creation)
  static async getDailyAssignmentsByRangeReadOnly(fromDate, toDate) {
    try {
      const todaydate = new Date().toISOString().split('T')[0];

      let query = knex('daily_checklist_instances as dci')
        .select(
          'dci.*',
          'dci.daily_checklist_id as checklist_id',
          'dc.status as status',
          'dc.time_taken_seconds',
          'tc.checklist_name',
          'tc.category_id',
          'tc.location_id',
          'tc.department_id',
          'cat.name as category_name',
          'u.username as auditor_name',
          'l.name as location_name',
          'd.name as department_name',
          'n.name as facility_name'
        )
        .leftJoin('checklists as dc', 'dci.daily_checklist_id', 'dc.id')
        .leftJoin('checklists as tc', 'dci.template_checklist_id', 'tc.id')
        .leftJoin('categories as cat', 'tc.category_id', 'cat.id')
        .leftJoin('users as u', 'dci.auditor_id', 'u.id')
        .leftJoin('locations as l', 'tc.location_id', 'l.id')
        .leftJoin('departments as d', 'tc.department_id', 'd.id')
        .leftJoin('names as n', 'tc.name_id', 'n.id')
        .whereBetween('dci.assigned_date', [fromDate, toDate]);

      if (fromDate < todaydate && toDate < todaydate) {
        query = query.where(knex.raw('DATE(dci.created_at)'), '!=', todaydate);
      }

      return await query;
    } catch (error) {
      logger.error('Error in getDailyAssignmentsByRangeReadOnly:', error);
      return [];
    }
  }

  // Get all daily assignments for a date range
  static async getAllDailyAssignmentsByRange(fromDate, toDate) {
    try{
    // If today is in the range, create instances from roster
    const todaydate = new Date().toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse input dates (YYYY-MM-DD)
    const fromParts = fromDate.split('-');
    const fromDateObj = new Date(parseInt(fromParts[0]), parseInt(fromParts[1]) - 1, parseInt(fromParts[2]));
    fromDateObj.setHours(0, 0, 0, 0);

    const toParts = toDate.split('-');
    const toDateObj = new Date(parseInt(toParts[0]), parseInt(toParts[1]) - 1, parseInt(toParts[2]));
    toDateObj.setHours(0, 0, 0, 0);

    // If today is within range (inclusive), create instances for today
    if (today >= fromDateObj && today <= toDateObj) {
      // Format today as DD-MMM-YYYY for the helper
      const day = today.getDate().toString().padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[today.getMonth()];
      const year = today.getFullYear();
      await this.createDailyInstancesFromRosters(`${day}-${month}-${year}`);
    }

    // Get assignments for the range
    let query = knex('daily_checklist_instances as dci')
      .select(
        'dci.*',
        'dci.daily_checklist_id as checklist_id',
        'dc.status as status',
        'dc.time_taken_seconds',
        'tc.checklist_name',
        'tc.category_id',
        'tc.location_id',
        'tc.department_id',
        'cat.name as category_name',
        'u.username as auditor_name',
        'l.name as location_name',
        'd.name as department_name',
        'n.name as facility_name'
      )
      .leftJoin('checklists as dc', 'dci.daily_checklist_id', 'dc.id')
      .leftJoin('checklists as tc', 'dci.template_checklist_id', 'tc.id')
      .leftJoin('categories as cat', 'tc.category_id', 'cat.id')
      .leftJoin('users as u', 'dci.auditor_id', 'u.id')
      .leftJoin('locations as l', 'tc.location_id', 'l.id')
      .leftJoin('departments as d', 'tc.department_id', 'd.id')
      .leftJoin('names as n', 'tc.name_id', 'n.id')
      .whereBetween('dci.assigned_date', [fromDate, toDate]);
      
    if (fromDate < todaydate && toDate < todaydate) {
      query = query.where(knex.raw('DATE(dci.created_at)'), '!=', todaydate);
    }
    
    return await query;
  }
  catch(error){
    logger.error('Error in getAllDailyAssignmentsByRange:', error);
  }
}

  // Get daily assignments by user for a date
  static async getDailyAssignmentsByUser(userId, target, start, end) {
    try{
    // Only create daily instances for TODAY and FUTURE dates (not PAST)
     const todaydate = new Date().toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

      const targetDate = new Date(target);
      const startDate = new Date(start);
      const endDate = new Date(end);

      targetDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

    // Only create instances if target date is TODAY or FUTURE
    if (targetDate >= today) {
      await this.createDailyInstancesFromRosters(target);
    }

    // Get user role and details to determine visibility logic
    const user = await knex('users').where('id', userId).first();

    let query = knex('daily_checklist_instances as dci')
      .select(
        'dci.*',
        'dci.assigned_date',
        'dci.daily_checklist_id as checklist_id', // Use daily checklist ID
        'tc.checklist_name', // Use template name for display, not daily copy name
        'tc.category_id',
        'tc.department_id', // Add department_id for filtering
        'tc.location_id',
        'tc.name_id',
        'tc.type as checklist_type',
        'dc.time_taken_seconds',
        'cat.name as category_name',
        'u.username as auditor_name',
        'l.name as location_name',
        'd.name as department_name',
        'n.name as facility_name', // Add facility name from names table
        'r.supervisor_id',
        'r.manager_id'
      )
      .leftJoin('checklists as dc', 'dci.daily_checklist_id', 'dc.id') // Daily checklist
      .leftJoin('checklists as tc', 'dci.template_checklist_id', 'tc.id') // Template checklist for metadata
      .leftJoin('categories as cat', 'tc.category_id', 'cat.id')
      .leftJoin('users as u', 'dci.auditor_id', 'u.id')
      .leftJoin('locations as l', 'tc.location_id', 'l.id')
      .leftJoin('departments as d', 'tc.department_id', 'd.id')
      .leftJoin('names as n', 'tc.name_id', 'n.id') // Add names table join
      .leftJoin('rosters as r', 'dci.roster_id', 'r.id')
      .whereBetween('dci.assigned_date', [startDate, endDate])
      .whereRaw('DAYOFWEEK(dci.assigned_date) != 1');

      if(user.role_id === 2 && startDate < todaydate && endDate < todaydate) { 
          query = query.where(knex.raw('DATE(dci.created_at)'), '!=', todaydate);
      }

    // Apply role-specific visibility logic
    if (user.role_id === 6) { // Executive
      // Executive sees SC checklists matching their location+name+department (exact match only)
      let executiveDepartments = [];
      try {
        if (Array.isArray(user.department_id)) {
          executiveDepartments = user.department_id;
        } else if (typeof user.department_id === 'string') {
          executiveDepartments = JSON.parse(user.department_id || '[]');
        } else if (typeof user.department_id === 'number') {
          executiveDepartments = [user.department_id];
        } else if (user.department_id) {
          executiveDepartments = [user.department_id];
        }
      } catch (e) {
        executiveDepartments = user.department_id ? [user.department_id] : [];
      }

      // Ensure it's always an array
      if (!Array.isArray(executiveDepartments)) {
        executiveDepartments = executiveDepartments ? [executiveDepartments] : [];
      }

      query = query.whereExists(function () {
        this.select('*').from('checklists as tc2')
          .whereRaw('tc2.id = dci.template_checklist_id')
          .where('tc2.type', 'SC');
      })
        .where('tc.location_id', user.location_id)
        .where('tc.name_id', user.name_id);

      // Match any of the executive's assigned departments
      if (executiveDepartments.length > 0) {
        query = query.whereIn('tc.department_id', executiveDepartments);
      }
    } else if (user.role_id === 2) { // Auditor
      query = query.whereExists(function () {
        this.select('*').from('checklists as dc2')
          .whereRaw('dc2.id = dci.daily_checklist_id')
          .where('dc2.assigned_auditor_id', userId);
      })
        .where(function () {
          // Normal (non-SC) checklists - show immediately
          this.whereNotExists(function () {
            this.select('*').from('checklists as tc2')
              .whereRaw('tc2.id = dci.template_checklist_id')
              .where('tc2.type', 'SC');
          })
            // SC checklists - only show after executive completes TODAY
            .orWhere(function () {
              this.whereExists(function () {
                this.select('*').from('checklists as tc2')
                  .whereRaw('tc2.id = dci.template_checklist_id')
                  .where('tc2.type', 'SC');
              })
                .whereExists(function () {
                  this.select('*').from('executive_data')
                    .whereRaw('executive_data.checklist_id = dci.daily_checklist_id')
                    .where('executive_data.submission_status', 'completed')
                    .whereRaw('DATE(executive_data.assigned_date) BETWEEN ? AND ?', [startDate, endDate]);
                });
            });
        });
    } else if (user.role_id === 3) { // Supervisor
      // Supervisor sees checklists matching their location+name+department (exact match only)
      let supervisorDepartments = [];
      try {
        if (Array.isArray(user.department_id)) {
          supervisorDepartments = user.department_id;
        } else if (typeof user.department_id === 'string') {
          supervisorDepartments = JSON.parse(user.department_id || '[]');
        } else if (typeof user.department_id === 'number') {
          supervisorDepartments = [user.department_id];
        } else if (user.department_id) {
          supervisorDepartments = [user.department_id];
        }
      } catch (e) {
        supervisorDepartments = user.department_id ? [user.department_id] : [];
      }

      // Ensure it's always an array
      if (!Array.isArray(supervisorDepartments)) {
        supervisorDepartments = supervisorDepartments ? [supervisorDepartments] : [];
      }

      query = query.where('tc.location_id', user.location_id)
        .where('tc.name_id', user.name_id)
        .where(function () {
          // Normal checklists - show immediately
          this.whereNotExists(function () {
            this.select('*').from('checklists as tc2')
              .whereRaw('tc2.id = dci.template_checklist_id')
              .where('tc2.type', 'SC');
          })
            // OR SC checklists that executive completed TODAY
            .orWhere(function () {
              this.whereExists(function () {
                this.select('*').from('checklists as tc2')
                  .whereRaw('tc2.id = dci.template_checklist_id')
                  .where('tc2.type', 'SC');
              })
                .whereExists(function () {
                  this.select('*').from('executive_data')
                    .whereRaw('executive_data.checklist_id = dci.daily_checklist_id')
                    .where('executive_data.submission_status', 'completed')
                    .whereRaw('DATE(executive_data.assigned_date) BETWEEN ? AND ?', [startDate, endDate]);
                });
            });
        });

      // Match any of the supervisor's assigned departments
      if (supervisorDepartments.length > 0) {
        query = query.whereIn('tc.department_id', supervisorDepartments);
      }
    } else if (user.role_id === 4) { // Manager
      // Manager sees checklists matching their location+name+department (exact match only)
      let managerDepartments = [];
      try {
        if (Array.isArray(user.department_id)) {
          managerDepartments = user.department_id;
        } else if (typeof user.department_id === 'string') {
          managerDepartments = JSON.parse(user.department_id || '[]');
        } else if (typeof user.department_id === 'number') {
          managerDepartments = [user.department_id];
        } else if (user.department_id) {
          managerDepartments = [user.department_id];
        }
      } catch (e) {
        managerDepartments = user.department_id ? [user.department_id] : [];
      }

      // Ensure it's always an array
      if (!Array.isArray(managerDepartments)) {
        managerDepartments = managerDepartments ? [managerDepartments] : [];
      }

      query = query.where('tc.location_id', user.location_id)
        .where('tc.name_id', user.name_id)
        .where(function () {
          // Normal checklists - show immediately
          this.whereNotExists(function () {
            this.select('*').from('checklists as tc2')
              .whereRaw('tc2.id = dci.template_checklist_id')
              .where('tc2.type', 'SC');
          })
            // OR SC checklists that executive completed TODAY
            .orWhere(function () {
              this.whereExists(function () {
                this.select('*').from('checklists as tc2')
                  .whereRaw('tc2.id = dci.template_checklist_id')
                  .where('tc2.type', 'SC');
              })
                .whereExists(function () {
                  this.select('*').from('executive_data')
                    .whereRaw('executive_data.checklist_id = dci.daily_checklist_id')
                    .where('executive_data.submission_status', 'completed')
                    .whereRaw('DATE(executive_data.assigned_date) BETWEEN ? AND ?', [startDate, endDate]);
                });
            });
        });

      // Match any of the manager's assigned departments
      if (managerDepartments.length > 0) {
        query = query.whereIn('tc.department_id', managerDepartments);
      }
    } else {
      // Other roles - show only assigned
      query = query.where(function () {
        this.where('dci.auditor_id', userId)
          .orWhereRaw('JSON_CONTAINS(dci.supervisor_id, ?)', [String(userId)])
          .orWhereRaw('JSON_CONTAINS(dci.manager_id, ?)', [String(userId)]);
      });
    }

    return await query;
  }
  catch(error){
    logger.error('Error in getDailyAssigmentsByUser:', error);
  }
  }
  // Update daily instance status by instance ID
  static async updateDailyInstanceStatus(instanceId, status) {
    const updateData = {
      status: status,
      updated_at: new Date()
    };

    // Set completion_date when status becomes 'completed'
    if (status === 'completed') {
      updateData.completion_date = new Date();
    }

    await knex('daily_checklist_instances')
      .where('id', instanceId)
      .update(updateData);
  }

  // Get daily checklist instance by daily checklist ID
  static async getDailyInstanceByChecklistId(dailyChecklistId) {
    return await knex('daily_checklist_instances')
      .where('daily_checklist_id', dailyChecklistId)
      .first();
  }

  // Check if user has completed data for daily checklist (for any role)
  static async hasUserCompletedData(dailyChecklistId, userId) {
    // const { debugLog } = require('../utils/debugLogger');
    // debugLog(`=== CHECKING COMPLETION: checklist=${dailyChecklistId}, user=${userId} ===`);

    // Check checklist_data for auditor completion
    const checklistData = await knex('checklist_data')
      .where('checklist_id', dailyChecklistId)
      .where('user_id', userId)
      .where('submission_status', 'completed')
      .first();

    // debugLog(`Checklist data found: ${!!checklistData}`);
    if (checklistData) {
      // debugLog('User completed as auditor');
      return true;
    }

    // Check supervisor_reviews for supervisor completion
    const supervisorReview = await knex('supervisor_reviews')
      .where('checklist_id', dailyChecklistId)
      .where('supervisor_status', 'Accepted')
      .where('supervisor_id', userId)
      .first();

    // debugLog(`Supervisor review found: ${!!supervisorReview}`);
    if (supervisorReview) {
      // debugLog('User completed as supervisor');
      return true;
    }

    // Check manager_reviews for manager completion
    const managerReview = await knex('manager_reviews')
      .where('checklist_id', dailyChecklistId)
      .where('manager_id', userId)
      .where('manager_status', '!=', 'Rejected')
      .first();

    // debugLog(`Manager review found: ${!!managerReview}`);
    if (managerReview) {
      // debugLog('User completed as manager');
      return true;
    }

    // Check executive_data for executive completion
    const executiveData = await knex('executive_data')
      .where('checklist_id', dailyChecklistId)
      .where('user_id', userId)
      .first();

    if (executiveData) {
      return true;
    }

    // debugLog('No completion found for user');
    return false;
  }

  // Transfer executive completion to auditor
  static async transferSCToAuditor(executiveInstanceId) {
    const execInstance = await knex('daily_checklist_instances')
      .where('id', executiveInstanceId).first();

    // Find rostered auditor for this SC checklist
    const roster = await knex('rosters')
      .where('checklist_id', execInstance.template_checklist_id)
      .where('is_active', true)
      .first();

    if (roster) {
      // Update auditor's daily instance with executive data
      await knex('daily_checklist_instances')
        .where('template_checklist_id', execInstance.template_checklist_id)
        .where('auditor_id', roster.auditor_id)
        .where('assigned_date', execInstance.assigned_date)
        .update({
          executive_images: execInstance.executive_images,
          executive_reason: execInstance.executive_reason,
          updated_at: new Date()
        });
    }
  }
}

module.exports = DailyAssignmentService;