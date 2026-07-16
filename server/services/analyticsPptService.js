const PptxGenJS = require('pptxgenjs');
const knex = require('../config/database');

const buildPptBuffer = async ({ fromDate, toDate, categoryId, locationId, departmentId, locationName, chartImage }) => {
  // ── Fetch all data ──────────────────────────────────────────────────────────
  const baseWhere = (q) => {
    if (fromDate) q = q.where('dci.assigned_date', '>=', fromDate);
    if (toDate)   q = q.where('dci.assigned_date', '<=', toDate);
    if (categoryId)   q = q.where('c.category_id', categoryId);
    if (locationId)   q = q.where('c.location_id', locationId);
    if (departmentId) {
      const ids = String(departmentId).split(',').map(Number).filter(Boolean);
      if (ids.length) q = q.whereIn('c.department_id', ids);
    }
    return q;
  };

  // chartData - NC count
  let chartQuery = knex('checklist_data as cd')
    .join('checklists as c', 'cd.checklist_id', 'c.id')
    .join('daily_checklist_instances as dci', 'dci.daily_checklist_id', 'c.id')
    .leftJoin('departments as d', 'c.department_id', 'd.id')
    .where('cd.status', 'No')
    .where('cd.submission_status', 'completed')
    .select(
      'd.name as department',
      knex.raw('COUNT(DISTINCT cd.id) as nc_count'),
      knex.raw("COUNT(DISTINCT CASE WHEN ci.criticality IN ('High', 'New') THEN cd.id END) as critical"),
      knex.raw("COUNT(DISTINCT CASE WHEN ci.criticality = 'Low' OR ci.criticality IS NULL THEN cd.id END) as non_critical")
    )
    .leftJoin('checklist_items as ci', function () {
      this.on('ci.checklist_id', '=', 'c.id').andOn('ci.id', '=', 'cd.checklist_item_id');
    })
    .groupBy('d.name')
    .orderBy('nc_count', 'desc');
  chartQuery = baseWhere(chartQuery);
  const chartRows = await chartQuery;

  // chartData - Total items (all responses: Yes + No + NA) per department
  let totalItemsQuery = knex('checklist_data as cd2')
    .select('d2.name as department', knex.raw('COUNT(DISTINCT cd2.id) as total_items'))
    .join('checklists as c', 'cd2.checklist_id', 'c.id')
    .join('daily_checklist_instances as dci', 'c.id', 'dci.daily_checklist_id')
    .leftJoin('departments as d2', 'c.department_id', 'd2.id')
    .whereIn('cd2.status', ['Yes', 'No', 'NA'])
    .groupBy('d2.name');
  totalItemsQuery = baseWhere(totalItemsQuery);
  const totalItemsRows = await totalItemsQuery;
  const totalItemsMap = {};
  totalItemsRows.forEach(r => { totalItemsMap[r.department || 'N/A'] = Number(r.total_items || 0); });

  const chartData = chartRows.map(r => {
    const nc = Number(r.nc_count);
    const items = totalItemsMap[r.department || 'N/A'] || 0;
    return {
      department: r.department || 'N/A',
      nc_count: nc,
      critical: Number(r.critical),
      non_critical: Number(r.non_critical),
      total_items: items,
      percentage: items > 0 ? parseFloat(((nc / items) * 100).toFixed(1)) : 0
    };
  });

  // userStatusData
  let userStatusQuery = knex('checklists as c')
    .join('daily_checklist_instances as dci', 'dci.daily_checklist_id', 'c.id')
    .join('checklists as tc', 'dci.template_checklist_id', 'tc.id')
    .leftJoin('departments as d', 'c.department_id', 'd.id')
    .select(
      'tc.checklist_name',
      'd.name as department_name',
      knex.raw('COUNT(*) as total_checklists'),
      knex.raw("SUM(CASE WHEN dci.status = 'awaiting_supervisor' THEN 1 ELSE 0 END) as awaiting_supervisor"),
      knex.raw("SUM(CASE WHEN dci.status = 'awaiting_manager' THEN 1 ELSE 0 END) as awaiting_manager"),
      knex.raw("SUM(CASE WHEN dci.status = 'completed' THEN 1 ELSE 0 END) as completed"),
      knex.raw("SUM(CASE WHEN c.status = 'Completed without NCs' THEN 1 ELSE 0 END) as completed_without_ncs")
    )
    .groupBy('tc.checklist_name', 'd.name');
  userStatusQuery = baseWhere(userStatusQuery);
  const userStatusData = await userStatusQuery;

  // ncSummaryData
  let ncSummaryQuery = knex('checklist_data as cd')
    .join('checklists as c', 'cd.checklist_id', 'c.id')
    .join('daily_checklist_instances as dci', 'dci.daily_checklist_id', 'c.id')
    .join('checklists as tc', 'dci.template_checklist_id', 'tc.id')
    .leftJoin('rosters as r', 'r.checklist_id', knex.raw('(SELECT template_checklist_id FROM daily_checklist_instances WHERE daily_checklist_id = c.id LIMIT 1)'))
    .leftJoin('users as sup', knex.raw("JSON_UNQUOTE(JSON_EXTRACT(r.supervisor_id, '$[0]'))"), 'sup.id')
    .leftJoin('users as mgr', knex.raw("JSON_UNQUOTE(JSON_EXTRACT(r.manager_id, '$[0]'))"), 'mgr.id')
    .leftJoin('checklist_items as ci', function () {
      this.on('ci.checklist_id', '=', 'c.id').andOn('ci.id', '=', 'cd.checklist_item_id');
    })
    .where('cd.status', 'No')
    .where('cd.submission_status', 'completed')
    .select(
      'tc.checklist_name',
      'sup.username as supervisor_name',
      'mgr.username as manager_name',
      knex.raw('COUNT(*) as total_nc'),
      knex.raw("SUM(CASE WHEN ci.criticality = 'High' THEN 1 ELSE 0 END) as critical_nc"),
      knex.raw("SUM(CASE WHEN ci.criticality != 'High' OR ci.criticality IS NULL THEN 1 ELSE 0 END) as non_critical_nc"),
      knex.raw("SUM(CASE WHEN sr.status = 'Close' AND sr.supervisor_status = 'Accepted' AND ci.criticality = 'High' THEN 1 ELSE 0 END) as critical_accepted"),
      knex.raw("SUM(CASE WHEN sr.status = 'Close' AND sr.supervisor_status = 'Rejected' AND ci.criticality = 'High' THEN 1 ELSE 0 END) as critical_rejected"),
      knex.raw("SUM(CASE WHEN sr.status = 'Close' AND sr.supervisor_status = 'Accepted' AND (ci.criticality != 'High' OR ci.criticality IS NULL) THEN 1 ELSE 0 END) as non_critical_accepted"),
      knex.raw("SUM(CASE WHEN sr.status = 'Close' AND sr.supervisor_status = 'Rejected' AND (ci.criticality != 'High' OR ci.criticality IS NULL) THEN 1 ELSE 0 END) as non_critical_rejected"),
      knex.raw("SUM(CASE WHEN sr.supervisor_status = 'Accepted' THEN 1 ELSE 0 END) as accepted_nc"),
      knex.raw("SUM(CASE WHEN sr.supervisor_status = 'Rejected' THEN 1 ELSE 0 END) as rejected_nc")
    )
    .leftJoin('supervisor_reviews as sr', function () {
      this.on('sr.checklist_id', '=', 'c.id').andOn('sr.checklist_item_id', '=', 'cd.checklist_item_id');
    })
    .groupBy('tc.checklist_name', 'sup.username', 'mgr.username');
  ncSummaryQuery = baseWhere(ncSummaryQuery);
  const ncSummaryData = await ncSummaryQuery;

  // weeklyNCData
  const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = toDate ? new Date(toDate) : new Date();
  const weeks = [];
  let cur = new Date(from);
  while (cur <= to) {
    const wStart = new Date(cur);
    const wEnd = new Date(cur);
    wEnd.setDate(wEnd.getDate() + 6);
    if (wEnd > to) wEnd.setTime(to.getTime());
    weeks.push({
      label: `W${weeks.length + 1}`,
      start: wStart.toISOString().split('T')[0],
      end: wEnd.toISOString().split('T')[0]
    });
    cur.setDate(cur.getDate() + 7);
  }

  const weeklyRaw = await knex('checklist_data as cd')
    .join('checklists as c', 'cd.checklist_id', 'c.id')
    .join('daily_checklist_instances as dci', 'dci.daily_checklist_id', 'c.id')
    .leftJoin('locations as l', 'c.location_id', 'l.id')
    .leftJoin('departments as d', 'c.department_id', 'd.id')
    .where('cd.status', 'No')
    .where('cd.submission_status', 'completed')
    .modify(q => baseWhere(q))
    .select('l.name as location', 'd.name as department', 'dci.assigned_date');

  const weeklyMap = {};
  weeklyRaw.forEach(row => {
    const key = `${row.location}||${row.department}`;
    if (!weeklyMap[key]) weeklyMap[key] = { location: row.location, department: row.department };
    const d = new Date(row.assigned_date);
    weeks.forEach((w, wi) => {
      const ws = new Date(w.start), we = new Date(w.end);
      if (d >= ws && d <= we) {
        weeklyMap[key][`week_${wi + 1}`] = (weeklyMap[key][`week_${wi + 1}`] || 0) + 1;
      }
    });
  });
  const weeklyNCData = Object.values(weeklyMap).map(row => ({
    ...row,
    grand_total: weeks.reduce((s, _, wi) => s + (row[`week_${wi + 1}`] || 0), 0)
  }));
  const weeklyNCGrandTotal = weeks.reduce((acc, _, wi) => {
    acc[`week_${wi + 1}`] = weeklyNCData.reduce((s, r) => s + (r[`week_${wi + 1}`] || 0), 0);
    return acc;
  }, { grand_total: weeklyNCData.reduce((s, r) => s + r.grand_total, 0) });

  // ── Build PPT (identical to frontend exportPPT) ─────────────────────────────
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const brandColor = 'C50B34';
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const footerText = `Generated: ${generatedDate}  |  Virtual Audit System`;
  const locName = locationName || 'All Locations';
  const dateRange = `${fromDate || ''}  to  ${toDate || ''}`;

  const addFooter = (slide) => {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.0, w: '100%', h: 0.5, fill: { color: 'F3F4F6' } });
    slide.addText(footerText, { x: 0.5, y: 7.05, w: '90%', h: 0.4, fontSize: 8, color: '888888', align: 'center' });
  };

  // Slide 1: Enhanced Title
  const slide1 = pptx.addSlide();
  slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.0, fill: { color: brandColor } });
  slide1.addText('VIRTUAL AUDIT', { x: 0, y: 0.15, w: '100%', h: 0.7, fontSize: 28, bold: true, color: 'FFFFFF', align: 'center', charSpacing: 5 });
  slide1.addText(locName, { x: 0.5, y: 1.8, w: '90%', fontSize: 36, bold: true, color: '333333', align: 'center' });
  slide1.addShape(pptx.ShapeType.rect, { x: 4.5, y: 2.9, w: 4.3, h: 0.04, fill: { color: brandColor } });
  slide1.addText(dateRange, { x: 0.5, y: 3.2, w: '90%', fontSize: 18, color: '777777', align: 'center' });
  addFooter(slide1);

  // Slide 2: Bar Chart with Total Items + NCs + NC% trend line
  if (chartData.length > 0) {
    const slide2 = pptx.addSlide();
    slide2.addText('NC Count by Department', { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: brandColor });
    if (chartImage) {
      slide2.addImage({ data: `image/png;base64,${chartImage}`, x: 0.5, y: 1.0, w: 12, h: 5.5 });
    } else {
      const labels = chartData.map(d => d.department);
      slide2.addChart(
        [
          { type: pptx.ChartType.bar, data: [
            { name: 'Total Items', labels, values: chartData.map(d => d.total_items) },
            { name: 'Total NCs', labels, values: chartData.map(d => d.nc_count) },
          ], options: { chartColors: ['94A3B8', 'C50B34'] } },
          { type: pptx.ChartType.line, data: [
            { name: 'NC %', labels, values: chartData.map(d => d.percentage) },
          ], options: { chartColors: ['2563EB'], lineSize: 2, lineDataSymbol: 'circle', secondaryValAxis: true } },
        ],
        {
          x: 0.5, y: 1.0, w: 12, h: 5.5,
          showValue: true, valueFontSize: 8,
          catAxisLabelFontSize: 9, catAxisOrientation: 'minMax',
          showLegend: true, legendPos: 't',
          secondaryValAxisMaxVal: 100,
        }
      );
    }
    addFooter(slide2);
  }

  // Slide 3: Checklist Wise NC Closure
  if (userStatusData.length > 0) {
    const hdrOpts = { bold: true, fill: brandColor, color: 'FFFFFF', align: 'center', fontSize: 10 };
    const headerRow = [
      { text: 'Checklist', options: { ...hdrOpts, align: 'left' } },
      { text: 'Department', options: { ...hdrOpts, align: 'left' } },
      { text: 'Total', options: hdrOpts },
      { text: 'Awaiting Sup.', options: hdrOpts },
      { text: 'Awaiting Mgr.', options: hdrOpts },
      { text: 'Completed', options: hdrOpts },
    ];
    const rowsPerSlide = 18;
    const totalPages = Math.ceil(userStatusData.length / rowsPerSlide);
    for (let page = 0; page < totalPages; page++) {
      const slide3 = pptx.addSlide();
      const pageTitle = totalPages > 1 ? `Checklist Wise NC Closure (${page + 1}/${totalPages})` : 'Checklist Wise NC Closure';
      slide3.addText(pageTitle, { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: brandColor });
      const startIdx = page * rowsPerSlide;
      const pageData = userStatusData.slice(startIdx, startIdx + rowsPerSlide);
      const closureRows = [
        headerRow,
        ...pageData.map((d, i) => [
          { text: d.checklist_name || '', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
          { text: d.department_name || 'N/A', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
          { text: String(d.total_checklists), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
          { text: String(d.awaiting_supervisor), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
          { text: String(d.awaiting_manager), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
          { text: String(Number(d.completed) + Number(d.completed_without_ncs)), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
        ]),
      ];
      slide3.addTable(closureRows, { x: 0.3, y: 1.0, w: 12.5, fontSize: 9, border: { pt: 0.5, color: 'CCCCCC' }, colW: [3, 2.5, 1.4, 1.4, 1.4, 1.4], rowH: 0.28 });
      addFooter(slide3);
    }
  }

  // Slide 4: Checklist NC Summary
  if (ncSummaryData.length > 0) {
    const hdrOpts = { bold: true, fill: brandColor, color: 'FFFFFF', align: 'center', fontSize: 10 };
    const headerRow = [
      { text: 'Checklist', options: { ...hdrOpts, align: 'left' } },
      { text: 'Supervisor', options: { ...hdrOpts, align: 'left' } },
      { text: 'Manager', options: { ...hdrOpts, align: 'left' } },
      { text: 'Total', options: hdrOpts },
      { text: 'Critical', options: hdrOpts },
      { text: 'Non-Critical', options: hdrOpts },
      { text: 'Crit. Acc', options: hdrOpts },
      { text: 'Crit. Rej', options: hdrOpts },
      { text: 'NCrit. Acc', options: hdrOpts },
      { text: 'NCrit. Rej', options: hdrOpts },
      { text: 'Accepted', options: hdrOpts },
      { text: 'Rejected', options: hdrOpts },
    ];
    const rowsPerSlide = 14;
    const totalPages = Math.ceil(ncSummaryData.length / rowsPerSlide);
    for (let page = 0; page < totalPages; page++) {
      const slide4 = pptx.addSlide();
      const pageTitle = totalPages > 1 ? `Checklist NC Summary (${page + 1}/${totalPages})` : 'Checklist NC Summary';
      slide4.addText(pageTitle, { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: brandColor });
      const startIdx = page * rowsPerSlide;
      const pageData = ncSummaryData.slice(startIdx, startIdx + rowsPerSlide);
      const summaryRows = [
        headerRow,
        ...pageData.map((d, i) => {
          const acceptedPct = d.total_nc > 0 ? ((d.accepted_nc / d.total_nc) * 100).toFixed(1) : 0;
          const rejectedPct = d.total_nc > 0 ? ((d.rejected_nc / d.total_nc) * 100).toFixed(1) : 0;
          return [
            { text: d.checklist_name || '', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: d.supervisor_name || '', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: d.manager_name || '', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: String(d.total_nc), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: String(d.critical_nc), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF', color: 'DC2626' } },
            { text: String(d.non_critical_nc), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF', color: '16A34A' } },
            { text: String(d.critical_accepted), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: String(d.critical_rejected), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: String(d.non_critical_accepted), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: String(d.non_critical_rejected), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: `${d.accepted_nc} (${acceptedPct}%)`, options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF', color: '2563EB' } },
            { text: `${d.rejected_nc} (${rejectedPct}%)`, options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF', color: 'D97706' } },
          ];
        }),
      ];
      if (page === totalPages - 1) {
        const sumTotal = ncSummaryData.reduce((s, d) => s + Number(d.total_nc), 0);
        const sumCritical = ncSummaryData.reduce((s, d) => s + Number(d.critical_nc), 0);
        const sumNonCritical = ncSummaryData.reduce((s, d) => s + Number(d.non_critical_nc), 0);
        const sumAccepted = ncSummaryData.reduce((s, d) => s + Number(d.accepted_nc), 0);
        const sumRejected = ncSummaryData.reduce((s, d) => s + Number(d.rejected_nc), 0);
        const sumCritAcc = ncSummaryData.reduce((s, d) => s + Number(d.critical_accepted), 0);
        const sumCritRej = ncSummaryData.reduce((s, d) => s + Number(d.critical_rejected), 0);
        const sumNonCritAcc = ncSummaryData.reduce((s, d) => s + Number(d.non_critical_accepted), 0);
        const sumNonCritRej = ncSummaryData.reduce((s, d) => s + Number(d.non_critical_rejected), 0);
        summaryRows.push([
          { text: 'Total', options: { bold: true, fill: 'E5E7EB' } },
          { text: '', options: { fill: 'E5E7EB' } },
          { text: '', options: { fill: 'E5E7EB' } },
          { text: String(sumTotal), options: { bold: true, align: 'center', fill: 'E5E7EB' } },
          { text: String(sumCritical), options: { bold: true, align: 'center', fill: 'E5E7EB', color: 'DC2626' } },
          { text: String(sumNonCritical), options: { bold: true, align: 'center', fill: 'E5E7EB', color: '16A34A' } },
          { text: String(sumCritAcc), options: { bold: true, align: 'center', fill: 'E5E7EB' } },
          { text: String(sumCritRej), options: { bold: true, align: 'center', fill: 'E5E7EB' } },
          { text: String(sumNonCritAcc), options: { bold: true, align: 'center', fill: 'E5E7EB' } },
          { text: String(sumNonCritRej), options: { bold: true, align: 'center', fill: 'E5E7EB' } },
          { text: String(sumAccepted), options: { bold: true, align: 'center', fill: 'E5E7EB', color: '2563EB' } },
          { text: String(sumRejected), options: { bold: true, align: 'center', fill: 'E5E7EB', color: 'D97706' } },
        ]);
      }
      slide4.addTable(summaryRows, { x: 0.3, y: 1.0, w: 12.5, fontSize: 8, border: { pt: 0.5, color: 'CCCCCC' }, colW: [2.0, 1.4, 1.4, 0.8, 1.0, 1.0, 0.8, 0.8, 0.8, 0.8, 1.0, 1.0], rowH: 0.28 });
      addFooter(slide4);
    }
  }

  // Slide 5: Weekly NC Comparison
  if (weeklyNCData.length > 0 && weeks.length > 0) {
    const hdrOpts = { bold: true, fill: brandColor, color: 'FFFFFF', align: 'center', fontSize: 10 };
    const headerRow = [
      { text: 'Location', options: { ...hdrOpts, align: 'left' } },
      { text: 'Department', options: { ...hdrOpts, align: 'left' } },
      ...weeks.map(w => ({ text: w.label, options: hdrOpts })),
      { text: 'Grand Total', options: hdrOpts },
    ];
    const rowsPerSlide = 15;
    const totalPages = Math.ceil(weeklyNCData.length / rowsPerSlide);
    for (let page = 0; page < totalPages; page++) {
      const slide5 = pptx.addSlide();
      const pageTitle = totalPages > 1 ? `Weekly NC Comparison by Location & Dept (${page + 1}/${totalPages})` : 'Weekly NC Comparison by Location & Dept';
      slide5.addText(pageTitle, { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: brandColor });
      const startIdx = page * rowsPerSlide;
      const pageData = weeklyNCData.slice(startIdx, startIdx + rowsPerSlide);
      const weeklyRows = [
        headerRow,
        ...pageData.map((row, i) => [
          { text: row.location || '', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
          { text: row.department || '', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
          ...weeks.map((_, wi) => ({ text: String(row[`week_${wi + 1}`] || 0), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } })),
          { text: String(row.grand_total || 0), options: { bold: true, align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
        ]),
      ];
      if (page === totalPages - 1 && weeklyNCGrandTotal) {
        weeklyRows.push([
          { text: 'Grand Total', options: { bold: true, fill: 'E5E7EB' } },
          { text: '', options: { fill: 'E5E7EB' } },
          ...weeks.map((_, wi) => ({ text: String(weeklyNCGrandTotal[`week_${wi + 1}`] || 0), options: { bold: true, align: 'center', fill: 'E5E7EB' } })),
          { text: String(weeklyNCGrandTotal.grand_total || 0), options: { bold: true, align: 'center', fill: 'E5E7EB' } },
        ]);
      }
      const locColW = 2.0, deptColW = 2.0;
      const weekColW = weeks.length > 0 ? parseFloat(((12.5 - locColW - deptColW - 1.2) / weeks.length).toFixed(2)) : 1.5;
      slide5.addTable(weeklyRows, { x: 0.3, y: 1.0, w: 12.5, fontSize: 9, border: { pt: 0.5, color: 'CCCCCC' }, colW: [locColW, deptColW, ...weeks.map(() => weekColW), 1.2], rowH: 0.28 });
      addFooter(slide5);
    }
  }

  // Slide 6: Thank You
  const slide6 = pptx.addSlide();
  slide6.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: brandColor } });
  slide6.addText('Thank You', { x: 0.5, y: 2.0, w: '90%', fontSize: 48, bold: true, color: 'FFFFFF', align: 'center' });
  slide6.addShape(pptx.ShapeType.rect, { x: 5, y: 3.3, w: 3.3, h: 0.04, fill: { color: 'FFFFFF' } });
  slide6.addText('Virtual Audit System', { x: 0.5, y: 3.6, w: '90%', fontSize: 16, color: 'FFCCCC', align: 'center' });
  slide6.addText(footerText, { x: 0.5, y: 7.05, w: '90%', h: 0.4, fontSize: 8, color: 'FFAAAA', align: 'center' });

  return pptx.write({ outputType: 'nodebuffer' });
};

module.exports = { buildPptBuffer };
