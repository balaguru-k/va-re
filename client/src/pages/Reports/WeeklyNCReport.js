import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { checklistAPI, mastersAPI } from '../../services/api';
import PageHeader from '../../components/UI/PageHeader';
import SearchableSelect from '../../components/SearchableSelect';
import MultiSelectDropdown from '../../components/UI/MultiSelectDropdown';
import axios from 'axios';
import toast from 'react-hot-toast';

const WeeklyNCReport = () => {
  const { token } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    toDate: today,
    categoryId: [],
    locationId: [],
    departmentId: []
  });

  const [weeklyNCData, setWeeklyNCData] = useState([]);
  const [weeklyNCWeeks, setWeeklyNCWeeks] = useState([]);
  const [weeklyNCGrandTotal, setWeeklyNCGrandTotal] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchLocations();
    fetchWeeklyNC();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checklists/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(res.data.categories || []);
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checklists/locations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocations(res.data.locations || []);
    } catch (e) {
      console.error('Error fetching locations:', e);
    }
  };

  const fetchDepartments = async (locIds) => {
    if (!locIds || locIds.length === 0) { 
      setDepartments([]); 
      return; 
    }
    setLoading(true);
    try {
      let allDepts = [];
      for (const id of locIds) {
        const res = await mastersAPI.getDepartments(id);
        if (res.data.departments) {
          allDepts = [...allDepts, ...res.data.departments];
        }
      }
      // Remove duplicates if any
      const uniqueDepts = Array.from(new Map(allDepts.map(d => [d.id, d])).values());
      setDepartments(uniqueDepts);
    } catch (e) {
      console.error('Error fetching departments:', e);
    } finally {
      setLoading(false);
    }
  };

  const buildParams = (f = filters) => {
    const params = {};
    if (f.fromDate) params.fromDate = f.fromDate;
    if (f.toDate) params.toDate = f.toDate;
    if (f.categoryId && f.categoryId.length > 0) params.categoryId = f.categoryId.join(',');
    if (f.locationId && f.locationId.length > 0) params.locationId = f.locationId.join(',');
    if (f.departmentId && f.departmentId.length > 0) params.departmentId = f.departmentId.join(',');
    return params;
  };

  const fetchWeeklyNC = async (f = filters) => {
    setLoading(true);
    try {
      const res = await checklistAPI.getWeeklyNCReport(buildParams(f));
      setWeeklyNCWeeks(res.data.weeks || []);
      setWeeklyNCData(res.data.data || []);
      setWeeklyNCGrandTotal(res.data.grand_total || null);
    } catch (e) {
      console.error('Weekly NC Error:', e);
      toast.error('Failed to fetch weekly NC report');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => fetchWeeklyNC(filters);

  const exportToExcel = () => {
    if (weeklyNCData.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Create CSV content
    let csv = 'Location,Department';
    weeklyNCWeeks.forEach(w => {
      csv += `,${w.label} (${w.start} - ${w.end})`;
    });
    csv += ',Grand Total\n';

    weeklyNCData.forEach(row => {
      csv += `"${row.location}","${row.department}"`;
      weeklyNCWeeks.forEach((_, wi) => {
        csv += `,${row[`week_${wi + 1}`] || 0}`;
      });
      csv += `,${row.grand_total}\n`;
    });

    if (weeklyNCGrandTotal) {
      csv += '"Grand Total",""';
      weeklyNCWeeks.forEach((_, wi) => {
        csv += `,${weeklyNCGrandTotal[`week_${wi + 1}`] || 0}`;
      });
      csv += `,${weeklyNCGrandTotal.grand_total}\n`;
    }

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Weekly_NC_Report_${filters.fromDate}_to_${filters.toDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Weekly NC Report" />
        <button
          onClick={exportToExcel}
          disabled={loading || weeklyNCData.length === 0}
          className="px-4 py-2 text-sm font-medium text-white rounded-md flex items-center gap-2 disabled:opacity-50"
          style={{ background: '#C50B34' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
          </svg>
          Export
        </button>
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
            <MultiSelectDropdown
              options={categories.map(c => ({ value: c.id, label: c.name }))}
              selected={filters.categoryId}
              onChange={(val) => setFilters(prev => ({ ...prev, categoryId: val }))}
              placeholder="All Categories"
            />
          </div>
          <div className="w-52">
            <MultiSelectDropdown
              options={locations.map(l => ({ value: l.id, label: l.name }))}
              selected={filters.locationId}
              onChange={(val) => {
                setFilters(prev => ({ ...prev, locationId: val, departmentId: [] }));
                fetchDepartments(val);
              }}
              placeholder="All Locations"
            />
          </div>
          <div className="w-64">
            <MultiSelectDropdown
              options={departments.map(d => ({ value: d.id, label: d.name }))}
              selected={filters.departmentId}
              onChange={(val) => setFilters(prev => ({ ...prev, departmentId: val }))}
              placeholder={filters.locationId.length > 0 ? 'All Departments' : 'Select location first'}
            />
          </div>
          <button
            onClick={handleApply}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
            style={{ background: '#C50B34' }}
          >
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Weekly NC Report Table */}
      <div className="bg-white rounded-lg border border-gray-200 min-h-[400px]">
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
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading weekly NC report...</div>
        ) : weeklyNCData.length > 0 ? (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full">
              <thead style={{ backgroundColor: '#efeeee' }} className="border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Department</th>
                  {weeklyNCWeeks.map((w, i) => (
                    <th key={i} className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{w.label}</th>
                  ))}
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 sticky right-0 z-20 border-l border-gray-200" style={{ backgroundColor: '#efeeee' }}>Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {weeklyNCData.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.location}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.department}</td>
                    {weeklyNCWeeks.map((_, wi) => (
                      <td key={wi} className="px-4 py-3 text-sm text-center text-gray-700">{row[`week_${wi + 1}`] || 0}</td>
                    ))}
                    <td className={`px-4 py-3 text-sm text-center font-semibold text-gray-900 sticky right-0 z-10 border-l border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>{row.grand_total}</td>
                  </tr>
                ))}
              </tbody>
              {weeklyNCGrandTotal && (
                <tfoot className="sticky bottom-0 z-10 bg-gray-100 shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
                  <tr className="font-bold border-t-2 border-gray-300">
                    <td className="px-4 py-3 text-sm text-gray-900">Grand Total</td>
                    <td className="px-4 py-3 text-sm text-gray-900"></td>
                    {weeklyNCWeeks.map((_, wi) => (
                      <td key={wi} className="px-4 py-3 text-sm text-center text-gray-900">{weeklyNCGrandTotal[`week_${wi + 1}`] || 0}</td>
                    ))}
                    <td className="px-4 py-3 text-sm text-center text-gray-900 sticky right-0 z-20 bg-gray-100 border-l border-gray-300">{weeklyNCGrandTotal.grand_total}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            No data found for the selected filters. Please adjust your date range or filters and try again.
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyNCReport;
