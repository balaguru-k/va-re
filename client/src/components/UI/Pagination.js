import React from 'react';

const Pagination = ({
  pagination,
  onPageChange
}) => {
  const { page, limit, total, pages } = pagination;
  const start = ((page - 1) * limit) + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
      <div className="text-gray-600">
        <span className="font-medium">{start}-{end}</span> of <span className="font-medium">{total}</span>
      </div>
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ‹
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === pages}
          className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>
    </div>
  );
};

export default Pagination;
