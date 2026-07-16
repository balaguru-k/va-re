const BaseModel = require('./BaseModel');
const logger = require('../config/logger');

class ExecutiveData extends BaseModel {
  constructor() {
    super('executive_data');
  }

  async saveExecutiveResponse(checklistId, userId, itemId, data, images = [], assignedDate = null) {
    const newImageNames = images.map(img => img.filename);
    const existingImages = data.existingImages || [];
    const imageNames = [...existingImages, ...newImageNames].join(',');
    const today = assignedDate || new Date().toISOString().split('T')[0];
    logger.info('[EXECUTIVE-SAVE] draft', { checklist_id: checklistId, user_id: userId, item_id: itemId, assigned_date: today });

    return await this.query()
      .insert({
        checklist_id: checklistId,
        user_id: userId,
        checklist_item_id: itemId,
        assigned_date: today,
        reason: data.reason || null,
        image_name: imageNames || null,
        submission_status: 'draft',
        created_at: new Date(),
        updated_at: new Date()
      })
      .onConflict(['checklist_id', 'user_id', 'checklist_item_id', 'assigned_date'])
      .merge(['reason', 'image_name', 'submission_status', 'updated_at']);
  }

  async completeExecutiveResponse(checklistId, userId, itemId, data, images = [], assignedDate = null) {
    const newImageNames = images.map(img => img.filename);
    const existingImages = data.existingImages || [];
    const imageNames = [...existingImages, ...newImageNames].join(',');
    const today = assignedDate || new Date().toISOString().split('T')[0];
    logger.info('[EXECUTIVE-SAVE] completed', { checklist_id: checklistId, user_id: userId, item_id: itemId, assigned_date: today });

    return await this.query()
      .insert({
        checklist_id: checklistId,
        user_id: userId,
        checklist_item_id: itemId,
        assigned_date: today,
        reason: data.reason || null,
        image_name: imageNames || null,
        submission_status: 'completed',
        created_at: new Date(),
        updated_at: new Date()
      })
      .onConflict(['checklist_id', 'user_id', 'checklist_item_id', 'assigned_date'])
      .merge(['reason', 'image_name', 'submission_status', 'updated_at']);
  }

  async getExecutiveResponses(checklistId, userId, assignedDate = null) {
    const date = assignedDate || new Date().toISOString().split('T')[0];
    return await this.query()
      .select('*')
      .where('checklist_id', checklistId)
      .where('user_id', userId)
      .where('assigned_date', date);
  }

  async getExecutiveResponsesByStatus(checklistId, status) {
    return await this.query()
      .select('executive_data.*', 'users.username as user_name', 'checklist_items.activities')
      .join('users', 'executive_data.user_id', 'users.id')
      .join('checklist_items', 'executive_data.checklist_item_id', 'checklist_items.id')
      .where('checklist_id', checklistId)
      .where('submission_status', status);
  }

  async deleteExecutiveResponse(checklistId, userId, itemId) {
    return await this.query()
      .where('checklist_id', checklistId)
      .where('user_id', userId)
      .where('checklist_item_id', itemId)
      .del();
  }
}

module.exports = new ExecutiveData();
