import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const MobileDatePicker = ({ label, value, onChange, placeholder = 'Select date', min, max }) => {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const ref = useRef(null);

  const selected = value ? new Date(value + 'T00:00:00') : null;

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const toDateStr = (year, month, day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const isDisabled = (day) => {
    if (!day) return false;
    const dateStr = toDateStr(viewYear, viewMonth, day);
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  const handleSelect = (day) => {
    if (isDisabled(day)) return;
    onChange(toDateStr(viewYear, viewMonth, day));
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const formatDisplay = (val) => {
    if (!val) return null;
    const d = new Date(val + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const isSelected = (day) => {
    if (!selected || !day) return false;
    return selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day;
  };

  const isToday = (day) => {
    if (!day) return false;
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          if (selected) { setViewYear(selected.getFullYear()); setViewMonth(selected.getMonth()); }
          setOpen(o => !o);
        }}
        className={`w-full px-3 py-2 text-sm border rounded-lg text-left flex items-center justify-between ${
          value ? 'text-gray-800 border-gray-300 bg-white' : 'text-gray-400 border-gray-300 bg-white'
        }`}
      >
        <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
        <svg className="w-4 h-4 text-gray-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown calendar - opens below input */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[300]">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-full hover:bg-gray-100">
              <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-800">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-full hover:bg-gray-100">
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="px-2 py-2">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, idx) => (
                <div key={idx} className="flex items-center justify-center">
                  {day ? (
                    <button
                      type="button"
                      onClick={() => handleSelect(day)}
                      disabled={isDisabled(day)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                        isDisabled(day)
                          ? 'text-gray-300 cursor-not-allowed'
                          : isSelected(day)
                          ? 'bg-red-600 text-white'
                          : isToday(day)
                          ? 'border border-red-400 text-red-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {day}
                    </button>
                  ) : <div className="w-8 h-8" />}
                </div>
              ))}
            </div>
          </div>

          {/* Clear */}
          {value && (
            <div className="px-3 pb-2">
              <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                className="w-full py-2 text-xs font-medium text-red-500 border border-red-200 rounded-lg">
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MobileDatePicker;
