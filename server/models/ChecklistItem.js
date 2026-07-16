const BaseModel = require('./BaseModel');

class ChecklistItem extends BaseModel {
  constructor() {
    super('checklist_items');
  }

  async createFromCSV(checklistId, csvData) {
    const standardColumns = ['Type', 'PROCESS', 'Camera number', 'Criticality', 'ACTIVITIES', 'Who', 'When', 'How', 'Frequency'];
    
    const items = csvData.map(row => {
      // Extract standard columns
      const item = {
        checklist_id: checklistId,
        type: row.Type || null,
        process: row.PROCESS || null,
        camera_number: row['Camera number'] || null,
        criticality: row.Criticality || null,
        activities: row.ACTIVITIES || null,
        who: row.Who || null,
        when_field: row.When || null,
        how: row.How || null,
        frequency: row.Frequency || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Extract extra columns into meta
      const extraColumns = {};
      Object.keys(row).forEach(key => {
        if (!standardColumns.includes(key) && row[key] !== null && row[key] !== undefined && row[key] !== '') {
          extraColumns[key] = row[key];
        }
      });
      
      // Add meta if there are extra columns
      if (Object.keys(extraColumns).length > 0) {
        item.meta = JSON.stringify(extraColumns);
      } else {
        item.meta = null;
      }
      
      return item;
    });

    return this.query().insert(items);
  }

  async getByChecklistId(checklistId) {
    return this.query().where('checklist_id', checklistId).orderBy('id', 'asc');
  }

  async deleteByChecklistId(checklistId) {
    return this.query().where('checklist_id', checklistId).del();
  }
}

module.exports = new ChecklistItem();