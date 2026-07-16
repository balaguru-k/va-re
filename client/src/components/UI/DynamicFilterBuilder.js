import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, FunnelIcon } from '@heroicons/react/24/solid';
import MultiSelectDropdown from './MultiSelectDropdown';

const DynamicFilterBuilder = ({ 
    columnOptions, 
    tableFilters, 
    setTableFilters, 
    onClearAll,
    onApply,
    getUniqueValues,
    loading = false
}) => {
    const [selectedColumn, setSelectedColumn] = useState('');

    const isTableFiltered = Object.values(tableFilters).some(val => val.length > 0);

    const displayOptions = selectedColumn ? getUniqueValues(selectedColumn).map(val => ({ 
        value: val.toString(), 
        label: val.toString() 
    })) : [];

    const handleBadgeClick = (key) => {
        setSelectedColumn(key);
    };

    const handleClearAll = () => {
        onClearAll();
        onApply();
    };

    return (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-wrap items-end gap-4 text-left">
                <div className="w-64 text-left">
                    <label className="block text-[10px] font text-gray-400 mb-1 tracking-wider text-left">Select Column to Filter</label>
                    <select
                        value={selectedColumn}
                        onChange={(e) => setSelectedColumn(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-white focus:ring-1 focus:ring-red-500 outline-none transition-all"
                    >
                        <option value="">-- Choose Column --</option>
                        {columnOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                
                <div className="w-80 text-left">
                    <label className="block text-[10px] font text-gray-400 mb-1 tracking-wider text-left">
                        {selectedColumn ? `Filter ${columnOptions.find(o => o.value === selectedColumn)?.label}` : 'Select Values'}
                    </label>
                    <MultiSelectDropdown
                        options={displayOptions}
                        selected={selectedColumn ? tableFilters[selectedColumn] : []}
                        onChange={(val) => setTableFilters(prev => ({ ...prev, [selectedColumn]: val }))}
                        placeholder={selectedColumn ? `All ${columnOptions.find(o => o.value === selectedColumn)?.label}...` : "First select a column"}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onApply}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5"
                        style={{ background: '#C50B34' }}
                    >
                        <FunnelIcon className="w-3.5 h-3.5" />
                        {loading ? 'Filtering...' : 'Apply Filter'}
                    </button>

                    {isTableFiltered && (
                        <button
                            onClick={handleClearAll}
                            className="text-xs text-gray-500 hover:text-red-600 font-medium whitespace-nowrap px-2 py-2 transition-colors flex items-center gap-1.5"
                        >
                            <XMarkIcon className="w-3.5 h-3.5" />
                            Reset All
                        </button>
                    )}
                </div>
            </div>

            {/* Active Filter Badges */}
            {isTableFiltered && (
                <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-200 text-left">
                    <span className="text-[10px] font-bold text-gray-400 uppercase self-center mr-2">Applied:</span>
                    {Object.entries(tableFilters).map(([key, values]) => {
                        if (values.length === 0) return null;
                        const label = columnOptions.find(o => o.value === key)?.label;
                        return (
                            <div 
                                key={key} 
                                onClick={() => handleBadgeClick(key)}
                                className="bg-white border border-red-100 rounded shadow-sm py-1 px-2.5 flex items-center gap-2 cursor-pointer hover:bg-red-50 hover:border-red-300 transition-all group"
                            >
                                <span className="text-[11px] font-semibold text-red-800">{label}:</span>
                                <span className="text-[11px] text-gray-600 truncate max-w-[250px]">{values.join(', ')}</span>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTableFilters(prev => ({ ...prev, [key]: [] }));
                                    }}
                                    className="text-gray-300 hover:text-red-600 font-bold ml-1 transition-colors p-0.5"
                                    title="Remove filter"
                                >
                                    <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DynamicFilterBuilder;
