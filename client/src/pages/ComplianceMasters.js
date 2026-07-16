import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, EyeIcon, EyeSlashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import Modal from '../components/UI/Modal';

const ROLES = ['VS User', 'Vendor', 'Engineer', 'Viewer'];
const EMPTY_USER_FORM = { name: '', email: '', employee_id: '', role: '', password: '' };
const EMPTY_LOCATION_FORM = { name: '' };
const EMPTY_DEPARTMENT_FORM = { name: '' };
const EMPTY_DIVISION_FORM = { name: '' };
const ComplianceMasters = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_USER_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => (
    <span className={`ml-1 text-base ${sortKey === col ? 'text-red-500' : 'text-gray-400'}`}>
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  useEffect(() => { 
    fetchUsers();
    fetchLocations();
    fetchDepartments();
    fetchDivisions();
  }, []);


  const fetchUsers = () => {
    setLoading(true);
    api.get('/compliance/masters/users')
      .then(res => setUsers(res.data.data?.users || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchLocations = () => {
    setLoading(true);
    api.get('/compliance/masters/locations')
      .then(res => setLocations(res.data.data?.locations || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchDepartments = () => {
    setLoading(true);
    api.get('/compliance/masters/departments')
      .then(res => setDepartments(res.data.data?.departments || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchDivisions = () => {
    setLoading(true);
    api.get('/compliance/masters/divisions')
      .then(res => setDivisions(res.data.data?.divisions || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const resetForm = () => {
    if (activeTab === 'users') setFormData(EMPTY_USER_FORM);
    else if (activeTab === 'locations') setFormData(EMPTY_LOCATION_FORM);
    else if (activeTab === 'departments') setFormData(EMPTY_DEPARTMENT_FORM);
    else if (activeTab === 'divisions') setFormData(EMPTY_DIVISION_FORM);
    setEditingItem(null);
    setShowPassword(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowForm(false);
    resetForm();
    setSearchTerm('');
    setItemsPerPage(50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    if (activeTab === 'users' && !editingItem && !formData.password) return;
    if (activeTab === 'users' && !formData.role) return;
    
    setSubmitting(true);
    try {
      let endpoint, payload;
      
      if (activeTab === 'users') {
        endpoint = editingItem ? `/compliance/masters/users/${editingItem.id}` : '/compliance/masters/users';
        payload = { name: formData.name, email: formData.email, employee_id: formData.employee_id, role: formData.role };
        if (!editingItem || formData.password) payload.password = formData.password;
      } else if (activeTab === 'locations') {
        endpoint = editingItem ? `/compliance/masters/locations/${editingItem.id}` : '/compliance/masters/locations';
        payload = { name: formData.name };
      } else if (activeTab === 'departments') {
        endpoint = editingItem ? `/compliance/masters/departments/${editingItem.id}` : '/compliance/masters/departments';
        payload = { name: formData.name };
      } else if (activeTab === 'divisions') {
        endpoint = editingItem ? `/compliance/masters/divisions/${editingItem.id}` : '/compliance/masters/divisions';
        payload = { name: formData.name };
      }
      
      if (editingItem) {
        await api.put(endpoint, payload);
        setIsEditModalOpen(false);
      } else {
        await api.post(endpoint, payload);
        setShowForm(false);
      }
      
      resetForm();
      if (activeTab === 'users') fetchUsers();
      else if (activeTab === 'locations') fetchLocations();
      else if (activeTab === 'departments') fetchDepartments();
      else if (activeTab === 'divisions') fetchDivisions();
    } catch (err) {
      alert(err.response?.data?.error || `Failed to save ${activeTab.slice(0, -1)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    if (activeTab === 'users') {
      setFormData({ name: item.name, email: item.email || '', employee_id: item.employee_id || '', role: item.role, password: '' });
    } else {
      setFormData({ name: item.name });
    }
    setShowPassword(false);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this record?`)) return;
    try {
      let endpoint;
      if (activeTab === 'users') endpoint = `/compliance/masters/users/${id}`;
      else if (activeTab === 'locations') endpoint = `/compliance/masters/locations/${id}`;
      else if (activeTab === 'departments') endpoint = `/compliance/masters/departments/${id}`;
      else if (activeTab === 'divisions') endpoint = `/compliance/masters/divisions/${id}`;
      
      await api.delete(endpoint);
      
      if (activeTab === 'users') fetchUsers();
      else if (activeTab === 'locations') fetchLocations();
      else if (activeTab === 'departments') fetchDepartments();
      else if (activeTab === 'divisions') fetchDivisions();
    } catch (err) {
      alert(`Failed to delete record`);
    }
  };

  const getCurrentData = () => {
    if (activeTab === 'users') return users;
    else if (activeTab === 'locations') return locations;
    else if (activeTab === 'departments') return departments;
    else if (activeTab === 'divisions') return divisions;
    return [];
  };

  const getFilteredData = () => {
    const data = getCurrentData();
    return data.filter(item => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      if (activeTab === 'users') {
        return item.name?.toLowerCase().includes(searchLower) ||
               item.email?.toLowerCase().includes(searchLower) ||
               item.role?.toLowerCase().includes(searchLower);
      } else {
        return item.name?.toLowerCase().includes(searchLower);
      }
    });
  };
  const filtered = getFilteredData();
  const sortedFiltered = sortKey ? [...filtered].sort((a, b) => {
    let av = a[sortKey] ?? ''; let bv = b[sortKey] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }) : filtered;
  const paginated = itemsPerPage === 'all' ? sortedFiltered : sortedFiltered.slice(0, itemsPerPage);

  const getFormTitle = () => {
    if (activeTab === 'users') return editingItem ? 'Edit User' : 'Create User';
    else if (activeTab === 'locations') return editingItem ? 'Edit Location' : 'Create Location';
    else if (activeTab === 'departments') return editingItem ? 'Edit Department' : 'Create Department';
    else if (activeTab === 'divisions') return editingItem ? 'Edit Division' : 'Create Division';
  };

  const getAddButtonText = () => {
    if (activeTab === 'users') return 'Add User';
    else if (activeTab === 'locations') return 'Add Location';
    else if (activeTab === 'departments') return 'Add Department';
    else if (activeTab === 'divisions') return 'Add Division';
  };

  const getSearchPlaceholder = () => {
    if (activeTab === 'users') return 'Search users...';
    else if (activeTab === 'locations') return 'Search locations...';
    else if (activeTab === 'departments') return 'Search departments...';
    else if (activeTab === 'divisions') return 'Search divisions...';
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3 overflow-y-auto scroll-container">
      <PageHeader title="Masters">
        <div className="flex items-center space-x-3">
          <input
            type="text"
            placeholder={getSearchPlaceholder()}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <button
            onClick={() => { setShowForm(!showForm); resetForm(); }}
            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
          >
            {showForm ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back</span>
              </>
            ) : (
              <>
                <PlusIcon className="w-4 h-4" />
                <span>{getAddButtonText()}</span>
              </>
            )}
          </button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { key: 'users', label: 'Users' },
              { key: 'locations', label: 'Locations' },
              { key: 'departments', label: 'Departments' },
              { key: 'divisions', label: 'Division' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {showForm && (
        <div style={{ marginTop: '40px' }}>
          <div className="max-w-2xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">{getFormTitle()}</h2>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <form onSubmit={handleSubmit} className="space-y-5">
                {activeTab === 'users' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                      <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder="Enter name" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder="Enter email" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID</label>
                      <input type="text" value={formData.employee_id} onChange={e => setFormData(p => ({ ...p, employee_id: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder="Enter employee ID" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Role <span className="text-red-500">*</span></label>
                      <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400" required>
                        <option value="">Select Role</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Password {!editingItem && <span className="text-red-500">*</span>}{editingItem && <span className="text-gray-400">(leave blank to keep current)</span>}</label>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} value={formData.password}
                          onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 pr-10"
                          placeholder={editingItem ? 'Leave blank to keep current' : 'Enter password'} required={!editingItem} />
                        <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                          {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                      <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder={`Enter name`} required />
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-1.5 text-xs text-white bg-btn-primary hover:opacity-90 rounded-md disabled:opacity-50">
                    {submitting ? 'Saving...' : editingItem ? 'Update' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="bg-white border border-red-100 rounded-lg flex flex-col flex-1 min-h-0">
          <div className="overflow-x-auto scroll-container flex-1 min-h-0">
            <table className="min-w-full">
              <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">S.No</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('name')}>Name<SortIcon col="name" /></th>
                  {activeTab === 'users' && (
                    <>
                      <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('email')}>Email<SortIcon col="email" /></th>
                      <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('employee_id')}>Employee ID<SortIcon col="employee_id" /></th>
                      <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('role')}>Role<SortIcon col="role" /></th>
                    </>
                  )}

                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('created_at')}>Created<SortIcon col="created_at" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={activeTab === 'users' ? '7' : '4'} className="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={activeTab === 'users' ? '7' : '4'} className="px-4 py-6 text-center text-gray-500">No records found.</td></tr>
                ) : (
                  paginated.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">{item.name}</td>
                      {activeTab === 'users' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.email || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.employee_id || '-'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{item.role}</span>
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => handleEdit(item)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors" title="Delete">
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
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
            <div className="text-gray-600">Showing <span className="font-medium">{paginated.length}</span> of <span className="font-medium">{sortedFiltered.length}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Show:</span>
              {[50, 100, 200, 'all'].map(val => (
                <button key={val} onClick={() => setItemsPerPage(val)}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    itemsPerPage === val ? 'bg-btn-primary text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {val === 'all' ? 'All' : val}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); resetForm(); }} title={getFormTitle()} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'users' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="Enter name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="Enter email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input type="text" value={formData.employee_id} onChange={e => setFormData(p => ({ ...p, employee_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="Enter employee ID" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400" required>
                  <option value="">Select Role</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-gray-400 text-xs font-normal">(leave blank to keep current)</span></label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={formData.password}
                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 pr-10"
                    placeholder="Leave blank to keep current" />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="Enter name" required />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => { setIsEditModalOpen(false); resetForm(); }}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
              {submitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ComplianceMasters;
