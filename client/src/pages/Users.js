import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import { userAPI, checklistAPI } from '../services/api';
import Modal from '../components/UI/Modal';
import Table from '../components/UI/Table';
import SearchBar from '../components/UI/SearchBar';
import Pagination from '../components/UI/Pagination';
import PageHeader from '../components/UI/PageHeader';
import useApi from '../hooks/useApi';
import usePagination from '../hooks/usePagination';
import useSearch from '../hooks/useSearch';
import Swal from 'sweetalert2';
import SearchableSelect from '../components/SearchableSelect';
import showToast from '../utils/toast';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [names, setNames] = useState([]);
  const [selectedNameId, setSelectedNameId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);

  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [assignedDepartments, setAssignedDepartments] = useState([]);

  const { loading, execute } = useApi();
  const { pagination, updatePagination, goToPage, setLimit, resetPage } = usePagination(1, 50);
  const { searchTerm, setSearchTerm, filteredData } = useSearch(users, ['username', 'email', 'role']);
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
  const selectedRoleId = watch('role_id');
  const selectedLocationId = watch('location_id');

  // For Head role, location_id is an array; for others it's a single value
  const isHeadRole = selectedRoleId === '9';
  const selectedLocationIds = isHeadRole
    ? (Array.isArray(selectedLocationId) ? selectedLocationId : [])
    : (selectedLocationId ? [selectedLocationId] : []);

  const filteredNames = selectedLocationIds.length
    ? names.filter(name => selectedLocationIds.some(id => id == name.location_id))
    : names;

  const filteredDepartments = (() => {
    let filtered = departments;
    if (selectedLocationIds.length) {
      filtered = filtered.filter(dept => selectedLocationIds.some(id => id == dept.location_id));
    }
    if (selectedNameId) {
      filtered = filtered.filter(dept => dept.name_id == selectedNameId);
    }
    return filtered;
  })();

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchCategories();
    fetchDepartments();
    fetchLocations();
    fetchNames();
  }, [pagination.page, pagination.limit, searchTerm, statusFilter]);

  useEffect(() => {
    const hasLocation = isHeadRole
      ? (Array.isArray(selectedLocationId) && selectedLocationId.length > 0)
      : !!selectedLocationId;
    if (hasLocation && !editingUser) {
      setNameInput('');
      setValue('name_input', '');
      setSelectedNameId(null);
      setSelectedDepartments([]);
      setDepartmentSearch('');
      setValue('department_id', []);
    }
  }, [selectedLocationId, setValue, editingUser]);

  // When facility name changes → reset departments
  useEffect(() => {
    if (!editingUser) {
      setSelectedDepartments([]);
      setDepartmentSearch('');
      setValue('department_id', []);
    }
  }, [selectedNameId]);



  const fetchUsers = async () => {
    await execute(
      () => userAPI.getUsers({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        status: statusFilter
      }),
      {
        onSuccess: (response) => {
          setUsers(response.data.data);
          // Fetched users data
          updatePagination({
            total: response.data.pagination.total,
            pages: response.data.pagination.pages
          });
        },
        errorMessage: 'Failed to fetch users'
      }
    );
  };

  const fetchRoles = async () => {
    await execute(
      () => userAPI.getRoles(),
      {
        onSuccess: (response) => setRoles(response.data.roles),
        errorMessage: 'Failed to fetch roles',
        showLoading: false
      }
    );
  };

  const fetchCategories = async () => {
    await execute(
      () => checklistAPI.getCategories(),
      {
        onSuccess: (response) => setCategories(response.data.categories || []),
        errorMessage: 'Failed to fetch categories',
        showLoading: false
      }
    );
  };

  const fetchDepartments = async () => {
    await execute(
      () => checklistAPI.getDepartments(),
      {
        onSuccess: (response) => setDepartments(response.data.departments || []),
        errorMessage: 'Failed to fetch departments',
        showLoading: false
      }
    );
  };

  const fetchLocations = async () => {
    await execute(
      () => checklistAPI.getLocations(),
      {
        onSuccess: (response) => setLocations(response.data.locations || []),
        errorMessage: 'Failed to fetch locations',
        showLoading: false
      }
    );
  };

  const fetchNames = async () => {
    await execute(
      () => checklistAPI.getNames(),
      {
        onSuccess: (response) => setNames(response.data.names || []),
        errorMessage: 'Failed to fetch names',
        showLoading: false
      }
    );
  };

  const handleCreateUser = async () => {
    setEditingUser(null);
    setAssignedDepartments([]);
    setSelectedDepartments([]);
    setNameInput('');
    setSelectedNameId(null);
    setDepartmentSearch('');
    setShowNameDropdown(false);
    reset({
      username: '',
      email: '',
      employee_id: '',
      role_id: '',
      password: '',
      location_id: '',
      name_input: '',
      department_id: []
    });
    await Promise.all([fetchDepartments(), fetchLocations(), fetchNames()]);
    setIsModalOpen(true);
  };

  const handleViewUser = async (userId) => {
    try {
      const response = await userAPI.getUser(userId);
      const user = response.data.user;
      const locationName = user.location_id
        ? (Array.isArray(user.location_id)
            ? user.location_id.map(id => locations.find(l => l.id == id)?.name).filter(Boolean).join(', ')
            : locations.find(l => l.id == user.location_id)?.name)
        : null;
      const facilityName = user.facility_name || (user.name_id ? names.find(n => n.id == user.name_id)?.name : null);

      // Parse department_id JSON array and get names
      let departmentNames = 'N/A';
      if (user.department_id) {
        try {
          const deptIds = JSON.parse(user.department_id);
          const deptNamesList = deptIds.map(id => departments.find(d => d.id == id)?.name).filter(Boolean);
          departmentNames = deptNamesList.length > 0 ? deptNamesList.join(', ') : 'N/A';
        } catch (e) {
          departmentNames = 'N/A';
        }
      }

      setViewingUser({
        ...user,
        location_name: locationName,
        facility_name: facilityName,
        department_name: departmentNames
      });
      setIsViewModalOpen(true);
    } catch (error) {
      showToast('error', 'Failed to fetch user details');
    }
  };

  const handleEditUser = async (userId) => {
    try {
      await Promise.all([fetchDepartments(), fetchLocations(), fetchNames()]);
      const response = await userAPI.getUser(userId);
      const user = response.data.user;
      setEditingUser(user);

      // Parse department_id JSON array
      let deptIds = [];
      if (user.department_id) {
        try {
          deptIds = JSON.parse(user.department_id);
        } catch (e) {
          deptIds = [];
        }
      }

      reset({
        username: user.username,
        email: user.email,
        employee_id: user.employee_id || '',
        role_id: String(user.role_id),
        location_id: String(user.role_id) === '9' ? (() => {
          if (!user.location_id) return [];
          try { return Array.isArray(user.location_id) ? user.location_id : JSON.parse(user.location_id); }
          catch { return [user.location_id]; }
        })() : (user.location_id || ''),
        name_input: user.facility_name || '',
        department_id: deptIds
      });
      setNameInput(String(user.role_id) === '9' ? (() => {
        if (!user.facility_name) return [];
        try { return Array.isArray(user.facility_name) ? user.facility_name : JSON.parse(user.facility_name); }
        catch { return [user.facility_name]; }
      })() : (user.facility_name || ''));
      // Set selectedNameId for department filtering
      if (user.facility_name && String(user.role_id) !== '9') {
        const matched = names.find(n => n.name === user.facility_name);
        setSelectedNameId(matched ? matched.id : null);
      }
      setSelectedDepartments(deptIds);
      setIsModalOpen(true);
    } catch (error) {
      showToast('error', 'Failed to fetch user details');
    }
  };

  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.id === userId);
    const result = await Swal.fire({
      title: 'Delete User',
      text: `Are you sure you want to delete "${user?.username}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      width: '400px',
      padding: '0.5rem',
      heightAuto: false,
      customClass: {
        popup: 'swal-compact'
      }
    });

    if (!result.isConfirmed) return;

    try {
      await userAPI.deleteUser(userId);
      await fetchUsers();
      showToast('success', 'User deleted successfully!');
    } catch (error) {
      showToast('error', 'Failed to delete user');
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Add selected departments to data
      data.department_id = selectedDepartments;

      if (editingUser) {
        await userAPI.updateUser(editingUser.id, data);
        showToast('success', 'User updated successfully!');
      } else {
        await userAPI.createUser(data);
        showToast('success', 'User created successfully!');
      }
      setIsModalOpen(false);
      setEditingUser(null);
      reset();
      setNameInput('');
      setSelectedDepartments([]);
      setDepartmentSearch('');
      fetchUsers();
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPageSizeOptions = () => {
    const total = pagination.total || 0;
    if (total <= 100) return [25, 50, 100];
    if (total <= 250) return [50, 100, 250];
    return [100, 250, 500];
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    resetPage();
  };

  const handleStatusToggle = () => {
    setStatusFilter(statusFilter === 'active' ? 'inactive' : 'active');
    resetPage();
  };

  const handleExport = async () => {
    try {
      const response = await userAPI.export({
        search: searchTerm,
        status: statusFilter
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Users_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showToast('error', 'Failed to export users');
    }
  };

  const handleDownloadSample = async () => {
    try {
      const response = await userAPI.getBulkUploadSample();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'user_upload_sample.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showToast('error', 'Failed to download sample file');
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      showToast('error', 'Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', bulkFile);

    try {
      const response = await userAPI.bulkUpload(formData);
      const { success, failed, errors } = response.data.results;

      if (failed === 0) {
        showToast('success', `Successfully uploaded ${success} users.`);
      } else {
        Swal.fire({
          title: 'Bulk Upload Results',
          html: `Success: ${success}<br>Failed: ${failed}<br><br>Errors:<br><div style="text-align:left;max-height:200px;overflow-y:auto;font-size:12px;">${errors.join('<br>')}</div>`,
          icon: 'warning'
        });
      }

      setIsBulkModalOpen(false);
      setBulkFile(null);
      fetchUsers();
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Bulk upload failed');
    }
  };

  return (
    <div className="space-y-3" style={{ height: 'calc(100vh - 90px)', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Users">
        <div className="flex items-center space-x-2">
          <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search users..."
            showIcon={false}
          />
          <button
            onClick={handleStatusToggle}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === 'active'
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
          >
            • {statusFilter === 'active' ? 'Active' : 'Inactive'}
          </button>
          <button onClick={handleExport} className="btn-export text-xs flex items-center space-x-1">
            <img src={require('../images/export.png')} alt="" className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button onClick={() => setIsBulkModalOpen(true)} className="btn-bulk text-xs flex items-center space-x-1">
            <img src={require('../images/bulkupload.png')} alt="" className="w-4 h-4" />
            <span>Bulk Upload</span>
          </button>
          <button
            onClick={handleCreateUser}
            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
          >

            <span>+</span>
            <span>Add User</span>
          </button>
        </div>
      </PageHeader>

      <div className="bg-white border border-red-100 rounded-lg" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="overflow-x-auto" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'hidden' }}>
          <div className="overflow-y-auto scroll-container" style={{ flex: 1 }}>
            <table className="min-w-full">
              <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">User Name</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Employee ID</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">User Type</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Email</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Date Created</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-500">No users found</td>
                </tr>
              ) : (
                filteredData.map((user, index) => (
                  <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.username}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.employee_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.role}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${user.is_active
                        ? 'text-green-700 bg-green-100'
                        : 'text-red-700 bg-red-100'
                        }`}>
                        • {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleViewUser(user.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="View User"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditUser(user.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          title="Edit User"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-1 text-gray-600 hover:text-red-600 rounded"
                          title="Delete User"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span>Show:</span>
            {getPageSizeOptions().map(size => (
              <button
                key={size}
                onClick={() => setLimit(size)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  pagination.limit === size
                    ? 'bg-btn-primary text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {size}
              </button>
            ))}
            <button
              onClick={() => setLimit(pagination.total || 9999)}
              className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                pagination.limit >= (pagination.total || 9999)
                  ? 'bg-btn-primary text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
              }`}
            >
              All
            </button>
          </div>
          <div className="text-gray-600">
            <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <button
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
          reset({
            username: '',
            email: '',
            employee_id: '',
            role_id: '',
            password: '',
            location_id: '',
            name_input: '',
            department_id: []
          });
          setNameInput('');
          setSelectedNameId(null);
          setSelectedDepartments([]);
          setDepartmentSearch('');
          setAssignedDepartments([]);
        }}
        title={editingUser ? 'Edit User' : 'Add User'}
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                {...register('username', {
                  required: 'Username is required',
                  pattern: {
                    value: /^[a-zA-Z0-9_ ]+$/,
                    message: 'Username can only contain letters, numbers, spaces, and underscores'
                  }
                })}
                className="input-field w-full"
                placeholder="Enter username"
                autoComplete="off"
              />
              {errors.username && <p className="text-red-600 text-sm mt-1">{errors.username.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                {...register('email', { required: 'Email is required' })}
                type="email"
                className="input-field w-full"
                placeholder="Enter email"
                autoComplete="off"
              />
              {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
              <input
                {...register('employee_id')}
                className="input-field w-full"
                placeholder="Enter employee ID"
                autoComplete="off"
              />
              {errors.employee_id && <p className="text-red-600 text-sm mt-1">{errors.employee_id.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                {...register('role_id', { required: 'Role is required' })}
                className="input-field w-full"
                style={{ maxHeight: '8rem', overflowY: 'auto' }}
              >
                <option value="">Select Role</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              {errors.role_id && <p className="text-red-600 text-sm mt-1">{errors.role_id.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {editingUser && '(Leave blank to keep current)'}
              </label>
              <input
                {...register('password', editingUser ? {} : { required: 'Password is required' })}
                type="password"
                className="input-field w-full"
                placeholder={editingUser ? 'Enter new password to change' : 'Enter password'}
                autoComplete="off"
              />
              {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
            </div>
            {(selectedRoleId === '3' || selectedRoleId === '4' || selectedRoleId === '6' || selectedRoleId === '9') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                {selectedRoleId === '9' ? (
                  <SearchableSelect
                    options={locations}
                    value={watch('location_id') || []}
                    onChange={(value) => setValue('location_id', value, { shouldValidate: true })}
                    placeholder="Select Location(s)"
                    displayKey="name"
                    valueKey="id"
                    multiSelect
                  />
                ) : (
                  <SearchableSelect
                    options={[{ id: '', name: 'Select Location' }, ...locations]}
                    value={watch('location_id') || ''}
                    onChange={(value) => setValue('location_id', value, { shouldValidate: true })}
                    placeholder="Select Location"
                    displayKey="name"
                    valueKey="id"
                  />
                )}
                <input
                  {...register('location_id', {
                    required: 'Location is required'
                  })}
                  type="hidden"
                  value={selectedRoleId === '9' ? JSON.stringify(watch('location_id') || []) : (watch('location_id') || '')}
                />
                {errors.location_id && <p className="text-red-600 text-sm mt-1">{errors.location_id.message}</p>}
              </div>
            )}

            {(selectedRoleId === '3' || selectedRoleId === '4' || selectedRoleId === '6' || selectedRoleId === '9') && (
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Facility Name *
                </label>
                {selectedRoleId === '9' ? (
                  <SearchableSelect
                    options={filteredNames.map(n => ({ id: n.name, name: n.name, _id: n.id }))}
                    value={Array.isArray(nameInput) ? nameInput : []}
                    onChange={(value) => {
                      setNameInput(value);
                      setValue('name_input', JSON.stringify(value), { shouldValidate: true });
                      setSelectedNameId(null);
                    }}
                    placeholder="Select facility name(s)"
                    displayKey="name"
                    valueKey="id"
                    multiSelect
                  />
                ) : (
                  <SearchableSelect
                    options={filteredNames.map(n => ({ id: n.name, name: n.name, _id: n.id }))}
                    value={nameInput}
                    onChange={(value) => {
                      setNameInput(value);
                      setValue('name_input', value, { shouldValidate: true });
                      const matched = filteredNames.find(n => n.name === value);
                      setSelectedNameId(matched ? matched.id : null);
                    }}
                    placeholder="Select or enter facility name"
                    displayKey="name"
                    valueKey="id"
                  />
                )}
                <input
                  {...register('name_input', {
                    required: 'Facility name is required'
                  })}
                  type="hidden"
                  value={selectedRoleId === '9' ? JSON.stringify(nameInput || []) : (nameInput || '')}
                />
                {errors.name_input && <p className="text-red-600 text-sm mt-1">{errors.name_input.message}</p>}
              </div>
            )}

            {(selectedRoleId === '3' || selectedRoleId === '4' || selectedRoleId === '6') && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departments * (Select multiple)
                </label>
                <div className="border border-gray-300 rounded-lg bg-white">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search"
                      value={departmentSearch}
                      onChange={(e) => setDepartmentSearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  {/* Checkbox List */}
                  <div className="p-2" style={{ maxHeight: '12rem', overflowY: 'auto' }}>
                    {filteredDepartments.length === 0 ? (
                      <p className="text-sm text-gray-500 px-2 py-3">No departments available</p>
                    ) : (
                      <div className="space-y-1">
                        {/* All Checkbox */}
                        <label className="flex items-center space-x-2 px-2 py-2 cursor-pointer hover:bg-gray-50 rounded">
                          <input
                            type="checkbox"
                            checked={Array.isArray(selectedDepartments) && selectedDepartments.length === filteredDepartments.filter(d =>
                              d.name.toLowerCase().includes(departmentSearch.toLowerCase())
                            ).length && filteredDepartments.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const allDeptIds = filteredDepartments
                                  .filter(d => d.name.toLowerCase().includes(departmentSearch.toLowerCase()))
                                  .map(d => d.id);
                                setSelectedDepartments(allDeptIds);
                              } else {
                                setSelectedDepartments([]);
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-900">All</span>
                        </label>

                        {/* Individual Department Checkboxes */}
                        {filteredDepartments
                          .filter(d => d.name.toLowerCase().includes(departmentSearch.toLowerCase()))
                          .map(department => (
                            <label
                              key={department.id}
                              className="flex items-center space-x-2 px-2 py-2 cursor-pointer hover:bg-gray-50 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={Array.isArray(selectedDepartments) && selectedDepartments.includes(department.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDepartments([...selectedDepartments, department.id]);
                                  } else {
                                    setSelectedDepartments(selectedDepartments.filter(id => id !== department.id));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{department.name}</span>
                            </label>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
                {(selectedRoleId === '3' || selectedRoleId === '4' || selectedRoleId === '6') && selectedDepartments.length === 0 && (
                  <p className="text-red-600 text-sm mt-1">At least one department is required</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (editingUser ? 'Updating...' : 'Creating...') : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View User Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingUser(null);
        }}
        title="User Details"
        size="lg"
      >
        {viewingUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingUser.username}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingUser.email}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingUser.employee_id || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingUser.role}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${viewingUser.is_active
                    ? 'text-green-700 bg-green-100'
                    : 'text-red-700 bg-red-100'
                    }`}>
                    • {viewingUser.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              {(viewingUser.role_id == 3 || viewingUser.role_id == 4 || viewingUser.role_id == 6 || viewingUser.role_id == 8 || viewingUser.role_id == 9) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                      {Array.isArray(viewingUser.location_name) ? viewingUser.location_name.join(', ') : (viewingUser.location_name || 'N/A')}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                      {viewingUser.facility_name || 'N/A'}
                    </div>
                  </div>
                  {(viewingUser.role_id !== 8 || viewingUser.role_id !== 9) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                        {viewingUser.department_name || 'N/A'}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created Date</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {new Date(viewingUser.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4 mt-4 border-t border-gray-200">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          setBulkFile(null);
        }}
        title="Bulk Upload Users"
        size="md"
      >
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Upload CSV or Excel file.<br />
                    <b>Required:</b> Username, Email, Password, Role.<br />
                    <b>Optional:</b> Location, Facility Name, Departments, Employee ID.
                  </p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <button
                type="button"
                onClick={handleDownloadSample}
                className="text-sm text-blue-600 hover:text-blue-800 underline flex items-center"
              >
                Download Sample Template
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={(e) => setBulkFile(e.target.files[0])}
              className="input-field w-full p-2 border rounded"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!bulkFile}
              className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              Upload
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Users;