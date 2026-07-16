import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { checklistAPI } from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import MultiSelectDropdown from '../../components/UI/MultiSelectDropdown';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/UI/Pagination';
import PageSizeOptions from '../../components/UI/PageSizeOptions';
import DynamicFilterBuilder from '../../components/UI/DynamicFilterBuilder';
import { XMarkIcon } from '@heroicons/react/24/solid';
import useUserFilterOptions from '../../hooks/useUserFilterOptions';

const UserStatusReport = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const { pagination, updateFromResponse, goToPage, setLimit, getPageSizeOptions } = usePagination(1, 50);

    // Main Filters
    const [filters, setFilters] = useState({
        fromDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0]
    });

    // Table Filters
    const [tableFilters, setTableFilters] = useState({
        category_name: [],
        checklist_name: [],
        location_name: [],
        department_name: [],
        supervisor_names: [],
        manager_names: []
    });

    const { categories, locations, departments , fetchOptions } = useUserFilterOptions();

    // Dropdown Data

    useEffect(() => {
        fetchOptions({ category: tableFilters.category, location: tableFilters.location });
    }, [tableFilters.category, tableFilters.location, fetchOptions]);

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const fetchReport = async (page = 1, limit = pagination.limit) => {
        setLoading(true);
        try {
            // Serialize table filters
            const serializedTableFilters = {};
            Object.entries(tableFilters).forEach(([key, values]) => {
                if (values.length > 0) {
                    serializedTableFilters[key] = values.join('|||');
                }
            });

            const params = {
                fromDate: filters.fromDate,
                toDate: filters.toDate,
                page,
                limit,
                ...serializedTableFilters
            };

            const response = await checklistAPI.getUserStatusReport(params);

            setReportData(response.data.data);
            updateFromResponse(response.data.pagination);

            if (response.data.data.length === 0) {
                toast.success('No records found for the selected criteria');
            }
        } catch (error) {
            console.error('Error fetching report:', error);
            toast.error('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleApplyFilters = (e) => {
        e.preventDefault();
        fetchReport(1);
    };

    const handlePageChange = (page) => {
        goToPage(page);
        fetchReport(page);
    };

    const handleLimitChange = (newLimit) => {
        setLimit(newLimit);
        fetchReport(1, newLimit);
    };

    const handleResetFilters = () => {
        setFilters({
            fromDate: '',
            toDate: ''
        });
        setReportData([]);
    };

    const clearTableFilters = () => {
        setTableFilters({
            category_name: [],
            checklist_name: [],
            location_name: [],
            department_name: [],
            supervisor_names: [],
            manager_names: []
        });
    };

    const getUniqueValues = (field) => {
        if (field === 'category_name') return categories;
        if (field === 'location_name') return locations;
        if (field === 'department_name') return departments;
        if (!reportData || reportData.length === 0) return [];
        return [...new Set(reportData.map(item => item[field]))].filter(Boolean).sort();
    };

    // Table filtering is now handled server-side
    const filteredData = reportData;

    const columnOptions = [
        { value: 'category_name', label: 'Category' },
        { value: 'checklist_name', label: 'Checklist Name' },
        { value: 'location_name', label: 'Location' },
        { value: 'department_name', label: 'Department' },
        { value: 'supervisor_names', label: 'Supervisor Name' },
        { value: 'manager_names', label: 'Manager Name' }
    ];

    const handleExport = async () => {
        setExporting(true);
        try {
            // Serialize table filters
            const serializedTableFilters = {};
            Object.entries(tableFilters).forEach(([key, values]) => {
                if (values.length > 0) {
                    serializedTableFilters[key] = values.join('|||');
                }
            });

            const params = {
                fromDate: filters.fromDate,
                toDate: filters.toDate,
                ...serializedTableFilters
            };

            const response = await checklistAPI.exportUserStatusReport(params);

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `User_Status_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);

            toast.success('Report exported successfully');
        } catch (error) {
            console.error('Error exporting report:', error);
            toast.error('Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    return (
        <>
            <div className="container mx-auto px-4 py-2">
                <div className="mb-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">NC Closure Report</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExport}
                            disabled={exporting || reportData.length === 0}
                            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
                            style={{ background: '#C50B34' }}
                        >
                            {exporting ? 'Exporting...' : 'Export'}
                        </button>
                        <button
                            onClick={() => setFiltersOpen(!filtersOpen)}
                            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
                        >
                            Filters
                            <svg
                                className={`w-4 h-4 transform transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Filters Section */}
                {filtersOpen && (
                    <div className="bg-white border border-red-100 rounded-lg p-6 mb-8">
                        <div className="mb-4">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Filter Options</h3>
                            <p className="text-sm text-gray-600">Use the filters below to narrow down your report results</p>
                        </div>
                        <form onSubmit={handleApplyFilters} className="flex flex-wrap items-end gap-6 text-left">
                            {/* Date Range */}
                            <div className="w-64">
                                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                                <input
                                    type="date"
                                    name="fromDate"
                                    value={filters.fromDate}
                                    max={filters.toDate || undefined}
                                    onChange={handleFilterChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                />
                            </div>
                            <div className="w-64">
                                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                                <input
                                    type="date"
                                    name="toDate"
                                    value={filters.toDate}
                                    min={filters.fromDate || undefined}
                                    onChange={handleFilterChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                    Reset
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 hover:opacity-90 transition-opacity"
                                    style={{ background: '#C50B34' }}
                                >
                                    {loading ? 'Loading...' : 'Apply Filters'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Results Table */}
                <div className="bg-white border border-red-100 rounded-lg min-h-[450px]">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-sm font-medium text-gray-700">Report Results</h2>
                            <div className="flex items-center gap-4">
                                {reportData.length > 0 && (
                                    <PageSizeOptions
                                        pagination={pagination}
                                        onLimitChange={handleLimitChange}
                                        pageSizeOptions={getPageSizeOptions()}
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
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Checklist Name</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Location / Dept</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Supervisor Name</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Manager Name</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 text-left">Total Checklists</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 text-left">Awaiting Supervisor</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 text-left">Awaiting Manager</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 text-left">Completed</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 text-left">Completed without NCs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-left">
                                    {filteredData.map((item, index) => (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{item.checklist_name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                <div className="flex flex-col gap-1">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full w-fit">{item.location_name || 'N/A'}</span>
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full w-fit">{item.department_name || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.supervisor_names || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.manager_names || '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full">
                                                    {item.total_checklists}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full">
                                                    {item.awaiting_supervisor}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                                                    {item.awaiting_manager}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                                                    {item.completed}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                                                    {item.completed_without_ncs}
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

                    {/* Pagination */}
                    {reportData.length > 0 && (
                        <Pagination
                            pagination={pagination}
                            onPageChange={handlePageChange}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default UserStatusReport;
