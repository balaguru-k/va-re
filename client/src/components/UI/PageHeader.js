import React from 'react';

const PageHeader = ({ title, children }) => {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center space-x-3">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
      {children}
    </div>
  );
};

export default PageHeader;