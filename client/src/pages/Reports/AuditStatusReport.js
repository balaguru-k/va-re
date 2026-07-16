import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Pagination from '../../components/UI/Pagination';
import PageSizeOptions from '../../components/UI/PageSizeOptions';
import DynamicFilterBuilder from '../../components/UI/DynamicFilterBuilder';
import { XMarkIcon, EnvelopeIcon } from '@heroicons/react/24/solid';
import useUserFilterOptions from '../../hooks/useUserFilterOptions';

const AuditStatusReport = () => {
    const { token, user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportingDetailed, setExportingDetailed] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailData, setEmailData] = useState({ to: '', cc: '' });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [pagination, setPagination] = useState({
        page: parseInt(searchParams.get('page')) || 1,
        pages: 1,
        total: 0,
        limit: parseInt(searchParams.get('limit')) || 50
    });

    // Initialize filters from URL params
    const [filters, setFilters] = useState({
        fromDate: searchParams.get('fromDate') || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        toDate: searchParams.get('toDate') || new Date().toISOString().split('T')[0]
    });

    const [tableFilters, setTableFilters] = useState({
        category_name: searchParams.get('category_name') ? searchParams.get('category_name').split('|||') : [],
        location_name: searchParams.get('location_name') ? searchParams.get('location_name').split('|||') : []
    });

    const { categories, locations, fetchOptions } = useUserFilterOptions();

    // Fetch cascading filter options when tableFilters change
    useEffect(() => {
        fetchOptions({
            category_name: tableFilters.category_name,
            location_name: tableFilters.location_name
        });
    }, [tableFilters.category_name, tableFilters.location_name, fetchOptions]);

    // Initial load
    useEffect(() => {
        fetchOptions();
        fetchReport(pagination.page, pagination.limit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync filters to URL params
    const syncUrlParams = useCallback((page, limit, mainFilters, tblFilters) => {
        const params = new URLSearchParams();
        if (mainFilters.fromDate) params.set('fromDate', mainFilters.fromDate);
        if (mainFilters.toDate) params.set('toDate', mainFilters.toDate);
        if (page > 1) params.set('page', page);
        if (limit !== 50) params.set('limit', limit);
        Object.entries(tblFilters).forEach(([key, values]) => {
            if (values.length > 0) params.set(key, values.join('|||'));
        });
        setSearchParams(params, { replace: true });
    }, [setSearchParams]);

    const fetchReport = async (page = 1, limitOverride = pagination.limit) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.fromDate) params.append('fromDate', filters.fromDate);
            if (filters.toDate) params.append('toDate', filters.toDate);
            params.append('page', page);
            params.append('limit', limitOverride || 50);

            // Add table filters
            Object.entries(tableFilters).forEach(([key, values]) => {
                if (values.length > 0) params.append(key, values.join('|||'));
            });

            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/reports/audit-status?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setReportData(response.data.data);
            setPagination(prev => ({
                page: response.data.pagination?.currentPage || 1,
                pages: response.data.pagination?.totalPages || 1,
                total: response.data.pagination?.totalRecords || 0,
                limit: prev.limit
            }));

            // Sync URL
            syncUrlParams(page, limitOverride || pagination.limit, filters, tableFilters);
            
            if (response.data.data.length === 0) {
                toast.success('No audit status records found for the selected criteria');
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
        setTableFilters({ category_name: [], location_name: [] });
        setReportData([]);
        setSearchParams({}, { replace: true });
    };

    const clearTableFilters = () => {
        setTableFilters({ category_name: [], location_name: [] });
    };

    const getUniqueValues = (field) => {
        if (field === 'category_name') return categories;
        if (field === 'location_name') return locations;
        return [];
    };

    const columnOptions = [
        { value: 'category_name', label: 'Category' },
        { value: 'location_name', label: 'Location' }
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

            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/reports/audit-status/export?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Audit_Status_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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

    const handleExportDetailed = async () => {
        setExportingDetailed(true);
        try {
            const params = new URLSearchParams();
            if (filters.fromDate) params.append('fromDate', filters.fromDate);
            if (filters.toDate) params.append('toDate', filters.toDate);
            Object.entries(tableFilters).forEach(([key, values]) => {
                if (values.length > 0) params.append(key, values.join('|||'));
            });

            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/reports/audit-status/export-detailed?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Audit_Status_Report_Detailed_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Detailed report exported successfully');
        } catch (error) {
            console.error('Error exporting detailed report:', error);
            toast.error('Failed to export detailed report');
        } finally {
            setExportingDetailed(false);
        }
    };

    const handleOpenEmailModal = async () => {
        try {
            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/reports/audit-status/email-config`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmailData({ to: response.data.to || '', cc: response.data.cc || '' });
        } catch (error) {
            setEmailData({ to: '', cc: '' });
        }
        setShowEmailModal(true);
    };

    const handleSendEmail = async () => {
        setSendingEmail(true);
        try {
            const body = {
                to: emailData.to,
                cc: emailData.cc,
                fromDate: filters.fromDate,
                toDate: filters.toDate
            };
            Object.entries(tableFilters).forEach(([key, values]) => {
                if (values.length > 0) body[key] = values.join('|||');
            });
            await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/reports/audit-status/send-email`, body, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Email queued successfully');
            setShowEmailModal(false);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to send email');
        } finally {
            setSendingEmail(false);
        }
    };

    return (
        <>
            <div className="container mx-auto px-4 py-2">
                <div className="mb-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">Audit Status Report</h1>
                    <div className="flex gap-2">
                        {!['Manager', 'Supervisor'].includes(user?.role) && (
                        <button
                            onClick={handleOpenEmailModal}
                            disabled={reportData.length === 0}
                            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
                            style={{background: '#C50B34'}}
                        >
                            <EnvelopeIcon className="w-4 h-4" />
                            Email
                        </button>
                        )}
                        <button
                            onClick={handleExportDetailed}
                            disabled={exportingDetailed || reportData.length === 0}
                            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
                            style={{background: '#C50B34'}}
                        >
                            {exportingDetailed ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            )}
                            {exportingDetailed ? 'Exporting...' : 'Export Detailed'}
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting || reportData.length === 0}
                            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
                            style={{background: '#C50B34'}}
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
                            {exporting ? 'Exporting...' : 'Export Summary'}
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
                            <h2 className="text-sm font-medium text-gray-700">Audit Status Report Results</h2>
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
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Category</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Location</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">No. of Location</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total Camera Count</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Camera Audited</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Camera Random Audited</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Camera Not Audited</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Camera Offline</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Offline %</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Technical Issues</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Technical %</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total NCs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reportData.map((item, index) => (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                    {item.category_name}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.location_name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.no_of_location}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.camera_count}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.total_camera_audited}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.total_camera_random_audited}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.total_camera_not_audited}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.total_camera_offline}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.total_camera_offline_percentage}%</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.total_camera_technical_issues}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.total_camera_technical_issues_percentage}%</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.total_ncs}</td>
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

            {/* Email Modal */}
            {showEmailModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Send Audit Status Report</h3>
                            <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                                <textarea
                                    value={emailData.to}
                                    onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                                    placeholder="user1@example.com, user2@example.com"
                                    rows="3"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CC</label>
                                <textarea
                                    value={emailData.cc}
                                    onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
                                    placeholder="cc1@example.com, cc2@example.com"
                                    rows="3"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
                            <button
                                onClick={() => setShowEmailModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={!emailData.to || sendingEmail}
                                className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-lg transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
                                style={{background: '#C50B34'}}
                            >
                                {sendingEmail ? 'Sending...' : 'Send Mail'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AuditStatusReport;
