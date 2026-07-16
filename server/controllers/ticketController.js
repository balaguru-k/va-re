const Ticket = require('../models/Ticket');
const { sendSuccess, sendError, sendCreated } = require('../utils/responseHelper');
const StatusMapper = require('../utils/statusMapper');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

const ticketsUploadDir = path.join(__dirname, '../uploads/tickets');
if (!fs.existsSync(ticketsUploadDir)) fs.mkdirSync(ticketsUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ticketsUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitizedName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

class TicketController {

  static async checkExistingTickets(req, res) {
    try {
      const { checklist_id } = req.query;
      if (!checklist_id) return sendSuccess(res, 'No checklist_id provided', { tickets: [] });

      // Look up checklist name and clean it (remove date/user suffix)
      const checklist = await db('checklists').select('checklist_name').where('id', checklist_id).first();
      if (!checklist) return sendSuccess(res, 'Checklist not found', { tickets: [] });
      const cleanName = (checklist.checklist_name || '').replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*.+$/, '');

      const tickets = await db('tickets')
        .select('tickets.id', 'tickets.ticket_number', 'tickets.issue', 'tickets.status', 'tickets.vendor_status', 'tickets.engineer_status', 'tickets.created_at', 'users.username as user_name')
        .leftJoin('users', 'tickets.user_id', 'users.id')
        .where('tickets.checklist_name', cleanName)
        .whereNull('tickets.deleted_at')
        .whereIn('tickets.status', ['New', 'Pending', 'Raised'])
        .orderBy('tickets.created_at', 'desc');

      return sendSuccess(res, 'Existing tickets retrieved', { tickets });
    } catch (error) {
      console.error('Check existing tickets error:', error);
      return sendError(res, 500, 'Failed to check existing tickets');
    }
  }

  static async checkNvrCameraConflicts(req, res) {
    try {
      const { location, camera_nos, issue, exclude_ticket_id } = req.query;
      if (!location) return sendSuccess(res, 'No location provided', { cameraConflicts: [] });

      const cameraList = camera_nos ? camera_nos.split(',').filter(Boolean) : [];
      if (cameraList.length === 0) return sendSuccess(res, 'No cameras to check', { cameraConflicts: [] });

      const activeTickets = await db('tickets')
        .select('id', 'ticket_number', 'camera_no', 'issue')
        .where('location', location)
        .whereNull('deleted_at')
        .whereRaw(`COALESCE(vendor_status, engineer_status, status) != 'Completed'`)
        .modify(q => { if (exclude_ticket_id) q.whereNot('id', exclude_ticket_id); });

      const cameraConflicts = [];
      activeTickets.forEach(t => {
        const tCams = (() => { try { return JSON.parse(t.camera_no || '[]'); } catch { return []; } })();
        const matched = cameraList.filter(v => tCams.includes(v));
        if (matched.length > 0 && (!issue || t.issue === issue))
          cameraConflicts.push({ ticket: t.ticket_number || `#${t.id}`, items: matched, issue: t.issue });
      });

      return sendSuccess(res, 'Conflict check complete', { cameraConflicts });
    } catch (error) {
      console.error('Check camera conflicts error:', error);
      return sendError(res, 500, 'Failed to check conflicts');
    }
  }

  static async getLocationCameras(req, res) {
    try {
      const { location } = req.query;
      if (!location) return sendSuccess(res, 'No location provided', { nvrs: [], cameras: [] });

      const cameras = await db('location_cameras')
        .where('location', location)
        .where('is_active', true)
        .select('nvr', 'camera_no', 'category')
        .orderBy('nvr')
        .orderBy('camera_no');

      const nvrs = [...new Set(cameras.map(c => c.nvr))];

      return sendSuccess(res, 'Location cameras retrieved', { nvrs, cameras });
    } catch (error) {
      console.error('Get location cameras error:', error);
      return sendError(res, 500, 'Failed to retrieve location cameras');
    }
  }

  static async getTickets(req, res) {
    try {
      const filters = { deleted_at: null }; // Exclude soft-deleted tickets
      if (req.user.role !== 'Super Admin' && req.user.role !== 'Complaince Admin') {
        filters.user_id = req.user.id;
      }
      const tickets = await Ticket.getTicketsWithUser(filters);
      return sendSuccess(res, 'Tickets retrieved successfully', { tickets, total: tickets.length });
    } catch (error) {
      console.error('Get tickets error:', error);
      return sendError(res, 500, 'Failed to retrieve tickets');
    }
  }

  static async getTicket(req, res) {
    try {
      const { id } = req.params;
      const ticket = await Ticket.getTicketWithUser(id);
      if (!ticket) return sendError(res, 404, 'Ticket not found');
      if (req.user.role !== 'Super Admin' && req.user.role !== 'Complaince Admin' && ticket.user_id !== req.user.id) {
        return sendError(res, 403, 'Access denied');
      }
      return sendSuccess(res, 'Ticket retrieved successfully', { ticket });
    } catch (error) {
      console.error('Get ticket error:', error);
      return sendError(res, 500, 'Failed to retrieve ticket');
    }
  }

  static async createTicket(req, res) {
    try {
      const { issue, remarks, checklist_id, checklist_camera_count, camera_count, location, department } = req.body;
      
      const attachments = req.files ? req.files.map(f => f.filename) : [];
      if (!issue) return sendError(res, 400, 'Issue is required');

      const ticketData = {
        user_id: req.user.id,
        issue,
        remarks: remarks || null,
        checklist_camera_count: checklist_camera_count ? parseInt(checklist_camera_count) : null,
        camera_count: camera_count ? parseInt(camera_count) : null,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
        status: 'New'
      };

      ticketData.location = location ? String(location).substring(0, 100) : null;
      ticketData.department = department ? String(department).substring(0, 500) : null;
      ticketData.category = req.body.category ? String(req.body.category).substring(0, 100) : null;
      ticketData.division = req.body.division ? String(req.body.division).substring(0, 100) : null;
      ticketData.nvr = req.body.nvr || null;
      ticketData.camera_no = req.body.camera_no || null;
      
      if (checklist_id) {
        const checklist = await db('checklists')
          .select('checklists.checklist_name', 'checklists.category_id')
          .where('checklists.id', checklist_id)
          .first();
        
        if (checklist) {
          let cleanChecklistName = checklist.checklist_name;
          if (cleanChecklistName) {
            cleanChecklistName = cleanChecklistName.replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*.+$/, '');
          }
          
          ticketData.checklist_id = checklist_id;
          ticketData.checklist_name = cleanChecklistName;

          // Fetch category from template checklist if available, else from this checklist
          const templateId = checklist_id;
          const categoryRow = await db('checklists')
            .select('categories.name as category_name')
            .leftJoin('categories', 'checklists.category_id', 'categories.id')
            .where('checklists.id', templateId)
            .first();
          
          if (categoryRow?.category_name) {
            ticketData.category = categoryRow.category_name;
          }
        }
      }

      let locationForTicket = ticketData.location || location || 'GENERAL';
      
      if (locationForTicket && (locationForTicket.toLowerCase().includes('checklist') || locationForTicket.toLowerCase().includes('test'))) {
        locationForTicket = 'GENERAL';
      }
      
      const sanitizedLocation = locationForTicket.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      
      // Get the highest sequence number from ALL existing tickets (including deleted)
      const lastTicket = await db('tickets')
        .max('id as max_id')
        .whereNotNull('ticket_number')
        .first();
      
      const lastTicketRow = lastTicket?.max_id ? await db('tickets').select('ticket_number').where('id', lastTicket.max_id).first() : null;
      const lastTicketNumber = lastTicketRow;
      
      let nextSequence = 1;
      if (lastTicketNumber && lastTicketNumber.ticket_number) {
        const match = lastTicketNumber.ticket_number.match(/(\d+)$/);
        if (match) {
          nextSequence = parseInt(match[1]) + 1;
        }
      }
      
      ticketData.ticket_number = `${sanitizedLocation}${nextSequence.toString().padStart(4, '0')}`;

      const ticket = await Ticket.create(ticketData);
      return sendCreated(res, 'Ticket created successfully', { ticket });
    } catch (error) {
      console.error('Create ticket error:', error.message, error.code, error.sqlMessage || '', error.sql || '');
      if (req.files) {
        req.files.forEach(file => {
          const filePath = path.join(ticketsUploadDir, file.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
      }
      return sendError(res, 500, 'Failed to create ticket: ' + (error.sqlMessage || error.message));
    }
  }

  static async updateTicket(req, res) {
    try {
      const { id } = req.params;
      const { issue, remarks, checklist_id, checklist_camera_count, camera_count } = req.body;
      const attachments = req.files ? req.files.map(f => f.filename) : [];
      
      const ticket = await Ticket.findById(id);
      if (!ticket) return sendError(res, 404, 'Ticket not found');
      if (req.user.role !== 'Super Admin' && req.user.role !== 'Complaince Admin' && ticket.user_id !== req.user.id) {
        return sendError(res, 403, 'Access denied');
      }
      
      const updateData = {};
      if (issue) updateData.issue = issue;
      if (remarks !== undefined) updateData.remarks = remarks;
      if (camera_count) updateData.camera_count = parseInt(camera_count);
      if (checklist_camera_count) updateData.checklist_camera_count = parseInt(checklist_camera_count);
      if (req.body.nvr !== undefined) updateData.nvr = req.body.nvr || null;
      if (req.body.camera_no !== undefined) updateData.camera_no = req.body.camera_no || null;
      
      // Handle checklist update
      if (checklist_id) {
        const checklist = await db('checklists')
          .select('checklists.id', 'checklists.checklist_name', 'locations.name as location', 'departments.name as department')
          .leftJoin('locations', 'checklists.location_id', 'locations.id')
          .leftJoin('departments', 'checklists.department_id', 'departments.id')
          .where('checklists.id', checklist_id)
          .first();
        
        if (checklist) {
          // Remove date and user suffix from checklist name
          let cleanChecklistName = checklist.checklist_name;
          if (cleanChecklistName) {
            cleanChecklistName = cleanChecklistName.replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*.+$/, '');
          }
          
          updateData.checklist_id = checklist_id;
          updateData.checklist_name = cleanChecklistName;
          updateData.location = checklist.location;
          updateData.department = checklist.department;
        }
      }
      
      // Handle attachments - replace existing attachments with new ones if provided
      if (attachments.length > 0) {
        updateData.attachments = JSON.stringify(attachments);
      }
      
      const updatedTicket = await Ticket.update(id, updateData);
      return sendSuccess(res, 'Ticket updated successfully', { ticket: updatedTicket });
    } catch (error) {
      console.error('Update ticket error:', error);
      if (req.files) {
        req.files.forEach(file => {
          const filePath = path.join(ticketsUploadDir, file.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
      }
      return sendError(res, 500, 'Failed to update ticket');
    }
  }

  static async deleteTicket(req, res) {
    try {
      const { id } = req.params;
      const ticket = await Ticket.findById(id);
      if (!ticket) return sendError(res, 404, 'Ticket not found');
      if (req.user.role !== 'Super Admin' && req.user.role !== 'Complaince Admin' && ticket.user_id !== req.user.id) {
        return sendError(res, 403, 'Access denied');
      }
      
      // Soft delete - set deleted_at timestamp
      await db('tickets').where('id', id).update({
        deleted_at: new Date(),
        updated_at: new Date()
      });
      
      return sendSuccess(res, 'Ticket deleted successfully');
    } catch (error) {
      console.error('Delete ticket error:', error);
      return sendError(res, 500, 'Failed to delete ticket');
    }
  }

  static async updateTicketStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, status_remarks } = req.body;
      const ticket = await Ticket.findById(id);
      if (!ticket) return sendError(res, 404, 'Ticket not found');
      
      // Map user status to database status
      const dbStatus = StatusMapper.mapToDbStatus(status);
      
      // Set completion timestamp if status is completed
      const updateData = { status: dbStatus, status_remarks };
      if (dbStatus === 'Completed') {
        updateData.completed_at = new Date();
      }
      if (req.body.offline !== undefined) updateData.offline = req.body.offline || null;
      if (req.body.device !== undefined) updateData.device = req.body.device || null;
      
      await db('tickets').where('id', id).update(updateData);
      const updatedTicket = await Ticket.getTicketWithUser(id);
      return sendSuccess(res, 'Ticket updated successfully', { ticket: updatedTicket });
    } catch (error) {
      console.error('Update ticket status error:', error);
      return sendError(res, 500, 'Failed to update ticket status');
    }
  }

  static async updateVendorEngineerStatus(req, res) {
    try {
      const { id } = req.params;
      const { vendor_status, vendor_remarks, engineer_status, engineer_remarks } = req.body;
      const userId = req.user.id;
      const role = req.user.role;

      const ticket = await Ticket.findById(id);
      if (!ticket) return sendError(res, 404, 'Ticket not found');

      const updateData = {};
      
      if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) {
        if (vendor_status) {
          // Map user status to database status and store both
          const dbStatus = StatusMapper.mapToDbStatus(vendor_status);
          updateData.vendor_status = dbStatus;
          updateData.vendor_status_display = vendor_status; // Store original user selection
          
          // Set completion timestamp if status is completed
          if (dbStatus === 'Completed') {
            updateData.vendor_completed_at = new Date();
          }
        }
        if (vendor_remarks !== undefined) updateData.vendor_remarks = vendor_remarks;
        
        // Handle vendor attachments
        if (req.files && req.files.length > 0) {
          const newAttachments = req.files.map(f => f.filename);
          const existingAttachments = ticket.vendor_attachments ? 
            (typeof ticket.vendor_attachments === 'string' ? JSON.parse(ticket.vendor_attachments) : ticket.vendor_attachments) : [];
          updateData.vendor_attachments = JSON.stringify([...existingAttachments, ...newAttachments]);
        }
        if (req.body.offline !== undefined) updateData.offline = req.body.offline || null;
        if (req.body.device !== undefined) updateData.device = req.body.device || null;
      } else if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId) {
        if (engineer_status) {
          // Map user status to database status and store both
          const dbStatus = StatusMapper.mapToDbStatus(engineer_status);
          updateData.engineer_status = dbStatus;
          updateData.engineer_status_display = engineer_status; // Store original user selection
          
          // Set completion timestamp if status is completed
          if (dbStatus === 'Completed') {
            updateData.engineer_completed_at = new Date();
          }
        }
        if (engineer_remarks !== undefined) updateData.engineer_remarks = engineer_remarks;
        
        // Handle engineer attachments
        if (req.files && req.files.length > 0) {
          const newAttachments = req.files.map(f => f.filename);
          const existingAttachments = ticket.engineer_attachments ? 
            (typeof ticket.engineer_attachments === 'string' ? JSON.parse(ticket.engineer_attachments) : ticket.engineer_attachments) : [];
          updateData.engineer_attachments = JSON.stringify([...existingAttachments, ...newAttachments]);
        }
        if (req.body.offline !== undefined) updateData.offline = req.body.offline || null;
        if (req.body.device !== undefined) updateData.device = req.body.device || null;
      } else {
        return sendError(res, 403, 'Access denied');
      }

      await db('tickets').where('id', id).update(updateData);
      const updatedTicket = await Ticket.getTicketWithUser(id);
      return sendSuccess(res, 'Status updated successfully', { ticket: updatedTicket });
    } catch (error) {
      console.error('Update vendor/engineer status error:', error);
      return sendError(res, 500, 'Failed to update status');
    }
  }

  static async getRaiseFormUsers(req, res) {
    try {
      const vendors = await db('compliance_users').where({ role: 'Vendor', is_active: true }).whereNull('deleted_at').select('id', 'name', 'email', 'role');
      const engineers = await db('compliance_users').where({ role: 'Engineer', is_active: true }).whereNull('deleted_at').select('id', 'name', 'email', 'role');
      const allComplianceUsers = await db('compliance_users').where({ is_active: true }).whereNull('deleted_at').select('id', 'name', 'email', 'role');
      // Also fetch Compliance Admin users from main users table
      const complianceAdmins = await db('users')
        .join('roles', 'users.role_id', 'roles.id')
        .where('roles.name', 'Complaince Admin')
        .where('users.is_active', true)
        .select(db.raw(`users.id + 100000 as id`), 'users.username as name', 'users.email', db.raw(`'Complaince Admin' as role`), db.raw('users.id as real_user_id'));
      const allUsers = [...allComplianceUsers, ...complianceAdmins];
      return sendSuccess(res, 'Users retrieved', { vendors, engineers, allUsers });
    } catch (error) {
      console.error('Get raise form users error:', error);
      return sendError(res, 500, 'Failed to retrieve users');
    }
  }

  static async saveRaiseTicket(req, res) {
    try {
      const { id } = req.params;
      const { subject, user_assign_date, assigned_vendors, assigned_engineers, raise_remarks, status_remarks, interested_party } = req.body;
      const isDraft = req.body.is_draft === 'true';

      const ticket = await Ticket.findById(id);
      if (!ticket) return sendError(res, 404, 'Ticket not found');

      const newFiles = req.files ? req.files.map(f => f.filename) : [];
      let existingAttachments = [];
      if (ticket.raise_attachments) {
        try { existingAttachments = typeof ticket.raise_attachments === 'string' ? JSON.parse(ticket.raise_attachments) : ticket.raise_attachments; } catch(e) {}
      }

      await db('tickets').where('id', id).update({
        subject: subject || null,
        user_assign_date: user_assign_date || null,
        assigned_vendors: assigned_vendors || null,
        assigned_engineers: assigned_engineers || null,
        interested_party: interested_party ? JSON.stringify(typeof interested_party === 'string' ? JSON.parse(interested_party) : interested_party) : null,
        status_remarks: raise_remarks || status_remarks || null,
        raise_attachments: JSON.stringify([...existingAttachments, ...newFiles]),
        ...(isDraft ? {} : { status: 'Raised', raised_at: new Date() }),
        updated_at: new Date()
      });

      const updatedTicket = await Ticket.getTicketWithUser(id);
      return sendSuccess(res, isDraft ? 'Draft saved' : 'Ticket raised successfully', { ticket: updatedTicket });
    } catch (error) {
      console.error('Save raise ticket error:', error);
      return sendError(res, 500, 'Failed to save raise ticket');
    }
  }

  static async getTicketsReport(req, res) {
    try {
      const { fromDate, toDate, location, department, division, userId } = req.query;

      let query = db('tickets')
        .select([
          'tickets.location',
          db.raw(`COALESCE(tickets.division, tickets.category) as division`),
          db.raw('SUM(COALESCE(tickets.camera_count, 0)) as total_cameras'),
          db.raw('COUNT(tickets.id) as total_issues'),
          db.raw(`SUM(CASE WHEN COALESCE(tickets.vendor_status, tickets.engineer_status, tickets.status) = 'Completed' THEN 1 ELSE 0 END) as completed_count`),
          db.raw(`SUM(CASE WHEN tickets.offline = 'Internet' THEN 1 ELSE 0 END) as internet_count`),
          db.raw(`SUM(CASE WHEN tickets.offline = 'Power' THEN 1 ELSE 0 END) as power_count`),
          db.raw(`SUM(CASE WHEN tickets.device = 'Hardware' THEN 1 ELSE 0 END) as hardware_count`),
          db.raw(`SUM(CASE WHEN tickets.device = 'Software' THEN 1 ELSE 0 END) as software_count`)
        ])
        .whereNull('tickets.deleted_at')
        .whereRaw(`tickets.location IS NOT NULL`)
        .whereRaw(`tickets.location != ''`);

      if (fromDate) query = query.where('tickets.created_at', '>=', fromDate + ' 00:00:00');
      if (toDate) query = query.where('tickets.created_at', '<=', toDate + ' 23:59:59');
      if (location) query = query.where('tickets.location', location);
      if (department) query = query.where('tickets.department', department);
      if (division) query = query.whereRaw(`COALESCE(tickets.division, tickets.category) = ?`, [division]);

      if (userId) {
        const uids = String(userId).split(',').map(Number).filter(Boolean);
        const realUserIds = uids.filter(id => id > 100000).map(id => id - 100000);
        const complianceIds = uids.filter(id => id <= 100000);
        query = query.where(function() {
          if (complianceIds.length) {
            this.whereIn('tickets.assigned_vendors', complianceIds)
              .orWhereIn('tickets.assigned_engineers', complianceIds);
          }
          if (realUserIds.length) {
            this.orWhereIn('tickets.user_id', realUserIds);
          }
        });
      }

      query = query.groupBy('tickets.location', db.raw(`COALESCE(tickets.division, tickets.category)`)).orderBy('tickets.location');

      const rows = await query;
      return sendSuccess(res, 'Report retrieved successfully', { rows, total: rows.length });
    } catch (error) {
      console.error('Get tickets report error:', error);
      return sendError(res, 500, 'Failed to retrieve report');
    }
  }

  static async getCompletedTickets(req, res) {
    try {
      const { fromDate, toDate, location, department, division, userId } = req.query;

      let query = db('tickets')
        .select([
          'tickets.id',
          'tickets.ticket_number',
          'tickets.issue',
          'tickets.location',
          'tickets.department',
          'tickets.status_remarks',
          'tickets.vendor_remarks',
          'tickets.engineer_remarks',
          'tickets.created_at',
          db.raw(`COALESCE(tickets.division, tickets.category) as division`),
          'users.username as raised_by',
          'vendor_users.name as vendor_name',
          'engineer_users.name as engineer_name'
        ])
        .leftJoin('users', 'tickets.user_id', 'users.id')
        .leftJoin('compliance_users as vendor_users', 'tickets.assigned_vendors', 'vendor_users.id')
        .leftJoin('compliance_users as engineer_users', 'tickets.assigned_engineers', 'engineer_users.id')
        .whereNull('tickets.deleted_at')
        .whereRaw(`COALESCE(tickets.vendor_status, tickets.engineer_status, tickets.status) = 'Completed'`);

      if (fromDate) query = query.where('tickets.created_at', '>=', fromDate + ' 00:00:00');
      if (toDate) query = query.where('tickets.created_at', '<=', toDate + ' 23:59:59');
      if (location) query = query.where('tickets.location', location);
      if (department) query = query.where('tickets.department', department);
      if (division) query = query.whereRaw(`COALESCE(tickets.division, tickets.category) = ?`, [division]);

      if (userId) {
        const uids = String(userId).split(',').map(Number).filter(Boolean);
        const realUserIds = uids.filter(id => id > 100000).map(id => id - 100000);
        const complianceIds = uids.filter(id => id <= 100000);
        query = query.where(function() {
          if (complianceIds.length) {
            this.whereIn('tickets.assigned_vendors', complianceIds)
              .orWhereIn('tickets.assigned_engineers', complianceIds);
          }
          if (realUserIds.length) {
            this.orWhereIn('tickets.user_id', realUserIds);
          }
        });
      }

      query = query.orderBy('tickets.created_at', 'desc');

      const tickets = await query;
      return sendSuccess(res, 'Completed tickets retrieved', { tickets, total: tickets.length });
    } catch (error) {
      console.error('Get completed tickets error:', error);
      return sendError(res, 500, 'Failed to retrieve completed tickets');
    }
  }

  // Get tickets assigned to logged-in compliance user (Vendor/Engineer/Interested Party)
  static async getMyTickets(req, res) {
    try {
      const userId = req.user.id;
      const role = req.user.role;

      const tickets = await db('tickets')
        .select([
          'tickets.*', 
          'users.username as user_name', 
          'users.email as user_email',
          'vendor_users.name as vendor_name',
          'engineer_users.name as engineer_name'
        ])
        .leftJoin('users', 'tickets.user_id', 'users.id')
        .leftJoin('compliance_users as vendor_users', 'tickets.assigned_vendors', 'vendor_users.id')
        .leftJoin('compliance_users as engineer_users', 'tickets.assigned_engineers', 'engineer_users.id')
        .whereNull('tickets.deleted_at')
        .where('tickets.status', 'Raised')
        .orderBy('tickets.created_at', 'desc');

      const filtered = tickets.filter(t => {
        // Check if assigned as vendor
        if (t.assigned_vendors && Number(t.assigned_vendors) === userId) return true;
        
        // Check if assigned as engineer
        if (t.assigned_engineers && Number(t.assigned_engineers) === userId) return true;
        
        // Check if in interested_party
        if (t.interested_party) {
          try {
            const interestedParty = typeof t.interested_party === 'string' ? JSON.parse(t.interested_party) : t.interested_party;
            if (Array.isArray(interestedParty) && interestedParty.includes(userId)) return true;
          } catch {}
        }
        
        return false;
      });

      // Calculate aging for each ticket (same logic as compliance dashboard)
      const ticketsWithAging = filtered.map(ticket => {
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
        
        return {
          ...ticket,
          admin_aging: adminAging,
          vendor_aging: vendorAging,
          engineer_aging: engineerAging
        };
      });

      return sendSuccess(res, 'Tickets retrieved successfully', { tickets: ticketsWithAging, total: ticketsWithAging.length });
    } catch (error) {
      console.error('Get my tickets error:', error);
      return sendError(res, 500, 'Failed to retrieve tickets');
    }
  }

  static async sendTicketsReportMail(req, res) {
    try {
      const { to, cc, fromDate, toDate, division, location, department, userId } = req.body;
      if (!to) return sendError(res, 400, 'Recipient email is required');

      const ExcelJS = require('exceljs');
      const { enqueueEmail } = require('../services/emailQueueService');
      const os = require('os');
      const pathLib = require('path');

      // ── Query ──
      let query = db('tickets')
        .select([
          'tickets.location',
          db.raw(`COALESCE(tickets.division, tickets.category) as division`),
          db.raw('SUM(COALESCE(tickets.camera_count, 0)) as total_cameras'),
          db.raw('COUNT(tickets.id) as total_issues'),
          db.raw(`SUM(CASE WHEN COALESCE(tickets.vendor_status, tickets.engineer_status, tickets.status) = 'Completed' THEN 1 ELSE 0 END) as completed_count`),
          db.raw(`SUM(CASE WHEN tickets.offline = 'Internet' THEN 1 ELSE 0 END) as internet_count`),
          db.raw(`SUM(CASE WHEN tickets.offline = 'Power' THEN 1 ELSE 0 END) as power_count`),
          db.raw(`SUM(CASE WHEN tickets.device = 'Hardware' THEN 1 ELSE 0 END) as hardware_count`),
          db.raw(`SUM(CASE WHEN tickets.device = 'Software' THEN 1 ELSE 0 END) as software_count`)
        ])
        .whereNull('tickets.deleted_at')
        .whereRaw(`tickets.location IS NOT NULL`)
        .whereRaw(`tickets.location != ''`);

      if (fromDate) query = query.where('tickets.created_at', '>=', fromDate + ' 00:00:00');
      if (toDate) query = query.where('tickets.created_at', '<=', toDate + ' 23:59:59');
      if (location) query = query.where('tickets.location', location);
      if (department) query = query.where('tickets.department', department);
      if (division) query = query.whereRaw(`COALESCE(tickets.division, tickets.category) = ?`, [division]);
      if (userId) {
        const uids = String(userId).split(',').map(Number).filter(Boolean);
        const realUserIds = uids.filter(id => id > 100000).map(id => id - 100000);
        const complianceIds = uids.filter(id => id <= 100000);
        query = query.where(function () {
          if (complianceIds.length) this.whereIn('tickets.assigned_vendors', complianceIds).orWhereIn('tickets.assigned_engineers', complianceIds);
          if (realUserIds.length) this.orWhereIn('tickets.user_id', realUserIds);
        });
      }
      query = query.groupBy('tickets.location', db.raw(`COALESCE(tickets.division, tickets.category)`)).orderBy('tickets.location');
      const rows = await query;

      const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(0) + '%' : '0%';
      const fmt = (count, total) => `${count} (${pct(count, total)})`;

      const totals = rows.reduce((acc, r) => ({
        totalCameras: acc.totalCameras + Number(r.total_cameras || 0),
        totalIssues: acc.totalIssues + Number(r.total_issues || 0),
        completedCount: acc.completedCount + Number(r.completed_count || 0),
        internet: acc.internet + Number(r.internet_count || 0),
        power: acc.power + Number(r.power_count || 0),
        hardware: acc.hardware + Number(r.hardware_count || 0),
        software: acc.software + Number(r.software_count || 0),
      }), { totalCameras: 0, totalIssues: 0, completedCount: 0, internet: 0, power: 0, hardware: 0, software: 0 });

      // ── Generate Excel file ──
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Tickets Report');

      // Header row 1
      sheet.addRow(['S.No', 'Location', 'Division', 'Tickets Count', 'Completed Count', 'Total Camera Count', 'Total Camera Issue', 'Total Camera Issue %', 'Offline', '', 'Device', '']);
      // Header row 2
      sheet.addRow(['', '', '', '', '', '', '', '', 'Internet (ISP Vendor In %)', 'Power (Power In %)', 'Hardware (H/W Vendor In %)', 'Software (S/W Vendor In %)']);

      // Merge header cells
      const merges = [[1,1,2,1],[1,2,2,2],[1,3,2,3],[1,4,2,4],[1,5,2,5],[1,6,2,6],[1,7,2,7],[1,8,2,8],[1,9,1,10],[1,11,1,12]];
      merges.forEach(([r1,c1,r2,c2]) => sheet.mergeCells(r1, c1, r2, c2));

      // Style headers
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF538DD5' } };
      const blueFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      const headerFont = { bold: true, color: { argb: 'FFFFFFFF' } };
      const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      [1, 2].forEach(rowNum => {
        const row = sheet.getRow(rowNum);
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.border = border;
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          if (colNum <= 8) { cell.fill = headerFill; cell.font = headerFont; }
          else if (colNum <= 10) { cell.fill = blueFill; cell.font = { bold: true }; }
          else { cell.fill = greenFill; cell.font = { bold: true }; }
        });
        row.height = 30;
      });

      // Data rows
      rows.forEach((r, i) => {
        const ti = Number(r.total_issues || 0);
        const tc = Number(r.total_cameras || 0);
        const row = sheet.addRow([
          i + 1, r.location || '-', r.division || '-',
          ti, Number(r.completed_count || 0), tc, ti, pct(ti, tc),
          fmt(Number(r.internet_count || 0), ti), fmt(Number(r.power_count || 0), ti),
          fmt(Number(r.hardware_count || 0), ti), fmt(Number(r.software_count || 0), ti)
        ]);
        const bgColor = i % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.border = border;
          cell.alignment = { horizontal: colNum <= 3 ? 'left' : 'center', vertical: 'middle' };
          if (colNum >= 9 && colNum <= 10) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
          else if (colNum >= 11) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
          else cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        });
      });

      // Totals row
      const totalsRow = sheet.addRow([
        '', 'Total', '', totals.totalIssues, totals.completedCount,
        totals.totalCameras, totals.totalIssues, pct(totals.totalIssues, totals.totalCameras),
        fmt(totals.internet, totals.totalIssues), fmt(totals.power, totals.totalIssues),
        fmt(totals.hardware, totals.totalIssues), fmt(totals.software, totals.totalIssues)
      ]);
      totalsRow.eachCell({ includeEmpty: true }, cell => {
        cell.border = border;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Column widths
      sheet.columns = [
        { width: 5 }, { width: 20 }, { width: 16 }, { width: 12 }, { width: 12 },
        { width: 14 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }
      ];

      // Write to buffer
      const exportDate = new Date().toISOString().split('T')[0];
      const fileName = `Tickets_Report_${exportDate}.xlsx`;
      const excelBuffer = await workbook.xlsx.writeBuffer();

      // ── Send email ──
      const dateRange = `${fromDate || '-'} to ${toDate || '-'}`;
      const toEmails = to.split(',').map(e => e.trim()).filter(Boolean).join(', ');
      const ccEmails = cc ? cc.split(',').map(e => e.trim()).filter(Boolean).join(', ') : '';

      const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0">
    <tr><td align="center">
      <table width="900" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#C50B34;padding:28px 32px">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">Compliance Tickets Report</h1>
            <p style="margin:6px 0 0;color:#f9c0cc;font-size:13px">Period: ${dateRange}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px">
            <p style="margin:0 0 16px;color:#374151;font-size:14px">Hi Team,</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">
              Please find attached the <strong style="color:#374151">Compliance Tickets Report</strong> for the above period.
            </p>
            <table width="400" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td width="50%" style="padding:0 6px 0 0">
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:14px;text-align:center">
                    <div style="font-size:24px;font-weight:700;color:#C50B34">${totals.totalIssues}</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:4px">Total Tickets</div>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 0 6px">
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:14px;text-align:center">
                    <div style="font-size:24px;font-weight:700;color:#16a34a">${totals.completedCount}</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:4px">Completed</div>
                  </div>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#374151;font-size:13px;font-weight:600">Report Filters Applied:</p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;font-size:13px">
              <tr><td style="padding:2px 12px 2px 0;color:#6b7280">- Period:</td><td style="color:#374151">${dateRange}</td></tr>
              ${location ? `<tr><td style="padding:2px 12px 2px 0;color:#6b7280">- Location:</td><td style="color:#374151">${location}</td></tr>` : ''}
              ${division ? `<tr><td style="padding:2px 12px 2px 0;color:#6b7280">- Division:</td><td style="color:#374151">${division}</td></tr>` : ''}
              ${department ? `<tr><td style="padding:2px 12px 2px 0;color:#6b7280">- Department:</td><td style="color:#374151">${department}</td></tr>` : ''}
              <tr><td style="padding:2px 12px 2px 0;color:#6b7280">- Locations:</td><td style="color:#374151">${rows.length} location(s)</td></tr>
            </table>
            <p style="margin:0 0 24px;color:#6b7280;font-size:13px;line-height:1.6">
              Please review and take necessary action.
            </p>
            <p style="margin:0 0 2px;color:#374151;font-size:13px">Regards,</p>
            <p style="margin:0 0 0;color:#374151;font-size:13px;font-weight:600">Virtual Auditor</p>
            <p style="margin:2px 0 0;color:#9ca3af;font-size:12px">HEPL &mdash; Compliance System</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px">
            <p style="margin:0;color:#d1d5db;font-size:11px">This is an automated email. Please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      // Build attachments from uploaded files
      const emailAttachments = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          emailAttachments.push({
            filename: file.originalname,
            path: file.path
          });
        });
      }

      await enqueueEmail({
        to: toEmails,
        cc: ccEmails || undefined,
        subject: `Compliance Tickets Report (${dateRange})`,
        html,
        attachments: emailAttachments.length > 0 ? emailAttachments : undefined
        // Old Excel attachment:
        // attachments: [{
        //   filename: fileName,
        //   content: excelBuffer,
        //   contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        // }]
      });

      return sendSuccess(res, 'Email queued successfully');
    } catch (error) {
      console.error('Send tickets report mail error:', error);
      return sendError(res, 500, 'Failed to send email: ' + error.message);
    }
  }

  static async getLocationCamerasList(req, res) {
    try {
      const { location } = req.query;
      let query = db('location_cameras').where('is_active', true).orderBy('location').orderBy('nvr').orderBy('camera_no');
      if (location) query = query.where('location', location);
      const cameras = await query.limit(500);
      return sendSuccess(res, 'Location cameras list', { cameras });
    } catch (error) {
      return sendError(res, 500, 'Failed to retrieve cameras');
    }
  }

  static async addLocationCameras(req, res) {
    try {
      const { cameras } = req.body;
      if (!cameras || !cameras.length) return sendError(res, 400, 'No cameras provided');
      const rows = cameras.map(c => ({
        location: c.location,
        category: c.category || '',
        nvr: c.nvr,
        camera_no: c.camera_no,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }));
      await db('location_cameras').insert(rows);
      return sendCreated(res, `${rows.length} camera(s) added successfully`);
    } catch (error) {
      console.error('Add location cameras error:', error);
      return sendError(res, 500, 'Failed to add cameras');
    }
  }

  static async deleteLocationCamera(req, res) {
    try {
      const { id } = req.params;
      await db('location_cameras').where('id', id).update({ is_active: false, updated_at: new Date() });
      return sendSuccess(res, 'Camera deleted successfully');
    } catch (error) {
      return sendError(res, 500, 'Failed to delete camera');
    }
  }
}

TicketController.upload = upload;

module.exports = TicketController;
