const BaseModel = require('./BaseModel');

class DailyChecklistInstance extends BaseModel {
  constructor() {
    super('daily_checklist_instances');
  }

  async createDailyInstance(rosterData) {
    const dailyKey = `checklist_${rosterData.checklist_id}_auditor_${rosterData.auditor_id}_${rosterData.assigned_date.replace(/-/g, '_')}`;
    
    const instanceData = {
      template_checklist_id: rosterData.checklist_id,
      roster_id: rosterData.roster_id,
      auditor_id: rosterData.auditor_id,
      assigned_date: rosterData.assigned_date,
      status: 'assigned',
      daily_key: dailyKey,
      created_at: new Date(),
      updated_at: new Date()
    };

    return this.create(instanceData);
  }

  async getDailyInstancesByDate(date, userId = null, role = 'auditor') {
    let query = this.query()
      .select(
        'daily_checklist_instances.*',
        'daily_checklist_instances.template_checklist_id as checklist_id', // Map to expected field name
        'checklists.checklist_name',
        'checklists.location_id',
        'checklists.department_id',
        'checklists.status as checklist_status',
        'locations.name as location_name',
        'departments.name as department_name',
        'users.username as auditor_name'
      )
      .leftJoin('checklists', 'daily_checklist_instances.template_checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('users', 'daily_checklist_instances.auditor_id', 'users.id')
      .where('daily_checklist_instances.assigned_date', date);

    if (role === 'auditor') {
      query = query.where(function() {
        this.whereIn('daily_checklist_instances.status', ['assigned', 'in_progress']);
      });
    } else if (role === 'supervisor') {
      query = query.where(function() {
        this.where('checklists.status', 'Awaiting for NC response')
            .whereIn('daily_checklist_instances.status', ['awaiting_supervisor']);
      });
    } else if (role === 'manager') {
      query = query.where(function() {
        this.where('checklists.status', 'Accepted by Supervisor')
            .whereIn('daily_checklist_instances.status', ['awaiting_manager']);
      });
    }

    if (userId) {
      if (role === 'auditor') {
        query = query.where('daily_checklist_instances.auditor_id', userId);
      } else {
        // For supervisor/manager, filter by roster assignments
        const knex = require('../config/database');
        const rosters = await knex('rosters')
          .where(function() {
            if (role === 'supervisor') {
              this.whereRaw('JSON_CONTAINS(supervisor_id, ?)', [JSON.stringify(parseInt(userId))]);
            } else if (role === 'manager') {
              this.whereRaw('JSON_CONTAINS(manager_id, ?)', [JSON.stringify(parseInt(userId))]);
            }
          })
          .pluck('checklist_id');
        
        query = query.whereIn('daily_checklist_instances.template_checklist_id', rosters);
      }
    }

    return query.orderBy('daily_checklist_instances.created_at', 'desc');
  }

  async getCompletedInstancesByDate(date, userId = null, role = 'auditor') {
    let query = this.query()
      .select(
        'daily_checklist_instances.*',
        'daily_checklist_instances.template_checklist_id as checklist_id', // Map to expected field name
        'checklists.checklist_name',
        'checklists.location_id',
        'checklists.department_id',
        'checklists.status as checklist_status',
        'locations.name as location_name',
        'departments.name as department_name',
        'users.username as auditor_name'
      )
      .leftJoin('checklists', 'daily_checklist_instances.template_checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('users', 'daily_checklist_instances.auditor_id', 'users.id')
      .where('daily_checklist_instances.assigned_date', date);

    if (role === 'auditor') {
      query = query.where(function() {
        this.whereIn('daily_checklist_instances.status', ['completed', 'completed_without_ncs']);
      });
    } else if (role === 'supervisor') {
      query = query.where(function() {
        this.whereIn('checklists.status', ['Accepted by Supervisor', 'Completed by Supervisor'])
            .whereIn('daily_checklist_instances.status', ['completed', 'completed_without_ncs']);
      });
    } else if (role === 'manager') {
      query = query.where(function() {
        this.whereIn('checklists.status', ['Completed', 'Completed without NCs'])
            .whereIn('daily_checklist_instances.status', ['completed', 'completed_without_ncs']);
      });
    }

    if (userId) {
      if (role === 'auditor') {
        query = query.where('daily_checklist_instances.auditor_id', userId);
      } else {
        // For supervisor/manager, filter by roster assignments
        const knex = require('../config/database');
        const rosters = await knex('rosters')
          .where(function() {
            if (role === 'supervisor') {
              this.whereRaw('JSON_CONTAINS(supervisor_id, ?)', [JSON.stringify(parseInt(userId))]);
            } else if (role === 'manager') {
              this.whereRaw('JSON_CONTAINS(manager_id, ?)', [JSON.stringify(parseInt(userId))]);
            }
          })
          .pluck('checklist_id');
        
        query = query.whereIn('daily_checklist_instances.template_checklist_id', rosters);
      }
    }

    return query.orderBy('daily_checklist_instances.updated_at', 'desc');
  }

  async getDailyCounts(date, userId = null) {
    let query = this.query()
      .where('assigned_date', date);

    if (userId) {
      query = query.where('auditor_id', userId);
    }

    const results = await query
      .select('status')
      .count('* as count')
      .groupBy('status');

    const counts = {
      total: 0,
      pending: 0,
      completed: 0,
      assigned: 0,
      awaiting_supervisor: 0,
      awaiting_manager: 0
    };

    results.forEach(row => {
      counts.total += parseInt(row.count);
      counts[row.status] = parseInt(row.count);
      
      if (['completed', 'completed_without_ncs'].includes(row.status)) {
        counts.completed += parseInt(row.count);
      } else {
        counts.pending += parseInt(row.count);
      }
    });

    return counts;
  }

  async updateInstanceStatus(dailyKey, status, completionDate = null) {
    const updateData = {
      status,
      updated_at: new Date()
    };

    if (completionDate) {
      updateData.completion_date = completionDate;
    }

    return this.query()
      .where('daily_key', dailyKey)
      .update(updateData);
  }

  async getInstanceByKey(dailyKey) {
    return this.query()
      .where('daily_key', dailyKey)
      .first();
  }
}

module.exports = new DailyChecklistInstance();