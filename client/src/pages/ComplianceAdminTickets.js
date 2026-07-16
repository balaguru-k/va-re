import React, { useState, useEffect } from 'react';
import { EyeIcon, PencilIcon, TrashIcon, ArrowLeftIcon, CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import Swal from 'sweetalert2';
import showToast from '../utils/toast';
import { sortTickets } from '../utils/ticketSort';
import MultiSelectDropdown from '../components/UI/MultiSelectDropdown';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const ComplianceAdminTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [checklists, setChecklists] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [draggedFiles, setDraggedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [locationCameras, setLocationCameras] = useState([]);
  const [nvrOptions, setNvrOptions] = useState([]);
  const [formData, setFormData] = useState({
    checklist_id: '',
    location: '',
    department: '',
    checklist_camera_count: '',
    camera_count: '',
    nvr: [],
    camera_no: [],
    issue: '',
    remarks: '',
    attachments: []
  });

  const issueOptions = [
    'Online',
    'Slow streaming',
    'No video',
    'Offline',
    'Sensor issue',
    'Streaming not ready',
    'Timing mismatch',
    'Playback issue',
    'Camera offline goes offline often'
  ];

  useEffect(() => {
    fetchAdminTickets();
    fetchUserChecklists();
    fetchMasters();
  }, []);

  const fetchAdminTickets = async () => {
    try {
      const response = await api.get('/tickets');
      const allTickets = response.data.data?.tickets || response.data.tickets || [];
      
      // Get current user info
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      
      // console.log('Current user:', currentUser);
      // console.log('All tickets:', allTickets.length);
      
      // If current user is Compliance Admin, show their tickets
      // Otherwise, show tickets created by users with Compliance Admin role
      let complianceAdminTickets = [];
      
      if (currentUser && currentUser.role === 'Complaince Admin') {
        // Show tickets created by the current compliance admin user
        complianceAdminTickets = allTickets.filter(ticket => {
          return ticket.user_id === currentUser.id;
        });
      } else {
        // For other users, we need to identify compliance admin tickets
        // Since we don't have role info in ticket data, let's show all tickets for now
        // and add proper role filtering in backend later
        complianceAdminTickets = allTickets;
      }
      
      // console.log('Filtered tickets:', complianceAdminTickets.length);
      // console.log('Sample ticket:', allTickets[0]);
      
      setTickets(complianceAdminTickets);
    } catch (error) {
      console.error('Error fetching admin tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const [locationsRes, departmentsRes] = await Promise.all([
        api.get('/compliance/masters/locations'),
        api.get('/compliance/masters/departments')
      ]);
      setLocations(locationsRes.data.data?.locations || []);
      setDepartments(departmentsRes.data.data?.departments || []);
    } catch (error) {
      console.error('Error fetching masters:', error);
    }
  };

  const fetchUserChecklists = async () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return;
      const user = JSON.parse(userStr);
      
      const response = await api.get(`/rosters/dashboard/${user.id}`);
      if (response.data.dashboard?.assignments?.pending) {
        const allChecklists = [
          ...response.data.dashboard.assignments.pending,
          ...(response.data.dashboard.assignments.completed || [])
        ];
        setChecklists(allChecklists);
      }
    } catch (error) {
      console.error('Error fetching checklists:', error);
    }
  };

  const parseAttachments = (raw) => {
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return []; }
  };

  const fetchLocationCameras = async (location) => {
    if (!location) { setLocationCameras([]); setNvrOptions([]); return; }
    try {
      const res = await api.get(`/tickets/location-cameras?location=${encodeURIComponent(location)}`);
      setNvrOptions(res.data.data?.nvrs || []);
      setLocationCameras(res.data.data?.cameras || []);
    } catch { setLocationCameras([]); setNvrOptions([]); }
  };

  const handleView = (ticket) => {
    setSelectedTicket(ticket);
    const attachments = parseAttachments(ticket.attachments);
    setFormData({
      checklist_id: ticket.checklist_id || '',
      location: ticket.location || '',
      department: ticket.department || '',
      checklist_camera_count: ticket.checklist_camera_count || '',
      camera_count: ticket.camera_count || '',
      nvr: [],
      camera_no: [],
      issue: ticket.issue || '',
      remarks: ticket.remarks || '',
      attachments: []
    });
    setDraggedFiles([]);
    setLocationCameras([]);
    setNvrOptions([]);
    setIsViewMode(true);
    setShowForm(true);
  };

  const handleEdit = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      checklist_id: ticket.checklist_id || '',
      location: ticket.location || '',
      department: ticket.department || '',
      checklist_camera_count: ticket.checklist_camera_count || '',
      camera_count: ticket.camera_count || '',
      nvr: [],
      camera_no: [],
      issue: ticket.issue || '',
      remarks: ticket.remarks || '',
      attachments: []
    });
    setDraggedFiles([]);
    if (ticket.location) fetchLocationCameras(ticket.location);
    setIsViewMode(false);
    setShowForm(true);
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;

    if (name === 'checklist_id') {
      const selectedChecklist = checklists.find(c => c.checklist_id === parseInt(value));
      const newLocation = selectedChecklist?.location_name || formData.location;
      setFormData(prev => ({
        ...prev,
        checklist_id: value,
        location: newLocation,
        department: selectedChecklist?.department_name || prev.department,
        checklist_camera_count: selectedChecklist?.camera_count || prev.checklist_camera_count,
        nvr: [],
        camera_no: []
      }));
      fetchLocationCameras(newLocation);
    } else if (name === 'nvr') {
      const kept = formData.camera_no.filter(key => value.includes(key.split('||')[1]));
      setFormData(prev => ({ ...prev, nvr: value, camera_no: kept, camera_count: kept.length.toString() || prev.camera_count }));
    } else if (name === 'camera_no') {
      const newlySelected = value.filter(v => !formData.camera_no.includes(v));
      if (newlySelected.length > 0 && formData.location && formData.issue) {
        try {
          const resp = await api.get('/tickets/check-conflicts', {
            params: { location: formData.location, camera_nos: newlySelected.join(','), issue: formData.issue, exclude_ticket_id: selectedTicket?.id }
          });
          const { cameraConflicts } = resp.data.data;
          if (cameraConflicts.length > 0) {
            const labels = cameraConflicts.map(c => {
              const itemLabels = c.items.map(v => { const [cam, nvr] = v.split('||'); return nvr ? `${nvr} : ${cam}` : cam; });
              return `${c.ticket} (${itemLabels.join(', ')})`;
            });
            showToast('warning', `Camera already in active ticket(s): ${labels.join(' | ')}`);
          }
        } catch {}
      }
      setFormData(prev => ({ ...prev, camera_no: value, camera_count: value.length.toString() }));
    } else if (name === 'issue') {
      setFormData(prev => ({ ...prev, issue: value }));
      if (value && formData.camera_no.length > 0 && formData.location) {
        try {
          const resp = await api.get('/tickets/check-conflicts', {
            params: { location: formData.location, camera_nos: formData.camera_no.join(','), issue: value, exclude_ticket_id: selectedTicket?.id }
          });
          const { cameraConflicts } = resp.data.data;
          if (cameraConflicts.length > 0) {
            const labels = cameraConflicts.map(c => {
              const itemLabels = c.items.map(v => { const [cam, nvr] = v.split('||'); return nvr ? `${nvr} : ${cam}` : cam; });
              return `${c.ticket} (${itemLabels.join(', ')})`;
            });
            showToast('warning', `Camera already in active ticket(s) with same issue: ${labels.join(' | ')}`);
          }
        } catch {}
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    
    setDraggedFiles(prev => [...prev, ...files]);
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    setDraggedFiles(prev => [...prev, ...files]);
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }));
  };

  const removeFile = (index) => {
    setDraggedFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isViewMode) return;

    if (!formData.issue || (!formData.camera_count && formData.camera_no.length === 0)) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    if (formData.camera_no?.length > 0 && formData.location && formData.issue) {
      try {
        const resp = await api.get('/tickets/check-conflicts', {
          params: { location: formData.location, camera_nos: formData.camera_no.join(','), issue: formData.issue, exclude_ticket_id: selectedTicket?.id }
        });
        const conflicts = resp.data.data?.cameraConflicts || [];
        if (conflicts.length > 0) {
          const labels = conflicts.map(c => {
            const itemLabels = c.items.map(v => { const [cam, nvr] = v.split('||'); return nvr ? `${nvr} : ${cam}` : cam; });
            return `${c.ticket} (${itemLabels.join(', ')})`;
          });
          showToast('error', `Cannot ${selectedTicket ? 'update' : 'create'} ticket. Camera(s) already in active ticket(s) with same issue: ${labels.join(' | ')}`);
          return;
        }
      } catch {}
    }

    try {
      const submitData = new FormData();
      submitData.append('checklist_id', formData.checklist_id || '');
      submitData.append('checklist_camera_count', formData.checklist_camera_count);
      submitData.append('camera_count', formData.camera_count);
      submitData.append('nvr', JSON.stringify(formData.nvr));
      submitData.append('camera_no', JSON.stringify(formData.camera_no));
      submitData.append('issue', formData.issue);
      submitData.append('remarks', formData.remarks);
      submitData.append('location', formData.location);
      submitData.append('department', formData.department);
      
      formData.attachments.forEach((file) => {
        submitData.append('attachments', file);
      });

      await api.put(`/tickets/${selectedTicket.id}`, submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setShowForm(false);
      fetchAdminTickets();
      Swal.fire('Success', 'Ticket updated successfully', 'success');
    } catch (error) {
      console.error('Error updating ticket:', error);
      Swal.fire('Error', 'Failed to update ticket', 'error');
    }
  };

  const handleDelete = async (ticket) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete ticket ${ticket.ticket_number}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/tickets/${ticket.id}`);
        fetchAdminTickets();
        Swal.fire('Deleted!', 'Ticket has been deleted.', 'success');
      } catch (error) {
        console.error('Error deleting ticket:', error);
        Swal.fire('Error', 'Failed to delete ticket', 'error');
      }
    }
  };

  const handleBack = () => {
    setShowForm(false);
    setSelectedTicket(null);
    setIsViewMode(false);
    setDraggedFiles([]);
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'New': 'bg-purple-100 text-purple-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'Completed': 'bg-green-100 text-green-800',
      'Duplicate': 'bg-gray-100 text-gray-800',
      'Ticket by mistake': 'bg-gray-100 text-gray-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => (
    <span className={`ml-1 text-base ${sortKey === col ? 'text-red-500' : 'text-gray-400'}`}>
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const filteredTickets = tickets.filter(t => {
    const matchText = !searchTerm ||
      (t.ticket_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.issue || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.checklist_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const d = t.created_at ? new Date(t.created_at) : null;
    const matchFrom = !fromDate || (d && d >= new Date(fromDate));
    const matchTo = !toDate || (d && d <= new Date(toDate + 'T23:59:59'));
    return matchText && matchFrom && matchTo;
  });

  if (showForm) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center">
          <button
            onClick={handleBack}
            className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isViewMode ? 'View' : 'Edit'} Admin Ticket
            </h1>
            <p className="text-gray-600">
              {isViewMode ? 'Viewing' : 'Editing'} ticket {selectedTicket?.ticket_number}
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              {isViewMode ? 'View' : 'Edit'} Ticket Details
            </h2>
            <button
              type="button"
              onClick={handleBack}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="px-5 py-4">
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Checklist</label>
                  <select
                    name="checklist_id"
                    value={formData.checklist_id}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 ${
                      isViewMode ? 'bg-gray-50 text-gray-500' : ''
                    }`}
                    disabled={isViewMode}
                  >
                    <option value="">Select Checklist (Optional)</option>
                    {checklists.map((checklist) => (
                      <option key={checklist.checklist_id} value={checklist.checklist_id}>
                        {checklist.checklist_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <select
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 ${
                      isViewMode ? 'bg-gray-50 text-gray-500' : ''
                    }`}
                    disabled={isViewMode}
                  >
                    <option value="">Select Location</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.name}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 ${
                      isViewMode ? 'bg-gray-50 text-gray-500' : ''
                    }`}
                    disabled={isViewMode}
                  >
                    <option value="">Select Department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.name}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Checklist Camera Count (Optional)</label>
                  <input
                    type="number"
                    name="checklist_camera_count"
                    value={formData.checklist_camera_count}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 ${
                      isViewMode ? 'bg-gray-50 text-gray-500' : ''
                    }`}
                    placeholder="Enter checklist camera count"
                    disabled={isViewMode}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">NVR</label>
                  <MultiSelectDropdown
                    options={nvrOptions.map(nvr => ({ value: nvr, label: nvr }))}
                    selected={formData.nvr}
                    onChange={val => !isViewMode && handleInputChange({ target: { name: 'nvr', value: val } })}
                    placeholder="Select NVR"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Camera Count <span className="text-red-500">*</span></label>
                  {nvrOptions.length > 0 && !isViewMode ? (
                    <MultiSelectDropdown
                      options={locationCameras
                        .filter(c => formData.nvr.includes(c.nvr))
                        .map(c => ({ value: String(c.camera_no) + '||' + c.nvr, label: `${c.nvr} : ${c.camera_no}` }))}
                      selected={formData.camera_no}
                      onChange={val => handleInputChange({ target: { name: 'camera_no', value: val } })}
                      placeholder="Select Camera No"
                    />
                  ) : (
                    <input
                      type="number"
                      name="camera_count"
                      value={formData.camera_count}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 ${
                        isViewMode ? 'bg-gray-50 text-gray-500' : ''
                      }`}
                      placeholder="Enter camera count"
                      disabled={isViewMode}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Issue <span className="text-red-500">*</span></label>
                  <select
                    name="issue"
                    value={formData.issue}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 ${
                      isViewMode ? 'bg-gray-50 text-gray-500' : ''
                    }`}
                    disabled={isViewMode}
                    required
                  >
                    <option value="">Select Issue</option>
                    {issueOptions.map((issue, index) => (
                      <option key={index} value={issue}>{issue}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {(() => {
                    // Check if ticket was created by compliance admin (no assigned vendors/engineers)
                    const isAdminCreated = !selectedTicket?.assigned_vendors && !selectedTicket?.assigned_engineers;
                    return isAdminCreated ? 'Admin Ticket Remarks' : 'Auditor Remarks';
                  })()
                  }
                </label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  rows={2}
                  className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 ${
                    isViewMode ? 'bg-gray-50 text-gray-500' : ''
                  }`}
                  placeholder="Enter any additional remarks..."
                  disabled={isViewMode}
                />
              </div>

              {!isViewMode && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {(() => {
                      // Check if ticket was created by compliance admin (no assigned vendors/engineers)
                      const isAdminCreated = !selectedTicket?.assigned_vendors && !selectedTicket?.assigned_engineers;
                      return isAdminCreated ? 'Admin Ticket Attachments' : 'Auditor Attachments';
                    })()
                    }
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-md p-4 text-center transition-colors cursor-pointer ${
                      isDragOver ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload').click()}
                  >
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    
                    {draggedFiles.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex gap-3 flex-wrap justify-center">
                          {draggedFiles.slice(0, 3).map((file, index) => (
                            <div key={index} className="relative group">
                              {file.type.startsWith('image/') ? (
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`Preview ${index + 1}`}
                                  className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                />
                              ) : (
                                <div className="w-16 h-16 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 p-1">
                                  <span className="truncate w-full text-center">{file.name.split('.').pop().toUpperCase()}</span>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(index);
                                }}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs hover:bg-red-600 flex items-center justify-center opacity-80 group-hover:opacity-100"
                                title="Delete file"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {draggedFiles.length > 3 && (
                            <div className="w-16 h-16 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200">
                              +{draggedFiles.length - 3}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{draggedFiles.length} file(s) selected</p>
                      </div>
                    ) : (
                      <div>
                        <CloudArrowUpIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-500 mb-2">Drag and drop files here, or click to browse</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Show existing attachments in view mode */}
              {isViewMode && selectedTicket && (() => {
                const attachments = parseAttachments(selectedTicket.attachments);
                return attachments.length > 0 ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {(() => {
                        // Check if ticket was created by compliance admin (no assigned vendors/engineers)
                        const isAdminCreated = !selectedTicket?.assigned_vendors && !selectedTicket?.assigned_engineers;
                        return isAdminCreated ? 'Admin Ticket Attachments' : 'Auditor Attachments';
                      })()
                      }
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((att, idx) => {
                        const fileExt = att.split('.').pop().toLowerCase();
                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                        return isImage ? (
                          <img key={idx} src={`${BACKEND_URL}/uploads/tickets/${att}`} alt={`att-${idx}`}
                            className="w-16 h-16 object-cover rounded border" />
                        ) : (
                          <a key={idx} href={`${BACKEND_URL}/uploads/tickets/${att}`} download
                            className="w-20 h-16 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-1"
                            title={att}>
                            <span className="font-medium">{fileExt.toUpperCase()}</span>
                            <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{att.split('-').slice(2).join('-')}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Back
                </button>
                {!isViewMode && (
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs text-white bg-btn-primary hover:opacity-90 rounded-md transition-colors"
                  >
                    Update Ticket
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const sorted = sortTickets(filteredTickets, sortKey, sortDir);

  const paginated = itemsPerPage === 'all' ? sorted : sorted.slice(0, itemsPerPage);

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Compliance Admin Tickets</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
          <span className="text-sm text-gray-500">to</span>
          <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-2 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-red-100 rounded-lg flex flex-col flex-1 min-h-0">
        <div className="overflow-x-auto overflow-y-auto scroll-container flex-1 min-h-0">
          <table className="min-w-full">
            <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
              <tr>
                {[['ticket_number','Ticket Number'],['location','Location'],['department','Department'],['division','Division'],['checklist_name','Checklist'],['camera_count','Camera Count'],['issue','Issue'],['admin_aging','Admin Aging'],['vendor_aging','Vendor Aging'],['engineer_aging','Engineer Aging'],['status','Status'],['completed_at','Completed On'],['created_at','Created On']].map(([key, label]) => (
                  <th key={key} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(key)}>
                    {label}<SortIcon col={key} />
                  </th>
                ))}
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="14" className="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan="14" className="px-4 py-6 text-center text-gray-500">No tickets found</td></tr>
              ) : (
                paginated.map((ticket, index) => (
                  <tr key={ticket.id} className={`cursor-pointer hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`} onClick={() => handleView(ticket)}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.ticket_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.location || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.department || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.division || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.checklist_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.camera_count || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.issue}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.admin_aging !== null && ticket.admin_aging !== undefined ? `${ticket.admin_aging} days` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.vendor_aging !== null && ticket.vendor_aging !== undefined ? `${ticket.vendor_aging} days` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.engineer_aging !== null && ticket.engineer_aging !== undefined ? `${ticket.engineer_aging} days` : '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                        ticket.status === 'Completed' ? 'bg-green-100 text-green-800 border-green-200' :
                        ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        ticket.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        ticket.status === 'Raised' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        ticket.status === 'New' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>{ticket.status || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {(() => {
                        if (ticket.vendor_status === 'Completed' && ticket.vendor_completed_at) return formatDate(ticket.vendor_completed_at);
                        if (ticket.engineer_status === 'Completed' && ticket.engineer_completed_at) return formatDate(ticket.engineer_completed_at);
                        if (ticket.status === 'Completed' && ticket.completed_at) return formatDate(ticket.completed_at);
                        return '-';
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(ticket.created_at)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleView(ticket)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="View">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {(() => {
                          const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                          const isCompleted = effectiveStatus === 'Completed';
                          return (
                            <button onClick={() => !isCompleted && handleEdit(ticket)}
                              className={`p-1 rounded transition-colors ${isCompleted ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'}`}
                              title={isCompleted ? 'Cannot edit completed ticket' : 'Edit'} disabled={isCompleted}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          );
                        })()}
                        <button onClick={() => handleDelete(ticket)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors" title="Delete">
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
          <div className="text-gray-600">Showing <span className="font-medium">{paginated.length}</span> of <span className="font-medium">{sorted.length}</span></div>
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
    </div>
  );
};

export default ComplianceAdminTickets;