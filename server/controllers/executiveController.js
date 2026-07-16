const executive = require('../models/Executive');
const ExecutiveData = require('../models/ExecutiveData');
const logger = require('../config/logger');
const { newFormatDate } = require('../utils/dateFormatter');

function getChecklist(req, res) {
    const User = req.user;
    const {fromDate, toDate } = req.query;
    const formattedFromDate = fromDate ? newFormatDate(fromDate) : null;
    const formattedToDate = toDate ? newFormatDate(toDate) : null;

    executive.getChecklist(User.id,formattedFromDate,formattedToDate)
    .then((data) => {
        res.json({
            message: 'Executive checklist retrieved successfully',
            pending: data.pending,
            completed: data.completed,
        });
    })
    .catch((error) => {
        logger.error('Error retrieving executive checklist: ' ,error);
        res.status(500).json({ error: 'Failed to fetch executive checklist', details: error.message });
    });
}

function saveChecklist(req, res) {
    const checklistId = req.params.id;
    const User = req.user;
    const { formData } = req.body;
    const today = new Date().toISOString().split('T')[0];

    executive.saveExecutiveChecklist(checklistId, User.id, JSON.parse(formData), req.files || [], today)
    .then(() => {
        res.json({ message: 'Executive checklist saved successfully' });
    })
    .catch((error) => {
        logger.error('Error saving executive checklist:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    });
}

function completeChecklist(req, res) {
    const checklistId = req.params.id;
    const User = req.user;
    const { formData } = req.body;
    const today = new Date().toISOString().split('T')[0];

    executive.completeExecutiveChecklist(checklistId, User.id, JSON.parse(formData), req.files || [], today)
    .then(() => {
        res.json({ message: 'Executive checklist completed successfully' });
    })
    .catch((error) => {
        logger.error('Error completing executive checklist:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    });
}

async function getExecutiveData(req, res) {
    const instanceId = req.params.id; // daily_checklist_instance id
    const knex = require('../config/database');

    try {
        const instance = await knex('daily_checklist_instances')
            .where('daily_checklist_id', instanceId)
            .first();

        if (!instance) return res.status(404).json({ error: 'Checklist instance not found' });

        const { daily_checklist_id, template_checklist_id } = instance;

        const [items, data] = await Promise.all([
            knex('checklist_items')
                .where('checklist_id', template_checklist_id)
                .orderBy('id'),
            knex('executive_data')
                .select('executive_data.*', 'u.username as user_name')
                .leftJoin('users as u', 'u.id', 'executive_data.user_id')
                .where('executive_data.checklist_id', daily_checklist_id)
        ]);

        return res.json({ message: 'Executive data retrieved successfully', items, data });
    } catch (error) {
        logger.error('Error retrieving executive data:', error);
        return res.status(500).json({ error: 'Failed to fetch the executive data', details: error.message });
    }
}

function getExecutiveDataByStatus(req, res) {
    const checklistId = req.params.id;
    const { status } = req.query;
    
    ExecutiveData.getExecutiveResponsesByStatus(checklistId, status || 'completed')
    .then((data) => {
        res.json({
            message: 'Executive data by status retrieved successfully',
            data: data
        });
    })
    .catch((error) => {
        res.status(500).json({ error: 'Internal server error' });
    });
}

function getCompletedChecklists(req, res) {
    const User = req.user;
    const { fromDate, toDate } = req.query;
    const knex = require('../config/database');
    
    
    // Get executive's departments
    knex('users').where('id', User.id).first()
    .then((executiveUser) => {
        let executiveDepartments = [];
        try {
            executiveDepartments = JSON.parse(executiveUser.department_id || '[]');
        } catch (e) {
            executiveDepartments = executiveUser.department_id ? [executiveUser.department_id] : [];
        }
        
        return executive.getChecklist(User.id, fromDate, toDate);
    })
    .then((data) => {
        res.json({
            message: 'Completed checklists retrieved successfully',
            completed: data.completed
        });
    })
    .catch((error) => {
        logger.error('Error retrieving completed checklists:', error);
        res.status(500).json({ error: 'Failed to fetch executive completed checklist', details: error.message });
    });
}

function getSCAuditTrail(req, res) {
    const User = req.user;
    const { fromDate,toDate } = req.query;
    const knex = require('../config/database');
    
    // Get completed SC checklists that executive initiated
    knex('daily_checklist_instances as dci')
        .select(
            'dci.daily_checklist_id as checklist_id',
            'tc.checklist_name',
            'l.name as location_name',
            'd.name as department_name',
            'u.username as auditor_name',
            'dci.completion_date',
            'dci.updated_at'
        )
        .leftJoin('checklists as tc', 'dci.template_checklist_id', 'tc.id')
        .leftJoin('locations as l', 'tc.location_id', 'l.id')
        .leftJoin('departments as d', 'tc.department_id', 'd.id')
        .leftJoin('users as u', 'dci.auditor_id', 'u.id')
        .whereBetween('dci.assigned_date',[fromDate,toDate] )
        .where('tc.type', 'SC')
        .where('dci.status', 'completed')
        .whereExists(function() {
            this.select('*').from('executive_data')
                .whereRaw('executive_data.checklist_id = dci.daily_checklist_id')
                .where('executive_data.user_id', User.id)
                .where('executive_data.submission_status', 'completed');
        })
        .then((checklists) => {
            res.json({
                message: 'SC audit trail retrieved successfully',
                checklists
            });
        })
        .catch((error) => {
            logger.error('Error retrieving SC audit trail:', error);
            res.status(500).json({ error: 'Failed to fetch completed checklist', details: error.message });
        });
}

async function getSCAuditTrailDetails(req, res) {
    const rawId = req.params.id;
    const User = req.user;
    const knex = require('../config/database');

    // Resolve: if rawId is a daily checklist ID, get the template ID for executive_data
    const dailyInstance = await knex('daily_checklist_instances')
        .where('daily_checklist_id', rawId)
        .first();
    const templateId = dailyInstance ? dailyInstance.template_checklist_id : rawId;
    // Use daily checklist ID for auditor/supervisor/manager data, template ID for executive data
    const checklistId = rawId;
    
    Promise.all([
        // Get checklist info (use template for name/location/dept)
        knex('checklists as c')
            .select('c.*', 'l.name as location_name', 'd.name as department_name')
            .leftJoin('locations as l', 'c.location_id', 'l.id')
            .leftJoin('departments as d', 'c.department_id', 'd.id')
            .where('c.id', rawId)
            .first(),
        
        // Get executive data (always stored against template ID), join to get activities/process
        knex('executive_data as ed')
            .select('ed.*', 'ci.activities', 'ci.process')
            .leftJoin('checklist_items as ci', 'ci.id', 'ed.checklist_item_id')
            .where('ed.checklist_id', rawId)
            .where('ed.user_id', User.id),
        
        // Get auditor data from checklist_data (stored against daily checklist ID)
        knex('checklist_data as cd')
            .select('cd.*', 'ci.activities', 'ci.process')
            .leftJoin('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .where('cd.checklist_id', checklistId)
            .where('cd.submission_status', 'completed'),
        
        // Get supervisor data
        knex('supervisor_reviews as sr')
            .select('sr.*', 'u.username as supervisor_name')
            .leftJoin('users as u', 'sr.supervisor_id', 'u.id')
            .where('sr.checklist_id', checklistId),
        
        // Get manager data
        knex('manager_reviews as mr')
            .select('mr.*', 'u.username as manager_name')
            .leftJoin('users as u', 'mr.manager_id', 'u.id')
            .where('mr.checklist_id', checklistId)
    ])
    .then(([checklist, executive_data, auditor_data, supervisor_data, manager_data]) => {
        res.json({
            message: 'SC audit trail details retrieved successfully',
            checklist,
            executive_data,
            auditor_data,
            supervisor_data,
            manager_data
        });
    })
    .catch((error) => {
        logger.error('Error retrieving SC audit trail details:', error);
        res.status(500).json({ error: 'Failed to fetch checklist', details: error.message });
    });
}

module.exports = {
    getChecklist,
    saveChecklist,
    completeChecklist,
    getExecutiveData,
    getExecutiveDataByStatus,
    getCompletedChecklists,
    getSCAuditTrail,
    getSCAuditTrailDetails
};