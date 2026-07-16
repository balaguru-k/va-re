import React, { useState, useRef, useEffect } from 'react';

const SearchableMultiSelect = ({ options, value = [], onChange, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    const selectedOptions = options.filter(opt => value.includes(opt.value));
    const filteredOptions = options.filter(opt =>
        opt.label?.toLowerCase().includes(searchTerm.toLowerCase())
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

    const toggleOption = (optValue) => {
        const newValue = value.includes(optValue)
            ? value.filter(v => v !== optValue)
            : [...value, optValue];
        onChange(newValue);
    };

    const removeTag = (e, optValue) => {
        e.stopPropagation();
        onChange(value.filter(v => v !== optValue));
    };

    return (
        <div ref={wrapperRef} className="relative">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[38px]"
            >
                {selectedOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {selectedOptions.map(opt => (
                            <span key={opt.value} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                {opt.label}
                                <button type="button" onClick={(e) => removeTag(e, opt.value)} className="hover:text-red-900 font-bold">×</button>
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-gray-400">{placeholder}</span>
                )}
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
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => toggleOption(option.value)}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 flex items-center gap-2 ${
                                        value.includes(option.value) ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={value.includes(option.value)}
                                        readOnly
                                        className="w-3.5 h-3.5 text-red-600 rounded border-gray-300 pointer-events-none"
                                    />
                                    {option.label}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableMultiSelect;
