import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { checklistAPI, mastersAPI } from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/UI/MultiSelectDropdown';
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import toast from 'react-hot-toast';
import PptxGenJS from 'pptxgenjs';
import { EnvelopeIcon } from '@heroicons/react/24/solid';

const AdminAnalyticsDashboard = () => {
  const { token } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    toDate: today,
    categoryId: '',
    locationId: '',
    departmentId: []
  });

  const [userStatusData, setUserStatusData] = useState([]);
  const [userStatusLoading, setUserStatusLoading] = useState(false);
  const [ncSummaryData, setNcSummaryData] = useState([]);
  const [ncSummaryLoading, setNcSummaryLoading] = useState(false);
  const [weeklyNCData, setWeeklyNCData] = useState([]);
  const [weeklyNCWeeks, setWeeklyNCWeeks] = useState([]);
  const [weeklyNCGrandTotal, setWeeklyNCGrandTotal] = useState(null);
  const [weeklyNCLoading, setWeeklyNCLoading] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: '', cc: '', subject: '' });
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchAll();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checklists/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(res.data.categories || []);
    } catch (e) {}
  };

  const fetchLocationsByCategory = async (categoryId) => {
    if (!categoryId) { setLocations([]); setDepartments([]); return; }
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checklists/locations-by-category/${categoryId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocations(res.data.locations || []);
    } catch (e) {}
  };

  const fetchDepartmentsByCategoryLocation = async (categoryId, locationId) => {
    if (!categoryId || !locationId) { setDepartments([]); return; }
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checklists/departments-by-category-location/${categoryId}/${locationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(res.data.departments || []);
    } catch (e) {}
  };

  const buildParams = (f = filters) => {
    const params = {};
    if (f.fromDate) params.fromDate = f.fromDate;
    if (f.toDate) params.toDate = f.toDate;
    if (f.categoryId) params.categoryId = f.categoryId;
    if (f.locationId) params.locationId = f.locationId;
    if (f.departmentId.length > 0) params.departmentId = f.departmentId.join(',');
    return params;
  };

  const fetchNCChart = async (f = filters) => {
    setChartLoading(true);
    try {
      const res = await checklistAPI.getDashboardNCChart(buildParams(f));
      setChartData(res.data.data || []);
    } catch (e) {
      console.error('NC Chart Error:', e);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchUserStatus = async (f = filters) => {
    setUserStatusLoading(true);
    try {
      const res = await checklistAPI.getUserStatusReport({ ...buildParams(f), limit: 100 });
      setUserStatusData(res.data.data || []);
    } catch (e) {
      console.error('User Status Error:', e);
    } finally {
      setUserStatusLoading(false);
    }
  };

  const fetchNCSummary = async (f = filters) => {
    setNcSummaryLoading(true);
    try {
      const res = await checklistAPI.getChecklistNCSummary(buildParams(f));
      setNcSummaryData(res.data.data || []);
    } catch (e) {
      console.error('NC Summary Error:', e);
    } finally {
      setNcSummaryLoading(false);
    }
  };

  const fetchWeeklyNC = async (f = filters) => {
    setWeeklyNCLoading(true);
    try {
      const res = await checklistAPI.getWeeklyNCReport(buildParams(f));
      setWeeklyNCWeeks(res.data.weeks || []);
      setWeeklyNCData(res.data.data || []);
      setWeeklyNCGrandTotal(res.data.grand_total || null);
    } catch (e) {
      console.error('Weekly NC Error:', e);
    } finally {
      setWeeklyNCLoading(false);
    }
  };

  const fetchAll = (f = filters) => {
    fetchNCChart(f);
    fetchUserStatus(f);
    fetchNCSummary(f);
    fetchWeeklyNC(f);
  };

  const handleApply = () => fetchAll(filters);

  const totalNCs = chartData.reduce((s, d) => s + d.nc_count, 0);
  const totalCritical = chartData.reduce((s, d) => s + d.critical, 0);
  const totalNonCritical = chartData.reduce((s, d) => s + d.non_critical, 0);

  const handleSendEmail = async () => {
    if (!emailForm.to.trim()) return toast.error('To email is required');
    setEmailSending(true);
    try {
      let locationName = 'All Locations';
      if (filters.locationId) {
        const found = locations.find(l => String(l.id) === String(filters.locationId));
        if (found) {
          locationName = found.name;
        } else {
          // locations state may be empty if page was refreshed; fetch from DB
          try {
            const res = await axios.get(
              `${process.env.REACT_APP_BACKEND_URL}/api/checklists/locations-by-category/${filters.categoryId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const loc = (res.data.locations || []).find(l => String(l.id) === String(filters.locationId));
            if (loc) locationName = loc.name;
          } catch (_) {}
        }
      }
      await checklistAPI.sendAnalyticsMail({
        to: emailForm.to,
        cc: emailForm.cc,
        subject: emailForm.subject,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        categoryId: filters.categoryId,
        locationId: filters.locationId,
        departmentId: filters.departmentId.join(','),
        locationName
      });
      toast.success('Email queued successfully');
      setEmailModal(false);
      setEmailForm({ to: '', cc: '', subject: '' });
    } catch {
      toast.error('Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const exportPPT = () => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    const brandColor = 'C50B34';
    const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const footerText = `Generated: ${generatedDate}  |  Virtual Audit System`;

    const addFooter = (slide) => {
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.0, w: '100%', h: 0.5, fill: { color: 'F3F4F6' } });
      slide.addText(footerText, { x: 0.5, y: 7.05, w: '90%', h: 0.4, fontSize: 8, color: '888888', align: 'center' });
    };

    const locationName = filters.locationId
      ? locations.find(l => String(l.id) === String(filters.locationId))?.name || 'All Locations'
      : 'All Locations';
    const dateRange = `${filters.fromDate}  to  ${filters.toDate}`;

    // Slide 1: Enhanced Title
    const slide1 = pptx.addSlide();
    slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.0, fill: { color: brandColor } });
    slide1.addText('VIRTUAL AUDIT', { x: 0, y: 0.15, w: '100%', h: 0.7, fontSize: 28, bold: true, color: 'FFFFFF', align: 'center', letterSpacing: 5 });
    slide1.addText(locationName, { x: 0.5, y: 1.8, w: '90%', fontSize: 36, bold: true, color: '333333', align: 'center' });
    slide1.addShape(pptx.ShapeType.rect, { x: 4.5, y: 2.9, w: 4.3, h: 0.04, fill: { color: brandColor } });
    slide1.addText(dateRange, { x: 0.5, y: 3.2, w: '90%', fontSize: 18, color: '777777', align: 'center' });
    addFooter(slide1);

    // Slide 2: Bar Chart with Total Items + NCs + NC% trend line
    if (chartData.length > 0) {
      const slide2 = pptx.addSlide();
      slide2.addText('NC Count by Department', { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: brandColor });
      const chartDataWithPct = chartData.map(d => ({ ...d, nc_percent: d.total_items > 0 ? parseFloat(((d.nc_count / d.total_items) * 100).toFixed(1)) : 0 }));
      const labels = chartDataWithPct.map(d => d.department);

      slide2.addChart(pptx.ChartType.bar, [
        { name: 'Total Items', labels, values: chartDataWithPct.map(d => d.total_items) },
        { name: 'Total NCs', labels, values: chartDataWithPct.map(d => d.nc_count) },
        { name: 'NC %', labels, values: chartDataWithPct.map(d => d.nc_percent) },
      ], {
        x: 0.5, y: 1.0, w: 12, h: 5.5,
        chartColors: ['94A3B8', 'C50B34', '2563EB'],
        barGrouping: 'clustered',
        showValue: true,
        valueFontSize: 8,
        catAxisLabelFontSize: 9,
        showLegend: true,
        legendPos: 't',
      });

      addFooter(slide2);
    }

    // Slide 3: Checklist Wise NC Closure table (with pagination)
    if (userStatusData.length > 0) {
      const hdrOpts = { bold: true, fill: brandColor, color: 'FFFFFF', align: 'center', fontSize: 10 };
      const headerRow = [{ text: 'Checklist', options: { ...hdrOpts, align: 'left' } }, { text: 'Department', options: { ...hdrOpts, align: 'left' } }, { text: 'Total', options: hdrOpts }, { text: 'Awaiting Sup.', options: hdrOpts }, { text: 'Awaiting Mgr.', options: hdrOpts }, { text: 'Completed', options: hdrOpts }];
      const rowsPerSlide = 20;
      const totalPages = Math.ceil(userStatusData.length / rowsPerSlide);
      
      for (let page = 0; page < totalPages; page++) {
        const slide3 = pptx.addSlide();
        const pageTitle = totalPages > 1 ? `Checklist Wise NC Closure (${page + 1}/${totalPages})` : 'Checklist Wise NC Closure';
        slide3.addText(pageTitle, { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: brandColor });
        
        const startIdx = page * rowsPerSlide;
        const endIdx = Math.min(startIdx + rowsPerSlide, userStatusData.length);
        const pageData = userStatusData.slice(startIdx, endIdx);
        
        const closureRows = [
          headerRow,
          ...pageData.map((d, i) => [
            { text: d.checklist_name || '', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: d.department_name || 'N/A', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: String(d.total_checklists), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: String(d.awaiting_supervisor), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: String(d.awaiting_manager), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: String(d.completed + d.completed_without_ncs), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
          ]),
        ];
        slide3.addTable(closureRows, { x: 0.3, y: 1.0, w: 12.5, fontSize: 10, border: { pt: 0.5, color: 'CCCCCC' }, colW: [3, 2.5, 1.4, 1.4, 1.4, 1.4] });
        addFooter(slide3);
      }
    }

    // Slide 4: Checklist NC Summary table (with pagination)
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
      const rowsPerSlide = 18;
      const totalPages = Math.ceil(ncSummaryData.length / rowsPerSlide);
      
      for (let page = 0; page < totalPages; page++) {
        const slide4 = pptx.addSlide();
        const pageTitle = totalPages > 1 ? `Checklist NC Summary (${page + 1}/${totalPages})` : 'Checklist NC Summary';
        slide4.addText(pageTitle, { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: brandColor });
        
        const startIdx = page * rowsPerSlide;
        const endIdx = Math.min(startIdx + rowsPerSlide, ncSummaryData.length);
        const pageData = ncSummaryData.slice(startIdx, endIdx);
        
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
        
        // Add total row only on the last page
        if (page === totalPages - 1) {
          const sumTotal = ncSummaryData.reduce((s, d) => s + d.total_nc, 0);
          const sumCritical = ncSummaryData.reduce((s, d) => s + d.critical_nc, 0);
          const sumNonCritical = ncSummaryData.reduce((s, d) => s + d.non_critical_nc, 0);
          const sumAccepted = ncSummaryData.reduce((s, d) => s + d.accepted_nc, 0);
          const sumRejected = ncSummaryData.reduce((s, d) => s + d.rejected_nc, 0);
          const sumCritAcc = ncSummaryData.reduce((s, d) => s + d.critical_accepted, 0);
          const sumCritRej = ncSummaryData.reduce((s, d) => s + d.critical_rejected, 0);
          const sumNonCritAcc = ncSummaryData.reduce((s, d) => s + d.non_critical_accepted, 0);
          const sumNonCritRej = ncSummaryData.reduce((s, d) => s + d.non_critical_rejected, 0);
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
        
        slide4.addTable(summaryRows, { x: 0.3, y: 1.0, w: 12.5, fontSize: 10, border: { pt: 0.5, color: 'CCCCCC' }, colW: [2.0, 1.4, 1.4, 0.8, 1.0, 1.0, 0.8, 0.8, 0.8, 0.8, 1.0, 1.0] });
        addFooter(slide4);
      }
    }

    // Slide 5: Weekly NC Comparison (with pagination)
    if (weeklyNCData.length > 0 && weeklyNCWeeks.length > 0) {
      const hdrOpts = { bold: true, fill: brandColor, color: 'FFFFFF', align: 'center', fontSize: 10 };
      const headerRow = [
        { text: 'Location', options: { ...hdrOpts, align: 'left' } },
        { text: 'Department', options: { ...hdrOpts, align: 'left' } },
        ...weeklyNCWeeks.map(w => ({ text: w.label, options: hdrOpts })),
        { text: 'Grand Total', options: hdrOpts },
      ];
      const rowsPerSlide = 20;
      const totalPages = Math.ceil(weeklyNCData.length / rowsPerSlide);
      
      for (let page = 0; page < totalPages; page++) {
        const slide5 = pptx.addSlide();
        const pageTitle = totalPages > 1 ? `Weekly NC Comparison by Location & Dept (${page + 1}/${totalPages})` : 'Weekly NC Comparison by Location & Dept';
        slide5.addText(pageTitle, { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: brandColor });
        
        const startIdx = page * rowsPerSlide;
        const endIdx = Math.min(startIdx + rowsPerSlide, weeklyNCData.length);
        const pageData = weeklyNCData.slice(startIdx, endIdx);
        
        const weeklyRows = [
          headerRow,
          ...pageData.map((row, i) => [
            { text: row.location || '', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            { text: row.department || '', options: { fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
            ...weeklyNCWeeks.map((_, wi) => ({ text: String(row[`week_${wi + 1}`] || 0), options: { align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } })),
            { text: String(row.grand_total || 0), options: { bold: true, align: 'center', fill: i % 2 ? 'F9FAFB' : 'FFFFFF' } },
          ]),
        ];
        
        // Add grand total row only on the last page
        if (page === totalPages - 1 && weeklyNCGrandTotal) {
          weeklyRows.push([
            { text: 'Grand Total', options: { bold: true, fill: 'E5E7EB' } },
            { text: '', options: { fill: 'E5E7EB' } },
            ...weeklyNCWeeks.map((_, wi) => ({ text: String(weeklyNCGrandTotal[`week_${wi + 1}`] || 0), options: { bold: true, align: 'center', fill: 'E5E7EB' } })),
            { text: String(weeklyNCGrandTotal.grand_total || 0), options: { bold: true, align: 'center', fill: 'E5E7EB' } },
          ]);
        }
        
        const locColW = 2.0;
        const deptColW = 2.0;
        const weekColW = weeklyNCWeeks.length > 0 ? parseFloat(((12.5 - locColW - deptColW - 1.2) / weeklyNCWeeks.length).toFixed(2)) : 1.5;
        slide5.addTable(weeklyRows, { x: 0.3, y: 1.0, w: 12.5, fontSize: 10, border: { pt: 0.5, color: 'CCCCCC' }, colW: [locColW, deptColW, ...weeklyNCWeeks.map(() => weekColW), 1.2] });
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

    pptx.writeFile({ fileName: `Virtual_Audit_${locationName.replace(/\s+/g, '_')}_${filters.fromDate}.pptx` })
      .then(() => toast.success('PPT exported successfully'))
      .catch(() => toast.error('PPT export failed'));
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Dashboard" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEmailModal(true)}
            className="px-4 py-2 text-sm font-medium text-white rounded-md flex items-center gap-2"
            style={{ background: '#C50B34' }}
          >
            <EnvelopeIcon className="h-4 w-4" />
            Email
          </button>
          <button
            onClick={exportPPT}
            className="px-4 py-2 text-sm font-medium text-white rounded-md flex items-center gap-2"
            style={{ background: '#C50B34' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" /></svg>
            Export PPT
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From</label>
            <input
              type="date"
              value={filters.fromDate}
              max={filters.toDate || undefined}
              onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#C50B34]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To</label>
            <input
              type="date"
              value={filters.toDate}
              min={filters.fromDate || undefined}
              onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#C50B34]"
            />
          </div>
          <div className="w-52">
            <SearchableSelect
              options={[{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
              value={filters.categoryId}
              onChange={(val) => {
                setFilters(prev => ({ ...prev, categoryId: val, locationId: '', departmentId: [] }));
                setLocations([]);
                setDepartments([]);
                fetchLocationsByCategory(val);
              }}
              placeholder="All Categories"
            />
          </div>
          <div className="w-52">
            <SearchableSelect
              options={[{ value: '', label: 'All Locations' }, ...locations.map(l => ({ value: l.id, label: l.name }))]}
              value={filters.locationId}
              onChange={(val) => {
                setFilters(prev => ({ ...prev, locationId: val, departmentId: [] }));
                setDepartments([]);
                fetchDepartmentsByCategoryLocation(filters.categoryId, val);
              }}
              placeholder={filters.categoryId ? 'All Locations' : 'Select category first'}
            />
          </div>
          <div className="w-64">
            <MultiSelectDropdown
              options={departments.map(d => ({ value: d.id, label: d.name }))}
              selected={filters.departmentId}
              onChange={(val) => setFilters(prev => ({ ...prev, departmentId: val }))}
              placeholder={filters.locationId ? 'All Departments' : 'Select location first'}
            />
          </div>
          <button
            onClick={handleApply}
            disabled={chartLoading}
            className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
            style={{ background: '#C50B34' }}
          >
            {chartLoading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total NCs', value: totalNCs, bg: 'bg-primary-50', border: 'border-primary-500/20', text: 'text-primary-700' },
          { label: 'Critical NCs', value: totalCritical, bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-800' },
          { label: 'Non-Critical NCs', value: totalNonCritical, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-400' },
        ].map((card, i) => (
          <div key={i} className={`${card.bg} border ${card.border} rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-1`}>
            <div className={`text-3xl font-bold ${card.text}`}>{card.value}</div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{card.label}</div>
          </div>
        ))}
      </div>

      {/* NC Analysis Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">NC Count by Department</h2>
        {chartData.length > 0 ? (
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(600, chartData.length * 90) }}>
              <ResponsiveContainer width="100%" height={520}>
                <ComposedChart data={chartData.map(d => ({ ...d, nc_percent: d.total_items > 0 ? parseFloat(((d.nc_count / d.total_items) * 100).toFixed(1)) : 0 }))} margin={{ top: 30, right: 60, left: 20, bottom: 80 }}>
                  <defs>
                    <linearGradient id="gradTotalItems" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="gradNCs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#fca5a5" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="gradLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <filter id="barShadow" x="-2%" y="-2%" width="104%" height="110%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000020" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="department" angle={-35} textAnchor="end" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, dataMax => Math.max(dataMax + 2, 10)]} tickCount={Math.max(chartData.reduce((m, d) => Math.max(m, d.total_items), 0) + 3, 11)} label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} unit="%" label={{ value: 'NC %', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#94a3b8' } }} axisLine={false} tickLine={false} />
                  {/* <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', padding: '12px 16px' }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4, color: '#1e293b' }}
                    itemStyle={{ fontSize: 12 }}
                    cursor={{ fill: 'rgba(99,102,241,0.04)' }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16, fontSize: 12 }} /> */}
                  <Bar yAxisId="left" dataKey="total_items" name="Total Items" fill="url(#gradTotalItems)" radius={[8, 8, 0, 0]} barSize={28} filter="url(#barShadow)" animationDuration={800} animationEasing="ease-out" label={{ position: 'top', fontSize: 9, fill: '#64748b', fontWeight: 500 }} minPointSize={8} />
                  <Bar yAxisId="left" dataKey="nc_count" name="Total NCs" fill="url(#gradNCs)" radius={[8, 8, 0, 0]} barSize={28} filter="url(#barShadow)" animationDuration={1000} animationEasing="ease-out" label={{ position: 'top', fontSize: 9, fill: '#dc2626', fontWeight: 600 }} minPointSize={8} />
                  <Line yAxisId="right" type="natural" dataKey="nc_percent" name="NC %" stroke="url(#gradLine)" strokeWidth={3} dot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 3 }} activeDot={{ r: 8, fill: '#6366f1', stroke: '#fff', strokeWidth: 3 }} animationDuration={1200} animationEasing="ease-in-out" label={{ position: 'top', fontSize: 10, fill: '#6366f1', fontWeight: 600, formatter: (v) => `${v}%` }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
            {chartLoading ? 'Loading chart data...' : 'No NC data found for selected filters'}
          </div>
        )}
      </div>

      {/* Checklist Wise NC Closure: Table Left, Pie Right */}
      <div className="bg-white rounded-lg border border-gray-200 min-h-[300px]">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">Checklist Wise NC Closure</h2>
        </div>
        {userStatusLoading ? (
          <div className="p-4 text-center text-gray-400 text-xs">Loading...</div>
        ) : userStatusData.length > 0 ? (
          <div className="grid grid-cols-3 gap-4 p-4">
            <div className="col-span-2 overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="min-w-full">
                <thead style={{ backgroundColor: '#efeeee' }} className="border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Checklist</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Department</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Total</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Awaiting Sup.</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Awaiting Mgr.</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {userStatusData.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-xs text-gray-900">{item.checklist_name}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{item.department_name || 'N/A'}</td>
                      <td className="px-3 py-2 text-xs text-center text-gray-900">{item.total_checklists}</td>
                      <td className="px-3 py-2 text-xs text-center">
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{item.awaiting_supervisor}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-center">
                        <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{item.awaiting_manager}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-center">
                        <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{item.completed + item.completed_without_ncs}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center justify-center">
              {(() => {
                const totalSup = userStatusData.reduce((s, d) => s + d.awaiting_supervisor, 0);
                const totalMgr = userStatusData.reduce((s, d) => s + d.awaiting_manager, 0);
                const totalComp = userStatusData.reduce((s, d) => s + d.completed + d.completed_without_ncs, 0);
                const pieData = [
                  { name: 'Awaiting Sup.', value: totalSup },
                  { name: 'Awaiting Mgr.', value: totalMgr },
                  { name: 'Completed', value: totalComp },
                ].filter(d => d.value > 0);
                const colors = ['#f59e0b', '#f97316', '#22c55e'];
                return (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} cornerRadius={6} label={({ name, value }) => `${name}: ${value}`} labelLine={false} style={{ fontSize: 10 }}>
                        {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-gray-400 text-xs">No data found</div>
        )}
      </div>

      {/* Checklist NC Summary: Pie Left, Table Right */}
      <div className="bg-white rounded-lg border border-gray-200 min-h-[300px]">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">Checklist NC Summary</h2>
        </div>
        {ncSummaryLoading ? (
          <div className="p-4 text-center text-gray-400 text-xs">Loading...</div>
        ) : ncSummaryData.length > 0 ? (
          <div className="grid grid-cols-3 gap-4 p-4">
            <div className="flex flex-col items-center justify-center">
              {(() => {
                const totalCrit = ncSummaryData.reduce((s, d) => s + d.critical_nc, 0);
                const totalNonCrit = ncSummaryData.reduce((s, d) => s + d.non_critical_nc, 0);
                const totalAccepted = ncSummaryData.reduce((s, d) => s + d.accepted_nc, 0);
                const totalRejected = ncSummaryData.reduce((s, d) => s + d.rejected_nc, 0);
                const pieData = [
                  { name: 'Critical', value: totalCrit },
                  { name: 'Non-Critical', value: totalNonCrit },
                  { name: 'Accepted', value: totalAccepted },
                  { name: 'Rejected', value: totalRejected },
                ].filter(d => d.value > 0);
                const colors = ['#f87171', '#4ade80', '#60a5fa', '#fbbf24'];
                return (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} cornerRadius={6} label={({ name, value }) => `${name}: ${value}`} labelLine={false} style={{ fontSize: 10 }}>
                        {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
            <div className="col-span-2 overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="min-w-full">
                <thead style={{ backgroundColor: '#efeeee' }} className="border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Checklist</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Supervisor</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Manager</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Total</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Critical</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Non-Critical</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Crit. Acc</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Crit. Rej</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">NCrit. Acc</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">NCrit. Rej</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Accepted</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Rejected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ncSummaryData.map((item, i) => {
                    const acceptedPct = item.total_nc > 0 ? ((item.accepted_nc / item.total_nc) * 100).toFixed(1) : 0;
                    const rejectedPct = item.total_nc > 0 ? ((item.rejected_nc / item.total_nc) * 100).toFixed(1) : 0;
                    return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-xs text-gray-900">{item.checklist_name}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{item.supervisor_name}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{item.manager_name}</td>
                      <td className="px-3 py-2 text-xs text-center font-medium text-gray-900">{item.total_nc}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex items-center justify-center gap-1">
                          <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{item.critical_nc}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex items-center justify-center gap-1">
                          <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{item.non_critical_nc}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-center font-medium text-gray-900">{item.critical_accepted}</td>
                      <td className="px-3 py-2 text-xs text-center font-medium text-gray-900">{item.critical_rejected}</td>
                      <td className="px-3 py-2 text-xs text-center font-medium text-gray-900">{item.non_critical_accepted}</td>
                      <td className="px-3 py-2 text-xs text-center font-medium text-gray-900">{item.non_critical_rejected}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex items-center justify-center gap-1">
                          <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{item.accepted_nc}</span>
                          <span className="text-gray-400">({acceptedPct}%)</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex items-center justify-center gap-1">
                          <span className="px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{item.rejected_nc}</span>
                          <span className="text-gray-400">({rejectedPct}%)</span>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0">
                  {(() => {
                    const sumTotal = ncSummaryData.reduce((s, d) => s + d.total_nc, 0);
                    const sumCritical = ncSummaryData.reduce((s, d) => s + d.critical_nc, 0);
                    const sumNonCritical = ncSummaryData.reduce((s, d) => s + d.non_critical_nc, 0);
                    const sumCritAcc = ncSummaryData.reduce((s, d) => s + d.critical_accepted, 0);
                    const sumCritRej = ncSummaryData.reduce((s, d) => s + d.critical_rejected, 0);
                    const sumNonCritAcc = ncSummaryData.reduce((s, d) => s + d.non_critical_accepted, 0);
                    const sumNonCritRej = ncSummaryData.reduce((s, d) => s + d.non_critical_rejected, 0);
                    const sumAccepted = ncSummaryData.reduce((s, d) => s + d.accepted_nc, 0);
                    const sumRejected = ncSummaryData.reduce((s, d) => s + d.rejected_nc, 0);
                    return (
                      <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                        <td className="px-3 py-2 text-xs text-gray-900">Total</td>
                        <td className="px-3 py-2 text-xs text-gray-600"></td>
                        <td className="px-3 py-2 text-xs text-gray-600"></td>
                        <td className="px-3 py-2 text-xs text-center text-gray-900">{sumTotal}</td>
                        <td className="px-3 py-2 text-xs text-center text-red-700">{sumCritical}</td>
                        <td className="px-3 py-2 text-xs text-center text-green-700">{sumNonCritical}</td>
                        <td className="px-3 py-2 text-xs text-center text-gray-900">{sumCritAcc}</td>
                        <td className="px-3 py-2 text-xs text-center text-gray-900">{sumCritRej}</td>
                        <td className="px-3 py-2 text-xs text-center text-gray-900">{sumNonCritAcc}</td>
                        <td className="px-3 py-2 text-xs text-center text-gray-900">{sumNonCritRej}</td>
                        <td className="px-3 py-2 text-xs text-center text-blue-700">{sumAccepted}</td>
                        <td className="px-3 py-2 text-xs text-center text-yellow-700">{sumRejected}</td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-gray-400 text-xs">No data found</div>
        )}
      </div>
      {/* Weekly NC Report */}
      <div className="bg-white rounded-lg border border-gray-200 min-h-[300px]">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="text-sm font-medium text-gray-700">Weekly NC Comparison by Location & Department</h2>
          {weeklyNCWeeks.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {weeklyNCWeeks.map((w, i) => (
                <span key={i} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {w.label}: {w.start} – {w.end}
                </span>
              ))}
            </div>
          )}
        </div>
        {weeklyNCLoading ? (
          <div className="p-4 text-center text-gray-400 text-xs">Loading...</div>
        ) : weeklyNCData.length > 0 ? (
          <div className="p-4">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="min-w-full">
                <thead style={{ backgroundColor: '#efeeee' }} className="border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Location</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Department</th>
                    {weeklyNCWeeks.map((w, i) => (
                      <th key={i} className="px-3 py-2 text-center text-xs font-medium text-gray-700">{w.label}</th>
                    ))}
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {weeklyNCData.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-xs text-gray-900 font-medium">{row.location}</td>
                      <td className="px-3 py-2 text-xs text-gray-900 font-medium">{row.department}</td>
                      {weeklyNCWeeks.map((_, wi) => (
                        <td key={wi} className="px-3 py-2 text-xs text-center text-gray-700">{row[`week_${wi + 1}`] || 0}</td>
                      ))}
                      <td className="px-3 py-2 text-xs text-center font-semibold text-gray-900">{row.grand_total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0">
                  {weeklyNCGrandTotal && (
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td className="px-3 py-2 text-xs text-gray-900">Grand Total</td>
                      <td className="px-3 py-2 text-xs text-gray-900"></td>
                      {weeklyNCWeeks.map((_, wi) => (
                        <td key={wi} className="px-3 py-2 text-xs text-center text-gray-900">{weeklyNCGrandTotal[`week_${wi + 1}`] || 0}</td>
                      ))}
                      <td className="px-3 py-2 text-xs text-center text-gray-900">{weeklyNCGrandTotal.grand_total}</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-gray-400 text-xs">No data found</div>
        )}
      </div>
    </div>

    {/* Email Modal */}
    {emailModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Send Analytics Report via Email</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={emailForm.to}
                onChange={e => setEmailForm(p => ({ ...p, to: e.target.value }))}
                placeholder="email@example.com, email2@example.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#C50B34]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CC</label>
              <input
                type="text"
                value={emailForm.cc}
                onChange={e => setEmailForm(p => ({ ...p, cc: e.target.value }))}
                placeholder="cc@example.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#C50B34]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => { setEmailModal(false); setEmailForm({ to: '', cc: '', subject: '' }); }}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendEmail}
              disabled={emailSending}
              className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 flex items-center gap-2"
              style={{ background: '#C50B34' }}
            >
              <EnvelopeIcon className="h-4 w-4" />
              {emailSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default AdminAnalyticsDashboard;
