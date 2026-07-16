const knex = require('../config/database');
class DashboardService {
  static async getByRole(userId, role, date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const handlers = {
      'Auditor': () => this.getAuditorData(userId, targetDate),
      'Supervisor': () => this.getSupervisorData(userId),
      'Manager': () => this.getManagerData(userId),
      'Lead-Auditor': () => this.getAuditorData(userId, targetDate),
      'Super Admin': () => this.getSuperAdminData(userId, targetDate)
    };
    
    const pending = await (handlers[role]?.() || []);
    const completed = await this.getCompletedByRole(userId, role.toLowerCase(), targetDate);
    
    return {
      pending,
      completed,
      total_pending: pending.length,
      total_completed: completed.length
    };
  }

  static async getAuditorData(userId, date = null) {
    if (date) {
      // Convert formatted date (26-Dec-2025) to MySQL date (2025-12-26)
      let mysqlDate;
      try {
        if (date.includes('-') && date.includes('Dec')) {
          const parts = date.split('-');
          const months = {'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
                         'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'};
          mysqlDate = `${parts[2]}-${months[parts[1]]}-${parts[0].padStart(2, '0')}`;
        } else {
          mysqlDate = new Date(date).toISOString().split('T')[0];
        }
      } catch (e) {
        mysqlDate = date;
      }
      
      // Use original roster query for auditor - don't change existing flow
      const results = await knex('rosters')
        .select(
          'rosters.id',
          'rosters.checklist_id',
          'rosters.assigned_date',
          'checklists.checklist_name',
          'checklists.status',
          'locations.name as location_name',
          'names.name as facility_name',
          'departments.name as department_name'
        )
        .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
        .leftJoin('locations', 'checklists.location_id', 'locations.id')
        .leftJoin('names', 'checklists.name_id', 'names.id')
        .leftJoin('departments', 'checklists.department_id', 'departments.id')
        .leftJoin('checklist_data', function() {
          this.on('checklist_data.checklist_id', '=', 'rosters.checklist_id')
              .andOn('checklist_data.user_id', '=', 'rosters.auditor_id');
        })
        .where('rosters.is_active', true)
        .where('rosters.auditor_id', userId)
        .where('rosters.assigned_date', mysqlDate)
        .groupBy('checklists.id')
        .where(function() {
          this.whereNull('checklist_data.id')
            .orWhere('checklist_data.submission_status', 'draft')
            .orWhereNull('checklists.status')
            .orWhere('checklists.status', '')
            .orWhere('checklists.status', 'Draft')
            .orWhere('checklists.status', 'Rejected by Supervisor');
        });
      
      return results;
    }
    
    // Fallback to original roster query
    const results = await knex('rosters')
      .select(
        'rosters.id',
        'rosters.checklist_id',
        'rosters.assigned_date',
        'checklists.checklist_name',
        'checklists.status',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name'
      )
      .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('checklist_data', function() {
        this.on('checklist_data.checklist_id', '=', 'rosters.checklist_id')
            .andOn('checklist_data.user_id', '=', 'rosters.auditor_id');
      })
      .where('rosters.is_active', true)
      .where('rosters.auditor_id', userId)
      .groupBy('checklists.id')
      .where(function() {
        this.whereNull('checklist_data.id')
          .orWhere('checklist_data.submission_status', 'draft')
          .orWhereNull('checklists.status')
          .orWhere('checklists.status', '')
          .orWhere('checklists.status', 'Draft')
          .orWhere('checklists.status', 'Rejected by Supervisor');
      });
    
    return results;
  }

  static async getSupervisorData(userId) {
    const DailyAssignmentService = require('./DailyAssignmentService');
    const today = new Date();
    const formattedToday = `${today.getDate().toString().padStart(2, '0')}-${today.toLocaleDateString('en-US', { month: 'short' })}-${today.getFullYear()}`;
    
    // debugLog('=== SUPERVISOR PENDING DASHBOARD ===');
    // debugLog('User ID:', userId);
    // debugLog('Date:', formattedToday);
    
    // Get supervisor's departments
    const user = await knex('users').where('id', userId).first();
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
    // debugLog('Supervisor departments:', supervisorDepartments);
    
    // Get all daily assignments for today
    const allAssignments = await DailyAssignmentService.getAllDailyAssignments(formattedToday);
    // debugLog('All assignments count:', allAssignments.length);
    
    // Filter assignments where:
    // 1. User is assigned as supervisor (supervisor_id contains userId), OR
    // 2. Checklist department matches supervisor's departments
    const supervisorAssignments = allAssignments.filter(assignment => {
      // Check if assigned as supervisor
      let isAssignedSupervisor = false;
      if (assignment.supervisor_id) {
        try {
          const supervisorIds = JSON.parse(assignment.supervisor_id);
          isAssignedSupervisor = supervisorIds.includes(userId);
        } catch (e) {}
      }
      
      // Check if checklist department matches supervisor's departments
      const checklistDepartmentId = assignment.department_id;
      const isDepartmentMatch = supervisorDepartments.includes(checklistDepartmentId);
      
      // debugLog(`Checklist ${assignment.checklist_id} - Dept: ${checklistDepartmentId}, Assigned: ${isAssignedSupervisor}, Dept Match: ${isDepartmentMatch}`);
      
      return isAssignedSupervisor || isDepartmentMatch;
    });
    
    // debugLog('Supervisor assignments count:', supervisorAssignments.length);
    
    // Filter for pending assignments (awaiting supervisor or assigned with rejected items)
    const pendingAssignments = supervisorAssignments.filter(assignment => {
      const isPending = assignment.status === 'awaiting_supervisor' || assignment.status === 'assigned';
      // debugLog(`Checklist ${assignment.checklist_id} - Status: ${assignment.status}, Is Pending: ${isPending}`);
      return isPending;
    });
    
    // debugLog('Pending assignments count:', pendingAssignments.length);
    // debugLog('=== END SUPERVISOR PENDING ===');
    
    return pendingAssignments.map(assignment => ({
      id: assignment.id,
      checklist_id: assignment.checklist_id,
      checklist_name: assignment.checklist_name,
      status: assignment.status,
      location_name: assignment.location_name,
      facility_name: assignment.facility_name,
      department_name: assignment.department_name
    }));
  }

  static async getManagerData(userId) {
    // Get manager's location
    const user = await knex('users').where('id', userId).first();
    
    return knex('checklists')
      .select(
        'checklists.id as checklist_id',
        'checklists.checklist_name',
        'checklists.status',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name'
      )
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('checklist_items', 'checklists.id', 'checklist_items.checklist_id')
      .where('checklists.location_id', user.location_id)
      .where('checklist_items.type', 'NSC')
      .whereIn('checklists.status', ['Pending Manager Verification'])
      .groupBy('checklists.id');
  }

  static async getSuperAdminData(userId, date = null) {
    // Super Admin sees all pending assignments for the selected date
    let query = knex('rosters')
      .select(
        'rosters.id',
        'rosters.checklist_id',
        'rosters.assigned_date',
        'checklists.checklist_name',
        'checklists.status',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name'
      )
      .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .where('rosters.is_active', true);
    
    // Add date filter if provided
    if (date) {
      let mysqlDate;
      try {
        if (date.includes('-') && (date.includes('Dec') || date.includes('Jan') || date.includes('Feb'))) {
          const parts = date.split('-');
          const months = {'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
                         'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'};
          mysqlDate = `${parts[2]}-${months[parts[1]]}-${parts[0].padStart(2, '0')}`;
        } else {
          mysqlDate = new Date(date).toISOString().split('T')[0];
        }
      } catch (e) {
        mysqlDate = date;
      }
      query = query.where('rosters.assigned_date', mysqlDate);
    }
    
    return query
      .where(function() {
        this.whereNull('checklists.status')
          .orWhere('checklists.status', '')
          .orWhere('checklists.status', 'Draft')
          .orWhere('checklists.status', 'Rejected by Supervisor')
          .orWhere('checklists.status', 'Awaiting for NC response'); // Show as pending until supervisor done
      })
      .limit(50);
  }

  static async getCompletedByRole(userId, role, date = null) {
    const statusMap = {
      'auditor': ['Awaiting for NC response', 'Accepted by Supervisor', 'Completed by Supervisor', 'Completed', 'Completed without NCs'],
      'supervisor': ['Completed', 'Completed without NCs'],
      'manager': ['Completed', 'Completed without NCs'],
      'super admin': ['Completed', 'Completed without NCs']
    };

    if (role === 'supervisor') {
      const DailyAssignmentService = require('./DailyAssignmentService');
      const today = new Date();
      const formattedToday = `${today.getDate().toString().padStart(2, '0')}-${today.toLocaleDateString('en-US', { month: 'short' })}-${today.getFullYear()}`;
      
      // debugLog('=== SUPERVISOR COMPLETED DASHBOARD ===');
      // debugLog('User ID:', userId);
      // debugLog('Date:', formattedToday);
      
      // Get supervisor's departments
      const user = await knex('users').where('id', userId).first();
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
      // debugLog('Supervisor departments:', supervisorDepartments);
      
      // Get all daily assignments for today
      const allAssignments = await DailyAssignmentService.getAllDailyAssignments(formattedToday);
      // debugLog('All assignments count:', allAssignments.length);
      
      // Filter assignments where:
      // 1. User is assigned as supervisor (supervisor_id contains userId), OR
      // 2. Checklist department matches supervisor's departments
      const supervisorAssignments = allAssignments.filter(assignment => {
        let isAssignedSupervisor = false;
        if (assignment.supervisor_id) {
          try {
            const supervisorIds = JSON.parse(assignment.supervisor_id);
            isAssignedSupervisor = supervisorIds.includes(userId);
          } catch (e) {}
        }
        
        const checklistDepartmentId = assignment.department_id;
        const isDepartmentMatch = supervisorDepartments.includes(checklistDepartmentId);
        
        return isAssignedSupervisor || isDepartmentMatch;
      });
      
      // debugLog('Supervisor assignments count:', supervisorAssignments.length);
      
      // Check which ones have been completed by this supervisor
      const completedAssignments = [];
      for (const assignment of supervisorAssignments) {
        const hasCompleted = await DailyAssignmentService.hasUserCompletedData(assignment.checklist_id, userId);
        // debugLog(`Checklist ${assignment.checklist_id} - Status: ${assignment.status}, Has Completed: ${hasCompleted}`);
        if (hasCompleted && (assignment.status === 'awaiting_manager' || assignment.status === 'completed')) {
          completedAssignments.push({
            checklist_id: assignment.checklist_id,
            checklist_name: assignment.checklist_name,
            status: assignment.status,
            location_name: assignment.location_name,
            facility_name: assignment.facility_name,
            department_name: assignment.department_name
          });
        }
      }
      
      // debugLog('Completed assignments count:', completedAssignments.length);
      // debugLog('=== END SUPERVISOR COMPLETED ===');
      
      return completedAssignments;
    }
    
    if (role === 'manager') {
      const user = await knex('users').where('id', userId).first();
      return knex('checklists')
        .select(
          'checklists.id as checklist_id',
          'checklists.checklist_name',
          'checklists.status',
          'locations.name as location_name',
          'names.name as facility_name',
          'departments.name as department_name'
        )
        .leftJoin('locations', 'checklists.location_id', 'locations.id')
        .leftJoin('names', 'checklists.name_id', 'names.id')
        .leftJoin('departments', 'checklists.department_id', 'departments.id')
        .leftJoin('checklist_items', 'checklists.id', 'checklist_items.checklist_id')
        .where('checklists.location_id', user.location_id)
        .where('checklist_items.type', 'NSC')
        .whereIn('checklists.status', statusMap[role])
        .groupBy('checklists.id')
        .limit(10);
    }
    
    if (role === 'super admin') {
      let query = knex('rosters')
        .select(
          'rosters.id',
          'rosters.checklist_id',
          'rosters.assigned_date',
          'checklists.checklist_name',
          'checklists.status',
          'locations.name as location_name',
          'names.name as facility_name',
          'departments.name as department_name'
        )
        .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
        .leftJoin('locations', 'checklists.location_id', 'locations.id')
        .leftJoin('names', 'checklists.name_id', 'names.id')
        .leftJoin('departments', 'checklists.department_id', 'departments.id')
        .where('rosters.is_active', true)
        .whereIn('checklists.status', ['Completed', 'Completed without NCs']); // Show as completed only when fully done
      
      
      // Add date filter if provided
      if (date) {
        let mysqlDate;
        try {
          if (date.includes('-') && (date.includes('Dec') || date.includes('Jan') || date.includes('Feb'))) {
            const parts = date.split('-');
            const months = {'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
                           'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'};
            mysqlDate = `${parts[2]}-${months[parts[1]]}-${parts[0].padStart(2, '0')}`;
          } else {
            mysqlDate = new Date(date).toISOString().split('T')[0];
          }
        } catch (e) {
          mysqlDate = date;
        }
        query = query.where('rosters.assigned_date', mysqlDate);
      }
      
      const result = await query.limit(50);
      return result;
    }
    
    // For auditor and lead-auditor
    const roleField = role === 'lead-auditor' ? 'auditor_id' : `${role}_id`;
    
    let query = knex('rosters')
      .select(
        'rosters.id',
        'rosters.checklist_id',
        'rosters.assigned_date',
        'checklists.checklist_name',
        'checklists.status',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name'
      )
      .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .where('rosters.is_active', true)
      .where(`rosters.${roleField}`, userId)
      .whereIn('checklists.status', statusMap[role] || []);
    
    // Add date filter for auditor if provided
    if (date && role === 'auditor') {
      let mysqlDate;
      try {
        if (date.includes('-') && (date.includes('Dec') || date.includes('Jan') || date.includes('Feb'))) {
          const parts = date.split('-');
          const months = {'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
                         'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'};
          mysqlDate = `${parts[2]}-${months[parts[1]]}-${parts[0].padStart(2, '0')}`;
        } else {
          mysqlDate = new Date(date).toISOString().split('T')[0];
        }
      } catch (e) {
        mysqlDate = date;
      }
      query = query.where('rosters.assigned_date', mysqlDate);
    }
    
    return query.limit(10);
  }
}

module.exports = DashboardService;