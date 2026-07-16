const BaseModel = require('./BaseModel');

class ChecklistScore extends BaseModel {
  constructor() {
    super('checklist_scores');
  }
}

module.exports = new ChecklistScore();
