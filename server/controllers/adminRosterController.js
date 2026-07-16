const Roster = require('../models/Roster');
const User = require('../models/User');
const Checklist = require('../models/Checklist');
const DailyChecklistInstance = require('../models/DailyChecklistInstance');
const { getAutoAssignedUsers } = require('../utils/userService');
const { formatDate } = require('../utils/dateFormatter');
const logger = require('../config/logger');
const ExcelJS = require('exceljs');
const { styleHeaderRow } = require('../utils/excelHelper');
const { enqueueEmail } = require('../services/emailQueueService');

const getAdminRosterView = async (req, res) => {
  try {
    const knex = require('../config/database');
    
    // Get ALL template checklists
    const templateChecklists = await knex('checklists')
      .select(
        'checklists.id',
        'checklists.checklist_name',
        'checklists.location_id',
        'checklists.name_id',
        'checklists.department_id',
        'locations.name as location_name',
        'names.name as facility_name',
        'departments.name as department_name'
      )
      .leftJoin('locations', 'checklists.location_id', 'locations.id')
      .leftJoin('names', 'checklists.name_id', 'names.id')
      .leftJoin('departments', 'checklists.department_id', 'departments.id')
      .where('checklists.is_active', true)
      .whereNotExists(function() {
        this.select('*')
          .from('daily_checklist_instances')
          .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      })
      .orderBy('checklists.created_at', 'desc');
    
      // Get roster assignments (only needed columns, indexed by is_active+checklist_id)
      const rosters = await knex('rosters')
      .select('id', 'checklist_id', 'auditor_id', 'supervisor_id', 'manager_id')
      .where('is_active', true);
    
    // Get all users
    const users = await User.findWithRole({ 'users.is_active': true });
    
    // Merge ALL checklists with roster data
    const enhancedAssignments = templateChecklists.map(checklist => {
      const roster = rosters.find(r => r.checklist_id === checklist.id);
      
      let auditorName = '';
      let supervisorNames = '';
      let managerNames = '';
      
      if (roster) {
        const auditor = users.find(u => u.id == roster.auditor_id);
        auditorName = auditor ? auditor.username : '';
        
        if (roster.supervisor_id) {
          try {
            const supervisorIds = JSON.parse(roster.supervisor_id);
            supervisorNames = supervisorIds.map(id => {
              const user = users.find(u => u.id == id);
              return user ? user.username : null;
            }).filter(name => name).join(', ');
          } catch (e) {
            const user = users.find(u => u.id == roster.supervisor_id);
            supervisorNames = user ? user.username : '';
          }
        }
        
        if (roster.manager_id) {
          try {
            const managerIds = JSON.parse(roster.manager_id);
            managerNames = managerIds.map(id => {
              const user = users.find(u => u.id == id);
              return user ? user.username : null;
            }).filter(name => name).join(', ');
          } catch (e) {
            const user = users.find(u => u.id == roster.manager_id);
            managerNames = user ? user.username : '';
          }
        }
      }
      
      return {
        id: roster?.id || null,
        checklist_id: checklist.id,
        checklist_name: checklist.checklist_name,
        location_name: checklist.location_name,
        facility_name: checklist.facility_name,
        department_name: checklist.department_name,
        auditor_id: roster?.auditor_id || null,
        auditor_name: auditorName,
        supervisor_names: supervisorNames,
        manager_names: managerNames
      };
    });


    res.json({
      message: 'Admin roster view retrieved successfully',
      data: { 
        users: [{ assignments: enhancedAssignments }],
        checklists: templateChecklists
      }
    });
  } catch (error) {
    logger.error('[ADMIN-ROSTER] Error in getAdminRosterView', { error: error });
    res.status(500).json({ error: 'Failed to Fetch Rosters', details: error.message });
  }
};

const updateRosterAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { auditor_id } = req.body;
    const knex = require('../config/database');

    const roster = await Roster.findById(id);
    if (!roster) {
      logger.warn('[ADMIN-ROSTER] Roster not found', { roster_id: id });
      return res.status(404).json({ error: 'Roster not found' });
    }

    // Block if checklist is managed by rotation roster
    const RotationService = require('../services/RotationService');
    const rotationIds = await RotationService.getRotationChecklistIds();
    if (rotationIds.includes(roster.checklist_id)) {
      return res.status(403).json({ error: 'This checklist is managed by Rotation Roster' });
    }

    const checklistId = roster.checklist_id;
    const today = new Date();
    const formattedTodayStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;

    if (!auditor_id) {
      const oldAuditorId = roster.auditor_id;

      await knex('rosters').where('id', id).del();
  

      const deletedCount = await knex('daily_checklist_instances')
        .where('template_checklist_id', checklistId)
        .where('auditor_id', oldAuditorId)
        .where('assigned_date', '>=', formattedTodayStr)
        .del();

      return res.json({ message: 'User unassigned successfully' });
    }

    const autoAssigned = await getAutoAssignedUsers(auditor_id, checklistId);

    const updateData = {
      auditor_id,
      supervisor_id: JSON.stringify(autoAssigned.supervisors.map(s => s.id)),
      manager_id: JSON.stringify(autoAssigned.managers.map(m => m.id)),
      updated_at: new Date()
    };


    if (roster.auditor_id !== auditor_id) {
      const oldAuditorId = roster.auditor_id;

      await knex('rosters').where('id', id).update(updateData);
      logger.info('Roster updated (auditor changed)', { roster_id: id, old_auditor_id: oldAuditorId, new_auditor_id: auditor_id, supervisor_id: updateData.supervisor_id, manager_id: updateData.manager_id });

      const deletedCount = await knex('daily_checklist_instances')
        .where('template_checklist_id', checklistId)
        .where('auditor_id', oldAuditorId)
        .where('assigned_date', '>=', formattedTodayStr)
        .del();

      const DailyAssignmentService = require('../services/DailyAssignmentService');
      await DailyAssignmentService.createDailyInstancesFromRosters(formatDate(new Date()));

      return res.json({ message: 'User changed successfully' });
    }

    await knex('rosters').where('id', id).update(updateData);

    res.json({ message: 'Roster assignment updated successfully' });
  } catch (error) {
    logger.error('[ADMIN-ROSTER] Error updating roster assignment', { error: error });
    res.status(500).json({ error: 'Failed to Update Roaster', details: error.message });
  }
};

const deleteRosterAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    
    await Roster.delete(id);
    
    const knex = require('../config/database');
    await knex('daily_checklist_instances')
      .where('roster_id', id)
      .del();
    
    res.json({ message: 'Roster assignment deleted successfully' });
  } catch (error) {
    logger.error('Error deleting roster assignment:', error);
    res.status(500).json({ error: 'Failed to Delete Roaster',error_details: error.message });
  }
};

const getRosterEmailConfig = async (req, res) => {
  try {
    const knex = require('../config/database');
    const lastEmail = await knex('email_queue')
      .where('checklist_name', 'Roster Report') 
      .orderBy('created_at', 'desc')
      .first('to', 'cc');

    res.json({ to: lastEmail?.to || '', cc: lastEmail?.cc || '' });
  } catch (error) {
    logger.error('Get Roster Email Config Error:', error);
    res.status(500).json({ error: 'Failed to fetch email config' });
  }
};

const sendRosterEmail = async (req, res) => {
  try {
    const { to, cc } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient email is required' });

    const knex = require('../config/database');
    const toEmails = to.split(',').map(e => e.trim()).filter(Boolean).join(', ');
    const ccEmails = cc ? cc.split(',').map(e => e.trim()).filter(Boolean).join(', ') : '';

    // Fetch same data as getRosters (matching /roster page query)
    const templateChecklists = await knex('checklists')
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
      .where('checklists.checklist_name', 'not like', '%-%-%User%')
      .whereNotExists(function() {
        this.select('*').from('daily_checklist_instances').whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
      })
      .orderBy('checklists.created_at', 'desc');

    const rosters = await knex('rosters')
      .select('id', 'checklist_id', 'auditor_id', 'supervisor_id', 'manager_id')
      .where('is_active', true);

    const users = await User.findWithRole({ 'users.is_active': true });

    const rows = templateChecklists.map(checklist => {
      const roster = rosters.find(r => r.checklist_id === checklist.id);
      let auditorName = '-', supervisorNames = '-', managerNames = '-';

      if (roster) {
        const auditor = users.find(u => u.id == roster.auditor_id);
        auditorName = auditor ? auditor.username : '-';

        if (roster.supervisor_id) {
          try {
            const ids = JSON.parse(roster.supervisor_id);
            supervisorNames = ids.map(id => users.find(u => u.id == id)?.username).filter(Boolean).join(', ') || '-';
          } catch (e) { supervisorNames = '-'; }
        }

        if (roster.manager_id) {
          try {
            const ids = JSON.parse(roster.manager_id);
            managerNames = ids.map(id => users.find(u => u.id == id)?.username).filter(Boolean).join(', ') || '-';
          } catch (e) { managerNames = '-'; }
        }
      }

      return {
        'Checklist': checklist.checklist_name,
        'Location': checklist.location_name || '-',
        'Department': checklist.department_name || '-',
        'Auditor': auditorName
      };
    });

    // Generate Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Roster');
    worksheet.columns = [
      { header: 'Checklist', key: 'Checklist', width: 30 },
      { header: 'Location', key: 'Location', width: 20 },
      { header: 'Department', key: 'Department', width: 20 },
      { header: 'Auditor', key: 'Auditor', width: 20 }
    ];
    rows.forEach(row => worksheet.addRow(row));
    styleHeaderRow(worksheet);

    const excelBuffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().split('T')[0];

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <p>Dear Team,</p>
        <p>Please find attached the <strong>Roster Report</strong> generated on <strong>${today}</strong>.</p>
        <br>
        <p style="margin: 0;">Regards,</p>
        <p style="margin: 0;"><strong>Virtual Auditor</strong></p>
        <p style="margin: 0;">HEPL</p>
      </div>
    `;

    await enqueueEmail({
      to: toEmails,
      cc: ccEmails || undefined,
      subject: `Roster Report - ${today}`,
      html,
      attachments: [{ filename: `Roster_Report_${today}.xlsx`, content: excelBuffer }],
      checklistName: 'Roster Report'
    });

    res.json({ message: 'Email queued successfully' });
  } catch (error) {
    logger.error('Send Roster Email Error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
};

module.exports = {
  getAdminRosterView,
  updateRosterAssignment,
  deleteRosterAssignment,
  getRosterEmailConfig,
  sendRosterEmail
};
