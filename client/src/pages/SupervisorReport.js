import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/UI/PageHeader';
import toast from 'react-hot-toast';

const MultiSelectDropdown = ({ options, selected, onChange, placeholder = 'Select...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);
    useEffect(() => {
        const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) { setIsOpen(false); setSearch(''); } };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);
    const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
    const toggle = (id) => onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
    const selectedNames = options.filter(o => selected.includes(o.id)).map(o => o.name);
    return (
        <div ref={ref} className="relative">
            <div onClick={() => setIsOpen(!isOpen)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white cursor-pointer min-h-[38px] flex items-center flex-wrap gap-1">
                {selectedNames.length > 0 ? selectedNames.map((name, i) => (
                    <span key={i} className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        {name}
                        <button onClick={(e) => { e.stopPropagation(); const opt = options.find(o => o.name === name); if (opt) toggle(opt.id); }} className="hover:text-red-600 font-bold">×</button>
                    </span>
                )) : <span className="text-gray-400">{placeholder}</span>}
            </div>
            {isOpen && (
                <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." autoFocus className="w-full px-3 py-2 border-b border-gray-300 text-sm focus:outline-none" />
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.length > 0 ? filtered.map(opt => (
                            <label key={opt.id} className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-100">
                                <input type="checkbox" checked={selected.includes(opt.id)} onChange={() => toggle(opt.id)} className="mr-2 accent-red-600" />
                                {opt.name}
                            </label>
                        )) : <div className="px-3 py-2 text-sm text-gray-500">No results found</div>}
                    </div>
                    {options.length > 0 && (
                        <div className="flex justify-between px-3 py-2 border-t border-gray-200 text-xs">
                            <button onClick={() => onChange(options.map(o => o.id))} className="text-red-600 hover:underline">Select All</button>
                            <button onClick={() => onChange([])} className="text-gray-500 hover:underline">Clear All</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ReportSection = ({ title, data, dateColumns, loading }) => (
    <div className="bg-white border border-red-100 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-700">{title}</h2>
        </div>
        {loading ? (
            <div className="p-4 text-center text-gray-500 text-xs">Loading report data...</div>
        ) : dateColumns.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead style={{ backgroundColor: '#efeeee' }} className="border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Metrics</th>
                            {dateColumns.map(date => (
                                <th key={date} className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                    {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {[
                            { label: 'Total Assigned', key: 'totalAssigned', cls: 'text-gray-900' },
                            { label: 'Completed', key: 'completedChecklists', cls: 'text-green-600 font-semibold' },
                            { label: 'Expired', key: 'expiredChecklists', cls: 'text-red-600 font-semibold' },
                            { label: 'Total NCs', key: 'totalNCs', cls: 'text-orange-600 font-semibold' },
                            { label: 'Critical NCs', key: 'criticalNCs', cls: 'text-red-700 font-semibold' },
                            { label: 'Non-Critical NCs', key: 'nonCriticalNCs', cls: 'text-yellow-600 font-semibold' },
                        ].map(({ label, key, cls }, i) => (
                            <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-700">{label}</td>
                                {dateColumns.map(date => (
                                    <td key={date} className={`px-4 py-3 text-center text-sm ${cls}`}>
                                        {data[date]?.[key] || 0}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="p-4 text-center text-gray-500 text-xs">No data found for the selected date range.</div>
        )}
    </div>
);

const SupervisorReport = () => {
    const { token } = useAuth();
    const [reportData, setReportData] = useState({});
    const [executiveData, setExecutiveData] = useState({});
    const [dateColumns, setDateColumns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [filters, setFilters] = useState({
        fromDate: new Date().toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0],
        executiveIds: []
    });
    const [executives, setExecutives] = useState([]);

    useEffect(() => {
        fetchExecutives();
        fetchReportData();
    }, []);

    const fetchExecutives = async () => {
        try {
            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/reports/supervisor-executives`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExecutives(response.data.data || []);
        } catch (error) {
            console.error('Error fetching executives:', error);
        }
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('fromDate', filters.fromDate);
            params.append('toDate', filters.toDate);
            if (filters.executiveIds.length > 0) params.append('executiveIds', filters.executiveIds.join(','));

            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL}/api/reports/supervisor-report?${params.toString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setReportData(response.data.data || {});
            setExecutiveData(response.data.executiveData || {});
            setDateColumns(response.data.dateColumns || []);
        } catch (error) {
            console.error('Error fetching report:', error);
            toast.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        fetchReportData();
    };

    const handleResetFilters = () => {
        const today = new Date().toISOString().split('T')[0];
        setFilters({ fromDate: today, toDate: today, executiveIds: [] });
        setReportData({});
        setExecutiveData({});
        setDateColumns([]);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            params.append('fromDate', filters.fromDate);
            params.append('toDate', filters.toDate);
            if (filters.executiveIds.length > 0) params.append('executiveIds', filters.executiveIds.join(','));
            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL}/api/reports/supervisor-report/export?${params.toString()}`,
                { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
            );
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `Supervisor_Report_${filters.fromDate}_to_${filters.toDate}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Export failed');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Supervisor Report" />

            {/* Filters */}
            <div className="bg-white border border-red-100 rounded-lg p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                        <input
                            type="date"
                            name="fromDate"
                            value={filters.fromDate}
                            max={filters.toDate || undefined}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                        <input
                            type="date"
                            name="toDate"
                            value={filters.toDate}
                            min={filters.fromDate || undefined}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Executive User</label>
                        <MultiSelectDropdown
                            options={executives.map(e => ({ id: e.id, name: e.username }))}
                            selected={filters.executiveIds}
                            onChange={ids => setFilters(p => ({ ...p, executiveIds: ids }))}
                            placeholder="All Executives"
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <button
                            onClick={handleApplyFilters}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
                            style={{ background: '#C50B34' }}
                        >
                            {loading ? 'Loading...' : 'Apply'}
                        </button>
                        <button
                            onClick={handleResetFilters}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            {exporting ? 'Exporting...' : 'Export'}
                        </button>
                    </div>
                </div>
            </div>

            {/* NSC Report Table */}
            <ReportSection title="Supervisor Report" data={reportData} dateColumns={dateColumns} loading={loading} />

            {/* SC / Executive Report Table */}
            <ReportSection title="Executive Report" data={executiveData} dateColumns={dateColumns} loading={loading} />
        </div>
    );
};

export default SupervisorReport;