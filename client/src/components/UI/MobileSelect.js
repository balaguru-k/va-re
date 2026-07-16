import React, { useState } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, CheckIcon } from '@heroicons/react/24/outline';

const isMobileDevice = window.innerWidth <= 768;

const MobileSelect = ({ label, value, onChange, options, placeholder = 'Select...', required = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find(o => String(o.value) === String(value));

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full px-3 py-2 text-sm border rounded-lg text-left flex items-center justify-between ${
          selected ? 'text-gray-800 border-gray-300 bg-white' : 'text-gray-400 border-gray-300 bg-white'
        }`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Mobile: inline dropdown below trigger */}
      {open && isMobileDevice && (
        <div className="mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search options..."
                className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400"
                autoFocus
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-gray-400">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {/* Options */}
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-gray-400">No options found</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left border-b border-gray-50 active:bg-gray-100 ${
                    String(opt.value) === String(value) ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-800'
                  }`}
                >
                  <span>{opt.label}</span>
                  {String(opt.value) === String(value) && <CheckIcon className="w-4 h-4 text-red-500 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Desktop: centered modal */}
      {open && !isMobileDevice && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => { setOpen(false); setSearch(''); }} />
          <div className="relative bg-white shadow-xl max-h-[75vh] flex flex-col z-10 w-96 rounded-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">{label}</span>
              <button type="button" onClick={() => { setOpen(false); setSearch(''); }} className="p-1 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search options..."
                  className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400"
                  autoFocus
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-gray-400">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">No options found</div>
              ) : (
                filtered.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 text-sm text-left border-b border-gray-50 active:bg-gray-100 ${
                      String(opt.value) === String(value) ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-800'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {String(opt.value) === String(value) && <CheckIcon className="w-4 h-4 text-red-500 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileSelect;
