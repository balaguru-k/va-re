const BaseModel = require('./BaseModel');
const ExecutiveData = require('./ExecutiveData');

class Executive extends BaseModel {
  constructor() {
    super('executives');
  }

  async getChecklist(userId, fromDate = null, toDate = null) {
    const knex = require('../config/database');

    // Get executive's profile
    const executiveUser = await knex('users').where('id', userId).first();
    let executiveDepartments = [];
    try {
      if (Array.isArray(executiveUser.department_id)) {
        executiveDepartments = executiveUser.department_id;
      } else {
        executiveDepartments = JSON.parse(executiveUser.department_id || '[]');
      }
    } catch (e) {
      executiveDepartments = executiveUser.department_id ? [executiveUser.department_id] : [];
    }

    // Query SC template checklists matching executive's location+name+department directly
    // No roster needed — executive sees all SC checklists for their scope
    let scQuery = knex('daily_checklist_instances as dci')
      .select(
        'dci.*',
        'tc.id as checklist_id',
        'tc.checklist_name',
        'tc.status as checklist_status',
        'tc.type as checklist_type',
        'tc.location_id',
        'tc.department_id',
        'tc.name_id',
        'l.name as location_name',
        'd.name as department_name',
        'n.name as facility_name'
      )
      .leftJoin('checklists as dc', 'dci.daily_checklist_id', 'dc.id')
      .leftJoin('checklists as tc', 'dci.template_checklist_id', 'tc.id')
      .leftJoin('locations as l', 'tc.location_id', 'l.id')
      .leftJoin('departments as d', 'tc.department_id', 'd.id')
      .leftJoin('names as n', 'tc.name_id', 'n.id')
      .where('tc.type', 'SC')
      .where('tc.is_active', true)
      .whereBetween('dci.assigned_date',[fromDate, toDate]);

    if (executiveUser.location_id) {
      scQuery = scQuery.where('tc.location_id', executiveUser.location_id);
    }
    if (executiveUser.name_id) {
      scQuery = scQuery.where('tc.name_id', executiveUser.name_id);
    }
    if (executiveDepartments.length > 0) {
      scQuery = scQuery.whereIn('tc.department_id', executiveDepartments);
    }

    const scChecklists = await scQuery;

    const pending = [];
    const completed = [];

    const logger = require('../config/logger');


    for (const checklist of scChecklists) {
      // Check if ANY executive completed this checklist TODAY
      const anyExecutiveData = await ExecutiveData.query()
        .where('checklist_id', checklist.daily_checklist_id)
        .where('submission_status', 'completed')
        .first();

      if (anyExecutiveData) {
        logger.info('[EXECUTIVE] Completed', { checklist_id: checklist.checklist_id, user_id: userId });
        completed.push({
          ...checklist,
          id: checklist.checklist_id,
          status: 'Executive Review Completed',
          completed_by_executive_id: anyExecutiveData.user_id
        });
      } else {
        logger.info('[EXECUTIVE] Pending', { checklist_id: checklist.checklist_id, user_id: userId });
        pending.push({
          ...checklist,
          id: checklist.checklist_id,
          status: null
        });
      }
    }

    return { pending, completed };
  }

  async saveExecutiveChecklist(checklistId, userId, formData, files, assignedDate = null) {
    try {
      for (const [itemId, itemData] of Object.entries(formData)) {
        const itemImages = files.filter(f => f.originalname.startsWith(`${itemId}_`));
        await ExecutiveData.saveExecutiveResponse(checklistId, userId, itemId, itemData, itemImages, assignedDate);
      }
    } catch (error) {
      throw error;
    }
  }

  async completeExecutiveChecklist(checklistId, userId, formData, files, assignedDate = null) {
    try {
      for (const [itemId, itemData] of Object.entries(formData)) {
        const itemImages = files.filter(f => f.originalname.startsWith(`${itemId}_`));
        await ExecutiveData.completeExecutiveResponse(checklistId, userId, itemId, itemData, itemImages, assignedDate);
      }

      await this.query()
        .from('checklists')
        .where('id', checklistId)
        .update({ status: 'Executive Review Completed' });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new Executive();