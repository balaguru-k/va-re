const Complaint = require('../models/Complaint');
const Location = require('../models/Location');
const Department = require('../models/Department');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');

const getComplaints = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where['complaints.status'] = status;

    // Optional: Filter by user role/id if not admin
    if (req.user.role !== 'Super Admin') {
      where['complaints.user_id'] = req.user.id;
    }
    
    const complaints = await Complaint.getComplaintsWithDetails(where);
    sendSuccess(res, 'Complaints retrieved successfully', { complaints });
  } catch (error) {
    logger.error('Error fetching complaints:', error);
    sendError(res, 500, 'Failed to fetch complaints');
  }
};

const createComplaint = async (req, res) => {
  try {
    const { location_id, department_id, issue, remarks } = req.body;
    let attachment = null;
    
    // Combined upload middleware puts files in req.files
    if (req.files && req.files.images && req.files.images.length > 0) {
      attachment = req.files.images[0].filename;
    } else if (req.file) {
      attachment = req.file.filename;
    }

    if (!location_id || !issue) {
      return sendError(res, 400, 'Location and Issue are required');
    }

    // Issues might come as a JSON string from frontend
    let issues = issue;
    try {
      if (typeof issue === 'string' && (issue.startsWith('[') || issue.startsWith('{'))) {
        issues = JSON.parse(issue);
      }
    } catch (e) {
      logger.error('Error parsing issues:', e);
    }

    const ticket_no = await Complaint.getNextTicketNo();

    const complaintData = {
      ticket_no,
      user_id: req.user.id,
      location_id: parseInt(location_id),
      department_id: department_id ? parseInt(department_id) : null,
      issue: Array.isArray(issues) ? issues.join(', ') : issues,
      remarks,
      attachment,
      status: 'Pending',
      created_at: new Date(),
      updated_at: new Date()
    };

    const newComplaint = await Complaint.create(complaintData);
    
    sendSuccess(res, 'Complaint created successfully', { 
      id: newComplaint.id, 
      ticket_no: newComplaint.ticket_no 
    });
  } catch (error) {
    logger.error('Error creating complaint:', error);
    sendError(res, 500, error.message || 'Failed to create complaint');
  }
};

const completeComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return sendError(res, 404, 'Complaint not found');
    }

    await Complaint.update(id, {
      status: 'Completed',
      completed_by: req.user.id,
      completed_at: new Date(),
      updated_at: new Date()
    });

    sendSuccess(res, 'Complaint marked as completed');
  } catch (error) {
    logger.error('Error completing complaint:', error);
    sendError(res, 500, 'Failed to complete complaint');
  }
};

const deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return sendError(res, 404, 'Complaint not found');
    }

    // Optional: Only allow the owner or admin to delete
    if (req.user.role !== 'Super Admin' && complaint.user_id !== req.user.id) {
      return sendError(res, 403, 'You do not have permission to delete this complaint');
    }

    await Complaint.forceDelete(id);

    // Clean up attachment if it exists
    if (complaint.attachment) {
      // Possible directories where attachments might be stored
      const uploadDirs = ['uploads/images', 'uploads/camera-files'];
      
      uploadDirs.forEach(dir => {
        const filePath = path.resolve(process.cwd(), dir, complaint.attachment);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`Deleted file: ${filePath}`);
        }
      });
    }

    sendSuccess(res, 'Complaint deleted successfully');
  } catch (error) {
    logger.error('Error deleting complaint:', error);
    sendError(res, 500, 'Failed to delete complaint');
  }
};

module.exports = {
  getComplaints,
  createComplaint,
  completeComplaint,
  deleteComplaint
};
