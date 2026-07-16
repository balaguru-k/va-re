import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { checklistAPI } from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import MultiSelectDropdown from '../../components/UI/MultiSelectDropdown';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon, FunnelIcon } from '@heroicons/react/24/solid';
import usePagination from '../../hooks/usePagination';
import Pagination from '../../components/UI/Pagination';
import PageSizeOptions from '../../components/UI/PageSizeOptions';
import DynamicFilterBuilder from '../../components/UI/DynamicFilterBuilder';
import useUserFilterOptions from '../../hooks/useUserFilterOptions';

const ReasonAnalysisReport = () => {
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [expandedReasons, setExpandedReasons] = useState({});
    const [previewImage, setPreviewImage] = useState(null);
    const [previewImages, setPreviewImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showImageModal, setShowImageModal] = useState(false);
    const { pagination, updateFromResponse, goToPage, setLimit, getPageSizeOptions } = usePagination(1, 50);

    // Filter States
    const [filters, setFilters] = useState({
        fromDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0]
    });

    // Filter Results
    const [tableFilters, setTableFilters] = useState({
        category: [],
        representative: [],
        count: [],
        activity: [],
        process: [],
        criticality: [],
        department: [],
        location: []
    });
    const { categories, locations, departments , fetchOptions } = useUserFilterOptions();
    const [allData, setAllData] = useState([]);

    useEffect(() => {
        fetchOptions({ category: tableFilters.category, location: tableFilters.location });
    }, [tableFilters.category, tableFilters.location, fetchOptions]);

    useEffect(() => {
        fetchReport();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!showImageModal) return;
            if (e.key === 'Escape') setShowImageModal(false);
            else if (e.key === 'ArrowLeft') setCurrentImageIndex(prev => prev > 0 ? prev - 1 : previewImages.length - 1);
            else if (e.key === 'ArrowRight') setCurrentImageIndex(prev => prev < previewImages.length - 1 ? prev + 1 : 0);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showImageModal, previewImages.length]);
    const isManager = user?.role === 'Manager';

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
                page, 
                limit,
                ...serializedTableFilters
            };
            if (filters.fromDate) params.fromDate = filters.fromDate;
            if (filters.toDate) params.toDate = filters.toDate;

            const response = await axios.get(`${process.env.REACT_APP_API_URL}/reports/analysis`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            setData(response.data.data);
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
            toDate: '',
            locationId: '',
            departmentIds: []
        });
        setData([]);
    };

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

            const params = new URLSearchParams();
            if (filters.fromDate) params.append('fromDate', filters.fromDate);
            if (filters.toDate) params.append('toDate', filters.toDate);

            // Add table filters to export
            Object.entries(serializedTableFilters).forEach(([key, value]) => {
                params.append(key, value);
            });

            const response = await axios.get(`${process.env.REACT_APP_API_URL}/reports/analysis/export?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Reason_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`;
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

    const getUniqueValues = (field) => {
        if (field === 'category') return categories;
        if (field === 'location') return locations;
        if (field === 'department') return departments;
        const source = allData.length > 0 ? allData : data;
        if (!source || source.length === 0) return [];
        let values = [];
        if (field === 'activity') {
            source.forEach(item => { if (item.activities) values.push(...item.activities); });
        } else if (field === 'process') {
            source.forEach(item => { if (item.processes) values.push(...item.processes); });
        } else {
            values = source.map(item => item[field]);
        }
        return [...new Set(values)].filter(Boolean).sort();
    };

    // Table filtering is now handled server-side
    const filteredData = data;

    const clearTableFilters = () => {
        setTableFilters({
            category: [],
            representative: [],
            count: [],
            activity: [],
            process: [],
            criticality: [],
            department: [],
            location: []
        });
    };

    const isTableFiltered = Object.values(tableFilters).some(val => val.length > 0);

    const columnOptions = [
        { value: 'category', label: 'Category' },
        { value: 'representative', label: 'Reason Description' },
        { value: 'count', label: 'Count' },
        { value: 'activity', label: 'Activity' },
        { value: 'process', label: 'Process' },
        { value: 'criticality', label: 'Criticality' },
        { value: 'department', label: 'Department' },
        { value: 'location', label: 'Location' }
    ];



    return (
        <div className="container mx-auto px-4 py-2">
            <div className="mb-8 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Reason Analysis Report</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        disabled={exporting || data.length === 0}
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
                        style={{ background: '#C50B34' }} // Added inline style to match NCReport color if bg-btn-primary is not defined globally same way
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
                            {data.length > 0 && (
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

                {data.length > 0 ? (
                    <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                        <table className="min-w-full">
                            <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">S.No</th>
                                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Reason Description</th>
                                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Image</th>
                                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Count</th>
                                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Activity</th>
                                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Process</th>
                                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Criticality</th>
                                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Department</th>
                                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Location</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100">
                                {filteredData.map((item, index) => (
                                    <React.Fragment key={index}>
                                        <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {(pagination.page - 1) * pagination.limit + index + 1}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                <div
                                                    className="cursor-pointer hover:text-indigo-600 flex items-center gap-2"
                                                    onClick={() => setExpandedReasons(prev => ({ ...prev, [index]: !prev[index] }))}
                                                >
                                                    {item.raw_reasons && item.raw_reasons.length > 1 && (
                                                        <svg
                                                            className={`w-4 h-4 transform transition-transform ${expandedReasons[index] ? 'rotate-90' : ''}`}
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    )}
                                                    {item.representative}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {item.image_name ? (
                                                    Array.isArray(item.image_name) && item.image_name.length > 0 ? (
                                                        <div className="relative">
                                                            <img
                                                                src={`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${item.image_name[0]}`}
                                                                alt="evidence"
                                                                className="w-12 h-12 object-cover rounded cursor-pointer border border-gray-200 hover:opacity-80"
                                                                onClick={() => {
                                                                    setPreviewImages(item.image_name.map(i => `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${i}`));
                                                                    setCurrentImageIndex(0);
                                                                    setShowImageModal(true);
                                                                }}
                                                            />
                                                            {item.image_name.length > 1 && (
                                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                                    {item.image_name.length}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${item.image_name}`}
                                                            alt="evidence"
                                                            className="w-12 h-12 object-cover rounded cursor-pointer border border-gray-200 hover:opacity-80"
                                                            onClick={() => {
                                                                setPreviewImages([`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${item.image_name}`]);
                                                                setCurrentImageIndex(0);
                                                                setShowImageModal(true);
                                                            }}
                                                        />
                                                    )
                                                ) : (
                                                    <span className="text-gray-400 text-xs">No image</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    {item.count}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {item.activities && item.activities.length > 0 ? [...new Set(item.activities)].join(', ') : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {item.processes && item.processes.length > 0 ? [...new Set(item.processes)].join(', ') : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {item.criticality ? (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        item.criticality.toLowerCase() === 'high' ? 'bg-red-100 text-red-800' :
                                                        item.criticality.toLowerCase() === 'low' ? 'bg-green-100 text-green-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {item.criticality}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                    {item.department || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                    {item.location || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                        {expandedReasons[index] && item.raw_reasons && item.raw_reasons.length > 1 && (
                                            <tr className="bg-gray-50">
                                                <td colSpan="7" className="px-4 py-4">
                                                    <div className="ml-8 p-3 bg-white rounded border border-gray-200 shadow-inner">
                                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detailed Matches:</h4>
                                                        <ul className="list-disc list-inside space-y-1">
                                                            {item.raw_reasons.map((reasonObj, rIndex) => (
                                                                <li key={rIndex} className="text-sm text-gray-600">
                                                                    <span className="font-medium text-blue-600">{reasonObj.date}</span> - {reasonObj.reason}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
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
                {data.length > 0 && (
                    <Pagination
                        pagination={pagination}
                        onPageChange={handlePageChange}
                    />
                )}
            </div>
            {showImageModal && previewImages.length > 0 && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
                    onClick={() => setShowImageModal(false)}
                >
                    <div className="relative w-full h-full flex items-center justify-center">
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        <a
                            href={previewImages[currentImageIndex]}
                            download={`image-${currentImageIndex + 1}.jpg`}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-4 right-16 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                        >
                            <ArrowDownTrayIcon className="w-6 h-6" />
                        </a>
                        {previewImages.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev > 0 ? prev - 1 : previewImages.length - 1); }}
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                                >
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev < previewImages.length - 1 ? prev + 1 : 0); }}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                                >
                                    <ChevronRightIcon className="w-6 h-6" />
                                </button>
                            </>
                        )}
                        <img
                            src={previewImages[currentImageIndex]}
                            alt={`Preview ${currentImageIndex + 1}`}
                            className="w-full h-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {previewImages.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">
                                {currentImageIndex + 1} / {previewImages.length}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReasonAnalysisReport;
