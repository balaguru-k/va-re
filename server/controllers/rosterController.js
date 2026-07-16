const Roster = require('../models/Roster');
const Checklist = require('../models/Checklist');
const User = require('../models/User');
const DailyChecklistInstance = require('../models/DailyChecklistInstance');
const { formatDate,newFormatDate } = require('../utils/dateFormatter');
const logger = require('../config/logger');


const createRoster = async (req, res) => {
  try {
    const { checklist_id, auditor_id, assigned_date } = req.body;
    const { getAutoAssignedUsers } = require('../utils/userService');
    
    // Auto-assign ALL supervisors and managers based on checklist location/name/department
    const autoAssigned = await getAutoAssignedUsers(auditor_id, checklist_id);
    
    const rosterData = {
      checklist_id,
      auditor_id,
      supervisor_id: JSON.stringify(autoAssigned.supervisors.map(s => s.id)),
      manager_id: JSON.stringify(autoAssigned.managers.map(m => m.id)),
      assigned_date: assigned_date || formatDate(new Date()),
      created_by: req.user.id
    };

    const rosterId = await Roster.createRosterAssignment(rosterData);
    
    // Create daily instance for THIS roster only
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const { formatDate } = require('../utils/dateFormatter');
    await DailyAssignmentService.createDailyInstancesFromRosters(formatDate(new Date()));
    
    res.status(201).json({
      message: 'Roster assignment created successfully',
      roster: { id: rosterId },
      auto_assigned: {
        supervisors: autoAssigned.supervisors.map(s => s.username),
        managers: autoAssigned.managers.map(m => m.username),
        assigned: {
          supervisors: autoAssigned.supervisors.map(s => s.username),
          managers: autoAssigned.managers.map(m => m.username)
        }
      }
    });
  } catch (error) {
    logger.error('Error creating roster assignment:', error);
    res.status(500).json({ error: 'Roster Creation Failed', details: error.message });
  }
};

const getRosters = async (req, res) => {
  try {
    const { user_id, date, page, limit, search } = req.query;
    const knex = require('../config/database');
    const RotationService = require('../services/RotationService');
    
    const currentPage = parseInt(page) || 1;
    const perPage = parseInt(limit) || 50;
    const offset = (currentPage - 1) * perPage;

    // Get rotation checklist IDs for read-only flag
    const rotationChecklistIds = await RotationService.getRotationChecklistIds();
    
    // Get ALL template checklists (exclude daily copies, not template checklists)
    const today = new Date().toISOString().split('T')[0];
    let baseQuery = knex('checklists')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('rosters', function() {
        this.on('rosters.checklist_id', 'checklists.id').andOn('rosters.is_active', knex.raw('1'));
      })
      .leftJoin('users as auditor_user', 'rosters.auditor_id', 'auditor_user.id')
      .where('checklists.is_active', true)
      .where('checklists.checklist_name', 'not like', '%-%-%User%')
      .whereNotExists(function() {
        this.select('*')
          .from('daily_checklist_instances')
          .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      });

    // If date is provided, filter checklists by the selected date
    if (date) {
      const dateObj = new Date(date);
      const formattedDateYYYYMMDD = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
      baseQuery = baseQuery.where(knex.raw('DATE(checklists.created_at)'), '<=', formattedDateYYYYMMDD);
    }

    // Search filter
    if (search) {
      const s = `%${search}%`;
      baseQuery = baseQuery.where(function() {
        this.where('checklists.checklist_name', 'like', s)
          .orWhere('locations.name', 'like', s)
          .orWhere('names.name', 'like', s)
          .orWhere('departments.name', 'like', s)
          .orWhere('auditor_user.username', 'like', s);
      });
    }

    // Get total count
    const [{ count: totalCount }] = await baseQuery.clone().count('checklists.id as count');
    const total = parseInt(totalCount);

    // Get paginated results
    const templateChecklists = await baseQuery.clone()
      .select(
        'checklists.id',
        'checklists.checklist_name',
        'checklists.status',
        'checklists.location_id',
        'checklists.name_id',
        'checklists.department_id',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name'
      )
      .orderBy('checklists.created_at', 'desc')
      .limit(perPage)
      .offset(offset);

      // Get roster assignments only for the checklists we're displaying (avoid full table scan)
       checklistIds = templateChecklists.map(c => c.id);
       const rosterAssignments = checklistIds.length
      ? await knex('rosters')
          .select('checklist_id', 'auditor_id', 'rosters.id as roster_id', 'assigned_date')
          .where('rosters.is_active', true)
          .whereIn('checklist_id', checklistIds)
      : [];

    let rosters;
    if (date) {
      const dateObj = new Date(date);
      const formattedDateYYYYMMDD = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;

      const dailyInstances = await knex('daily_checklist_instances as dci')
        .select(
          'dci.template_checklist_id as id',
          'dci.auditor_id',
          'dci.roster_id',
          'r.assigned_date'
        )
        .leftJoin('rosters as r', 'dci.roster_id', 'r.id')
        .where('dci.assigned_date', formattedDateYYYYMMDD);

      rosters = templateChecklists.map(checklist => {
        const dailyInstance = dailyInstances.find(di => di.id === checklist.id);
        // Fall back to roster assignment if no daily instance for that date
        const rosterAssignment = rosterAssignments.find(r => r.checklist_id === checklist.id);
        return {
          ...checklist,
          roster_id: dailyInstance?.roster_id || rosterAssignment?.roster_id || null,
          auditor_id: dailyInstance?.auditor_id ?? rosterAssignment?.auditor_id ?? null,
          assigned_date: dailyInstance?.assigned_date || rosterAssignment?.assigned_date || null,
          is_rotation: rotationChecklistIds.includes(checklist.id)
        };
      });
    } else {
      rosters = templateChecklists.map(checklist => {
        const assignment = rosterAssignments.find(r => r.checklist_id === checklist.id);
        return {
          ...checklist,
          roster_id: assignment?.roster_id || null,
          auditor_id: assignment?.auditor_id ?? null,
          assigned_date: assignment?.assigned_date || null,
          is_rotation: rotationChecklistIds.includes(checklist.id)
        };
      });
    }

    res.json({
      message: 'Rosters retrieved successfully',
      rosters,
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages: Math.ceil(total / perPage)
      }
    });
  } catch (error) {
    logger.error('Error retrieving rosters:', error);
    res.status(500).json({ error: 'Failed to fetch Roster', details: error.message });
  }
};

const getUserDashboard = async (req, res) => {
  // const { debugLog } = require('../utils/debugLogger');
  try {
    const { user_id } = req.params;
    const { fromDate, toDate } = req.query;
    const targetDate = new Date().toISOString().split('T')[0];

    const formattedStartDate = fromDate ? newFormatDate(fromDate) : targetDate;
    const formattedEndDate = toDate ? newFormatDate(toDate) : targetDate;

    // Get user role first
    const userRole = await User.findWithRole({ 'users.id': user_id });
    const roleName = userRole[0]?.role_name;
    
    // debugLog(`User role: ${roleName}`);
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    
    let pending = [];
    let completed = [];
    let auditorCompleted = [];
    
    if (roleName === 'Super Admin') {
      const db = require('../config/database');
      const totalResult = await db('checklists').whereNull('deleted_at').count('* as count').first();

      // Read-only: no instance creation, no rotation sync
      const allAssignments = await DailyAssignmentService.getDailyAssignmentsByRangeReadOnly(formattedStartDate, formattedEndDate);

      const pendingStatuses = ['assigned', 'awaiting_supervisor', 'awaiting_manager', 'Awaiting for NC response', 'Accepted by Supervisor', 'Pending Manager Verification'];
      const completedStatuses = ['completed', 'Completed', 'Completed without NCs'];

      const normalizedAssignments = allAssignments.map(a => ({
        ...a,
        status: a.status || a.instance_status || 'assigned'
      }));

      // Batch completion check (4 queries total instead of N*4)
      const checklistIds = [...new Set(normalizedAssignments.map(a => a.checklist_id))];
      const completedKeys = new Set();
      if (checklistIds.length > 0) {
        const [cdRows, srRows, mrRows, edRows] = await Promise.all([
          db('checklist_data').whereIn('checklist_id', checklistIds).where('submission_status', 'completed').select('checklist_id', 'user_id'),
          db('supervisor_reviews').whereIn('checklist_id', checklistIds).where('supervisor_status', 'Accepted').select('checklist_id', 'supervisor_id'),
          db('manager_reviews').whereIn('checklist_id', checklistIds).where('manager_status', '!=', 'Rejected').select('checklist_id', 'manager_id'),
          db('executive_data').whereIn('checklist_id', checklistIds).select('checklist_id', 'user_id')
        ]);
        cdRows.forEach(r => completedKeys.add(`${r.checklist_id}_${r.user_id}`));
        srRows.forEach(r => completedKeys.add(`${r.checklist_id}_${r.supervisor_id}`));
        mrRows.forEach(r => completedKeys.add(`${r.checklist_id}_${r.manager_id}`));
        edRows.forEach(r => completedKeys.add(`${r.checklist_id}_${r.user_id}`));
      }

      pending = normalizedAssignments.filter(a =>
        pendingStatuses.includes(a.status) && !(a.auditor_id && completedKeys.has(`${a.checklist_id}_${a.auditor_id}`))
      );

      completed = normalizedAssignments.filter(a => completedStatuses.includes(a.status));

      auditorCompleted = normalizedAssignments.filter(a =>
        a.auditor_id && !completedStatuses.includes(a.status) && completedKeys.has(`${a.checklist_id}_${a.auditor_id}`)
      );

    }
    
    else {
      // All other users get their specific daily assignments
      let userAssignments;
      try {
        userAssignments = await DailyAssignmentService.getDailyAssignmentsByUser(user_id, targetDate, formattedStartDate, formattedEndDate);
        // debugLog(`User ${user_id} (${roleName}) got ${userAssignments.length} assignments`);
      } catch (error) {
          logger.error('Error fetching user assignments:', error);
        throw error;
      }
      
      
      // Filter based on role and status - UPDATED LOGIC FOR DAILY ROTATION
      if (roleName === 'Business Head') {
        const knex = require('../config/database');
        const headUser = await knex('users').where('id', user_id).first();

        let locationIds = [];
        let nameIds = [];

         try {
          if (Array.isArray(headUser.location_id)) {
            locationIds = headUser.location_id;
          } else if (typeof headUser.location_id  === 'string') {
            locationIds = JSON.parse(headUser.location_id || '[]');
          } else if (typeof headUser.location_id === 'number') {
            locationIds = [headUser.location_id];
          } else if (headUser.location_id) {
            locationIds = [headUser.location_id];
          }
        } catch (e) {
          locationIds = headUser.location_id ? [headUser.location_id] : [];
        }
        
        if (!Array.isArray(locationIds)) {
          locationIds = locationIds ? [locationIds] : [];
        }

          try {
          if (Array.isArray(headUser.name_id)) {
            nameIds = headUser.name_id;
          } else if (typeof headUser.name_id  === 'string') {
            nameIds = JSON.parse(headUser.name_id || '[]');
          } else if (typeof headUser.name_id === 'number') {
            nameIds = [headUser.name_id];
          } else if (headUser.name_id) {
            nameIds = [headUser.name_id];
          }
        } catch (e) {
          nameIds = headUser.name_id ? [headUser.name_id] : [];
        }
        
        if (!Array.isArray(nameIds)) {
          nameIds = nameIds ? [nameIds] : [];
        }
        
        const isDateFiltered = !!(fromDate && toDate);
        const allAssignments = isDateFiltered 
          ? await DailyAssignmentService.getAllDailyAssignments(targetDate, formattedStartDate, formattedEndDate)
          : await DailyAssignmentService.getAllDailyAssignmentsUpToDate(formattedStartDate, formattedEndDate);
        
        const locationAssignments = allAssignments.filter(assignment => 
          locationIds.includes(assignment.location_id)).
          filter(assignment => nameIds.includes(assignment.name_id));

        // Batch fetch completion data
        const assignmentsWithAuditor = locationAssignments.filter(a => a.auditor_id);
        const checklistIds = assignmentsWithAuditor.map(a => a.checklist_id);
        
        const [supervisorReviews, managerReviews, checklistDataNC] = await Promise.all([
          checklistIds.length ? knex('supervisor_reviews').whereIn('checklist_id', checklistIds) : [],
          checklistIds.length ? knex('manager_reviews').whereIn('checklist_id', checklistIds) : [],
          checklistIds.length ? knex('checklist_data').whereIn('checklist_id', checklistIds).where('status', 'No').where('submission_status', 'completed') : []
        ]);
        
        // Build lookup maps
        const supervisorReviewMap = {};
        const rejectedItemsMap = {};
        const managerRejectedMap = {};
        const managerApprovedMap = {};
        const totalNCMap = {};
        const supervisorClosedMap = {};
        
        supervisorReviews.forEach(r => {
          if (!supervisorReviewMap[r.checklist_id]) supervisorReviewMap[r.checklist_id] = [];
          supervisorReviewMap[r.checklist_id].push(r);
          if (r.status === 'Open') rejectedItemsMap[r.checklist_id] = true;
          if (r.status === 'Close') supervisorClosedMap[r.checklist_id] = (supervisorClosedMap[r.checklist_id] || 0) + 1;
        });
        
        managerReviews.forEach(r => {
          if (r.manager_status === 'Rejected') managerRejectedMap[r.checklist_id] = (managerRejectedMap[r.checklist_id] || 0) + 1;
          if (r.manager_status === 'Approved') managerApprovedMap[r.checklist_id] = (managerApprovedMap[r.checklist_id] || 0) + 1;
        });
        
        checklistDataNC.forEach(d => {
          totalNCMap[d.checklist_id] = (totalNCMap[d.checklist_id] || 0) + 1;
        });

        let supervisorPending = [];
        let managerPending = [];
        
        const completionResults = await Promise.all(
          assignmentsWithAuditor.map(async (assignment) => {
            const hasCompletedData = await DailyAssignmentService.hasUserCompletedData(assignment.checklist_id, assignment.auditor_id);
            return { assignment, hasCompletedData };
          })
        );
        
        completionResults.forEach(({ assignment, hasCompletedData }) => {
          const completedStatuses = ['Pending Supervisor', 'completed'];
          const isFullyCompleted = completedStatuses.includes(assignment.status);
          
          if (assignment.status === 'Completed' || assignment.status === 'Completed without NCs') {
            auditorCompleted.push(assignment);
          }
          
          // Supervisor pending: auditor completed, awaiting supervisor review
          if (hasCompletedData && assignment.status !== 'Completed without NCs') {
            const anySupervisorReview = supervisorReviewMap[assignment.checklist_id]?.length > 0;
            const hasRejected = rejectedItemsMap[assignment.checklist_id] || false;
            const managerRejectedForSupervisor = (managerRejectedMap[assignment.checklist_id] || 0) > 0;
            const awaitingStatuses = ['awaiting_supervisor', 'awaiting for nc response', 'Awaiting for NC response', 'Pending by Supervisor'];
            
            if (awaitingStatuses.includes(assignment.status) && (hasRejected || !anySupervisorReview || managerRejectedForSupervisor)) {
              supervisorPending.push(assignment);
            }
            
            // Manager pending: supervisor closed, awaiting manager approval
            const totalNC = totalNCMap[assignment.checklist_id] || 0;
            const isSC = totalNC === 0;
            const anySupervisorClosed = (supervisorClosedMap[assignment.checklist_id] || 0) > 0;
            const hasManagerRejected = (managerRejectedMap[assignment.checklist_id] || 0) > 0;
            const allManagerApproved = !isSC && (managerApprovedMap[assignment.checklist_id] || 0) === totalNC;
            
            if ((isSC || anySupervisorClosed) && (hasManagerRejected || !allManagerApproved)) {
              managerPending.push(assignment);
            }
          }
        });
        
        pending = supervisorPending;
        completed = managerPending;
      }
      else if (roleName === 'Auditor' || roleName === 'Lead-Auditor') {
        pending = [];
        completed = [];
        
        // OPTIMIZED: Batch process auditor assignments
        const knex = require('../config/database');
        const auditorAssignments = userAssignments.filter(assignment => assignment.auditor_id == user_id);
        const templateIds = auditorAssignments.map(a => a.template_checklist_id).filter(Boolean);
        const dailyIds = auditorAssignments.map(a => a.checklist_id).filter(Boolean);
        
        if (auditorAssignments.length > 0) {
          // Fetch template checklist statuses/camera_count (keyed by template id)
          const templateStatuses = templateIds.length
            ? await knex('checklists').select('id', 'camera_count').whereIn('id', templateIds)
            : [];
          // Fetch daily checklist statuses (keyed by daily checklist id)
          const dailyStatuses = dailyIds.length
            ? await knex('checklists').select('id', 'status').whereIn('id', dailyIds)
            : [];

          const cameraCountMap = {};
          templateStatuses.forEach(item => { cameraCountMap[item.id] = item.camera_count; });

          const statusMap = {};
          dailyStatuses.forEach(item => { statusMap[item.id] = item.status; });

          // Add camera_count to assignments from template
          auditorAssignments.forEach(assignment => {
            assignment.camera_count = cameraCountMap[assignment.template_checklist_id] || null;
          });

          // Process assignments in parallel
          const assignmentPromises = auditorAssignments.map(async (assignment) => {
              // status comes from daily checklist (checklist_id = daily_checklist_id)
              const checklistStatus = statusMap[assignment.checklist_id];
              const hasCompletedData = await DailyAssignmentService.hasUserCompletedData(assignment.checklist_id, user_id);

              if (checklistStatus === 'Rejected by Supervisor') {
                return { type: 'pending', assignment };
              } else if (!hasCompletedData) {
                await DailyAssignmentService.resetDailyInstanceStatus(assignment.id);
                return { type: 'pending', assignment };
              } else {
                return { type: 'completed', assignment };
              }
            });
          
          const results = await Promise.all(assignmentPromises);
          pending = results.filter(r => r.type === 'pending').map(r => r.assignment);
          completed = results.filter(r => r.type === 'completed').map(r => r.assignment);
        }
        // logger.info('[DASHBOARD] Auditor result', { user_id, pending: pending.length, completed: completed.length });
      } else if (roleName === 'Supervisor') {
        const supervisorStartTime = Date.now();
        // logger.info('[PERF] Supervisor dashboard START', { user_id, timestamp: supervisorStartTime });
        
        pending = [];
        completed = [];
        
        const knex = require('../config/database');
        const supervisorUser = await knex('users').where('id', user_id).first();
        let supervisorDepartments = [];
        try {
          if (Array.isArray(supervisorUser.department_id)) {
            supervisorDepartments = supervisorUser.department_id;
          } else if (typeof supervisorUser.department_id === 'string') {
            supervisorDepartments = JSON.parse(supervisorUser.department_id || '[]');
          } else if (typeof supervisorUser.department_id === 'number') {
            supervisorDepartments = [supervisorUser.department_id];
          } else if (supervisorUser.department_id) {
            supervisorDepartments = [supervisorUser.department_id];
          }
        } catch (e) {
          supervisorDepartments = supervisorUser.department_id ? [supervisorUser.department_id] : [];
        }
        
        if (!Array.isArray(supervisorDepartments)) {
          supervisorDepartments = supervisorDepartments ? [supervisorDepartments] : [];
        }
        
        const isDateFiltered = !!(fromDate && toDate);
        
        // For PENDING: Get ALL past + today assignments OR filtered by date
        const allPastAssignments = isDateFiltered 
          ? await DailyAssignmentService.getAllDailyAssignments(targetDate, formattedStartDate, formattedEndDate)
          : await DailyAssignmentService.getAllDailyAssignmentsUpToDate(formattedStartDate, formattedEndDate);
        
        // OPTIMIZED: Process supervisor pending assignments in parallel
        const supervisorAssignments = allPastAssignments.filter(assignment => 
          assignment.location_id == supervisorUser.location_id &&
          assignment.name_id == supervisorUser.name_id &&
          supervisorDepartments.map(Number).includes(Number(assignment.department_id))
        );
        
        if (supervisorAssignments.length > 0) {
          const checklistIds = supervisorAssignments.map(a => a.checklist_id);
          
          // Batch fetch all required data
          const [supervisorReviews, managerReviews] = await Promise.all([
            knex('supervisor_reviews').whereIn('checklist_id', checklistIds),
            knex('manager_reviews').whereIn('checklist_id', checklistIds).where('manager_status', 'Rejected')
          ]);
          
          // Create lookup maps
          const supervisorReviewMap = {};
          const rejectedItemsMap = {};
          const managerRejectedMap = {};
          
          supervisorReviews.forEach(review => {
            if (!supervisorReviewMap[review.checklist_id]) supervisorReviewMap[review.checklist_id] = [];
            supervisorReviewMap[review.checklist_id].push(review);
            if (review.status === 'Open') {
              rejectedItemsMap[review.checklist_id] = true;
            }
          });
          
          managerReviews.forEach(review => {
            managerRejectedMap[review.checklist_id] = true;
          });
          
          // Process assignments in parallel
          const pendingPromises = supervisorAssignments.map(async (assignment) => {
            const supervisorIds = assignment.supervisor_id ? JSON.parse(assignment.supervisor_id) : [];
            const isAssignedToSupervisor = supervisorIds.includes(parseInt(user_id));
            
            if (isAssignedToSupervisor || supervisorDepartments.includes(assignment.department_id)) {
              const auditorHasCompletedData = await DailyAssignmentService.hasUserCompletedData(assignment.checklist_id, assignment.auditor_id);
              
              const anySupervisorReview = supervisorReviewMap[assignment.checklist_id]?.length > 0;
              const hasRejectedItems = rejectedItemsMap[assignment.checklist_id] || false;
              const managerRejectedForSupervisor = managerRejectedMap[assignment.checklist_id] || false;
              
              if (auditorHasCompletedData && 
                  (assignment.status === 'awaiting_supervisor' || 
                   assignment.status === 'awaiting for nc response' || 
                   assignment.status === 'Awaiting for NC response' || 
                   assignment.status === 'Pending by Supervisor') && 
                  (hasRejectedItems || !anySupervisorReview || managerRejectedForSupervisor)) {
                  return assignment;
              }
            }
            return null;
          });
          
          const pendingResults = await Promise.all(pendingPromises);
          pending = pendingResults.filter(result => result !== null);
        }
        
        // For COMPLETED: Get ALL assignments OR filtered by date
        let completedQuery = knex('daily_checklist_instances as dci')
          .select(
            'dci.*',
            'dci.daily_checklist_id as checklist_id',
            'dci.assigned_date',
            'dc.status as status',
            'tc.checklist_name',
            'tc.category_id',
            'tc.location_id',
            'tc.name_id',
            'tc.department_id',
            'tc.type as checklist_type',
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
          .where(function() {
            this.where(function() {
              this.where('tc.is_active', 1).whereNull('tc.deleted_at');
            })
            .orWhere(function() {
              this.whereNotNull('tc.deleted_at').whereRaw('DATE(dci.assigned_date) <= DATE(tc.deleted_at)');
            });
          })
          .whereRaw('DAYOFWEEK(dci.assigned_date) != 1');
        
        if (isDateFiltered) {
          completedQuery = completedQuery
            .where('dci.assigned_date', '>=', formattedStartDate)
            .where('dci.assigned_date', '<=', formattedEndDate);
        }
        
        const allCompletedAssignments = await completedQuery.orderBy('dci.assigned_date', 'desc');
        
        // OPTIMIZED: Process supervisor completed assignments in parallel
        const supervisorCompletedAssignments = allCompletedAssignments.filter(assignment => 
          assignment.location_id == supervisorUser.location_id &&
          assignment.name_id == supervisorUser.name_id &&
          supervisorDepartments.map(Number).includes(Number(assignment.department_id))
        );
        
        if (supervisorCompletedAssignments.length > 0) {
          const completedChecklistIds = supervisorCompletedAssignments.map(a => a.checklist_id);
          
          // Batch fetch all required data
          const [supervisorReviewsCompleted, checklistDataCompleted] = await Promise.all([
            knex('supervisor_reviews').whereIn('checklist_id', completedChecklistIds),
            knex('checklist_data')
              .whereIn('checklist_id', completedChecklistIds)
              .where('status', 'No')
              .where('submission_status', 'completed')
          ]);
          
          // Create lookup maps
          const supervisorReviewCompletedMap = {};
          const acceptedItemsMap = {};
          const totalNCItemsMap = {};
          
          supervisorReviewsCompleted.forEach(review => {
            if (!supervisorReviewCompletedMap[review.checklist_id]) supervisorReviewCompletedMap[review.checklist_id] = [];
            supervisorReviewCompletedMap[review.checklist_id].push(review);
            if (review.status === 'Close') {
              acceptedItemsMap[review.checklist_id] = (acceptedItemsMap[review.checklist_id] || 0) + 1;
            }
          });
          
          checklistDataCompleted.forEach(data => {
            totalNCItemsMap[data.checklist_id] = (totalNCItemsMap[data.checklist_id] || 0) + 1;
          });
          
          // Process assignments in parallel
          const completedPromises = supervisorCompletedAssignments.map(async (assignment) => {
            const supervisorIds = assignment.supervisor_id ? JSON.parse(assignment.supervisor_id) : [];
            const isAssignedToSupervisor = supervisorIds.includes(parseInt(user_id));
            
            if (isAssignedToSupervisor || supervisorDepartments.includes(assignment.department_id)) {
              const auditorHasCompletedData = await DailyAssignmentService.hasUserCompletedData(assignment.checklist_id, assignment.auditor_id);
              
              const anySupervisorReview = supervisorReviewCompletedMap[assignment.checklist_id]?.length > 0;
              const totalNCItems = totalNCItemsMap[assignment.checklist_id] || 0;
              const acceptedItems = acceptedItemsMap[assignment.checklist_id] || 0;
              
              const isSC = totalNCItems === 0;
              const allItemsAccepted = !isSC && acceptedItems === totalNCItems;
              
              const isCompletedWithoutNCs = assignment.status === 'Completed without NCs';
              if (auditorHasCompletedData && (isCompletedWithoutNCs || isSC || allItemsAccepted)) {
                logger.info('[DASHBOARD] Supervisor completed', { checklist_id: assignment.checklist_id, is_sc: isSC, without_nc: isCompletedWithoutNCs });
                return assignment;
              }
            }
            return null;
          });
          
          const completedResults = await Promise.all(completedPromises);
          completed = completedResults.filter(result => result !== null);
        }
        const supervisorEndTime = Date.now();
        const supervisorDuration = supervisorEndTime - supervisorStartTime;
      } 
      else if (roleName === 'Manager') {
        const managerStartTime = Date.now();
        
        pending = [];
        completed = [];
        
        const knex = require('../config/database');
        const managerUser = await knex('users').where('id', user_id).first();
        let managerDepartments = [];
        try {
          if (Array.isArray(managerUser.department_id)) {
            managerDepartments = managerUser.department_id;
          } else if (typeof managerUser.department_id === 'string') {
            managerDepartments = JSON.parse(managerUser.department_id || '[]');
          } else if (typeof managerUser.department_id === 'number') {
            managerDepartments = [managerUser.department_id];
          } else if (managerUser.department_id) {
            managerDepartments = [managerUser.department_id];
          }
        } catch (e) {
          managerDepartments = managerUser.department_id ? [managerUser.department_id] : [];
        }
        
        if (!Array.isArray(managerDepartments)) {
          managerDepartments = managerDepartments ? [managerDepartments] : [];
        }
        
        // Check if date filter is applied
        const isDateFiltered = !!(fromDate && toDate);
        
        const allPastAssignments = isDateFiltered 
          ? await DailyAssignmentService.getAllDailyAssignments(targetDate, formattedStartDate, formattedEndDate)
          : await DailyAssignmentService.getAllDailyAssignmentsUpToDate(formattedStartDate, formattedEndDate);
        
        // OPTIMIZED: Process manager pending assignments in parallel
        const managerAssignments = allPastAssignments.filter(assignment => 
          assignment.location_id == managerUser.location_id &&
          assignment.name_id == managerUser.name_id &&
          managerDepartments.map(Number).includes(Number(assignment.department_id))
        );
        
        if (managerAssignments.length > 0) {
          const managerChecklistIds = managerAssignments.map(a => a.checklist_id);
          const managerAuditorIds = managerAssignments.map(a => a.auditor_id).filter(id => id);
          
          // Batch fetch ALL required data including completion status
          const [checklistDataManager, managerReviewsManager, supervisorReviewsManager, completionDataManager] = await Promise.all([
            knex('checklist_data')
              .whereIn('checklist_id', managerChecklistIds)
              .where('status', 'No')
              .where('submission_status', 'completed'),
            knex('manager_reviews').whereIn('checklist_id', managerChecklistIds),
            knex('supervisor_reviews').whereIn('checklist_id', managerChecklistIds).where('status', 'Close'),
            knex('checklist_data')
              .whereIn('checklist_id', managerChecklistIds)
              .whereIn('user_id', managerAuditorIds)
              .where('submission_status', 'completed')
          ]);
          
          // Create lookup maps
          const totalNCItemsManagerMap = {};
          const managerRejectedItemsMap = {};
          const managerApprovedItemsMap = {};
          const supervisorClosedCountMap = {};
          const completionManagerMap = {};
          
          checklistDataManager.forEach(data => {
            totalNCItemsManagerMap[data.checklist_id] = (totalNCItemsManagerMap[data.checklist_id] || 0) + 1;
          });
          
          managerReviewsManager.forEach(review => {
            if (review.manager_status === 'Rejected') {
              managerRejectedItemsMap[review.checklist_id] = (managerRejectedItemsMap[review.checklist_id] || 0) + 1;
            } else if (review.manager_status === 'Approved') {
              managerApprovedItemsMap[review.checklist_id] = (managerApprovedItemsMap[review.checklist_id] || 0) + 1;
            }
          });
          
          supervisorReviewsManager.forEach(review => {
            supervisorClosedCountMap[review.checklist_id] = (supervisorClosedCountMap[review.checklist_id] || 0) + 1;
          });
          
          completionDataManager.forEach(data => {
            const key = `${data.checklist_id}_${data.user_id}`;
            completionManagerMap[key] = true;
          });
          
          // Process assignments synchronously using lookup maps
          managerAssignments.forEach(assignment => {
            const managerIds = assignment.manager_id ? JSON.parse(assignment.manager_id) : [];
            const isAssignedToManager = managerIds.includes(parseInt(user_id));
            
            if (isAssignedToManager || managerDepartments.includes(assignment.department_id)) {
              const completionKey = `${assignment.checklist_id}_${assignment.auditor_id}`;
              const auditorHasCompletedData = completionManagerMap[completionKey] || false;
              
              const totalNCItems = totalNCItemsManagerMap[assignment.checklist_id] || 0;
              const hasManagerRejectedItems = (managerRejectedItemsMap[assignment.checklist_id] || 0) > 0;
              const anyManagerApproved = managerApprovedItemsMap[assignment.checklist_id] || 0;
              const supervisorClosedCount = supervisorClosedCountMap[assignment.checklist_id] || 0;
              
              const isSC = totalNCItems === 0;
              const anySupervisorClosed = supervisorClosedCount > 0;
              const allManagerItemsApproved = !isSC && anyManagerApproved === totalNCItems;
              
              const alreadyFullyDone = isSC && !hasManagerRejectedItems;
              if (auditorHasCompletedData && (isSC || anySupervisorClosed) && (hasManagerRejectedItems || !allManagerItemsApproved) && !alreadyFullyDone && assignment.status !== 'Completed without NCs') {
                pending.push(assignment);
              }
            }
          });
        }
        
        // For COMPLETED: Get ALL assignments OR filtered by date
        let completedQueryManager = knex('daily_checklist_instances as dci')
          .select(
            'dci.*',
            'dci.daily_checklist_id as checklist_id',
            'dci.assigned_date',
            'dc.status as status',
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
          .where(function() {
            this.where(function() {
              this.where('tc.is_active', 1).whereNull('tc.deleted_at');
            })
            .orWhere(function() {
              this.whereNotNull('tc.deleted_at').whereRaw('DATE(dci.assigned_date) <= DATE(tc.deleted_at)');
            });
          })
          .whereRaw('DAYOFWEEK(dci.assigned_date) != 1');
        
        if (isDateFiltered) {
          completedQueryManager = completedQueryManager
              .where('dci.assigned_date', '>=', formattedStartDate)
              .where('dci.assigned_date', '<=', formattedEndDate);
        }
        
        const allCompletedAssignmentsManager = await completedQueryManager.orderBy('dci.assigned_date', 'desc');
        
        // OPTIMIZED: Process manager completed assignments in parallel
        const managerCompletedAssignments = allCompletedAssignmentsManager.filter(assignment => 
          assignment.location_id == managerUser.location_id &&
          assignment.name_id == managerUser.name_id &&
          managerDepartments.map(Number).includes(Number(assignment.department_id))
        );
        
        if (managerCompletedAssignments.length > 0) {
          const managerCompletedIds = managerCompletedAssignments.map(a => a.checklist_id);
          const managerCompletedAuditorIds = managerCompletedAssignments.map(a => a.auditor_id).filter(id => id);
          
          // Batch fetch ALL required data including completion status
          const [checklistDataManagerCompleted, supervisorReviewsManagerCompleted, managerReviewsManagerCompleted, completionDataManagerCompleted] = await Promise.all([
            knex('checklist_data')
              .whereIn('checklist_id', managerCompletedIds)
              .where('status', 'No')
              .where('submission_status', 'completed'),
            knex('supervisor_reviews').whereIn('checklist_id', managerCompletedIds).where('status', 'Close'),
            knex('manager_reviews').whereIn('checklist_id', managerCompletedIds).where('manager_status', 'Approved'),
            knex('checklist_data')
              .whereIn('checklist_id', managerCompletedIds)
              .whereIn('user_id', managerCompletedAuditorIds)
              .where('submission_status', 'completed')
          ]);
          
          // Create lookup maps
          const totalNCItemsManagerCompletedMap = {};
          const supervisorAcceptedItemsManagerMap = {};
          const managerApprovedItemsManagerMap = {};
          const completionManagerCompletedMap = {};
          
          checklistDataManagerCompleted.forEach(data => {
            totalNCItemsManagerCompletedMap[data.checklist_id] = (totalNCItemsManagerCompletedMap[data.checklist_id] || 0) + 1;
          });
          
          supervisorReviewsManagerCompleted.forEach(review => {
            supervisorAcceptedItemsManagerMap[review.checklist_id] = (supervisorAcceptedItemsManagerMap[review.checklist_id] || 0) + 1;
          });
          
          managerReviewsManagerCompleted.forEach(review => {
            managerApprovedItemsManagerMap[review.checklist_id] = (managerApprovedItemsManagerMap[review.checklist_id] || 0) + 1;
          });
          
          completionDataManagerCompleted.forEach(data => {
            const key = `${data.checklist_id}_${data.user_id}`;
            completionManagerCompletedMap[key] = true;
          });
          
          // Process assignments synchronously using lookup maps
          managerCompletedAssignments.forEach(assignment => {
            const managerIds = assignment.manager_id ? JSON.parse(assignment.manager_id) : [];
            const isAssignedToManager = managerIds.includes(parseInt(user_id));
            
            if (isAssignedToManager || managerDepartments.includes(assignment.department_id)) {
              const completionKey = `${assignment.checklist_id}_${assignment.auditor_id}`;
              const auditorHasCompletedData = completionManagerCompletedMap[completionKey] || false;
              
              const totalNCItems = totalNCItemsManagerCompletedMap[assignment.checklist_id] || 0;
              const supervisorAcceptedItems = supervisorAcceptedItemsManagerMap[assignment.checklist_id] || 0;
              const managerApprovedItems = managerApprovedItemsManagerMap[assignment.checklist_id] || 0;
              
              const isSC = totalNCItems === 0;
              const allSupervisorItemsAccepted = !isSC && supervisorAcceptedItems === totalNCItems;
              const allManagerItemsApproved = !isSC && managerApprovedItems === totalNCItems;
              
              const isCompletedWithoutNCs = assignment.status === 'Completed without NCs';
              if (auditorHasCompletedData && (isCompletedWithoutNCs || isSC || (allSupervisorItemsAccepted && allManagerItemsApproved))) {
                completed.push(assignment);
              }
            }
          });
        }
        const managerEndTime = Date.now();
        const managerDuration = managerEndTime - managerStartTime;
      }
    }
    
    const dashboard = {
      date: targetDate,
      role: roleName,
      assignments: {
        pending,
        completed,
        ...(roleName === 'Super Admin' && { auditorCompleted }),
        ...(roleName === 'Business Head' && { auditorCompleted })
      },
      total_pending: pending.length,
      total_completed: completed.length,
      ...(roleName === 'Super Admin' && { total_auditor_completed: auditorCompleted.length }),
      ...(roleName === 'Business Head' && { total_auditor_completed: auditorCompleted.length }),
      ...(roleName === 'Business Head' && { total_supervisor_pending: pending.length, total_manager_pending: completed.length })
    };

    res.json({
      message: 'User dashboard retrieved successfully',
      dashboard
    });
  } catch (error) {
    logger.error('Error retrieving user dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch Dashboard', details: error.message });
  }
};

const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || formatDate(new Date());
    
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    
    // Get all daily assignments for the date
    const dailyInstances = await DailyAssignmentService.getAllDailyAssignments(targetDate);
    
    // Calculate counts
    const totalAssigned = dailyInstances.length;
    const totalCompleted = dailyInstances.filter(instance => 
      instance.status === 'Completed' || instance.status === 'Completed without NCs'
    ).length;
    const totalPending = totalAssigned - totalCompleted;
    
    const dailyCounts = {
      total_assigned: totalAssigned,
      total_completed: totalCompleted,
      total_pending: totalPending,
      completion_rate: totalAssigned > 0 ? ((totalCompleted / totalAssigned) * 100).toFixed(2) : 0
    };
    
    res.json({
      message: 'Daily report retrieved successfully',
      date: targetDate,
      counts: dailyCounts,
      instances: dailyInstances
    });
  } catch (error) {
    logger.error('Error retrieving daily report:', error);
    res.status(500).json({ error: 'Failed to fetch Report', details: error.message });
  }
};

const bulkAssignRoster = async (req, res) => {
  try {
    const { assignments, assigned_date } = req.body;
    const targetDate = assigned_date || formatDate(new Date());
    
    const results = [];
    for (const assignment of assignments) {
      const rosterData = {
        ...assignment,
        assigned_date: targetDate,
        created_by: req.user.id
      };
      const result = await Roster.createRosterAssignment(rosterData);
      results.push(result);
    }

    res.json({
      message: 'Bulk roster assignments created successfully',
      assignments: results
    });
  } catch (error) {
    logger.error('Error creating bulk roster assignments:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.findWithRole({ 'users.is_active': true });
    
    const usersByRole = {
      auditors: users.filter(u => u.role_name === 'Auditor'),
      managers: users.filter(u => u.role_name === 'Manager'),
      supervisors: users.filter(u => u.role_name === 'Supervisor'),
      all: users
    };

    res.json({
      message: 'Users retrieved successfully',
      users: usersByRole
    });
  } catch (error) {
    logger.error('Error retrieving users:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
};

const getChecklists = async (req, res) => {
  try {
    const checklists = await Checklist.getChecklistsWithDetails({ 'checklists.is_active': 1 });
    
    res.json({
      message: 'Checklists retrieved successfully',
      checklists
    });
  } catch (error) {
    logger.error('checklists retrieved error:', error.message)
    res.status(500).json({ error: 'Failed to fetch checklist' , details:error.message });
  }
};

const manualAssignRoster = async (req, res) => {
  try {
    const { checklist_id, roster_id, auditor_id, assigned_date } = req.body;

    // Block if checklist is managed by rotation roster
    const RotationService = require('../services/RotationService');
    const rotationIds = await RotationService.getRotationChecklistIds();
    if (rotationIds.includes(parseInt(checklist_id))) {
      return res.status(403).json({ error: 'This checklist is managed by Rotation Roster' });
    }

    
    const knex = require('../config/database');
    const DailyAssignmentService = require('../services/DailyAssignmentService');
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;
    
    // Check existing roster by checklist_id (including inactive)
    const existingRoster = await knex('rosters')
      .where('checklist_id', checklist_id)
      .first();
    const actualRosterId = existingRoster ? existingRoster.id : null;

    if (!auditor_id) {
      logger.info('[ASSIGN] auditor_id is null/empty → UNASSIGN flow', { checklist_id, actualRosterId });
      if (actualRosterId) {
        await knex.transaction(async (trx) => {
          // Delete TODAY's instance only (keep daily checklist)
          const todayInstance = await trx('daily_checklist_instances')
            .where('roster_id', actualRosterId)
            .where('assigned_date', formattedToday)
            .first();
          
          if (todayInstance) {
            await trx('daily_checklist_instances').where('id', todayInstance.id).update({
              'status' : 'Unassigned',
              'auditor_id' : null,
              'updated_at': new Date()
            });
          }
          
          await trx('rosters').where('id', actualRosterId).update(
            {
              'is_active': 0,
              'auditor_id': null,
              'updated_at': new Date()
            }
          );
        });
      } else {
        logger.info('[ASSIGN] No existing roster to delete for checklist', { checklist_id });
      }
      logger.info('[ASSIGN] UNASSIGN complete', { checklist_id });
      return res.json({ message: 'Auditor assignment removed successfully' });
    }
    
    const { getAutoAssignedUsers } = require('../utils/userService');
    const autoAssigned = await getAutoAssignedUsers(auditor_id, checklist_id);

    const supervisorIdJson = JSON.stringify(autoAssigned.supervisors.map(s => s.id));
    const managerIdJson = JSON.stringify(autoAssigned.managers.map(m => m.id));
    logger.info('[ASSIGN] IDs to store in DB', { supervisor_id: supervisorIdJson, manager_id: managerIdJson });

    const rosterData = {
      checklist_id,
      auditor_id,
      supervisor_id: supervisorIdJson,
      manager_id: managerIdJson,
      assigned_date: assigned_date || formatDate(new Date()),
      created_by: req.user.id,
      is_active: 1,
      updated_at: new Date()
    };
    
    await knex.transaction(async (trx) => {
      if (actualRosterId) {
        const oldRoster = await trx('rosters').where('id', actualRosterId).first();
        const oldAuditorId = oldRoster ? oldRoster.auditor_id : null;
        logger.info('[ASSIGN] Updating existing roster', { roster_id: actualRosterId, old_auditor_id: oldAuditorId, new_auditor_id: auditor_id });
        
        await trx('rosters').where('id', actualRosterId).update(rosterData);

        // Update or create TODAY's instance
        const todayInstance = await trx('daily_checklist_instances')
          .where('roster_id', actualRosterId)
          .where('assigned_date', formattedToday)
          .first();
        
        if (todayInstance) {
          // Update existing instance
          await trx('daily_checklist_instances')
            .where('id', todayInstance.id)
            .update({ auditor_id, updated_at: new Date() });
          
          // Update daily checklist's assigned_auditor_id
          await trx('checklists')
            .where('id', todayInstance.daily_checklist_id)
            .update({ assigned_auditor_id: auditor_id, updated_at: new Date() });

          // Transfer existing checklist_data from old auditor to new auditor
          if (oldAuditorId && oldAuditorId !== auditor_id) {
            await trx('checklist_data')
              .where('checklist_id', todayInstance.daily_checklist_id)
              .where('user_id', oldAuditorId)
              .update({ user_id: auditor_id, updated_at: new Date() });
          }
          
        } else {
          logger.info('[ASSIGN] No today instance found, creating new daily instance', { checklist_id, auditor_id, roster_id: actualRosterId });
          await DailyAssignmentService.createDailyChecklistInstanceFromRoster(
            checklist_id,
            auditor_id,
            actualRosterId,
            formattedToday
          );
        }
      } else {
        rosterData.created_at = new Date();
        const [newRosterId] = await trx('rosters').insert(rosterData);
        logger.info('[ASSIGN] New roster inserted', { roster_id: newRosterId, checklist_id, auditor_id, supervisor_id: supervisorIdJson, manager_id: managerIdJson });

        // Check if there's an existing instance for today (from previous assignment)
        const existingTodayInstance = await trx('daily_checklist_instances')
          .where('template_checklist_id', checklist_id)
          .where('assigned_date', formattedToday)
          .first();
        
        if (existingTodayInstance) {
          const oldInstanceAuditorId = existingTodayInstance.auditor_id;

          // Update existing instance with new roster and auditor
          await trx('daily_checklist_instances')
            .where('id', existingTodayInstance.id)
            .update({ 
              roster_id: newRosterId, 
              auditor_id, 
              updated_at: new Date() 
            });
          
          // Update daily checklist's assigned_auditor_id
          await trx('checklists')
            .where('id', existingTodayInstance.daily_checklist_id)
            .update({ assigned_auditor_id: auditor_id, updated_at: new Date() });

          // Transfer existing checklist_data from old auditor to new auditor
          if (oldInstanceAuditorId && oldInstanceAuditorId !== auditor_id) {
            await trx('checklist_data')
              .where('checklist_id', existingTodayInstance.daily_checklist_id)
              .where('user_id', oldInstanceAuditorId)
              .update({ user_id: auditor_id, updated_at: new Date() });
          }
          
        } else {
          // Check for orphaned daily checklist (without instance) for TODAY only
          const templateChecklist = await trx('checklists').where('id', checklist_id).first();
          const orphanedDaily = await trx('checklists')
            .where('checklist_name', 'like', `${templateChecklist.checklist_name} - ${formattedToday}%`)
            .whereNotExists(function() {
              this.select('*').from('daily_checklist_instances')
                .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
            })
            .first();
          
          if (orphanedDaily) {
            // Reuse orphaned daily checklist — sync latest template data
            const templateChecklist2 = await trx('checklists').where('id', checklist_id).first();
            await trx('checklists')
              .where('id', orphanedDaily.id)
              .update({
                category_id: templateChecklist2.category_id,
                location_id: templateChecklist2.location_id,
                department_id: templateChecklist2.department_id,
                name_id: templateChecklist2.name_id,
                camera_count: templateChecklist2.camera_count,
                frequency: templateChecklist2.frequency,
                audit_count: templateChecklist2.audit_count,
                alert_time: templateChecklist2.alert_time,
                type: templateChecklist2.type,
                assigned_auditor_id: auditor_id,
                updated_at: new Date()
              });

            // Sync items from template
            const templateItems = await trx('checklist_items').where('checklist_id', checklist_id);
            if (templateItems.length > 0) {
              await trx('checklist_items').where('checklist_id', orphanedDaily.id).del();
              await trx('checklist_items').insert(templateItems.map(item => ({
                checklist_id: orphanedDaily.id,
                type: item.type,
                activities: item.activities,
                process: item.process,
                criticality: item.criticality,
                status: item.status,
                created_at: new Date(),
                updated_at: new Date()
              })));
            }

            // Create instance pointing to it
            await trx('daily_checklist_instances').insert({
              template_checklist_id: checklist_id,
              roster_id: newRosterId,
              auditor_id,
              assigned_date: formattedToday,
              daily_checklist_id: orphanedDaily.id,
              daily_key: `${checklist_id}_${auditor_id}_${formattedToday}`,
              status: 'assigned',
              created_at: new Date(),
              updated_at: new Date()
            });
            
          } else {
            await DailyAssignmentService.createDailyChecklistInstanceFromRoster(
              checklist_id,
              auditor_id,
              newRosterId,
              formattedToday
            );
          }
        }
      }
    });

    
    res.json({
      message: 'Roster assignment updated successfully',
      auto_assigned: {
        supervisor: autoAssigned.supervisors.map(s => s.username).join(', '),
        manager: autoAssigned.managers.map(m => m.username).join(', ')
      }
    });
  } catch (error) {
    logger.error(' MANUAL ASSIGN ROSTER ERROR', error);
    res.status(500).json({ error: 'Roster Assignment Failed', details: error.message });
  }
};

const createUnassignedDailyInstances = async (targetDate) => {

  const knex = require('../config/database');
  const DailyAssignmentService = require('../services/DailyAssignmentService');

  // Find all rosters with no auditor that have no instance for targetDate
  // AND whose template checklist is active (is_active=1, deleted_at IS NULL)
  const unassignedRosters = await knex('rosters')
    .join('checklists', 'rosters.checklist_id', 'checklists.id')
    .where('checklists.is_active', 1)
    .whereNull('checklists.deleted_at')
    .where(function() {
      this.whereNull('rosters.auditor_id').orWhere('rosters.auditor_id', 0);
    })
    .whereNotExists(function () {
      this.select('*')
        .from('daily_checklist_instances')
        .whereRaw('daily_checklist_instances.roster_id = rosters.id')
        .where('daily_checklist_instances.assigned_date', targetDate);
    })
    .select('rosters.*');


  await Promise.all(
    unassignedRosters.map(roster =>
      DailyAssignmentService.createDailyChecklistInstanceFromRoster(
        roster.checklist_id,
        null, // No auditor
        roster.id,
        targetDate
      )
      .then(instance => logger.info('[LEAD] Instance created/found', { roster_id: roster.id, checklist_id: roster.checklist_id, instance_id: instance?.id, daily_checklist_id: instance?.daily_checklist_id }))
      .catch(err => logger.error('[LEAD] Failed to create unassigned instance', { roster_id: roster.id, checklist_id: roster.checklist_id, error: err.message }))
    )
  );

};

const getLeadAuditorDashboard = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const knex = require('../config/database');
    const today = new Date().toISOString().split('T')[0];
    const formattedStartDate = fromDate ? newFormatDate(fromDate) : today;
    const formattedEndDate = toDate ? newFormatDate(toDate) : today;

    // Ensure unassigned roster instances exist for the requested date range
    await createUnassignedDailyInstances(today);

    const instances = await knex('daily_checklist_instances as dci')
      .select(
        'dci.*',
        'dci.daily_checklist_id as checklist_id',
        'dci.status as instance_status',
        'dc.status as status',
        'tc.checklist_name',
        'tc.category_id',
        'tc.location_id',
        'tc.name_id',
        'tc.department_id',
        'cat.name as category_name',
        'l.name as location_name',
        'd.name as department_name',
        'n.name as facility_name'
      )
      .leftJoin('checklists as dc', 'dci.daily_checklist_id', 'dc.id')
      .leftJoin('checklists as tc', 'dci.template_checklist_id', 'tc.id')
      .leftJoin('categories as cat', 'tc.category_id', 'cat.id')
      .leftJoin('locations as l', 'tc.location_id', 'l.id')
      .leftJoin('departments as d', 'tc.department_id', 'd.id')
      .leftJoin('names as n', 'tc.name_id', 'n.id')
      .where(function() {
        this.whereNull('dci.auditor_id').orWhere('dci.auditor_id', 0);
      })
      .whereBetween('dci.assigned_date', [formattedStartDate, formattedEndDate])
      .orderBy('dci.assigned_date', 'desc');

    const completedStatuses = ['completed', 'Completed', 'Completed without NCs'];
    const pending = instances.filter(i => i.instance_status === 'unassigned');
    const completed = instances.filter(i => completedStatuses.includes(i.status || i.instance_status));

    res.json({
      message: 'Lead auditor dashboard retrieved successfully',
      dashboard: {
        date: today,
        role: 'Lead-Auditor',
        assignments: { pending, completed },
        total_pending: pending.length,
        total_completed: completed.length
      }
    });
  } catch (error) {
    logger.error('Error retrieving lead auditor dashboard:', error);
    res.status(500).json({ error: 'Failed to Fetch Dashboard', details: error.message });
  }
};

const getRandomChecklists = async (req, res) => {
  try {
    const { page, limit, search, date } = req.query;
    const knex = require('../config/database');
    
    const currentPage = parseInt(page) || 1;
    const perPage = parseInt(limit) || 50;
    const offset = (currentPage - 1) * perPage;
    
    let baseQuery = knex('checklists')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('rosters', function() {
        this.on('rosters.checklist_id', 'checklists.id').andOn('rosters.is_active', knex.raw('1'));
      })
      .where('checklists.is_active', true)
      .where('checklists.checklist_name', 'not like', '%-%-%User%')
      .whereNotExists(function() {
        this.select('*')
          .from('daily_checklist_instances')
          .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      })
      .where(function() {
        this.whereNull('rosters.id').orWhereNull('rosters.auditor_id');
      })
      // Exclude checklists that have a temp swap for today (they are assigned temporarily)
      .whereNotExists(function() {
        this.select('*')
          .from('rotation_temp_swaps')
          .join('rotation_checklists', 'rotation_temp_swaps.rotation_checklist_id', 'rotation_checklists.id')
          .whereRaw('rotation_checklists.checklist_id = checklists.id')
          .where('rotation_temp_swaps.swap_date', knex.raw('CURDATE()'));
      });

    if (date) {
      const dateObj = new Date(date);
      const formattedDateYYYYMMDD = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
      baseQuery = baseQuery.where(knex.raw('DATE(checklists.created_at)'), '<=', formattedDateYYYYMMDD);
    }

    if (search) {
      const s = `%${search}%`;
      baseQuery = baseQuery.where(function() {
        this.where('checklists.checklist_name', 'like', s)
          .orWhere('locations.name', 'like', s)
          .orWhere('names.name', 'like', s)
          .orWhere('departments.name', 'like', s);
      });
    }

    const [{ count: totalCount }] = await baseQuery.clone().count('checklists.id as count');
    const total = parseInt(totalCount);

    const rosters = await baseQuery.clone()
      .select(
        'checklists.id',
        'checklists.checklist_name',
        'checklists.status',
        'checklists.location_id',
        'checklists.name_id',
        'checklists.department_id',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name',
        'rosters.id as roster_id'
      )
      .orderBy('checklists.created_at', 'desc')
      .limit(perPage)
      .offset(offset);

    const result = rosters.map(c => ({
      ...c,
      auditor_id: null,
      assigned_date: null
    }));

    res.json({
      message: 'Random checklists retrieved successfully',
      rosters: result,
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages: Math.ceil(total / perPage)
      }
    });
  } catch (error) {
    logger.error('Error retrieving random checklists:', error);
    res.status(500).json({ error: 'Failed to fetch unselect checklist', details: error.message });
  }
};

const getCompletedChecklistsByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const knex = require('../config/database');

    const results = await knex('daily_checklist_instances as dci')
      .select(
        'dci.daily_checklist_id as checklist_id',
        'dci.auditor_id',
        'tc.checklist_name',
        'u.username as auditor_name',
        'u.employee_id as emp_id',
        'l.name as location_name',
        'dc.total_camera_audited as camera_audited',
        'dc.total_camera_not_audited as camera_not_audited'
      )
      .leftJoin('checklists as dc', 'dci.daily_checklist_id', 'dc.id')
      .leftJoin('checklists as tc', 'dci.template_checklist_id', 'tc.id')
      .leftJoin('users as u', 'dci.auditor_id', 'u.id')
      .leftJoin('locations as l', 'tc.location_id', 'l.id')
      .where('dci.assigned_date', date)
      .whereExists(function() {
        this.select('*').from('checklist_data')
          .whereRaw('checklist_data.checklist_id = dci.daily_checklist_id')
          .where('checklist_data.submission_status', 'completed');
      })
      .orderBy('tc.checklist_name', 'asc');

    res.json({ message: 'Completed checklists retrieved', checklists: results });
  } catch (error) {
    logger.error('Error fetching completed checklists by date:', error);
    res.status(500).json({ error: 'Failed to fetch completed checklists', details: error.message });
  }
};

module.exports = {
  createRoster,
  getRosters,
  getRandomChecklists,
  getLeadAuditorDashboard,
  getUserDashboard,
  getDailyReport,
  bulkAssignRoster,
  getUsers,
  getChecklists,
  manualAssignRoster,
  getCompletedChecklistsByDate
};
