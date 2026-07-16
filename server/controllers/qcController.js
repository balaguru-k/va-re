const knex = require('../config/database');
const logger = require('../config/logger');

const submitQcFormWithImages = async (req, res) => {
  try {
    const { formData, qcData } = JSON.parse(req.body.data);
    const files = req.files || [];
    const userId = req.user.id;
    const userName = req.user.username;

    if (!formData.checklistId || !formData.videoDate) {
      return res.status(400).json({ error: 'Checklist and Video Date are required' });
    }

    // Map uploaded files to item keys
    // After sharp compression, files are in uploads/images/ with file.filename set
    const fileMap = {};
    const itemImagesMap = {};
    files.forEach(file => {
      const imgMatch = file.originalname.match(/^([\w]+-\d+|new_\d+)-img_\d+_/);
      if (imgMatch) {
        const itemKey = imgMatch[1];
        if (!itemImagesMap[itemKey]) itemImagesMap[itemKey] = [];
        itemImagesMap[itemKey].push(file.filename);
        return;
      }
      const match = file.originalname.match(/^([\w]+-\d+|new_\d+)_\d+_/);
      if (match) {
        const itemKey = match[1];
        if (!fileMap[itemKey]) fileMap[itemKey] = [];
        fileMap[itemKey].push(file.filename);
      }
    });

    const instance = await knex('daily_checklist_instances')
      .where('daily_checklist_id', formData.checklistId)
      .first();

    const ncCount = parseInt(formData.ncCount) || 0;

    const result = await knex.transaction(async (trx) => {
      const [submissionId] = await trx('qc_submissions').insert({
        checklist_id: formData.checklistId,
        template_checklist_id: instance?.template_checklist_id || null,
        video_date: formData.videoDate,
        auditor_id: instance?.auditor_id || null,
        emp_id: formData.empId || null,
        auditor_name: formData.name || null,
        checklist_name: formData.checklistName || null,
        location: formData.location || null,
        camera_audited: formData.cameraAudited ? parseInt(formData.cameraAudited) : null,
        nc_count: ncCount,
        nc_qc_count: formData.ncQCCount ? parseInt(formData.ncQCCount) : null,
        submitted_by: userId,
        submitted_by_name: userName,
        created_at: new Date(),
        updated_at: new Date()
      });

      if (qcData && Object.keys(qcData).length > 0) {
        const items = Object.entries(qcData).map(([key, data]) => ({
          qc_submission_id: submissionId,
          checklist_item_id: data.checklist_item_id || null,
          checklist_data_id: data.checklist_data_id || null,
          qc_update: data.qcUpdate || null,
          remark: data.remark || null,
          images: fileMap[data.itemKey] ? JSON.stringify(fileMap[data.itemKey]) : null,
          is_new_item: data.is_new_item || false,
          activities: data.activities || null,
          process: data.process || null,
          criticality: data.criticality || null,
          status: data.status || null,
          reason: data.reason || null,
          item_images: itemImagesMap[data.itemKey] ? JSON.stringify(itemImagesMap[data.itemKey]) : null,
          created_at: new Date()
        }));

        if (items.length > 0) {
          await trx('qc_submission_items').insert(items);
        }
      }

      return submissionId;
    });

    res.status(201).json({ message: 'QC Form submitted successfully', submissionId: result });
  } catch (error) {
    logger.error('Error submitting QC form with images:', error);
    res.status(500).json({ error: 'Failed to submit QC form', details: error.message });
  }
};

const getQcSubmissions = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    let query = knex('qc_submissions')
      .select(
        'qc_submissions.*',
        knex.raw('(SELECT COUNT(*) FROM qc_submission_items WHERE qc_submission_id = qc_submissions.id) as total_items'),
        knex.raw('(SELECT COUNT(*) FROM qc_submission_items WHERE qc_submission_id = qc_submissions.id AND qc_update IS NOT NULL AND qc_update != "") as qc_filled_items')
      )
      .orderBy('qc_submissions.created_at', 'desc');

    if (fromDate && toDate) {
      query = query.whereBetween('qc_submissions.created_at', [fromDate, `${toDate} 23:59:59`]);
    }

    const submissions = await query;
    res.json({ message: 'QC submissions retrieved', submissions });
  } catch (error) {
    logger.error('Error fetching QC submissions:', error);
    res.status(500).json({ error: 'Failed to fetch QC submissions', details: error.message });
  }
};

const getQcSubmissionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await knex('qc_submissions').where('id', id).first();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const items = await knex('qc_submission_items as qi')
      .select(
        'qi.*',
        'ci.activities as ci_activities',
        'ci.process as ci_process',
        'ci.criticality as ci_criticality',
        'cd.status as item_status',
        'cd.reason as item_reason',
        'cd.image_name as item_images'
      )
      .leftJoin('checklist_items as ci', 'qi.checklist_item_id', 'ci.id')
      .leftJoin('checklist_data as cd', 'qi.checklist_data_id', 'cd.id')
      .where('qi.qc_submission_id', id);

    // For new items, use fields from qc_submission_items directly
    const processedItems = items.map(item => ({
      ...item,
      qc_submission_item_id: item.id,
      activities: item.is_new_item ? item.activities : item.ci_activities,
      process: item.is_new_item ? item.process : item.ci_process,
      criticality: item.is_new_item ? item.criticality : item.ci_criticality,
      item_status: item.is_new_item ? item.status : item.item_status,
      item_reason: item.is_new_item ? item.reason : item.item_reason,
      item_images: item.is_new_item ? item.item_images : item.item_images
    }));

    res.json({ message: 'QC submission detail retrieved', submission, items: processedItems });
  } catch (error) {
    logger.error('Error fetching QC submission detail:', error);
    res.status(500).json({ error: 'Failed to fetch QC submission detail', details: error.message });
  }
};

// Auditor: get QC submissions assigned to them
const getAuditorQcSubmissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fromDate, toDate } = req.query;

    let query = knex('qc_submissions')
      .select(
        'qc_submissions.*',
        knex.raw('(SELECT COUNT(*) FROM qc_submission_items WHERE qc_submission_id = qc_submissions.id) as total_items'),
        knex.raw('(SELECT COUNT(*) FROM qc_submission_items WHERE qc_submission_id = qc_submissions.id AND auditor_qc_remark IS NOT NULL AND auditor_qc_remark != "") as remarks_filled')
      )
      .where('qc_submissions.auditor_id', userId)
      .orderBy('qc_submissions.created_at', 'desc');

    if (fromDate && toDate) {
      query = query.whereBetween('qc_submissions.video_date', [fromDate, toDate]);
    }

    const submissions = await query;
    res.json({ message: 'Auditor QC submissions retrieved', submissions });
  } catch (error) {
    logger.error('Error fetching auditor QC submissions:', error);
    res.status(500).json({ error: 'Failed to fetch QC submissions', details: error.message });
  }
};

// Auditor: submit remarks for QC items
const submitAuditorQcRemark = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body; // { itemId: remark, itemId: remark, ... }

    if (!remarks || Object.keys(remarks).length === 0) {
      return res.status(400).json({ error: 'No remarks provided' });
    }

    await knex.transaction(async (trx) => {
      for (const [itemId, remark] of Object.entries(remarks)) {
        await trx('qc_submission_items')
          .where('id', itemId)
          .where('qc_submission_id', id)
          .update({ auditor_qc_remark: remark });
      }
    });

    res.json({ message: 'Remarks submitted successfully' });
  } catch (error) {
    logger.error('Error submitting auditor QC remarks:', error);
    res.status(500).json({ error: 'Failed to submit remarks', details: error.message });
  }
};

// Export QC submissions as Excel with embedded images
const exportQcSubmissions = async (req, res) => {
  const ExcelJS = require('exceljs');

  try {
    const { fromDate, toDate } = req.query;

    let query = knex('qc_submissions').orderBy('created_at', 'desc');
    if (fromDate && toDate) {
      query = query.whereBetween('created_at', [fromDate, `${toDate} 23:59:59`]);
    }
    const submissions = await query;

    if (submissions.length === 0) {
      return res.status(404).json({ error: 'No submissions found' });
    }

    // Fetch all items for all submissions
    const submissionIds = submissions.map(s => s.id);
    const allItems = await knex('qc_submission_items as qi')
      .select(
        'qi.*',
        'ci.activities as ci_activities', 'ci.process as ci_process', 'ci.criticality as ci_criticality',
        'cd.status as item_status', 'cd.reason as item_reason', 'cd.image_name as cd_item_images'
      )
      .leftJoin('checklist_items as ci', 'qi.checklist_item_id', 'ci.id')
      .leftJoin('checklist_data as cd', 'qi.checklist_data_id', 'cd.id')
      .whereIn('qi.qc_submission_id', submissionIds);

    const itemsBySubmission = {};
    allItems.forEach(item => {
      if (!itemsBySubmission[item.qc_submission_id]) itemsBySubmission[item.qc_submission_id] = [];
      itemsBySubmission[item.qc_submission_id].push({
        ...item,
        activities: item.is_new_item ? item.activities : item.ci_activities,
        process: item.is_new_item ? item.process : item.ci_process,
        criticality: item.is_new_item ? item.criticality : item.ci_criticality,
        item_status: item.is_new_item ? item.status : item.item_status,
        item_reason: item.is_new_item ? item.reason : item.item_reason,
        item_images: item.is_new_item ? item.item_images : item.cd_item_images
      });
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('QC Form Data');

    const headers = ['Video Date', 'Checklist Name', 'Auditor', 'Emp ID', 'Location', 'NC Count', 'Activities', 'Process', 'Criticality', 'Status', 'Reason', 'Auditor Images', 'QC Update', 'Qc Remark', 'QC Images', 'Auditor QC Remark','Qc Final Remark'];
    sheet.columns = headers.map(h => ({ header: h, key: h, width: h.includes('Images') ? 20 : h === 'Activities' || h === 'Reason' ? 30 : 15 }));

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };

    const baseUrl = process.env.BACKEND_URL || '';
    console.log(process.env.BACKEND_URL + '........');
    let rowIndex = 2;
    for (const submission of submissions) {
      const items = itemsBySubmission[submission.id] || [];
      for (const item of items) {
        const row = sheet.getRow(rowIndex);
        row.getCell(1).value = submission.video_date ? new Date(submission.video_date).toLocaleDateString('en-GB') : '';
        row.getCell(2).value = submission.checklist_name || '';
        row.getCell(3).value = submission.auditor_name || '';
        row.getCell(4).value = submission.emp_id || '';
        row.getCell(5).value = submission.location || '';
        row.getCell(6).value = submission.nc_count || 0;
        row.getCell(7).value = item.activities || '';
        row.getCell(8).value = item.process || '';
        row.getCell(9).value = item.criticality || '';
        row.getCell(10).value = item.item_status || '';
        row.getCell(11).value = item.item_reason || '';
        row.getCell(13).value = item.qc_update || '';
        row.getCell(14).value = item.remark || '';
        row.getCell(16).value = item.auditor_qc_remark || '';
        row.getCell(17).value = item.qc_final_remark

        // Auditor images as hyperlink (column 12)
        const auditorImages = item.item_images ? (item.item_images.startsWith('[') ? JSON.parse(item.item_images) : item.item_images.split(',').filter(i => i.trim())) : [];
        if (auditorImages.length > 0) {
          const imageUrl = `${baseUrl}/uploads/images/${auditorImages[0]}`;
          row.getCell(12).value = { text: 'View Image', hyperlink: imageUrl };
          row.getCell(12).font = { color: { argb: 'FF0000FF' }, underline: true };
        }

        // QC images as hyperlink (column 15)
        const qcImages = item.images ? JSON.parse(item.images) : [];
        if (qcImages.length > 0) {
          const imageUrl = `${baseUrl}/uploads/qc-images/${qcImages[0]}`;
          row.getCell(15).value = { text: 'View Image', hyperlink: imageUrl };
          row.getCell(15).font = { color: { argb: 'FF0000FF' }, underline: true };
        }

        rowIndex++;
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=QC_Form_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting QC submissions:', error);
    res.status(500).json({ error: 'Failed to export', details: error.message });
  }
};

// Get QC submission edit data - only the submitted QC items for one-time edit
const getQcSubmissionEditData = async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await knex('qc_submissions').where('id', id).first();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.is_edited) return res.status(400).json({ error: 'This submission has already been edited once' });

    // Get only the submitted QC items
    const items = await knex('qc_submission_items as qi')
      .select(
        'qi.id as qc_submission_item_id',
        'qi.checklist_item_id',
        'qi.checklist_data_id',
        'qi.qc_update',
        'qi.remark',
        'qi.images',
        'qi.auditor_qc_remark',
        'qi.qc_final_remark',
        'qi.is_new_item',
        'qi.activities as qi_activities',
        'qi.process as qi_process',
        'qi.criticality as qi_criticality',
        'qi.status as qi_status',
        'qi.reason as qi_reason',
        'ci.activities',
        'ci.process',
        'ci.criticality',
        'cd.status as item_status',
        'cd.reason as item_reason',
        'cd.image_name as item_images'
      )
      .leftJoin('checklist_items as ci', 'qi.checklist_item_id', 'ci.id')
      .leftJoin('checklist_data as cd', 'qi.checklist_data_id', 'cd.id')
      .where('qi.qc_submission_id', id)
      .orderByRaw("FIELD(cd.status, 'No') DESC");

    const processedItems = items.map(item => ({
      qc_submission_item_id: item.qc_submission_item_id,
      checklist_item_id: item.checklist_item_id,
      checklist_data_id: item.checklist_data_id,
      activities: item.is_new_item ? item.qi_activities : item.activities || '',
      process: item.is_new_item ? item.qi_process : item.process || '',
      criticality: item.is_new_item ? item.qi_criticality : item.criticality || '',
      item_status: item.is_new_item ? item.qi_status : item.item_status || '',
      reason: item.is_new_item ? item.qi_reason : item.item_reason || '',
      item_images: item.is_new_item ? null : item.item_images || '',
      qc_update: item.qc_update || '',
      remark: item.remark || '',
      images: item.images || null,
      auditor_qc_remark: item.auditor_qc_remark || '',
      qc_final_remark: item.qc_final_remark || ''
    }));

    res.json({ message: 'Edit data retrieved', submission, items: processedItems });
  } catch (error) {
    logger.error('Error fetching QC submission edit data:', error);
    res.status(500).json({ error: 'Failed to fetch edit data', details: error.message });
  }
};

// Edit QC submission items (one-time only) - only updates already submitted items
const updateQcSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    const submission = await knex('qc_submissions').where('id', id).first();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.is_edited) return res.status(400).json({ error: 'This submission has already been edited once' });

    await knex.transaction(async (trx) => {
      for (const item of items) {
        if (item.qc_submission_item_id) {
          await trx('qc_submission_items')
            .where('id', item.qc_submission_item_id)
            .where('qc_submission_id', id)
            .update({ qc_update: item.qc_update || null, remark: item.remark || null, auditor_qc_remark: item.auditor_qc_remark || null, qc_final_remark : item.qc_final_remark || null });
        }
      }
      await trx('qc_submissions').where('id', id).update({ is_edited: true });
    });

    res.json({ message: 'Submission updated successfully' });
  } catch (error) {
    logger.error('Error updating QC submission:', error);
    res.status(500).json({ error: 'Failed to update submission', details: error.message });
  }
};

module.exports = { submitQcFormWithImages, getQcSubmissions, getQcSubmissionDetail, getAuditorQcSubmissions, submitAuditorQcRemark, exportQcSubmissions, getQcSubmissionEditData, updateQcSubmission };
