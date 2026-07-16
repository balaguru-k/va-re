const BaseModel = require('./BaseModel');

class ManagerReview extends BaseModel {
  constructor() {
    super('manager_reviews');
  }

  async createReview(reviewData) {
    return this.query().insert({
      ...reviewData,
      created_at: new Date(),
      updated_at: new Date()
    }).onConflict(['checklist_id', 'checklist_item_id']).merge({
      ...reviewData,
      updated_at: new Date()
    });
  }

  async getReviewsByChecklistId(checklistId) {
    return this.query()
      .select(
        'manager_reviews.*',
        'checklist_items.activities',
        'checklist_items.process',
        'users.username as manager_name'
      )
      .leftJoin('checklist_items', 'manager_reviews.checklist_item_id', 'checklist_items.id')
      .leftJoin('users', 'manager_reviews.manager_id', 'users.id')
      .where('manager_reviews.checklist_id', checklistId);
  }

  async getReviewsByManagerId(managerId) {
    return this.query()
      .where('manager_id', managerId);
  }
}

module.exports = new ManagerReview();