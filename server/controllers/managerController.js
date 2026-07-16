const ManagerReview = require('../models/ManagerReview');
const Checklist = require('../models/Checklist');
const { imageUpload, compressImages } = require('../middleware/upload');
const logger = require('../config/logger');
const { log } = require('winston');


const submitManagerReview = async (req, res) => {
  try {
    
    const { id } = req.params;
    const managerData = JSON.parse(req.body.managerData || '{}');
    
    const knex = require('../config/database');
    
    // Process manager review for each item
    for (const [itemId, reviewData] of Object.entries(managerData)) {
      if (reviewData) {
        // Insert manager review data
        await ManagerReview.createReview({
          checklist_id: parseInt(id),
          checklist_item_id: parseInt(itemId),
          manager_id: req.user.id,
          reason: reviewData.reason || null,
          manager_status: reviewData.status || null
        });
      }
    }
    
    // Get all manager reviews for this checklist
    const allReviews = await ManagerReview.query().where('checklist_id', id).where('manager_id', req.user.id);
    
    const approvedItems = allReviews.filter(review => review.manager_status === 'Approved');
    const rejectedItems = allReviews.filter(review => review.manager_status === 'Rejected');
    
    let newStatus;
    let instanceStatus;
    
    if (approvedItems.length === allReviews.length) {
      // All approved
      newStatus = 'Completed';
      instanceStatus = 'completed';
    } else if (rejectedItems.length === allReviews.length) {
      // All rejected
      newStatus = 'Awaiting for NC response';
      instanceStatus = 'awaiting_supervisor';
      
      // Update supervisor_reviews status to rejected for all items
      await knex('supervisor_reviews')
        .where('checklist_id', id)
        .update({
          supervisor_status: 'Rejected',
          status: 'Open',
          updated_at: new Date()
        });
    } else {
      // Mixed (some approved, some rejected)
      newStatus = 'Pending by Supervisor';
      instanceStatus = 'awaiting_manager';
      
      // Update supervisor_status to rejected only for rejected items
      const rejectedItemIds = rejectedItems.map(item => item.checklist_item_id);
      if (rejectedItemIds.length > 0) {
        await knex('supervisor_reviews')
          .where('checklist_id', id)
          .whereIn('checklist_item_id', rejectedItemIds)
          .update({
            supervisor_status: 'Rejected',
            status: 'Open',
            updated_at: new Date()
          });
      }
    }
    
    if (newStatus) {
      await Checklist.update(id, {
        status: newStatus,
        updated_by: req.user.id
      });
      
      // Update daily instance status
      const DailyAssignmentService = require('../services/DailyAssignmentService');
      
      // First try to find by daily_checklist_id (the checklist being reviewed)
      const instance = await knex('daily_checklist_instances')
        .where('daily_checklist_id', id)
        .first();
        
      if (instance) {
        await DailyAssignmentService.updateDailyInstanceStatus(instance.id, instanceStatus);
      } else {
        // Fallback: try to find by template_checklist_id
        const dailyInstance = await DailyAssignmentService.getDailyInstanceByChecklistId(id);
        if (dailyInstance) {
          await DailyAssignmentService.updateDailyInstanceStatus(dailyInstance.id, instanceStatus);
        }
      }
    }
    
    res.status(200).json({
      message: 'Manager review submitted successfully',
      status: newStatus,
      approvedItems: approvedItems.length,
      rejectedItems: rejectedItems.length
    });
  } catch (error) {
    logger.error('Error submitting manager review:', error);
    res.status(500).json({ error: 'Failed to submit manager Form', details: error.message });
  }
};

const getManagerReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const reviews = await ManagerReview.getReviewsByChecklistId(id);
    
    res.json({
      message: 'Manager reviews retrieved successfully',
      reviews
    });
  } catch (error) {
    logger.error('Error retrieving manager reviews:', error);
    res.status(500).json({ error: 'Failed to fetch the manager review checklist',details:error.message });
  }
};

const getManagerDashboard = async (req, res) => {
  try {
    // debugLog('=== MANAGER DASHBOARD LOADED ===');
    const managerId = req.user.id;
    // debugLog('Manager ID: ' + managerId);
    const knex = require('../config/database');
    
    // Get checklists assigned to manager that need review
    const pendingChecklists = await knex('rosters')
      .select(
        'checklists.id as checklist_id',
        'checklists.checklist_name',
        'checklists.status',
        'checklists.created_at'
      )
      .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
      .where('rosters.manager_id', managerId)
      .where('checklists.status', 'Pending Manager Verification');
    
    // Get completed manager reviews (only approved ones)
    const completedChecklists = await knex('rosters')
      .select(
        'checklists.id as checklist_id',
        'checklists.checklist_name',
        'checklists.status',
        'checklists.created_at'
      )
      .leftJoin('checklists', 'rosters.checklist_id', 'checklists.id')
      .leftJoin('manager_reviews', function() {
        this.on('manager_reviews.checklist_id', '=', 'checklists.id')
            .andOn('manager_reviews.manager_id', '=', 'rosters.manager_id');
      })
      .where('rosters.manager_id', managerId)
      .where('checklists.status', 'Completed')
      .whereExists(function() {
        this.select('*')
            .from('manager_reviews')
            .whereRaw('manager_reviews.checklist_id = checklists.id')
            .where('manager_reviews.manager_id', managerId)
            .where('manager_reviews.manager_status', 'Approved');
      });
    
    // debugLog('Pending checklists: ' + pendingChecklists.length);
    // debugLog('Completed checklists: ' + completedChecklists.length);
    
    res.json({
      message: 'Manager dashboard data retrieved successfully',
      data: {
        pending: pendingChecklists,
        completed: completedChecklists
      }
    });
  } catch (error) {
    logger.error('Error fetching manager dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch manager dashboard data',details:error.message });
  }
};

module.exports = {
  submitManagerReview,
  getManagerReviews,
  getManagerDashboard
};