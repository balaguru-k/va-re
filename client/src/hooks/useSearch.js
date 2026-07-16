import { useState, useEffect } from 'react';

const useSearch = (data, searchFields = []) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState(data);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredData(data);
      return;
    }

    const filtered = data.filter(item => {
      return searchFields.some(field => {
        const value = field.split('.').reduce((obj, key) => obj?.[key], item);
        return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
      });
    });

    setFilteredData(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, searchTerm, JSON.stringify(searchFields)]);

  return {
    searchTerm,
    setSearchTerm,
    filteredData
  };
};

export default useSearch;