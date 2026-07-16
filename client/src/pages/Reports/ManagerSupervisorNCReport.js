import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { checklistAPI } from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import MultiSelectDropdown from '../../components/UI/MultiSelectDropdown';
import Pagination from '../../components/UI/Pagination';
import PageSizeOptions from '../../components/UI/PageSizeOptions';
import DynamicFilterBuilder from '../../components/UI/DynamicFilterBuilder';
import { XMarkIcon } from '@heroicons/react/24/solid';
import useFilterOptions from '../../hooks/useFilterOptions';

const ManagerSupervisorNCReport = () => {
    const { token, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 25
    });

    // Main Filters
    const [filters, setFilters] = useState({
        fromDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0]
    });

    // Table Filters
    const [tableFilters, setTableFilters] = useState({
        role: [],
        name: [],
        category: [],
        location: [],
        department: [],
        checklist_name: []
    });


    const { categories, locations, departments, fetchOptions } = useFilterOptions();

    useEffect(() => {
        fetchOptions({ category: tableFilters.category, location: tableFilters.location });
    }, [tableFilters.category, tableFilters.location, fetchOptions]);

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchReport = async () => {
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
                ...serializedTableFilters
            };
            const response = await checklistAPI.getManagerSupervisorNCCounts(params);

            setReportData(response.data.data);

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
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchReport();
    };

    const handlePageChange = (page) => {
        setPagination(prev => ({ ...prev, page }));
    };

    const handleLimitChange = (newLimit) => {
        setPagination({ page: 1, limit: newLimit });
    };

    const getPageSizeOptions = () => {
        const total = reportData.length || 0;
        if (total <= 100) return [25, 50, 100];
        return [25, 50, 100];
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
            role: [],
            name: [],
            category: [],
            location: [],
            department: [],
            checklist_name: []
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
    
    // Note: Pagination remains client-side for this report as the backend returns all filtered results

    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / pagination.limit);
    const paginatedData = filteredData.slice(
        (pagination.page - 1) * pagination.limit,
        pagination.page * pagination.limit
    );

    const columnOptions = [
        { value: 'role', label: 'Role' },
        { value: 'name', label: 'Name' },
        { value: 'category', label: 'Category' },
        { value: 'location', label: 'Location' },
        { value: 'department', label: 'Department' },
        { value: 'checklist_name', label: 'Checklist Name' }
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
            const response = await checklistAPI.exportManagerSupervisorNCCounts(params);

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Manager_Supervisor_NC_Counts_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

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
                    <h1 className="text-2xl font-bold text-gray-800">Manager/Supervisor NC Counts</h1>
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
                    <div className="bg-white border border-red-100 rounded-lg p-6 mb-8 shadow-sm">
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
                <div className="bg-white border border-red-100 rounded-lg min-h-[450px] shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    </div>

                    <DynamicFilterBuilder
                        columnOptions={columnOptions}
                        tableFilters={tableFilters}
                        setTableFilters={setTableFilters}
                        onClearAll={clearTableFilters}
                        onApply={fetchReport}
                        getUniqueValues={getUniqueValues}
                        loading={loading}
                    />

                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center mb-2">
                        <h2 className="text-sm font-medium text-gray-700">Report Results</h2>
                        <div className="flex items-center gap-4">
                            {totalRecords > 0 && (
                                <PageSizeOptions
                                    pagination={{...pagination, total: totalRecords}}
                                    onLimitChange={handleLimitChange}
                                    pageSizeOptions={getPageSizeOptions()}
                                />
                            )}
                        </div>
                    </div>
                    {paginatedData.length > 0 ? (
                        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead style={{ backgroundColor: '#efeeee' }} className="sticky top-0 text-left">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Location</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Category</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Department</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Checklist Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Total NC</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Accepted</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Rejected</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200 text-left">
                                    {paginatedData.map((item, index) => (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.role === 'Manager' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {item.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.location}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.category}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.department}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{item.checklist_name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">{item.total_nc}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold">{item.accepted_nc}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-semibold">{item.rejected_nc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-10 text-center text-gray-500 text-sm">
                            {loading ? 'Loading data...' : 'No records found. Adjust filters to search.'}
                        </div>
                    )}

                    {/* Pagination */}
                    {paginatedData.length > 0 && (
                        <Pagination
                            pagination={{ ...pagination, total: totalRecords, pages: totalPages }}
                            onPageChange={handlePageChange}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default ManagerSupervisorNCReport;
