import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/UI/PageHeader';
import MultiSelectDropdown from '../components/UI/MultiSelectDropdown';
import showToast from '../utils/toast';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

const SectionTable = ({ title, rows, dateColumns }) => (
  <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
    </div>
    {dateColumns.length === 0 ? (
      <div className="p-4 text-center text-gray-400 text-xs">No data</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead style={{ backgroundColor: '#efeeee' }}>
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Metric</th>
              {dateColumns.map(d => (
                <th key={d} className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap">{fmtDate(d)}</th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap bg-yellow-100">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ label, key, cls }, i) => {
              const total = dateColumns.reduce((sum, d) => sum + (typeof key === 'function' ? key(d) : 0), 0);
              return (
              <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-medium text-gray-700 whitespace-nowrap">{label}</td>
                {dateColumns.map(d => (
                  <td key={d} className={`px-3 py-2 text-center ${cls || 'text-gray-900'}`}>
                    {typeof key === 'function' ? key(d) : 0}
                  </td>
                ))}
                <td className={`px-3 py-2 text-center font-semibold bg-yellow-50 ${cls || 'text-gray-900'}`}>{total}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const BusinessReport = () => {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({ fromDate: today, toDate: today, departmentIds: [], supervisorNames: [], managerNames: [] });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({});
  const [departmentReport, setDepartmentReport] = useState([]);
  const [supervisorReport, setSupervisorReport] = useState([]);
  const [managerReport, setManagerReport] = useState([]);

  const [dateColumns, setDateColumns] = useState([]);

  useEffect(() => {
    api.get('/reports/departments/user').then(r => setDepartments(r.data.departments || [])).catch(() => {});
  }, []);

  const fetchReport = async (f = filters) => {
    if (!f.fromDate || !f.toDate) { showToast('error', 'Please select date range'); return; }
    setLoading(true);
    try {
      const params = { fromDate: f.fromDate, toDate: f.toDate };
      if (f.departmentIds.length > 0) params.departmentIds = f.departmentIds.join(',');
      const res = await api.get('/reports/business-report', { params });
      setReportData(res.data.data || {});
      setDepartmentReport(res.data.departmentReport || []);
      setSupervisorReport(res.data.supervisorReport || []);
      setManagerReport(res.data.managerReport || []);
      setDateColumns(res.data.dateColumns || []);
    } catch {
      showToast('error', 'Failed to load business report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  const [exporting, setExporting] = useState(false);

  const handleReset = () => {
    const defaultFilters = { fromDate: today, toDate: today, departmentIds: [], supervisorNames: [], managerNames: [] };
    setFilters(defaultFilters);
    setReportData({}); setDepartmentReport([]); setSupervisorReport([]); setManagerReport([]); setDateColumns([]);
    fetchReport(defaultFilters);
  };

  const handleExport = async () => {
    if (!filters.fromDate || !filters.toDate) { showToast('error', 'Please select date range'); return; }
    setExporting(true);
    try {
      const params = { fromDate: filters.fromDate, toDate: filters.toDate };
      if (filters.departmentIds.length > 0) params.departmentIds = filters.departmentIds.join(',');
      const res = await api.get('/reports/business-report/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Business_Report_${filters.fromDate}_to_${filters.toDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('error', 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const val = (date, key) => reportData[date]?.[key] || 0;

  const mainRows = [
    { label: 'Completed Checklists', key: (d) => val(d, 'completedChecklists'), cls: 'text-green-600 font-semibold' },
    { label: 'Expired Checklists', key: (d) => val(d, 'expiredChecklists'), cls: 'text-red-600 font-semibold' },
    { label: 'Total Checklists', key: (d) => val(d, 'totalAssigned'), cls: 'text-gray-900 font-semibold' },
    { label: 'Total NCs Raised', key: (d) => val(d, 'totalNCs'), cls: 'text-orange-600 font-semibold' },
    { label: 'Critical NCs (High)', key: (d) => val(d, 'criticalNCs'), cls: 'text-red-700 font-semibold' },
    { label: 'Non-Critical NCs (Low)', key: (d) => val(d, 'nonCriticalNCs'), cls: 'text-yellow-600 font-semibold' },
    // { label: 'New NCs', key: (d) => val(d, 'newNCs'), cls: 'text-blue-600 font-semibold' },
  ];

  const filteredSupervisorReport = filters.supervisorNames.length > 0
    ? supervisorReport.filter(s => filters.supervisorNames.includes(s.name))
    : supervisorReport;

  const filteredManagerReport = filters.managerNames.length > 0
    ? managerReport.filter(m => filters.managerNames.includes(m.name))
    : managerReport;

  return (
    <div className="space-y-6">
      <PageHeader title="Business Report" />

      {/* Filters */}
      <div className="bg-white border border-red-100 rounded-lg p-5">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input type="date" value={filters.fromDate} max={filters.toDate || undefined} onChange={e => setFilters(p => ({ ...p, fromDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input type="date" value={filters.toDate} min={filters.fromDate || undefined} onChange={e => setFilters(p => ({ ...p, toDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <MultiSelectDropdown
              options={departments.map(d => ({ value: d.id, label: d.name }))}
              selected={filters.departmentIds}
              onChange={val => setFilters(p => ({ ...p, departmentIds: val }))}
              placeholder="All Departments" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor</label>
            <MultiSelectDropdown
              options={supervisorReport.map(s => ({ value: s.name, label: s.name }))}
              selected={filters.supervisorNames}
              onChange={val => setFilters(p => ({ ...p, supervisorNames: val }))}
              placeholder="All Supervisors" />
          </div>
          {user?.role === 'Business Head' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
            <MultiSelectDropdown
              options={managerReport.map(m => ({ value: m.name, label: m.name }))}
              selected={filters.managerNames}
              onChange={val => setFilters(p => ({ ...p, managerNames: val }))}
              placeholder="All Managers" />
          </div>
          )}
          <div className="flex items-end gap-2">
            <button onClick={() => fetchReport(filters)} disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
              style={{ background: '#C50B34' }}>
              {loading ? 'Loading...' : 'Apply'}
            </button>
            <button onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Reset
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Summary Table */}
      <SectionTable title="Daily Checklist Summary" rows={mainRows} dateColumns={dateColumns} />

      {/* Supervisor-wise NC Table */}
      <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Supervisor-wise NC Count</h2>
        </div>
        {dateColumns.length === 0 || filteredSupervisorReport.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-xs">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead style={{ backgroundColor: '#efeeee' }}>
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap" rowSpan={2}>Supervisor</th>
                  {dateColumns.map(d => (
                    <th key={d} className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap" colSpan={3}>{fmtDate(d)}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap bg-yellow-100" colSpan={3}>Total</th>
                </tr>
                <tr>
                  {dateColumns.map(d => (
                    <React.Fragment key={d}>
                      <th className="px-2 py-1 text-center text-gray-500 font-normal">NCs</th>
                      <th className="px-2 py-1 text-center text-gray-500 font-normal">Compl</th>
                      <th className="px-2 py-1 text-center text-gray-500 font-normal">Pending</th>
                    </React.Fragment>
                  ))}
                  <th className="px-2 py-1 text-center text-gray-500 font-normal bg-yellow-50">NCs</th>
                  <th className="px-2 py-1 text-center text-gray-500 font-normal bg-yellow-50">Compl</th>
                  <th className="px-2 py-1 text-center text-gray-500 font-normal bg-yellow-50">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSupervisorReport.map((sup, i) => {
                  const totals = dateColumns.reduce((acc, d) => {
                    const dd = sup.dates?.[d] || {};
                    acc.ncs += dd.totalNCs || 0;
                    acc.done += dd.completed || 0;
                    acc.pending += dd.pending || 0;
                    return acc;
                  }, { ncs: 0, done: 0, pending: 0 });
                  return (
                  <tr key={sup.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 font-medium text-gray-700 whitespace-nowrap">{sup.name}</td>
                    {dateColumns.map(d => {
                      const dd = sup.dates?.[d] || {};
                      return (
                        <React.Fragment key={d}>
                          <td className="px-2 py-2 text-center text-orange-600">{dd.totalNCs || 0}</td>
                          <td className="px-2 py-2 text-center text-green-600">{dd.completed || 0}</td>
                          <td className="px-2 py-2 text-center text-red-600">{dd.pending || 0}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-2 py-2 text-center text-orange-600 font-semibold bg-yellow-50">{totals.ncs}</td>
                    <td className="px-2 py-2 text-center text-green-600 font-semibold bg-yellow-50">{totals.done}</td>
                    <td className="px-2 py-2 text-center text-red-600 font-semibold bg-yellow-50">{totals.pending}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manager-wise NC Table (Business Head only) */}
      {user?.role === 'Business Head' && (
      <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Manager-wise NC Count</h2>
        </div>
        {dateColumns.length === 0 || filteredManagerReport.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-xs">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead style={{ backgroundColor: '#efeeee' }}>
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap" rowSpan={2}>Manager</th>
                  {dateColumns.map(d => (
                    <th key={d} className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap" colSpan={3}>{fmtDate(d)}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap bg-yellow-100" colSpan={3}>Total</th>
                </tr>
                <tr>
                  {dateColumns.map(d => (
                    <React.Fragment key={d}>
                      <th className="px-2 py-1 text-center text-gray-500 font-normal">NCs</th>
                      <th className="px-2 py-1 text-center text-gray-500 font-normal">Done</th>
                      <th className="px-2 py-1 text-center text-gray-500 font-normal">Pending</th>
                    </React.Fragment>
                  ))}
                  <th className="px-2 py-1 text-center text-gray-500 font-normal bg-yellow-50">NCs</th>
                  <th className="px-2 py-1 text-center text-gray-500 font-normal bg-yellow-50">Done</th>
                  <th className="px-2 py-1 text-center text-gray-500 font-normal bg-yellow-50">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredManagerReport.map((mgr, i) => {
                  const totals = dateColumns.reduce((acc, d) => {
                    const dd = mgr.dates?.[d] || {};
                    acc.ncs += dd.totalNCs || 0;
                    acc.done += dd.completed || 0;
                    acc.pending += dd.pending || 0;
                    return acc;
                  }, { ncs: 0, done: 0, pending: 0 });
                  return (
                  <tr key={mgr.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 font-medium text-gray-700 whitespace-nowrap">{mgr.name}</td>
                    {dateColumns.map(d => {
                      const dd = mgr.dates?.[d] || {};
                      return (
                        <React.Fragment key={d}>
                          <td className="px-2 py-2 text-center text-orange-600">{dd.totalNCs || 0}</td>
                          <td className="px-2 py-2 text-center text-green-600">{dd.completed || 0}</td>
                          <td className="px-2 py-2 text-center text-red-600">{dd.pending || 0}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-2 py-2 text-center text-orange-600 font-semibold bg-yellow-50">{totals.ncs}</td>
                    <td className="px-2 py-2 text-center text-green-600 font-semibold bg-yellow-50">{totals.done}</td>
                    <td className="px-2 py-2 text-center text-red-600 font-semibold bg-yellow-50">{totals.pending}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Department-wise Table */}
      <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Department-wise Checklist Count</h2>
        </div>
        {dateColumns.length === 0 || departmentReport.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-xs">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead style={{ backgroundColor: '#efeeee' }}>
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Department</th>
                  {dateColumns.map(d => (
                    <th key={d} className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap" colSpan={3}>{fmtDate(d)}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap bg-yellow-100" colSpan={3}>Total</th>
                </tr>
                <tr>
                  <th className="px-4 py-2"></th>
                  {dateColumns.map(d => (
                    <React.Fragment key={d}>
                      <th className="px-2 py-1 text-center text-gray-500 font-normal">Com</th>
                      <th className="px-2 py-1 text-center text-gray-500 font-normal">Exp</th>
                      <th className="px-2 py-1 text-center text-gray-500 font-normal">NCs</th>
                    </React.Fragment>
                  ))}
                  <th className="px-2 py-1 text-center text-gray-500 font-normal bg-yellow-50">Com</th>
                  <th className="px-2 py-1 text-center text-gray-500 font-normal bg-yellow-50">Exp</th>
                  <th className="px-2 py-1 text-center text-gray-500 font-normal bg-yellow-50">NCs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {departmentReport.map((dept, i) => {
                  const totals = dateColumns.reduce((acc, d) => {
                    const dd = dept.dates?.[d] || {};
                    acc.com += dd.completedChecklists || 0;
                    acc.exp += dd.expiredChecklists || 0;
                    acc.ncs += dd.totalNCs || 0;
                    return acc;
                  }, { com: 0, exp: 0, ncs: 0 });
                  return (
                  <tr key={dept.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 font-medium text-gray-700 whitespace-nowrap">{dept.name}</td>
                    {dateColumns.map(d => {
                      const dd = dept.dates?.[d] || {};
                      return (
                        <React.Fragment key={d}>
                          <td className="px-2 py-2 text-center text-green-600">{dd.completedChecklists || 0}</td>
                          <td className="px-2 py-2 text-center text-red-600">{dd.expiredChecklists || 0}</td>
                          <td className="px-2 py-2 text-center text-orange-600">{dd.totalNCs || 0}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-2 py-2 text-center text-green-600 font-semibold bg-yellow-50">{totals.com}</td>
                    <td className="px-2 py-2 text-center text-red-600 font-semibold bg-yellow-50">{totals.exp}</td>
                    <td className="px-2 py-2 text-center text-orange-600 font-semibold bg-yellow-50">{totals.ncs}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


    </div>
  );
};

export default BusinessReport;
