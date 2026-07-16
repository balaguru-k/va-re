import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only logout on 401 (unauthorized) or 403 with token-related errors
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    const isChangePassword = error.config?.url?.includes('/auth/change-password');
    if (!isLoginRequest && !isChangePassword && (error.response?.status === 401 ||
      (error.response?.status === 403 && error.response?.data?.error?.includes('token')))) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = process.env.REACT_APP_FRONTEND_URL;
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const userAPI = {
  getUsers: (params) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (userData) => api.post('/users', userData),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
  getRoles: () => api.get('/users/roles'),
  getAssignedDepartments: (locationId, params = '') => api.get(`/users/assigned-departments/${locationId}${params}`),
  bulkUpload: (formData) => api.post('/users/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getBulkUploadSample: () => api.get('/users/bulk-upload-sample', { responseType: 'blob' }),
  export: (params) => api.get('/users/export', { params, responseType: 'blob' }),
};

const prepareChecklistFormData = (formData, timeTaken, additionalFields, items = []) => {
  const data = new FormData();
  const cleanData = {};
  Object.entries(formData).forEach(([itemId, itemData]) => {
    cleanData[itemId] = {
      status: itemData.status,
      category: itemData.category,
      reason: itemData.reason,
      textbox: itemData.textbox,
      activities: itemData.activities,
      process: itemData.process,
      images: itemData.images || []
    };
    if (itemData.images && itemData.images.length > 0) {
      itemData.images.forEach((image, idx) => {
        if (image instanceof File) {
          data.append('images', image, `${itemId}_${idx}_${image.name}`);
        }
      });
    }
  });
  data.append('formData', JSON.stringify(cleanData));
  data.append('timeTaken', timeTaken);
  data.append('additionalFields', JSON.stringify(additionalFields));
  data.append('items', JSON.stringify(items));
  if (additionalFields.cameraFile) {
    data.append('cameraFile', additionalFields.cameraFile);
  }
  return data;
};

export const checklistAPI = {

  getCategories: (params) => api.get('/checklists/categories', { params }),
  getLocations: (params) => api.get('/checklists/locations', { params }),
  getDepartments: (params) => api.get('/checklists/departments', { params }),
  getNames: (params) => api.get('/checklists/names', params),
  getChecklists: (params) => api.get('/checklists', { params }),
  getChecklist: (id) => api.get(`/checklists/${id}`),
  getDeletedChecklists: () => api.get('/checklists/deleted'),
  getDeletedChecklistById: (id) => api.get(`/checklists/deleted/${id}`),
  createChecklist: (formData) => api.post('/checklists', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateChecklist: (id, formData) => api.put(`/checklists/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  completeRandomChecklist: (id) => api.post(`/checklists/completeRandomChecklist/${id}`),
  updateChecklistItem: (itemId, data) => api.put(`/checklists/items/${itemId}`, data),
  createChecklistItem: (checklistId, data) => api.post(`/checklists/${checklistId}/items`, data),
  deleteChecklistItem: (itemId) => api.delete(`/checklists/items/${itemId}`),
  deleteChecklist: (id) => api.delete(`/checklists/${id}`),
  restoreChecklist: (id) => api.put(`/checklists/${id}/restore`),
  getUsers: () => api.get('/checklists/users'),

  assignUsers: (id, assignments) => api.post(`/checklists/${id}/assign`, { assignments }),
  getAssignments: (checklistId) => api.get(`/checklists/${checklistId}/assignments`),
  getChecklistItems: (checklistId) => api.get(`/checklists/${checklistId}/items`),
  getChecklistResponses: (checklistId) => api.get(`/checklists/${checklistId}/responses`),
  getDraftChecklist: (checklistId) => api.get(`/checklists/${checklistId}/draft`),
  getAllChecklistsData: (fromDate, toDate) => api.get('/checklists/data/all', { params: { fromDate, toDate } }),
  getSupervisorChecklistsData: (fromDate, toDate) => api.get('/checklists/data/supervisor', { params: { fromDate, toDate } }),
  getManagerChecklistsData: (fromDate, toDate) => api.get('/checklists/data/manager', { params: { fromDate, toDate } }),
  saveChecklist: (checklistId, formData, timeTaken, additionalFields, items) => {
    const data = prepareChecklistFormData(formData, timeTaken, additionalFields, items);
    return api.post(`/checklists/${checklistId}/save`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  completeChecklist: (checklistId, formData, timeTaken, additionalFields, items) => {
    const data = prepareChecklistFormData(formData, timeTaken, additionalFields, items);
    return api.post(`/checklists/${checklistId}/complete`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  submitSupervisorReview: (checklistId, supervisorData) => {
    const data = new FormData();
    data.append('supervisorData', JSON.stringify(supervisorData));

    // Handle supervisor uploaded images
    Object.entries(supervisorData).forEach(([itemId, itemData]) => {
      if (itemData.images && itemData.images.length > 0) {
        itemData.images.forEach((image, idx) => {
          if (image instanceof File) {
            data.append('supervisorImages', image, `supervisor_${itemId}_${idx}_${image.name}`);
          }
        });
      }
    });

    return api.post(`/checklists/${checklistId}/supervisor-review`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getSupervisorReviews: (checklistId) => api.get(`/checklists/${checklistId}/supervisor-reviews`),
  getAllSupervisorReviews: (checklistId) => api.get(`/checklists/${checklistId}/all-supervisor-reviews`),
  getManagerReviewItems: (checklistId) => api.get(`/checklists/${checklistId}/manager-review-items`),

  submitManagerReview: (checklistId, managerData) => {
    return api.post(`/manager/checklist/${checklistId}/review`, {
      managerData: JSON.stringify(managerData)
    });
  },
  getManagerReviews: (checklistId) => api.get(`/checklists/${checklistId}/manager-reviews`),
  getSupervisorChecklistList: () => api.get('/reports/supervisor-checklist-list'),
  getSupervisorChecklistReport: (params) => api.get('/reports/supervisor-checklist-report', { params }),
  exportSupervisorChecklistReport: (params) => api.get('/reports/supervisor-checklist-report/export', { params, responseType: 'blob' }),
  getChecklistItemsReport: (params) => api.get('/reports/items', { params }),
  exportChecklistItemsReport: (params) => api.get('/reports/items/export', { params, responseType: 'blob' }),
  getUserStatusReport: (params) => api.get('/reports/users-status', { params }),
  exportUserStatusReport: (params) => api.get('/reports/users-status/export', { params, responseType: 'blob' }),
  getManagerSupervisorNCCounts: (params) => api.get('/reports/nc-counts', { params }),
  exportManagerSupervisorNCCounts: (params) => api.get('/reports/nc-counts/export', { params, responseType: 'blob' }),
  getDashboardNCChart: (params) => api.get('/reports/dashboard-nc-chart', { params }),
  getChecklistNCSummary: (params) => api.get('/reports/checklist-nc-summary', { params }),
  getWeeklyNCReport: (params) => api.get('/reports/weekly-nc', { params }),
  sendAnalyticsMail: (data) => api.post('/checklists/send-analytics-mail', data),
};

export const executiveAPI = {
  getChecklist: (params) => api.get('/executive/dashboard', { params }),
  getCompletedChecklists: (params) => api.get('/executive/completed', { params }),
  getExecutiveData: (checklistId, date) => api.get(`/executive/checklist/${checklistId}/data`, { params: date ? { date } : {} }),
  getCompletedSCAuditTrail: (params) => api.get('/executive/sc-audit-trail', { params }),
  getSCAuditTrailDetails: (checklistId) => api.get(`/executive/sc-audit-trail/${checklistId}`),
  saveChecklist: (checklistId, formData) => {
    const data = new FormData();
    const cleanData = {};
    Object.entries(formData).forEach(([itemId, itemData]) => {
      const existingImages = itemData.images ? itemData.images.filter(img => !(img instanceof File)).map(img => img.name || img) : [];
      cleanData[itemId] = {
        reason: itemData.reason || '',
        existingImages: existingImages
      };
      if (itemData.images && itemData.images.length > 0) {
        itemData.images.forEach((image, idx) => {
          if (image instanceof File) {
            data.append('images', image, `${itemId}_${idx}_${image.name}`);
          }
        });
      }
    });
    data.append('formData', JSON.stringify(cleanData));
    return api.post(`/executive/checklist/${checklistId}/save`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  completeChecklist: (checklistId, formData) => {
    const data = new FormData();
    const cleanData = {};
    Object.entries(formData).forEach(([itemId, itemData]) => {
      const existingImages = itemData.images ? itemData.images.filter(img => !(img instanceof File)).map(img => img.name || img) : [];
      cleanData[itemId] = {
        reason: itemData.reason || '',
        existingImages: existingImages
      };
      if (itemData.images && itemData.images.length > 0) {
        itemData.images.forEach((image, idx) => {
          if (image instanceof File) {
            data.append('images', image, `${itemId}_${idx}_${image.name}`);
          }
        });
      }
    });
    data.append('formData', JSON.stringify(cleanData));
    return api.post(`/executive/checklist/${checklistId}/complete`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const rosterAPI = {
  getRosters: (params) => api.get('/rosters', { params }),
  getAdminRoster: (params) => api.get('/rosters/admin', { params }),
  getRandomChecklists: (params) => api.get('/rosters/random-checklists', { params }),
  createRoster: (data) => api.post('/rosters', data),
  updateRoster: (id, data) => api.put(`/rosters/${id}`, data),
  deleteRoster: (id) => api.delete(`/rosters/${id}`),
  bulkAssign: (data) => api.post('/rosters/bulk', data),
  manualAssign: (data) => api.post('/rosters/manual-assign', data),
  getChecklists: () => api.get('/rosters/checklists'),
  getUsers: () => api.get('/rosters/users'),
  getUserDashboard: (userId, params) => api.get(`/rosters/dashboard/${userId}`, { params }),
  getCompletedChecklists: (userId, params) => api.get(`/rosters/completed/${userId}`, { params }),
  getLeadAuditorDashboard: (params) => api.get('/rosters/lead-auditor-dashboard', { params }),
  getCompletedChecklistsByDate: (date) => api.get('/rosters/completed-checklists-by-date', { params: { date } })
};

export const qcAPI = {
  submit: (formData) => api.post('/qc/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getSubmissions: (params) => api.get('/qc/submissions', { params }),
  getSubmissionDetail: (id) => api.get(`/qc/submissions/${id}`),
  getSubmissionEditData: (id) => api.get(`/qc/submissions/${id}/edit`),
  updateSubmission: (id, data) => api.put(`/qc/submissions/${id}`, data),
  exportExcel: (params) => api.get('/qc/export', { params, responseType: 'blob' }),
  getAuditorSubmissions: (params) => api.get('/qc/auditor/submissions', { params }),
  submitAuditorRemark: (id, remarks) => api.post(`/qc/auditor/submissions/${id}/remark`, { remarks })
};

export const mastersAPI = {
  getCategories: () => api.get('/masters/categories'),
  createCategory: (data) => api.post('/masters/categories', data),
  updateCategory: (id, data) => api.put(`/masters/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/masters/categories/${id}`),
  getLocations: () => api.get('/masters/locations'),
  createLocation: (data) => api.post('/masters/locations', data),
  updateLocation: (id, data) => api.put(`/masters/locations/${id}`, data),
  deleteLocation: (id) => api.delete(`/masters/locations/${id}`),
  getNames: (locationId) => api.get('/masters/names', { params: locationId ? { location_id: locationId } : {} }),
  createName: (data) => api.post('/masters/names', data),
  updateName: (id, data) => api.put(`/masters/names/${id}`, data),
  deleteName: (id) => api.delete(`/masters/names/${id}`),
  getDepartments: (locationId, nameId) => api.get('/masters/departments', { params: { ...(locationId ? { location_id: locationId } : {}), ...(nameId ? { name_id: nameId } : {}) } }),
  createDepartment: (data) => api.post('/masters/departments', data),
  updateDepartment: (id, data) => api.put(`/masters/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/masters/departments/${id}`),
};

export const complaintAPI = {
  getComplaints: (params) => api.get('/complaints', { params }),
  createComplaint: (formData) => api.post('/complaints', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  completeComplaint: (id) => api.put(`/complaints/${id}/complete`),
  deleteComplaint: (id) => api.delete(`/complaints/${id}`),
};

export default api;
