import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { checklistAPI } from '../../services/api';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/UI/Pagination';
import PageSizeOptions from '../../components/UI/PageSizeOptions';
import DynamicFilterBuilder from '../../components/UI/DynamicFilterBuilder';
import useFilterOptions from '../../hooks/useFilterOptions';

const ChecklistItemsReport = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [expandedActivities, setExpandedActivities] = useState({});
    const { pagination, updateFromResponse, goToPage, setLimit, getPageSizeOptions } = usePagination(1, 50);

    // Main Filters
    const [filters, setFilters] = useState({
        fromDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0]
    });

    // Table Filters
    const [tableFilters, setTableFilters] = useState({
        category: [],
        location: [],
        department: [],
        checklist_name: [],
        process: [],
        activity: [],
        checklist_status: [],
        supervisor_name: [],
        manager_name: []
    });

    const { categories, locations, departments, fetchOptions } = useFilterOptions();

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

            const response = await checklistAPI.getChecklistItemsReport(params);

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
            category: [],
            location: [],
            department: [],
            checklist_name: [],
            process: [],
            activity: [],
            checklist_status: [],
            supervisor_name: [],
            manager_name: []
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
        { value: 'category', label: 'Category' },
        { value: 'location', label: 'Location' },
        { value: 'department', label: 'Department' },
        { value: 'checklist_name', label: 'Checklist Name' },
        { value: 'process', label: 'Process' },
        { value: 'activity', label: 'Activity' },
        { value: 'checklist_status', label: 'Status' },
        { value: 'supervisor_name', label: 'Supervisor' },
        { value: 'manager_name', label: 'Manager' }
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

            const response = await checklistAPI.exportChecklistItemsReport(params);

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Checklist_Items_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
                    <h1 className="text-2xl font-bold text-gray-800">Accepted/Rejected Report</h1>
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
                        <form onSubmit={handleApplyFilters} className="flex flex-wrap items-end gap-6">
                            {/* Date Range */}
                            <div className="w-64">
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">From Date</label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">To Date</label>
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
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
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
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Location / Dept</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Checklist Name</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Process</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Activity</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Status</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Supervisor Name</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 text-left">Manager Name</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredData.map((item, index) => (
                                        <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                <div className="flex flex-col gap-1">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full w-fit">{item.location}</span>
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full w-fit">{item.department}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.checklist_name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{item.process}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                                                {item.activity}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.checklist_status === 'Yes' || item.checklist_status === 'Accepted' ? 'bg-green-100 text-green-800' :
                                                    item.checklist_status === 'No' || item.checklist_status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {item.checklist_status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.supervisor_name || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.manager_name || '-'}</td>
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

export default ChecklistItemsReport;
