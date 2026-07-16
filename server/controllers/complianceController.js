const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { sendSuccess, sendError, sendCreated } = require('../utils/responseHelper');
const logger = require('../config/logger');

class ComplianceController {

  // Dashboard - all tickets created by auditors
  static async getDashboard(req, res) {
    try {
      const tickets = await db('tickets')
        .select([
          'tickets.*',
          'users.username as user_name',
          'users.email as user_email',
          'users.role_id as creator_role_id',
          'roles.name as creator_role_name',
          'vendor.name as vendor_name',
          'vendor.role as vendor_role',
          'engineer.name as engineer_name',
          'engineer.role as engineer_role',
          'tickets.completed_at as admin_completed_at',
          'tickets.vendor_completed_at',
          'tickets.engineer_completed_at',
          'tickets.nvr',
          'tickets.camera_no'
        ])
        .leftJoin('users', 'tickets.user_id', 'users.id')
        .leftJoin('roles', 'users.role_id', 'roles.id')
        .leftJoin('compliance_users as vendor', 'tickets.assigned_vendors', 'vendor.id')
        .leftJoin('compliance_users as engineer', 'tickets.assigned_engineers', 'engineer.id')
        .whereNull('tickets.deleted_at')
        .orderBy('tickets.created_at', 'desc');

      // Calculate and update aging for each ticket
      const ticketsWithAging = await Promise.all(tickets.map(async (ticket) => {
        const currentDate = new Date();
        
        // Check if ticket is completed (using mapped database status)
        const isCompleted = ticket.status === 'Completed';
        const isVendorCompleted = ticket.vendor_status === 'Completed';
        const isEngineerCompleted = ticket.engineer_status === 'Completed';
        
        // Admin Aging: 
        // - If completed: Completion Date - Created Date
        // - If active: Current Date - Created Date
        const createdDate = new Date(ticket.created_at);
        let adminAging;
        if (isCompleted && ticket.completed_at) {
          const completionDate = new Date(ticket.completed_at);
          adminAging = Math.floor((completionDate - createdDate) / (1000 * 60 * 60 * 24));
        } else {
          adminAging = Math.floor((currentDate - createdDate) / (1000 * 60 * 60 * 24));
        }
        
        // Vendor Aging: Only if vendor assigned
        let vendorAging = null;
        if (ticket.assigned_vendors && ticket.user_assign_date) {
          const assignDate = new Date(ticket.user_assign_date);
          if (isVendorCompleted && ticket.vendor_completed_at) {
            const completionDate = new Date(ticket.vendor_completed_at);
            vendorAging = Math.floor((completionDate - assignDate) / (1000 * 60 * 60 * 24));
          } else {
            vendorAging = Math.floor((currentDate - assignDate) / (1000 * 60 * 60 * 24));
          }
        }
        
        // Engineer Aging: Only if engineer assigned
        let engineerAging = null;
        if (ticket.assigned_engineers && ticket.user_assign_date) {
          const assignDate = new Date(ticket.user_assign_date);
          if (isEngineerCompleted && ticket.engineer_completed_at) {
            const completionDate = new Date(ticket.engineer_completed_at);
            engineerAging = Math.floor((completionDate - assignDate) / (1000 * 60 * 60 * 24));
          } else {
            engineerAging = Math.floor((currentDate - assignDate) / (1000 * 60 * 60 * 24));
          }
        }
        
        // Update aging in database
        await db('tickets').where('id', ticket.id).update({
          admin_aging: adminAging,
          vendor_aging: vendorAging,
          engineer_aging: engineerAging
        });
        
        ticket.admin_aging = adminAging;
        ticket.vendor_aging = vendorAging;
        ticket.engineer_aging = engineerAging;
        
        // Parse interested_party and fetch names
        if (ticket.interested_party) {
          try {
            const interestedIds = typeof ticket.interested_party === 'string' ? JSON.parse(ticket.interested_party) : ticket.interested_party;
            if (Array.isArray(interestedIds) && interestedIds.length > 0) {
              const interestedUsers = await db('compliance_users').whereIn('id', interestedIds).select('name');
              ticket.interested_party_names = interestedUsers.map(u => u.name).join(', ');
            }
          } catch(error) {
            logger.error('Error parsing interested_party for ticket ID ' + ticket.id, error);
          }
        }
        
        return ticket;
      }));

      return sendSuccess(res, 'Tickets retrieved successfully', { tickets: ticketsWithAging, total: ticketsWithAging.length });
    } catch (error) {
      logger.error('Compliance dashboard error:', error);
      return sendError(res, 500, 'Failed to retrieve tickets');
    }
  }

  // Masters - get all compliance users
  static async getUsers(req, res) {
    try {
      const users = await db('compliance_users').whereNull('deleted_at').select('id','name','email','employee_id','role','is_active','created_at').orderBy('created_at', 'desc');
      return sendSuccess(res, 'Users retrieved successfully', { users });
    } catch (error) {
      logger.error('Error retrieving compliance users:', error);
      return sendError(res, 500, 'Failed to retrieve users');
    }
  }

  // Masters - create compliance user
  static async createUser(req, res) {
    try {
      const { name, email, employee_id, role, password } = req.body;

      if (!name || !role || !password) return sendError(res, 400, 'Name, role and password are required');
      if (!['VS User', 'Vendor', 'Engineer', 'Viewer'].includes(role)) return sendError(res, 400, 'Invalid role');

      const hashedPassword = await bcrypt.hash(password, 10);
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

      const [id] = await db('compliance_users').insert({
        name: capitalizedName,
        email: email || null,
        employee_id: employee_id || null,
        role,
        password: hashedPassword,
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date()
      });

      const user = await db('compliance_users').where('id', id).select('id','name','email','employee_id','role','is_active','created_at').first();
      return sendCreated(res, 'User created successfully', { user });
    } catch (error) {
      logger.error('Error creating compliance user:', error);
      return sendError(res, 500, 'Failed to create user');
    }
  }

  // Masters - update compliance user
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, email, employee_id, role, password } = req.body;

      const user = await db('compliance_users').where({ id, deleted_at: null }).first();
      if (!user) return sendError(res, 404, 'User not found');

      if (!['VS User', 'Vendor', 'Engineer', 'Viewer'].includes(role)) return sendError(res, 400, 'Invalid role');

      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
      const updateData = { name: capitalizedName, email: email || null, employee_id: employee_id || null, role, updated_at: new Date() };
      if (password) updateData.password = await bcrypt.hash(password, 10);

      await db('compliance_users').where('id', id).update(updateData);
      const updated = await db('compliance_users').where('id', id).select('id','name','email','employee_id','role','is_active','created_at').first();
      return sendSuccess(res, 'User updated successfully', { user: updated });
    } catch (error) {
      logger.error('Error updating compliance user:', error);
      return sendError(res, 500, 'Failed to update user');
    }
  }

  // Masters - delete compliance user (soft delete)
  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const user = await db('compliance_users').where({ id, deleted_at: null }).first();
      if (!user) return sendError(res, 404, 'User not found');

      await db('compliance_users').where('id', id).update({ deleted_at: new Date() });
      return sendSuccess(res, 'User deleted successfully');
    } catch (error) {
      logger.error('Error deleting compliance user:', error);
      return sendError(res, 500, 'Failed to delete user');
    }
  }

  // LOCATIONS MANAGEMENT
  // Masters - get all compliance locations
  static async getLocations(req, res) {
    try {
      const locations = await db('compliance_locations').whereNull('deleted_at').select('id','name','is_active','created_at').orderBy('created_at', 'desc');
      return sendSuccess(res, 'Locations retrieved successfully', { locations });
    } catch (error) {
      return sendError(res, 500, 'Failed to retrieve locations');
    }
  }

  // Masters - create compliance location
  static async createLocation(req, res) {
    try {
      const { name } = req.body;

      if (!name) return sendError(res, 400, 'Name is required');
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

      const [id] = await db('compliance_locations').insert({
        name: capitalizedName,
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date()
      });

      const location = await db('compliance_locations').where('id', id).select('id','name','is_active','created_at').first();
      return sendCreated(res, 'Location created successfully', { location });
    } catch (error) {
      logger.error('Error creating compliance location:', error);
      return sendError(res, 500, 'Failed to create location');
    }
  }

  // Masters - update compliance location
  static async updateLocation(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const location = await db('compliance_locations').where({ id, deleted_at: null }).first();
      if (!location) return sendError(res, 404, 'Location not found');

      const updateData = { name: name.charAt(0).toUpperCase() + name.slice(1), updated_at: new Date() };

      await db('compliance_locations').where('id', id).update(updateData);
      const updated = await db('compliance_locations').where('id', id).select('id','name','is_active','created_at').first();
      return sendSuccess(res, 'Location updated successfully', { location: updated });
    } catch (error) {
      logger.error('Error updating compliance location:', error);
      return sendError(res, 500, 'Failed to update location');
    }
  }

  // Masters - delete compliance location (soft delete)
  static async deleteLocation(req, res) {
    try {
      const { id } = req.params;
      const location = await db('compliance_locations').where({ id, deleted_at: null }).first();
      if (!location) return sendError(res, 404, 'Location not found');

      await db('compliance_locations').where('id', id).update({ deleted_at: new Date() });
      return sendSuccess(res, 'Location deleted successfully');
    } catch (error) {
      logger.error('Error deleting compliance location:', error);
      return sendError(res, 500, 'Failed to delete location');
    }
  }

  // DEPARTMENTS MANAGEMENT
  // Masters - get all compliance departments
  static async getDepartments(req, res) {
    try {
      const departments = await db('compliance_departments').whereNull('deleted_at').select('id','name','is_active','created_at').orderBy('created_at', 'desc');
      return sendSuccess(res, 'Departments retrieved successfully', { departments });
    } catch (error) {
      logger.error('Error retrieving compliance departments:', error);
      return sendError(res, 500, 'Failed to retrieve departments');
    }
  }

  // Masters - create compliance department
  static async createDepartment(req, res) {
    try {
      const { name } = req.body;

      if (!name) return sendError(res, 400, 'Name is required');
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

      const [id] = await db('compliance_departments').insert({
        name: capitalizedName,
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date()
      });

      const department = await db('compliance_departments').where('id', id).select('id','name','is_active','created_at').first();
      return sendCreated(res, 'Department created successfully', { department });
    } catch (error) {
      logger.error('Error creating compliance department:', error);
      return sendError(res, 500, 'Failed to create department');
    }
  }

  // Masters - update compliance department
  static async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const department = await db('compliance_departments').where({ id, deleted_at: null }).first();
      if (!department) return sendError(res, 404, 'Department not found');

      const updateData = { name: name.charAt(0).toUpperCase() + name.slice(1), updated_at: new Date() };

      await db('compliance_departments').where('id', id).update(updateData);
      const updated = await db('compliance_departments').where('id', id).select('id','name','is_active','created_at').first();
      return sendSuccess(res, 'Department updated successfully', { department: updated });
    } catch (error) {
      logger.error('Error updating compliance department:', error);
      return sendError(res, 500, 'Failed to update department');
    }
  }

  // Masters - delete compliance department (soft delete)
  static async deleteDepartment(req, res) {
    try {
      const { id } = req.params;
      const department = await db('compliance_departments').where({ id, deleted_at: null }).first();
      if (!department) return sendError(res, 404, 'Department not found');

      await db('compliance_departments').where('id', id).update({ deleted_at: new Date() });
      return sendSuccess(res, 'Department deleted successfully');
    } catch (error) {
      logger.error('Error deleting compliance department:', error);
      return sendError(res, 500, 'Failed to delete department');
    }
  }

  // DIVISIONS MANAGEMENT
  static async getLocationsList(req, res) {
    try {
      const [main, compliance] = await Promise.all([
        db('locations').select('name'),
        db('compliance_locations').whereNull('deleted_at').select('name')
      ]);
      const seen = new Set();
      const locations = [...main, ...compliance].filter(r => {
        if (seen.has(r.name)) return false;
        seen.add(r.name); return true;
      }).sort((a, b) => a.name.localeCompare(b.name));
      return sendSuccess(res, 'Locations retrieved successfully', { locations });
    } catch (error) {
      return sendError(res, 500, 'Failed to retrieve locations');
    }
  }

  static async getDepartmentsList(req, res) {
    try {
      const [main, compliance] = await Promise.all([
        db('departments').select('name'),
        db('compliance_departments').whereNull('deleted_at').select('name')
      ]);
      const seen = new Set();
      const departments = [...main, ...compliance].filter(r => {
        if (seen.has(r.name)) return false;
        seen.add(r.name); return true;
      }).sort((a, b) => a.name.localeCompare(b.name));
      return sendSuccess(res, 'Departments retrieved successfully', { departments });
    } catch (error) {
      return sendError(res, 500, 'Failed to retrieve departments');
    }
  }

  static async getCategories(req, res) {
    try {
      const [cats, compliance] = await Promise.all([
        db('categories').select('name'),
        db('compliance_divisions').whereNull('deleted_at').select('name')
      ]);
      const seen = new Set();
      const divisions = [...cats, ...compliance].filter(r => {
        if (seen.has(r.name)) return false;
        seen.add(r.name); return true;
      }).sort((a, b) => a.name.localeCompare(b.name));
      return sendSuccess(res, 'Categories retrieved successfully', { divisions });
    } catch (error) {
      return sendError(res, 500, 'Failed to retrieve categories');
    }
  }

  static async getChecklists(req, res) {
    try {
      const checklists = await db('checklists')
        .select(
          'checklists.id',
          'checklists.checklist_name',
          'checklists.camera_count',
          'locations.name as location_name',
          'departments.name as department_name',
          'categories.name as category_name'
        )
        .leftJoin('locations', 'checklists.location_id', 'locations.id')
        .leftJoin('departments', 'checklists.department_id', 'departments.id')
        .leftJoin('categories', 'checklists.category_id', 'categories.id')
        .where('checklists.is_active', 1)
        .whereNull('checklists.deleted_at')
        .where('checklists.checklist_name', 'not like', '%-%-%User%')
        .whereNotExists(function() {
          this.select('*').from('daily_checklist_instances')
            .whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
        })
        .orderBy('checklists.checklist_name', 'asc');
      return sendSuccess(res, 'Checklists retrieved successfully', { checklists });
    } catch (error) {
      logger.error('Error retrieving compliance checklists:', error);
      return sendError(res, 500, 'Failed to retrieve checklists');
    }
  }

  static async getDivisions(req, res) {
    try {
      const divisions = await db('compliance_divisions').whereNull('deleted_at').select('id','name','is_active','created_at').orderBy('created_at', 'desc');
      return sendSuccess(res, 'Divisions retrieved successfully', { divisions });
    } catch (error) {
      return sendError(res, 500, 'Failed to retrieve divisions');
    }
  }

  static async createDivision(req, res) {
    try {
      const { name } = req.body;
      if (!name) return sendError(res, 400, 'Name is required');
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
      const [id] = await db('compliance_divisions').insert({ name: capitalizedName, created_by: req.user.id, created_at: new Date(), updated_at: new Date() });
      const division = await db('compliance_divisions').where('id', id).select('id','name','is_active','created_at').first();
      return sendCreated(res, 'Division created successfully', { division });
    } catch (error) {
      return sendError(res, 500, 'Failed to create division');
    }
  }

  static async updateDivision(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const division = await db('compliance_divisions').where({ id, deleted_at: null }).first();
      if (!division) return sendError(res, 404, 'Division not found');
      await db('compliance_divisions').where('id', id).update({ name: name.charAt(0).toUpperCase() + name.slice(1), updated_at: new Date() });
      const updated = await db('compliance_divisions').where('id', id).select('id','name','is_active','created_at').first();
      return sendSuccess(res, 'Division updated successfully', { division: updated });
    } catch (error) {
      return sendError(res, 500, 'Failed to update division');
    }
  }

  static async deleteDivision(req, res) {
    try {
      const { id } = req.params;
      const division = await db('compliance_divisions').where({ id, deleted_at: null }).first();
      if (!division) return sendError(res, 404, 'Division not found');
      await db('compliance_divisions').where('id', id).update({ deleted_at: new Date() });
      return sendSuccess(res, 'Division deleted successfully');
    } catch (error) {
      return sendError(res, 500, 'Failed to delete division');
    }
  }


}

module.exports = ComplianceController;
