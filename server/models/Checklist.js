const BaseModel = require('./BaseModel');

class Checklist extends BaseModel {
  constructor() {
    super('checklists');
  }

  toTitleCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async create(data) {
    try {
      if (data.checklist_items) {
        data.checklist_items = JSON.stringify(data.checklist_items);
      }
      data.created_at = new Date();
      data.updated_at = new Date();
      
      // Format text fields to title case
      if (data.checklist_name) {
        data.checklist_name = this.toTitleCase(data.checklist_name);
      }
      if (data.name) data.name = this.toTitleCase(data.name);
      
      // Convert string values to appropriate types
      if (data.category_id) data.category_id = parseInt(data.category_id);
      if (data.location_id) data.location_id = parseInt(data.location_id);
      if (data.department_id) data.department_id = parseInt(data.department_id);
      if (data.camera_count) data.camera_count = parseInt(data.camera_count);
      if (data.audit_count) data.audit_count = parseInt(data.audit_count);
      
      return super.create(data);
    } catch (error) {
      console.error('Checklist create error:', error);
      throw error;
    }
  }

  async update(id, data) {
    if (data.checklist_items) {
      data.checklist_items = JSON.stringify(data.checklist_items);
    }
    
    // Format text fields to title case
    if (data.checklist_name) data.checklist_name = this.toTitleCase(data.checklist_name);
    if (data.name) data.name = this.toTitleCase(data.name);
    
    data.updated_at = new Date();
    return super.update(id, data);
  }

  async getChecklistsWithDetails(conditions = {}) {
    return this.query()
      .select(
        'checklists.id',
        'checklists.name',
        'checklists.checklist_name',
        'checklists.type',
        'checklists.category_id',
        'checklists.location_id',
        'checklists.name_id',
        'checklists.department_id',
        'checklists.camera_count',
        'checklists.audit_count',
        'checklists.frequency',
        'checklists.alert_time',
        'checklists.checklist_file',
        'checklists.checklist_items',
        'checklists.status',
        'checklists.time_taken_seconds',
        'checklists.total_camera_audited',
        'checklists.total_camera_random_audited',
        'checklists.total_camera_not_audited',
        'checklists.total_camera_offline',
        'checklists.total_camera_offline_percent',
        'checklists.total_camera_technical_issues',
        'checklists.total_camera_technical_issues_percent',
        'checklists.total_ncs',
        'checklists.camera_file',
        'checklists.remark',
        'checklists.created_at',
        'checklists.updated_at',
        'checklists.deleted_at',
        'checklists.created_by',
        'checklists.updated_by',
        'categories.name as category_name',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name',
        'checklist_items.type as item_type',
      )
      .leftJoin('categories', 'checklists.category_id', 'categories.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('checklist_items', 'checklists.id', 'checklist_items.checklist_id')
      .groupBy('checklists.id')
      .where(conditions);
  }

  async getChecklistWithParsedItems(id) {
    const checklist = await this.findById(id);
    if (checklist && checklist.checklist_items) {
      checklist.checklist_items = JSON.parse(checklist.checklist_items);
    }
    return checklist;
  }
}

module.exports = new Checklist();