const User = require('../models/User');
const logger = require('../config/logger');

const syncRosterAssignments = async () => {
  const knex = require('../config/database');
  const rosters = await knex('rosters').where('is_active', true);
  if (!rosters.length) return;

  for (const roster of rosters) {
    const autoAssigned = await getAutoAssignedUsers(roster.auditor_id, roster.checklist_id, true);
    const supervisorIdJson = JSON.stringify(autoAssigned.supervisors.map(s => s.id));
    const managerIdJson = JSON.stringify(autoAssigned.managers.map(m => m.id));

    const changed =
      roster.supervisor_id !== supervisorIdJson ||
      roster.manager_id !== managerIdJson;

    if (changed) {
      await knex('rosters').where('id', roster.id).update({
        supervisor_id: supervisorIdJson,
        manager_id: managerIdJson,
        updated_at: new Date()
      });
    } else {
      logger.info('Roster unchanged', {
        roster_id: roster.id,
        checklist_id: roster.checklist_id,
        supervisor_id: supervisorIdJson,
        manager_id: managerIdJson
      });
    }
  }
};

const getUsersByRole = async (activeOnly = true) => {
  const conditions = activeOnly ? { 'users.is_active': true } : {};
  const users = await User.findWithRole(conditions);
  return {
    auditors: users.filter(u => u.role_name === 'Auditor'),
    managers: users.filter(u => u.role_name === 'Manager'),
    supervisors: users.filter(u => u.role_name === 'Supervisor'),
    all: users
  };
};

const getAutoAssignedUsers = async (auditorId, checklistId = null, silent = false) => {
  let location_id, name_id, department_id;

  if (checklistId) {
    const Checklist = require('../models/Checklist');
    const checklist = await Checklist.findById(checklistId);
    if (checklist) {
      location_id = checklist.location_id;
      name_id = checklist.name_id;
      department_id = checklist.department_id;
      if (!silent) logger.info('[AUTO-ASSIGN] Resolved from checklist', { checklist_id: checklistId, location_id, name_id, department_id });
    } else {
      if (!silent) logger.warn('[AUTO-ASSIGN] Checklist not found', { checklist_id: checklistId });
      return { supervisors: [], managers: [] };
    }
  } else {
    const auditor = await User.findWithRole({ 'users.id': auditorId, 'users.is_active': true });
    if (!auditor || auditor.length === 0) {
      if (!silent) logger.warn('[AUTO-ASSIGN] Auditor not found', { auditor_id: auditorId });
      return { supervisors: [], managers: [] };
    }
    const auditorData = auditor[0];
    location_id = auditorData.location_id;
    name_id = auditorData.name_id;
    department_id = auditorData.department_id;
    if (!silent) logger.info('[AUTO-ASSIGN] Resolved from auditor', { auditor_id: auditorId, location_id, name_id, department_id });
  }

  if (!location_id) {
    if (!silent) logger.warn('[AUTO-ASSIGN] Missing location_id, returning empty', { auditor_id: auditorId, checklist_id: checklistId, location_id, department_id });
    return { supervisors: [], managers: [] };
  }

  // Supervisors: match location + department
  let supervisorQuery = User.query()
    .select('users.*', 'roles.name as role_name')
    .leftJoin('roles', 'users.role_id', 'roles.id')
    .where('users.is_active', true)
    .where('roles.name', 'Supervisor')
    .where('users.location_id', location_id);

  if (department_id) {
    supervisorQuery = supervisorQuery.whereRaw(
      'JSON_CONTAINS(users.department_id, ?)',
      [String(department_id)]
    );
  }

  const supervisors = await supervisorQuery;
  if (!silent) logger.info('[AUTO-ASSIGN] Supervisors matched', {
    location_id, department_id,
    count: supervisors.length,
    ids: supervisors.map(s => ({ id: s.id, username: s.username, department_id: s.department_id }))
  });

  // Managers: match location + department
  let managerQuery = User.query()
    .select('users.*', 'roles.name as role_name')
    .leftJoin('roles', 'users.role_id', 'roles.id')
    .where('users.is_active', true)
    .where('roles.name', 'Manager')
    .where('users.location_id', location_id);

  if (department_id) {
    managerQuery = managerQuery.whereRaw(
      'JSON_CONTAINS(users.department_id, ?)',
      [String(department_id)]
    );
  }

  const managers = await managerQuery;
  if (!silent) logger.info('[AUTO-ASSIGN] Managers matched', {
    location_id, department_id,
    count: managers.length,
    ids: managers.map(m => ({ id: m.id, username: m.username, department_id: m.department_id }))
  });

  return {
    supervisors: supervisors || [],
    managers: managers || []
  };
};

module.exports = { getUsersByRole, getAutoAssignedUsers, syncRosterAssignments };
