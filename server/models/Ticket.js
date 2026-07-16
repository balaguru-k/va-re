const BaseModel = require('./BaseModel');
const db = require('../config/database');

class Ticket extends BaseModel {
  constructor() {
    super('tickets');
  }

  static get tableName() {
    return 'tickets';
  }

  static get fillable() {
    return [
      'user_id',
      'issue',
      'remarks',
      'attachments',
    ];
  }

  static get validationRules() {
    return {
      user_id: 'required|integer',
      issue: 'required|string|max:100',
      remarks: 'string'
    };
  }

  // Get tickets with user information
  static async getTicketsWithUser(filters = {}) {
    const query = db('tickets')
      .select([
        'tickets.*',
        'users.username as user_name',
        'users.email as user_email',
        'vendor_users.name as vendor_name',
        'engineer_users.name as engineer_name'
      ])
      .leftJoin('users', 'tickets.user_id', 'users.id')
      .leftJoin('compliance_users as vendor_users', 'tickets.assigned_vendors', 'vendor_users.id')
      .leftJoin('compliance_users as engineer_users', 'tickets.assigned_engineers', 'engineer_users.id')
      .whereNull('tickets.deleted_at')
      .orderBy('tickets.created_at', 'desc');

    // Apply filters
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        if (key === 'deleted_at' && filters[key] === null) {
          // Already handled above with whereNull
          return;
        }
        query.where(`tickets.${key}`, filters[key]);
      }
    });

    return await query;
  }

  // Get ticket by ID with user information
  static async getTicketWithUser(id) {
    return await db('tickets')
      .select([
        'tickets.*',
        'users.username as user_name',
        'users.email as user_email'
      ])
      .leftJoin('users', 'tickets.user_id', 'users.id')
      .where('tickets.id', id)
      .whereNull('tickets.deleted_at')
      .first();
  }

   // Generate unique ticket number based on checklist name
  static async generateTicketNumber(checklistName) {
    // Remove spaces and special characters, take first 10 chars, uppercase
    const prefix = checklistName
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 10)
      .toUpperCase();
   
    // Get the total count of ALL existing tickets (global sequential numbering)
    const count = await db('tickets')
      .whereNull('deleted_at')
      .count('id as total');
   
    const nextNumber = (count[0]?.total || 0) + 1;
   
    // Format: PREFIX-0001 (sequential across all tickets)
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  // Create new ticket
  static async create(data) {
    // Only generate ticket number if not already provided
    if (!data.ticket_number && data.checklist_name) {
      data.ticket_number = await this.generateTicketNumber(data.checklist_name);
    }
    
    const [id] = await db('tickets').insert(data);
    return await this.getTicketWithUser(id);
  }

  // Update ticket
  static async update(id, data) {
    await db('tickets').where('id', id).update({ ...data, updated_at: new Date() });
    return await this.getTicketWithUser(id);
  }

  // Find ticket by ID
  static async findById(id) {
    return await db('tickets').where('id', id).whereNull('deleted_at').first();
  }

  // Soft delete ticket
  static async delete(id) {
    return await db('tickets').where('id', id).update({ deleted_at: new Date() });
  }

  // Update ticket status and status_remarks
  static async updateStatus(id, status, status_remarks) {
    return await db('tickets')
      .where('id', id)
      .update({ status: status || null, status_remarks: status_remarks || null, updated_at: new Date() });
  }
}

module.exports = Ticket;