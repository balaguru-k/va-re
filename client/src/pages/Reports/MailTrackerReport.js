import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import MultiSelectDropdown from '../../components/UI/MultiSelectDropdown';
import Pagination from '../../components/UI/Pagination';
import PageSizeOptions from '../../components/UI/PageSizeOptions';
import DynamicFilterBuilder from '../../components/UI/DynamicFilterBuilder';
import { XMarkIcon } from '@heroicons/react/24/solid';
import useFilterOptions from '../../hooks/useFilterOptions';

const MailTrackerReport = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 });

    // Main Filters
    const [filters, setFilters] = useState({
        fromDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0]
    });

    // Table Filters
    const [tableFilters, setTableFilters] = useState({
        checklist_name: [],
        category: [],
        location: [],
        department: [],
        status: []
    });

    const { categories, locations, departments, fetchOptions } = useFilterOptions();

    useEffect(() => {
        fetchOptions({ category: tableFilters.category, location: tableFilters.location });
    }, [tableFilters.category, tableFilters.location, fetchOptions]);

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const buildParams = (page, limitOverride) => {
        // Serialize table filters
        const serializedTableFilters = {};
        Object.entries(tableFilters).forEach(([key, values]) => {
            if (values.length > 0) {
                serializedTableFilters[key] = values.join('|||');
            }
        });

        const params = new URLSearchParams();
        if (filters.fromDate) params.append('fromDate', filters.fromDate);
        if (filters.toDate) params.append('toDate', filters.toDate);
        params.append('page', page);
        params.append('limit', limitOverride || pagination.limit || 50);

        // Add table filters
        Object.entries(serializedTableFilters).forEach(([key, value]) => {
            params.append(key, value);
        });

        return params;
    };

    const fetchReport = async (page = 1, limitOverride) => {
        setLoading(true);
        try {
            const params = buildParams(page, limitOverride);
            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/reports/mail-tracker?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReportData(response.data.data || []);
            setPagination(prev => ({
                page: response.data.pagination?.currentPage || 1,
                pages: response.data.pagination?.totalPages || 1,
                total: response.data.pagination?.totalRecords || 0,
                limit: prev.limit
            }));
            if ((response.data.data || []).length === 0) {
                toast.success('No records found for the selected criteria');
            }
        } catch (error) {
            toast.error('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = (e) => {
        e.preventDefault();
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchReport(1);
    };

    const handlePageChange = (page) => {
        setPagination(prev => ({ ...prev, page }));
        fetchReport(page);
    };

    const handleLimitChange = (newLimit) => {
        setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
        fetchReport(1, newLimit);
    };

    const handleResetFilters = () => {
        setFilters({ fromDate: '', toDate: '' });
        setReportData([]);
    };

    const clearTableFilters = () => {
        setTableFilters({
            checklist_name: [],
            category: [],
            location: [],
            department: [],
            status: []
        });
    };

    const getUniqueValues = (field) => {
        if (field === 'category') return categories;
        if (field === 'location') return locations;
        if (field === 'department') return departments;
        if (!reportData || reportData.length === 0) return [];
        return [...new Set(reportData.map(item => item[field]))].filter(Boolean).sort();
    };

    // Table filtering is now handled server-side
    const filteredData = reportData;

    const columnOptions = [
        { value: 'checklist_name', label: 'Checklist Name' },
        { value: 'category', label: 'Category' },
        { value: 'location', label: 'Location' },
        { value: 'department', label: 'Department' },
        { value: 'status', label: 'Status' }
    ];

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = buildParams(1, 100000); // For export, we usually want all matching records
            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/reports/mail-tracker/export?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Mail_Tracker_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Report exported successfully');
        } catch (error) {
            toast.error('Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-2">
            <div className="mb-8 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Mail Tracker</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        disabled={exporting || reportData.length === 0}
                        className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
                        style={{ background: '#C50B34' }}
                    >
                        {exporting ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        )}
                        {exporting ? 'Exporting...' : 'Export'}
                    </button>
                    <button
                        onClick={() => setFiltersOpen(!filtersOpen)}
                        className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
                    >
                        Filters
                        <svg
                            className={`w-4 h-4 transform transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </div>

            {filtersOpen && (
                <div className="bg-white border border-red-100 rounded-lg p-6 mb-8">
                    <div className="mb-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Filter Options</h3>
                        <p className="text-sm text-gray-600">Use the filters below to narrow down your report results</p>
                    </div>
                    <form onSubmit={handleApplyFilters} className="flex flex-wrap items-end gap-6">
                        <div className="w-64">
                            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                            <input type="date" name="fromDate" value={filters.fromDate} max={filters.toDate || undefined} onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                        </div>
                        <div className="w-64">
                            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                            <input type="date" name="toDate" value={filters.toDate} min={filters.fromDate || undefined} onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={handleResetFilters}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500">
                                Reset
                            </button>
                            <button type="submit" disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 hover:opacity-90 transition-opacity"
                                style={{ background: '#C50B34' }}>
                                {loading ? 'Loading...' : 'Apply Filters'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white border border-red-100 rounded-lg min-h-[450px]">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-sm font-medium text-gray-700">Mail Tracker Results</h2>
                        <div className="flex items-center gap-4">
                            {reportData.length > 0 && (
                                <PageSizeOptions
                                    pagination={pagination}
                                    onLimitChange={handleLimitChange}
                                    pageSizeOptions={[50, 100, 250]}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <DynamicFilterBuilder
                    columnOptions={columnOptions}
                    tableFilters={tableFilters}
                    setTableFilters={setTableFilters}
                    onClearAll={clearTableFilters}
                    onApply={() => fetchReport(1)}
                    getUniqueValues={getUniqueValues}
                    loading={loading}
                />

                {reportData.length > 0 ? (
                    <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                        <table className="min-w-full">
                            <thead style={{ backgroundColor: '#efeeee' }} className="border-b border-gray-200 sticky top-0 text-left">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Checklist Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Category</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Location</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Department</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">To</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">CC</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-left">
                                {filteredData.map((item, index) => (
                                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900">{item.checklist_name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">{item.location}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900">{item.department}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={item.to}>{item.to}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={item.cc}>{item.cc}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                item.status === 'sent' ? 'bg-green-100 text-green-800' :
                                                item.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                item.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-4 text-center text-gray-500 text-xs">
                        {loading ? 'Loading data...' : 'No records found. Adjust filters to search.'}
                    </div>
                )}

                {reportData.length > 0 && (
                    <Pagination
                        pagination={pagination}
                        onPageChange={handlePageChange}
                    />
                )}
            </div>
        </div>
    );
};

export default MailTrackerReport;
