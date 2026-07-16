import React, { useState, useRef, useEffect } from 'react';

const SearchableSelect = ({ options, value, onChange, placeholder = "Select...", displayKey = 'label', valueKey = 'value', multiSelect = false, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    const selectedValues = multiSelect ? (Array.isArray(value) ? value : []) : null;
    const selectedOption = !multiSelect ? options.find(opt => opt[valueKey] == value) : null;
    const filteredOptions = options.filter(opt =>
        opt[displayKey]?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        if (multiSelect) {
            const val = option[valueKey];
            const updated = selectedValues.includes(val)
                ? selectedValues.filter(v => v !== val)
                : [...selectedValues, val];
            onChange(updated);
        } else {
            onChange(option[valueKey]);
            setIsOpen(false);
            setSearchTerm('');
        }
    };

    const getDisplayLabel = () => {
        if (multiSelect) {
            if (!selectedValues.length) return placeholder;
            const labels = selectedValues.map(v => options.find(o => o[valueKey] == v)?.[displayKey]).filter(Boolean);
            return labels.join(', ');
        }
        return selectedOption ? selectedOption[displayKey] : placeholder;
    };

    return (
        <div ref={wrapperRef} className="relative">
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm truncate focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white cursor-pointer'}`}
            >
                {getDisplayLabel()}
            </div>

            {isOpen && (
                <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Type to search..."
                        className="w-full px-3 py-2 border-b border-gray-300 text-sm focus:outline-none"
                        autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto">
                        {multiSelect && filteredOptions.length > 0 && (
                            <div
                                onClick={() => {
                                    if (selectedValues.length === filteredOptions.length) {
                                        onChange([]);
                                    } else {
                                        onChange(filteredOptions.map(o => o[valueKey]));
                                    }
                                }}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200 font-medium ${selectedValues.length === filteredOptions.length ? 'bg-blue-50' : ''}`}
                            >
                                <input type="checkbox" readOnly checked={selectedValues.length === filteredOptions.length} className="w-3.5 h-3.5 pointer-events-none" />
                                Select All
                            </div>
                        )}
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => {
                                const isSelected = multiSelect
                                    ? selectedValues.includes(option[valueKey])
                                    : option[valueKey] == value;
                                return (
                                    <div
                                        key={option[valueKey]}
                                        onClick={() => handleSelect(option)}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 flex items-center gap-2 ${
                                            isSelected ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        {multiSelect && (
                                            <input type="checkbox" readOnly checked={isSelected} className="w-3.5 h-3.5 pointer-events-none" />
                                        )}
                                        {option[displayKey]}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
