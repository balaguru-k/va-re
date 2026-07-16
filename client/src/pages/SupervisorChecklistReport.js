import React, { useState, useEffect, useCallback, useRef } from 'react';
import { checklistAPI } from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import toast from 'react-hot-toast';

const MultiSelectDropdown = ({ options, selected, onChange, placeholder = 'Select...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) { setIsOpen(false); setSearch(''); }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
    const toggle = (id) => onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
    const selectedNames = options.filter(o => selected.includes(o.id)).map(o => o.name);

    return (
        <div ref={ref} className="relative">
            <div onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[38px] flex items-center flex-wrap gap-1">
                {selectedNames.length > 0 ? selectedNames.map((name, i) => (
                    <span key={i} className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        {name}
                        <button onClick={(e) => { e.stopPropagation(); const opt = options.find(o => o.name === name); if (opt) toggle(opt.id); }} className="hover:text-red-600 font-bold">×</button>
                    </span>
                )) : <span className="text-gray-400">{placeholder}</span>}
            </div>
            {isOpen && (
                <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search..." autoFocus
                        className="w-full px-3 py-2 border-b border-gray-300 text-sm focus:outline-none" />
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

const getCriticalityColor = (c) => {
    const v = (c || '').toLowerCase();
    if (v === 'high') return 'bg-red-100 text-red-700';
    if (v === 'medium') return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
};

const getStatusCellStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'yes') return { color: '#22c55e' };
    if (s === 'no') return { color: '#ef4444' };
    if (s === 'na') return { color: '#9ca3af' };
    if (s === 'rejected') return { color: '#ef4444' };
    if (s === 'accepted') return { color: '#22c55e' };
    return { color: '#6b7280' };
};


const SupervisorChecklistReport = () => {
    const today = new Date().toISOString().split('T')[0];

    const [filters, setFilters] = useState({ fromDate: today, toDate: today, checklistIds: [] });
    const [checklistOptions, setChecklistOptions] = useState([]);
    const [reportData, setReportData] = useState([]);
    const [dateColumns, setDateColumns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        checklistAPI.getSupervisorChecklistList()
            .then(res => setChecklistOptions(
                (res.data.data || []).map(cl => ({ id: cl.id, name: cl.checklist_name }))
            ))
            .catch(() => toast.error('Failed to load checklists'));
        fetchReport({ fromDate: today, toDate: today, checklistIds: [] });
    }, []);

    const fetchReport = useCallback(async (overrideFilters) => {
        setLoading(true);
        const active = overrideFilters || filters;
        try {
            const params = {
                fromDate: active.fromDate,
                toDate: active.toDate,
                ...(active.checklistIds.length > 0 && { checklistIds: active.checklistIds.join(',') }),
            };
            const res = await checklistAPI.getSupervisorChecklistReport(params);
            setReportData(res.data.data || []);
            setDateColumns(res.data.dateColumns || []);
        } catch {
            toast.error('Failed to load report');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {
                fromDate: filters.fromDate,
                toDate: filters.toDate,
                ...(filters.checklistIds.length > 0 && { checklistIds: filters.checklistIds.join(',') }),
            };
            const res = await checklistAPI.exportSupervisorChecklistReport(params);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `Checklist_Report_${today}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleReset = () => {
        const reset = { fromDate: today, toDate: today, checklistIds: [] };
        setFilters(reset);
        fetchReport(reset);
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Checklist Report" />

            {/* Filters */}
            <div className="bg-white border border-red-100 rounded-lg p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                        <input
                            type="date"
                            value={filters.fromDate}
                            max={filters.toDate || undefined}
                            onChange={e => setFilters(p => ({ ...p, fromDate: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                        <input
                            type="date"
                            value={filters.toDate}
                            min={filters.fromDate || undefined}
                            onChange={e => setFilters(p => ({ ...p, toDate: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Checklist</label>
                        <MultiSelectDropdown
                            options={checklistOptions}
                            selected={filters.checklistIds}
                            onChange={ids => setFilters(p => ({ ...p, checklistIds: ids }))}
                            placeholder="All Checklists"
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <button
                            onClick={() => fetchReport()}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50"
                            style={{ background: '#C50B34' }}
                        >
                            {loading ? 'Loading...' : 'Apply'}
                        </button>
                        <button
                            onClick={handleReset}
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

            {/* Report */}
            {loading ? (
                <div className="bg-white border border-red-100 rounded-lg p-8 text-center text-gray-500 text-sm">
                    Loading report data...
                </div>
            ) : reportData.length === 0 ? (
                <div className="bg-white border border-red-100 rounded-lg p-8 text-center text-gray-400 text-sm">
                    No data found for the selected filters.
                </div>
            ) : (
                reportData.map((checklist, ci) => (
                    <div key={ci} className="bg-white border border-red-100 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                            <div className="flex flex-wrap items-center gap-4">
                                <h2 className="text-sm font-semibold text-gray-700">{checklist.checklist_name}</h2>
                                <span className="text-xs text-gray-500">Location: <span className="font-medium text-gray-700">{checklist.location}</span></span>
                                <span className="text-xs text-gray-500">Department: <span className="font-medium text-gray-700">{checklist.department}</span></span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                                <thead style={{ backgroundColor: '#efeeee' }}>
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap w-40">Process</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Activity</th>
                                        {dateColumns.map(date => (
                                            <th key={date} className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap" style={{ minWidth: '90px' }}>
                                                {date}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {checklist.items.map((item, ii) => (
                                        <tr key={ii} className={ii % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-2 text-gray-700 align-middle">{item.process}</td>
                                            <td className="px-4 py-2 align-middle">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-gray-700">{item.activity}</span>
                                                    <span className={`self-start px-2 py-0.5 rounded-full text-xs font-medium ${getCriticalityColor(item.criticality)}`}>
                                                        {item.criticality}
                                                    </span>
                                                </div>
                                            </td>
                                            {dateColumns.map(date => {
                                                const resp = item.responses?.[date];
                                                const cellStyle = resp ? getStatusCellStyle(resp.status) : { backgroundColor: '#f9fafb', color: '#9ca3af' };
                                                const title = resp ? [
                                                    `Status: ${resp.status}`,
                                                    resp.auditor ? `Auditor: ${resp.auditor}` : '',
                                                    resp.reason ? `Reason: ${resp.reason}` : ''
                                                ].filter(Boolean).join('\n') : '';
                                                return (
                                                    <td key={date} title={title} className="text-center font-medium text-xs cursor-default" style={{ ...cellStyle, padding: '8px' }}>
                                                        {resp ? resp.status : '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default SupervisorChecklistReport;
