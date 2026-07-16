const BaseModel = require('./BaseModel');

class ChecklistData extends BaseModel {
  constructor() {
    super('checklist_data');
  }

  async saveChecklistData(data) {
    return this.create(data);
  }

  async saveMultipleChecklistData(checklistId, userId, dataArray) {
    // Delete only the specific items being updated
    const itemIds = dataArray.map(item => item.checklist_item_id);
    await this.query()
      .where({ checklist_id: checklistId, user_id: userId })
      .whereIn('checklist_item_id', itemIds)
      .del();
    return this.query().insert(dataArray);
  }

  async getChecklistData(checklistId, userId) {
    return this.query()
      .where({ checklist_id: checklistId, user_id: userId })
      .first();
  }
}

module.exports = new ChecklistData();
