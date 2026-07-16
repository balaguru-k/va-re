const knex = require('../config/database');
const logger = require('../config/logger');
const DailyAssignmentService = require('./DailyAssignmentService');
const { getAutoAssignedUsers } = require('../utils/userService');

class DailyExtraService {

  /**
   * Create a one-day-only assignment.
   * Stores record + immediately creates DCI if assign_date is today.
   */
  static async createExtraAssignment(checklistId, auditorId, assignDate, assignedBy) {
    // Prevent duplicate
    const existing = await knex('daily_extra_assignments')
      .where({ checklist_id: checklistId, auditor_id: auditorId, assign_date: assignDate })
      .first();
    if (existing) throw new Error('This checklist is already assigned to this auditor for that date');

    const [id] = await knex('daily_extra_assignments').insert({
      checklist_id: checklistId,
      auditor_id: auditorId,
      assign_date: assignDate,
      assigned_by: assignedBy,
      is_processed: false,
      created_at: new Date(),
      updated_at: new Date()
    });

    // If assign_date is today, create DCI immediately
    const today = new Date().toISOString().split('T')[0];
    if (assignDate === today) {
      await this.processExtraAssignment(id);
    }

    return id;
  }

  /**
   * Process a single extra assignment — create DCI + daily checklist copy.
   * Does NOT create/modify any roster row.
   */
  static async processExtraAssignment(extraId) {
    const extra = await knex('daily_extra_assignments').where('id', extraId).first();
    if (!extra || extra.is_processed) return;

    // Check if DCI already exists for this checklist+auditor+date
    const existingDCI = await knex('daily_checklist_instances')
      .where('template_checklist_id', extra.checklist_id)
      .where('auditor_id', extra.auditor_id)
      .where('assigned_date', extra.assign_date)
      .first();

    if (existingDCI) {
      // Already has an instance (maybe from roster) — just mark processed
      await knex('daily_extra_assignments').where('id', extraId).update({ is_processed: true, updated_at: new Date() });
      return existingDCI;
    }

    // Create DCI without roster (roster_id = null)
    const instance = await DailyAssignmentService.createDailyChecklistInstanceFromRoster(
      extra.checklist_id,
      extra.auditor_id,
      null, // No roster — one-day assignment
      extra.assign_date
    );

    await knex('daily_extra_assignments').where('id', extraId).update({ is_processed: true, updated_at: new Date() });

    logger.info('[EXTRA] Processed extra assignment', { id: extraId, checklist_id: extra.checklist_id, auditor_id: extra.auditor_id, date: extra.assign_date });
    return instance;
  }

  /**
   * Process all unprocessed extra assignments for a given date.
   * Called from DailyAssignmentService.getAllDailyAssignments or cron.
   */
  static async processExtrasForDate(targetDate) {
    const unprocessed = await knex('daily_extra_assignments')
      .where('assign_date', targetDate)
      .where('is_processed', false);

    for (const extra of unprocessed) {
      try {
        await this.processExtraAssignment(extra.id);
      } catch (err) {
        logger.error('[EXTRA] Failed to process', { id: extra.id, error: err.message });
      }
    }
  }

  /**
   * Get all extra assignments for a date (for admin view).
   */
  static async getExtrasByDate(date) {
    return knex('daily_extra_assignments as dea')
      .select(
        'dea.*',
        'checklists.checklist_name',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name',
        'users.username as auditor_name',
        'assigned_user.username as assigned_by_name'
      )
      .leftJoin('checklists', 'dea.checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('users', 'dea.auditor_id', 'users.id')
      .leftJoin('users as assigned_user', 'dea.assigned_by', 'assigned_user.id')
      .where('dea.assign_date', date)
      .orderBy('dea.created_at', 'desc');
  }

  /**
   * Delete an extra assignment. If already processed and DCI has no roster,
   * also unassign from today's instance.
   */
  static async deleteExtraAssignment(extraId) {
    const extra = await knex('daily_extra_assignments').where('id', extraId).first();
    if (!extra) throw new Error('Extra assignment not found');

    const today = new Date().toISOString().split('T')[0];

    if (extra.is_processed && extra.assign_date === today) {
      // Find and unassign the DCI that was created without a roster
      const dci = await knex('daily_checklist_instances')
        .where('template_checklist_id', extra.checklist_id)
        .where('auditor_id', extra.auditor_id)
        .where('assigned_date', extra.assign_date)
        .whereNull('roster_id')
        .first();

      if (dci) {
        await knex('daily_checklist_instances').where('id', dci.id).update({
          auditor_id: null,
          status: 'unassigned',
          updated_at: new Date()
        });
        if (dci.daily_checklist_id) {
          await knex('checklists').where('id', dci.daily_checklist_id).update({
            assigned_auditor_id: null,
            updated_at: new Date()
          });
        }
      }
    }

    await knex('daily_extra_assignments').where('id', extraId).del();
    logger.info('[EXTRA] Deleted extra assignment', { id: extraId });
  }
}

module.exports = DailyExtraService;
