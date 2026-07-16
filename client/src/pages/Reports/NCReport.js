import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/UI/Pagination';
import PageSizeOptions from '../../components/UI/PageSizeOptions';
import DynamicFilterBuilder from '../../components/UI/DynamicFilterBuilder';
import useFilterOptions from '../../hooks/useFilterOptions';

const NCReport = () => {
    const { token } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const { pagination, updateFromResponse, goToPage, setLimit, getPageSizeOptions } = usePagination(1, 50);

    const [filters, setFilters] = useState({
        fromDate: searchParams.get('fromDate') || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        toDate: searchParams.get('toDate') || new Date().toISOString().split('T')[0]
    });

    const [tableFilters, setTableFilters] = useState({
        date: searchParams.get('date') ? searchParams.get('date').split('|||') : [],
        checklist_name: searchParams.get('checklist_name') ? searchParams.get('checklist_name').split('|||') : [],
        category: searchParams.get('category') ? searchParams.get('category').split('|||') : [],
        auditor: searchParams.get('auditor') ? searchParams.get('auditor').split('|||') : [],
        item_description: searchParams.get('item_description') ? searchParams.get('item_description').split('|||') : [],
        item_process: searchParams.get('item_process') ? searchParams.get('item_process').split('|||') : [],
        nc_reason: searchParams.get('nc_reason') ? searchParams.get('nc_reason').split('|||') : [],
        supervisor_status: searchParams.get('supervisor_status') ? searchParams.get('supervisor_status').split('|||') : [],
        location: searchParams.get('location') ? searchParams.get('location').split('|||') : [],
        department: searchParams.get('department') ? searchParams.get('department').split('|||') : []
    });

    const { categories, locations, departments, fetchOptions } = useFilterOptions();

    useEffect(() => {
        fetchOptions({ category: tableFilters.category, location: tableFilters.location });
    }, [tableFilters.category, tableFilters.location, fetchOptions]);

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncUrlParams = (mainFilters, tblFilters) => {
        const params = new URLSearchParams();
        if (mainFilters.fromDate) params.set('fromDate', mainFilters.fromDate);
        if (mainFilters.toDate) params.set('toDate', mainFilters.toDate);
        Object.entries(tblFilters).forEach(([key, values]) => {
            if (values.length > 0) params.set(key, values.join('|||'));
        });
        setSearchParams(params, { replace: true });
    };

    const fetchReport = async (page = 1, limit = pagination.limit) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.fromDate) params.append('fromDate', filters.fromDate);
            if (filters.toDate) params.append('toDate', filters.toDate);
            params.append('page', page);
            params.append('limit', limit);

            Object.entries(tableFilters).forEach(([key, values]) => {
                if (values.length > 0) params.append(key, values.join('|||'));
            });

            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/reports/ncs?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setReportData(response.data.data);
            updateFromResponse(response.data.pagination);
            syncUrlParams(filters, tableFilters);

            if (response.data.data.length === 0) {
                toast.success('No NC records found for the selected criteria');
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
        setFilters(prev => ({ ...prev, [name]: value }));
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
        setFilters({ fromDate: '', toDate: '' });
        setTableFilters({ date: [], checklist_name: [], category: [], auditor: [], item_description: [], item_process: [], nc_reason: [], supervisor_status: [], location: [], department: [] });
        setReportData([]);
        setSearchParams({}, { replace: true });
    };

    const clearTableFilters = () => {
        setTableFilters({ date: [], checklist_name: [], category: [], auditor: [], item_description: [], item_process: [], nc_reason: [], supervisor_status: [], location: [], department: [] });
    };

    const getUniqueValues = (field) => {
        if (field === 'category') return categories;
        if (field === 'location') return locations;
        if (field === 'department') return departments;
        if (!reportData || reportData.length === 0) return [];
        return [...new Set(reportData.map(item => item[field]))].filter(Boolean).sort();
    };

    const columnOptions = [
        { value: 'date', label: 'Date' },
        { value: 'checklist_name', label: 'Checklist' },
        { value: 'category', label: 'Category' },
        { value: 'location', label: 'Location' },
        { value: 'department', label: 'Department' },
        { value: 'auditor', label: 'Auditor' },
        { value: 'item_description', label: 'Activity' },
        { value: 'item_process', label: 'Process' },
        { value: 'nc_reason', label: 'NC Reason' },
        { value: 'supervisor_status', label: 'Status' }
    ];

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            if (filters.fromDate) params.append('fromDate', filters.fromDate);
            if (filters.toDate) params.append('toDate', filters.toDate);
            Object.entries(tableFilters).forEach(([key, values]) => {
                if (values.length > 0) params.append(key, values.join('|||'));
            });

            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/reports/ncs/export?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `NC_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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
        <>
            <div className="container mx-auto px-4 py-2">
                <div className="mb-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">Non-Compliance (NC) Report</h1>
                    <div className="flex gap-2">
                        <button onClick={handleExport} disabled={exporting || reportData.length === 0} className="px-3 py-2 text-xs font-medium text-white rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90" style={{background: '#C50B34'}}>
                            {exporting ? 'Exporting...' : 'Export'}
                        </button>
                        <button onClick={() => setFiltersOpen(!filtersOpen)} className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90">
                            Filters
                            <svg className={`w-4 h-4 transform transition-transform ${filtersOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {filtersOpen && (
                    <div className="bg-white border border-red-100 rounded-lg p-6 mb-8">
                        <form onSubmit={handleApplyFilters} className="flex flex-wrap items-end gap-6">
                            <div className="w-64">
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">From Date</label>
                                <input type="date" name="fromDate" value={filters.fromDate} max={filters.toDate || undefined} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                            </div>
                            <div className="w-64">
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">To Date</label>
                                <input type="date" name="toDate" value={filters.toDate} min={filters.fromDate || undefined} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={handleResetFilters} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Reset</button>
                                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 hover:opacity-90" style={{ background: '#C50B34' }}>{loading ? 'Loading...' : 'Apply Filters'}</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="bg-white border border-red-100 rounded-lg min-h-[450px]">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-sm font-medium text-gray-700">NC Report Results</h2>
                        {reportData.length > 0 && <PageSizeOptions pagination={pagination} onLimitChange={handleLimitChange} pageSizeOptions={getPageSizeOptions()} />}
                    </div>

                    <DynamicFilterBuilder columnOptions={columnOptions} tableFilters={tableFilters} setTableFilters={setTableFilters} onClearAll={clearTableFilters} onApply={() => fetchReport(1)} getUniqueValues={getUniqueValues} loading={loading} />

                    {reportData.length > 0 ? (
                        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                            <table className="min-w-full">
                                <thead style={{ backgroundColor: '#efeeee' }} className="border-b border-gray-200 sticky top-0 text-left">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Checklist</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Auditor</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Activity</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Process</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">NC Reason</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reportData.map((item, index) => (
                                        <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                <div className="font-medium mb-1">{item.checklist_name}</div>
                                                <div className="flex flex-wrap gap-1">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">{item.location}</span>
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">{item.department}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.auditor}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.item_description}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.item_process}</td>
                                            <td className="px-4 py-3 text-sm text-red-600">{item.nc_reason || '-'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.supervisor_status === 'Accepted' ? 'bg-green-100 text-green-800' : item.supervisor_status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {item.supervisor_status || 'Pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-4 text-center text-gray-500 text-xs">{loading ? 'Loading data...' : 'No records found. Adjust filters to search.'}</div>
                    )}

                    {reportData.length > 0 && <Pagination pagination={pagination} onPageChange={handlePageChange} />}
                </div>
            </div>
        </>
    );
};

export default NCReport;
