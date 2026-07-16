import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/UI/PageHeader';
import showToast from '../utils/toast';
import api from '../services/api';
import * as XLSX from 'xlsx';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/UI/Pagination';
import DynamicFilterBuilder from '../components/UI/DynamicFilterBuilder';

const NCReports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [filters, setFilters] = useState({
  fromDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  toDate: new Date().toISOString().split('T')[0]

  });
  const [tableFilters, setTableFilters] = useState({
    location: [],
    department: [],
    category: [],
    reason: [],
    process: [],
    criticality: [],
    activities: []
  });

  const [currentPage, setCurrentPage] = useState(1);
  const { pagination, goToPage, setLimit, getPageSizeOptions, paginateData } = usePagination(1, 50);

  useEffect(() => {
    fetchNCReports();
  }, []);

  const fetchNCReports = async (customFilters = null, customTableFilters = null) => {
    try {
      setLoading(true);
      const params = {};
      const activeFilters = customFilters || filters;
      const activeTableFilters = customTableFilters || tableFilters;

      if (activeFilters.fromDate) params.fromDate = activeFilters.fromDate;
      if (activeFilters.toDate) params.toDate = activeFilters.toDate;

      // Add table filters
      Object.entries(activeTableFilters).forEach(([key, values]) => {
        if (values.length > 0) {
          params[key] = values.join(',');
        }
      });

      const response = await api.get('/reports', { params });
      setReports(response.data.data || []);
      setCurrentPage(1);
    } catch (error) {
      showToast('error', 'Failed to load NC reports');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    fetchNCReports();
  };

  const handleReset = () => {
    const resetFilters = { fromDate: '', toDate: '' };
    const resetTableFilters = {
      location: [],
      department: [],
      category: [],
      reason: [],
      process: [],
      criticality: [],
      activities: []
    };
    setFilters(resetFilters);
    setTableFilters(resetTableFilters);
    fetchNCReports(resetFilters, resetTableFilters);
  };

  // Pagination
  const totalRecords = reports.length;
  const currentReports = paginateData(reports);
  const clientPagination = { ...pagination, total: totalRecords, pages: Math.ceil(totalRecords / pagination.limit) };

  const handlePageChange = (page) => goToPage(page);

  const handleLimitChange = (newLimit) => setLimit(newLimit);

  const getUniqueValues = (field) => {
    const values = reports.map(r => r[field]);
    return [...new Set(values)].filter(Boolean).sort();
  };

  const columnOptions = [
    { value: 'location', label: 'Location'},
    { value: 'department', label: 'Department' },
    { value: 'category', label: 'Category' },
    { value: 'reason', label: 'Reason' },
    { value: 'process', label: 'Process' },
    { value: 'criticality', label: 'Criticality' },
    { value: 'activities', label: 'Activities' }
  ];

  const clearTableFilters = () => {
    const reset = {
      location: [],
      department: [],
      category: [],
      reason: [],
      process: [],
      criticality: [],
      activities: []
    };
    setTableFilters(reset);
    fetchNCReports(filters, reset);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="NC Reports">
        <div className="flex items-center gap-3">
          
        </div>
      </PageHeader>

      <div className="bg-white border border-gray-200 rounded-lg p-4 text-left">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.fromDate}
              max={filters.toDate || undefined}
              onChange={(e) => handleFilterChange('fromDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.toDate}
              min={filters.fromDate || undefined}
              onChange={(e) => handleFilterChange('toDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
            >
              Filter
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
            >
              Reset
            </button>
            {reports.length > 0 && (
            <button
              onClick={() => {
                const data = reports.map((r, i) => ({
                  'Date': r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('-') : '-',
                  'Category': r.category || '-',
                  'Reason': r.reason || '-',
                  'Department': r.department || '-',
                  'Process': r.process || '-',
                  'Criticality': r.criticality || '-',
                  'Activities': r.activities || '-'
                }));
                const ws = XLSX.utils.json_to_sheet(data);
                ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'NC Reports');
                XLSX.writeFile(wb, `NC_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
            >
              Export
            </button>
          )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <DynamicFilterBuilder
          columnOptions={columnOptions}
          tableFilters={tableFilters}
          setTableFilters={setTableFilters}
          onClearAll={clearTableFilters}
          onApply={() => fetchNCReports()}
          getUniqueValues={getUniqueValues}
          loading={loading}
        />
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">No NC records found</div>
          ) : (
            <>
              <table className="min-w-full">
                <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 text-left">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Reason</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Department</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Process</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Criticality</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Activities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-left">
                  {currentReports.map((report, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {report.date ? new Date(report.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('-') : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{report.category || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{report.reason || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{report.location || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{report.department || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{report.process || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          report.criticality === 'High' ? 'bg-red-100 text-red-800' :
                          report.criticality === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {report.criticality || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{report.activities || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {currentReports.length > 0 && (
                <Pagination
                  pagination={clientPagination}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                  pageSizeOptions={getPageSizeOptions()}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NCReports;
