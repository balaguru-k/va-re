const User = require('../models/User');
const Role = require('../models/Role');
const xlsx = require('xlsx');
const logger = require('../config/logger');
const { log } = require('winston');

const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || 'active';

    const result = await User.getUsersWithPagination(page, limit, search, status);

    res.json({
      message: 'Users retrieved successfully',
      ...result
    });
  } catch (error) {
    logger.error('Error retrieving users:', error);
    res.status(500).json({ error: 'Failed to fetch Users', details: error.message });
  }
};

const getUser = async (req, res) => {
  try {
    const { id } = req.params;

    const userWithRole = await User.findWithRole({ 'users.id': id });

    if (!userWithRole.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userWithRole[0];

    // Handle department_id - MySQL may return as array or string
    let departmentId = userData.department_id;
    if (Array.isArray(departmentId)) {
      departmentId = JSON.stringify(departmentId);
    } else if (typeof departmentId === 'string' && departmentId && !departmentId.startsWith('[')) {
      const ids = departmentId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      departmentId = JSON.stringify(ids);
    }

    // Handle name_id - may be JSON array of IDs, resolve to array of name strings
    let facilityNames = [];
    if (userData.name_id) {
      try {
        const Name = require('../models/Name');
        let nameIds = userData.name_id;
        if (typeof nameIds === 'string') nameIds = JSON.parse(nameIds);
        if (!Array.isArray(nameIds)) nameIds = [nameIds];
        const nameRecords = await Promise.all(nameIds.map(id => Name.findById(id)));
        facilityNames = nameRecords.filter(Boolean).map(n => n.name);
      } catch (e) {
        logger.error('Error resolving name_ids:', e.message);
        if (userData.facility_name) facilityNames = [userData.facility_name];
      }
    } else if (userData.facility_name) {
      facilityNames = [userData.facility_name];
    }

    // Handle location_id - may be JSON array of IDs, resolve to array of location names
    let locationNames = [];
    let locationIdParsed = userData.location_id;
    if (userData.location_id) {
      try {
        const Location = require('../models/Location');
        let locIds = userData.location_id;
        if (typeof locIds === 'string' && locIds.startsWith('[')) {
          locIds = JSON.parse(locIds);
          const locRecords = await Promise.all(locIds.map(id => Location.findById(id)));
          locationNames = locRecords.filter(Boolean).map(l => l.name);
          locationIdParsed = locIds;
        } else {
          locationNames = userData.location_name ? [userData.location_name] : [];
        }
      } catch (e) {
        logger.error('Error resolving location_ids:', e.message);
        if (userData.location_name) locationNames = [userData.location_name];
      }
    }

    res.json({
      message: 'User retrieved successfully',
      user: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role_name,
        role_id: userData.role_id,
        location_id: locationIdParsed,
        location_name: locationNames.length === 1 ? locationNames[0] : locationNames,
        name_id: userData.name_id,
        facility_name: facilityNames.length === 1 ? facilityNames[0] : facilityNames,
        department_id: departmentId,
        employee_id: userData.employee_id,
        is_active: userData.is_active,
        created_at: userData.created_at,
        updated_at: userData.updated_at
      }
    });
  } catch (error) {
    logger.error('Error retrieving user:', error);
    res.status(500).json({ error: 'Failed to fetch user', details: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, email, password, role_id, location_id, name_input, department_id, employee_id } = req.body;

    // Validate username format
    if (!/^[a-zA-Z0-9_ ]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, spaces, and underscores' });
    }

    if (username.includes('@')) {
      return res.status(400).json({ error: 'Username cannot be an email format' });
    }

    // Validate password length
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // const existingUsername = await User.findByUsername(username);
    // if (existingUsername) {
    //   return res.status(400).json({ error: 'Username already exists' });
    // }

    // Verify role exists
    const role = await Role.findById(role_id);
    if (!role) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Handle name from frontend
    let nameId = null;
    if (name_input) {
      const Name = require('../models/Name');
      let nameValues = [];
      try {
        const parsed = JSON.parse(name_input);
        nameValues = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        nameValues = [name_input.trim()].filter(Boolean);
      }
      if (nameValues.length > 0) {
        const nameIds = await Promise.all(nameValues.map(v => Name.findOrCreate(v.trim()).then(n => n.id)));
        nameId = nameIds.length === 1 ? nameIds[0] : JSON.stringify(nameIds);
      }
    }

    // Handle department_id as array or single value
    let departmentIdValue = null;
    if (department_id) {
      if (Array.isArray(department_id)) {
        departmentIdValue = JSON.stringify(department_id);
      } else if (typeof department_id === 'string' && department_id.trim()) {
        departmentIdValue = JSON.stringify([parseInt(department_id)]);
      }
    } 

    let locationIdValue = null;
    if (location_id) {
      if (Array.isArray(location_id)) {
        locationIdValue = JSON.stringify(location_id);
      } else if (typeof location_id === 'string' && location_id.startsWith('[')) {
        locationIdValue = location_id; // already JSON string
      } else if (location_id) {
        locationIdValue = parseInt(location_id) || null;
      }
    } 


    const userData = {
      username,
      email,
      password,
      role_id,
      location_id: locationIdValue || null,
      name_id: nameId,
      department_id: departmentIdValue,
      employee_id: employee_id || null,
      is_active: true
    };


    const user = await User.create(userData);

    // If new user is Supervisor or Manager, re-sync all roster assignments
    if ([3, 4].includes(parseInt(role_id))) {
      const { syncRosterAssignments } = require('../utils/userService');
      await syncRosterAssignments();
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role_id: user.role_id
      }
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'User Creation Failed', details: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;


    const existingUser = await User.findById(id);

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for duplicate email/username if being updated
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await User.findByEmail(updateData.email);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    if (updateData.username && updateData.username !== existingUser.username) {
      const usernameExists = await User.findByUsername(updateData.username);
      if (usernameExists) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    // Verify role exists if being updated
    if (updateData.role_id) {
      const role = await Role.findById(updateData.role_id);
      if (!role) {
        return res.status(400).json({ error: 'Invalid role' });
      }
    }

    // Handle name from frontend
    if (updateData.name_input !== undefined) {
      if (updateData.name_input && updateData.name_input.trim && updateData.name_input.trim()) {
        const Name = require('../models/Name');
        let nameValues = [];
        try {
          const parsed = JSON.parse(updateData.name_input);
          nameValues = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          nameValues = [updateData.name_input.trim()].filter(Boolean);
        }
        if (nameValues.length > 0) {
          const nameIds = await Promise.all(nameValues.map(v => Name.findOrCreateWithLocation(v.trim(), updateData.location_id).then(n => n.id)));
          updateData.name_id = nameIds.length === 1 ? nameIds[0] : JSON.stringify(nameIds);
        } else {
          updateData.name_id = null;
        }
      } else {
        updateData.name_id = null;
      }
      delete updateData.name_input;
    }

    // Handle department_id as array or single value
    if (updateData.department_id !== undefined) {
      if (updateData.department_id === '' || updateData.department_id === null) {
        updateData.department_id = null;
      } else if (Array.isArray(updateData.department_id)) {
        updateData.department_id = JSON.stringify(updateData.department_id);
      } else if (typeof updateData.department_id === 'string' && updateData.department_id.trim()) {
        updateData.department_id = JSON.stringify([parseInt(updateData.department_id)]);
      }
    }

    if (updateData.location_id !== undefined) {
      if (updateData.location_id === '' || updateData.location_id === null) {
        updateData.location_id = null;
      } else if (Array.isArray(updateData.location_id)) {
        updateData.location_id = JSON.stringify(updateData.location_id);
      } else if (typeof updateData.location_id === 'string' && updateData.location_id.startsWith('[')) {
        // already JSON string, keep as is
      } else if (updateData.location_id) {
        updateData.location_id = parseInt(updateData.location_id) || null;
      }
    }

    // Convert empty strings to null for foreign key fields
    if (updateData.name_id === '') updateData.name_id = null;
    if (updateData.employee_id === '') updateData.employee_id = null;

    // If password is empty (no change), remove it so it's not re-hashed
    if (!updateData.password) {
      delete updateData.password;
    }

    const updatedUser = await User.update(id, updateData);

    // If Supervisor or Manager was updated, re-sync all roster assignments
    const finalRoleId = updateData.role_id || existingUser.role_id;
    if ([3, 4].includes(parseInt(finalRoleId))) {
      const { syncRosterAssignments } = require('../utils/userService');
      await syncRosterAssignments();
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role_id: updatedUser.role_id,
        is_active: updatedUser.is_active
      }
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'User Update Failed' , details: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting super admin
    if (user.role_id === 1) {
      return res.status(400).json({ error: 'Cannot delete Super Admin user' });
    }

    await User.update(id, { is_active: false });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error.message);
    res.status(500).json({ error: 'Failed to delete User', details: error.message });
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll();
    res.json({
      message: 'Roles retrieved successfully',
      roles
    });
  } catch (error) {
    logger.error('Error retrieving roles:', error);
    res.status(500).json({ error: 'Failed to fetch the Roles',details: error.message });
  }
};

const getAssignedDepartments = async (req, res) => {
  try {
    const { locationId } = req.params;
    const { excludeUserId, roleId } = req.query;

    const parsedRoleId = roleId ? parseInt(roleId) : 3;

    // Get all users with the specified location and role (separate pools per role)
    const users = await User.query()
      .select('id', 'username', 'department_id')
      .where('location_id', locationId)
      .where('role_id', parsedRoleId)
      .where('is_active', true)
      .whereNotNull('department_id');

    users.forEach(u => {
    });

    // Collect all assigned department IDs
    const assignedDeptIds = new Set();
    users.forEach(user => {
      // Skip the user being edited
      if (excludeUserId && user.id == excludeUserId) {
        return;
      }

      if (user.department_id) {
        try {
          let deptIds;

          // Handle different formats
          if (Array.isArray(user.department_id)) {
            // MySQL returned as array
            deptIds = user.department_id;
          } else if (typeof user.department_id === 'string') {
            if (user.department_id.startsWith('[')) {
              // JSON string format
              deptIds = JSON.parse(user.department_id);
            } else {
              // Old format: plain number or comma-separated
              deptIds = user.department_id.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            }
          } else if (typeof user.department_id === 'number') {
            // Plain number
            deptIds = [user.department_id];
          }


          if (Array.isArray(deptIds)) {
            deptIds.forEach(id => assignedDeptIds.add(id));
          }
        } catch (e) {
          logger.error('Error processing department IDs for user:', e.message);
        }
      }
    });

    const result = Array.from(assignedDeptIds);

    res.json({
      message: 'Assigned departments retrieved successfully',
      assignedDepartmentIds: result
    });
  } catch (error) {
    logger.error('Get assigned departments error:', error);
    res.status(500).json({ error: 'Failed to fetch departments', details: error.message });
  }
};

const bulkUploadUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!data.length) {
      return res.status(400).json({ error: 'File is empty' });
    }

    const Location = require('../models/Location');
    const Department = require('../models/Department');
    const Name = require('../models/Name');

    const roles = await Role.findAll();
    const locations = await Location.findAll();
    const allDepartments = await Department.findAll();

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const [index, row] of data.entries()) {
      try {
        // Normalize keys to lowercase for easier matching? No, let's assume standard keys.
        // But headers might be "Case Sensitive". Let's try to map loosely.
        const r = {};
        Object.keys(row).forEach(k => r[k.toLowerCase().replace(/\s+/g, '_')] = row[k]);

        // Expected keys after normalization: username, email, password, role, location, facility_name, departments, employee_id

        if (!r.username || !r.email || !r.password || !r.role) {
          throw new Error('Missing required fields (Username, Email, Password, Role)');
        }

        // Check duplicates
        const existingEmail = await User.findByEmail(r.email);
        if (existingEmail) throw new Error(`Email ${r.email} already exists`);

        const existingUsername = await User.findByUsername(r.username);
        if (existingUsername) throw new Error(`Username ${r.username} already exists`);

        // Find Role
        const role = roles.find(role => role.name.toLowerCase() === r.role.toLowerCase());
        if (!role) throw new Error(`Role ${r.role} not found`);

        // Find Location
        let locationId = null;
        if (r.location) {
          const loc = locations.find(l => l.name.toLowerCase() === r.location.toLowerCase());
          if (loc) locationId = loc.id;
        }

        // Handle Facility Name
        let nameId = null;
        if (r.facility_name) {
          const name = await Name.findOrCreate(r.facility_name.trim());
          nameId = name.id;
        }

        // Handle Departments
        let departmentIds = null;
        if (r.departments) {
          const deptNames = r.departments.toString().split(',').map(d => d.trim().toLowerCase());
          const matchedIds = allDepartments
            .filter(d => deptNames.includes(d.name.toLowerCase()))
            .map(d => d.id);
          if (matchedIds.length > 0) {
            departmentIds = JSON.stringify(matchedIds);
          }
        }

        const userData = {
          username: r.username,
          email: r.email,
          password: r.password,
          role_id: role.id,
          location_id: locationId,
          name_id: nameId,
          department_id: departmentIds,
          employee_id: r.employee_id || null,
          is_active: true
        };

        await User.create(userData);
        results.success++;

      } catch (err) {
        results.failed++;
        results.errors.push(`Row ${index + 2} (${row.Username || row.username || 'Unknown'}): ${err.message}`);
        logger.error(`Error processing row ${index + 2}:`, err.message);
      }
    }

    res.json({
      message: 'Bulk upload processed',
      results
    });

  } catch (error) {
    logger.error('Bulk upload error:', error.message);
    res.status(500).json({ error: 'Internal server error during bulk upload', details: error.message });
  }
};

const exportUsers = async (req, res) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = User.query()
      .select('users.*', 'roles.name as role_name', 'locations.name as location_name', 'names.name as facility_name')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .leftJoin('locations', 'users.location_id', 'locations.id')
      .leftJoin('names', 'users.name_id', 'names.id');

    if (status === 'active') {
      query = query.where('users.is_active', true);
    } else if (status === 'inactive') {
      query = query.where('users.is_active', false);
    }

    if (search) {
      query = query.where(function () {
        this.where('users.username', 'like', `%${search}%`)
          .orWhere('users.email', 'like', `%${search}%`);
      });
    }

    const users = await query;

    const Department = require('../models/Department');
    const allDepartments = await Department.findAll();
    const deptMap = {};
    allDepartments.forEach(d => deptMap[d.id] = d.name);

    const exportData = users.map(user => {
      let deptNames = '';
      if (user.department_id) {
        try {
          let ids = user.department_id;
          if (typeof ids === 'string') {
            if (ids.startsWith('[')) ids = JSON.parse(ids);
            else ids = ids.split(',').map(Number); // Handle old csv format if any
          }
          if (Array.isArray(ids)) {
            deptNames = ids.map(id => deptMap[id]).filter(Boolean).join(', ');
          }
        } catch (e) { }
      }

      return {
        'Username': user.username,
        'Email': user.email,
        'Role': user.role_name,
        'Location': user.location_name || '',
        'Facility Name': user.facility_name || '',
        'Departments': deptNames,
        'Employee ID': user.employee_id || '',
        'Status': user.is_active ? 'Active' : 'Inactive',
        'Created At': user.created_at
      };
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(exportData);
    xlsx.utils.book_append_sheet(wb, ws, 'Users');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="users_export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Export users error:', error);
    res.status(500).json({ error: 'User Export Failed', details: error.message });
  }
};

const getBulkUploadSample = async (req, res) => {
  try {
    const headers = [
      {
        'Username': 'johndoe',
        'Email': 'john@example.com',
        'Password': 'password123',
        'Role': 'Manager',
        'Location': 'New York',
        'Facility Name': 'Main Office',
        'Departments': 'HR, IT',
        'Employee ID': 'EMP001'
      }
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(headers);

    // Set column widths for better readability
    const wscols = [
      { wch: 15 }, // Username
      { wch: 25 }, // Email
      { wch: 15 }, // Password
      { wch: 15 }, // Role
      { wch: 15 }, // Location
      { wch: 20 }, // Facility Name
      { wch: 20 }, // Departments
      { wch: 15 }  // Employee ID
    ];
    ws['!cols'] = wscols;

    xlsx.utils.book_append_sheet(wb, ws, 'Sample');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="user_upload_sample.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    logger.error('Get sample file error:', error);
    res.status(500).json({ error: 'sample download failed', details: error.message });
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getRoles,
  getAssignedDepartments,
  bulkUploadUsers,
  exportUsers,
  getBulkUploadSample
};