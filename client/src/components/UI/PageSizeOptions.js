import React from 'react';

const PageSizeOptions = ({
  pagination,
  onLimitChange,
  pageSizeOptions = [50, 100, 250]
}) => {
  const { limit, total } = pagination;

  return (
    <div className="flex items-center gap-2 text-gray-600 bg-white px-3 py-1 rounded border border-gray-200">
      <span className="text-xs font-medium">Show:</span>
      {pageSizeOptions.map(size => (
        <button
          key={size}
          onClick={() => onLimitChange(size)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            limit === size
              ? 'bg-[#C50B34] text-white border-transparent shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {size}
        </button>
      ))}
      <button
        onClick={() => onLimitChange(total || 9999)}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          limit >= (total || 9999)
            ? 'bg-[#C50B34] text-white border-transparent shadow-sm'
            : 'bg-white text-gray-600 hover:bg-gray-100'
        }`}
      >
        All
      </button>
    </div>
  );
};

export default PageSizeOptions;
