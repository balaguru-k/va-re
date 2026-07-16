import React, { useState, useEffect } from 'react';
import api from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx-js-style';
import { useAuth } from '../contexts/AuthContext';

const today = new Date().toISOString().split('T')[0];
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const pct = (count, total) => total > 0 ? ((Number(count) / Number(total)) * 100).toFixed(0) + '%' : '0%';

const ComplianceTicketsReport = () => {
  const { user } = useAuth();
  const isViewer = user?.role === 'Viewer';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ fromDate: monthStart, toDate: today, division: '', location: '', department: '', userIds: [] });
  const [divisions, setDivisions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = React.useRef(null);
  const [completedModal, setCompletedModal] = useState({ open: false, tickets: [], title: '' });
  const [mailModal, setMailModal] = useState({ open: false, to: '', cc: '', sending: false, attachments: [] });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchReport();
    Promise.all([
      api.get('/compliance/masters/categories'),
      api.get('/compliance/masters/locations-list'),
      api.get('/compliance/masters/departments-list'),
      api.get('/tickets/raise/users'),
    ]).then(([divRes, locRes, deptRes, usersRes]) => {
      setDivisions(divRes.data.data?.divisions || []);
      setLocations(locRes.data.data?.locations || []);
      setDepartments(deptRes.data.data?.departments || []);
      // Combine admin users + compliance users (vendor/engineer)
      const complianceUsers = usersRes.data.data?.allUsers || [];
      setUsers(complianceUsers);
    }).catch(() => {});
  }, []);

  const fetchReport = async (overrideFilters) => {
    setLoading(true);
    const f = overrideFilters || filters;
    try {
      const params = new URLSearchParams();
      if (f.fromDate) params.append('fromDate', f.fromDate);
      if (f.toDate) params.append('toDate', f.toDate);
      if (f.division) params.append('division', f.division);
      if (f.location) params.append('location', f.location);
      if (f.department) params.append('department', f.department);
      if (f.userIds.length) params.append('userId', f.userIds.join(','));

      const [reportRes, completedRes] = await Promise.all([
        api.get(`/tickets/report?${params}`),
        api.get(`/tickets/completed?${params}`),
      ]);

      const data = reportRes.data.data?.rows || [];
      const allCompleted = completedRes.data.data?.tickets || [];

      // Group completed tickets by location
      const completedByLocation = {};
      allCompleted.forEach(t => {
        const loc = t.location || '-';
        if (!completedByLocation[loc]) completedByLocation[loc] = [];
        completedByLocation[loc].push(t);
      });

      setRows(data.map(r => ({
        location: r.location || '-',
        division: r.division || '-',
        totalCameras: Number(r.total_cameras) || 0,
        totalIssues: Number(r.total_issues) || 0,
        completedCount: Number(r.completed_count) || 0,
        internet: Number(r.internet_count) || 0,
        power: Number(r.power_count) || 0,
        hardware: Number(r.hardware_count) || 0,
        software: Number(r.software_count) || 0,
        completedTickets: completedByLocation[r.location || '-'] || [],
      })));
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedTickets = async (location, tickets) => {
    setCompletedModal({ open: true, tickets, title: location });
  };

  const handleSendMail = async () => {
    setMailModal(p => ({ ...p, sending: true }));
    try {
      const formData = new FormData();
      formData.append('to', mailModal.to);
      if (mailModal.cc) formData.append('cc', mailModal.cc);
      if (filters.fromDate) formData.append('fromDate', filters.fromDate);
      if (filters.toDate) formData.append('toDate', filters.toDate);
      if (filters.division) formData.append('division', filters.division);
      if (filters.location) formData.append('location', filters.location);
      if (filters.department) formData.append('department', filters.department);
      if (filters.userIds.length) formData.append('userId', filters.userIds.join(','));
      mailModal.attachments.forEach(f => formData.append('attachments', f));

      await api.post('/tickets/report/send-mail', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Email queued successfully');
      setMailModal({ open: false, to: '', cc: '', sending: false, attachments: [] });
    } catch {
      toast.error('Failed to queue email');
      setMailModal(p => ({ ...p, sending: false }));
    }
  };

  const totals = rows.reduce((acc, r) => ({
    totalCameras: acc.totalCameras + r.totalCameras,
    totalIssues: acc.totalIssues + r.totalIssues,
    internet: acc.internet + r.internet,
    power: acc.power + r.power,
    hardware: acc.hardware + r.hardware,
    software: acc.software + r.software,
  }), { totalCameras: 0, totalIssues: 0, internet: 0, power: 0, hardware: 0, software: 0 });

  const thClass = 'px-3 py-3 text-center text-xs font-semibold text-gray-700 border border-gray-300 whitespace-nowrap';
  const tdClass = 'px-3 py-2 text-sm text-center text-gray-900 border border-gray-200';
  const tdLeft = 'px-3 py-2 text-sm text-left text-gray-900 border border-gray-200';

  return (
    <div className="space-y-6">
      <PageHeader title="Tickets Report" />

      <div className="bg-white border border-gray-200 rounded-lg px-5 py-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input type="date" value={filters.fromDate} max={filters.toDate || today}
              onChange={e => setFilters(p => ({ ...p, fromDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input type="date" value={filters.toDate} min={filters.fromDate || undefined} max={today}
              onChange={e => setFilters(p => ({ ...p, toDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Division</label>
            <select value={filters.division} onChange={e => setFilters(p => ({ ...p, division: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400">
              <option value="">All Divisions</option>
              {divisions.map((d, i) => <option key={i} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <select value={filters.location} onChange={e => setFilters(p => ({ ...p, location: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400">
              <option value="">All Locations</option>
              {locations.map((l, i) => <option key={i} value={l.name}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
            <select value={filters.department} onChange={e => setFilters(p => ({ ...p, department: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400">
              <option value="">All Departments</option>
              {departments.map((d, i) => <option key={i} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div className="relative" ref={userDropdownRef}>
            <label className="block text-xs font-medium text-gray-600 mb-1">User</label>
            <div className="relative">
              <div
                className="min-w-[180px] px-3 py-2 text-sm border border-gray-300 rounded-md cursor-pointer bg-white flex flex-wrap gap-1 items-center"
                onClick={() => setUserDropdownOpen(p => !p)}
              >
                {filters.userIds.length === 0 ? (
                  <span className="text-gray-400">All Users</span>
                ) : (
                  filters.userIds.map(id => {
                    const u = users.find(x => x.id === id);
                    return u ? (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                        {u.name}
                        <button type="button" onClick={e => { e.stopPropagation(); setFilters(p => ({ ...p, userIds: p.userIds.filter(x => x !== id) })); }}>×</button>
                      </span>
                    ) : null;
                  })
                )}
              </div>
              {userDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[220px] max-h-48 overflow-y-auto">
                  {users.map(u => (
                    <div key={u.id}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${
                        filters.userIds.includes(u.id) ? 'bg-red-50 text-red-700' : 'text-gray-700'
                      }`}
                      onClick={() => setFilters(p => ({
                        ...p,
                        userIds: p.userIds.includes(u.id) ? p.userIds.filter(x => x !== u.id) : [...p.userIds, u.id]
                      }))}
                    >
                      <span className={`w-4 h-4 border rounded flex items-center justify-center text-xs ${
                        filters.userIds.includes(u.id) ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300'
                      }`}>{filters.userIds.includes(u.id) ? '✓' : ''}</span>
                      <span>{u.name} <span className="text-gray-400">({u.role})</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => fetchReport()} disabled={loading}
            className="px-5 py-2 text-xs font-medium text-white bg-btn-primary rounded hover:opacity-90 disabled:opacity-50">
            {loading ? 'Loading...' : 'Apply'}
          </button>
          <button onClick={() => { const reset = { fromDate: monthStart, toDate: today, division: '', location: '', department: '', userIds: [] }; setFilters(reset); setUserDropdownOpen(false); fetchReport(reset); }}
            className="px-4 py-2 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded">
            Reset
          </button>
          {!isViewer && <button
            onClick={() => setMailModal({ open: true, to: '', cc: '', sending: false, attachments: [] })}
            disabled={!rows.length}
            className="px-4 py-2 text-xs font-medium text-white rounded disabled:opacity-50"
            style={{ background: '#C50B34' }}>
            Send Mail
          </button>}
          <button
            onClick={() => {
              if (!rows.length) return;
              const fmt = (count, total) => `${count} (${pct(count, total)})`;
              // Row 1: empty, Row 2: group headers, Row 3: sub-headers
              const emptyRow = ['', '', '', '', '', '', '', '', '', '', ''];
              const header1 = ['S.No', 'Location', 'Division', 'Tickets Count', 'Completed Count', 'Total Camera Count', 'Total Camera Issue', 'Total Camera Issue %', 'Offline', '', 'Device', '', 'Remarks'];
              const header2 = ['', '', '', '', '', '', '', '', 'Internet (ISP Vendor In %)', 'Power (Power In %)', 'Hardware (H/W Vendor In %)', 'Software (S/W Vendor In %)', ''];
              const dataRows = rows.map((row, i) => [
                i + 1, row.location, row.division, row.totalIssues,
                row.completedCount, row.totalCameras, row.totalIssues,
                pct(row.totalIssues, row.totalCameras),
                fmt(row.internet, row.totalIssues), fmt(row.power, row.totalIssues),
                fmt(row.hardware, row.totalIssues), fmt(row.software, row.totalIssues),
                row.completedTickets.map((t, idx) => {
                  const parts = [];
                  if (t.status_remarks) parts.push(`Admin: ${t.status_remarks}`);
                  if (t.vendor_remarks) parts.push(`Vendor: ${t.vendor_remarks}`);
                  if (t.engineer_remarks) parts.push(`Engineer: ${t.engineer_remarks}`);
                  return `${idx + 1}. ${parts.join(', ') || '-'}`;
                }).join('\n') || '-',
              ]);
              const totalsRow = [
                '', 'Total', '', totals.totalIssues,
                rows.reduce((a, r) => a + r.completedCount, 0), totals.totalCameras, totals.totalIssues,
                pct(totals.totalIssues, totals.totalCameras),
                fmt(totals.internet, totals.totalIssues), fmt(totals.power, totals.totalIssues),
                fmt(totals.hardware, totals.totalIssues), fmt(totals.software, totals.totalIssues), '',
              ];
              const aoa = [emptyRow, header1, header2, ...dataRows, totalsRow];
              const ws = XLSX.utils.aoa_to_sheet(aoa);
              ws['!merges'] = [
                { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
                { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
                { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
                { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },
                { s: { r: 1, c: 4 }, e: { r: 2, c: 4 } },
                { s: { r: 1, c: 5 }, e: { r: 2, c: 5 } },
                { s: { r: 1, c: 6 }, e: { r: 2, c: 6 } },
                { s: { r: 1, c: 7 }, e: { r: 2, c: 7 } },
                { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } },
                { s: { r: 1, c: 10 }, e: { r: 1, c: 11 } },
                { s: { r: 1, c: 12 }, e: { r: 2, c: 12 } },
              ];
              ws['!cols'] = [4, 18, 15, 10, 10, 12, 10, 12, 12, 12, 12, 12, 22].map(w => ({ wch: w }));
              const b = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
              const styleGrayHeader = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '374151' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: b };
              const styleBlueHeader = { font: { bold: true }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: b };
              const styleGreenHeader = { font: { bold: true }, fill: { fgColor: { rgb: 'DCFCE7' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: b };
              const styleBlueCell = { fill: { fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: b };
              const styleGreenCell = { fill: { fgColor: { rgb: 'F0FDF4' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: b };
              const styleNormal = { alignment: { horizontal: 'center', vertical: 'center' }, border: b };
              const styleNormalLeft = { alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: b };
              const styleTotals = { font: { bold: true }, fill: { fgColor: { rgb: 'D1D5DB' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: b };
              const styleTotalsLeft = { font: { bold: true }, fill: { fgColor: { rgb: 'D1D5DB' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: b };
              const cols = ['A','B','C','D','E','F','G','H','I','J','K','L','M'];
              [styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleBlueHeader,styleBlueHeader,styleGreenHeader,styleGreenHeader,styleGrayHeader]
                .forEach((s, ci) => { if (ws[`${cols[ci]}2`]) ws[`${cols[ci]}2`].s = s; });
              [styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleGrayHeader,styleBlueHeader,styleBlueHeader,styleGreenHeader,styleGreenHeader,styleGrayHeader]
                .forEach((s, ci) => { if (ws[`${cols[ci]}3`]) ws[`${cols[ci]}3`].s = s; });
              const colStyles = [styleNormal, styleNormalLeft, styleNormalLeft, styleNormal, styleNormal, styleNormal, styleNormal, styleNormal, styleBlueCell, styleBlueCell, styleGreenCell, styleGreenCell, styleNormalLeft];
              rows.forEach((_, ri) => {
                colStyles.forEach((s, ci) => { const cell = ws[`${cols[ci]}${ri + 4}`]; if (cell) cell.s = s; });
              });
              const totalsRowIdx = rows.length + 4;
              [styleTotals,styleTotalsLeft,styleTotals,styleTotals,styleTotals,styleTotals,styleTotals,styleTotals,styleTotals,styleTotals,styleTotals,styleTotals,styleTotals]
                .forEach((s, ci) => { const cell = ws[`${cols[ci]}${totalsRowIdx}`]; if (cell) cell.s = s; });

              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Tickets Report');
              const exportDate = new Date().toISOString().split('T')[0];

              // Sheet 2: Completed Tickets
              const allCompleted = rows.flatMap(r => r.completedTickets.map(t => ({ ...t, divisionName: r.division })));
              if (allCompleted.length > 0) {
                const ctHeader = ['S.No', 'Division', 'Ticket #', 'Issue', 'Location', 'Department', 'Raised By', 'Admin Remarks', 'Vendor Remarks', 'Engineer Remarks'];
                const ctRows = allCompleted.map((t, i) => [
                  i + 1, t.divisionName, t.ticket_number || '-', t.issue || '-',
                  t.location || '-', t.department || '-', t.raised_by || '-',
                  t.status_remarks || '-', t.vendor_remarks || '-', t.engineer_remarks || '-',
                ]);
                const ws2 = XLSX.utils.aoa_to_sheet([ctHeader, ...ctRows]);
                ws2['!cols'] = [4, 14, 10, 20, 12, 12, 12, 22, 22, 22].map(w => ({ wch: w }));
                const hStyle2 = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '374151' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: b };
                const dStyle2 = { alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: b };
                ctHeader.forEach((_, ci) => { const cell = ws2[XLSX.utils.encode_cell({ r: 0, c: ci })]; if (cell) cell.s = hStyle2; });
                ctRows.forEach((_, ri) => { ctHeader.forEach((__, ci) => { const cell = ws2[XLSX.utils.encode_cell({ r: ri + 1, c: ci })]; if (cell) cell.s = dStyle2; }); });
                XLSX.utils.book_append_sheet(wb, ws2, 'Completed Tickets');
              }

              XLSX.writeFile(wb, `Ticket Report ${exportDate}.xlsx`);
            }}
            disabled={!rows.length}
            className="px-4 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50">
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white border border-red-100 rounded-lg">
        <div className="overflow-x-auto scroll-container">
          <table className="min-w-full border-collapse">
            <thead>
              {/* Group header row */}
              <tr style={{ backgroundColor: '#ededed' }}>
                <th className={thClass} rowSpan={2}>S.No</th>
                <th className={thClass} rowSpan={2}>Location</th>
                <th className={thClass} rowSpan={2}>Division</th>
                <th className={thClass} rowSpan={2}>Tickets Count</th>
                <th className={thClass} rowSpan={2}>Completed Count</th>
                <th className={thClass} rowSpan={2}>Total Camera Count</th>
                <th className={thClass} rowSpan={2}>Total Camera Issue</th>
                <th className={thClass} rowSpan={2}>Total Camera Issue %</th>
                <th className={`${thClass} bg-blue-50`} colSpan={2}>Offline</th>
                <th className={`${thClass} bg-green-50`} colSpan={2}>Device</th>
                <th className={thClass} rowSpan={2}>Remarks</th>
              </tr>
              {/* Sub-header row */}
              <tr style={{ backgroundColor: '#ededed' }}>
                <th className={`${thClass} bg-blue-50`}>Internet<br/><span className="font-normal text-gray-500">(ISP Vendor In %)</span></th>
                <th className={`${thClass} bg-blue-50`}>Power<br/><span className="font-normal text-gray-500">(Power In %)</span></th>
                <th className={`${thClass} bg-green-50`}>Hardware<br/><span className="font-normal text-gray-500">(H/W Vendor In %)</span></th>
                <th className={`${thClass} bg-green-50`}>Software<br/><span className="font-normal text-gray-500">(S/W Vendor In %)</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="12" className="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="12" className="px-4 py-6 text-center text-gray-500">No data found</td></tr>
              ) : rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className={tdClass}>{i + 1}</td>
                  <td className={tdLeft}>{row.location}</td>
                  <td className={tdLeft}>{row.division}</td>
                  <td className={tdClass}>{row.totalIssues}</td>
                  <td className={`${tdClass} cursor-pointer hover:bg-blue-50 text-blue-600 font-medium`} onClick={() => row.completedCount > 0 && fetchCompletedTickets(row.location, row.completedTickets)}>
                    {row.completedCount}
                  </td>
                  <td className={tdClass}>{row.totalCameras}</td>
                  <td className={tdClass}>{row.totalIssues}</td>
                  <td className={tdClass}>{pct(row.totalIssues, row.totalCameras)}</td>
                  <td className="px-3 py-2 text-sm text-center border border-gray-200 bg-blue-50">
                    <div className="font-medium">{row.internet}</div>
                    <div className="text-xs text-gray-500">{pct(row.internet, row.totalIssues)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-center border border-gray-200 bg-blue-50">
                    <div className="font-medium">{row.power}</div>
                    <div className="text-xs text-gray-500">{pct(row.power, row.totalIssues)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-center border border-gray-200 bg-green-50">
                    <div className="font-medium">{row.hardware}</div>
                    <div className="text-xs text-gray-500">{pct(row.hardware, row.totalIssues)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-center border border-gray-200 bg-green-50">
                    <div className="font-medium">{row.software}</div>
                    <div className="text-xs text-gray-500">{pct(row.software, row.totalIssues)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-left text-gray-900 border border-gray-200 min-w-[280px] max-w-[320px]">
                    <div className="max-h-32 overflow-y-auto pr-1">
                      {row.completedTickets.length === 0 ? <span className="text-gray-400">-</span> : row.completedTickets.map((t, idx) => (
                        <div key={t.id} className="text-xs text-gray-700 mb-2 pb-2 border-b border-gray-100 last:border-0 last:mb-0">
                          <span className="font-semibold text-gray-500">{idx + 1}. </span>
                          <span className="text-gray-400 text-xs">[{t.ticket_number || `#${t.id}`}]</span>
                          {t.status_remarks && <div className="ml-2"><span className="font-semibold text-gray-800">Admin:</span> {t.status_remarks}</div>}
                          {t.vendor_remarks && <div className="ml-2"><span className="font-semibold text-blue-700">Vendor:</span> {t.vendor_remarks}</div>}
                          {t.engineer_remarks && <div className="ml-2"><span className="font-semibold text-green-700">Engineer:</span> {t.engineer_remarks}</div>}
                          {!t.status_remarks && !t.vendor_remarks && !t.engineer_remarks && <span className="ml-2 text-gray-400">-</span>}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: '#ededed' }} className="border-t-2 border-gray-300 font-semibold">
                  <td className={tdClass}></td>
                  <td className={`${tdLeft} font-bold`}>Total</td>
                  <td className={tdClass}></td>
                  <td className={tdClass}>{totals.totalIssues}</td>
                  <td className={tdClass}>{rows.reduce((a, r) => a + r.completedCount, 0)}</td>
                  <td className={tdClass}>{totals.totalCameras}</td>
                  <td className={tdClass}>{totals.totalIssues}</td>
                  <td className={tdClass}>{pct(totals.totalIssues, totals.totalCameras)}</td>
                  <td className="px-3 py-2 text-sm text-center border border-gray-200 font-bold">
                    <div>{totals.internet}</div>
                    <div className="text-xs font-normal">{pct(totals.internet, totals.totalIssues)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-center border border-gray-200 font-bold">
                    <div>{totals.power}</div>
                    <div className="text-xs font-normal">{pct(totals.power, totals.totalIssues)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-center border border-gray-200 font-bold">
                    <div>{totals.hardware}</div>
                    <div className="text-xs font-normal">{pct(totals.hardware, totals.totalIssues)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-center border border-gray-200 font-bold">
                    <div>{totals.software}</div>
                    <div className="text-xs font-normal">{pct(totals.software, totals.totalIssues)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-200 min-w-[300px]"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Completed Tickets Modal */}
      {completedModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Completed Tickets - {completedModal.title}</h3>
              <button onClick={() => setCompletedModal({ open: false, tickets: [], title: '' })} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {completedModal.tickets.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No completed tickets found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">S.No</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">Ticket #</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">Issue</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">Location</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">Department</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">Raised By</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-200">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedModal.tickets.map((t, i) => (
                        <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-sm text-gray-900 border border-gray-200">{i + 1}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 border border-gray-200 font-medium">{t.ticket_number || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 border border-gray-200">{t.issue || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 border border-gray-200">{t.location || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 border border-gray-200">{t.department || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 border border-gray-200">{t.raised_by || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-700 border border-gray-200">
                            {t.status_remarks && <div className="mb-1"><span className="font-semibold">Admin:</span> {t.status_remarks}</div>}
                            {t.vendor_remarks && <div className="mb-1"><span className="font-semibold">Vendor:</span> {t.vendor_remarks}</div>}
                            {t.engineer_remarks && <div className="mb-1"><span className="font-semibold">Engineer:</span> {t.engineer_remarks}</div>}
                            {!t.status_remarks && !t.vendor_remarks && !t.engineer_remarks && '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Send Mail Modal */}
      {mailModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Send Tickets Report</h3>
              <button onClick={() => setMailModal({ open: false, to: '', cc: '', sending: false, attachments: [] })} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={mailModal.to}
                  onChange={e => setMailModal(p => ({ ...p, to: e.target.value }))}
                  placeholder="email1@example.com, email2@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CC <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={mailModal.cc}
                  onChange={e => setMailModal(p => ({ ...p, cc: e.target.value }))}
                  placeholder="email1@example.com, email2@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachments <span className="text-gray-400 font-normal">(optional)</span></label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-md p-3 text-center cursor-pointer hover:border-red-400 transition-colors"
                  onClick={() => document.getElementById('mail-attachments').click()}
                >
                  {mailModal.attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {mailModal.attachments.map((file, i) => (
                        <div key={i} className="relative inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                          {file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name}
                          <button type="button" onClick={e => { e.stopPropagation(); setMailModal(p => ({ ...p, attachments: p.attachments.filter((_, idx) => idx !== i) })); }}
                            className="text-red-500 hover:text-red-700 font-bold">×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Click to select files</p>
                  )}
                  <input id="mail-attachments" type="file" multiple className="hidden"
                    onChange={e => { setMailModal(p => ({ ...p, attachments: [...p.attachments, ...Array.from(e.target.files)] })); e.target.value = ''; }} />
                </div>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setMailModal({ open: false, to: '', cc: '', sending: false, attachments: [] })}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSendMail} disabled={mailModal.sending || !mailModal.to.trim()}
                className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 hover:opacity-90"
                style={{ background: '#C50B34' }}>
                {mailModal.sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceTicketsReport;
