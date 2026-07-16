const { formatDate } = require('../utils/dateFormatter');
const logger = require('../config/logger');


const getAdminDashboardData = async (req, res) => {
    try {
        const startTime = Date.now();
        const { date, fromDate, toDate, locationId, auditorId } = req.query;

        let allAssignments = [];
        const DailyAssignmentService = require('../services/DailyAssignmentService');

        if (fromDate && toDate) {
            allAssignments = await DailyAssignmentService.getDailyAssignmentsByRangeReadOnly(fromDate, toDate);
        } else if (date) {
            allAssignments = await DailyAssignmentService.getDailyAssignmentsByRangeReadOnly(date, date);
        } else {
            return res.status(400).json({ error: 'Date parameters are required' });
        }
        // logger.info(`[ADMIN-DASH] Query took ${Date.now() - startTime}ms, rows: ${allAssignments.length}`);

        // Apply filters
        if (locationId) {
            allAssignments = allAssignments.filter(a => a.location_id == locationId);
        }

        if (auditorId) {
            allAssignments = allAssignments.filter(a => a.auditor_id == auditorId);
        }

        // Filter out unassigned instances (no auditor)
        allAssignments = allAssignments.filter(a => a.auditor_id);

        // Batch completion check — 4 queries total instead of 4 per row
        const db = require('../config/database');
        const checklistIds = [...new Set(allAssignments.map(a => a.checklist_id))];
        const completedKeys = new Set();

        if (checklistIds.length > 0) {
            const batchStart = Date.now();
            // 1. checklist_data completions
            const cdRows = await db('checklist_data')
                .whereIn('checklist_id', checklistIds)
                .where('submission_status', 'completed')
                .select('checklist_id', 'user_id');
            cdRows.forEach(r => completedKeys.add(`${r.checklist_id}_${r.user_id}`));

            // 2. supervisor_reviews completions
            const srRows = await db('supervisor_reviews')
                .whereIn('checklist_id', checklistIds)
                .where('supervisor_status', 'Accepted')
                .select('checklist_id', 'supervisor_id');
            srRows.forEach(r => completedKeys.add(`${r.checklist_id}_${r.supervisor_id}`));

            // 3. manager_reviews completions
            const mrRows = await db('manager_reviews')
                .whereIn('checklist_id', checklistIds)
                .where('manager_status', '!=', 'Rejected')
                .select('checklist_id', 'manager_id');
            mrRows.forEach(r => completedKeys.add(`${r.checklist_id}_${r.manager_id}`));

            // 4. executive_data completions
            const edRows = await db('executive_data')
                .whereIn('checklist_id', checklistIds)
                .select('checklist_id', 'user_id');
            edRows.forEach(r => completedKeys.add(`${r.checklist_id}_${r.user_id}`));
            // logger.info(`[ADMIN-DASH] Batch completion check took ${Date.now() - batchStart}ms`);
        }

        // Calculate auditor completed count and status for each assignment
        let auditorCompletedCount = 0;
        const dataWithAuditorStatus = [];

        for (const row of allAssignments) {
            let auditorCompletedStatus = 'No';
            if (completedKeys.has(`${row.checklist_id}_${row.auditor_id}`)) {
                auditorCompletedCount++;
                auditorCompletedStatus = 'Yes';
            }

            let displayStatus;
            if (row.status === 'Completed without NCs') {
                displayStatus = 'Completed without NC';
            } else if (row.status === 'completed' || row.status === 'Completed') {
                displayStatus = 'Completed';
            } else {
                displayStatus = 'Pending';
            }

            dataWithAuditorStatus.push({
                checklist_id: row.checklist_id,
                date: row.assigned_date,
                location_id: row.location_id,
                location_name: row.location_name || 'N/A',
                checklist_name: row.checklist_name,
                auditor_name: row.auditor_name || 'N/A',
                status: displayStatus,
                auditor_completed: auditorCompletedStatus,
                completed_by: row.auditor_name || 'N/A'
            });
        }

        const data = dataWithAuditorStatus.map((row, index) => ({
            sno: index + 1,
            ...row
        }));

        // Get cumulative template checklists count up to the selected date (exclude daily copies)
        const totalResult = await db('checklists')
            .whereNull('deleted_at')
            .where('checklist_name', 'not like', '%-%-%')
            .where('created_at', '<=', toDate + ' 23:59:59')
            .count('* as count')
            .first();


        // auditor_completed = auditor submitted but NOT yet fully completed (waiting for supervisor/manager)
        const auditorCompleted = data.filter(d => d.auditor_completed === 'Yes' && d.status === 'Pending').length;
        // completed = fully done by all roles
        const completed = data.filter(d => d.status === 'Completed' || d.status === 'Completed without NC').length;
        const pending = data.length - auditorCompleted - completed;
        const counts = {
            total_checklists: parseInt(totalResult.count) || 0,
            total: data.length,
            completed,
            pending,
            supervisor_pending: auditorCompleted,
            auditor_completed: auditorCompleted
        };
        res.json({ success: true, data, counts });
        logger.info(`[ADMIN-DASH] Total time: ${Date.now() - startTime}ms`);
    } catch (error) {
        logger.error('Error fetching admin dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard', details: error.message });
    }
};

module.exports = {
    getAdminDashboardData
};
