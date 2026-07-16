import React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const SearchBar = ({ 
  value, 
  onChange, 
  placeholder = "Search...", 
  className = "",
  showIcon = true,
  width = "w-64"
}) => {
  return (
    <div className={`relative ${width} ${className}`}>
      {showIcon && (
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
      )}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`${showIcon ? 'pl-10' : 'pl-4'} pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm`}
      />
    </div>
  );
};

export default SearchBar;