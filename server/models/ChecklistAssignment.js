const BaseModel = require('./BaseModel');

class ChecklistAssignment extends BaseModel {
  constructor() {
    super('checklist_assignments');
  }

  async getAssignmentsWithDetails(conditions = {}) {
    return this.query()
      .select(
        'checklist_assignments.*',
        'checklists.checklist_name',
        'auditors.username as auditor_name',
        'responsible.username as responsible_name',
        'managers.username as manager_name',
        'supervisors.username as supervisor_name'
      )
      .leftJoin('checklists', 'checklist_assignments.checklist_id', 'checklists.id')
      .leftJoin('users as auditors', 'checklist_assignments.auditor_id', 'auditors.id')
      .leftJoin('users as responsible', 'checklist_assignments.responsible_person_id', 'responsible.id')
      .leftJoin('users as managers', 'checklist_assignments.manager_id', 'managers.id')
      .leftJoin('users as supervisors', 'checklist_assignments.supervisor_id', 'supervisors.id')
      .where(conditions);
  }

  async assignUsers(checklistId, assignments) {
    const results = [];
    for (const assignment of assignments) {
      const data = {
        checklist_id: checklistId,
        auditor_id: assignment.auditor_id,
        responsible_person_id: assignment.responsible_person_id || null,
        manager_id: assignment.manager_id || null,
        supervisor_id: assignment.supervisor_id || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      const result = await this.create(data);
      results.push(result);
    }
    return results;
  }
}

module.exports = new ChecklistAssignment();