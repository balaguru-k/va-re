import React from 'react';

const Table = ({ 
  columns, 
  data, 
  loading = false, 
  emptyMessage = "No data found",
  className = ""
}) => {
  return (
    <div className={`bg-white shadow-sm rounded-2xl border border-gray-100 ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full" style={{fontSize: '12px'}}>
          <thead style={{backgroundColor: '#ededed'}}>
            <tr>
              {columns.map((column, index) => (
                <th 
                  key={index}
                  className="px-8 py-4 text-left font-semibold text-gray-600" style={{fontSize: '14px'}}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-8 py-6 text-center text-gray-500" style={{fontSize: '12px'}}>
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-8 py-6 text-center text-gray-500" style={{fontSize: '12px'}}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className="px-8 py-5" style={{fontSize: '12px'}}>
                      {column.render ? column.render(row, rowIndex) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Table;