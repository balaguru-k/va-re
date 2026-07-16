const logger = require('../config/logger');
const DailyChecklistInstance = require('../models/DailyChecklistInstance');
const { formatDate } = require('../utils/dateFormatter');
const logger = require('../config/logger');


const getDailyReport = async (req, res) => {
  try {
    const { date, user_id } = req.query;
    const targetDate = date || formatDate(new Date());
    
    // Get daily counts
    const counts = await DailyChecklistInstance.getDailyCounts(targetDate, user_id);
    
    // Get detailed instances
    const instances = await DailyChecklistInstance.getDailyInstancesByDate(targetDate, user_id);
    
    res.json({
      message: 'Daily report retrieved successfully',
      data: {
        date: targetDate,
        counts,
        instances
      }
    });
  } catch (error) {
    logger.error('Error retrieving daily report:', error);
    res.status(500).json({ error: 'Failed to Generate Daily Report' ,details: error.message});
  }
};

const updateInstanceStatus = async (req, res) => {
  try {
    const { daily_key } = req.params;
    const { status } = req.body;
    
    // Determine completion date for completed statuses
    const completionDate = ['completed', 'completed_without_ncs'].includes(status) 
      ? new Date() 
      : null;
    
    await DailyChecklistInstance.updateInstanceStatus(daily_key, status, completionDate);
    
    res.json({
      message: 'Instance status updated successfully'
    });
  } catch (error) {
    logger.error('Error updating instance status:', error);
    res.status(500).json({ error: 'Failed to update instance status',details: error.message });
  }
};

module.exports = {
  getDailyReport,
  updateInstanceStatus
};