const knex = require('../config/database');
const DailyExtraService = require('../services/DailyExtraService');
const logger = require('../config/logger');

const createExtraAssignment = async (req, res) => {
  try {
    const { checklist_id, auditor_id, assign_date } = req.body;

    if (!checklist_id || !auditor_id || !assign_date) {
      return res.status(400).json({ error: 'checklist_id, auditor_id, and assign_date are required' });
    }

    const id = await DailyExtraService.createExtraAssignment(
      checklist_id, auditor_id, assign_date, req.user.id
    );

    res.status(201).json({ message: 'Extra assignment created', id });
  } catch (error) {
    logger.error('[EXTRA] Create error:', error);
    res.status(error.message.includes('already assigned') ? 409 : 500)
      .json({ error: error.message });
  }
};

const getExtraAssignments = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param is required' });

    const extras = await DailyExtraService.getExtrasByDate(date);
    res.json({ message: 'Extra assignments retrieved', extras });
  } catch (error) {
    logger.error('[EXTRA] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch extra assignments', details: error.message });
  }
};

const getAvailableChecklistsForExtra = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param is required' });

    let baseQuery = knex('checklists')
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .leftJoin('rosters', function() {
        this.on('rosters.checklist_id', 'checklists.id').andOn('rosters.is_active', knex.raw('1'));
      })
      .where('checklists.is_active', true)
      .where('checklists.checklist_name', 'not like', '%-%-%User%')
      .whereNotExists(function() {
        this.select('*')
          .from('daily_checklist_instances')
          .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      })
      .where(function() {
        this.whereNull('rosters.id').orWhereNull('rosters.auditor_id');
      })
      .whereNotExists(function() {
        this.select('*').from('daily_extra_assignments')
          .whereRaw('daily_extra_assignments.checklist_id = checklists.id')
          .where('daily_extra_assignments.assign_date', date);
      });

    const dateObj = new Date(date);
    const formattedDate = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
    baseQuery = baseQuery.where(knex.raw('DATE(checklists.created_at)'), '<=', formattedDate);

    const checklists = await baseQuery
      .select(
        'checklists.id',
        'checklists.checklist_name',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name'
      )
      .orderBy('checklists.checklist_name');

    res.json({ message: 'Available checklists for extra assignment', checklists });
  } catch (error) {
    logger.error('[EXTRA] Get available checklists error:', error);
    res.status(500).json({ error: 'Failed to fetch checklists', details: error.message });
  }
};

const deleteExtraAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    await DailyExtraService.deleteExtraAssignment(id);
    res.json({ message: 'Extra assignment removed' });
  } catch (error) {
    logger.error('[EXTRA] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete extra assignment', details: error.message });
  }
};

module.exports = { createExtraAssignment, getExtraAssignments, getAvailableChecklistsForExtra, deleteExtraAssignment };
