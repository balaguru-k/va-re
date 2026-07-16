const knex = require('../config/database');
const logger = require('../config/logger');
const DailyAssignmentService = require('./DailyAssignmentService');
const { getAutoAssignedUsers } = require('../utils/userService');

class RotationService {

  // Get currently active option (latest entry in rotation_active_log where activated_date <= today)
  static async getActiveOption(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const active = await knex('rotation_active_log')
      .where('activated_date', '<=', targetDate)
      .orderBy('activated_date', 'desc')
      .orderBy('id', 'desc')
      .first();

    return active || null;
  }

  // Get all checklists for an option with their assigned auditors + today's effective auditor
  static async getOptionChecklists(optionId) {
    const today = new Date().toISOString().split('T')[0];

    const rows = await knex('rotation_checklists')
      .select(
        'rotation_checklists.*',
        'checklists.checklist_name',
        'checklists.location_id',
        'checklists.name_id',
        'checklists.department_id',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name',
        'users.username as auditor_name',
        'swap.temp_auditor_id',
        'swap_user.username as temp_auditor_name',
        'swap.swap_date'
      )
      .leftJoin('checklists', 'rotation_checklists.checklist_id', 'checklists.id')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('users', 'rotation_checklists.auditor_id', 'users.id')
      .leftJoin('rotation_temp_swaps as swap', function() {
        this.on('swap.rotation_checklist_id', '=', 'rotation_checklists.id')
            .andOn('swap.swap_date', '=', knex.raw('?', [today]));
      })
      .leftJoin('users as swap_user', 'swap.temp_auditor_id', 'swap_user.id')
      .where('rotation_checklists.option_id', optionId)
      .where(function() {
        this.where('checklists.is_active', 1).orWhereNull('checklists.is_active');
      })
      .whereNull('checklists.deleted_at');

    return rows.map(row => {
      const hasSwapRecord = row.swap_date !== null;
      const isTempUnassigned = hasSwapRecord && !row.temp_auditor_id;
      return {
        ...row,
        effective_auditor_id: isTempUnassigned ? null : (row.temp_auditor_id || row.auditor_id),
        effective_auditor_name: isTempUnassigned ? null : (row.temp_auditor_name || row.auditor_name),
        is_temp_swap: hasSwapRecord && !!row.temp_auditor_id,
        is_temp_unassigned: isTempUnassigned
      };
    });
  }

  // Get effective auditor for a rotation_checklist on a given date (handles temp swaps)
  static async getEffectiveAuditor(rotationChecklistId, date) {
    const swap = await knex('rotation_temp_swaps')
      .where('rotation_checklist_id', rotationChecklistId)
      .where('swap_date', date)
      .first();

    if (swap) {
      return { auditorId: swap.temp_auditor_id, isTemp: true };
    }

    const rc = await knex('rotation_checklists').where('id', rotationChecklistId).first();
    return { auditorId: rc?.auditor_id || null, isTemp: false };
  }

  // =====================================================
  // CORE: Sync auditor to rosters + daily instance + daily checklist
  // This is the SINGLE function that keeps everything in sync
  // =====================================================
  static async syncAuditorToRoster(checklistId, auditorId, createdBy) {
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    // 1. Get or create roster
    const existingRoster = await knex('rosters')
      .where('checklist_id', checklistId)
      .first();

    let rosterId;

    if (!auditorId) {
      // UNASSIGN flow
      if (existingRoster) {
        await knex('rosters').where('id', existingRoster.id).update({
          auditor_id: null,
          is_active: 0,
          updated_at: new Date()
        });

        // Update today's instance to unassigned
        const todayInstance = await knex('daily_checklist_instances')
          .where('roster_id', existingRoster.id)
          .where('assigned_date', formattedToday)
          .first();

        if (todayInstance) {
          await knex('daily_checklist_instances').where('id', todayInstance.id).update({
            auditor_id: null,
            status: 'unassigned',
            updated_at: new Date()
          });
          if (todayInstance.daily_checklist_id) {
            await knex('checklists').where('id', todayInstance.daily_checklist_id).update({
              assigned_auditor_id: null,
              updated_at: new Date()
            });
          }
        }
      }
      return;
    }

    // Auto-assign supervisor/manager based on checklist location+department
    const autoAssigned = await getAutoAssignedUsers(auditorId, checklistId);
    const supervisorIdJson = JSON.stringify(autoAssigned.supervisors.map(s => s.id));
    const managerIdJson = JSON.stringify(autoAssigned.managers.map(m => m.id));

    if (existingRoster) {
      const oldAuditorId = existingRoster.auditor_id;
      rosterId = existingRoster.id;

      // 2. Update roster
      await knex('rosters').where('id', existingRoster.id).update({
        auditor_id: auditorId,
        supervisor_id: supervisorIdJson,
        manager_id: managerIdJson,
        is_active: 1,
        updated_at: new Date()
      });

      // 2.5 Delete future daily instances for old auditor (so they stop seeing it)
      if (oldAuditorId && oldAuditorId !== auditorId) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedTomorrow = `${tomorrow.getFullYear()}-${(tomorrow.getMonth() + 1).toString().padStart(2, '0')}-${tomorrow.getDate().toString().padStart(2, '0')}`;

        await knex('daily_checklist_instances')
          .where('template_checklist_id', checklistId)
          .where('auditor_id', oldAuditorId)
          .where('assigned_date', '>=', formattedTomorrow)
          .del();
      }

      // 3. Update today's daily instance
      const todayInstance = await knex('daily_checklist_instances')
        .where('roster_id', existingRoster.id)
        .where('assigned_date', formattedToday)
        .first();

      if (todayInstance) {
        await knex('daily_checklist_instances').where('id', todayInstance.id).update({
          auditor_id: auditorId,
          updated_at: new Date()
        });

        // 4. Update daily checklist copy
        if (todayInstance.daily_checklist_id) {
          await knex('checklists').where('id', todayInstance.daily_checklist_id).update({
            assigned_auditor_id: auditorId,
            updated_at: new Date()
          });

          // 5. Transfer checklist_data from old auditor to new
          if (oldAuditorId && oldAuditorId !== auditorId) {
            await knex('checklist_data')
              .where('checklist_id', todayInstance.daily_checklist_id)
              .where('user_id', oldAuditorId)
              .update({ user_id: auditorId, updated_at: new Date() });
          }
        }
      } else {
        // No today instance — create one
        await DailyAssignmentService.createDailyChecklistInstanceFromRoster(
          checklistId, auditorId, rosterId, formattedToday
        );
      }
    } else {
      // 2. Create new roster
      const [newRosterId] = await knex('rosters').insert({
        checklist_id: checklistId,
        auditor_id: auditorId,
        supervisor_id: supervisorIdJson,
        manager_id: managerIdJson,
        assigned_date: formattedToday,
        is_active: 1,
        created_by: createdBy,
        created_at: new Date(),
        updated_at: new Date()
      });
      rosterId = newRosterId;

      // 3. Check for existing today instance (from previous assignment)
      const existingTodayInstance = await knex('daily_checklist_instances')
        .where('template_checklist_id', checklistId)
        .where('assigned_date', formattedToday)
        .first();

      if (existingTodayInstance) {
        const oldInstanceAuditorId = existingTodayInstance.auditor_id;

        await knex('daily_checklist_instances').where('id', existingTodayInstance.id).update({
          roster_id: newRosterId,
          auditor_id: auditorId,
          updated_at: new Date()
        });

        if (existingTodayInstance.daily_checklist_id) {
          await knex('checklists').where('id', existingTodayInstance.daily_checklist_id).update({
            assigned_auditor_id: auditorId,
            updated_at: new Date()
          });

          // Transfer checklist_data
          if (oldInstanceAuditorId && oldInstanceAuditorId !== auditorId) {
            await knex('checklist_data')
              .where('checklist_id', existingTodayInstance.daily_checklist_id)
              .where('user_id', oldInstanceAuditorId)
              .update({ user_id: auditorId, updated_at: new Date() });
          }
        }
      } else {
        // Create fresh daily instance
        await DailyAssignmentService.createDailyChecklistInstanceFromRoster(
          checklistId, auditorId, rosterId, formattedToday
        );
      }
    }

    logger.info('[ROTATION] syncAuditorToRoster complete', { checklistId, auditorId, rosterId });
  }

  // =====================================================
  // Switch active option
  // =====================================================
  static async switchOption(optionId, userId, date = null) {
    const activateDate = date || new Date().toISOString().split('T')[0];

    // Log the switch
    await knex('rotation_active_log').insert({
      option_id: optionId,
      activated_date: activateDate,
      activated_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Sync all checklists in the new active option to rosters
    const checklists = await knex('rotation_checklists')
      .where('option_id', optionId);

    for (const rc of checklists) {
      // Get effective auditor (respects temp swaps for today)
      const { auditorId } = await this.getEffectiveAuditor(rc.id, activateDate);

      // Sync to rosters + daily instance
      await this.syncAuditorToRoster(rc.checklist_id, auditorId, userId);
    }

    logger.info('[ROTATION] switchOption complete', { optionId, activateDate, checklistCount: checklists.length });
    return { option_id: optionId, activated_date: activateDate };
  }

  // =====================================================
  // Assign auditor to a rotation checklist (from UI)
  // =====================================================
  static async assignAuditor(rotationChecklistId, auditorId, userId) {
    const rc = await knex('rotation_checklists').where('id', rotationChecklistId).first();
    if (!rc) throw new Error('Rotation checklist not found');

    // Update rotation_checklists table
    await knex('rotation_checklists').where('id', rotationChecklistId).update({
      auditor_id: auditorId || null,
      updated_at: new Date()
    });

    // Only sync to roster if THIS option is currently active
    const activeOption = await this.getActiveOption();
    if (activeOption && activeOption.option_id === rc.option_id) {
      await this.syncAuditorToRoster(rc.checklist_id, auditorId, userId);
    }

    logger.info('[ROTATION] assignAuditor complete', { rotationChecklistId, checklistId: rc.checklist_id, auditorId });
  }

  // =====================================================
  // Temp swap auditor for one day
  // =====================================================
  static async tempSwapAuditor(rotationChecklistId, tempAuditorId, swapDate, swappedBy) {
    const rc = await knex('rotation_checklists').where('id', rotationChecklistId).first();
    if (!rc) throw new Error('Rotation checklist not found');

    // Check if checklist is already completed for this date
    const todayInstance = await knex('daily_checklist_instances')
      .where('template_checklist_id', rc.checklist_id)
      .where('assigned_date', swapDate)
      .first();

    if (todayInstance && todayInstance.daily_checklist_id) {
      const completedStatuses = ['Awaiting for NC response', 'Accepted by Supervisor', 'Completed', 'Completed without NCs', 'Pending by Supervisor'];
      const checklist = await knex('checklists').where('id', todayInstance.daily_checklist_id).first('status');
      if (checklist && completedStatuses.includes(checklist.status)) {
        throw new Error(`Already user completed this checklist (${swapDate})`);
      }
    }

    // Upsert temp swap record
    const existing = await knex('rotation_temp_swaps')
      .where('rotation_checklist_id', rotationChecklistId)
      .where('swap_date', swapDate)
      .first();

    if (existing) {
      await knex('rotation_temp_swaps').where('id', existing.id).update({
        temp_auditor_id: tempAuditorId,
        swapped_by: swappedBy,
        updated_at: new Date()
      });
    } else {
      await knex('rotation_temp_swaps').insert({
        rotation_checklist_id: rotationChecklistId,
        original_auditor_id: rc.auditor_id,
        temp_auditor_id: tempAuditorId,
        swap_date: swapDate,
        swapped_by: swappedBy,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // If swap is for today, update ONLY today's daily instance (NOT the roster)
    const today = new Date().toISOString().split('T')[0];
    if (swapDate === today) {
      const todayInstance = await knex('daily_checklist_instances')
        .where('template_checklist_id', rc.checklist_id)
        .where('assigned_date', swapDate)
        .first();

      if (todayInstance) {
        const previousAuditorId = todayInstance.auditor_id;

        await knex('daily_checklist_instances').where('id', todayInstance.id).update({
          auditor_id: tempAuditorId,
          status: todayInstance.status === 'unassigned' ? 'assigned' : todayInstance.status,
          updated_at: new Date()
        });

        if (todayInstance.daily_checklist_id) {
          await knex('checklists').where('id', todayInstance.daily_checklist_id).update({
            assigned_auditor_id: tempAuditorId,
            updated_at: new Date()
          });

          // Transfer checklist_data to new temp auditor
          // On 2nd+ swap, data may be under previous temp auditor OR original auditor
          // Transfer ALL non-temp-auditor data to the new temp auditor
          if (previousAuditorId && previousAuditorId !== tempAuditorId) {
            await knex('checklist_data')
              .where('checklist_id', todayInstance.daily_checklist_id)
              .where('user_id', previousAuditorId)
              .update({ user_id: tempAuditorId, updated_at: new Date() });
          }
          // Also transfer from original permanent auditor if data still exists under them
          if (rc.auditor_id && rc.auditor_id !== tempAuditorId && rc.auditor_id !== previousAuditorId) {
            await knex('checklist_data')
              .where('checklist_id', todayInstance.daily_checklist_id)
              .where('user_id', rc.auditor_id)
              .update({ user_id: tempAuditorId, updated_at: new Date() });
          }
          // Also reactivate roster temporarily so daily instance is visible
          const roster = await knex('rosters').where('checklist_id', rc.checklist_id).first();
          if (roster && !roster.is_active) {
            await knex('rosters').where('id', roster.id).update({
              is_active: 1,
              updated_at: new Date()
            });
          }
        }
      } else {
        // Use syncAuditorToRoster temporarily, then revert roster
        await this.syncAuditorToRoster(rc.checklist_id, tempAuditorId, swappedBy);
        // Revert roster back to permanent auditor (so next day uses correct one)
        await knex('rosters').where('checklist_id', rc.checklist_id).where('is_active', true).update({
          auditor_id: rc.auditor_id,
          updated_at: new Date()
        });
      }
    }

    logger.info('[ROTATION] tempSwapAuditor complete', { rotationChecklistId, checklistId: rc.checklist_id, tempAuditorId, swapDate });
    return { rotation_checklist_id: rotationChecklistId, temp_auditor_id: tempAuditorId, swap_date: swapDate };
  }

  // =====================================================
  // Temp UNASSIGN for one day (nobody sees it that day, next day reverts)
  // =====================================================
  static async tempUnassign(rotationChecklistId, unassignDate, unassignedBy) {
    const rc = await knex('rotation_checklists').where('id', rotationChecklistId).first();
    if (!rc) throw new Error('Rotation checklist not found');

    // Find today's instance
    const todayInstance = await knex('daily_checklist_instances')
      .where('template_checklist_id', rc.checklist_id)
      .where('assigned_date', unassignDate)
      .first();

    // Check if already completed
    if (todayInstance && todayInstance.daily_checklist_id) {
      const completedStatuses = ['Awaiting for NC response', 'Accepted by Supervisor', 'Completed', 'Completed without NCs', 'Pending by Supervisor'];
      const checklist = await knex('checklists').where('id', todayInstance.daily_checklist_id).first('status');
      if (checklist && completedStatuses.includes(checklist.status)) {
        throw new Error(`Already completed this checklist (${unassignDate})`);
      }
    }

    // Also block if auditor has started filling data (draft)
    if (todayInstance && todayInstance.daily_checklist_id) {
      const hasData = await knex('checklist_data')
        .where('checklist_id', todayInstance.daily_checklist_id)
        .where('submission_status', 'completed')
        .first();
      if (hasData) {
        throw new Error(`Already data entered for this checklist (${unassignDate})`);
      }
    }

    // Upsert temp swap with null auditor (means unassigned for that day)
    const existing = await knex('rotation_temp_swaps')
      .where('rotation_checklist_id', rotationChecklistId)
      .where('swap_date', unassignDate)
      .first();

    if (existing) {
      await knex('rotation_temp_swaps').where('id', existing.id).update({
        temp_auditor_id: null,
        swapped_by: unassignedBy,
        updated_at: new Date()
      });
    } else {
      await knex('rotation_temp_swaps').insert({
        rotation_checklist_id: rotationChecklistId,
        original_auditor_id: rc.auditor_id,
        temp_auditor_id: null,
        swap_date: unassignDate,
        swapped_by: unassignedBy,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // If unassign is for today, nullify the daily instance + daily checklist
    const today = new Date().toISOString().split('T')[0];
    if (unassignDate === today && todayInstance) {
      await knex('daily_checklist_instances').where('id', todayInstance.id).update({
        auditor_id: null,
        status: 'unassigned',
        updated_at: new Date()
      });

      if (todayInstance.daily_checklist_id) {
        await knex('checklists').where('id', todayInstance.daily_checklist_id).update({
          assigned_auditor_id: null,
          updated_at: new Date()
        });
      }

      // Also deactivate roster temporarily for today so createDailyInstancesFromRosters won't re-assign
      const roster = await knex('rosters').where('checklist_id', rc.checklist_id).where('is_active', 1).first();
      if (roster) {
        await knex('rosters').where('id', roster.id).update({
          is_active: 0,
          updated_at: new Date()
        });
      }
    }

    logger.info('[ROTATION] tempUnassign complete', { rotationChecklistId, checklistId: rc.checklist_id, unassignDate });
    return { rotation_checklist_id: rotationChecklistId, swap_date: unassignDate };
  }

  // =====================================================
  // Create daily instances for active rotation option (called by daily cron/startup)
  // This respects temp swaps for the target date
  // =====================================================
  static async createRotationDailyInstances(targetDate) {
    const dateObj = new Date(targetDate);
    if (dateObj.getDay() === 0) return; // Skip Sunday

    const activeOption = await this.getActiveOption(targetDate);
    if (!activeOption) return;

    const checklists = await knex('rotation_checklists')
      .where('option_id', activeOption.option_id);

    for (const rc of checklists) {
      const { auditorId } = await this.getEffectiveAuditor(rc.id, targetDate);
      if (!auditorId) continue;

      // Sync roster for this date's auditor
      await this.syncAuditorToRoster(rc.checklist_id, auditorId, activeOption.activated_by);
    }

    logger.info('[ROTATION] createRotationDailyInstances complete', { targetDate, optionId: activeOption.option_id, count: checklists.length });
  }

  // =====================================================
  // Get all checklist IDs that are in rotation (for read-only detection)
  // =====================================================
  static async getRotationChecklistIds() {
    const rows = await knex('rotation_checklists').select('checklist_id');
    return rows.map(r => r.checklist_id);
  }
}

module.exports = RotationService;
