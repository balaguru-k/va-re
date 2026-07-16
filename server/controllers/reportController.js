const ChecklistData = require('../models/ChecklistData');
const Checklist = require('../models/Checklist');
const { formatDate } = require('../utils/dateFormatter');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const knex = require('../config/database');
const logger = require('../config/logger');
const { styleHeaderRow, HEADER_COLOR } = require('../utils/excelHelper');

// Helper to parse comma-separated or JSON array strings
const parseFilter = (val) => {
    if (!val) return [];
    if (typeof val === 'string' && val.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            return [];
        }
    }
    return String(val).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
};

// Helper to apply dynamic filters from table column headers
const SKIP_PARAMS = new Set(['fromDate', 'toDate', 'page', 'limit', 'locationId', 'departmentId', 'categoryId', 'auditorId', 'status', 'count', 'role']);
const MAX_FILTER_VALUES = 50;
const MAX_FILTER_VALUE_LENGTH = 200;

const applyDynamicFilters = (query, reqQuery, mapping = {}) => {
    Object.entries(reqQuery).forEach(([key, value]) => {
        if (SKIP_PARAMS.has(key)) return;
        const dbColumn = mapping[key];
        if (!dbColumn) return;
        if (!value || typeof value !== 'string') return;

        // Validate: only allow known column mappings (prevents arbitrary column injection)
        if (!/^[a-zA-Z_]+\.[a-zA-Z_]+$/.test(dbColumn)) return;

        const values = value.split('|||')
            .map(v => v.trim())
            .filter(v => v.length > 0 && v.length <= MAX_FILTER_VALUE_LENGTH)
            .slice(0, MAX_FILTER_VALUES);

        if (values.length > 0) query.whereIn(dbColumn, values);
    });
    return query;
};


const getNCReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId, auditorId, page = 1, limit = 10 } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const resolvedAuditorIds = parseFilter(auditorId);

        let query = ChecklistData.query()
            .select(
                'checklist_data.*',
                'template_checklists.checklist_name',
                'dci.assigned_date as checklist_date',
                'checklists.status as checklist_status',
                'categories.name as category_name',
                'locations.name as location_name',
                'departments.name as department_name',
                'users.username as auditor_name',
                'checklist_items.activities as item_description',
                'checklist_items.process as item_process',
                knex.raw('(SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) as sup_status'),
                knex.raw('(SELECT reason FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) as sup_reason'),
                knex.raw('(SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) as man_status')
            )
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .join('users', 'checklist_data.user_id', 'users.id')
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id')
            .where('checklist_data.status', 'No');

        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);

        if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);
        if (resolvedAuditorIds.length > 0) query.whereIn('checklist_data.user_id', resolvedAuditorIds);

        // Apply dynamic filters
        const mapping = {
            checklist_name: 'template_checklists.checklist_name',
            category: 'categories.name',
            location: 'locations.name',
            department: 'departments.name',
            auditor: 'users.username',
            item_description: 'checklist_items.activities',
            item_process: 'checklist_items.process'
        };
        applyDynamicFilters(query, req.query, mapping);

        const totalQuery = query.clone();
        const totalCount = await totalQuery.count('* as count').first();
        const totalRecords = totalCount.count;

        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset).orderBy('dci.assigned_date', 'desc');

        const results = await query;

        const formattedResults = results.map(item => {
            const supStatus = item.sup_status;
            const manStatus = item.man_status;
            let finalStatus;
            if (manStatus === 'Approved') {
                finalStatus = 'Accepted';
            } else if (manStatus === 'Rejected' || supStatus === 'Rejected') {
                finalStatus = 'Rejected';
            } else if (supStatus === 'Accepted') {
                finalStatus = 'Accepted';
            } else {
                finalStatus = 'Pending';
            }

            return {
                id: item.id,
                date: item.checklist_date ? formatDate(item.checklist_date) : 'N/A',
                checklist_name: item.checklist_name,
                location: item.location_name || 'N/A',
                department: item.department_name || 'N/A',
                category: item.category_name || 'N/A',
                auditor: item.auditor_name,
                item_description: item.item_description,
                item_process: item.item_process,
                nc_reason: item.reason,
                checklist_status: item.checklist_status,
                supervisor_status: finalStatus,
                supervisor_reason: item.sup_reason || null
            };
        });


        res.json({
            message: 'NC Report generated successfully',
            data: formattedResults,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalRecords / limit),
                totalRecords: parseInt(totalRecords),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        logger.error('NC Report Error:', error.message);
        if (error.sql) {
            logger.error('NC Report SQL Error:', error.sqlMessage);
            logger.error('NC Report Failed SQL:', error.sql);
        }
        res.status(500).json({ error: 'Failed to Generate NC Reports', details: error.message });
    }
};

const exportNCReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId, auditorId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const resolvedAuditorIds = parseFilter(auditorId);

        let query = ChecklistData.query()
            .select(
                'checklist_data.*',
                'template_checklists.checklist_name',
                'dci.assigned_date as checklist_date',
                'categories.name as category_name',
                'locations.name as location_name',
                'departments.name as department_name',
                'users.username as auditor_name',
                'checklist_items.activities as item_description',
                'checklist_items.process as item_process',
                knex.raw('(SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) as sup_status'),
                knex.raw('(SELECT reason FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) as sup_reason'),
                knex.raw('(SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) as man_status')
            )
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .join('users', 'checklist_data.user_id', 'users.id')
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id')
            .where('checklist_data.status', 'No');

        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);
        if (resolvedAuditorIds.length > 0) query.whereIn('checklist_data.user_id', resolvedAuditorIds);

        // Apply dynamic filters
        const mapping = {
            checklist_name: 'template_checklists.checklist_name',
            category: 'categories.name',
            location: 'locations.name',
            department: 'departments.name',
            auditor: 'users.username',
            item_description: 'checklist_items.activities',
            item_process: 'checklist_items.process'
        };
        applyDynamicFilters(query, req.query, mapping);

        query.orderBy('dci.assigned_date', 'desc');

        const results = await query;

        const excelData = results.map(item => {
            const supStatus = item.sup_status;
            const manStatus = item.man_status;
            let finalStatus;
            if (manStatus === 'Approved') {
                finalStatus = 'Accepted';
            } else if (manStatus === 'Rejected' || supStatus === 'Rejected') {
                finalStatus = 'Rejected';
            } else if (supStatus === 'Accepted') {
                finalStatus = 'Accepted';
            } else {
                finalStatus = 'Pending';
            }
            return {
                date: item.checklist_date ? formatDate(item.checklist_date) : 'N/A',
                checklist_name: item.checklist_name,
                category: item.category_name || 'N/A',
                location: item.location_name || 'N/A',
                department: item.department_name || 'N/A',
                auditor: item.auditor_name,
                activity: item.item_description,
                process: item.item_process,
                nc_reason: item.reason || '-',
                status: finalStatus,
                supervisor_reason: item.sup_reason || '-'
            };
        });

        // Create workbook and worksheet with ExcelJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('NC Report');

        worksheet.columns = [
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Checklist Name', key: 'checklist_name', width: 25 },
            { header: 'Category', key: 'category', width: 15 },
            { header: 'Location', key: 'location', width: 15 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Auditor', key: 'auditor', width: 15 },
            { header: 'Activity', key: 'activity', width: 30 },
            { header: 'Process', key: 'process', width: 25 },
            { header: 'NC Reason', key: 'nc_reason', width: 25 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Supervisor Reason', key: 'supervisor_reason', width: 25 }
        ];

        excelData.forEach(row => worksheet.addRow(row));
        styleHeaderRow(worksheet);

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="NC_Report_${new Date().toISOString().split('T')[0]}.xlsx"`);

        res.send(buffer);

    } catch (error) {
        logger.error('Export NC Report Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

const getChecklistView = async (req, res) => {
    try {
        const { checklistId } = req.params;

        // Get checklist basic info and submissions
        const checklistQuery = ChecklistData.query()
            .select(
                'checklist_data.id as data_id',
                'checklist_data.user_id',
                'checklist_data.status as data_status',
                'checklist_data.reason as data_reason',
                'checklist_data.image_name as data_images',
                'checklists.checklist_name',
                'checklists.status as checklist_status',
                'checklists.time_taken_seconds',
                'users.username as auditor_name',
                'categories.name as category_name',
                'locations.name as location_name',
                'departments.name as department_name',
                'dci.assigned_date'
            )
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .leftJoin('categories', 'checklists.category_id', 'categories.id')
            .leftJoin('locations', 'checklists.location_id', 'locations.id')
            .leftJoin('departments', 'checklists.department_id', 'departments.id')
            .join('users', 'checklist_data.user_id', 'users.id')
            .where('checklist_data.checklist_id', checklistId);
        // .orderBy('checklist_data.created_at', 'desc');

        // Get checklist items (activities and process)
        const itemsQuery = ChecklistData.query()
            .select(
                'checklist_data.id as data_id',
                'checklist_data.checklist_item_id as item_id',
                'checklist_items.activities',
                'checklist_items.process',
                'checklist_items.criticality'
            )
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id')
            .where('checklist_data.checklist_id', checklistId);
        // .orderBy(['checklist_data.created_at', 'checklist_items.id'], ['desc', 'asc']);

        const [checklistResults, itemsResults] = await Promise.all([
            checklistQuery,
            itemsQuery
        ]);

        // Group items by data_id
        const itemsByDataId = {};
        itemsResults.forEach(item => {
            if (!itemsByDataId[item.data_id]) {
                itemsByDataId[item.data_id] = [];
            }
            itemsByDataId[item.data_id].push({
                item_id: item.item_id,
                activities: item.activities,
                process: item.process,
                criticality: item.criticality
            });
        });

        // Format submissions with their items
        const submissions = checklistResults.map(submission => {
            let images = [];
            if (submission.data_images) {
                try {
                    // Handle both JSON array and comma-separated string formats
                    if (submission.data_images.startsWith('[')) {
                        images = JSON.parse(submission.data_images);
                    } else {
                        images = submission.data_images.split(',').filter(img => img.trim());
                    }
                } catch (e) {
                    console.error('Error parsing images:', e, submission.data_images);
                    images = submission.data_images.split(',').filter(img => img.trim());
                }
            }

            return {
                data_id: submission.data_id,
                auditor_name: submission.auditor_name,
                time_taken_seconds: submission.time_taken_seconds || 0,
                time_taken_formatted: submission.time_taken_seconds ?
                    `${Math.floor(submission.time_taken_seconds / 60)}m ${submission.time_taken_seconds % 60}s` : '0m 0s',
                items: (itemsByDataId[submission.data_id] || []).map(item => ({
                    item_id: item.item_id,
                    activities: item.activities,
                    process: item.process,
                    status: submission.data_status,
                    reason: submission.data_reason,
                    images: images,
                    criticality: item.criticality
                }))
            };
        });

        const formattedResults = {
            checklist_info: checklistResults[0] ? {
                checklist_name: checklistResults[0].checklist_name,
                category: checklistResults[0].category_name || 'N/A',
                location: checklistResults[0].location_name || 'N/A',
                department: checklistResults[0].department_name || 'N/A',
                date: checklistResults[0].assigned_date ? formatDate(checklistResults[0].assigned_date) : 'N/A'
            } : null,
            submissions: submissions
        };

        res.json({
            message: 'Checklist view data retrieved successfully',
            data: formattedResults
        });

    } catch (error) {
        logger.error('Checklist View Error:', error);
        res.status(500).json({ error: 'Failed to fetch checklist', details: error.message });
    }
};



// Jaccard Similarity Helper
const stopWords = new Set(['a', 'an', 'the', 'is', 'was', 'are', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

const getTokens = (str) => {
    return str.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => !stopWords.has(word) && word.length > 0);
};

// tokenSet cache to avoid re-tokenizing the same string repeatedly
const tokenSetCache = new Map();
const getCachedTokenSet = (str) => {
    if (!tokenSetCache.has(str)) tokenSetCache.set(str, new Set(getTokens(str)));
    return tokenSetCache.get(str);
};

const getJaccardSimilarity = (str1, str2) => {
    const set1 = getCachedTokenSet(str1);
    const set2 = getCachedTokenSet(str2);

    if (set1.size === 0 && set2.size === 0) return 1;
    if (set1.size === 0 || set2.size === 0) return 0;

    let intersectionSize = 0;
    for (const token of set1) { if (set2.has(token)) intersectionSize++; }
    return intersectionSize / (set1.size + set2.size - intersectionSize);
};

const getReasonAnalysisReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId, page = 1, limit = 10 } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const userId = req.user.id;
        const userRole = req.user.role;
        let userDepartmentFilters = [];

        if (userRole === 'Manager' || userRole === 'Supervisor') {
            const managerUser = await knex('users').where('id', userId).first('department_id');
            try {
                userDepartmentFilters = JSON.parse(managerUser?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }
        // Query for reasons with status 'No'
        let query = ChecklistData.query()
            .select(
                'checklist_data.reason',
                'checklist_data.image_name',
                'departments.name as department_name',
                'locations.name as location_name',
                'categories.name as category_name',
                'checklist_items.activities as activity_name',
                'checklist_items.process as process_name',
                'dci.assigned_date as checklist_date',
                'checklist_items.criticality'
            )
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .where('checklist_data.status', 'No')
            .whereNotNull('checklist_data.reason')
            .whereNot('checklist_data.reason', '');

        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);
        if (userDepartmentFilters.length > 0) query.whereIn('template_checklists.department_id', userDepartmentFilters);

        // Apply dynamic filters
        const mapping = {
            representative: 'checklist_data.reason',
            department: 'departments.name',
            location: 'locations.name',
            category: 'categories.name',
            activity: 'checklist_items.activities',
            process: 'checklist_items.process',
            criticality: 'checklist_items.criticality'
        };
        applyDynamicFilters(query, req.query, mapping);

        const results = await query;

        // Group by similar reasons, department, location, checklist_item_id (across all dates)
        let reasonClusters = [];

        // Group by exact match first (faster)
        const exactGroups = new Map();
        results.forEach(item => {
            const reasonText = item.reason.trim();
            if (!reasonText) return;
            const dateKey = item.checklist_date ? (item.checklist_date instanceof Date ? `${item.checklist_date.getFullYear()}-${String(item.checklist_date.getMonth() + 1).padStart(2, '0')}-${String(item.checklist_date.getDate()).padStart(2, '0')}` : String(item.checklist_date).split('T')[0]) : 'N/A';
            const groupKey = `${reasonText}|${item.department_name}|${item.location_name}|${item.process_name}|${item.activity_name}`;

            if (!exactGroups.has(groupKey)) {
                exactGroups.set(groupKey, {
                    representative: reasonText,
                    count: 0,
                    raw_reasons: [],
                    department: item.department_name,
                    location: item.location_name,
                    category: item.category_name,
                    activities: [item.activity_name].filter(Boolean),
                    processes: [item.process_name].filter(Boolean),
                    uniqueDates: new Set(),
                    latest_date: null,
                    image_name: null,
                    criticality: item.criticality
                });
            }

            const group = exactGroups.get(groupKey);
            group.count++;
            if (!group.uniqueDates.has(dateKey)) {
                group.uniqueDates.add(dateKey);
            }
            group.raw_reasons.push({ reason: reasonText, date: dateKey });
            if (!group.latest_date || dateKey > group.latest_date) {
                group.latest_date = dateKey;
                // Parse comma-separated images
                if (item.image_name) {
                    try {
                        const images = item.image_name.split(',').map(img => img.trim()).filter(Boolean);
                        group.image_name = images.length > 0 ? images : null;
                    } catch (e) {
                        group.image_name = item.image_name ? [item.image_name] : null;
                    }
                } else {
                    group.image_name = null;
                }
            }
            if (item.activity_name && !group.activities.includes(item.activity_name)) {
                group.activities.push(item.activity_name);
            }
            if (item.process_name && !group.processes.includes(item.process_name)) {
                group.processes.push(item.process_name);
            }
        });

        // Convert to array and apply similarity clustering
        // Clear token cache before clustering (scoped to this request)
        tokenSetCache.clear();

        const exactClusters = Array.from(exactGroups.values());

        // Group clusters by dept|location bucket to avoid cross-bucket Jaccard comparisons
        const bucketMap = new Map();
        exactClusters.forEach(cluster => {
            const bucketKey = `${cluster.department || ''}|${cluster.location || ''}`;
            if (!bucketMap.has(bucketKey)) bucketMap.set(bucketKey, []);
            bucketMap.get(bucketKey).push(cluster);
        });

        // Within each bucket, apply Jaccard similarity clustering
        bucketMap.forEach(bucketClusters => {
            const bucketResult = [];
            bucketClusters.forEach(cluster => {
                const clusterProcessKey = [...cluster.processes].sort().join(',');
                const clusterActivityKey = [...cluster.activities].sort().join(',');
                let matchFound = false;
                for (const existing of bucketResult) {
                    if ([...existing.processes].sort().join(',') !== clusterProcessKey) continue;
                    if ([...existing.activities].sort().join(',') !== clusterActivityKey) continue;
                    if (getJaccardSimilarity(cluster.representative, existing.representative) < 0.5) continue;

                    existing.count += cluster.count;
                    existing.raw_reasons.push(...cluster.raw_reasons);
                    cluster.uniqueDates.forEach(d => existing.uniqueDates.add(d));
                    if (!existing.latest_date || (cluster.latest_date && cluster.latest_date > existing.latest_date)) {
                        existing.latest_date = cluster.latest_date;
                        existing.image_name = cluster.image_name;
                    } else if (cluster.image_name) {
                        existing.image_name = existing.image_name
                            ? [...new Set([...existing.image_name, ...cluster.image_name])]
                            : cluster.image_name;
                    }
                    if (!existing.criticality && cluster.criticality) existing.criticality = cluster.criticality;
                    matchFound = true;
                    break;
                }
                if (!matchFound) bucketResult.push(cluster);
            });
            bucketResult.forEach(c => reasonClusters.push(c));
        });

        // Filter by count if provided (multi-select)
        const countFilter = req.query.count;
        if (countFilter) {
            const delimiter = countFilter.includes('|||') ? '|||' : ',';
            const countValues = countFilter.split(delimiter).map(v => parseInt(v.trim())).filter(v => !isNaN(v));
            if (countValues.length > 0) {
                for (let i = reasonClusters.length - 1; i >= 0; i--) {
                    if (!countValues.includes(reasonClusters[i].count)) reasonClusters.splice(i, 1);
                }
            }
        }

        // Sort by count descending
        reasonClusters.sort((a, b) => {
            const deptA = (a.department || '').toLowerCase();
            const deptB = (b.department || '').toLowerCase();
            if (deptA !== deptB) return deptA.localeCompare(deptB);
            return b.count - a.count;
        });

        // Apply pagination
        const totalRecords = reasonClusters.length;
        const offset = (page - 1) * limit;
        const paginatedClusters = reasonClusters.slice(offset, offset + parseInt(limit)).map(cluster => {
            const { uniqueDates, latest_date, ...rest } = cluster;
            rest.raw_reasons = rest.raw_reasons.sort((a, b) => b.date.localeCompare(a.date));
            rest.criticality = rest.criticality || null;
            return rest;
        });

        res.json({
            message: 'Reason analysis generated successfully',
            data: paginatedClusters,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalRecords / limit),
                totalRecords: totalRecords,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        logger.error('Reason Analysis Error:', error);
        res.status(500).json({ error: 'Failed to Generate Repeated Reason Reports', details: error.message });
    }
}

const exportReasonAnalysisReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const userId = req.user.id;
        const userRole = req.user.role;
        let userDepartmentFilters = [];

        if (userRole === 'Manager' || userRole === 'Supervisor') {
            const managerUser = await knex('users').where('id', userId).first('department_id');
            try {
                userDepartmentFilters = JSON.parse(managerUser?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }

        // Query logic same as getReasonAnalysisReport
        let query = ChecklistData.query()
            .select(
                'checklist_data.reason',
                'departments.name as department_name',
                'locations.name as location_name',
                'categories.name as category_name',
                'checklist_items.activities as activity_name',
                'checklist_items.process as process_name',
                'checklist_items.criticality',
                'dci.assigned_date as checklist_date'
            )
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .where('checklist_data.status', 'No')
            .whereNotNull('checklist_data.reason')
            .whereNot('checklist_data.reason', '');

        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);
        if (userDepartmentFilters.length > 0) query.whereIn('template_checklists.department_id', userDepartmentFilters);

        // Apply dynamic filters
        const mapping = {
            representative: 'checklist_data.reason',
            department: 'departments.name',
            location: 'locations.name',
            category: 'categories.name',
            activity: 'checklist_items.activities',
            process: 'checklist_items.process',
            criticality: 'checklist_items.criticality'
        };
        applyDynamicFilters(query, req.query, mapping);

        const results = await query;

        const reasonClusters = [];
        const exactGroups = new Map();
        results.forEach(item => {
            const reasonText = item.reason.trim();
            if (!reasonText) return;
            const dateKey = item.checklist_date ? (item.checklist_date instanceof Date ? `${item.checklist_date.getFullYear()}-${String(item.checklist_date.getMonth() + 1).padStart(2, '0')}-${String(item.checklist_date.getDate()).padStart(2, '0')}` : String(item.checklist_date).split('T')[0]) : 'N/A';
            // const groupKey = `${reasonText}|${item.department_name}|${item.location_name}|${item.process_name}|${item.activity_name}`;
            const groupKey = `${reasonText.toLowerCase()}|${(item.department_name || '').toLowerCase()}|${(item.location_name || '').toLowerCase()}|${(item.process_name || '').toLowerCase()}|${(item.activity_name || '').toLowerCase()}`;
            if (!exactGroups.has(groupKey)) {
                exactGroups.set(groupKey, {
                    representative: reasonText,
                    count: 0,
                    department: item.department_name,
                    location: item.location_name,
                    category: item.category_name,
                    activities: [item.activity_name].filter(Boolean),
                    processes: [item.process_name].filter(Boolean),
                    criticality: item.criticality,
                    uniqueDates: new Set()
                });
            }

            const group = exactGroups.get(groupKey);
            group.count++;
            if (!group.uniqueDates.has(dateKey)) {
                group.uniqueDates.add(dateKey);
            }
            if (item.activity_name && !group.activities.includes(item.activity_name)) {
                group.activities.push(item.activity_name);
            }
            if (item.process_name && !group.processes.includes(item.process_name)) {
                group.processes.push(item.process_name);
            }
        });

        const exactClusters = Array.from(exactGroups.values());
        exactClusters.forEach(cluster => {
            let matchFound = false;
            for (const existing of reasonClusters) {
                const similarity = getJaccardSimilarity(cluster.representative, existing.representative);
                if (similarity >= 0.6 &&
                    existing.department === cluster.department &&
                    existing.location === cluster.location &&
                    existing.processes.sort().join(',') === cluster.processes.sort().join(',') &&
                    existing.activities.sort().join(',') === cluster.activities.sort().join(',')) {
                    existing.count += cluster.count;
                    cluster.activities.forEach(a => {
                        if (!existing.activities.includes(a)) existing.activities.push(a);
                    });
                    cluster.processes.forEach(p => {
                        if (!existing.processes.includes(p)) existing.processes.push(p);
                    });
                    cluster.uniqueDates.forEach(d => existing.uniqueDates.add(d));
                    matchFound = true;
                    break;
                }
            }
            if (!matchFound) {
                reasonClusters.push(cluster);
            }
        });

        reasonClusters.sort((a, b) => {
            const deptA = (a.department || '').toLowerCase();
            const deptB = (b.department || '').toLowerCase();
            if (deptA !== deptB) return deptA.localeCompare(deptB);
            return b.count - a.count;
        });

        // Filter by count if provided
        const countFilter = req.query.count;
        if (countFilter) {
            const delimiter = countFilter.includes('|||') ? '|||' : ',';
            const countValues = countFilter.split(delimiter).map(v => parseInt(v.trim())).filter(v => !isNaN(v));
            if (countValues.length > 0) {
                for (let i = reasonClusters.length - 1; i >= 0; i--) {
                    if (!countValues.includes(reasonClusters[i].count)) reasonClusters.splice(i, 1);
                }
            }
        }

        // Format for Excel - expand all reasons with dates
        const excelData = [];
        reasonClusters.forEach((cluster, index) => {
            const { uniqueDates, ...rest } = cluster;
            const sortedDates = Array.from(uniqueDates).sort();

            sortedDates.forEach(date => {
                excelData.push({
                    'Rank': index + 1,
                    'Date': formatDate(date),
                    'Reason Description': rest.representative,
                    'Count': rest.count,
                    'Category': rest.category || '-',
                    'Department': rest.department || '-',
                    'Location': rest.location || '-',
                    'Activities': rest.activities.join(', '),
                    'Processes': rest.processes.join(', '),
                    'Criticality': rest.criticality || '-'
                });
            });
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reason Analysis');

        worksheet.columns = [
            { header: 'Rank', key: 'Rank', width: 10 },
            { header: 'Date', key: 'Date', width: 15 },
            { header: 'Reason Description', key: 'Reason Description', width: 50 },
            { header: 'Count', key: 'Count', width: 10 },
            { header: 'Category', key: 'Category', width: 20 },
            { header: 'Department', key: 'Department', width: 40 },
            { header: 'Location', key: 'Location', width: 40 },
            { header: 'Activities', key: 'Activities', width: 40 },
            { header: 'Processes', key: 'Processes', width: 40 },
            { header: 'Criticality', key: 'Criticality', width: 15 }
        ];

        excelData.forEach(row => worksheet.addRow(row));
        styleHeaderRow(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Reason_Analysis_${new Date().toISOString().split('T')[0]}.xlsx"`);

        res.send(buffer);

    } catch (error) {
        logger.error('Export Reason Analysis Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};


const getManagerSupervisorNCCounts = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const userId = req.user.id;
        const userRole = req.user.role;
        let userDepartmentFilters = [];

        if (userRole === 'Manager') {
            const managerUser = await knex('users').where('id', userId).first('department_id');
            try {
                userDepartmentFilters = JSON.parse(managerUser?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }


        // Base query conditions
        const applyFilters = (query, userType) => {
            if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
            if (toDate) query.where('dci.assigned_date', '<=', toDate);
            if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
            if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
            if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);
            if (userDepartmentFilters.length > 0) query.whereIn('template_checklists.department_id', userDepartmentFilters);

            // Apply dynamic filters
            const mapping = {
                category: 'categories.name',
                category_name: 'categories.name',
                location: 'locations.name',
                location_name: 'locations.name',
                department: 'departments.name',
                department_name: 'departments.name',
                checklist_name: 'template_checklists.checklist_name',
                name: userType === 'supervisor' ? 'supervisor_users.username' : 'manager_users.username'
            };
            applyDynamicFilters(query, req.query, mapping);
        };

        // 1. Get Supervisor Counts
        let supervisorQuery = ChecklistData.query()
            .select(
                'supervisor_users.username as name',
                'locations.name as location_name',
                'categories.name as category_name',
                'departments.name as department_name',
                'template_checklists.checklist_name',
                knex.raw('COUNT(*) as total_nc'),
                knex.raw("COUNT(CASE WHEN supervisor_reviews.supervisor_status = 'Accepted' THEN 1 END) as accepted_nc"),
                knex.raw("COUNT(CASE WHEN supervisor_reviews.supervisor_status = 'Rejected' THEN 1 END) as rejected_nc")
            )
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id')
            .join('supervisor_reviews', function () {
                this.on('checklist_data.checklist_id', '=', 'supervisor_reviews.checklist_id')
                    .andOn('checklist_data.checklist_item_id', '=', 'supervisor_reviews.checklist_item_id');
            })
            .join('users as supervisor_users', 'supervisor_reviews.supervisor_id', 'supervisor_users.id')
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .where('checklist_data.status', 'No')
            .groupBy('supervisor_users.username', 'locations.name', 'categories.name', 'departments.name', 'template_checklists.checklist_name');

        applyFilters(supervisorQuery, 'supervisor');

        // 2. Get Manager Counts
        let managerQuery = ChecklistData.query()
            .select(
                'manager_users.username as name',
                'locations.name as location_name',
                'categories.name as category_name',
                'departments.name as department_name',
                'template_checklists.checklist_name',
                knex.raw('COUNT(*) as total_nc'),
                knex.raw("COUNT(CASE WHEN manager_reviews.manager_status = 'Approved' THEN 1 END) as accepted_nc"),
                knex.raw("COUNT(CASE WHEN manager_reviews.manager_status = 'Rejected' THEN 1 END) as rejected_nc")
            )
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id')
            .join('manager_reviews', function () {
                this.on('checklist_data.checklist_id', '=', 'manager_reviews.checklist_id')
                    .andOn('checklist_data.checklist_item_id', '=', 'manager_reviews.checklist_item_id');
            })
            .join('users as manager_users', 'manager_reviews.manager_id', 'manager_users.id')
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .where('checklist_data.status', 'No')
            .groupBy('manager_users.username', 'locations.name', 'categories.name', 'departments.name', 'template_checklists.checklist_name');

        applyFilters(managerQuery, 'manager');

        const targetRoles = req.query.role ? req.query.role.split(',').map(r => r.trim()) : [];
        const fetchSupervisor = targetRoles.length === 0 || targetRoles.includes('Supervisor');
        const fetchManager = targetRoles.length === 0 || targetRoles.includes('Manager');

        const [supervisorResults, managerResults] = await Promise.all([
            fetchSupervisor ? supervisorQuery : Promise.resolve([]),
            fetchManager ? managerQuery : Promise.resolve([])
        ]);

        // Merge and Format
        const formattedResults = [
            ...supervisorResults.map(item => ({
                role: 'Supervisor',
                name: item.name,
                location: item.location_name || 'N/A',
                category: item.category_name || 'N/A',
                department: item.department_name || 'N/A',
                checklist_name: item.checklist_name,
                total_nc: parseInt(item.total_nc || 0),
                accepted_nc: parseInt(item.accepted_nc || 0),
                rejected_nc: parseInt(item.rejected_nc || 0)
            })),
            ...managerResults.map(item => ({
                role: 'Manager',
                name: item.name,
                location: item.location_name || 'N/A',
                category: item.category_name || 'N/A',
                department: item.department_name || 'N/A',
                checklist_name: item.checklist_name,
                total_nc: parseInt(item.total_nc || 0),
                accepted_nc: parseInt(item.accepted_nc || 0),
                rejected_nc: parseInt(item.rejected_nc || 0)
            }))
        ];

        // Sort by Role, then Name
        formattedResults.sort((a, b) => {
            if (a.role !== b.role) return a.role.localeCompare(b.role); // Manager before Supervisor usually, or vice versa
            return a.name.localeCompare(b.name);
        });

        res.json({
            message: 'Manager/Supervisor NC Counts generated successfully',
            data: formattedResults
        });

    } catch (error) {
        logger.error('Manager/Supervisor NC Report Error:', error);
        res.status(500).json({ error: 'Failed to Generate Report', details: error.message });
    }
};

const exportManagerSupervisorNCCounts = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const userId = req.user.id;
        const userRole = req.user.role;
        let userDepartmentFilters = [];

        if (userRole === 'Manager') {
            const managerUser = await knex('users').where('id', userId).first('department_id');
            try {
                userDepartmentFilters = JSON.parse(managerUser?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }

        // Base query conditions
        const applyFilters = (query, userType) => {
            if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
            if (toDate) query.where('dci.assigned_date', '<=', toDate);
            if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
            if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
            if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);
            if (userDepartmentFilters.length > 0) query.whereIn('template_checklists.department_id', userDepartmentFilters);

            // Apply dynamic filters
            const mapping = {
                category: 'categories.name',
                category_name: 'categories.name',
                location: 'locations.name',
                location_name: 'locations.name',
                department: 'departments.name',
                department_name: 'departments.name',
                checklist_name: 'template_checklists.checklist_name',
                name: userType === 'supervisor' ? 'supervisor_users.username' : 'manager_users.username'
            };
            applyDynamicFilters(query, req.query, mapping);
        };

        // 1. Get Supervisor Counts
        let supervisorQuery = ChecklistData.query()
            .select(
                'supervisor_users.username as name',
                'locations.name as location_name',
                'categories.name as category_name',
                'departments.name as department_name',
                'template_checklists.checklist_name',
                knex.raw('COUNT(*) as total_nc'),
                knex.raw("COUNT(CASE WHEN supervisor_reviews.supervisor_status = 'Accepted' THEN 1 END) as accepted_nc"),
                knex.raw("COUNT(CASE WHEN supervisor_reviews.supervisor_status = 'Rejected' THEN 1 END) as rejected_nc")
            )
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id')
            .join('supervisor_reviews', function () {
                this.on('checklist_data.checklist_id', '=', 'supervisor_reviews.checklist_id')
                    .andOn('checklist_data.checklist_item_id', '=', 'supervisor_reviews.checklist_item_id');
            })
            .join('users as supervisor_users', 'supervisor_reviews.supervisor_id', 'supervisor_users.id')
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .where('checklist_data.status', 'No')
            .groupBy('supervisor_users.username', 'locations.name', 'categories.name', 'departments.name', 'template_checklists.checklist_name');

        applyFilters(supervisorQuery, 'supervisor');

        // 2. Get Manager Counts
        let managerQuery = ChecklistData.query()
            .select(
                'manager_users.username as name',
                'locations.name as location_name',
                'categories.name as category_name',
                'departments.name as department_name',
                'template_checklists.checklist_name',
                knex.raw('COUNT(*) as total_nc'),
                knex.raw("COUNT(CASE WHEN manager_reviews.manager_status = 'Approved' THEN 1 END) as accepted_nc"),
                knex.raw("COUNT(CASE WHEN manager_reviews.manager_status = 'Rejected' THEN 1 END) as rejected_nc")
            )
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id')
            .join('manager_reviews', function () {
                this.on('checklist_data.checklist_id', '=', 'manager_reviews.checklist_id')
                    .andOn('checklist_data.checklist_item_id', '=', 'manager_reviews.checklist_item_id');
            })
            .join('users as manager_users', 'manager_reviews.manager_id', 'manager_users.id')
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .where('checklist_data.status', 'No')
            .groupBy('manager_users.username', 'locations.name', 'categories.name', 'departments.name', 'template_checklists.checklist_name');

        applyFilters(managerQuery, 'manager');

        const targetRoles = req.query.role ? req.query.role.split(',').map(r => r.trim()) : [];
        const fetchSupervisor = targetRoles.length === 0 || targetRoles.includes('Supervisor');
        const fetchManager = targetRoles.length === 0 || targetRoles.includes('Manager');

        const [supervisorResults, managerResults] = await Promise.all([
            fetchSupervisor ? supervisorQuery : Promise.resolve([]),
            fetchManager ? managerQuery : Promise.resolve([])
        ]);

        // Merge and Format
        const formattedResults = [
            ...supervisorResults.map(item => ({
                role: 'Supervisor',
                name: item.name,
                location: item.location_name || 'N/A',
                category: item.category_name || 'N/A',
                department: item.department_name || 'N/A',
                checklist_name: item.checklist_name,
                total_nc: parseInt(item.total_nc || 0),
                accepted_nc: parseInt(item.accepted_nc || 0),
                rejected_nc: parseInt(item.rejected_nc || 0)
            })),
            ...managerResults.map(item => ({
                role: 'Manager',
                name: item.name,
                location: item.location_name || 'N/A',
                category: item.category_name || 'N/A',
                department: item.department_name || 'N/A',
                checklist_name: item.checklist_name,
                total_nc: parseInt(item.total_nc || 0),
                accepted_nc: parseInt(item.accepted_nc || 0),
                rejected_nc: parseInt(item.rejected_nc || 0)
            }))
        ];

        // Sort by Role, then Name
        formattedResults.sort((a, b) => {
            if (a.role !== b.role) return a.role.localeCompare(b.role);
            return a.name.localeCompare(b.name);
        });

        // Generate Excel
        const excelData = formattedResults.map(item => ({
            'Role': item.role,
            'Name': item.name,
            'Location': item.location,
            'Category': item.category,
            'Department': item.department,
            'Checklist Name': item.checklist_name,
            'Total NC': item.total_nc,
            'Accepted NC': item.accepted_nc,
            'Rejected NC': item.rejected_nc
        }));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('NC Counts');

        worksheet.columns = [
            { header: 'Role', key: 'Role', width: 15 },
            { header: 'Name', key: 'Name', width: 20 },
            { header: 'Location', key: 'Location', width: 15 },
            { header: 'Category', key: 'Category', width: 20 },
            { header: 'Department', key: 'Department', width: 15 },
            { header: 'Checklist Name', key: 'Checklist Name', width: 30 },
            { header: 'Total NC', key: 'Total NC', width: 10 },
            { header: 'Accepted NC', key: 'Accepted NC', width: 10 },
            { header: 'Rejected NC', key: 'Rejected NC', width: 10 }
        ];

        excelData.forEach(row => worksheet.addRow(row));
        styleHeaderRow(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Manager_Supervisor_NC_Counts_${new Date().toISOString().split('T')[0]}.xlsx"`);

        res.send(buffer);

    } catch (error) {
        logger.error('Export Manager/Supervisor NC Report Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};



const getChecklistItemsReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId, status, page = 1, limit = 10 } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);


        let query = ChecklistData.query()
            .select(
                'checklist_data.*',
                'template_checklists.checklist_name',
                'template_checklists.id as template_checklist_id',
                'checklists.created_at as checklist_date',
                'template_checklists.location_id',
                'template_checklists.department_id',
                'categories.name as category_name',
                'locations.name as location_name',
                'departments.name as department_name',
                'users.username as auditor_name',
                'checklist_items.activities as item_description',
                'checklist_items.process as process_name',
                knex.raw('(SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) as final_supervisor_decision'),
                knex.raw('(SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) as manager_decision')
            )
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .join('users', 'checklist_data.user_id', 'users.id')
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id');


        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);

        // Apply dynamic filters
        const mapping = {
            category: 'categories.name',
            category_name: 'categories.name',
            location: 'locations.name',
            location_name: 'locations.name',
            department: 'departments.name',
            department_name: 'departments.name',
            checklist_name: 'template_checklists.checklist_name',
            process: 'checklist_items.process',
            activity: 'checklist_items.activities',
            checklist_status: 'checklist_data.status'
        };
        applyDynamicFilters(query, req.query, mapping);

        // Status Filtering (supports comma-separated multi-select)
        if (status) {
            const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
            if (statuses.length > 0) {
                query.where(function () {
                    const simpleStatuses = statuses.filter(s => !['Accepted', 'Rejected'].includes(s));
                    const hasAccepted = statuses.includes('Accepted');
                    const hasRejected = statuses.includes('Rejected');

                    if (simpleStatuses.length > 0) {
                        this.whereIn('checklist_data.status', simpleStatuses);
                    }

                    if (hasAccepted) {
                        this.orWhere(function () {
                            this.where('checklist_data.status', 'No')
                                .whereRaw(`(
                                        (SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) = 'Approved'
                                        OR (
                                            (SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Accepted'
                                            AND (SELECT status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Close'
                                        )
                                    )`);
                        });
                    }

                    if (hasRejected) {
                        this.orWhere(function () {
                            this.where('checklist_data.status', 'No')
                                .whereRaw(`(
                                        (
                                            (SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) = 'Rejected'
                                            AND (SELECT status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Open'
                                        )
                                        OR (
                                            (SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) = 'Rejected'
                                            AND (SELECT status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Close'
                                            AND (SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Rejected'
                                        )
                                        OR (
                                            (SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) IS NULL
                                            AND (SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Rejected'
                                        )
                                    )`);
                        });
                    }
                });
            }
        }


        // Get total count
        const totalQuery = query.clone();
        const totalCount = await totalQuery.count('* as count').first();
        const totalRecords = totalCount.count;

        // Pagination
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
        query.orderBy('checklists.created_at', 'desc');

        const results = await query;

        // Get unique template checklist IDs
        const templateIds = [...new Set(results.map(r => r.template_checklist_id))];

        // Fetch all roster data for these templates
        const rosterData = await knex('rosters')
            .whereIn('checklist_id', templateIds)
            .select('checklist_id', 'supervisor_id', 'manager_id');

        // Group by template_checklist_id
        const rosterMap = {};
        rosterData.forEach(r => {
            if (!rosterMap[r.checklist_id]) {
                rosterMap[r.checklist_id] = { supervisorIds: new Set(), managerIds: new Set() };
            }
            if (r.supervisor_id) {
                try {
                    const ids = JSON.parse(r.supervisor_id);
                    ids.forEach(id => rosterMap[r.checklist_id].supervisorIds.add(id));
                } catch (e) { }
            }
            if (r.manager_id) {
                try {
                    const ids = JSON.parse(r.manager_id);
                    ids.forEach(id => rosterMap[r.checklist_id].managerIds.add(id));
                } catch (e) { }
            }
        });

        // Fetch all user names
        const allUserIds = new Set();
        Object.values(rosterMap).forEach(r => {
            r.supervisorIds.forEach(id => allUserIds.add(id));
            r.managerIds.forEach(id => allUserIds.add(id));
        });

        const users = await knex('users').whereIn('id', Array.from(allUserIds)).select('id', 'username');
        const userMap = {};
        users.forEach(u => userMap[u.id] = u.username);

        // Format results
        const formattedResults = results.map(item => {
            const supStatus = item.final_supervisor_decision;
            const manStatus = item.manager_decision;
            const currentStatus = (item.status || '').toString().trim().toLowerCase();
            let checklist_status = item.status;

            if (currentStatus === 'no') {
                if (manStatus === 'Approved') {
                    checklist_status = 'Accepted';
                } else if (manStatus === 'Rejected') {
                    checklist_status = 'Rejected';
                } else if (supStatus === 'Accepted') {
                    checklist_status = 'Accepted';
                } else if (supStatus === 'Rejected') {
                    checklist_status = 'Rejected';
                }
            }

            const roster = rosterMap[item.template_checklist_id];
            const supervisor_name = roster && roster.supervisorIds.size > 0
                ? Array.from(roster.supervisorIds).map(id => userMap[id]).filter(Boolean).join(', ')
                : '-';
            const manager_name = roster && roster.managerIds.size > 0
                ? Array.from(roster.managerIds).map(id => userMap[id]).filter(Boolean).join(', ')
                : '-';

            return {
                id: item.id,
                date: formatDate(item.checklist_date),
                checklist_name: item.checklist_name,
                category: item.category_name || 'N/A',
                process: item.process_name || 'N/A',
                activity: item.item_description,
                checklist_status: checklist_status,
                location: item.location_name || 'N/A',
                department: item.department_name || 'N/A',
                supervisor_name: supervisor_name,
                manager_name: manager_name
            };
        });

        res.json({
            message: 'Checklist Items Report generated successfully',
            data: formattedResults,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalRecords / limit),
                totalRecords: parseInt(totalRecords),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        logger.error('Checklist Items Report Error:', error);
        res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
};

const exportChecklistItemsReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId, status } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);

        let query = ChecklistData.query()
            .select(
                'checklist_data.*',
                'template_checklists.checklist_name',
                'template_checklists.id as template_checklist_id',
                'checklists.created_at as checklist_date',
                'categories.name as category_name',
                'locations.name as location_name',
                'departments.name as department_name',
                'checklist_items.activities as item_description',
                'checklist_items.process as item_process', // Fixed: was item_process in NC report but process_name here? Let's keep consistency.
                knex.raw('(SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) as final_supervisor_decision'),
                knex.raw('(SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) as manager_decision')
            )
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .join('checklist_items', 'checklist_data.checklist_item_id', 'checklist_items.id');

        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);

        // Apply dynamic filters
        const mapping = {
            category: 'categories.name',
            category_name: 'categories.name',
            location: 'locations.name',
            location_name: 'locations.name',
            department: 'departments.name',
            department_name: 'departments.name',
            checklist_name: 'template_checklists.checklist_name',
            process: 'checklist_items.process',
            activity: 'checklist_items.activities',
            checklist_status: 'checklist_data.status'
        };
        applyDynamicFilters(query, req.query, mapping);

        // Status Filtering
        if (status) {
            if (['Yes', 'Technical Issue', 'Not Applicable'].includes(status)) {
                query.where('checklist_data.status', status);
            } else if (status === 'No') {
                query.where('checklist_data.status', 'No');
            } else if (status === 'Accepted') {
                query.where('checklist_data.status', 'No')
                    .whereRaw(`(
                        (SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) = 'Approved'
                        OR (
                            (SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) IS NULL
                            AND (SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Accepted'
                        )
                    )`);
            } else if (status === 'Rejected') {
                query.where('checklist_data.status', 'No')
                    .whereRaw(`(
                        (
                            (SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) = 'Rejected'
                            AND (SELECT status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Open'
                        )
                        OR (
                            (SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) = 'Rejected'
                            AND (SELECT status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Close'
                            AND (SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Rejected'
                        )
                        OR (
                            (SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = checklist_data.checklist_id AND manager_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) IS NULL
                            AND (SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = checklist_data.checklist_id AND supervisor_reviews.checklist_item_id = checklist_data.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) = 'Rejected'
                        )
                    )`);
            }
        }

        query.orderBy('checklists.created_at', 'desc');
        const results = await query;

        // Get unique template checklist IDs
        const templateIds = [...new Set(results.map(r => r.template_checklist_id))];

        // Fetch all roster data
        const rosterData = await knex('rosters')
            .whereIn('checklist_id', templateIds)
            .select('checklist_id', 'supervisor_id', 'manager_id');

        const rosterMap = {};
        rosterData.forEach(r => {
            if (!rosterMap[r.checklist_id]) {
                rosterMap[r.checklist_id] = { supervisorIds: new Set(), managerIds: new Set() };
            }
            if (r.supervisor_id) {
                try {
                    const ids = JSON.parse(r.supervisor_id);
                    ids.forEach(id => rosterMap[r.checklist_id].supervisorIds.add(id));
                } catch (e) { }
            }
            if (r.manager_id) {
                try {
                    const ids = JSON.parse(r.manager_id);
                    ids.forEach(id => rosterMap[r.checklist_id].managerIds.add(id));
                } catch (e) { }
            }
        });

        const allUserIds = new Set();
        Object.values(rosterMap).forEach(r => {
            r.supervisorIds.forEach(id => allUserIds.add(id));
            r.managerIds.forEach(id => allUserIds.add(id));
        });

        const users = await knex('users').whereIn('id', Array.from(allUserIds)).select('id', 'username');
        const userMap = {};
        users.forEach(u => userMap[u.id] = u.username);

        // Create workbook with ExcelJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Checklist Items');

        worksheet.columns = [
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Location', key: 'location', width: 15 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Checklist Name', key: 'checklist_name', width: 25 },
            { header: 'Process', key: 'process', width: 20 },
            { header: 'Activity', key: 'activity', width: 40 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Supervisor Name', key: 'supervisor_name', width: 20 },
            { header: 'Manager Name', key: 'manager_name', width: 20 }
        ];

        for (const item of results) {
            const supStatus = item.final_supervisor_decision;
            const manStatus = item.manager_decision;
            const currentStatus = (item.status || '').toString().trim().toLowerCase();
            let checklist_status = item.status;

            if (currentStatus === 'no') {
                if (manStatus === 'Approved') {
                    checklist_status = 'Accepted';
                } else if (manStatus === 'Rejected') {
                    checklist_status = 'Rejected';
                } else if (supStatus === 'Accepted') {
                    checklist_status = 'Accepted';
                } else if (supStatus === 'Rejected') {
                    checklist_status = 'Rejected';
                }
            }

            const roster = rosterMap[item.template_checklist_id];
            const supervisor_name = roster && roster.supervisorIds.size > 0
                ? Array.from(roster.supervisorIds).map(id => userMap[id]).filter(Boolean).join(', ')
                : '-';
            const manager_name = roster && roster.managerIds.size > 0
                ? Array.from(roster.managerIds).map(id => userMap[id]).filter(Boolean).join(', ')
                : '-';

            const row = worksheet.addRow({
                date: formatDate(item.checklist_date),
                location: item.location_name || 'N/A',
                department: item.department_name || 'N/A',
                category: item.category_name || 'N/A',
                checklist_name: item.checklist_name,
                process: item.item_process || 'N/A',
                activity: item.item_description,
                status: checklist_status,
                supervisor_name: supervisor_name,
                manager_name: manager_name
            });

            const statusLower = checklist_status.toString().toLowerCase();
            if (statusLower === 'yes' || statusLower === 'accepted') {
                row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
            } else if (statusLower === 'no' || statusLower === 'rejected') {
                row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
            }
        }

        styleHeaderRow(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Checklist_Items_Report_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);

    } catch (error) {
        logger.error('Export Checklist Items Report Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

const getUserStatusReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId, page = 1, limit = 10 } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const userId = req.user.id;
        const userRole = req.user.role;
        let userDepartmentFilters = [];

        if (userRole === 'Manager' || userRole === 'Supervisor') {
            const managerUser = await knex('users').where('id', userId).first('department_id');
            try {
                userDepartmentFilters = JSON.parse(managerUser?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }



        let query = knex('checklists')
            .select(
                'template_checklists.id as template_id',
                'template_checklists.checklist_name',
                'departments.name as department_name',
                'locations.name as location_name',
                'categories.name as category_name',
                knex.raw('GROUP_CONCAT(DISTINCT rosters.supervisor_id) as supervisor_ids'),
                knex.raw('GROUP_CONCAT(DISTINCT rosters.manager_id) as manager_ids')
            )
            .select(
                knex.raw('COUNT(DISTINCT checklists.id) as total_checklists'),
                knex.raw("COUNT(DISTINCT CASE WHEN checklists.status IN ('Awaiting for NC response', 'Pending by Supervisor') THEN checklists.id END) as awaiting_supervisor"),
                knex.raw("COUNT(DISTINCT CASE WHEN checklists.status = 'Accepted by Supervisor' THEN checklists.id END) as awaiting_manager"),
                knex.raw("COUNT(DISTINCT CASE WHEN checklists.status = 'Completed' THEN checklists.id END) as completed"),
                knex.raw("COUNT(DISTINCT CASE WHEN checklists.status = 'Completed without NCs' THEN checklists.id END) as completed_without_ncs")
            )
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('rosters', 'template_checklists.id', 'rosters.checklist_id')
            .whereIn('checklists.status', ['Awaiting for NC response', 'Accepted by Supervisor', 'Completed', 'Completed without NCs', 'Pending by Supervisor'])
            .groupBy('template_checklists.id', 'template_checklists.checklist_name', 'departments.name', 'locations.name');

        if (fromDate) query.where('dci.assigned_date', '>=', `${fromDate} 00:00:00`);
        if (toDate) query.where('dci.assigned_date', '<=', `${toDate} 23:59:59`);
        if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);
        if (userDepartmentFilters.length > 0) query.whereIn('template_checklists.department_id', userDepartmentFilters);

        // Apply dynamic filters to main query
        const mapping = {
            category: 'categories.name',
            category_name: 'categories.name',
            location: 'locations.name',
            location_name: 'locations.name',
            department: 'departments.name',
            department_name: 'departments.name',
            checklist_name: 'template_checklists.checklist_name'
        };
        applyDynamicFilters(query, req.query, mapping);

        // Get total count (groups)
        let totalQuery = knex('checklists')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .leftJoin('categories', 'checklists.category_id', 'categories.id')
            .leftJoin('locations', 'checklists.location_id', 'locations.id')
            .leftJoin('departments', 'checklists.department_id', 'departments.id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .whereIn('checklists.status', ['Awaiting for NC response', 'Accepted by Supervisor', 'Completed', 'Completed without NCs', 'Pending by Supervisor']);

        if (fromDate) totalQuery.where('dci.assigned_date', '>=', `${fromDate} 00:00:00`);
        if (toDate) totalQuery.where('dci.assigned_date', '<=', `${toDate} 23:59:59`);
        if (filteredLocationIds.length > 0) totalQuery.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) totalQuery.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) totalQuery.whereIn('template_checklists.category_id', filteredCategoryIds);
        if (userDepartmentFilters.length > 0) totalQuery.whereIn('template_checklists.department_id', userDepartmentFilters);

        // Apply same dynamic filters to totalQuery
        applyDynamicFilters(totalQuery, req.query, mapping);

        const totalGroups = await totalQuery.countDistinct('template_checklists.id as count').first();
        const totalRecords = totalGroups ? totalGroups.count : 0;

        // Pagination
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);

        const results = await query;

        // Get unique template checklist IDs
        const templateIds = [...new Set(results.map(r => r.template_id))];

        // Fetch all roster data for these templates
        const rosterData = await knex('rosters')
            .whereIn('checklist_id', templateIds)
            .select('checklist_id', 'supervisor_id', 'manager_id');

        // Group by template_checklist_id
        const rosterMap = {};
        rosterData.forEach(r => {
            if (!rosterMap[r.checklist_id]) {
                rosterMap[r.checklist_id] = { supervisorIds: new Set(), managerIds: new Set() };
            }
            if (r.supervisor_id) {
                try {
                    const ids = JSON.parse(r.supervisor_id);
                    ids.forEach(id => rosterMap[r.checklist_id].supervisorIds.add(id));
                } catch (e) { }
            }
            if (r.manager_id) {
                try {
                    const ids = JSON.parse(r.manager_id);
                    ids.forEach(id => rosterMap[r.checklist_id].managerIds.add(id));
                } catch (e) { }
            }
        });

        // Fetch all user names
        const allUserIds = new Set();
        Object.values(rosterMap).forEach(r => {
            r.supervisorIds.forEach(id => allUserIds.add(id));
            r.managerIds.forEach(id => allUserIds.add(id));
        });

        const users = await knex('users').whereIn('id', Array.from(allUserIds)).select('id', 'username');
        const userMap = {};
        users.forEach(u => userMap[u.id] = u.username);

        // Add supervisor and manager names to results
        results.forEach(result => {
            const roster = rosterMap[result.template_id];
            result.supervisor_names = roster && roster.supervisorIds.size > 0
                ? Array.from(roster.supervisorIds).map(id => userMap[id]).filter(Boolean).join(', ')
                : '-';
            result.manager_names = roster && roster.managerIds.size > 0
                ? Array.from(roster.managerIds).map(id => userMap[id]).filter(Boolean).join(', ')
                : '-';

            // Clean up the raw ID fields
            delete result.supervisor_ids;
            delete result.manager_ids;
        });

        res.json({
            message: 'User Status Report generated successfully',
            data: results,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalRecords / limit),
                totalRecords: parseInt(totalRecords),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        logger.error('User Status Report Error:', error);
        res.status(500).json({ error: 'Failed to Generate Report', details: error.message });
    }
};

const exportUserStatusReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const userId = req.user.id;
        const userRole = req.user.role;
        let userDepartmentFilters = [];

        if (userRole === 'Manager' || userRole === 'Supervisor') {
            const managerUser = await knex('users').where('id', userId).first('department_id');
            try {
                userDepartmentFilters = JSON.parse(managerUser?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }

        let query = knex('checklists')
            .select(
                'template_checklists.id as template_id',
                'template_checklists.checklist_name',
                'departments.name as department_name',
                'locations.name as location_name',
                'categories.name as category_name',
                knex.raw('GROUP_CONCAT(DISTINCT rosters.supervisor_id) as supervisor_ids'),
                knex.raw('GROUP_CONCAT(DISTINCT rosters.manager_id) as manager_ids')
            )
            .countDistinct({ total_checklists: 'checklists.id' })
            .count({
                awaiting_supervisor: knex.raw('DISTINCT CASE WHEN ?? = ? THEN ?? ELSE NULL END', ['checklists.status', 'Awaiting for NC response', 'checklists.id'])
            })
            .count({
                awaiting_manager: knex.raw('DISTINCT CASE WHEN ?? = ? THEN ?? ELSE NULL END', ['checklists.status', 'Accepted by Supervisor', 'checklists.id'])
            })
            .count({
                completed: knex.raw('DISTINCT CASE WHEN ?? = ? THEN ?? ELSE NULL END', ['checklists.status', 'Completed', 'checklists.id'])
            })
            .count({
                completed_without_ncs: knex.raw('DISTINCT CASE WHEN ?? = ? THEN ?? ELSE NULL END', ['checklists.status', 'Completed without NCs', 'checklists.id'])
            })
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('rosters', 'template_checklists.id', 'rosters.checklist_id')
            .whereIn('checklists.status', ['Awaiting for NC response', 'Accepted by Supervisor', 'Completed', 'Completed without NCs'])
            .groupBy('template_checklists.id', 'template_checklists.checklist_name', 'departments.name', 'locations.name');

        if (fromDate) query.where('dci.assigned_date', '>=', `${fromDate} 00:00:00`);
        if (toDate) query.where('dci.assigned_date', '<=', `${toDate} 23:59:59`);
        if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);
        if (userDepartmentFilters.length > 0) query.whereIn('template_checklists.department_id', userDepartmentFilters);

        // Apply dynamic filters
        const mapping = {
            category: 'categories.name',
            category_name: 'categories.name',
            location: 'locations.name',
            location_name: 'locations.name',
            department: 'departments.name',
            department_name: 'departments.name',
            checklist_name: 'template_checklists.checklist_name'
        };
        applyDynamicFilters(query, req.query, mapping);

        const results = await query;

        // Get unique template checklist IDs
        const templateIds = [...new Set(results.map(r => r.template_id))];

        // Fetch all roster data for these templates
        const rosterData = await knex('rosters')
            .whereIn('checklist_id', templateIds)
            .select('checklist_id', 'supervisor_id', 'manager_id');

        // Group by template_checklist_id
        const rosterMap = {};
        rosterData.forEach(r => {
            if (!rosterMap[r.checklist_id]) {
                rosterMap[r.checklist_id] = { supervisorIds: new Set(), managerIds: new Set() };
            }
            if (r.supervisor_id) {
                try {
                    const ids = JSON.parse(r.supervisor_id);
                    ids.forEach(id => rosterMap[r.checklist_id].supervisorIds.add(id));
                } catch (e) { }
            }
            if (r.manager_id) {
                try {
                    const ids = JSON.parse(r.manager_id);
                    ids.forEach(id => rosterMap[r.checklist_id].managerIds.add(id));
                } catch (e) { }
            }
        });

        // Fetch all user names
        const allUserIds = new Set();
        Object.values(rosterMap).forEach(r => {
            r.supervisorIds.forEach(id => allUserIds.add(id));
            r.managerIds.forEach(id => allUserIds.add(id));
        });

        const users = await knex('users').whereIn('id', Array.from(allUserIds)).select('id', 'username');
        const userMap = {};
        users.forEach(u => userMap[u.id] = u.username);

        // Add supervisor and manager names to results
        results.forEach(result => {
            const roster = rosterMap[result.template_id];
            result.supervisor_names = roster && roster.supervisorIds.size > 0
                ? Array.from(roster.supervisorIds).map(id => userMap[id]).filter(Boolean).join(', ')
                : '-';
            result.manager_names = roster && roster.managerIds.size > 0
                ? Array.from(roster.managerIds).map(id => userMap[id]).filter(Boolean).join(', ')
                : '-';
        });

        const excelData = results.map(item => ({
            'Checklist Name': item.checklist_name,
            'Department': item.department_name || 'N/A',
            'Location': item.location_name || 'N/A',
            'Supervisor Name': item.supervisor_names || '-',
            'Manager Name': item.manager_names || '-',
            'Total Checklists': item.total_checklists,
            'Awaiting Supervisor': item.awaiting_supervisor,
            'Awaiting Manager': item.awaiting_manager,
            'Completed': item.completed,
            'Completed without NCs': item.completed_without_ncs
        }));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('User Status Report');

        worksheet.columns = [
            { header: 'Checklist Name', key: 'Checklist Name', width: 20 },
            { header: 'Department', key: 'Department', width: 20 },
            { header: 'Location', key: 'Location', width: 15 },
            { header: 'Supervisor Name', key: 'Supervisor Name', width: 20 },
            { header: 'Manager Name', key: 'Manager Name', width: 20 },
            { header: 'Total Checklists', key: 'Total Checklists', width: 20 },
            { header: 'Awaiting Supervisor', key: 'Awaiting Supervisor', width: 20 },
            { header: 'Awaiting Manager', key: 'Awaiting Manager', width: 20 },
            { header: 'Completed', key: 'Completed', width: 15 },
            { header: 'Completed without NCs', key: 'Completed without NCs', width: 20 }
        ];

        excelData.forEach(row => worksheet.addRow(row));
        styleHeaderRow(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="User_Status_Report_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);

    } catch (error) {
        logger.error('Export User Status Report Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

const getAuditStatusReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId, page = 1, limit = 10 } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const userId = req.user.id;
        const userRole = req.user.role;
        let userDepartmentFilters = [];

        if (userRole === 'Manager' || userRole === 'Supervisor') {
            const managerUser = await knex('users').where('id', userId).first('department_id');
            try {
                userDepartmentFilters = JSON.parse(managerUser?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }

        // First, fetch all raw data without aggregation
        let dataQuery = knex('checklists')
            .select(
                'categories.name as category_name',
                'locations.id as location_id',
                'locations.name as location_name',
                'departments.name as department_name',
                'dci.assigned_date as checklist_date',
                'checklists.id as checklist_id',
                'checklists.camera_count',
                'checklists.total_camera_audited',
                'checklists.total_camera_random_audited',
                'checklists.total_camera_not_audited',
                'checklists.total_camera_offline',
                'checklists.total_camera_technical_issues',
                'checklists.total_ncs'
            )
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .join('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')

        if (fromDate) dataQuery.where('dci.assigned_date', '>=', fromDate);
        if (toDate) dataQuery.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) dataQuery.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) dataQuery.whereIn('template_checklists.department_id', filteredDeptIds);
        if (userDepartmentFilters.length > 0) dataQuery.whereIn('template_checklists.department_id', userDepartmentFilters);

        if (filteredCategoryIds.length > 0) dataQuery.whereIn('template_checklists.category_id', filteredCategoryIds);

        // Apply dynamic filters
        const mapping = {
            category: 'categories.name',
            category_name: 'categories.name',
            location: 'locations.name',
            location_name: 'locations.name',
            department: 'departments.name',
            department_name: 'departments.name',
            checklist_name: 'template_checklists.checklist_name'
        };
        applyDynamicFilters(dataQuery, req.query, mapping);

        dataQuery.orderBy('dci.assigned_date', 'desc');
        const rawData = await dataQuery;

        // Group data by category AND location
        const locationCategoryData = {};
        rawData.forEach(item => {
            const groupKey = `${item.location_id || 'no_location'}_${item.category_name || 'no_category'}`;

            if (!locationCategoryData[groupKey]) {
                locationCategoryData[groupKey] = {
                    location_id: item.location_id,
                    location_name: item.location_name || 'N/A',
                    category_name: item.category_name || 'N/A',
                    checklists: new Set(),
                    camera_count: 0,
                    total_camera_audited: 0,
                    total_camera_random_audited: 0,
                    total_camera_not_audited: 0,
                    total_camera_offline: 0,
                    total_camera_technical_issues: 0,
                    total_ncs: 0
                };
            }

            const group = locationCategoryData[groupKey];

            // Track unique checklists
            if (item.checklist_id) {
                group.checklists.add(item.checklist_id);
            }
            // Accumulate camera counts per location + category
            group.camera_count += parseInt(item.camera_count || 0);
            group.total_camera_audited += parseInt(item.total_camera_audited || 0);
            group.total_camera_random_audited += parseInt(item.total_camera_random_audited || 0);
            group.total_camera_not_audited += parseInt((item.total_camera_random_audited || 0) + (item.total_camera_offline || 0) + (item.total_camera_technical_issues || 0));
            group.total_camera_offline += parseInt(item.total_camera_offline || 0);
            group.total_camera_technical_issues += parseInt(item.total_camera_technical_issues || 0);
            group.total_ncs += parseInt(item.total_ncs || 0);
        });

        // Convert grouped data to array and calculate totals and percentages
        const processedData = Object.values(locationCategoryData).map(item => {
            const offlinePercentage = item.camera_count > 0 ? Math.round(((item.total_camera_offline / item.camera_count) * 100).toFixed(2)) : 0;
            const technicalIssuesPercentage = item.camera_count > 0 ? Math.round(((item.total_camera_technical_issues / item.camera_count) * 100).toFixed(2)) : 0;

            return {
                category_name: item.category_name,
                location_name: item.location_name,
                no_of_location: `${item.checklists.size}`,
                camera_count: item.camera_count,
                total_camera_audited: item.total_camera_audited,
                total_camera_random_audited: item.total_camera_random_audited,
                total_camera_not_audited: item.total_camera_not_audited,
                total_camera_offline: item.total_camera_offline,
                total_camera_offline_percentage: offlinePercentage,
                total_camera_technical_issues: item.total_camera_technical_issues,
                total_camera_technical_issues_percentage: technicalIssuesPercentage,
                total_ncs: item.total_ncs
            };
        });

        // Sort by category_name, then location_name
        processedData.sort((a, b) => {
            const catCompare = a.category_name.localeCompare(b.category_name);
            if (catCompare !== 0) return catCompare;
            return a.location_name.localeCompare(b.location_name);
        });

        // Apply pagination
        const totalRecords = processedData.length;
        const offset = (page - 1) * limit;
        const paginatedData = processedData.slice(offset, offset + parseInt(limit));

        res.json({
            message: 'Audit Status Report generated successfully',
            data: paginatedData,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalRecords / limit),
                totalRecords: totalRecords,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        logger.error('Audit Status Report Error:', error);
        res.status(500).json({ error: 'Failed to Generate Report', details: error.message });
    }
};

const exportAuditStatusReportDetailed = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const userId = req.user.id;
        const userRole = req.user.role;
        let userDepartmentFilters = [];

        if (userRole === 'Manager' || userRole === 'Supervisor') {
            const managerUser = await knex('users').where('id', userId).first('department_id');
            try {
                userDepartmentFilters = JSON.parse(managerUser?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }

        let dataQuery = knex('checklists')
            .select(
                'categories.name as category_name',
                'locations.id as location_id',
                'locations.name as location_name',
                'departments.name as department_name',
                'checklists.id as checklist_id',
                'checklists.camera_count',
                'checklists.total_camera_audited',
                'checklists.total_camera_random_audited',
                'checklists.total_camera_not_audited',
                'checklists.total_camera_offline',
                'checklists.total_camera_technical_issues',
                'checklists.total_ncs'
            )
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .join('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id');

        if (fromDate) dataQuery.where('dci.assigned_date', '>=', fromDate);
        if (toDate) dataQuery.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) dataQuery.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) dataQuery.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) dataQuery.whereIn('template_checklists.category_id', filteredCategoryIds);
        if (userDepartmentFilters.length > 0) dataQuery.whereIn('template_checklists.department_id', userDepartmentFilters);

        const mapping = {
            category: 'categories.name',
            category_name: 'categories.name',
            location: 'locations.name',
            location_name: 'locations.name',
            department: 'departments.name',
            department_name: 'departments.name',
            checklist_name: 'template_checklists.checklist_name'
        };
        applyDynamicFilters(dataQuery, req.query, mapping);

        dataQuery.orderBy('dci.assigned_date', 'desc');
        const rawData = await dataQuery;

        // Group by category AND location (same as getAuditStatusReport)
        const locationCategoryData = {};
        rawData.forEach(item => {
            const groupKey = `${item.location_id || 'no_location'}_${item.category_name || 'no_category'}`;
            if (!locationCategoryData[groupKey]) {
                locationCategoryData[groupKey] = {
                    location_name: item.location_name || 'N/A',
                    category_name: item.category_name || 'N/A',
                    checklists: new Set(),
                    camera_count: 0,
                    total_camera_audited: 0,
                    total_camera_random_audited: 0,
                    total_camera_not_audited: 0,
                    total_camera_offline: 0,
                    total_camera_technical_issues: 0,
                    total_ncs: 0
                };
            }
            const group = locationCategoryData[groupKey];
            if (item.checklist_id) group.checklists.add(item.checklist_id);
            group.camera_count += parseInt(item.camera_count || 0);
            group.total_camera_audited += parseInt(item.total_camera_audited || 0);
            group.total_camera_random_audited += parseInt(item.total_camera_random_audited || 0);
            group.total_camera_not_audited += parseInt((item.total_camera_random_audited || 0) + (item.total_camera_offline || 0) + (item.total_camera_technical_issues || 0));
            group.total_camera_offline += parseInt(item.total_camera_offline || 0);
            group.total_camera_technical_issues += parseInt(item.total_camera_technical_issues || 0);
            group.total_ncs += parseInt(item.total_ncs || 0);
        });

        const processedData = Object.values(locationCategoryData).map(item => {
            const offlinePercentage = item.camera_count > 0 ? `${Math.round((item.total_camera_offline / item.camera_count) * 100)}%` : '0%';
            const technicalIssuesPercentage = item.camera_count > 0 ? `${Math.round((item.total_camera_technical_issues / item.camera_count) * 100)}%` : '0%';
            return {
                'Category': item.category_name,
                'Location': item.location_name,
                'No. of Location': item.checklists.size,
                'Total Camera Count': item.camera_count,
                'Total Camera Audited': item.total_camera_audited,
                'Total Camera Random Audited': item.total_camera_random_audited,
                'Total Camera Not Audited': item.total_camera_not_audited,
                'Total Camera Offline': item.total_camera_offline,
                'Offline %': offlinePercentage,
                'Total Camera Technical Issues': item.total_camera_technical_issues,
                'Technical %': technicalIssuesPercentage,
                'Total NCs': item.total_ncs
            };
        });

        processedData.sort((a, b) => {
            const catCompare = a.Category.localeCompare(b.Category);
            if (catCompare !== 0) return catCompare;
            return a.Location.localeCompare(b.Location);
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Audit Status Report');

        worksheet.columns = [
            { header: 'Category', key: 'Category', width: 25 },
            { header: 'Location', key: 'Location', width: 15 },
            { header: 'No. of Location', key: 'No. of Location', width: 15 },
            { header: 'Total Camera Count', key: 'Total Camera Count', width: 18 },
            { header: 'Total Camera Audited', key: 'Total Camera Audited', width: 20 },
            { header: 'Total Camera Not Audited', key: 'Total Camera Not Audited', width: 22 },
            { header: 'Total Camera Random Audited', key: 'Total Camera Random Audited', width: 25 },
            { header: 'Total Camera Offline', key: 'Total Camera Offline', width: 18 },
            { header: 'Offline %', key: 'Offline %', width: 12 },
            { header: 'Total Camera Technical Issues', key: 'Total Camera Technical Issues', width: 25 },
            { header: 'Technical %', key: 'Technical %', width: 12 },
            { header: 'Total NCs', key: 'Total NCs', width: 12 }
        ];

        const rowColors = ['FFE8F4FD', 'FFECF8EC', 'FFF3EEFF', 'FFFEF4E8'];
        processedData.forEach((row, index) => {
            const dataRow = worksheet.addRow(row);
            const bgColor = rowColors[index % rowColors.length];
            dataRow.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin', color: { argb: 'FFD0D0D0' } }, bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } };
            });
            dataRow.getCell(8).font = { color: { argb: 'FF008000' } };
            dataRow.getCell(9).font = { bold: true, color: { argb: 'FFCC0000' } };
            dataRow.getCell(10).font = { color: { argb: 'FF008000' } };
            dataRow.getCell(11).font = { bold: true, color: { argb: 'FFCC0000' } };
        });

        const headerRow = worksheet.getRow(1);
        headerRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Audit_Status_Report_Detailed_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);

    } catch (error) {
        logger.error('Export Audit Status Report Detailed Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

const exportAuditStatusReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);
        const userId = req.user.id;
        const userRole = req.user.role;
        let userDepartmentFilters = [];

        if (userRole === 'Manager' || userRole === 'Supervisor') {
            const managerUser = await knex('users').where('id', userId).first('department_id');
            try {
                userDepartmentFilters = JSON.parse(managerUser?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }


        // First, fetch all raw data without aggregation
        let dataQuery = knex('checklists')
            .select(
                'categories.name as category_name',
                'locations.id as location_id',
                'locations.name as location_name',
                'checklists.id as checklist_id',
                'checklists.camera_count',
                'checklists.total_camera_audited',
                'checklists.total_camera_random_audited',
                'checklists.total_camera_not_audited',
                'checklists.total_camera_offline',
                'checklists.total_camera_technical_issues',
                'checklists.total_ncs'
            )
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .join('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')

        if (fromDate) dataQuery.where('dci.assigned_date', '>=', fromDate);
        if (toDate) dataQuery.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) dataQuery.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) dataQuery.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) dataQuery.whereIn('template_checklists.category_id', filteredCategoryIds);
        if (userDepartmentFilters.length > 0) dataQuery.whereIn('template_checklists.department_id', userDepartmentFilters);

        // Apply dynamic filters
        const mapping = {
            category: 'categories.name',
            category_name: 'categories.name',
            location: 'locations.name',
            location_name: 'locations.name',
            department: 'departments.name',
            department_name: 'departments.name',
            checklist_name: 'template_checklists.checklist_name'
        };
        applyDynamicFilters(dataQuery, req.query, mapping);

        dataQuery.orderBy('dci.assigned_date', 'desc');
        const rawData = await dataQuery;

        // Group data by category AND location
        const locationCategoryData = {};
        rawData.forEach(item => {
            const groupKey = `${item.location_id || 'no_location'}_${item.category_name || 'no_category'}`;

            if (!locationCategoryData[groupKey]) {
                locationCategoryData[groupKey] = {
                    location_id: item.location_id,
                    location_name: item.location_name || 'N/A',
                    category_name: item.category_name || 'N/A',
                    checklists: new Set(),
                    camera_count: 0,
                    total_camera_audited: 0,
                    total_camera_random_audited: 0,
                    total_camera_not_audited: 0,
                    total_camera_offline: 0,
                    total_camera_technical_issues: 0,
                    total_ncs: 0
                };
            }

            const group = locationCategoryData[groupKey];

            // Track unique checklists
            if (item.checklist_id) {
                group.checklists.add(item.checklist_id);
            }

            // Accumulate camera counts per location + category
            group.camera_count += parseInt(item.camera_count || 0);
            group.total_camera_audited += parseInt(item.total_camera_audited || 0);
            group.total_camera_random_audited += parseInt(item.total_camera_random_audited || 0);
            group.total_camera_not_audited += parseInt((item.total_camera_random_audited || 0) + (item.total_camera_offline || 0) + (item.total_camera_technical_issues || 0));
            group.total_camera_offline += parseInt(item.total_camera_offline || 0);
            group.total_camera_technical_issues += parseInt(item.total_camera_technical_issues || 0);
            group.total_ncs += parseInt(item.total_ncs || 0);
        });

        // Convert grouped data to array and calculate totals and percentages
        const processedItems = Object.values(locationCategoryData);

        // Check if category filter matches the summary categories
        const summaryCategories = ['cc', 'depot', 'rmcc'];
        const filteredCategoryNames = req.query.category_name ? req.query.category_name.split(',').map(v => v.trim()) : [];
        const isSummaryExport = true;

        let processedData;
        if (isSummaryExport) {
            // Sum only CC, Depot, RMCC; others show individual rows
            const categoryGroups = {};
            const individualRows = [];
            processedItems.forEach(item => {
                const cat = item.category_name;
                if (summaryCategories.includes(cat.toLowerCase())) {
                    if (!categoryGroups[cat]) {
                        categoryGroups[cat] = {
                            category_name: cat,
                            no_of_location: 0,
                            unique_locations: 0,
                            location_ids: new Set(),
                            camera_count: 0,
                            total_camera_audited: 0,
                            total_camera_random_audited: 0,
                            total_camera_not_audited: 0,
                            total_camera_offline: 0,
                            total_camera_technical_issues: 0,
                            total_ncs: 0
                        };
                    }
                    const g = categoryGroups[cat];
                    g.no_of_location += item.checklists.size;
                    if (item.location_id) g.location_ids.add(item.location_id);
                    g.camera_count += item.camera_count;
                    g.total_camera_audited += item.total_camera_audited;
                    g.total_camera_random_audited += item.total_camera_random_audited;
                    g.total_camera_not_audited += item.total_camera_not_audited;
                    g.total_camera_offline += item.total_camera_offline;
                    g.total_camera_technical_issues += item.total_camera_technical_issues;
                    g.total_ncs += item.total_ncs;
                } else {
                    const offlinePercentage = item.camera_count > 0 ? `${Math.round((item.total_camera_offline / item.camera_count) * 100)}%` : '0%';
                    const technicalIssuesPercentage = item.camera_count > 0 ? `${Math.round((item.total_camera_technical_issues / item.camera_count) * 100)}%` : '0%';
                    individualRows.push({
                        'Category': item.category_name,
                        'Location': item.location_name || 'N/A',
                        'No. of Location': item.checklists.size,
                        'Total Camera Count': item.camera_count,
                        'Total Camera Audited': item.total_camera_audited,
                        'Total Camera Random Audited': item.total_camera_random_audited,
                        'Total Camera Not Audited': item.total_camera_not_audited,
                        'Total Camera Offline': item.total_camera_offline,
                        'Offline %': offlinePercentage,
                        'Total Camera Technical Issues': item.total_camera_technical_issues,
                        'Technical %': technicalIssuesPercentage,
                        'Total NCs': item.total_ncs
                    });
                }
            });

            const summaryRows = Object.values(categoryGroups).map(g => {
                g.unique_locations = g.location_ids.size;
                const offlinePercentage = g.camera_count > 0 ? `${Math.round((g.total_camera_offline / g.camera_count) * 100)}%` : '0%';
                const technicalIssuesPercentage = g.camera_count > 0 ? `${Math.round((g.total_camera_technical_issues / g.camera_count) * 100)}%` : '0%';
                return {
                    'Category': g.category_name,
                    'Location': g.category_name,
                    'No. of Location': g.no_of_location,
                    'Total Camera Count': g.camera_count,
                    'Total Camera Audited': g.total_camera_audited,
                    'Total Camera Random Audited': g.total_camera_random_audited,
                    'Total Camera Not Audited': g.total_camera_not_audited,
                    'Total Camera Offline': g.total_camera_offline,
                    'Offline %': offlinePercentage,
                    'Total Camera Technical Issues': g.total_camera_technical_issues,
                    'Technical %': technicalIssuesPercentage,
                    'Total NCs': g.total_ncs
                };
            });
            summaryRows.sort((a, b) => a.Category.localeCompare(b.Category));
            individualRows.sort((a, b) => { const c = a.Category.localeCompare(b.Category); return c !== 0 ? c : String(a.Location).localeCompare(String(b.Location)); });
            processedData = [...summaryRows, ...individualRows];
        } else {
            processedData = processedItems.map(item => {
                const totalCameraCount = item.camera_count;
                const offlinePercentage = totalCameraCount > 0 ? `${Math.round((item.total_camera_offline / totalCameraCount) * 100)}%` : '0%';
                const technicalIssuesPercentage = totalCameraCount > 0 ? `${Math.round((item.total_camera_technical_issues / totalCameraCount) * 100)}%` : '0%';
                return {
                    'Category': item.category_name,
                    'Location': item.location_name,
                    'No. of Location': item.checklists.size,
                    'Total Camera Count': totalCameraCount,
                    'Total Camera Audited': item.total_camera_audited,
                    'Total Camera Random Audited': item.total_camera_random_audited,
                    'Total Camera Not Audited': item.total_camera_not_audited,
                    'Total Camera Offline': item.total_camera_offline,
                    'Offline %': offlinePercentage,
                    'Total Camera Technical Issues': item.total_camera_technical_issues,
                    'Technical %': technicalIssuesPercentage,
                    'Total NCs': item.total_ncs
                };
            });
            processedData.sort((a, b) => {
                const catCompare = a.Category.localeCompare(b.Category);
                if (catCompare !== 0) return catCompare;
                return String(a.Location).localeCompare(String(b.Location));
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Audit Status Report');

        worksheet.columns = [
            { header: 'Category', key: 'Category', width: 25 },
            { header: 'Location', key: 'Location', width: 15 },
            { header: 'No. of Location', key: 'No. of Location', width: 15 },
            { header: 'Total Camera Count', key: 'Total Camera Count', width: 18 },
            { header: 'Total Camera Audited', key: 'Total Camera Audited', width: 20 },
            { header: 'Total Camera Not Audited', key: 'Total Camera Not Audited', width: 22 },
            { header: 'Total Camera Random Audited', key: 'Total Camera Random Audited', width: 25 },
            { header: 'Total Camera Offline', key: 'Total Camera Offline', width: 18 },
            { header: 'Offline %', key: 'Offline %', width: 20 },
            { header: 'Total Camera Technical Issues', key: 'Total Camera Technical Issues', width: 25 },
            { header: 'Technical %', key: 'Technical %', width: 28 },
            { header: 'Total NCs', key: 'Total NCs', width: 12 }
        ];

        // Alternating row colors - color psychology: blue=trust, green=growth, lavender=clarity, peach=warmth
        const rowColors = ['FFE8F4FD', 'FFECF8EC', 'FFF3EEFF', 'FFFEF4E8'];
        const totalColumns = worksheet.columns.length;

        processedData.forEach((row, index) => {
            const dataRow = worksheet.addRow(row);
            const bgColor = rowColors[index % rowColors.length];
            for (let col = 1; col <= totalColumns; col++) {
                const cell = dataRow.getCell(col);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin', color: { argb: 'FFD0D0D0' } }, bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } };
            }
            dataRow.getCell(8).font = { color: { argb: 'FF008000' } };
            dataRow.getCell(9).font = { bold: true, color: { argb: 'FFCC0000' } };
            dataRow.getCell(10).font = { color: { argb: 'FF008000' } };
            dataRow.getCell(11).font = { bold: true, color: { argb: 'FFCC0000' } };
        });

        // Totals row
        const totals = processedData.reduce((acc, row) => {
            acc.noOfLocation += parseInt(row['No. of Location'] || 0);
            acc.cameraCount += parseInt(row['Total Camera Count'] || 0);
            acc.cameraAudited += parseInt(row['Total Camera Audited'] || 0);
            acc.cameraRandom += parseInt(row['Total Camera Random Audited'] || 0);
            acc.cameraNot += parseInt(row['Total Camera Not Audited'] || 0);
            acc.cameraOffline += parseInt(row['Total Camera Offline'] || 0);
            acc.cameraTech += parseInt(row['Total Camera Technical Issues'] || 0);
            acc.totalNcs += parseInt(row['Total NCs'] || 0);
            return acc;
        }, { noOfLocation: 0, cameraCount: 0, cameraAudited: 0, cameraRandom: 0, cameraNot: 0, cameraOffline: 0, cameraTech: 0, totalNcs: 0 });

        const offlinePct = totals.cameraCount > 0 ? `${Math.round((totals.cameraOffline / totals.cameraCount) * 100)}%` : '0%';
        const techPct = totals.cameraCount > 0 ? `${Math.round((totals.cameraTech / totals.cameraCount) * 100)}%` : '0%';

        const totalRow = worksheet.addRow({
            'Category': 'Total',
            'Location': '',
            'No. of Location': totals.noOfLocation,
            'Total Camera Count': totals.cameraCount,
            'Total Camera Audited': totals.cameraAudited,
            'Total Camera Not Audited': totals.cameraNot,
            'Total Camera Random Audited': totals.cameraRandom,
            'Total Camera Offline': totals.cameraOffline,
            'Offline %': offlinePct,
            'Total Camera Technical Issues': totals.cameraTech,
            'Technical %': techPct,
            'Total NCs': totals.totalNcs
        });
        totalRow.font = { bold: true };
        for (let col = 1; col <= totalColumns; col++) {
            const cell = totalRow.getCell(col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'medium', color: { argb: 'FF1B2A4A' } }, bottom: { style: 'medium', color: { argb: 'FF1B2A4A' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } };
        }
        totalRow.getCell(8).font = { bold: true, color: { argb: 'FF008000' } };
        totalRow.getCell(9).font = { bold: true, color: { argb: 'FFCC0000' } };
        totalRow.getCell(10).font = { bold: true, color: { argb: 'FF008000' } };
        totalRow.getCell(11).font = { bold: true, color: { argb: 'FFCC0000' } };

        // Dark navy header for Audit Status Report
        const headerRow = worksheet.getRow(1);
        for (let col = 1; col <= totalColumns; col++) {
            const cell = headerRow.getCell(col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Audit_Status_Report_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);

    } catch (error) {
        logger.error('Export Audit Status Report Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

// Manager VA Report
const getVAReport = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { fromDate, toDate, auditorId, auditorIds: auditorIdsParam } = req.query;

        const dateColumns = [];
        for (let d = new Date(fromDate); d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
            if (d.getDay() !== 0) dateColumns.push(d.toISOString().split('T')[0]);
        }

        let resolvedAuditorIds = null;
        if (auditorIdsParam) {
            resolvedAuditorIds = auditorIdsParam.split(',').map(Number).filter(Boolean);
        } else if (auditorId) {
            resolvedAuditorIds = [parseInt(auditorId)];
        }

        const normalizeDate = (d) => {
            if (!d) return '';
            if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return String(d).split('T')[0];
        };

        // Fetch all instances in range, grouped by auditor
        const instances = await knex('daily_checklist_instances as dci')
            .join('checklists as ch', 'dci.daily_checklist_id', 'ch.id')
            .join('users as u', 'dci.auditor_id', 'u.id')
            .select(
                'dci.assigned_date', 'dci.id as instance_id', 'dci.status as instance_status',
                'dci.auditor_id', 'u.username as auditor_name',
                'ch.time_taken_seconds', 'ch.camera_count',
                'ch.total_camera_audited', 'ch.total_camera_not_audited',
                'ch.total_camera_offline',
                'ch.total_camera_technical_issues', 'ch.total_ncs',
                'ch.id as checklist_id', 'ch.status as checklist_status'
            )
            .modify(q => {
                if (resolvedAuditorIds) q.whereIn('dci.auditor_id', resolvedAuditorIds);
                else q.whereNotNull('dci.auditor_id');
            })
            .whereRaw('DATE(dci.assigned_date) BETWEEN ? AND ?', [fromDate, toDate]);

        const checklistIds = [...new Set(instances.map(i => i.checklist_id))];
        let lineCounts = [], ncPendingCounts = [];

        if (checklistIds.length > 0) {
            lineCounts = await knex('checklist_data')
                .select('checklist_id', knex.raw('COUNT(*) as line_count'))
                .whereIn('checklist_id', checklistIds)
                .where('submission_status', 'completed')
                .groupBy('checklist_id');

            ncPendingCounts = await knex('checklist_data as cd')
                .select('cd.checklist_id', knex.raw('COUNT(*) as pending_count'))
                .whereIn('cd.checklist_id', checklistIds)
                .where('cd.status', 'No')
                .where('cd.submission_status', 'completed')
                .whereNotExists(function () {
                    this.select('*').from('supervisor_reviews as sr')
                        .whereRaw('sr.checklist_id = cd.checklist_id AND sr.checklist_item_id = cd.checklist_item_id')
                        .where('sr.status', 'Close');
                })
                .groupBy('cd.checklist_id');
        }

        const lineCountMap = {};
        lineCounts.forEach(r => { lineCountMap[r.checklist_id] = parseInt(r.line_count || 0); });
        const ncPendingMap = {};
        ncPendingCounts.forEach(r => { ncPendingMap[r.checklist_id] = parseInt(r.pending_count || 0); });

        const isCompleted = (inst) => {
            const s = (inst.instance_status || '').toLowerCase();
            const cs = (inst.checklist_status || '').toLowerCase();
            return s === 'completed' || s === 'completed_without_ncs' || s === 'awaiting_supervisor' || s === 'awaiting_manager'
                || cs === 'completed' || cs === 'completed without ncs' || cs === 'awaiting for nc response' || cs === 'accepted by supervisor';
        };

        // Group instances by auditor
        const auditorMap = {};
        instances.forEach(inst => {
            const aid = inst.auditor_id;
            if (!auditorMap[aid]) auditorMap[aid] = { auditor_id: aid, auditor_name: inst.auditor_name, instances: [] };
            auditorMap[aid].instances.push(inst);
        });

        // Build per-auditor per-date metrics
        const auditorReports = Object.values(auditorMap).map(auditor => {
            const data = {};
            dateColumns.forEach(date => {
                const dayInst = auditor.instances.filter(r => normalizeDate(r.assigned_date) === date);
                const completed = dayInst.filter(isCompleted);
                const totalAssigned = dayInst.length;
                const completedCount = completed.length;
                const expired = date < today ? totalAssigned - completedCount : 0;

                let totalTime = 0, totalLines = 0, totalNCs = 0, totalOffline = 0, totalTechnical = 0, totalPending = 0 , total_camera_count = 0,
                        total_camera_audited = 0, total_camera_not_audited = 0;
                completed.forEach(inst => {
                    totalTime += parseInt(inst.time_taken_seconds || 0);
                    totalLines += lineCountMap[inst.checklist_id] || 0;
                    totalNCs += parseInt(inst.total_ncs || 0);
                    totalOffline += parseInt(inst.total_camera_offline || 0);
                    totalTechnical += parseInt(inst.total_camera_technical_issues || 0);
                    totalPending += ncPendingMap[inst.checklist_id] || 0;
                    total_camera_count += parseInt(inst.camera_count || 0);
                    total_camera_audited += parseInt(inst.total_camera_audited || 0);
                    total_camera_not_audited += parseInt(inst.total_camera_not_audited || 0);
                });

                data[date] = { totalTime, completedCount, totalLines, totalNCs, total_camera_count, total_camera_audited, total_camera_not_audited, totalOffline, totalTechnical, totalPending, expired };
            });
            return { auditor_id: auditor.auditor_id, auditor_name: auditor.auditor_name, data };
        });

        // Sort by auditor name
        auditorReports.sort((a, b) => (a.auditor_name || '').localeCompare(b.auditor_name || ''));

        res.json({ success: true, auditorReports, dateColumns, message: 'VA report generated successfully' });
    } catch (error) {
        logger.error('VA Report Error:', error);
        res.status(500).json({ success: false, error: 'Failed to Generate Reports', details: error.message });
    }
};

// manager daily nc reports api 
const getNCReports = async (req, res) => {
    try {
        const { fromDate, toDate, departmentIds } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Get user's location
        const userLocation = await knex('users')
            .where('id', userId)
            .first('location_id');

        const userDepartment = await knex('users')
            .where('id', userId)
            .first('department_id');
        
        const userFacilityName = await knex('users')
            .where('id',userId)
            .first('name_id');

        let deptIds = [];
        let locationIds = [];
        let facilityName = [];

        try {
            deptIds = JSON.parse(userDepartment.department_id);
        } catch (e) {
            logger.error('Invalid department_id format');
        }

        try {
            locationIds = JSON.parse(userLocation.location_id);
        } catch (e) {
            logger.error('Invalid location format');
        }
        try{
            facilityName = JSON.parse(userFacilityName.name_id);
        }
        catch(e){
                logger.error('Invalid facilityName format');
        }
        // Build query - cd.checklist_id is the daily instance ID
        let query = knex('checklist_data as cd')
            .join('daily_checklist_instances as dci', 'cd.checklist_id', 'dci.daily_checklist_id')
            .join('checklists as c', 'dci.template_checklist_id', 'c.id')
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('users as u', 'cd.user_id', 'u.id')
            .leftJoin('departments as d', 'c.department_id', 'd.id')
            .leftJoin('locations as l', 'c.location_id','l.id')
            .where('cd.status', 'No')
            .select(
                'dci.assigned_date as date',
                'cd.category',
                'cd.reason',
                'ci.process',
                'ci.criticality',
                'ci.activities',
                'd.name as department',
                'l.name as location',
                'u.username as auditor'
            );

        // Apply location filter for Manager and Head roles
        if (locationIds.length > 0) {
            query = query.whereIn('c.location_id', locationIds);
        }

        // Apply department filter only for Manager role (not Head)
        if (userRole !== 'Business Head' && deptIds.length > 0) {
            query = query.whereIn('c.department_id', deptIds);
        }
        if (userRole == 'Business Head' && facilityName.length > 0) {
            query = query.whereIn('d.name_id', facilityName);
        }

        // Apply date filters on assigned_date only
        if (fromDate) {
            query = query.where('dci.assigned_date', '>=', fromDate);
        }
        if (toDate) {
            query = query.where('dci.assigned_date', '<=', toDate);
        }

        // Apply dynamic filters from table column headers
        const mapping = {
            location: 'l.name',
            department: 'd.name',
            category: 'cd.category',
            reason: 'cd.reason',
            process: 'ci.process',
            criticality: 'ci.criticality',
            activities: 'ci.activities'
        };
        applyDynamicFilters(query, req.query, mapping);

        // Apply department filter (multi-select)
        if (departmentIds) {
            const deptArray = departmentIds.split(',').map(Number).filter(Boolean);
            if (deptArray.length > 0) {
                query = query.whereIn('c.department_id', deptArray);
            }
        }

        // Order by date descending
        query = query.orderBy('dci.assigned_date', 'desc');

        const reports = await query;

        res.json({
            success: true,
            count: reports.length,
            message: 'NC reports fetched successfully',
            data: reports
        });
    } catch (error) {
        logger.error('Error fetching NC reports:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch NC reports'
        });
    }
};

const getDepartments = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const userLocation = await knex('users').where('id', userId).first('location_id');

        let query = knex('departments').select('id', 'name').orderBy('name').where('is_active',true);
        if (userLocation && userLocation.location_id) {
            query = query.where('location_id', userLocation.location_id);
        }

        const departments = await query;
        res.json({ success: true, count: departments.length, message: 'Departments fetched successfully', departments });
    } catch (error) {
        logger.error('Error fetching departments for NC reports:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch departments' });
    }
};

const getSupervisorExecutives = async (req, res) => {
    try {
        const userId = req.user.id;
        const supervisor = await knex('users').where('id', userId).first();

        let query = knex('users').where('role_id', 6).where('is_active', true).select('id', 'username');

        if (supervisor.location_id) {
            query.where('location_id', supervisor.location_id);
        }

        if (supervisor.department_id) {
            let deptIds;
            try {
                deptIds = typeof supervisor.department_id === 'string'
                    ? JSON.parse(supervisor.department_id)
                    : supervisor.department_id;
            } catch (e) {
                deptIds = [supervisor.department_id];
            }
            if (Array.isArray(deptIds) && deptIds.length > 0) {
                query.where(function () {
                    deptIds.forEach(deptId => {
                        this.orWhereRaw('JSON_CONTAINS(department_id, ?)', [JSON.stringify(deptId)]);
                    });
                });
            }
        }

        const executives = await query;
        res.json({ data: executives });
    } catch (error) {
        logger.error('Supervisor Executives Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

const getSupervisorReport = async (req, res) => {
    try {
        const { fromDate, toDate, executiveId } = req.query;
        const userId = req.user.id;
        // Get date range for columns
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        const dateColumns = [];

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0) { // remove sunday
                dateColumns.push(d.toISOString().split('T')[0]);
            }
        }

        // Get supervisor's assigned checklists from rosters
        const supervisorRosters = await knex('rosters')
            .whereRaw('JSON_CONTAINS(supervisor_id, ?)', [JSON.stringify(userId)])
            .pluck('checklist_id');

        if (supervisorRosters.length === 0) {
            return res.json({
                message: 'No checklists assigned to supervisor',
                data: {},
                dateColumns
            });
        }

        // Base query: count instances assigned per date, split by template type
        const instances = await knex('daily_checklist_instances as dci')
            .join('checklists as tc', 'dci.template_checklist_id', 'tc.id')
            .select('dci.assigned_date', 'dci.id as instance_id', 'dci.status as instance_status', 'dci.auditor_id', 'tc.type as checklist_type')
            .whereIn('dci.template_checklist_id', supervisorRosters)
            .whereRaw('DATE(dci.assigned_date) BETWEEN ? AND ?', [fromDate, toDate]);

        // NSC NCs: checklist_data status='No', join checklist_items to get criticality
        const nscNcData = await knex('checklist_data as cd')
            .select(
                knex.raw('DATE(dci.assigned_date) as assigned_date'),
                'ci.criticality',
                knex.raw('COUNT(DISTINCT cd.id) as item_count')
            )
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('daily_checklist_instances as dci', 'cd.checklist_id', 'dci.daily_checklist_id')
            .whereIn('dci.template_checklist_id', supervisorRosters)
            .where('cd.status', 'No')
            .where('ci.type', 'NSC')
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate)
            .groupBy(knex.raw('DATE(dci.assigned_date), ci.criticality'));

        // SC NCs: checklist_data status='No', join checklist_items to get criticality
        let scNcQuery = knex('checklist_data as cd')
            .select(
                knex.raw('DATE(dci.assigned_date) as assigned_date'),
                'ci.criticality',
                knex.raw('COUNT(DISTINCT cd.id) as item_count')
            )
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('daily_checklist_instances as dci', 'cd.checklist_id', 'dci.daily_checklist_id')
            .whereIn('dci.template_checklist_id', supervisorRosters)
            .where('cd.status', 'No')
            .where('ci.type', 'SC')
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate);

        if (executiveId) {
            scNcQuery = scNcQuery.where('cd.user_id', executiveId);
        }

        const scNcData = await scNcQuery.groupBy(knex.raw('DATE(dci.assigned_date), ci.criticality'));

        const today = new Date().toISOString().split('T')[0];
        const reportData = {};
        const executiveReport = {};

        const normalizeDate = (d) => {
            if (!d) return '';
            if (d instanceof Date) {
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
            return String(d).split('T')[0];
        };

        dateColumns.forEach(date => {
            const dayInstances = instances.filter(r => normalizeDate(r.assigned_date) === date);
            const nscInstances = dayInstances.filter(r => (r.checklist_type || 'NSC') !== 'SC');
            const scInstances = dayInstances.filter(r => r.checklist_type === 'SC');

            const calcMetrics = (inst) => {
                const totalAssigned = [...new Set(inst.map(r => r.instance_id))].length;
                const completedChecklists = inst.filter(r =>
                    ['completed', 'completed_without_ncs', 'awaiting for nc response', 'awaiting_supervisor'].includes((r.instance_status || '').toLowerCase())
                ).length;
                const expiredChecklists = date < today ? totalAssigned - completedChecklists : 0;
                return { totalAssigned, completedChecklists, expiredChecklists };
            };

            // NSC report
            const dayNsc = nscNcData.filter(r => normalizeDate(r.assigned_date) === date);
            const nscMetrics = calcMetrics(nscInstances);
            reportData[date] = {
                ...nscMetrics,
                totalNCs: dayNsc.reduce((s, r) => s + parseInt(r.item_count || 0), 0),
                criticalNCs: dayNsc.filter(r => (r.criticality || '').toLowerCase() === 'high' || (r.criticality || '').toLowerCase() === 'new').reduce((s, r) => s + parseInt(r.item_count || 0), 0),
                nonCriticalNCs: dayNsc.filter(r => (r.criticality || '').toLowerCase() === 'low').reduce((s, r) => s + parseInt(r.item_count || 0), 0)
            };

            // SC / Executive report
            const daySc = scNcData.filter(r => normalizeDate(r.assigned_date) === date);
            const scMetrics = calcMetrics(scInstances);
            executiveReport[date] = {
                ...scMetrics,
                totalNCs: daySc.reduce((s, r) => s + parseInt(r.item_count || 0), 0),
                criticalNCs: daySc.filter(r => (r.criticality || '').toLowerCase() === 'high' || (r.criticality || '').toLowerCase() === 'new').reduce((s, r) => s + parseInt(r.item_count || 0), 0),
                nonCriticalNCs: daySc.filter(r => (r.criticality || '').toLowerCase() === 'low').reduce((s, r) => s + parseInt(r.item_count || 0), 0)
            };
        });

        res.json({
            message: 'Supervisor report generated successfully',
            data: reportData,
            executiveData: executiveReport,
            dateColumns
        });

    } catch (error) {
        logger.error('Supervisor Report Error:', error);
        res.status(500).json({ error: 'Failed to Generate reports', details: error.message });
    }
};

const exportSupervisorReport = async (req, res) => {
    try {
        const { fromDate, toDate, executiveId } = req.query;
        const userId = req.user.id;

        const dateColumns = [];
        for (let d = new Date(fromDate); d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0) { // remove sunday
                dateColumns.push(d.toISOString().split('T')[0]);
            }
        }

        const supervisorRosters = await knex('rosters')
            .whereRaw('JSON_CONTAINS(supervisor_id, ?)', [JSON.stringify(userId)])
            .pluck('checklist_id');

        if (supervisorRosters.length === 0) {
            return res.status(404).json({ message: 'No checklists assigned to supervisor' });
        }

        const instances = await knex('daily_checklist_instances as dci')
            .join('checklists as tc', 'dci.template_checklist_id', 'tc.id')
            .select('dci.assigned_date', 'dci.id as instance_id', 'dci.status as instance_status', 'tc.type as checklist_type')
            .whereIn('dci.template_checklist_id', supervisorRosters)
            .whereRaw('DATE(dci.assigned_date) BETWEEN ? AND ?', [fromDate, toDate]);

        const nscNcData = await knex('checklist_data as cd')
            .select(knex.raw('DATE(dci.assigned_date) as assigned_date'), 'ci.criticality', knex.raw('COUNT(cd.id) as item_count'))
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('checklists as ch', 'cd.checklist_id', 'ch.id')
            .join('daily_checklist_instances as dci', 'ch.id', 'dci.daily_checklist_id')
            .whereIn('dci.template_checklist_id', supervisorRosters)
            .where('cd.status', 'No')
            .where('ci.type', 'NSC')
            .whereRaw('DATE(dci.assigned_date) BETWEEN ? AND ?', [fromDate, toDate])
            .groupBy(knex.raw('DATE(dci.assigned_date), ci.criticality'));

        let scNcQuery = knex('checklist_data as cd')
            .select(knex.raw('DATE(dci.assigned_date) as assigned_date'), 'ci.criticality', knex.raw('COUNT(cd.id) as item_count'))
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('checklists as ch', 'cd.checklist_id', 'ch.id')
            .join('daily_checklist_instances as dci', 'ch.id', 'dci.daily_checklist_id')
            .whereIn('dci.template_checklist_id', supervisorRosters)
            .where('cd.status', 'No')
            .where('ci.type', 'SC')
            .whereRaw('DATE(dci.assigned_date) BETWEEN ? AND ?', [fromDate, toDate]);

        if (executiveId) scNcQuery = scNcQuery.where('cd.user_id', executiveId);
        const scNcData = await scNcQuery.groupBy(knex.raw('DATE(dci.assigned_date), ci.criticality'));

        const today = new Date().toISOString().split('T')[0];
        const normalizeDate = (d) => {
            if (!d) return '';
            if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return String(d).split('T')[0];
        };

        const metrics = ['Total Assigned', 'Completed', 'Expired', 'Total NCs', 'Critical NCs', 'Non-Critical NCs'];

        const buildRows = (filteredInstances, ncData) => metrics.map(metric => {
            const row = { Metric: metric };
            dateColumns.forEach(date => {
                const dayInst = filteredInstances.filter(r => normalizeDate(r.assigned_date) === date);
                const dayNc = ncData.filter(r => normalizeDate(r.assigned_date) === date);
                const totalAssigned = new Set(dayInst.map(r => r.instance_id)).size;
                const completed = dayInst.filter(r =>
                    ['completed', 'completed_without_ncs', 'awaiting for nc response', 'awaiting_supervisor'].includes((r.instance_status || '').toLowerCase())
                ).length;
                const expired = date < today ? totalAssigned - completed : 0;
                const totalNCs = dayNc.reduce((s, r) => s + parseInt(r.item_count || 0), 0);
                const criticalNCs = dayNc.filter(r => (r.criticality || '').toLowerCase() === 'high' || (r.criticality || '').toLowerCase() === 'new').reduce((s, r) => s + parseInt(r.item_count || 0), 0);
                const nonCriticalNCs = dayNc.filter(r => (r.criticality || '').toLowerCase() === 'low').reduce((s, r) => s + parseInt(r.item_count || 0), 0);
                row[date] = { 'Total Assigned': totalAssigned, 'Completed': completed, 'Expired': expired, 'Total NCs': totalNCs, 'Critical NCs': criticalNCs, 'Non-Critical NCs': nonCriticalNCs }[metric];
            });
            return row;
        });

        const nscInstances = instances.filter(r => (r.checklist_type || 'NORMAL') !== 'SC');
        const scInstances = instances.filter(r => r.checklist_type === 'SC');

        const workbook = new ExcelJS.Workbook();
        const colWidths = [{ width: 20 }, ...dateColumns.map(() => ({ width: 14 }))];

        const wsNsc = workbook.addWorksheet('Supervisor Report (NSC)');
        wsNsc.columns = [{ header: 'Metric', key: 'Metric', width: 20 }, ...dateColumns.map(d => ({ header: d, key: d, width: 14 }))];
        buildRows(nscInstances, nscNcData).forEach(row => wsNsc.addRow(row));
        styleHeaderRow(wsNsc);

        const wsSc = workbook.addWorksheet('Executive Report (SC)');
        wsSc.columns = [{ header: 'Metric', key: 'Metric', width: 20 }, ...dateColumns.map(d => ({ header: d, key: d, width: 14 }))];
        buildRows(scInstances, scNcData).forEach(row => wsSc.addRow(row));
        styleHeaderRow(wsSc);

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Supervisor_Report_${fromDate}_to_${toDate}.xlsx"`);
        res.send(buffer);
    } catch (error) {
        logger.error('Export Supervisor Report Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

const getSupervisorChecklistList = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role?.trim();

        let checklists;
        if (userRole === 'Business Head') {
            const userLocation = await knex('users').where('id', userId).first('location_id', 'name_id');
            let locationIds = [];

            try{
                locationIds = userLocation.location_id ? JSON.parse(userLocation.location_id) : [];
            }
            catch(error){
                logger.error('Invalid location format for user');
            }
            
            let facilityIds = [];
            try { facilityIds = JSON.parse(userLocation?.name_id || '[]'); } catch(e) { logger.error('Invalid name_id format'); }
            const userDeptIds = await knex('departments').whereIn('name_id', facilityIds).pluck('id');

            let query = knex('checklists')
                .select('checklists.id', 'checklists.checklist_name','checklists.deleted_at')
                .whereIn('checklists.id', knex('rosters').distinct('checklist_id'))
                .where('checklists.is_active',1);
            if (locationIds.length > 0) query.whereIn('checklists.location_id',locationIds);
            if (userDeptIds.length > 0) {
                query.whereIn('checklists.department_id', userDeptIds);
            }
            checklists = await query;
        } else {
            const rosterChecklistIds = await knex('rosters')
                .whereRaw('JSON_CONTAINS(supervisor_id, ?)', [JSON.stringify(userId)])
                .orWhereRaw('JSON_CONTAINS(manager_id, ?)', [JSON.stringify(userId)])
                .pluck('checklist_id');

            if (rosterChecklistIds.length === 0) return res.json({ data: [] });
            checklists = await knex('checklists').whereIn('id', rosterChecklistIds).select('id', 'checklist_name')
                            .where('checklists.is_active',1);
        }

        res.json({ data: checklists });
    } catch (error) {
        logger.error('Supervisor Checklist List Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

const getSupervisorChecklistReport = async (req, res) => {
    try {
        const { fromDate, toDate, checklistIds } = req.query;
        const userId = req.user.id;
        const userFacilityName = await knex('users').where('id', userId).first('name_id');
        let facilityName = [];
        try { facilityName = JSON.parse(userFacilityName.name_id); } catch(e) { logger.error('Invalid facilityName format'); }


        // Build dateColumns from range
        const dateColumns = [];
        if (fromDate && toDate) {
            for (let d = new Date(fromDate); d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (day !== 0) { // remove sunday
                    dateColumns.push(d.toISOString().split('T')[0]);
                }
            }
        }

        const userRole = req.user.role?.trim();
        let facilityDeptIds = [];
        if (userRole == 'Business Head' && facilityName.length > 0) { facilityDeptIds = await knex('departments').whereIn('name_id', facilityName).pluck('id'); }
        let selectedIds;

        if (userRole === 'Business Head') {
            const userLocation = await knex('users').where('id', userId).first('location_id');
            let locationIds = [];

            try{
                locationIds = userLocation.location_id ? JSON.parse(userLocation.location_id) : [];
            }
            catch(e){
                logger.error('Invalid location format for user');
            }

            let locationQuery = knex('checklists')
                .whereIn('id', knex('rosters').distinct('checklist_id'))
            if (locationIds) locationQuery.whereIn('location_id', locationIds).pluck('id');
            const locationChecklistIds = await locationQuery;

            if (locationChecklistIds.length === 0) {
                return res.json({ message: 'No checklists found for your location', data: [], dateColumns });
            }

            selectedIds = locationChecklistIds;
            if (checklistIds) {
                const requested = (Array.isArray(checklistIds) ? checklistIds : checklistIds.split(','))
                    .map(id => parseInt(id)).filter(Boolean);
                if (requested.length > 0) selectedIds = locationChecklistIds.filter(id => requested.includes(id));
            }
        } else {
            const allowedTemplateIds = await knex('rosters')
                .whereRaw('JSON_CONTAINS(supervisor_id, ?)', [JSON.stringify(userId)])
                .orWhereRaw('JSON_CONTAINS(manager_id, ?)', [JSON.stringify(userId)])
                .pluck('checklist_id');

            if (allowedTemplateIds.length === 0) {
                return res.json({ message: 'No checklists assigned to supervisor', data: [], dateColumns });
            }

            selectedIds = allowedTemplateIds;
            if (checklistIds) {
                const requested = (Array.isArray(checklistIds) ? checklistIds : checklistIds.split(','))
                    .map(id => parseInt(id)).filter(Boolean);
                selectedIds = allowedTemplateIds.filter(id => requested.includes(id));
            }
        }

        if (selectedIds.length === 0) {
            return res.json({ message: 'No matching checklists', data: [], dateColumns });
        }
        if (userRole == 'Business Head' && facilityDeptIds.length > 0) { const filtered = await knex('checklists').whereIn('id', selectedIds).whereIn('department_id', facilityDeptIds).pluck('id'); selectedIds = filtered; }

        const items = await knex('checklist_items as ci')
            .select('ci.id as item_id', 'ci.checklist_id as template_id', 'ci.process', 'ci.activities', 'ci.criticality',
                'tc.checklist_name', 'loc.name as location_name', 'dep.name as department_name')
            .join('checklists as tc', 'ci.checklist_id', 'tc.id')
            .leftJoin('locations as loc', 'tc.location_id', 'loc.id')
            .leftJoin('departments as dep', 'tc.department_id', 'dep.id')
            .whereIn('ci.checklist_id', selectedIds)
            .orderBy(['tc.checklist_name', 'ci.id']);

        if (items.length === 0) {
            return res.json({ message: 'No checklist items found', data: [], dateColumns });
        }

        const itemIds = [...new Set(items.map(i => i.item_id))];

        // Fetch responses using daily checklist items (cd references daily checklist's own copied items)
        const cdRows = await knex('checklist_data as cd')
            .select(
                'cd.checklist_item_id as daily_item_id',
                'cd.status',
                'cd.reason',
                knex.raw('DATE(dci.assigned_date) as assigned_date'),
                'u.username as auditor_name',
                'dci.template_checklist_id',
                'daily_ci.process as daily_process',
                'daily_ci.activities as daily_activities',
                knex.raw('(SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = cd.checklist_id AND supervisor_reviews.checklist_item_id = cd.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) as sup_status'),
                knex.raw('(SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = cd.checklist_id AND manager_reviews.checklist_item_id = cd.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) as man_status')
            )
            .join('daily_checklist_instances as dci', 'dci.daily_checklist_id', 'cd.checklist_id')
            .join('checklist_items as daily_ci', 'daily_ci.id', 'cd.checklist_item_id')
            .join('users as u', 'cd.user_id', 'u.id')
            .whereIn('dci.template_checklist_id', selectedIds)
            .modify(q => {
                if (fromDate) q.whereRaw('DATE(dci.assigned_date) >= ?', [fromDate]);
                if (toDate) q.whereRaw('DATE(dci.assigned_date) <= ?', [toDate]);
            });

        // Build a lookup: template_id|process|activities -> template item_id
        const templateItemKey = (templateId, process, activities) =>
            `${templateId}|${(process || '').trim()}|${(activities || '').trim()}`;

        const templateItemMap = {};
        items.forEach(item => {
            const key = templateItemKey(item.template_id, item.process, item.activities);
            templateItemMap[key] = item.item_id;
        });

        // Group responses by template item_id
        const dataByItem = {};
        cdRows.forEach(row => {
            const d = row.assigned_date;
            const date = (d instanceof Date) ? (d.getFullYear() + String.fromCharCode(45) + String(d.getMonth() + 1).padStart(2, String.fromCharCode(48)) + String.fromCharCode(45) + String(d.getDate()).padStart(2, String.fromCharCode(48))) : String(d).split(String.fromCharCode(84))[0];
            const key = templateItemKey(row.template_checklist_id, row.daily_process, row.daily_activities);
            const templateItemId = templateItemMap[key];
            if (!dataByItem[templateItemId]) dataByItem[templateItemId] = {};
            const supStatus = row.sup_status;
            const manStatus = row.man_status;
            let resolvedStatus = row.status;
            if ((row.status || '').toLowerCase() === 'no') {
                if (manStatus === 'Approved') resolvedStatus = 'Accepted';
                else if (manStatus === 'Rejected') resolvedStatus = 'Rejected';
                else if (supStatus === 'Accepted') resolvedStatus = 'Accepted';
                else if (supStatus === 'Rejected') resolvedStatus = 'Rejected';
            }
            dataByItem[templateItemId][date] = {
                status: resolvedStatus,
                supervisor_status: supStatus || null,
                manager_status: manStatus || null,
                reason: row.reason || null,
                auditor: row.auditor_name
            };
        });

        const checklistMap = {};
        items.forEach(item => {
            if (!checklistMap[item.template_id]) {
                checklistMap[item.template_id] = {
                    checklist_name: item.checklist_name,
                    location: item.location_name || 'N/A',
                    department: item.department_name || 'N/A',
                    items: []
                };
            }
            const responsesByDate = dataByItem[String(item.item_id)] || {};
            const dates = Object.keys(responsesByDate).sort();
            const latestStatus = dates.length > 0 ? responsesByDate[dates[dates.length - 1]].status : null;
            checklistMap[item.template_id].items.push({
                item_id: item.item_id,
                process: item.process || 'N/A',
                activity: item.activities || 'N/A',
                criticality: item.criticality || 'N/A',
                status: latestStatus,
                responses: responsesByDate
            });
        });

        res.json({
            message: 'Checklist report generated successfully',
            data: Object.values(checklistMap),
            dateColumns
        });
    } catch (error) {
        logger.error('Supervisor Checklist Report Error:', error);
        res.status(500).json({ error: 'Failed to Generate Report', details: error.message });
    }
};

const exportSupervisorChecklistReport = async (req, res) => {
    try {
        const { fromDate, toDate, checklistIds } = req.query;
        const userId = req.user.id;
        const userFacilityName = await knex('users').where('id', userId).first('name_id');
        let facilityName = [];
        try { facilityName = JSON.parse(userFacilityName.name_id); } catch(e) { logger.error('Invalid facilityName format'); }

        const userRole = req.user.role?.trim();
        let facilityDeptIds = [];
        if (userRole == 'Business Head' && facilityName.length > 0) { facilityDeptIds = await knex('departments').whereIn('name_id', facilityName).pluck('id'); }
        let selectedIds;

        if (userRole === 'Business Head') {
            const userLocation = await knex('users').where('id', userId).first('location_id');
            let locationIds = [];
            try{
                locationIds = userLocation.location_id ? JSON.parse(userLocation.location_id) : [];
            }
            catch(error){
                logger.error('Invalid location format for user');
            }
            let locationQuery = knex('checklists')
                .whereIn('id', knex('rosters').distinct('checklist_id'))
            if (locationIds.length > 0) locationQuery.whereIn('location_id', locationIds).pluck('id');
            const locationChecklistIds = await locationQuery;

            if (locationChecklistIds.length === 0) return res.status(404).json({ message: 'No checklists found' });

            selectedIds = locationChecklistIds;
            if (checklistIds) {
                const requested = (Array.isArray(checklistIds) ? checklistIds : checklistIds.split(','))
                    .map(id => parseInt(id)).filter(Boolean);
                if (requested.length > 0) selectedIds = locationChecklistIds.filter(id => requested.includes(id));
            }
        } else {
            const allowedTemplateIds = await knex('rosters')
                .whereRaw('JSON_CONTAINS(supervisor_id, ?)', [JSON.stringify(userId)])
                .orWhereRaw('JSON_CONTAINS(manager_id, ?)', [JSON.stringify(userId)])
                .pluck('checklist_id');

            selectedIds = allowedTemplateIds;
            if (checklistIds) {
                const requested = (Array.isArray(checklistIds) ? checklistIds : checklistIds.split(','))
                    .map(id => parseInt(id)).filter(Boolean);
                selectedIds = allowedTemplateIds.filter(id => requested.includes(id));
            }
        }

        if (selectedIds.length === 0) {
            return res.status(404).json({ message: 'No matching checklists' });
        }
        if (userRole == 'Business Head' && facilityDeptIds.length > 0) { const filtered = await knex('checklists').whereIn('id', selectedIds).whereIn('department_id', facilityDeptIds).pluck('id'); selectedIds = filtered; }

        const items = await knex('checklist_items as ci')
            .select('ci.id as item_id', 'ci.checklist_id as template_id', 'ci.process', 'ci.activities', 'ci.criticality',
                'tc.checklist_name', 'loc.name as location_name', 'dep.name as department_name')
            .join('checklists as tc', 'ci.checklist_id', 'tc.id')
            .leftJoin('locations as loc', 'tc.location_id', 'loc.id')
            .leftJoin('departments as dep', 'tc.department_id', 'dep.id')
            .whereIn('ci.checklist_id', selectedIds)
            .orderBy(['tc.checklist_name', 'ci.id']);

        // Build composite key map: templateId|process|activities -> template item_id
        const templateItemKey = (templateId, process, activities) =>
            `${templateId}|${(process || '').trim()}|${(activities || '').trim()}`;

        const templateItemMap = {};
        items.forEach(item => {
            templateItemMap[templateItemKey(item.template_id, item.process, item.activities)] = item.item_id;
        });

        const cdRows = await knex('checklist_data as cd')
            .select(
                'cd.checklist_item_id as daily_item_id',
                'cd.status',
                'cd.reason',
                knex.raw('DATE(dci.assigned_date) as assigned_date'),
                'u.username as auditor_name',
                'dci.template_checklist_id',
                'daily_ci.process as daily_process',
                'daily_ci.activities as daily_activities',
                knex.raw('(SELECT supervisor_status FROM supervisor_reviews WHERE supervisor_reviews.checklist_id = cd.checklist_id AND supervisor_reviews.checklist_item_id = cd.checklist_item_id ORDER BY supervisor_reviews.updated_at DESC LIMIT 1) as sup_status'),
                knex.raw('(SELECT manager_status FROM manager_reviews WHERE manager_reviews.checklist_id = cd.checklist_id AND manager_reviews.checklist_item_id = cd.checklist_item_id ORDER BY manager_reviews.updated_at DESC LIMIT 1) as man_status')
            )
            .join('daily_checklist_instances as dci', 'dci.daily_checklist_id', 'cd.checklist_id')
            .join('checklist_items as daily_ci', 'daily_ci.id', 'cd.checklist_item_id')
            .join('users as u', 'cd.user_id', 'u.id')
            .whereIn('dci.template_checklist_id', selectedIds)
            .modify(q => {
                if (fromDate) q.whereRaw('DATE(dci.assigned_date) >= ?', [fromDate]);
                if (toDate) q.whereRaw('DATE(dci.assigned_date) <= ?', [toDate]);
            });

        const normalizeDate = (d) => {
            if (!d) return '';
            if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return String(d).split('T')[0];
        };

        // Group by template item_id -> date (latest entry wins)
        const dataByItem = {};
        cdRows.forEach(row => {
            const key = templateItemKey(row.template_checklist_id, row.daily_process, row.daily_activities);
            const templateItemId = templateItemMap[key];
            if (!templateItemId) return;
            const date = normalizeDate(row.assigned_date);
            const supStatus = row.sup_status;
            const manStatus = row.man_status;
            let resolvedStatus = row.status;
            if ((row.status || '').toLowerCase() === 'no') {
                if (manStatus === 'Approved') resolvedStatus = 'Accepted';
                else if (manStatus === 'Rejected') resolvedStatus = 'Rejected';
                else if (supStatus === 'Accepted') resolvedStatus = 'Accepted';
                else if (supStatus === 'Rejected') resolvedStatus = 'Rejected';
            }
            if (!dataByItem[templateItemId]) dataByItem[templateItemId] = {};
            dataByItem[templateItemId][date] = {
                status: resolvedStatus,
                supervisor_status: supStatus || null,
                manager_status: manStatus || null,
                reason: row.reason || '-',
                auditor: row.auditor_name
            };
        });

        // Build date columns from range
        const dateColumns = [];
        if (fromDate && toDate) {
            for (let d = new Date(fromDate); d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (day !== 0) { // remove sunday
                    dateColumns.push(d.toISOString().split('T')[0]);
                }
            }
        }

        const statusArgb = (status) => {
            const s = (status || '').toLowerCase();
            if (s === 'yes' || s === 'accepted') return 'FF22C55E';
            if (s === 'no' || s === 'rejected') return 'FFEF4444';
            if (s === 'na') return 'FF9CA3AF';
            return null;
        };

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Checklist Report');

        ws.getColumn(1).width = 25;
        ws.getColumn(2).width = 40;
        ws.getColumn(3).width = 14;
        dateColumns.forEach((_, i) => { ws.getColumn(4 + i).width = 14; });

        // Group items by template
        const byTemplate = {};
        items.forEach(item => {
            if (!byTemplate[item.template_id]) byTemplate[item.template_id] = { name: item.checklist_name, location: item.location_name, department: item.department_name, items: [] };
            byTemplate[item.template_id].items.push(item);
        });

        const templateEntries = Object.entries(byTemplate);
        templateEntries.forEach(([templateId, tpl], tplIndex) => {
            // Checklist info row
            const infoRow = ws.addRow([tpl.name, `Location: ${tpl.location || 'N/A'}`, `Department: ${tpl.department || 'N/A'}`]);
            infoRow.font = { bold: true, size: 11 };

            // Column header row: Process | Activity | Criticality | date1 | date2 | ...
            const headerRow = ws.addRow(['Process', 'Activity', 'Criticality', ...dateColumns]);
            headerRow.eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            });

            // One data row per item
            tpl.items.forEach(item => {
                const responseMap = dataByItem[item.item_id] || {};
                const dateCellValues = dateColumns.map(date => (responseMap[date] ? responseMap[date].status : '-'));
                const row = ws.addRow([item.process || 'N/A', item.activities || 'N/A', item.criticality || 'N/A', ...dateCellValues]);

                [1, 2, 3].forEach(col => {
                    row.getCell(col).alignment = { vertical: 'middle', wrapText: true };
                    row.getCell(col).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                });

                dateColumns.forEach((date, i) => {
                    const resp = responseMap[date];
                    const cell = row.getCell(4 + i);
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                    if (resp) {
                        const argb = statusArgb(resp.status);
                        if (argb) {
                            cell.font = { color: { argb }, bold: true };
                        }
                        const noteLines = [
                            resp.auditor ? `Auditor: ${resp.auditor}` : '',
                            resp.reason && resp.reason !== '-' ? `Reason: ${resp.reason}` : ''
                        ].filter(Boolean);
                        if (noteLines.length) cell.note = noteLines.join('\n');
                    }
                });
            });

            // Two blank rows between checklists (skip after last)
            if (tplIndex < templateEntries.length - 1) {
                ws.addRow([]);
                ws.addRow([]);
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Checklist_Report_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);
    } catch (error) {
        logger.error('Export Supervisor Checklist Report Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

const getBusinessReport = async (req, res) => {
    try {
        const { fromDate, toDate, departmentIds } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const userFacilityName = await knex('users')
        .where('id',userId)
        .first('name_id');
        
        if (!fromDate || !toDate) {
            return res.status(400).json({ error: 'fromDate and toDate are required' });
        }

        const manager = await knex('users').where('id', userId).first('location_id', 'department_id');
        const locationId = manager?.location_id;

        // Parse user's own department_id (JSON array) - only for Manager role
        let userDeptIds = [];
        let locationIds = [];
        let facilityName = [];

        try {
                locationIds = JSON.parse(manager?.location_id || '[]');
            } catch (e) {
                logger.error('Invalid location format');
            }

        if (userRole !== 'Business Head') {
            try {
                userDeptIds = JSON.parse(manager?.department_id || '[]');
            } catch (e) {
                logger.error('Invalid department_id format');
            }
        }
        if (userRole == 'Business Head') {
        try{
            facilityName = JSON.parse(userFacilityName.name_id);
        }
        catch(e){
                logger.error('Invalid facilityName format');
        }
    }
        let facilityDeptIds = [];
        if (userRole == 'Business Head' && facilityName.length > 0) { facilityDeptIds = await knex('departments').whereIn('name_id', facilityName).pluck('id'); }

        const dateColumns = [];
        for (let d = new Date(fromDate); d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
            const day = d.getDay();

            if (day !== 0) { // remove sunday
                dateColumns.push(d.toISOString().split('T')[0]);
            }
        }

        // Filter param overrides user dept scope; if no filter param, use user's own depts (Manager only)
        const deptArray = departmentIds ? departmentIds.split(',').map(Number).filter(Boolean) : [];
        const effectiveDeptIds = deptArray.length > 0 ? deptArray : (userRole === 'Business Head' ? [] : userDeptIds);
        const today = new Date().toISOString().split('T')[0];

        // 1. All instances scoped to location + department (department only for Manager)
        const instancesQ = knex('daily_checklist_instances as dci')
            .join('checklists as tc', 'dci.template_checklist_id', 'tc.id')
            .select(
                knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d") as assigned_date'),
                'dci.id as instance_id',
                'dci.status as instance_status',
                'tc.department_id',
                'dci.auditor_id',
                'dci.template_checklist_id',
                'tc.type as checklist_type'
            )
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate);
        if (locationIds.length > 0) instancesQ.whereIn('tc.location_id', locationIds);
        if (effectiveDeptIds.length > 0) instancesQ.whereIn('tc.department_id', effectiveDeptIds);
        if (userRole == 'Business Head' && facilityDeptIds.length > 0) instancesQ.whereIn('tc.department_id', facilityDeptIds);
        const instances = await instancesQ;

        // 2. NSC NCs scoped to location + department (department only for Manager)
        const nscNcQ = knex('checklist_data as cd')
            .join('checklists as tc', 'cd.checklist_id', 'tc.id')
            .join('daily_checklist_instances as dci', 'tc.id', 'dci.daily_checklist_id')
            .join('checklists as templateid', 'dci.template_checklist_id', 'templateid.id')
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')

            .select(
                knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d") as assigned_date'),
                'ci.criticality',
                'tc.department_id',
                'tc.location_id',
                knex.raw('COUNT(DISTINCT cd.id) as item_count')
            )
            .where('cd.status', 'No')
            .where('ci.type', 'NSC')
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate);
        if (locationIds.length > 0) nscNcQ.whereIn('tc.location_id', locationIds);
        if (effectiveDeptIds.length > 0) nscNcQ.whereIn('tc.department_id', effectiveDeptIds);
        if (userRole == 'Business Head' && facilityDeptIds.length > 0) nscNcQ.whereIn('tc.department_id', facilityDeptIds);
        nscNcQ.groupBy(knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d"), ci.criticality, tc.department_id, tc.location_id'));
        const nscNcData = await nscNcQ;

        // 2b. Supervisor-wise NC counts
        const supNcQ = knex('checklist_data as cd')
            .join('checklists as tc', 'cd.checklist_id', 'tc.id')
            .join('daily_checklist_instances as dci', 'tc.id', 'dci.daily_checklist_id')
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('rosters as r', 'dci.template_checklist_id', 'r.checklist_id')
            .select(
                knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d") as assigned_date'),
                'r.supervisor_id',
                knex.raw('COUNT(DISTINCT cd.id) as nc_count'),
                knex.raw("COUNT(DISTINCT CASE WHEN ci.criticality = 'New' THEN cd.id END) as new_nc_count")
            )
            .where('cd.status', 'No')
            .where('ci.type', 'NSC')
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate);
        if (locationIds.length > 0) supNcQ.whereIn('tc.location_id', locationIds);
        if (effectiveDeptIds.length > 0) supNcQ.whereIn('tc.department_id', effectiveDeptIds);
        if (userRole == 'Business Head' && facilityDeptIds.length > 0) supNcQ.whereIn('tc.department_id', facilityDeptIds);
        supNcQ.groupBy(knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d"), r.supervisor_id'));
        const supNcData = await supNcQ;

        // 2c. Supervisor-wise completed/pending review counts
        const supReviewQ = knex('checklist_data as cd')
            .join('checklists as tc', 'cd.checklist_id', 'tc.id')
            .join('daily_checklist_instances as dci', 'tc.id', 'dci.daily_checklist_id')
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('rosters as r', 'dci.template_checklist_id', 'r.checklist_id')
            .leftJoin('supervisor_reviews as sr', function () {
                this.on('sr.checklist_id', '=', 'cd.checklist_id')
                    .andOn('sr.checklist_item_id', '=', 'cd.checklist_item_id');
            })
            .select(
                knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d") as assigned_date'),
                'r.supervisor_id',
                knex.raw('COUNT(DISTINCT cd.id) as total_to_review'),
                knex.raw("COUNT(DISTINCT CASE WHEN sr.supervisor_status IS NOT NULL THEN cd.id END) as reviewed_count")
            )
            .where('cd.status', 'No')
            .where('ci.type', 'NSC')
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate);
        if (locationIds.length > 0) supReviewQ.whereIn('tc.location_id', locationIds);
        if (effectiveDeptIds.length > 0) supReviewQ.whereIn('tc.department_id', effectiveDeptIds);
        if (userRole == 'Business Head' && facilityDeptIds.length > 0) supReviewQ.whereIn('tc.department_id', facilityDeptIds);
        supReviewQ.groupBy(knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d"), r.supervisor_id'));
        const supReviewData = await supReviewQ;

        // Resolve supervisor user names
        const allSupIds = new Set();
        supNcData.forEach(row => {
            try { JSON.parse(row.supervisor_id || '[]').forEach(id => allSupIds.add(id)); } catch (e) { }
        });
        supReviewData.forEach(row => {
            try { JSON.parse(row.supervisor_id || '[]').forEach(id => allSupIds.add(id)); } catch (e) { }
        });
        const supUsers = allSupIds.size > 0 ? await knex('users').whereIn('id', Array.from(allSupIds)).select('id', 'username') : [];
        const supUserMap = {};
        supUsers.forEach(u => { supUserMap[u.id] = u.username; });

        // 2d. Manager-wise NC counts
        const mgrNcQ = knex('checklist_data as cd')
            .join('checklists as tc', 'cd.checklist_id', 'tc.id')
            .join('daily_checklist_instances as dci', 'tc.id', 'dci.daily_checklist_id')
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('rosters as r', 'dci.template_checklist_id', 'r.checklist_id')
            .select(
                knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d") as assigned_date'),
                'r.manager_id',
                knex.raw('COUNT(DISTINCT cd.id) as nc_count')
            )
            .where('cd.status', 'No')
            .where('ci.type', 'NSC')
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate);
        if (locationIds.length > 0) mgrNcQ.whereIn('tc.location_id', locationIds);
        if (effectiveDeptIds.length > 0) mgrNcQ.whereIn('tc.department_id', effectiveDeptIds);
        if (userRole == 'Business Head' && facilityDeptIds.length > 0) mgrNcQ.whereIn('tc.department_id', facilityDeptIds);
        mgrNcQ.groupBy(knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d"), r.manager_id'));
        const mgrNcData = await mgrNcQ;

        // 2e. Manager-wise completed/pending review counts
        const mgrReviewQ = knex('checklist_data as cd')
            .join('checklists as tc', 'cd.checklist_id', 'tc.id')
            .join('daily_checklist_instances as dci', 'tc.id', 'dci.daily_checklist_id')
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('rosters as r', 'dci.template_checklist_id', 'r.checklist_id')
            .leftJoin('manager_reviews as mr', function () {
                this.on('mr.checklist_id', '=', 'cd.checklist_id')
                    .andOn('mr.checklist_item_id', '=', 'cd.checklist_item_id');
            })
            .select(
                knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d") as assigned_date'),
                'r.manager_id',
                knex.raw('COUNT(DISTINCT cd.id) as total_to_review'),
                knex.raw("COUNT(DISTINCT CASE WHEN mr.manager_status IS NOT NULL THEN cd.id END) as reviewed_count")
            )
            .where('cd.status', 'No')
            .where('ci.type', 'NSC')
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate);
        if (locationIds.length > 0) mgrReviewQ.whereIn('tc.location_id', locationIds);
        if (effectiveDeptIds.length > 0) mgrReviewQ.whereIn('tc.department_id', effectiveDeptIds);
        if (userRole == 'Business Head' && facilityDeptIds.length > 0) mgrReviewQ.whereIn('tc.department_id', facilityDeptIds);
        mgrReviewQ.groupBy(knex.raw('DATE_FORMAT(dci.assigned_date, "%Y-%m-%d"), r.manager_id'));
        const mgrReviewData = await mgrReviewQ;

        // Resolve manager user names
        const allMgrIds = new Set();
        mgrNcData.forEach(row => {
            try { JSON.parse(row.manager_id || '[]').forEach(id => allMgrIds.add(id)); } catch (e) { }
        });
        mgrReviewData.forEach(row => {
            try { JSON.parse(row.manager_id || '[]').forEach(id => allMgrIds.add(id)); } catch (e) { }
        });
        const mgrUsers = allMgrIds.size > 0 ? await knex('users').whereIn('id', Array.from(allMgrIds)).select('id', 'username') : [];
        const mgrUserMap = {};
        mgrUsers.forEach(u => { mgrUserMap[u.id] = u.username; });

        // 3. Departments scoped to location (all departments for Head, user's departments for Manager)
        let deptQuery = knex('departments').select('id', 'name');
        if (locationIds.length > 0) deptQuery.whereIn('location_id', locationIds);
        if (effectiveDeptIds.length > 0) deptQuery.whereIn('id', effectiveDeptIds);
        if (userRole == 'Business Head' && facilityDeptIds.length > 0) deptQuery.whereIn('id', facilityDeptIds);
        const departments = await deptQuery.orderBy('name');

        const completedStatuses = ['completed', 'completed_without_ncs', 'awaiting for nc response', 'awaiting_supervisor'];
        const calcMetrics = (inst, date) => {
            const totalAssigned = [...new Set(inst.map(r => r.instance_id))].length;
            const completedChecklists = inst.filter(r => completedStatuses.includes((r.instance_status || '').toLowerCase())).length;
            const expiredChecklists = date < today ? totalAssigned - completedChecklists : 0;
            return { totalAssigned, completedChecklists, expiredChecklists };
        };

        const reportData = {};
        const departmentReport = {};
        const supervisorReport = {};
        const managerReport = {};

        dateColumns.forEach(date => {
            const dayInst = instances.filter(r => r.assigned_date === date);
            const nscInst = dayInst.filter(r => (r.checklist_type || '').toUpperCase() !== 'SC');

            const dayNscNc = nscNcData.filter(r => r.assigned_date === date);

            const nscMetrics = calcMetrics(nscInst, date);


            reportData[date] = {
                ...nscMetrics,
                totalNCs: dayNscNc.reduce((s, r) => s + parseInt(r.item_count || 0), 0),
                criticalNCs: dayNscNc.filter(r => (r.criticality || '').toLowerCase() === 'high' || (r.criticality || '').toLowerCase() === 'new').reduce((s, r) => s + parseInt(r.item_count || 0), 0),
                nonCriticalNCs: dayNscNc.filter(r => (r.criticality || '').toLowerCase() === 'low').reduce((s, r) => s + parseInt(r.item_count || 0), 0),
                // newNCs:           dayNscNc.filter(r => (r.criticality || '').toLowerCase() === 'new').reduce((s, r) => s + parseInt(r.item_count || 0), 0),
            };

            // Supervisor-wise NC aggregation
            const daySupNc = supNcData.filter(r => r.assigned_date === date);
            const daySupReview = supReviewData.filter(r => r.assigned_date === date);
            daySupNc.forEach(row => {
                try {
                    const ids = JSON.parse(row.supervisor_id || '[]');
                    ids.forEach(supId => {
                        if (!supervisorReport[supId]) supervisorReport[supId] = { name: supUserMap[supId] || `Supervisor ${supId}`, dates: {} };
                        if (!supervisorReport[supId].dates[date]) supervisorReport[supId].dates[date] = { totalNCs: 0, newNCs: 0, completed: 0, pending: 0 };
                        supervisorReport[supId].dates[date].totalNCs += parseInt(row.nc_count || 0);
                        supervisorReport[supId].dates[date].newNCs += parseInt(row.new_nc_count || 0);
                    });
                } catch (e) { }
            });
            daySupReview.forEach(row => {
                try {
                    const ids = JSON.parse(row.supervisor_id || '[]');
                    ids.forEach(supId => {
                        if (!supervisorReport[supId]) supervisorReport[supId] = { name: supUserMap[supId] || `Supervisor ${supId}`, dates: {} };
                        if (!supervisorReport[supId].dates[date]) supervisorReport[supId].dates[date] = { totalNCs: 0, newNCs: 0, completed: 0, pending: 0 };
                        const reviewed = parseInt(row.reviewed_count || 0);
                        const total = parseInt(row.total_to_review || 0);
                        supervisorReport[supId].dates[date].completed += reviewed;
                        supervisorReport[supId].dates[date].pending += (total - reviewed);
                    });
                } catch (e) { }
            });

            // Manager-wise NC aggregation
            const dayMgrNc = mgrNcData.filter(r => r.assigned_date === date);
            const dayMgrReview = mgrReviewData.filter(r => r.assigned_date === date);
            dayMgrNc.forEach(row => {
                try {
                    const ids = JSON.parse(row.manager_id || '[]');
                    ids.forEach(mgrId => {
                        if (!managerReport[mgrId]) managerReport[mgrId] = { name: mgrUserMap[mgrId] || `Manager ${mgrId}`, dates: {} };
                        if (!managerReport[mgrId].dates[date]) managerReport[mgrId].dates[date] = { totalNCs: 0, completed: 0, pending: 0 };
                        managerReport[mgrId].dates[date].totalNCs += parseInt(row.nc_count || 0);
                    });
                } catch (e) { }
            });
            dayMgrReview.forEach(row => {
                try {
                    const ids = JSON.parse(row.manager_id || '[]');
                    ids.forEach(mgrId => {
                        if (!managerReport[mgrId]) managerReport[mgrId] = { name: mgrUserMap[mgrId] || `Manager ${mgrId}`, dates: {} };
                        if (!managerReport[mgrId].dates[date]) managerReport[mgrId].dates[date] = { totalNCs: 0, completed: 0, pending: 0 };
                        const reviewed = parseInt(row.reviewed_count || 0);
                        const total = parseInt(row.total_to_review || 0);
                        managerReport[mgrId].dates[date].completed += reviewed;
                        managerReport[mgrId].dates[date].pending += (total - reviewed);
                    });
                } catch (e) { }
            });

            // Department-wise
            departments.forEach(dept => {
                if (!departmentReport[dept.id]) departmentReport[dept.id] = { name: dept.name, dates: {} };
                const deptInst = dayInst.filter(r => r.department_id === dept.id);
                const deptNscNc = dayNscNc.filter(r => r.department_id === dept.id);
                const dm = calcMetrics(deptInst, date);
                departmentReport[dept.id].dates[date] = {
                    ...dm,
                    totalNCs: deptNscNc.reduce((s, r) => s + parseInt(r.item_count || 0), 0)
                };
            });

        });

        res.json({
            message: 'Business report generated successfully',
            data: reportData,
            departmentReport: Object.values(departmentReport),
            supervisorReport: Object.values(supervisorReport),
            managerReport: Object.values(managerReport),
            dateColumns,
            departments
        });
    } catch (error) {
        logger.error('Business Report Error:', error);
        res.status(500).json({ error: 'Failed to Generate Report', details: error.message });
    }
};

const exportBusinessReport = async (req, res) => {
    try {
        const { fromDate, toDate, departmentIds } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!fromDate || !toDate) {
            return res.status(400).json({ error: 'fromDate and toDate are required' });
        }

        const manager = await knex('users').where('id', userId).first('location_id');
        let locationIds = [];
        const userFacilityName = await knex('users').where('id', userId).first('name_id');
        let facilityName = [];

        try {
            locationIds = JSON.parse(manager.location_id);
        } catch (e) {
            logger.error('Invalid location format');
        }
        try { facilityName = JSON.parse(userFacilityName.name_id); } catch(e) { logger.error('Invalid facilityName format'); }
        let facilityDeptIds = [];
        if (facilityName.length > 0) { facilityDeptIds = await knex('departments').whereIn('name_id', facilityName).pluck('id'); }

        const dateColumns = [];
        for (let d = new Date(fromDate); d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
            const day = d.getDay();

            if (day !== 0) { // remove sunday
                dateColumns.push(d.toISOString().split('T')[0]);
            }
        }

        const deptArray = departmentIds ? departmentIds.split(',').map(Number).filter(Boolean) : [];
        const today = new Date().toISOString().split('T')[0];

        const instancesQ = knex('daily_checklist_instances as dci')
            .join('checklists as tc', 'dci.template_checklist_id', 'tc.id')
            .select(
                'dci.assigned_date',
                'dci.id as instance_id',
                'dci.status as instance_status',
                'tc.department_id',
                'tc.type as checklist_type'
            )
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate);
        if (locationIds.length > 0) instancesQ.whereIn('tc.location_id', locationIds);
        if (deptArray.length > 0) instancesQ.whereIn('tc.department_id', deptArray);
        if (facilityDeptIds.length > 0) instancesQ.whereIn('tc.department_id', facilityDeptIds);
        const instances = await instancesQ;

        const nscNcQ = knex('checklist_data as cd')
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .join('daily_checklist_instances as dci', 'dci.daily_checklist_id', 'cd.checklist_id')
            .join('checklists as tc', 'dci.template_checklist_id', 'tc.id')
            .select(
                'dci.assigned_date',
                'ci.criticality',
                'tc.department_id',
                knex.raw('COUNT(DISTINCT cd.id) as item_count')
            )
            .where('cd.status', 'No')
            .where('ci.type', 'NSC')
            .where('dci.assigned_date', '>=', fromDate)
            .where('dci.assigned_date', '<=', toDate);
        if (locationIds.length > 0) nscNcQ.whereIn('tc.location_id', locationIds);
        if (deptArray.length > 0) nscNcQ.whereIn('tc.department_id', deptArray);
        if (facilityDeptIds.length > 0) nscNcQ.whereIn('tc.department_id', facilityDeptIds);
        nscNcQ.groupBy(knex.raw('dci.assigned_date, ci.criticality, tc.department_id'));
        const nscNcData = await nscNcQ;

        // Supervisor-wise NC counts
        const supNcQ = knex('checklist_data as cd')
            .join('checklists as tc2', 'cd.checklist_id', 'tc2.id')
            .join('daily_checklist_instances as dci2', 'tc2.id', 'dci2.daily_checklist_id')
            .join('checklist_items as ci2', 'cd.checklist_item_id', 'ci2.id')
            .join('rosters as r', 'dci2.template_checklist_id', 'r.checklist_id')
            .select(
                'dci2.assigned_date',
                'r.supervisor_id',
                knex.raw('COUNT(DISTINCT cd.id) as nc_count')
            )
            .where('cd.status', 'No')
            .where('ci2.type', 'NSC')
            .where('dci2.assigned_date', '>=', fromDate)
            .where('dci2.assigned_date', '<=', toDate);
        if (locationIds.length > 0) supNcQ.whereIn('tc2.location_id', locationIds);
        if (deptArray.length > 0) supNcQ.whereIn('tc2.department_id', deptArray);
        if (facilityDeptIds.length > 0) supNcQ.whereIn('tc2.department_id', facilityDeptIds);
        supNcQ.groupBy(knex.raw('dci2.assigned_date, r.supervisor_id'));
        const supNcData = await supNcQ;

        // Supervisor-wise review counts
        const supReviewQ = knex('checklist_data as cd')
            .join('checklists as tc5', 'cd.checklist_id', 'tc5.id')
            .join('daily_checklist_instances as dci5', 'tc5.id', 'dci5.daily_checklist_id')
            .join('checklist_items as ci5', 'cd.checklist_item_id', 'ci5.id')
            .join('rosters as r4', 'dci5.template_checklist_id', 'r4.checklist_id')
            .leftJoin('supervisor_reviews as sr', function () {
                this.on('sr.checklist_id', '=', 'cd.checklist_id').andOn('sr.checklist_item_id', '=', 'cd.checklist_item_id');
            })
            .select('dci5.assigned_date', 'r4.supervisor_id',
                knex.raw('COUNT(DISTINCT cd.id) as total_to_review'),
                knex.raw("COUNT(DISTINCT CASE WHEN sr.supervisor_status IS NOT NULL THEN cd.id END) as reviewed_count")
            )
            .where('cd.status', 'No').where('ci5.type', 'NSC')
            .where('dci5.assigned_date', '>=', fromDate).where('dci5.assigned_date', '<=', toDate);
        if (locationIds.length > 0) supReviewQ.whereIn('tc5.location_id', locationIds);
        if (deptArray.length > 0) supReviewQ.whereIn('tc5.department_id', deptArray);
        if (facilityDeptIds.length > 0) supReviewQ.whereIn('tc5.department_id', facilityDeptIds);
        supReviewQ.groupBy(knex.raw('dci5.assigned_date, r4.supervisor_id'));
        const supReviewData = await supReviewQ;

        const allSupIds = new Set();
        supNcData.forEach(row => {
            try { JSON.parse(row.supervisor_id || '[]').forEach(id => allSupIds.add(id)); } catch (e) { }
        });
        const supUsers = allSupIds.size > 0 ? await knex('users').whereIn('id', Array.from(allSupIds)).select('id', 'username') : [];
        const supUserMap = {};
        supUsers.forEach(u => { supUserMap[u.id] = u.username; });

        // Manager-wise NC counts (for Business Head)
        let mgrNcData = [];
        let mgrReviewData = [];
        const mgrUserMap = {};
        if (userRole === 'Business Head') {
            const mgrNcQ = knex('checklist_data as cd')
                .join('checklists as tc3', 'cd.checklist_id', 'tc3.id')
                .join('daily_checklist_instances as dci3', 'tc3.id', 'dci3.daily_checklist_id')
                .join('checklist_items as ci3', 'cd.checklist_item_id', 'ci3.id')
                .join('rosters as r2', 'dci3.template_checklist_id', 'r2.checklist_id')
                .select('dci3.assigned_date', 'r2.manager_id', knex.raw('COUNT(DISTINCT cd.id) as nc_count'))
                .where('cd.status', 'No').where('ci3.type', 'NSC')
                .where('dci3.assigned_date', '>=', fromDate).where('dci3.assigned_date', '<=', toDate);
            if (locationIds.length > 0) mgrNcQ.whereIn('tc3.location_id', locationIds);
            if (deptArray.length > 0) mgrNcQ.whereIn('tc3.department_id', deptArray);
            if (facilityDeptIds.length > 0) mgrNcQ.whereIn('tc3.department_id', facilityDeptIds);
            mgrNcQ.groupBy(knex.raw('dci3.assigned_date, r2.manager_id'));
            mgrNcData = await mgrNcQ;

            const mgrReviewQ = knex('checklist_data as cd')
                .join('checklists as tc4', 'cd.checklist_id', 'tc4.id')
                .join('daily_checklist_instances as dci4', 'tc4.id', 'dci4.daily_checklist_id')
                .join('checklist_items as ci4', 'cd.checklist_item_id', 'ci4.id')
                .join('rosters as r3', 'dci4.template_checklist_id', 'r3.checklist_id')
                .leftJoin('manager_reviews as mr', function () {
                    this.on('mr.checklist_id', '=', 'cd.checklist_id').andOn('mr.checklist_item_id', '=', 'cd.checklist_item_id');
                })
                .select('dci4.assigned_date', 'r3.manager_id',
                    knex.raw('COUNT(DISTINCT cd.id) as total_to_review'),
                    knex.raw("COUNT(DISTINCT CASE WHEN mr.manager_status IS NOT NULL THEN cd.id END) as reviewed_count")
                )
                .where('cd.status', 'No').where('ci4.type', 'NSC')
                .where('dci4.assigned_date', '>=', fromDate).where('dci4.assigned_date', '<=', toDate);
            if (locationIds.length > 0) mgrReviewQ.whereIn('tc4.location_id', locationIds);
            if (deptArray.length > 0) mgrReviewQ.whereIn('tc4.department_id', deptArray);
            if (facilityDeptIds.length > 0) mgrReviewQ.whereIn('tc4.department_id', facilityDeptIds);
            mgrReviewQ.groupBy(knex.raw('dci4.assigned_date, r3.manager_id'));
            mgrReviewData = await mgrReviewQ;

            const allMgrIds = new Set();
            mgrNcData.forEach(row => { try { JSON.parse(row.manager_id || '[]').forEach(id => allMgrIds.add(id)); } catch (e) { } });
            mgrReviewData.forEach(row => { try { JSON.parse(row.manager_id || '[]').forEach(id => allMgrIds.add(id)); } catch (e) { } });
            const mgrUsers = allMgrIds.size > 0 ? await knex('users').whereIn('id', Array.from(allMgrIds)).select('id', 'username') : [];
            mgrUsers.forEach(u => { mgrUserMap[u.id] = u.username; });
        }

        let deptQuery = knex('departments').select('id', 'name');
        if (locationIds.length > 0) deptQuery.whereIn('location_id', locationIds);
        if (deptArray.length > 0) deptQuery.whereIn('id', deptArray);
        if (facilityDeptIds.length > 0) deptQuery.whereIn('id', facilityDeptIds);
        const departments = await deptQuery.orderBy('name');

        const completedStatuses = ['completed', 'completed_without_ncs', 'awaiting for nc response', 'awaiting_supervisor'];
        const calcMetrics = (inst, date) => {
            const totalAssigned = [...new Set(inst.map(r => r.instance_id))].length;
            const completedChecklists = inst.filter(r => completedStatuses.includes((r.instance_status || '').toLowerCase())).length;
            const expiredChecklists = date < today ? totalAssigned - completedChecklists : 0;
            return { totalAssigned, completedChecklists, expiredChecklists };
        };

        // Build summary rows
        const summaryRows = [];
        const metrics = [
            { label: 'Completed Checklists', key: 'completedChecklists' },
            { label: 'Expired Checklists', key: 'expiredChecklists' },
            { label: 'Total Checklists', key: 'totalAssigned' },
            { label: 'Total NCs Raised', key: 'totalNCs' },
            { label: 'Critical NCs (High)', key: 'criticalNCs' },
            { label: 'Non-Critical NCs (Low)', key: 'nonCriticalNCs' },
        ];

        const reportData = {};
        const departmentReport = {};
        const supervisorReport = {};

        const normalizeDate = (d) => {
            if (!d) return '';
            if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return String(d).split('T')[0];
        };

        dateColumns.forEach(date => {
            const dayInst = instances.filter(r => normalizeDate(r.assigned_date) === date);
            const nscInst = dayInst.filter(r => (r.checklist_type || '').toUpperCase() !== 'SC');
            const dayNscNc = nscNcData.filter(r => normalizeDate(r.assigned_date) === date);
            const nscMetrics = calcMetrics(nscInst, date);
            reportData[date] = {
                ...nscMetrics,
                totalNCs: dayNscNc.reduce((s, r) => s + parseInt(r.item_count || 0), 0),
                criticalNCs: dayNscNc.filter(r => (r.criticality || '').toLowerCase() === 'high' || (r.criticality || '').toLowerCase() === 'new').reduce((s, r) => s + parseInt(r.item_count || 0), 0),
                nonCriticalNCs: dayNscNc.filter(r => (r.criticality || '').toLowerCase() === 'low').reduce((s, r) => s + parseInt(r.item_count || 0), 0),
            };

            // Supervisor-wise
            const daySupNc = supNcData.filter(r => normalizeDate(r.assigned_date) === date);
            const daySupReview = supReviewData.filter(r => normalizeDate(r.assigned_date) === date);
            daySupNc.forEach(row => {
                try {
                    const ids = JSON.parse(row.supervisor_id || '[]');
                    ids.forEach(supId => {
                        if (!supervisorReport[supId]) supervisorReport[supId] = { name: supUserMap[supId] || `Supervisor ${supId}`, dates: {} };
                        if (!supervisorReport[supId].dates[date]) supervisorReport[supId].dates[date] = { totalNCs: 0, completed: 0, pending: 0 };
                        supervisorReport[supId].dates[date].totalNCs += parseInt(row.nc_count || 0);
                    });
                } catch (e) { }
            });
            daySupReview.forEach(row => {
                try {
                    const ids = JSON.parse(row.supervisor_id || '[]');
                    ids.forEach(supId => {
                        if (!supervisorReport[supId]) supervisorReport[supId] = { name: supUserMap[supId] || `Supervisor ${supId}`, dates: {} };
                        if (!supervisorReport[supId].dates[date]) supervisorReport[supId].dates[date] = { totalNCs: 0, completed: 0, pending: 0 };
                        const reviewed = parseInt(row.reviewed_count || 0);
                        const total = parseInt(row.total_to_review || 0);
                        supervisorReport[supId].dates[date].completed += reviewed;
                        supervisorReport[supId].dates[date].pending += (total - reviewed);
                    });
                } catch (e) { }
            });

            departments.forEach(dept => {
                if (!departmentReport[dept.id]) departmentReport[dept.id] = { name: dept.name, dates: {} };
                const deptInst = dayInst.filter(r => r.department_id === dept.id);
                const deptNscNc = dayNscNc.filter(r => r.department_id === dept.id);
                const dm = calcMetrics(deptInst, date);
                departmentReport[dept.id].dates[date] = {
                    ...dm,
                    totalNCs: deptNscNc.reduce((s, r) => s + parseInt(r.item_count || 0), 0)
                };
            });
        });

        // Sheet 1: Daily Summary
        metrics.forEach(m => {
            const row = { Metric: m.label };
            let total = 0;
            dateColumns.forEach(d => { const v = reportData[d]?.[m.key] || 0; row[d] = v; total += v; });
            row['Total'] = total;
            summaryRows.push(row);
        });

        // Sheet 2: Department-wise
        const deptRows = [];
        Object.values(departmentReport).forEach(dept => {
            const row = { Department: dept.name };
            let totalCom = 0, totalExp = 0, totalNCs = 0;
            dateColumns.forEach(d => {
                const dd = dept.dates?.[d] || {};
                row[`${d}_Com`] = dd.completedChecklists || 0;
                row[`${d}_Exp`] = dd.expiredChecklists || 0;
                row[`${d}_NCs`] = dd.totalNCs || 0;
                totalCom += dd.completedChecklists || 0;
                totalExp += dd.expiredChecklists || 0;
                totalNCs += dd.totalNCs || 0;
            });
            row['Total_Com'] = totalCom;
            row['Total_Exp'] = totalExp;
            row['Total_NCs'] = totalNCs;
            deptRows.push(row);
        });

        // Sheet 3: Supervisor-wise
        const supRows = [];
        Object.values(supervisorReport).forEach(sup => {
            const row = { Supervisor: sup.name };
            let totalNCs = 0, totalDone = 0, totalPending = 0;
            dateColumns.forEach(d => {
                const dd = sup.dates?.[d] || {};
                row[`${d}_NCs`] = dd.totalNCs || 0;
                row[`${d}_Done`] = dd.completed || 0;
                row[`${d}_Pending`] = dd.pending || 0;
                totalNCs += dd.totalNCs || 0;
                totalDone += dd.completed || 0;
                totalPending += dd.pending || 0;
            });
            row['Total_NCs'] = totalNCs;
            row['Total_Done'] = totalDone;
            row['Total_Pending'] = totalPending;
            supRows.push(row);
        });

        const workbook = new ExcelJS.Workbook();

        const wsSummary = workbook.addWorksheet('Daily Summary');
        wsSummary.columns = [{ header: 'Metric', key: 'Metric', width: 25 }, ...dateColumns.map(d => ({ header: d, key: d, width: 14 })), { header: 'Total', key: 'Total', width: 14 }];
        summaryRows.forEach(row => wsSummary.addRow(row));
        styleHeaderRow(wsSummary);

        // Highlight Total column in Daily Summary
        const summaryTotalColIdx = dateColumns.length + 2;
        wsSummary.getColumn(summaryTotalColIdx).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === 1 ? 'FFFFF3CD' : 'FFFFFDE7' } };
            cell.font = { bold: true };
        });

        const wsDept = workbook.addWorksheet('Department-wise');
        const deptCols = [{ header: 'Department', key: 'Department', width: 25 }];
        dateColumns.forEach(d => {
            deptCols.push({ header: `${d} Com`, key: `${d}_Com`, width: 12 });
            deptCols.push({ header: `${d} Exp`, key: `${d}_Exp`, width: 12 });
            deptCols.push({ header: `${d} NCs`, key: `${d}_NCs`, width: 12 });
        });
        deptCols.push({ header: 'Total Com', key: 'Total_Com', width: 12 });
        deptCols.push({ header: 'Total Exp', key: 'Total_Exp', width: 12 });
        deptCols.push({ header: 'Total NCs', key: 'Total_NCs', width: 12 });
        wsDept.columns = deptCols;
        deptRows.forEach(row => wsDept.addRow(row));
        styleHeaderRow(wsDept);

        // Highlight Total columns in Department-wise sheet
        for (let col = deptCols.length - 2; col <= deptCols.length; col++) {
            wsDept.getColumn(col).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === 1 ? 'FFFFF3CD' : 'FFFFFDE7' } };
                cell.font = { bold: true };
            });
        }

        if (supRows.length > 0) {
            const wsSup = workbook.addWorksheet('Supervisor-wise');
            const supCols = [{ header: 'Supervisor', key: 'Supervisor', width: 25 }];
            dateColumns.forEach(d => {
                supCols.push({ header: `${d} NCs`, key: `${d}_NCs`, width: 12 });
                supCols.push({ header: `${d} Done`, key: `${d}_Done`, width: 12 });
                supCols.push({ header: `${d} Pending`, key: `${d}_Pending`, width: 12 });
            });
            supCols.push({ header: 'Total NCs', key: 'Total_NCs', width: 12 });
            supCols.push({ header: 'Total Done', key: 'Total_Done', width: 12 });
            supCols.push({ header: 'Total Pending', key: 'Total_Pending', width: 12 });
            wsSup.columns = supCols;
            supRows.forEach(row => wsSup.addRow(row));
            styleHeaderRow(wsSup);

            // Highlight Total columns in Supervisor-wise sheet
            for (let col = supCols.length - 2; col <= supCols.length; col++) {
                wsSup.getColumn(col).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === 1 ? 'FFFFF3CD' : 'FFFFFDE7' } };
                    cell.font = { bold: true };
                });
            }
        }

        // Sheet 4: Manager-wise (Business Head only)
        if (userRole === 'Business Head' && (mgrNcData.length > 0 || mgrReviewData.length > 0)) {
            const managerReport = {};
            const normalizeD = (d) => {
                if (!d) return '';
                if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return String(d).split('T')[0];
            };
            mgrNcData.forEach(row => {
                const date = normalizeDate(row.assigned_date);
                try {
                    JSON.parse(row.manager_id || '[]').forEach(mgrId => {
                        if (!managerReport[mgrId]) managerReport[mgrId] = { name: mgrUserMap[mgrId] || `Manager ${mgrId}`, dates: {} };
                        if (!managerReport[mgrId].dates[date]) managerReport[mgrId].dates[date] = { totalNCs: 0, completed: 0, pending: 0 };
                        managerReport[mgrId].dates[date].totalNCs += parseInt(row.nc_count || 0);
                    });
                } catch (e) { }
            });
            mgrReviewData.forEach(row => {
                const date = normalizeDate(row.assigned_date);
                try {
                    JSON.parse(row.manager_id || '[]').forEach(mgrId => {
                        if (!managerReport[mgrId]) managerReport[mgrId] = { name: mgrUserMap[mgrId] || `Manager ${mgrId}`, dates: {} };
                        if (!managerReport[mgrId].dates[date]) managerReport[mgrId].dates[date] = { totalNCs: 0, completed: 0, pending: 0 };
                        const reviewed = parseInt(row.reviewed_count || 0);
                        const total = parseInt(row.total_to_review || 0);
                        managerReport[mgrId].dates[date].completed += reviewed;
                        managerReport[mgrId].dates[date].pending += (total - reviewed);
                    });
                } catch (e) { }
            });

            const mgrRows = [];
            Object.values(managerReport).forEach(mgr => {
                const row = { Manager: mgr.name };
                let totalNCs = 0, totalDone = 0, totalPending = 0;
                dateColumns.forEach(d => {
                    const dd = mgr.dates?.[d] || {};
                    row[`${d}_NCs`] = dd.totalNCs || 0;
                    row[`${d}_Done`] = dd.completed || 0;
                    row[`${d}_Pending`] = dd.pending || 0;
                    totalNCs += dd.totalNCs || 0;
                    totalDone += dd.completed || 0;
                    totalPending += dd.pending || 0;
                });
                row['Total_NCs'] = totalNCs;
                row['Total_Done'] = totalDone;
                row['Total_Pending'] = totalPending;
                mgrRows.push(row);
            });

            if (mgrRows.length > 0) {
                const wsMgr = workbook.addWorksheet('Manager-wise');
                const mgrCols = [{ header: 'Manager', key: 'Manager', width: 25 }];
                dateColumns.forEach(d => {
                    mgrCols.push({ header: `${d} NCs`, key: `${d}_NCs`, width: 12 });
                    mgrCols.push({ header: `${d} Done`, key: `${d}_Done`, width: 12 });
                    mgrCols.push({ header: `${d} Pending`, key: `${d}_Pending`, width: 12 });
                });
                mgrCols.push({ header: 'Total NCs', key: 'Total_NCs', width: 12 });
                mgrCols.push({ header: 'Total Done', key: 'Total_Done', width: 12 });
                mgrCols.push({ header: 'Total Pending', key: 'Total_Pending', width: 12 });
                wsMgr.columns = mgrCols;
                mgrRows.forEach(row => wsMgr.addRow(row));
                styleHeaderRow(wsMgr);

                // Highlight Total columns in Manager-wise sheet
                for (let col = mgrCols.length - 2; col <= mgrCols.length; col++) {
                    wsMgr.getColumn(col).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === 1 ? 'FFFFF3CD' : 'FFFFFDE7' } };
                        cell.font = { bold: true };
                    });
                }
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Business_Report_${fromDate}_to_${toDate}.xlsx"`);
        res.send(buffer);
    } catch (error) {
        logger.error('Export Business Report Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

const getDepartmentsByUser = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role?.trim();
        const userLocation = await knex('users').where('id', userId).first('location_id');

        let query = knex('departments').select('id', 'name');
        let locationIds = [];
        try { locationIds = JSON.parse(userLocation?.location_id || '[]'); } catch(e) { if (userLocation?.location_id) locationIds = [userLocation.location_id]; }
        if (locationIds.length > 0) query.whereIn('location_id', locationIds);

        if (userRole !== 'Business Head') {
            const userDepartment = await knex('users').where('id', userId).first('department_id').where('is_active',true);
            let deptIds = [];
            try { deptIds = JSON.parse(userDepartment.department_id); } catch (e) { logger.error('Invalid department_id format'); }
            if (deptIds.length > 0) query.whereIn('id', deptIds);
        }

        if (userRole === 'Business Head') {
            const user = await knex('users').where('id', userId).first('name_id');
            let facilityIds = [];
            try { facilityIds = JSON.parse(user?.name_id || '[]'); } catch(e) { logger.error('Invalid name_id format'); }
            const userDeptIds = await knex('departments').whereIn('name_id', facilityIds).pluck('id').where('is_active',true);
            if (userDeptIds.length > 0) {
                query.whereIn('id', userDeptIds);
            }
        }

        const departments = await query.orderBy('name');
        res.json({ success: true, count: departments.length, message: 'Departments fetched successfully', departments });
    } catch (error) {
        logger.error('Error fetching departments for NC reports:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch departments' });
    }
};

const getLocationByUser = async (req, res) => {
    try {
        const userId = req.user.id;
        const userLocation = await knex('users').where('id', userId).first('location_id');
        let locations = [];
        if (userLocation?.location_id) {
            locations = await knex('locations').select('id', 'name').where('id', userLocation.location_id);
        }
        res.json({ success: true, count: locations.length, message: 'Location fetched successfully', locations });
    } catch (error) {
        logger.error('Error fetching location for user:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch location' });
    }
}

const getMailTrackerReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId, page = 1, limit = 50 } = req.query;

        const filteredLocationIds = locationId ? locationId.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
        const filteredDepartmentIds = departmentId ? departmentId.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
        const filteredCategoryIds = categoryId ? categoryId.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];

        let baseQuery = knex('email_queue');

        if (fromDate) baseQuery.where('created_at', '>=', `${fromDate} 00:00:00`);
        if (toDate) baseQuery.where('created_at', '<=', `${toDate} 23:59:59`);
        if (filteredLocationIds.length > 0) baseQuery.whereIn('location_name', knex('locations').select('name').whereIn('id', filteredLocationIds));
        if (filteredDepartmentIds.length > 0) baseQuery.whereIn('department_name', knex('departments').select('name').whereIn('id', filteredDepartmentIds));
        if (filteredCategoryIds.length > 0) baseQuery.whereIn('category_name', knex('categories').select('name').whereIn('id', filteredCategoryIds));

        // Apply dynamic filters
        const mapping = {
            category: 'email_queue.category_name',
            location: 'email_queue.location_name',
            department: 'email_queue.department_name',
            checklist_name: 'email_queue.checklist_name',
            status: 'email_queue.status'
        };
        applyDynamicFilters(baseQuery, req.query, mapping);

        const [{ count: totalCount }] = await baseQuery.clone().count('id as count');
        const total = parseInt(totalCount);

        const offset = (page - 1) * limit;
        const rows = await baseQuery.clone()
            .select('checklist_name', 'category_name', 'location_name', 'department_name', 'to', 'cc', 'status', 'created_at')
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset(offset);

        const data = rows.map(row => ({
            checklist_name: row.checklist_name || 'N/A',
            category: row.category_name || 'N/A',
            location: row.location_name || 'N/A',
            department: row.department_name || 'N/A',
            to: row.to || 'N/A',
            cc: row.cc || '-',
            status: row.status,
            date: row.created_at ? formatDate(row.created_at) : 'N/A'
        }));

        res.json({
            message: 'Mail Tracker Report generated successfully',
            data,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('Mail Tracker Report Error:', error);
        res.status(500).json({ error: 'Failed to fetch mail', details: error.message });
    }
};

const exportMailTrackerReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = locationId ? locationId.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
        const filteredDepartmentIds = departmentId ? departmentId.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
        const filteredCategoryIds = categoryId ? categoryId.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];

        let query = knex('email_queue')
            .select('checklist_name', 'category_name', 'location_name', 'department_name', 'to', 'cc', 'status', 'created_at');

        if (fromDate) query.where('created_at', '>=', `${fromDate} 00:00:00`);
        if (toDate) query.where('created_at', '<=', `${toDate} 23:59:59`);
        if (filteredLocationIds.length > 0) query.whereIn('location_name', knex('locations').select('name').whereIn('id', filteredLocationIds));
        if (filteredDepartmentIds.length > 0) query.whereIn('department_name', knex('departments').select('name').whereIn('id', filteredDepartmentIds));
        if (filteredCategoryIds.length > 0) query.whereIn('category_name', knex('categories').select('name').whereIn('id', filteredCategoryIds));

        // Apply dynamic filters
        const mapping = {
            category: 'email_queue.category_name',
            location: 'email_queue.location_name',
            department: 'email_queue.department_name',
            checklist_name: 'email_queue.checklist_name',
            status: 'email_queue.status'
        };
        applyDynamicFilters(query, req.query, mapping);

        query.orderBy('created_at', 'desc');
        const rows = await query;

        const excelData = rows.map(row => ({
            'Date': row.created_at ? formatDate(row.created_at) : 'N/A',
            'Checklist Name': row.checklist_name || 'N/A',
            'Category': row.category_name || 'N/A',
            'Location': row.location_name || 'N/A',
            'Department': row.department_name || 'N/A',
            'To': row.to || 'N/A',
            'CC': row.cc || '-',
            'Status': row.status
        }));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Mail Tracker');
        worksheet.columns = [
            { header: 'Date', key: 'Date', width: 12 },
            { header: 'Checklist Name', key: 'Checklist Name', width: 30 },
            { header: 'Category', key: 'Category', width: 20 },
            { header: 'Location', key: 'Location', width: 15 },
            { header: 'Department', key: 'Department', width: 15 },
            { header: 'To', key: 'To', width: 30 },
            { header: 'CC', key: 'CC', width: 30 },
            { header: 'Status', key: 'Status', width: 10 }
        ];
        excelData.forEach(row => worksheet.addRow(row));
        styleHeaderRow(worksheet);
        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Mail_Tracker_Report_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);
    } catch (error) {
        logger.error('Export Mail Tracker Report Error:', error);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

const getChecklistScoreReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId, page = 1, limit = 50 } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);

        let baseQuery = knex('checklist_scores');

        if (fromDate) baseQuery.where('score_date', '>=', fromDate);
        if (toDate) baseQuery.where('score_date', '<=', toDate);
        if (filteredLocationIds.length > 0) baseQuery.whereIn('location_name', knex('locations').select('name').whereIn('id', filteredLocationIds));
        if (filteredDeptIds.length > 0) baseQuery.whereIn('department_name', knex('departments').select('name').whereIn('id', filteredDeptIds));
        if (filteredCategoryIds.length > 0) baseQuery.whereIn('category_name', knex('categories').select('name').whereIn('id', filteredCategoryIds));

        // Apply dynamic filters
        const mapping = {
            category: 'checklist_scores.category_name',
            location: 'checklist_scores.location_name',
            department: 'checklist_scores.department_name',
            checklist_name: 'checklist_scores.checklist_name',
            yes_score: 'checklist_scores.yes_score',
            no_score: 'checklist_scores.no_score'
        };
        applyDynamicFilters(baseQuery, req.query, mapping);

        const [{ count: totalCount }] = await baseQuery.clone().count('id as count');
        const total = parseInt(totalCount);

        const offset = (page - 1) * limit;
        const rows = await baseQuery.clone()
            .select('checklist_name', 'category_name', 'location_name', 'department_name', 'yes_score', 'no_score', 'score_date')
            .orderBy('score_date', 'desc')
            .limit(limit)
            .offset(offset);

        const data = rows.map(row => ({
            checklist_name: row.checklist_name || 'N/A',
            category: row.category_name || 'N/A',
            location: row.location_name || 'N/A',
            department: row.department_name || 'N/A',
            yes_score: row.yes_score,
            no_score: row.no_score,
            date: row.score_date ? formatDate(row.score_date) : 'N/A'
        }));

        res.json({
            message: 'Checklist Score Report generated successfully',
            data,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('Checklist Score Report Error:', error);
        res.status(500).json({ error: 'Failed to fetch checklist score', details: error.message });
    }
};

const exportChecklistScoreReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);

        let query = knex('checklist_scores')
            .select('checklist_name', 'category_name', 'location_name', 'department_name', 'yes_score', 'no_score', 'score_date');

        if (fromDate) query.where('score_date', '>=', fromDate);
        if (toDate) query.where('score_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('location_name', knex('locations').select('name').whereIn('id', filteredLocationIds));
        if (filteredDeptIds.length > 0) query.whereIn('department_name', knex('departments').select('name').whereIn('id', filteredDeptIds));
        if (filteredCategoryIds.length > 0) query.whereIn('category_name', knex('categories').select('name').whereIn('id', filteredCategoryIds));

        // Apply dynamic filters
        const mapping = {
            category: 'checklist_scores.category_name',
            location: 'checklist_scores.location_name',
            department: 'checklist_scores.department_name',
            checklist_name: 'checklist_scores.checklist_name',
            yes_score: 'checklist_scores.yes_score',
            no_score: 'checklist_scores.no_score'
        };
        applyDynamicFilters(query, req.query, mapping);

        const rows = await query.orderBy('score_date', 'desc');

        const excelData = rows.map(row => ({
            'Date': row.score_date ? formatDate(row.score_date) : 'N/A',
            'Checklist Name': row.checklist_name || 'N/A',
            'Category': row.category_name || 'N/A',
            'Location': row.location_name || 'N/A',
            'Department': row.department_name || 'N/A',
            'Yes Score': row.yes_score,
            'No Score': row.no_score
        }));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Checklist Scores');
        worksheet.columns = [
            { header: 'Date', key: 'Date', width: 12 },
            { header: 'Checklist Name', key: 'Checklist Name', width: 30 },
            { header: 'Category', key: 'Category', width: 20 },
            { header: 'Location', key: 'Location', width: 15 },
            { header: 'Department', key: 'Department', width: 15 },
            { header: 'Yes Score', key: 'Yes Score', width: 12 },
            { header: 'No Score', key: 'No Score', width: 12 }
        ];
        excelData.forEach(row => worksheet.addRow(row));
        styleHeaderRow(worksheet);
        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Checklist_Score_Report_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);
    } catch (error) {
        logger.error('Export Checklist Score Report Error:', error.message);
        res.status(500).json({ error: 'Failed to export report', details: error.message });
    }
};

const getWeeklyNCReport = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;
        if (!fromDate || !toDate) {
            return res.status(400).json({ error: 'fromDate and toDate are required' });
        }

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);

        // Build fixed calendar weeks that cover the selected date range (handles cross-month ranges)
        // Week boundaries: 1-7, 8-14, 15-21, 22-28, 29-end of month
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);

        const getWeekBoundaries = (year, month) => [
            { start: new Date(year, month, 1), end: new Date(year, month, 7) },
            { start: new Date(year, month, 8), end: new Date(year, month, 14) },
            { start: new Date(year, month, 15), end: new Date(year, month, 21) },
            { start: new Date(year, month, 22), end: new Date(year, month, 28) },
            { start: new Date(year, month, 29), end: new Date(year, month + 1, 0) },
        ];

        const formatLocal = (d) => {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };

        // Generate 7-day week chunks starting from startDate up to endDate
        const weeks = [];
        let currentStart = new Date(startDate);
        while (currentStart <= endDate) {
            let currentEnd = new Date(currentStart);
            currentEnd.setDate(currentStart.getDate() + 6);
            if (currentEnd > endDate) {
                currentEnd = new Date(endDate);
            }
            weeks.push({
                start: formatLocal(currentStart),
                end: formatLocal(currentEnd)
            });
            currentStart = new Date(currentEnd);
            currentStart.setDate(currentStart.getDate() + 1);
        }

        // Fetch NC counts grouped by location and date
        let query = knex('checklist_data')
            .select(
                'locations.id as location_id',
                'locations.name as location_name',
                'departments.id as department_id',
                'departments.name as department_name',
                knex.raw('DATE(dci.assigned_date) as nc_date'),
                knex.raw('COUNT(checklist_data.id) as nc_count')
            )
            .join('checklists', 'checklist_data.checklist_id', 'checklists.id')
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .leftJoin('categories', 'template_checklists.category_id', 'categories.id')
            .where('checklist_data.status', 'No')
            .groupBy('locations.id', 'locations.name', 'departments.id', 'departments.name', knex.raw('DATE(dci.assigned_date)'))
            .orderBy('locations.name')
            .orderBy('departments.name');

        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('template_checklists.category_id', filteredCategoryIds);

        const rows = await query;

        // Aggregate by location + department + week
        const dataMap = {};
        rows.forEach(row => {
            const loc = row.location_name || 'Unknown';
            const dept = row.department_name || 'Unknown';
            const k = `${loc} | ${dept}`;

            if (!dataMap[k]) dataMap[k] = { location: loc, department: dept, weeks: {}, grand_total: 0 };

            // Format NC Date consistently
            const ncDateStr = formatLocal(new Date(row.nc_date));
            const weekIndex = weeks.findIndex(w => ncDateStr >= w.start && ncDateStr <= w.end);

            if (weekIndex !== -1) {
                dataMap[k].weeks[weekIndex] = (dataMap[k].weeks[weekIndex] || 0) + parseInt(row.nc_count);
                dataMap[k].grand_total += parseInt(row.nc_count);
            }
        });

        const data = Object.values(dataMap).map(item => {
            const row = { location: item.location, department: item.department, grand_total: item.grand_total };
            weeks.forEach((_, i) => { row[`week_${i + 1}`] = item.weeks[i] || 0; });
            return row;
        });

        // Grand total row
        const grandTotal = { location: 'Grand Total', grand_total: 0 };
        weeks.forEach((_, i) => {
            grandTotal[`week_${i + 1}`] = data.reduce((s, r) => s + (r[`week_${i + 1}`] || 0), 0);
            grandTotal.grand_total += grandTotal[`week_${i + 1}`];
        });

        res.json({
            message: 'Weekly NC Report generated successfully',
            weeks: weeks.map((w, i) => ({ label: `Week ${i + 1}`, start: w.start, end: w.end })),
            data,
            grand_total: grandTotal
        });
    } catch (error) {
        logger.error('Weekly NC Report Error:', error);
        res.status(500).json({ error: 'Failed to fetch Report', details: error.message });
    }
};


const getDepartmentNCChart = async (req, res) => {
    try {
        const { fromDate, toDate, locationId } = req.query;

        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('tc.location_id', filteredLocationIds);

        query.groupBy('l.name', 'd.name').orderBy('nc_count', 'desc');

        const rows = await query;

        res.json({
            message: 'Department NC chart data generated successfully',
            data: rows.map(r => ({
                location: r.location_name || 'N/A',
                department: r.department_name || 'N/A',
                nc_count: parseInt(r.nc_count)
            }))
        });
    } catch (error) {
        logger.error('Department NC Chart Error:', error);
        res.status(500).json({ error: 'Failed to fetch the Department', details: error.message });
    }
};

const getChecklistNCSummary = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);

        const acceptedCond = `(
            (SELECT manager_status FROM manager_reviews mr WHERE mr.checklist_id = cd.checklist_id AND mr.checklist_item_id = cd.checklist_item_id ORDER BY mr.updated_at DESC LIMIT 1) = 'Approved'
            OR (
                (SELECT manager_status FROM manager_reviews mr WHERE mr.checklist_id = cd.checklist_id AND mr.checklist_item_id = cd.checklist_item_id ORDER BY mr.updated_at DESC LIMIT 1) IS NULL
                AND (SELECT supervisor_status FROM supervisor_reviews sr WHERE sr.checklist_id = cd.checklist_id AND sr.checklist_item_id = cd.checklist_item_id ORDER BY sr.updated_at DESC LIMIT 1) = 'Accepted'
            )
        )`;

        const rejectedCond = `(
            (SELECT manager_status FROM manager_reviews mr WHERE mr.checklist_id = cd.checklist_id AND mr.checklist_item_id = cd.checklist_item_id ORDER BY mr.updated_at DESC LIMIT 1) = 'Rejected'
            OR (
                (SELECT manager_status FROM manager_reviews mr WHERE mr.checklist_id = cd.checklist_id AND mr.checklist_item_id = cd.checklist_item_id ORDER BY mr.updated_at DESC LIMIT 1) IS NULL
                AND (SELECT supervisor_status FROM supervisor_reviews sr WHERE sr.checklist_id = cd.checklist_id AND sr.checklist_item_id = cd.checklist_item_id ORDER BY sr.updated_at DESC LIMIT 1) = 'Rejected'
            )
        )`;

        let query = knex('checklist_data as cd')
            .select(
                'tc.id as template_id',
                'tc.checklist_name',
                knex.raw('COUNT(DISTINCT cd.id) as total_nc'),
                knex.raw("COUNT(DISTINCT CASE WHEN ci.criticality IN ('High', 'New') THEN cd.id END) as critical_nc"),
                knex.raw("COUNT(DISTINCT CASE WHEN ci.criticality = 'Low' THEN cd.id END) as non_critical_nc"),
                knex.raw(`COUNT(DISTINCT CASE WHEN ${acceptedCond} THEN cd.id END) as accepted_nc`),
                knex.raw(`COUNT(DISTINCT CASE WHEN ${rejectedCond} THEN cd.id END) as rejected_nc`),
                knex.raw(`COUNT(DISTINCT CASE WHEN ci.criticality IN ('High', 'New') AND ${acceptedCond} THEN cd.id END) as critical_accepted`),
                knex.raw(`COUNT(DISTINCT CASE WHEN ci.criticality IN ('High', 'New') AND ${rejectedCond} THEN cd.id END) as critical_rejected`),
                knex.raw(`COUNT(DISTINCT CASE WHEN ci.criticality = 'Low' AND ${acceptedCond} THEN cd.id END) as non_critical_accepted`),
                knex.raw(`COUNT(DISTINCT CASE WHEN ci.criticality = 'Low' AND ${rejectedCond} THEN cd.id END) as non_critical_rejected`)
            )
            .join('checklists as dc', 'cd.checklist_id', 'dc.id')
            .join('daily_checklist_instances as dci', 'dc.id', 'dci.daily_checklist_id')
            .join('checklists as tc', 'dci.template_checklist_id', 'tc.id')
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .where('cd.status', 'No');

        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('tc.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('tc.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('tc.category_id', filteredCategoryIds);

        query.groupBy('tc.id', 'tc.checklist_name').orderBy('total_nc', 'desc');
        const rows = await query;

        const templateIds = rows.map(r => r.template_id);
        if (templateIds.length === 0) {
            return res.json({ message: 'Checklist NC Summary generated', data: [] });
        }

        // Resolve supervisor/manager names from rosters
        const rosterData = await knex('rosters').whereIn('checklist_id', templateIds).select('checklist_id', 'supervisor_id', 'manager_id');
        const rosterMap = {};
        const allUserIds = new Set();
        rosterData.forEach(r => {
            if (!rosterMap[r.checklist_id]) rosterMap[r.checklist_id] = { supIds: new Set(), mgrIds: new Set() };
            try { JSON.parse(r.supervisor_id || '[]').forEach(id => { rosterMap[r.checklist_id].supIds.add(id); allUserIds.add(id); }); } catch (e) { }
            try { JSON.parse(r.manager_id || '[]').forEach(id => { rosterMap[r.checklist_id].mgrIds.add(id); allUserIds.add(id); }); } catch (e) { }
        });

        const users = allUserIds.size > 0 ? await knex('users').whereIn('id', Array.from(allUserIds)).select('id', 'username') : [];
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u.username; });

        const data = rows.map(r => {
            const total = parseInt(r.total_nc);
            const critical = parseInt(r.critical_nc);
            const nonCritical = parseInt(r.non_critical_nc);
            const accepted = parseInt(r.accepted_nc);
            const rejected = parseInt(r.rejected_nc);
            const roster = rosterMap[r.template_id];
            return {
                checklist_name: r.checklist_name,
                supervisor_name: roster ? Array.from(roster.supIds).map(id => userMap[id]).filter(Boolean).join(', ') || '-' : '-',
                manager_name: roster ? Array.from(roster.mgrIds).map(id => userMap[id]).filter(Boolean).join(', ') || '-' : '-',
                total_nc: total,
                accepted_nc: accepted,
                rejected_nc: rejected,
                critical_nc: critical,
                non_critical_nc: nonCritical,
                critical_accepted: parseInt(r.critical_accepted || 0),
                critical_rejected: parseInt(r.critical_rejected || 0),
                non_critical_accepted: parseInt(r.non_critical_accepted || 0),
                non_critical_rejected: parseInt(r.non_critical_rejected || 0),
                critical_percent: total > 0 ? parseFloat(((critical / total) * 100).toFixed(1)) : 0,
                non_critical_percent: total > 0 ? parseFloat(((nonCritical / total) * 100).toFixed(1)) : 0,
                accepted_percent: total > 0 ? parseFloat(((accepted / total) * 100).toFixed(1)) : 0,
                rejected_percent: total > 0 ? parseFloat(((rejected / total) * 100).toFixed(1)) : 0
            };
        });

        res.json({ message: 'Checklist NC Summary generated', data });
    } catch (error) {
        logger.error('Checklist NC Summary Error:', error);
        res.status(500).json({ error: 'Failed to Generate Report', details: error.message });
    }
};

const getDashboardNCChart = async (req, res) => {
    try {
        const { fromDate, toDate, locationId, departmentId, categoryId } = req.query;

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);

        let query = knex('checklist_data as cd')
            .select(
                'd.name as department_name',
                knex.raw('COUNT(DISTINCT cd.id) as nc_count'),
                knex.raw("COUNT(DISTINCT CASE WHEN ci.criticality IN ('High', 'New') THEN cd.id END) as critical_count"),
                knex.raw("COUNT(DISTINCT CASE WHEN ci.criticality = 'Low' THEN cd.id END) as non_critical_count")
            )
            .join('checklists as dc', 'cd.checklist_id', 'dc.id')
            .join('daily_checklist_instances as dci', 'dc.id', 'dci.daily_checklist_id')
            .join('checklists as tc', 'dci.template_checklist_id', 'tc.id')
            .join('checklist_items as ci', 'cd.checklist_item_id', 'ci.id')
            .leftJoin('departments as d', 'tc.department_id', 'd.id')
            .where('cd.status', 'No');

        if (fromDate) query.where('dci.assigned_date', '>=', fromDate);
        if (toDate) query.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) query.whereIn('tc.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) query.whereIn('tc.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) query.whereIn('tc.category_id', filteredCategoryIds);

        query.groupBy('d.name').orderBy('nc_count', 'desc');

        const rows = await query;

        // Get total checklist items count grouped by department
        // Count all checklist_data responses (Yes + No + NA) per department
        let totalQuery = knex('checklist_data as cd2')
            .select('d2.name as department_name', knex.raw('COUNT(DISTINCT cd2.id) as total_items'))
            .join('checklists as dc2', 'cd2.checklist_id', 'dc2.id')
            .join('daily_checklist_instances as dci2', 'dc2.id', 'dci2.daily_checklist_id')
            .join('checklists as tc2', 'dci2.template_checklist_id', 'tc2.id')
            .leftJoin('departments as d2', 'tc2.department_id', 'd2.id')
            .whereIn('cd2.status', ['Yes', 'No', 'NA']);

        if (fromDate) totalQuery.where('dci2.assigned_date', '>=', fromDate);
        if (toDate) totalQuery.where('dci2.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) totalQuery.whereIn('tc2.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) totalQuery.whereIn('tc2.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) totalQuery.whereIn('tc2.category_id', filteredCategoryIds);

        totalQuery.groupBy('d2.name');
        const totalRows = await totalQuery;

        const totalMap = {};
        totalRows.forEach(r => { totalMap[r.department_name || 'N/A'] = parseInt(r.total_items || 0); });

        res.json({
            message: 'Dashboard NC chart data generated successfully',
            data: rows.map(r => {
                const nc = parseInt(r.nc_count);
                const items = totalMap[r.department_name || 'N/A'] || 0;
                return {
                department: r.department_name || 'N/A',
                nc_count: nc,
                critical: parseInt(r.critical_count),
                non_critical: parseInt(r.non_critical_count),
                total_items: items,
                percentage: items > 0 ? parseFloat(((nc / items) * 100).toFixed(1)) : 0
                };
            })
        });
    } catch (error) {
        logger.error('Dashboard NC Chart Error:', error);
        res.status(500).json({ error: 'Failed to Generate Chart', details: error.message });
    }
};

const getAuditStatusEmailConfig = async (req, res) => {
    try {
        const lastEmail = await knex('email_queue')
            .where('checklist_name', 'Audit Status Report')
            .orderBy('created_at', 'desc')
            .first('to', 'cc');

        res.json({
            to: lastEmail?.to || '',
            cc: lastEmail?.cc || ''
        });
    } catch (error) {
        logger.error('Get Audit Status Email Config Error:', error);
        res.status(500).json({ error: 'Failed to fetch email config' });
    }
};

const sendAuditStatusEmail = async (req, res) => {
    try {
        const { to, cc, fromDate, toDate, locationId, departmentId, categoryId } = req.body;
        const { enqueueEmail } = require('../services/emailQueueService');

        if (!to) return res.status(400).json({ error: 'Recipient email is required' });

        const toEmails = to.split(',').map(e => e.trim()).filter(Boolean).join(', ');
        const ccEmails = cc ? cc.split(',').map(e => e.trim()).filter(Boolean).join(', ') : '';

        const filteredLocationIds = parseFilter(locationId);
        const filteredDeptIds = parseFilter(departmentId);
        const filteredCategoryIds = parseFilter(categoryId);

        let dataQuery = knex('checklists')
            .select(
                'categories.name as category_name',
                'locations.id as location_id',
                'locations.name as location_name',
                'checklists.id as checklist_id',
                'checklists.camera_count',
                'checklists.total_camera_audited',
                'checklists.total_camera_random_audited',
                'checklists.total_camera_not_audited',
                'checklists.total_camera_offline',
                'checklists.total_camera_technical_issues',
                'checklists.total_ncs',
                'checklists.remark',
                'departments.name as department_name',
                'dci.assigned_date'
            )
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .join('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id');

        if (fromDate) dataQuery.where('dci.assigned_date', '>=', fromDate);
        if (toDate) dataQuery.where('dci.assigned_date', '<=', toDate);
        if (filteredLocationIds.length > 0) dataQuery.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) dataQuery.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) dataQuery.whereIn('template_checklists.category_id', filteredCategoryIds);

        const mapping = {
            category: 'categories.name',
            category_name: 'categories.name',
            location: 'locations.name',
            location_name: 'locations.name',
            department: 'departments.name',
            department_name: 'departments.name',
            checklist_name: 'template_checklists.checklist_name'
        };
        applyDynamicFilters(dataQuery, req.body, mapping);

        dataQuery.orderBy('dci.assigned_date', 'desc');
        const rawData = await dataQuery;

        const locationCategoryData = {};
        rawData.forEach(item => {
            const groupKey = `${item.location_id || 'no_location'}_${item.category_name || 'no_category'}`;
            if (!locationCategoryData[groupKey]) {
                locationCategoryData[groupKey] = {
                    location_id: item.location_id,
                    location_name: item.location_name || 'N/A',
                    category_name: item.category_name || 'N/A',
                    department_name: item.department_name || 'N/A',
                    checklists: new Set(),
                    camera_count: 0,
                    total_camera_audited: 0,
                    total_camera_random_audited: 0,
                    total_camera_not_audited: 0,
                    total_camera_offline: 0,
                    total_camera_technical_issues: 0,
                    total_ncs: 0,
                    remarks: item.remark || 'N/A'
                };
            }
            const group = locationCategoryData[groupKey];
            if (item.checklist_id) group.checklists.add(item.checklist_id);
            group.camera_count += parseInt(item.camera_count || 0);
            group.total_camera_audited += parseInt(item.total_camera_audited || 0);
            group.total_camera_random_audited += parseInt(item.total_camera_random_audited || 0);
            group.total_camera_not_audited += parseInt((item.total_camera_random_audited || 0) + (item.total_camera_offline || 0) + (item.total_camera_technical_issues || 0));
            group.total_camera_offline += parseInt(item.total_camera_offline || 0);
            group.total_camera_technical_issues += parseInt(item.total_camera_technical_issues || 0);
            group.total_ncs += parseInt(item.total_ncs || 0);
        });

        const processedItems = Object.values(locationCategoryData);
        const summaryCategories = ['cc', 'depot', 'rmcc'];
        const dateRange = fromDate && toDate ? (fromDate === toDate ? fromDate : `${fromDate} - ${toDate}`) : 'All dates';
        const isSummaryExport = true;

        let processedData;
        if (isSummaryExport) {
            const categoryGroups = {};
            const individualRows = [];
            processedItems.forEach(item => {
                const cat = item.category_name;
                if (summaryCategories.includes(cat.toLowerCase())) {
                    if (!categoryGroups[cat]) {
                        categoryGroups[cat] = { category_name: cat, no_of_location: 0, unique_locations: 0, location_ids: new Set(), camera_count: 0, total_camera_audited: 0, total_camera_random_audited: 0, total_camera_not_audited: 0, total_camera_offline: 0, total_camera_technical_issues: 0, total_ncs: 0 };
                    }
                    const g = categoryGroups[cat];
                    g.no_of_location += item.checklists.size;
                    if (item.location_id) g.location_ids.add(item.location_id);
                    g.camera_count += item.camera_count;
                    g.total_camera_audited += item.total_camera_audited;
                    g.total_camera_random_audited += item.total_camera_random_audited;
                    g.total_camera_not_audited += item.total_camera_not_audited;
                    g.total_camera_offline += item.total_camera_offline;
                    g.total_camera_technical_issues += item.total_camera_technical_issues;
                    g.total_ncs += item.total_ncs;
                } else {
                    const offP = item.camera_count > 0 ? `${Math.round((item.total_camera_offline / item.camera_count) * 100)}%` : '0%';
                    const techP = item.camera_count > 0 ? `${Math.round((item.total_camera_technical_issues / item.camera_count) * 100)}%` : '0%';
                    individualRows.push({ 'Date': dateRange, 'Category': cat, 'Location': item.location_name || 'N/A', 'No. of Location': item.checklists.size, 'Total Camera Count': item.camera_count, 'Total Camera Audited': item.total_camera_audited, 'Total Camera Random Audited': item.total_camera_random_audited, 'Total Camera Not Audited': item.total_camera_not_audited, 'Total Camera Offline': item.total_camera_offline, 'Offline %': offP, 'Total Camera Technical Issues': item.total_camera_technical_issues, 'Technical %': techP, 'Total NCs': item.total_ncs });
                }
            });
            const summaryRows = Object.values(categoryGroups).map(g => {
                g.unique_locations = g.location_ids.size;
                const offP = g.camera_count > 0 ? `${Math.round((g.total_camera_offline / g.camera_count) * 100)}%` : '0%';
                const techP = g.camera_count > 0 ? `${Math.round((g.total_camera_technical_issues / g.camera_count) * 100)}%` : '0%';
                return { 'Date': dateRange, 'Category': g.category_name, 'Location': g.category_name, 'No. of Location': g.no_of_location, 'Total Camera Count': g.camera_count, 'Total Camera Audited': g.total_camera_audited, 'Total Camera Random Audited': g.total_camera_random_audited, 'Total Camera Not Audited': g.total_camera_not_audited, 'Total Camera Offline': g.total_camera_offline, 'Offline %': offP, 'Total Camera Technical Issues': g.total_camera_technical_issues, 'Technical %': techP, 'Total NCs': g.total_ncs };
            });
            summaryRows.sort((a, b) => a.Date.localeCompare(b.Date));
            individualRows.sort((a, b) => { const c = a.Date.localeCompare(b.Date); return c !== 0 ? c : String(a.Location).localeCompare(String(b.Location)); });
            processedData = [...summaryRows, ...individualRows];
        } else {
            processedData = processedItems.map(item => {
                const offP = item.camera_count > 0 ? `${Math.round((item.total_camera_offline / item.camera_count) * 100)}%` : '0%';
                const techP = item.camera_count > 0 ? `${Math.round((item.total_camera_technical_issues / item.camera_count) * 100)}%` : '0%';
                return { 'Date': dateRange, 'Category': item.category_name, 'Location': item.location_name, 'No. of Location': item.checklists.size, 'Total Camera Count': item.camera_count, 'Total Camera Audited': item.total_camera_audited, 'Total Camera Random Audited': item.total_camera_random_audited, 'Total Camera Not Audited': item.total_camera_not_audited, 'Total Camera Offline': item.total_camera_offline, 'Offline %': offP, 'Total Camera Technical Issues': item.total_camera_technical_issues, 'Technical %': techP, 'Total NCs': item.total_ncs };
            });
            processedData.sort((a, b) => { const c = a.Date.localeCompare(b.Date); return c !== 0 ? c : String(a.Location).localeCompare(String(b.Location)); });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Summary');

        worksheet.columns = [
            { header: 'Date', key: 'Date', width: 20 },
            { header: 'Location', key: 'Location', width: 15 },
            { header: 'No. of Location', key: 'No. of Location', width: 15 },
            { header: 'Total Camera Count', key: 'Total Camera Count', width: 18 },
            { header: 'Total Camera Audited', key: 'Total Camera Audited', width: 20 },
            { header: 'Total Camera Not Audited', key: 'Total Camera Not Audited', width: 22 },
            { header: 'Total Camera Random Audited', key: 'Total Camera Random Audited', width: 25 },
            { header: 'Total Camera Offline', key: 'Total Camera Offline', width: 18 },
            { header: 'Offline %', key: 'Offline %', width: 20 },
            { header: 'Total Camera Technical Issues', key: 'Total Camera Technical Issues', width: 25 },
            { header: 'Technical %', key: 'Technical %', width: 28 },
            { header: 'Total NCs', key: 'Total NCs', width: 12 }
        ];

        // Alternating row colors - color psychology: blue=trust, green=growth, lavender=clarity, peach=warmth
        const rowColors = ['FFE8F4FD', 'FFECF8EC', 'FFF3EEFF', 'FFFEF4E8'];
        const totalColumns = worksheet.columns.length;

        processedData.forEach((row, index) => {
            const dataRow = worksheet.addRow(row);
            const bgColor = rowColors[index % rowColors.length];
            for (let col = 1; col <= totalColumns; col++) {
                const cell = dataRow.getCell(col);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin', color: { argb: 'FFD0D0D0' } }, bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } };
            }
            dataRow.getCell(9).font = { color: { argb: 'FF008000' } };
            dataRow.getCell(10).font = { bold: true, color: { argb: 'FFCC0000' } };
            dataRow.getCell(11).font = { color: { argb: 'FF008000' } };
            dataRow.getCell(12).font = { bold: true, color: { argb: 'FFCC0000' } };
        });

        // Totals row
        const totals = processedData.reduce((acc, row) => {
            acc.noOfLocation += parseInt(row['No. of Location'] || 0);
            acc.cameraCount += parseInt(row['Total Camera Count'] || 0);
            acc.cameraAudited += parseInt(row['Total Camera Audited'] || 0);
            acc.cameraRandom += parseInt(row['Total Camera Random Audited'] || 0);
            acc.cameraNot += parseInt(row['Total Camera Not Audited'] || 0);
            acc.cameraOffline += parseInt(row['Total Camera Offline'] || 0);
            acc.cameraTech += parseInt(row['Total Camera Technical Issues'] || 0);
            acc.totalNcs += parseInt(row['Total NCs'] || 0);
            return acc;
        }, { noOfLocation: 0, cameraCount: 0, cameraAudited: 0, cameraRandom: 0, cameraNot: 0, cameraOffline: 0, cameraTech: 0, totalNcs: 0 });

        const offlinePct = totals.cameraCount > 0 ? `${Math.round((totals.cameraOffline / totals.cameraCount) * 100)}%` : '0%';
        const techPct = totals.cameraCount > 0 ? `${Math.round((totals.cameraTech / totals.cameraCount) * 100)}%` : '0%';

        const totalRow = worksheet.addRow({
            'Date': 'Total',
            'Category': '',
            'Location': '',
            'No. of Location': totals.noOfLocation,
            'Total Camera Count': totals.cameraCount,
            'Total Camera Audited': totals.cameraAudited,
            'Total Camera Not Audited': totals.cameraNot,
            'Total Camera Random Audited': totals.cameraRandom,
            'Total Camera Offline': totals.cameraOffline,
            'Offline %': offlinePct,
            'Total Camera Technical Issues': totals.cameraTech,
            'Technical %': techPct,
            'Total NCs': totals.totalNcs
        });
        totalRow.font = { bold: true };
        for (let col = 1; col <= totalColumns; col++) {
            const cell = totalRow.getCell(col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'medium', color: { argb: 'FF1B2A4A' } }, bottom: { style: 'medium', color: { argb: 'FF1B2A4A' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } };
        }
        totalRow.getCell(9).font = { bold: true, color: { argb: 'FF008000' } };
        totalRow.getCell(10).font = { bold: true, color: { argb: 'FFCC0000' } };
        totalRow.getCell(11).font = { bold: true, color: { argb: 'FF008000' } };
        totalRow.getCell(12).font = { bold: true, color: { argb: 'FFCC0000' } };

        // Dark navy header for Summary sheet
        const headerRow = worksheet.getRow(1);
        for (let col = 1; col <= totalColumns; col++) {
            const cell = headerRow.getCell(col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Detailed sheets - 7 days back from toDate (excluding Sundays), each date as separate sheet
        // Only checklists where total_camera_audited != camera_count
        // If toDate is early in the month, only fetch dates from 1st of that month
        const detailedEnd = toDate || new Date().toISOString().split('T')[0];
        const endParts = detailedEnd.split('-');
        const endYear = parseInt(endParts[0]);
        const endMonth = parseInt(endParts[1]) - 1;
        const endDay = parseInt(endParts[2]);

        // 7 days back
        const sevenBack = new Date(endYear, endMonth, endDay - 6);
        // 1st of the month
        const monthFirst = new Date(endYear, endMonth, 1);
        const startRef = sevenBack > monthFirst ? sevenBack : monthFirst;

        const normalizeDate = (d) => {
            if (!d) return '';
            if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return String(d).split('T')[0];
        };

        const detailedStartStr = normalizeDate(startRef);
        const detailedEndStr = detailedEnd;

        // Build date list excluding Sundays
        const detailedDates = [];
        for (let d = new Date(startRef); d <= new Date(endYear, endMonth, endDay); d.setDate(d.getDate() + 1)) {
            if (d.getDay() !== 0) detailedDates.push(normalizeDate(d));
        }

        // Query detailed data for the date range
        let detailedQuery = knex('checklists')
            .select(
                'categories.name as category_name',
                'locations.name as location_name',
                'departments.name as department_name',
                'checklists.camera_count',
                'checklists.total_camera_audited',
                'checklists.total_camera_random_audited',
                'checklists.total_camera_not_audited',
                'checklists.total_camera_offline',
                'checklists.total_camera_technical_issues',
                'checklists.remark',
                'dci.assigned_date'
            )
            .join('daily_checklist_instances as dci', 'checklists.id', 'dci.daily_checklist_id')
            .join('checklists as template_checklists', 'dci.template_checklist_id', 'template_checklists.id')
            .join('categories', 'template_checklists.category_id', 'categories.id')
            .leftJoin('locations', 'template_checklists.location_id', 'locations.id')
            .leftJoin('departments', 'template_checklists.department_id', 'departments.id')
            .where('dci.assigned_date', '>=', detailedStartStr)
            .where('dci.assigned_date', '<=', detailedEndStr)
            .where(function() {
                this.whereRaw('checklists.total_camera_audited IS NULL')
                    .orWhereRaw('checklists.camera_count IS NULL')
                    .orWhereRaw('checklists.total_camera_audited != checklists.camera_count');
            });

        if (filteredLocationIds.length > 0) detailedQuery.whereIn('template_checklists.location_id', filteredLocationIds);
        if (filteredDeptIds.length > 0) detailedQuery.whereIn('template_checklists.department_id', filteredDeptIds);
        if (filteredCategoryIds.length > 0) detailedQuery.whereIn('template_checklists.category_id', filteredCategoryIds);
        applyDynamicFilters(detailedQuery, req.body, mapping);

        const detailedRawData = await detailedQuery;

        // Group by date
        const dataByDate = {};
        detailedRawData.forEach(item => {
            const date = normalizeDate(item.assigned_date);
            if (!dataByDate[date]) dataByDate[date] = [];
            dataByDate[date].push({
                'Category': item.category_name || 'N/A',
                'Location': item.location_name || 'N/A',
                'Department': item.department_name || 'N/A',
                'Total Camera Count': parseInt(item.camera_count || 0),
                'Total Camera Audited': parseInt(item.total_camera_audited || 0),
                'Total Camera Not Audited': parseInt((item.total_camera_random_audited || 0) + (item.total_camera_offline || 0) + (item.total_camera_technical_issues || 0)),
                'Total Camera Random Audited': parseInt(item.total_camera_random_audited || 0),
                'Total Camera Offline': parseInt(item.total_camera_offline || 0),
                'Total Camera Technical Issues': parseInt(item.total_camera_technical_issues || 0),
                'Remarks': item.remark || 'N/A'
            });
        });

        // Create a sheet for each date (excluding Sundays, only current month)
        detailedDates.forEach(dateStr => {
            const sheetData = dataByDate[dateStr] || [];
            const ws = workbook.addWorksheet(dateStr);
            ws.columns = [
                { header: 'Category', key: 'Category', width: 20 },
                { header: 'Location', key: 'Location', width: 15 },
                { header: 'Department', key: 'Department', width: 25 },
                { header: 'Total Camera Count', key: 'Total Camera Count', width: 18 },
                { header: 'Total Camera Audited', key: 'Total Camera Audited', width: 20 },
                { header: 'Total Camera Not Audited', key: 'Total Camera Not Audited', width: 22 },
                { header: 'Total Camera Random Audited', key: 'Total Camera Random Audited', width: 25 },
                { header: 'Total Camera Offline', key: 'Total Camera Offline', width: 18 },
                { header: 'Total Camera Technical Issues', key: 'Total Camera Technical Issues', width: 25 },
                { header: 'Remarks', key: 'Remarks', width: 40 }
            ];
            sheetData.forEach((row, index) => {
                const dataRow = ws.addRow(row);
                const bgColor = rowColors[index % rowColors.length];
                dataRow.eachCell({ includeEmpty: true }, (cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: { style: 'thin', color: { argb: 'FFD0D0D0' } }, bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } };
                });
            });
            const hdr = ws.getRow(1);
            hdr.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });

        const excelBuffer = await workbook.xlsx.writeBuffer();

        // Build summary HTML table for email body
        const htmlRowColors = ['#E8F4FD', '#ECF8EC', '#F3EEFF', '#FEF4E8'];
        const summaryTableRows = processedData.map((row, index) => {
            const bg = htmlRowColors[index % htmlRowColors.length];
            return `
            <tr style="background-color:${bg};">
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${row['Date'] || ''}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${row['Location'] || ''}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${row['No. of Location'] || 0}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${row['Total Camera Count'] || 0}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${row['Total Camera Audited'] || 0}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${row['Total Camera Not Audited'] || 0}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${row['Total Camera Random Audited'] || 0}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${row['Total Camera Offline'] || 0}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;color:green;">${row['Offline %'] || '0%'}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${row['Total Camera Technical Issues'] || 0}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;color:green;">${row['Technical %'] || '0%'}</td>
                <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:bold;color:#CC0000;">${row['Total NCs'] || 0}</td>
            </tr>`;
        }).join('');

        const html = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <p>Dear Team,</p>
            <p>
                Please find attached the <strong>Audit Status Report</strong>
                for the date <strong>${dateRange}</strong>.
            </p>
            <table style="border-collapse:collapse;width:100%;font-size:12px;margin:16px 0;">
                <thead>
                    <tr style="background-color:#1B2A4A;color:#fff;">
                        <th style="border:1px solid #ddd;padding:8px 10px;">Date</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Location</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">No. of Location</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Total Camera Count</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Camera Audited</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Camera Not Audited</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Camera Random Audited</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Camera Offline</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Offline %</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Technical Issues</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Technical %</th>
                        <th style="border:1px solid #ddd;padding:8px 10px;">Total NCs</th>
                    </tr>
                </thead>
                <tbody>
                    ${summaryTableRows}
                    <tr style="background-color:#E2E8F0;font-weight:bold;">
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">Total</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;"></td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${totals.noOfLocation}</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${totals.cameraCount}</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${totals.cameraAudited}</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${totals.cameraNot}</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${totals.cameraRandom}</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${totals.cameraOffline}</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;color:green;">${offlinePct}</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;">${totals.cameraTech}</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;color:green;">${techPct}</td>
                        <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;color:#CC0000;">${totals.totalNcs}</td>
                    </tr>
                </tbody>
            </table>
            <br>
            <p style="margin: 0;">Regards,</p>
            <p style="margin: 0;"><strong>Virtual Auditor</strong></p>
            <p style="margin: 0;">HEPL</p>
        </div>
    `;

        await enqueueEmail({
            to: toEmails,
            cc: ccEmails || undefined,
            subject: `Audit Status Report - ${dateRange}`,
            html,
            attachments: [{ filename: `Audit_Status_Report_${new Date().toISOString().split('T')[0]}.xlsx`, content: excelBuffer }],
            checklistName: 'Audit Status Report',
            categoryName: null,
            locationName: null,
            departmentName: null
        });

        res.json({ message: 'Email queued successfully' });

    } catch (error) {
        logger.error('Send Audit Status Email Error:', error);
        res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
};
const getFilterOptions = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role?.trim();
        const isAdmin = ['Admin', 'Super Admin'].includes(userRole);
        const { category_name, location_name } = req.query;

        let locations, departments, categories;

        const catNames = category_name ? category_name.split('|||').map(v => v.trim()).filter(Boolean).slice(0, MAX_FILTER_VALUES) : [];
        const locNames = location_name ? location_name.split('|||').map(v => v.trim()).filter(Boolean).slice(0, MAX_FILTER_VALUES) : [];

        if (isAdmin) {
            categories = await knex('categories').select('id', 'name').where('is_active', 1).orderBy('name');

            if (catNames.length > 0) {
                locations = await knex('locations')
                    .select('locations.id', 'locations.name')
                    .join('checklists', 'checklists.location_id', 'locations.id')
                    .join('categories', 'checklists.category_id', 'categories.id')
                    .whereIn('categories.name', catNames)
                    .where('locations.is_active', 1)
                    .where('checklists.is_active', 1)
                    .whereNull('checklists.deleted_at')
                    .whereNotExists(function() {
                        this.select('*').from('daily_checklist_instances').whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
                    })
                    .groupBy('locations.id', 'locations.name')
                    .orderBy('locations.name');
            } else {
                locations = await knex('locations').select('id', 'name').where('is_active', 1).orderBy('name');
            }

            if (locNames.length > 0) {
                let deptQuery = knex('departments')
                    .select('departments.id', 'departments.name')
                    .join('checklists', 'checklists.department_id', 'departments.id')
                    .join('locations', 'checklists.location_id', 'locations.id')
                    .whereIn('locations.name', locNames)
                    .where('checklists.is_active', 1)
                    .whereNull('checklists.deleted_at')
                    .whereNotExists(function() {
                        this.select('*').from('daily_checklist_instances').whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
                    });
                if (catNames.length > 0) {
                    deptQuery.join('categories', 'checklists.category_id', 'categories.id')
                        .whereIn('categories.name', catNames);
                }
                departments = await deptQuery.where(function() { this.where('departments.is_active', 1).orWhereNull('departments.is_active'); }).groupBy('departments.id', 'departments.name').orderBy('departments.name');
            } else {
                departments = await knex('departments').select('id', 'name').where(function() { this.where('is_active', 1).orWhereNull('is_active'); }).orderBy('name');
            }
        } else {
            const user = await knex('users').where('id', userId).first('location_id', 'department_id');
            let locationIds = [], deptIds = [];
            try { locationIds = JSON.parse(user.location_id || '[]'); } catch (e) { if (user.location_id) locationIds = [user.location_id]; }
            try { deptIds = JSON.parse(user.department_id || '[]'); } catch (e) { if (user.department_id) deptIds = [user.department_id]; }

            categories = await knex('categories').select('id', 'name').where('is_active', 1).orderBy('name');

            if (catNames.length > 0 && locationIds.length > 0) {
                locations = await knex('locations')
                    .select('locations.id', 'locations.name')
                    .join('checklists', 'checklists.location_id', 'locations.id')
                    .join('categories', 'checklists.category_id', 'categories.id')
                    .whereIn('categories.name', catNames)
                    .whereIn('locations.id', locationIds)
                    .where('checklists.is_active', 1)
                    .whereNull('checklists.deleted_at')
                    .whereNotExists(function() {
                        this.select('*').from('daily_checklist_instances').whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
                    })
                    .groupBy('locations.id', 'locations.name')
                    .orderBy('locations.name');
            } else {
                locations = locationIds.length ? await knex('locations').select('id', 'name').whereIn('id', locationIds).where('is_active', 1).orderBy('name') : [];
            }

            if (locNames.length > 0 && deptIds.length > 0) {
                let deptQuery = knex('departments')
                    .select('departments.id', 'departments.name')
                    .join('checklists', 'checklists.department_id', 'departments.id')
                    .join('locations', 'checklists.location_id', 'locations.id')
                    .whereIn('locations.name', locNames)
                    .whereIn('departments.id', deptIds)
                    .where('checklists.is_active', 1)
                    .whereNull('checklists.deleted_at')
                    .whereNotExists(function() {
                        this.select('*').from('daily_checklist_instances').whereRaw('daily_checklist_instances.daily_checklist_id = checklists.id');
                    });
                if (catNames.length > 0) {
                    deptQuery.join('categories', 'checklists.category_id', 'categories.id')
                        .whereIn('categories.name', catNames);
                }
                departments = await deptQuery.where(function() { this.where('departments.is_active', 1).orWhereNull('departments.is_active'); }).groupBy('departments.id', 'departments.name').orderBy('departments.name');
            } else {
                departments = deptIds.length ? await knex('departments').select('id', 'name').whereIn('id', deptIds).where(function() { this.where('is_active', 1).orWhereNull('is_active'); }).orderBy('name') : [];
            }
        }

        res.json({ locations, departments, categories });
    } catch (error) {
        logger.error('Filter Options Error:', error);
        res.status(500).json({ error: 'Failed to fetch filter options', details: error.message });
    }
};

module.exports = {
    getNCReport,
    exportNCReport,
    getChecklistView,
    getReasonAnalysisReport,
    exportReasonAnalysisReport,
    getChecklistItemsReport,
    exportChecklistItemsReport,
    getUserStatusReport,
    exportUserStatusReport,
    getManagerSupervisorNCCounts,
    exportManagerSupervisorNCCounts,
    getAuditStatusReport,
    getDepartments,
    getNCReports,
    exportAuditStatusReport,
    exportAuditStatusReportDetailed,
    getSupervisorReport,
    exportSupervisorReport,
    getSupervisorExecutives,
    getSupervisorChecklistList,
    getSupervisorChecklistReport,
    exportSupervisorChecklistReport,
    getVAReport,
    getBusinessReport,
    exportBusinessReport,
    getDepartmentsByUser,
    getMailTrackerReport,
    exportMailTrackerReport,
    getChecklistScoreReport,
    exportChecklistScoreReport,
    getDepartmentNCChart,
    getDashboardNCChart,
    getChecklistNCSummary,
    getLocationByUser,
    getFilterOptions,
    getWeeklyNCReport,
    getAuditStatusEmailConfig,
    sendAuditStatusEmail
};
