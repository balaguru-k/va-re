const BaseModel = require('./BaseModel');

class Complaint extends BaseModel {
  constructor() {
    super('complaints');
  }

  async getComplaintsWithDetails(where = {}) {
    return this.db(this.tableName)
      .select(
        'complaints.*',
        'users.username as reporter_name',
        'locations.name as location_name',
        'departments.name as department_name',
        'comp_users.username as completed_by_name'
      )
      .leftJoin('users', 'complaints.user_id', 'users.id')
      .leftJoin('locations', 'complaints.location_id', 'locations.id')
      .leftJoin('departments', 'complaints.department_id', 'departments.id')
      .leftJoin('users as comp_users', 'complaints.completed_by', 'comp_users.id')
      .where(where)
      .orderBy('complaints.created_at', 'desc');
  }

  async getNextTicketNo() {
    const lastComplaint = await this.db(this.tableName)
      .orderBy('id', 'desc')
      .first();
    
    const nextId = lastComplaint ? lastComplaint.id + 1 : 1;
    return `TKT-${nextId.toString().padStart(4, '0')}`;
  }
}

module.exports = new Complaint();
