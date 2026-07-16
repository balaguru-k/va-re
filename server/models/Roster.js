const BaseModel = require('./BaseModel');
const { formatDate } = require('../utils/dateFormatter');

class Roster extends BaseModel {
  constructor() {
    super('rosters');
  }

  async getRosterWithDetails(conditions = {}, date = null) {
    const knex = require('../config/database');
    
    let query = knex('rosters')
      .select(
        'rosters.*',
        'checklists.checklist_name',
        'checklists.status',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name',
        'auditors.username as auditor_name',
        'auditors.username as auditor_username'
      )
      .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('users as auditors', 'rosters.auditor_id', 'auditors.id')
      .where(conditions);
    
    // Only add date filter if date is provided
    if (date) {
      query = query.where('rosters.assigned_date', date);
    }
    
    return query.orderBy('rosters.assigned_date', 'desc');
  }

  async getUserRostersByDate(userId, date) {
    const userIdNum = parseInt(userId);
    
    return this.query()
      .select(
        'rosters.*',
        'checklists.checklist_name',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name',
        'auditors.username as auditor_name',
        '',
        'managers.username as manager_name',
        'supervisors.username as supervisor_name'
      )
      .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('users as auditors', 'rosters.auditor_id', 'auditors.id')
      .leftJoin('')
      .leftJoin('users as managers', 'rosters.manager_id', 'managers.id')
      .leftJoin('users as supervisors', 'rosters.supervisor_id', 'supervisors.id')
      .where('rosters.is_active', true)
      .where('rosters.assigned_date', date)
      .where(function() {
        this.where('rosters.auditor_id', userIdNum)
          .orWhereRaw('JSON_CONTAINS(rosters.manager_id, ?)', [JSON.stringify(userIdNum)])
          .orWhereRaw('JSON_CONTAINS(rosters.supervisor_id, ?)', [JSON.stringify(userIdNum)]);
      });
  }

  async getUserRostersAll(userId, date) {
    const userIdNum = parseInt(userId);
    const assignDate = date;
    const knex = require('../config/database');
    
    // First, let's see all rosters for this user
    const allUserRosters = await knex('rosters')
      .select('*')
      .where('is_active', true)
      .where('assigned_date', assignDate)
      .where(function() {
        this.where('auditor_id', userIdNum)
          .orWhere('manager_id', userIdNum)
          .orWhere('supervisor_id', userIdNum);
      });
    
    allUserRosters.forEach(r => {
    });
    
    const result = knex('rosters')
      .select(
        'rosters.id',
        'rosters.checklist_id',
        'rosters.auditor_id',
        'rosters.manager_id',
        'rosters.supervisor_id',
        'rosters.assigned_date',
        'checklists.checklist_name',
        'checklists.status',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name',
        'auditors.username as auditor_name',
        '',
        'managers.username as manager_name',
        'supervisors.username as supervisor_name'
      )
      .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('users as auditors', 'rosters.auditor_id', 'auditors.id')
      .leftJoin('')
      .leftJoin('users as managers', 'rosters.manager_id', 'managers.id')
      .leftJoin('users as supervisors', 'rosters.supervisor_id', 'supervisors.id')
      .leftJoin('checklist_data', function() {
        this.on('checklist_data.checklist_id', '=', 'rosters.checklist_id')
            .andOn('checklist_data.user_id', '=', 'rosters.auditor_id');
      })
      .where('rosters.is_active', true)
      .where(function() {
        this.where('rosters.auditor_id', userIdNum)
          .orWhere('', userIdNum)
          .orWhereRaw('JSON_CONTAINS(rosters.manager_id, ?)', [JSON.stringify(userIdNum)])
          .orWhereRaw('JSON_CONTAINS(rosters.supervisor_id, ?)', [JSON.stringify(userIdNum)]);
      })
      .where(function() {
        // For supervisors: show checklists with 'Awaiting for NC response' status that need supervisor review OR rejected checklists
        this.where(function() {
          this.whereRaw('JSON_CONTAINS(rosters.supervisor_id, ?)', [JSON.stringify(userIdNum)])
              .where(function() {
                // New checklists awaiting supervisor review
                this.where('checklists.status', 'Awaiting for NC response')
                    .whereNotExists(function() {
                      this.select('*')
                          .from('supervisor_reviews')
                          .whereRaw('supervisor_reviews.checklist_id = rosters.checklist_id')
                          .where('supervisor_reviews.supervisor_id', userIdNum);
                    })
                // OR rejected checklists that need re-work
                .orWhere('checklists.status', 'Rejected by Supervisor');
              })
              // Exclude completed checklists from dashboard
              .whereNotIn('checklists.status', ['Completed by Supervisor', 'Accepted by Supervisor', 'Completed', 'Completed without NCs']);
        })
        // For managers: show checklists accepted by supervisor
        .orWhere(function() {
          this.whereRaw('JSON_CONTAINS(rosters.manager_id, ?)', [JSON.stringify(userIdNum)])
              .where('checklists.status', 'Accepted by Supervisor');
        })
        // For auditors: show all assigned checklists that are not completed
        .orWhere(function() {
          this.where(function() {
            this.where('rosters.auditor_id', userIdNum)
              .orWhere('', userIdNum);
          })
          .where(function() {
            // Show if no checklist_data exists (newly assigned) OR draft status OR no/empty status OR rejected
            this.whereNull('checklist_data.id')
              .orWhere('checklist_data.submission_status', 'draft')
              .orWhereNull('checklists.status')
              .orWhere('checklists.status', '')
              .orWhere('checklists.status', 'Draft')
              .orWhere('checklists.status', 'Rejected by Supervisor');
          })
          // Exclude completed statuses
          .whereNotIn('checklists.status', ['Completed', 'Completed without NCs', 'Awaiting for NC response', 'Accepted by Supervisor', 'Completed by Supervisor']);
        });
      });
    
    const finalResult = await result;
    
    // Also check checklist statuses
    const checklistStatuses = await knex('checklists')
      .select('id', 'checklist_name', 'status')
      .whereIn('id', allUserRosters.map(r => r.checklist_id));
    
    checklistStatuses.forEach(c => {
    });
    
    finalResult.forEach(r => {
    });
    
    return finalResult;
  }

  async getAuditorRosters(userId) {
    const userIdNum = parseInt(userId);
    const knex = require('../config/database');
    
    return knex('rosters')
      .select(
        'rosters.id',
        'rosters.checklist_id',
        'rosters.auditor_id',
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
      .where('rosters.auditor_id', userIdNum)
      .where(function() {
        this.whereNull('checklist_data.id')
          .orWhere('checklist_data.submission_status', 'draft')
          .orWhereNull('checklists.status')
          .orWhere('checklists.status', '')
          .orWhere('checklists.status', 'Draft')
          .orWhere('checklists.status', 'Rejected by Supervisor');
      });
  }

  async getSupervisorRosters(userId) {
    const userIdNum = parseInt(userId);
    const knex = require('../config/database');
    
    return knex('rosters')
      .select(
        'rosters.id',
        'rosters.checklist_id',
        'rosters.supervisor_id',
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
      .where('rosters.supervisor_id', userIdNum)
      .where(function() {
        // Show new checklists awaiting supervisor review
        this.where(function() {
          this.where('checklists.status', 'Awaiting for NC response')
              .whereNotExists(function() {
                this.select('*')
                    .from('supervisor_reviews')
                    .whereRaw('supervisor_reviews.checklist_id = rosters.checklist_id')
                    .whereRaw('supervisor_reviews.supervisor_id = rosters.supervisor_id');
              });
        })
        // OR show rejected checklists that are still pending
        .orWhere('checklists.status', 'Rejected by Supervisor');
      });
  }

  async getManagerRosters(userId) {
    const userIdNum = parseInt(userId);
    const knex = require('../config/database');
    
    return knex('rosters')
      .select(
        'rosters.id',
        'rosters.checklist_id',
        'rosters.manager_id',
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
      .where('rosters.manager_id', userIdNum)
      .whereIn('checklists.status', ['Accepted by Supervisor', 'Completed by Supervisor']);
  }

  async createRosterAssignment(data) {
    data.created_at = new Date();
    data.updated_at = new Date();
    const [id] = await this.query().insert(data);
    return id;
  }

  async getCompletedRostersByRole(userId, role) {
    const userIdNum = parseInt(userId);
    const knex = require('../config/database');
    // const { debugLog } = require('../utils/debugLogger');
    
    switch(role) {
      case 'supervisor':
        // Show rosters where supervisor accepted (based on checklist status)
        const supervisorCompleted = await knex('rosters')
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
          .whereRaw('JSON_CONTAINS(rosters.supervisor_id, ?)', [JSON.stringify(userIdNum)])
          .whereIn('checklists.status', ['Accepted by Supervisor', 'Completed by Supervisor', 'Completed', 'Completed without NCs'])
          .limit(1); // Only show 1 completed item per checklist
        
        return supervisorCompleted;
          
      case 'auditor':
        // Show rosters where auditor completed (status moved beyond draft)
        const auditorCompleted = await knex('rosters')
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
          .where('rosters.auditor_id', userIdNum)
          .whereIn('checklists.status', ['Awaiting for NC response', 'Accepted by Supervisor', 'Completed by Supervisor', 'Completed', 'Completed without NCs']);
        
        return auditorCompleted;
          
      case 'manager':
        return knex('rosters')
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
          .whereRaw('JSON_CONTAINS(rosters.manager_id, ?)', [JSON.stringify(userIdNum)])
          .whereIn('checklists.status', ['Completed', 'Completed without NCs']);
          
      default:
        return [];
    }
  }
}

module.exports = new Roster();