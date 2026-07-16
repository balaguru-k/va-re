const knex = require('../config/database');
const RotationService = require('../services/RotationService');
const logger = require('../config/logger');

// Get all options with their checklists
const getRotationOptions = async (req, res) => {
  try {
    const options = await knex('rotation_options').where('is_active', true).orderBy('id');

    const optionsWithChecklists = await Promise.all(
      options.map(async (option) => {
        const checklists = await RotationService.getOptionChecklists(option.id);
        return { ...option, checklists };
      })
    );

    // Get current active option
    const activeOption = await RotationService.getActiveOption();

    res.json({
      message: 'Rotation options retrieved successfully',
      options: optionsWithChecklists,
      active_option_id: activeOption?.option_id || null,
      activated_date: activeOption?.activated_date || null
    });
  } catch (error) {
    logger.error('Error getting rotation options:', error);
    res.status(500).json({ error: 'Failed to fetch rotation options', details: error.message });
  }
};

// Create a new option
const createOption = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Option name is required' });

    const [id] = await knex('rotation_options').insert({
      name,
      description: description || null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    });

    res.status(201).json({ message: 'Option created successfully', option: { id, name } });
  } catch (error) {
    logger.error('Error creating rotation option:', error);
    res.status(500).json({ error: 'Failed to create option', details: error.message });
  }
};

// Delete an option
const deleteOption = async (req, res) => {
  try {
    const { id } = req.params;
    await knex('rotation_options').where('id', id).update({ is_active: false, updated_at: new Date() });
    res.json({ message: 'Option deleted successfully' });
  } catch (error) {
    logger.error('Error deleting rotation option:', error);
    res.status(500).json({ error: 'Failed to delete option', details: error.message });
  }
};

// Add checklists to an option (supports multiple)
const addChecklistToOption = async (req, res) => {
  try {
    const { option_id, checklist_ids, checklist_id } = req.body;
    if (!option_id) return res.status(400).json({ error: 'option_id is required' });

    // Support both single and multi
    const ids = checklist_ids || (checklist_id ? [checklist_id] : []);
    if (!ids.length) return res.status(400).json({ error: 'At least one checklist is required' });

    // Only block if already in the SAME option
    const existing = await knex('rotation_checklists')
      .where('option_id', option_id)
      .whereIn('checklist_id', ids);
    if (existing.length) {
      const names = existing.map(e => e.checklist_id).join(', ');
      return res.status(400).json({ error: `Checklist(s) already in this option: ${names}` });
    }

    const inserts = ids.map(cid => ({
      option_id,
      checklist_id: cid,
      auditor_id: null,
      created_at: new Date(),
      updated_at: new Date()
    }));

    await knex('rotation_checklists').insert(inserts);

    res.status(201).json({ message: `${ids.length} checklist(s) added to option` });
  } catch (error) {
    logger.error('Error adding checklist to option:', error);
    res.status(500).json({ error: 'Failed to add checklist', details: error.message });
  }
};

// Remove checklist from option
const removeChecklistFromOption = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the rotation checklist before deleting
    const rc = await knex('rotation_checklists').where('id', id).first();
    if (!rc) return res.status(404).json({ error: 'Rotation checklist not found' });

    // Check if this option is currently active
    const activeOption = await RotationService.getActiveOption();
    if (activeOption && activeOption.option_id === rc.option_id) {
      const today = new Date().toISOString().split('T')[0];

      // Deactivate roster so daily instances won't be created
      const roster = await knex('rosters').where('checklist_id', rc.checklist_id).first();
      if (roster) {
        await knex('rosters').where('id', roster.id).update({
          is_active: 0,
          auditor_id: null,
          updated_at: new Date()
        });

        // Clear today's daily instance so user doesn't see it anymore
        const todayInstance = await knex('daily_checklist_instances')
          .where('roster_id', roster.id)
          .where('assigned_date', today)
          .first();

        if (todayInstance) {
          await knex('daily_checklist_instances').where('id', todayInstance.id).update({
            auditor_id: null,
            status: 'Unassigned',
            updated_at: new Date()
          });

          // Clear assigned_auditor_id on daily checklist copy
          if (todayInstance.daily_checklist_id) {
            await knex('checklists').where('id', todayInstance.daily_checklist_id).update({
              assigned_auditor_id: null,
              updated_at: new Date()
            });
          }
        }
      }
    }

    // Delete from rotation_checklists
    await knex('rotation_checklists').where('id', id).del();

    // Cleanup orphaned temp swaps
    await knex('rotation_temp_swaps').where('rotation_checklist_id', id).del();

    res.json({ message: 'Checklist removed from option' });
  } catch (error) {
    logger.error('Error removing checklist from option:', error);
    res.status(500).json({ error: 'Failed to remove checklist', details: error.message });
  }
};

// Assign auditor to a rotation checklist
const assignAuditor = async (req, res) => {
  try {
    const { id } = req.params;
    const { auditor_id } = req.body;

    await RotationService.assignAuditor(id, auditor_id || null, req.user.id);

    res.json({ message: auditor_id ? 'Auditor assigned successfully' : 'Auditor unassigned successfully' });
  } catch (error) {
    logger.error('Error assigning auditor:', error);
    res.status(500).json({ error: 'Failed to assign auditor', details: error.message });
  }
};

// Switch active option
const switchActiveOption = async (req, res) => {
  try {
    const { option_id, date } = req.body;
    if (!option_id) return res.status(400).json({ error: 'option_id is required' });

    const result = await RotationService.switchOption(option_id, req.user.id, date);
    res.json({ message: 'Option switched successfully', ...result });
  } catch (error) {
    logger.error('Error switching option:', error);
    res.status(500).json({ error: 'Failed to switch option', details: error.message });
  }
};

// Temp swap auditor for one day
const tempSwapAuditor = async (req, res) => {
  try {
    const { rotation_checklist_id, temp_auditor_id, swap_date } = req.body;
    if (!rotation_checklist_id || !temp_auditor_id || !swap_date) {
      return res.status(400).json({ error: 'rotation_checklist_id, temp_auditor_id, and swap_date are required' });
    }

    const result = await RotationService.tempSwapAuditor(
      rotation_checklist_id, temp_auditor_id, swap_date, req.user.id
    );
    res.json({ message: 'Temp swap created successfully', ...result });
  } catch (error) {
    logger.error('Error creating temp swap:', error);
    if (error.message && error.message.startsWith('Already')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create temp swap', details: error.message });
  }
};

// Temp unassign for one day
const tempUnassign = async (req, res) => {
  try {
    const { rotation_checklist_id, unassign_date } = req.body;
    if (!rotation_checklist_id || !unassign_date) {
      return res.status(400).json({ error: 'rotation_checklist_id and unassign_date are required' });
    }

    const result = await RotationService.tempUnassign(
      rotation_checklist_id, unassign_date, req.user.id
    );
    res.json({ message: 'Checklist unassigned for the day', ...result });
  } catch (error) {
    logger.error('Error temp unassign:', error);
    if (error.message && error.message.startsWith('Already')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to unassign', details: error.message });
  }
};

// Get switch history
const getSwitchHistory = async (req, res) => {
  try {
    const history = await knex('rotation_active_log')
      .select('rotation_active_log.*', 'rotation_options.name as option_name', 'users.username as activated_by_name')
      .leftJoin('rotation_options', 'rotation_active_log.option_id', 'rotation_options.id')
      .leftJoin('users', 'rotation_active_log.activated_by', 'users.id')
      .orderBy('rotation_active_log.activated_date', 'desc')
      .limit(50);

    res.json({ message: 'Switch history retrieved', history });
  } catch (error) {
    logger.error('Error getting switch history:', error);
    res.status(500).json({ error: 'Failed to fetch history', details: error.message });
  }
};

// Get available checklists (not already in the specified option)
const getAvailableChecklists = async (req, res) => {
  try {
    const { option_id } = req.query;

    let query = knex('checklists')
      .select(
        'checklists.id',
        'checklists.checklist_name',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name'
      )
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .where('checklists.is_active', true)
      .whereNull('checklists.deleted_at')
      .where('checklists.checklist_name', 'not like', '%-%-%User%')
      .whereNotExists(function() {
        this.select('*').from('daily_checklist_instances')
          .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      });

    // Only exclude checklists already in THIS option
    if (option_id) {
      query = query.whereNotExists(function() {
        this.select('*').from('rotation_checklists')
          .whereRaw('rotation_checklists.checklist_id = checklists.id')
          .where('rotation_checklists.option_id', option_id);
      });
    }

    const checklists = await query.orderBy('checklists.checklist_name');

    res.json({ message: 'Available checklists retrieved', checklists });
  } catch (error) {
    logger.error('Error getting available checklists:', error);
    res.status(500).json({ error: 'Failed to fetch checklists', details: error.message });
  }
};

module.exports = {
  getRotationOptions,
  createOption,
  deleteOption,
  addChecklistToOption,
  removeChecklistFromOption,
  assignAuditor,
  switchActiveOption,
  tempSwapAuditor,
  tempUnassign,
  getSwitchHistory,
  getAvailableChecklists
};
