import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const MultiSelectDropdown = forwardRef(({ options, selected, onChange, onOpen, onClose, placeholder = 'Select...', searchPlaceholder = 'Search...', emptyMessage = 'No options found' }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    setOpen: (state) => {
      setIsOpen(state);
      if (state && onOpen) onOpen();
      if (!state && onClose) onClose();
    }
  }));

  const openDropdown = () => {
    setIsOpen(true);
    if (onOpen) onOpen();
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setSearch('');
    if (onClose) onClose();
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen]);

  const uniqueOptions = options.filter((o, i, arr) => arr.findIndex(x => x.value === o.value) === i);
  const filtered = uniqueOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const toggle = (val) => onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  const selectedLabels = uniqueOptions.filter(o => selected.includes(o.value)).map(o => o.label);

  return (
    <div ref={containerRef} className="relative">
      <div onClick={() => { if (isOpen) closeDropdown(); else openDropdown(); }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white cursor-pointer min-h-[38px] flex items-center flex-wrap gap-1 hover:border-red-400 transition-colors">
        {selectedLabels.length > 0 ? selectedLabels.map((name, i) => (
          <span key={`${name}_${i}`} className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            {name}
            <button type="button" onClick={(e) => { e.stopPropagation(); const opt = uniqueOptions.find(o => o.label === name); if (opt) toggle(opt.value); }} className="hover:text-red-600 font-bold">×</button>
          </span>
        )) : <span className="text-gray-400">{placeholder}</span>}
      </div>
      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder} className="w-full px-3 py-2 border-b border-gray-300 text-sm focus:outline-none" autoFocus />
          <div className="max-h-48 overflow-y-auto">
            {filtered.length > 0 ? filtered.map((opt, idx) => (
              <label key={`${opt.value}_${idx}`} className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-100">
                <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} className="mr-2 accent-red-600" />
                {opt.label}
              </label>
            )) : <div className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</div>}
          </div>
          {uniqueOptions.length > 0 && (
            <div className="flex justify-between px-3 py-2 border-t border-gray-200 text-xs">
              <button type="button" onClick={() => onChange(uniqueOptions.map(o => o.value))} className="text-red-600 hover:underline">Select All</button>
              <button type="button" onClick={() => onChange([])} className="text-gray-500 hover:underline">Clear All</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default MultiSelectDropdown;
