import { useState, useMemo } from 'react';

const usePagination = (initialPage = 1, initialLimit = 50) => {
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    pages: 0
  });

  const updatePagination = (newData) => {
    setPagination(prev => ({ ...prev, ...newData }));
  };

  const updateFromResponse = (paginationResponse) => {
    setPagination(prev => ({
      ...prev,
      page: paginationResponse?.currentPage || 1,
      total: paginationResponse?.totalRecords || 0,
      pages: paginationResponse?.totalPages || 0,
      limit: paginationResponse?.limit || prev.limit
    }));
  };

  const goToPage = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const setLimit = (limit) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  };

  const resetPage = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getPageSizeOptions = () => {
    const total = pagination.total || 0;
    if (total <= 250) return [50, 100, 250];
    return [100, 250, 500];
  };

  const paginateData = (data) => {
    const start = (pagination.page - 1) * pagination.limit;
    return data.slice(start, start + pagination.limit);
  };

  const setTotalFromData = (data) => {
    const total = data.length;
    setPagination(prev => ({
      ...prev,
      total,
      pages: Math.ceil(total / prev.limit)
    }));
  };

  return {
    pagination,
    updatePagination,
    updateFromResponse,
    goToPage,
    setLimit,
    resetPage,
    getPageSizeOptions,
    paginateData,
    setTotalFromData
  };
};

export default usePagination;
