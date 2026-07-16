import React, { useState, useEffect } from 'react';
import { PlusIcon, XMarkIcon, CloudArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import showToast from '../utils/toast';
import PageHeader from '../components/UI/PageHeader';
import Modal from '../components/UI/Modal';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import Swal from 'sweetalert2';

import MobileSelect from '../components/UI/MobileSelect';
import MobileDatePicker from '../components/UI/MobileDatePicker';
import { sortTickets } from '../utils/ticketSort';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/UI/MultiSelectDropdown';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const isMobile = window.innerWidth <= 768;

const Tickets = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [draggedFiles, setDraggedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [locationCameras, setLocationCameras] = useState([]);
  const [nvrOptions, setNvrOptions] = useState([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
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
  
  const [formData, setFormData] = useState({
    checklist_id: '',
    location: '',
    department: '',
    category: '',
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
    'Camera offline goes offline often',
    'IT Infra'
  ];

  useEffect(() => {
    fetchTickets();
    fetchUserChecklists();
  }, []);

  const resetForm = () => {
    setFormData({
      checklist_id: '',
      location: '',
      department: '',
      category: '',
      checklist_camera_count: '',
      camera_count: '',
      nvr: [],
      camera_no: [],
      issue: '',
      remarks: '',
      attachments: []
    });
    setDraggedFiles([]);
    setLocationCameras([]);
    setNvrOptions([]);
    setEditingTicket(null);
    setIsEditMode(false);
  };

  const fetchLocationCameras = async (location) => {
    if (!location) { setLocationCameras([]); setNvrOptions([]); return; }
    try {
      const res = await api.get(`/tickets/location-cameras?location=${encodeURIComponent(location)}`);
      setNvrOptions(res.data.data?.nvrs || []);
      setLocationCameras(res.data.data?.cameras || []);
    } catch { setLocationCameras([]); setNvrOptions([]); }
  };

  const openEditForm = (ticket) => {
    setFormData({
      checklist_id: ticket.checklist_id || '',
      location: ticket.location || '',
      department: ticket.department || '',
      category: ticket.category || '',
      checklist_camera_count: ticket.checklist_camera_count || '',
      camera_count: ticket.camera_count || '',
      nvr: [],
      camera_no: [],
      issue: ticket.issue || '',
      remarks: ticket.remarks || '',
      attachments: []
    });
    if (ticket.location) fetchLocationCameras(ticket.location);
    setEditingTicket(ticket);
    setIsEditMode(true);
    setShowCreateForm(true);
  };

  const handleDeleteTicket = async (ticket) => {
    const result = await Swal.fire({
      title: 'Delete Ticket',
      text: `Are you sure you want to delete ticket "${ticket.ticket_number || `#${ticket.id}`}"? This action cannot be undone.`,
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
      await api.delete(`/tickets/${ticket.id}`);
      showToast('success', 'Ticket deleted successfully!');
      fetchTickets();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      showToast('error', error.response?.data?.error || 'Error deleting ticket. Please try again.');
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tickets');
      if (response.data.data) {
        setTickets(response.data.data.tickets);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!showImageModal) return;

      if (event.key === 'Escape') {
        setShowImageModal(false);
      } else if (event.key === 'ArrowLeft' && selectedImages.length > 1) {
        const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : selectedImages.length - 1;
        setCurrentImageIndex(newIndex);
      } else if (event.key === 'ArrowRight' && selectedImages.length > 1) {
        const newIndex = currentImageIndex < selectedImages.length - 1 ? currentImageIndex + 1 : 0;
        setCurrentImageIndex(newIndex);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showImageModal, selectedImages, currentImageIndex]);

  useEffect(() => {
    const handleFormKeyDown = (event) => {
      if (event.key === 'Escape' && showCreateForm) {
        resetForm();
        setShowCreateForm(false);
      }
    };

    document.addEventListener('keydown', handleFormKeyDown);
    return () => document.removeEventListener('keydown', handleFormKeyDown);
  }, [showCreateForm]);

  const fetchUserChecklists = async () => {
    try {
      const response = await api.get('/compliance/masters/checklists');
      const data = response.data.data?.checklists || [];
      setChecklists(data.map(c => ({ checklist_id: c.id, checklist_name: c.checklist_name, camera_count: c.camera_count, location_name: c.location_name, department_name: c.department_name, category_name: c.category_name })));
    } catch (error) {
      console.error('Error fetching checklists:', error);
    }
  };

  const getChecklistOptions = () => {
    const grouped = checklists.reduce((acc, c) => {
      const loc = c.location_name || 'No Location';
      if (!acc[loc]) acc[loc] = [];
      acc[loc].push(c);
      return acc;
    }, {});
    const sortedLocs = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    const opts = [];
    sortedLocs.forEach(loc => {
      opts.push({ value: `all-location-${loc}`, label: `All ${loc} Checklists` });
    });
    sortedLocs.forEach(loc => {
      grouped[loc].forEach(c => {
        opts.push({ value: String(c.checklist_id), label: c.checklist_name });
      });
    });
    return opts;
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;

    if (name === 'checklist_id') {
      if (value && value.startsWith('all-location-')) {
        const locationName = value.replace('all-location-', '');
        const locationChecklists = checklists.filter(c => c.location_name === locationName);
        const totalCameraCount = locationChecklists.reduce((sum, c) => sum + (parseInt(c.camera_count) || 0), 0);
        setFormData(prev => ({
          ...prev,
          checklist_id: value,
          location: locationName,
          department: [...new Set(locationChecklists.map(c => c.department_name).filter(Boolean))].join(', '),
          category: locationChecklists[0]?.category_name || '',
          checklist_camera_count: totalCameraCount || '',
          nvr: [],
          camera_no: []
        }));
        fetchLocationCameras(locationName);
      } else {
        const selectedChecklist = checklists.find(c => c.checklist_id === parseInt(value));
        setFormData(prev => ({
          ...prev,
          checklist_id: value,
          location: selectedChecklist?.location_name || '',
          department: selectedChecklist?.department_name || '',
          category: selectedChecklist?.category_name || '',
          checklist_camera_count: selectedChecklist?.camera_count || '',
          nvr: [],
          camera_no: []
        }));
        fetchLocationCameras(selectedChecklist?.location_name || '');
      }
    } else if (name === 'nvr') {
      const kept = formData.camera_no.filter(key => value.includes(key.split('||')[1]));
      setFormData(prev => ({ ...prev, nvr: value, camera_no: kept, camera_count: kept.length.toString() }));
    } else if (name === 'camera_no') {
      const newlySelected = value.filter(v => !formData.camera_no.includes(v));
      if (newlySelected.length > 0 && formData.location && formData.issue) {
        try {
          const resp = await api.get('/tickets/check-conflicts', {
            params: { location: formData.location, camera_nos: newlySelected.join(','), issue: formData.issue, exclude_ticket_id: editingTicket?.id }
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
            params: { location: formData.location, camera_nos: formData.camera_no.join(','), issue: value, exclude_ticket_id: editingTicket?.id }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.issue || (!formData.camera_count && formData.camera_no.length === 0)) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    if (formData.camera_no.length > 0 && formData.location && formData.issue) {
      try {
        const resp = await api.get('/tickets/check-conflicts', {
          params: { location: formData.location, camera_nos: formData.camera_no.join(','), issue: formData.issue, exclude_ticket_id: editingTicket?.id }
        });
        const { cameraConflicts } = resp.data.data;
        if (cameraConflicts.length > 0) {
          const labels = cameraConflicts.map(c => {
            const itemLabels = c.items.map(v => { const [cam, nvr] = v.split('||'); return nvr ? `${nvr} : ${cam}` : cam; });
            return `${c.ticket} (${itemLabels.join(', ')})`;
          });
          showToast('error', `Cannot ${isEditMode ? 'update' : 'create'} ticket. Camera(s) already in active ticket(s) with same issue: ${labels.join(' | ')}`);
          return;
        }
      } catch {}
    }

    try {
      const submitData = new FormData();
      const realChecklistId = formData.checklist_id && !formData.checklist_id.startsWith('all-location-') ? formData.checklist_id : '';
      submitData.append('checklist_id', realChecklistId);
      submitData.append('checklist_camera_count', formData.checklist_camera_count);
      submitData.append('camera_count', formData.camera_count);
      submitData.append('nvr', JSON.stringify(formData.nvr));
      submitData.append('camera_no', JSON.stringify(formData.camera_no));
      submitData.append('issue', formData.issue);
      submitData.append('remarks', formData.remarks);
      submitData.append('location', formData.location);
      submitData.append('department', formData.department);
      submitData.append('category', formData.category);
      
      formData.attachments.forEach((file) => {
        submitData.append('attachments', file);
      });

      let response;
      if (isEditMode && editingTicket) {
        response = await api.put(`/tickets/${editingTicket.id}`, submitData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        showToast('success', 'Ticket updated successfully!');
      } else {
        response = await api.post('/tickets', submitData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        showToast('success', 'Ticket created successfully!');
      }

      if (response.data.data) {
        resetForm();
        setShowCreateForm(false);
        fetchTickets();
      }
      
    } catch (error) {
      console.error('Error saving ticket:', error);
      const errorMessage = isEditMode ? 'Error updating ticket. Please try again.' : 'Error creating ticket. Please try again.';
      showToast('error', error.response?.data?.error || errorMessage);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchText = !searchTerm ||
      String(t.id).includes(searchTerm) ||
      (t.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.issue || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.remarks || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    const d = t.created_at ? new Date(t.created_at) : null;
    const matchFrom = !fromDate || (d && d >= new Date(fromDate));
    const matchTo = !toDate || (d && d <= new Date(toDate + 'T23:59:59'));
    return matchText && matchFrom && matchTo;
  });
  const sorted = sortTickets(filteredTickets, sortKey, sortDir);
  const paginated = itemsPerPage === 'all' ? sorted : sorted.slice(0, itemsPerPage);

  const statusColor = (s) => {
    if (s === 'Completed') return 'bg-green-100 text-green-800 border-green-200';
    if (s === 'In Progress') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s === 'Pending') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (s === 'Raised') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (s === 'New') return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const getDisplayStatus = (ticket) => ticket.vendor_status || ticket.engineer_status || ticket.status;

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        {/* Image Modal */}
        {showImageModal && selectedImages.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[200]" onClick={() => setShowImageModal(false)}>
            <div className="relative w-full h-full flex items-center justify-center">
              <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><XMarkIcon className="w-6 h-6" /></button>
              <a href={selectedImages[currentImageIndex]} download onClick={e => e.stopPropagation()} className="absolute top-4 right-16 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ArrowDownTrayIcon className="w-6 h-6" /></a>
              {selectedImages.length > 1 && (
                <>
                  <button onClick={e => { e.stopPropagation(); setCurrentImageIndex(p => p > 0 ? p - 1 : selectedImages.length - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ChevronLeftIcon className="w-6 h-6" /></button>
                  <button onClick={e => { e.stopPropagation(); setCurrentImageIndex(p => p < selectedImages.length - 1 ? p + 1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ChevronRightIcon className="w-6 h-6" /></button>
                </>
              )}
              <img src={selectedImages[currentImageIndex]} alt="Preview" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
              {selectedImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">{currentImageIndex + 1} / {selectedImages.length}</div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base font-bold text-gray-800">Tickets</h1>
            <button
              onClick={() => { resetForm(); setShowCreateForm(!showCreateForm); }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg flex items-center gap-1"
            >
              {showCreateForm ? <ArrowLeftIcon className="w-3.5 h-3.5" /> : <PlusIcon className="w-3.5 h-3.5" />}
              {showCreateForm ? 'Back' : 'Create'}
            </button>
          </div>
          {!showCreateForm && (
            <input type="text" placeholder="Search tickets..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 mb-2" />
          )}
          {!showCreateForm && (
            <div className="flex gap-2 items-center mt-1">
              <div className="flex-1">
                <MobileDatePicker label="From Date" value={fromDate} max={toDate || undefined} onChange={setFromDate} placeholder="From date" />
              </div>
              <span className="text-xs text-gray-400">to</span>
              <div className="flex-1">
                <MobileDatePicker label="To Date" value={toDate} min={fromDate || undefined} onChange={setToDate} placeholder="To date" />
              </div>
              {(fromDate || toDate) && (
                <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-xs text-red-500 font-medium">Clear</button>
              )}
            </div>
          )}
        </div>

        {/* Mobile Create Form */}
        {showCreateForm && (
          <div className="p-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">{isEditMode ? 'Edit Ticket' : 'Create New Ticket'}</h2>
                <button type="button" onClick={() => { resetForm(); setShowCreateForm(false); }} className="p-1 text-gray-400 hover:text-red-600"><XMarkIcon className="w-5 h-5" /></button>
              </div>
              <div className="px-4 py-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Checklist <span className="text-red-500">*</span></label>
                    <MobileSelect
                      label="Select Checklist"
                      value={formData.checklist_id}
                      onChange={val => handleInputChange({ target: { name: 'checklist_id', value: val } })}
                      options={getChecklistOptions()}
                      placeholder="Select Checklist"
                    />
                    {!formData.checklist_id && !isEditMode && <input type="text" required className="sr-only" tabIndex={-1} />}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                      <input type="text" value={formData.location} readOnly className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50" placeholder="Auto-filled" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                      <input type="text" value={formData.department} readOnly className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50" placeholder="Auto-filled" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <input type="text" value={formData.category} readOnly className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50" placeholder="Auto-filled" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cam Count</label>
                      <input type="number" value={formData.checklist_camera_count} readOnly className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50" placeholder="Auto-filled" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Camera Count <span className="text-red-500">*</span></label>
                      {nvrOptions.length > 0 ? (
                        <MultiSelectDropdown
                          options={locationCameras
                            .filter(c => formData.nvr.includes(c.nvr))
                            .map(c => ({ value: String(c.camera_no) + '||' + c.nvr, label: `${c.nvr} : ${c.camera_no}` }))}
                          selected={formData.camera_no}
                          onChange={val => handleInputChange({ target: { name: 'camera_no', value: val } })}
                          placeholder="Select Camera Count"
                        />
                      ) : (
                        <input type="number" name="camera_count" value={formData.camera_count} onChange={handleInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400" placeholder="Enter count" />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">NVR</label>
                      <MultiSelectDropdown
                        options={nvrOptions.map(nvr => ({ value: nvr, label: nvr }))}
                        selected={formData.nvr}
                        onChange={val => handleInputChange({ target: { name: 'nvr', value: val } })}
                        placeholder="Select NVR"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Issue <span className="text-red-500">*</span></label>
                    <MobileSelect
                      label="Select Issue"
                      value={formData.issue}
                      onChange={val => handleInputChange({ target: { name: 'issue', value: val } })}
                      options={issueOptions.map(issue => ({ value: issue, label: issue }))}
                      placeholder="Select Issue"
                    />
                    {!formData.issue && <input type="text" required className="sr-only" tabIndex={-1} />}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                    <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400" placeholder="Enter remarks..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Attachments</label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer border-gray-300"
                      onClick={() => document.getElementById('file-upload-mobile').click()}>
                      {draggedFiles.length > 0 ? (
                        <div className="flex gap-2 flex-wrap justify-center">
                          {draggedFiles.map((file, i) => (
                            <div key={i} className="relative">
                              {file.type.startsWith('image/') ? (
                                <img src={URL.createObjectURL(file)} alt={`p-${i}`} className="w-14 h-14 object-cover rounded border" />
                              ) : (
                                <div className="w-14 h-14 flex items-center justify-center border rounded bg-gray-50 text-xs text-gray-600">{file.name.split('.').pop().toUpperCase()}</div>
                              )}
                              <button type="button" onClick={e => { e.stopPropagation(); removeFile(i); }}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">×</button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Tap to select files</p>
                      )}
                      <input type="file" multiple id="file-upload-mobile" className="hidden" onChange={handleFileSelect} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => { resetForm(); setShowCreateForm(false); }}
                      className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-lg">Cancel</button>
                    <button type="submit" className="flex-1 py-2.5 text-sm text-white bg-red-600 rounded-lg">
                      {isEditMode ? 'Update Ticket' : 'Create Ticket'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Cards */}
        {!showCreateForm && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-6">
            {loading ? (
              <div className="text-center py-10 text-gray-500">Loading...</div>
            ) : paginated.length === 0 ? (
              <div className="text-center py-10 text-gray-500">No tickets found.</div>
            ) : paginated.map((ticket) => {
              const displayStatus = getDisplayStatus(ticket);
              const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
              const isCompleted = effectiveStatus === 'Completed';
              return (
                <div key={ticket.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <span className="text-sm font-bold text-gray-800">{ticket.ticket_number || `#${ticket.id}`}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor(displayStatus)}`}>
                      {displayStatus || 'New'}
                    </span>
                  </div>
                  {/* Card Body */}
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div>
                        <span className="text-xs text-gray-500 block mb-0.5">Issue</span>
                        <span className="font-medium text-gray-800">{ticket.issue || '-'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-0.5">Location</span>
                        <span className="text-gray-700">{ticket.location || '-'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-0.5">Category</span>
                        <span className="text-gray-700">{ticket.category || '-'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-0.5">Camera Count</span>
                        <span className="text-gray-700">{ticket.camera_count || '-'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-0.5">Created On</span>
                        <span className="text-gray-700">{formatDateTime(ticket.created_at)}</span>
                      </div>
                      {ticket.completed_at && (
                        <div>
                          <span className="text-xs text-gray-500 block mb-0.5">Completed On</span>
                          <span className="text-gray-700">{formatDate(ticket.vendor_completed_at || ticket.engineer_completed_at || ticket.completed_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Card Actions */}
                  <div className="flex border-t border-gray-100">
                    <button onClick={() => { setSelectedTicket(ticket); setShowViewModal(true); }}
                      className="flex-1 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      View
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button onClick={() => !isCompleted && openEditForm(ticket)} disabled={isCompleted}
                      className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 ${
                        isCompleted ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:bg-green-50'
                      }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Edit
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button onClick={() => handleDeleteTicket(ticket)}
                      className="flex-1 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 flex items-center justify-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {!showCreateForm && (
          <div className="bg-white border-t border-gray-200 px-4 py-2 text-xs text-gray-500 text-center">
            {paginated.length} of {filteredTickets.length} tickets
          </div>
        )}

        {/* View Modal */}
        <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setSelectedTicket(null); }} title="Ticket Details" size="2xl">
          {selectedTicket && (() => {
            const parseJSON = (raw) => { if (!raw) return []; try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; } };
            const displayStatus = getDisplayStatus(selectedTicket);
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[['Ticket Number', selectedTicket.ticket_number || `#${selectedTicket.id}`],['Checklist', selectedTicket.checklist_name || '-'],['Location', selectedTicket.location || '-'],['Category', selectedTicket.category || '-'],['Camera Count', selectedTicket.camera_count || '-'],['NVR', 'nvr'],['Camera No', 'camera_no'],['Issue', selectedTicket.issue],['Created On', formatDateTime(selectedTicket.created_at)],['Status', 'badge']].map(([label, val]) => (
                    <div key={label}>
                      <span className="block text-xs text-gray-500 mb-0.5">{label}</span>
                      <div className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm">
                        {label === 'Status' ? (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor(displayStatus)}`}>{displayStatus || '-'}</span>
                        ) : label === 'NVR' ? (() => {
                          try { const arr = JSON.parse(selectedTicket.nvr); return Array.isArray(arr) ? arr.join(', ') : selectedTicket.nvr || '-'; } catch { return selectedTicket.nvr || '-'; }
                        })() : label === 'Camera No' ? (() => {
                          try { const arr = JSON.parse(selectedTicket.camera_no); return Array.isArray(arr) ? arr.map(k => { const [cam, nvr] = k.split('||'); return nvr ? `${nvr} : ${cam}` : cam; }).join(', ') : selectedTicket.camera_no || '-'; } catch { return selectedTicket.camera_no || '-'; }
                        })() : val}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedTicket.remarks && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Remarks</span>
                    <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">{selectedTicket.remarks}</div>
                  </div>
                )}
                {selectedTicket.vendor_remarks && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Vendor Remarks</span>
                    <div className="px-3 py-2 bg-green-50 border border-green-200 rounded text-sm">{selectedTicket.vendor_remarks}</div>
                  </div>
                )}
                {selectedTicket.engineer_remarks && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Engineer Remarks</span>
                    <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded text-sm">{selectedTicket.engineer_remarks}</div>
                  </div>
                )}
                {parseJSON(selectedTicket.attachments).length > 0 && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Attachments</span>
                    <div className="flex flex-wrap gap-2">
                      {parseJSON(selectedTicket.attachments).map((att, idx) => {
                        const ext = att.split('.').pop().toLowerCase();
                        const isImg = ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);
                        const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                        return isImg ? (
                          <img key={idx} src={src} alt={`a-${idx}`} className="w-16 h-16 object-cover rounded border cursor-pointer"
                            onClick={() => { const imgs = parseJSON(selectedTicket.attachments).filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())).map(a => `${BACKEND_URL}/uploads/tickets/${a}`); setSelectedImages(imgs); setCurrentImageIndex(imgs.indexOf(src)); setShowImageModal(true); }} />
                        ) : (
                          <a key={idx} href={src} download className="w-16 h-16 flex items-center justify-center border rounded bg-gray-50 text-xs text-gray-600">{ext.toUpperCase()}</a>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-2 border-t border-gray-200">
                  <button onClick={() => { setShowViewModal(false); setSelectedTicket(null); }}
                    className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg">Close</button>
                </div>
              </div>
            );
          })()}
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3 overflow-y-auto scroll-container">
      {/* View Ticket Modal */}
      <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setSelectedTicket(null); }} title="Ticket Details" size="2xl">
        {selectedTicket && (() => {
          const parseJSON = (raw) => {
            if (!raw) return [];
            try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
          };
          const attachments = parseJSON(selectedTicket.attachments).map(a => `${BACKEND_URL}/uploads/tickets/${a}`);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Number</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.ticket_number || `#${selectedTicket.id}`}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Name</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.checklist_name || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Camera Count</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.camera_count || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.location || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.department || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.category || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.issue}</div>
                </div>
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NVR</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{(() => { try { const arr = JSON.parse(selectedTicket.nvr); return Array.isArray(arr) ? arr.join(', ') : selectedTicket.nvr || '-'; } catch { return selectedTicket.nvr || '-'; } })()}</div>
                </div>
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Camera NO</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{(() => { try { const arr = JSON.parse(selectedTicket.camera_no); return Array.isArray(arr) ? arr.map(k => { const [cam, nvr] = k.split('||'); return nvr ? `${nvr} : ${cam}` : cam; }).join(', ') : selectedTicket.camera_no || '-'; } catch { return selectedTicket.camera_no || '-'; } })()}</div>
                </div>
                
                {/* Remarks Section in Order */}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created Date</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{formatDateTime(selectedTicket.created_at)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    {(() => {
                      let displayStatus = selectedTicket.status;
                      if (selectedTicket.vendor_status) {
                        displayStatus = selectedTicket.vendor_status;
                      } else if (selectedTicket.engineer_status) {
                        displayStatus = selectedTicket.engineer_status;
                      }
                      return displayStatus ? (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
                          displayStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                          displayStatus === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                          displayStatus === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                          displayStatus === 'Raised' ? 'bg-blue-100 text-blue-700' :
                          displayStatus === 'New' ? 'bg-gray-100 text-gray-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{displayStatus}</span>
                      ) : '-';
                    })()
                    }
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Completed By</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    {(() => {
                      if (selectedTicket.vendor_status === 'Completed') {
                        return selectedTicket.vendor_name ? `${selectedTicket.vendor_name}(vendor)` : 'Vendor';
                      } else if (selectedTicket.engineer_status === 'Completed') {
                        return selectedTicket.engineer_name ? `${selectedTicket.engineer_name}(engineer)` : 'Engineer';
                      } else if (selectedTicket.status === 'Completed') {
                        return 'Admin';
                      }
                      return '-';
                    })()
                    }
                  </div>
                </div>
              </div>
              
              {/* REMARKS AND ATTACHMENTS SECTION */}
              <div className="grid grid-cols-3 gap-6">
                {/* 1. Auditor/Admin Remarks + Attachments */}
                <div>
                  <label className="block text-lg font-bold text-gray-900 mb-3">
                    {selectedTicket.creator_role_id === 1 || selectedTicket.creator_role_id === 8 ? 'Admin Ticket Remarks' : 'Auditor Remarks'}
                  </label>
                  <div className="px-5 py-4 bg-blue-50 border-2 border-blue-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.remarks || '-'}</div>
                  {(() => {
                    const atts = parseJSON(selectedTicket.attachments);
                    return atts.length > 0 ? (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {selectedTicket.creator_role_id === 1 || selectedTicket.creator_role_id === 8 ? `Admin Ticket Attachments (${atts.length})` : `Auditor Attachments (${atts.length})`}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {atts.map((att, idx) => {
                            const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                            const fileExt = att.split('.').pop().toLowerCase();
                            const isImage = ['jpg','jpeg','png','gif','webp','bmp'].includes(fileExt);
                            return isImage ? (
                              <img key={idx} src={src} alt={`att-${idx}`} className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                onClick={() => { const imgs = atts.filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())).map(a => `${BACKEND_URL}/uploads/tickets/${a}`); setSelectedImages(imgs); setCurrentImageIndex(imgs.indexOf(src)); setShowImageModal(true); }} />
                            ) : (
                              <a key={idx} href={src} download className="w-32 h-20 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-2" title={att}>
                                <span className="text-lg font-medium">{fileExt.toUpperCase()}</span>
                                <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{att.split('-').slice(2).join('-')}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
                {/* 2. Admin Raised Remarks + Attachments */}
                {selectedTicket.status_remarks && (selectedTicket.assigned_vendors || selectedTicket.assigned_engineers) && (
                  <div>
                    <label className="block text-lg font-bold text-gray-900 mb-3">Admin Raised Remarks</label>
                    <div className="px-5 py-4 bg-orange-50 border-2 border-orange-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.status_remarks || '-'}</div>
                    {(() => {
                      const raiseAtts = parseJSON(selectedTicket.raise_attachments);
                      return raiseAtts.length > 0 ? (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Admin Raised Attachments ({raiseAtts.length})</label>
                          <div className="flex flex-wrap gap-2">
                            {raiseAtts.map((att, idx) => {
                              const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                              const fileExt = att.split('.').pop().toLowerCase();
                              const isImage = ['jpg','jpeg','png','gif','webp','bmp'].includes(fileExt);
                              return isImage ? (
                                <img key={idx} src={src} alt={`raise-att-${idx}`} className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                  onClick={() => { const imgs = raiseAtts.filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())).map(a => `${BACKEND_URL}/uploads/tickets/${a}`); setSelectedImages(imgs); setCurrentImageIndex(imgs.indexOf(src)); setShowImageModal(true); }} />
                              ) : (
                                <a key={idx} href={src} download className="w-32 h-20 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-2" title={att}>
                                  <span className="text-lg font-medium">{fileExt.toUpperCase()}</span>
                                  <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{att.split('-').slice(2).join('-')}</span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
                {/* 3. Vendor/Engineer Remarks + Attachments */}
                {(() => {
                  const hasVendor = selectedTicket.assigned_vendors && (selectedTicket.vendor_remarks || parseJSON(selectedTicket.vendor_attachments).length > 0);
                  const hasEngineer = selectedTicket.assigned_engineers && (selectedTicket.engineer_remarks || parseJSON(selectedTicket.engineer_attachments).length > 0);
                  if (!hasVendor && !hasEngineer) return null;
                  return (
                    <div>
                      {hasVendor && (
                        <>
                          <label className="block text-lg font-bold text-gray-900 mb-3">Vendor Remarks</label>
                          <div className="px-5 py-4 bg-green-50 border-2 border-green-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.vendor_remarks || '-'}</div>
                          {(() => {
                            const vatts = parseJSON(selectedTicket.vendor_attachments);
                            return vatts.length > 0 ? (
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Attachments ({vatts.length})</label>
                                <div className="flex flex-wrap gap-2">
                                  {vatts.map((att, idx) => {
                                    const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                                    const fileExt = att.split('.').pop().toLowerCase();
                                    const isImage = ['jpg','jpeg','png','gif','webp','bmp'].includes(fileExt);
                                    return isImage ? (
                                      <img key={idx} src={src} alt={`v-att-${idx}`} className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                        onClick={() => { const imgs = vatts.filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())).map(a => `${BACKEND_URL}/uploads/tickets/${a}`); setSelectedImages(imgs); setCurrentImageIndex(imgs.indexOf(src)); setShowImageModal(true); }} />
                                    ) : (
                                      <a key={idx} href={src} download className="w-32 h-20 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-2" title={att}>
                                        <span className="text-lg font-medium">{fileExt.toUpperCase()}</span>
                                        <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{att.split('-').slice(2).join('-')}</span>
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </>
                      )}
                      {hasEngineer && (
                        <>
                          <label className="block text-lg font-bold text-gray-900 mb-3">Engineer Remarks</label>
                          <div className="px-5 py-4 bg-purple-50 border-2 border-purple-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.engineer_remarks || '-'}</div>
                          {(() => {
                            const eatts = parseJSON(selectedTicket.engineer_attachments);
                            return eatts.length > 0 ? (
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Engineer Attachments ({eatts.length})</label>
                                <div className="flex flex-wrap gap-2">
                                  {eatts.map((att, idx) => {
                                    const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                                    const fileExt = att.split('.').pop().toLowerCase();
                                    const isImage = ['jpg','jpeg','png','gif','webp','bmp'].includes(fileExt);
                                    return isImage ? (
                                      <img key={idx} src={src} alt={`e-att-${idx}`} className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                        onClick={() => { const imgs = eatts.filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())).map(a => `${BACKEND_URL}/uploads/tickets/${a}`); setSelectedImages(imgs); setCurrentImageIndex(imgs.indexOf(src)); setShowImageModal(true); }} />
                                    ) : (
                                      <a key={idx} href={src} download className="w-32 h-20 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-2" title={att}>
                                        <span className="text-lg font-medium">{fileExt.toUpperCase()}</span>
                                        <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{att.split('-').slice(2).join('-')}</span>
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </>
                      )}
                    </div>
                  );
                })()}
                {/* 4. Admin Closed Remarks */}
                {selectedTicket.status_remarks && !selectedTicket.assigned_vendors && !selectedTicket.assigned_engineers && (
                  <div>
                    <label className="block text-lg font-bold text-gray-900 mb-3">Admin Closed Remarks</label>
                    <div className="px-5 py-4 bg-red-50 border-2 border-red-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.status_remarks || '-'}</div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button onClick={() => { setShowViewModal(false); setSelectedTicket(null); }}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Close
                </button>
              </div>
            </div>
          );
        })()
        }
      </Modal>

      {/* Image Gallery Modal */}
      {showImageModal && selectedImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            <a
              href={selectedImages[currentImageIndex]}
              download
              className="absolute top-4 right-16 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowDownTrayIcon className="w-6 h-6" />
            </a>

            {selectedImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : selectedImages.length - 1);
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev < selectedImages.length - 1 ? prev + 1 : 0);
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}

            <img
              src={selectedImages[currentImageIndex]}
              alt={`Preview ${currentImageIndex + 1}`}
              className="w-full h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {selectedImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">
                {currentImageIndex + 1} / {selectedImages.length}
              </div>
            )}
          </div>
        </div>
      )}

      <PageHeader title="Tickets">
        <div className="flex items-center space-x-3">
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); }}
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
          <button
            onClick={() => {
              resetForm();
              setShowCreateForm(!showCreateForm);
            }}
            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
          >
            {showCreateForm ? <ArrowLeftIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
            <span>{showCreateForm ? 'Back' : 'Create Ticket'}</span>
          </button>
        </div>
      </PageHeader>

      {/* Create Ticket Accordion */}
      {showCreateForm && (
        <div style={{ marginTop: '40px' }}>
        <div className="max-w-5xl mx-auto mt-5 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{isEditMode ? 'Edit Ticket' : 'Create New Ticket'}</h2>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowCreateForm(false);
              }}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="px-5 py-4">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Checklist <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={getChecklistOptions()}
                    value={formData.checklist_id}
                    onChange={val => handleInputChange({ target: { name: 'checklist_id', value: val } })}
                    placeholder="Select Checklist"
                  />
                  {!formData.checklist_id && !isEditMode && <input type="text" required className="sr-only" tabIndex={-1} />}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
                    placeholder="Auto-filled from checklist"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
                    placeholder="Auto-filled from checklist"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
                    placeholder="Auto-filled from checklist"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Checklist Camera Count</label>
                  <input
                    type="number"
                    value={formData.checklist_camera_count}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
                    placeholder="Auto-filled from checklist"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">NVR</label>
                  <MultiSelectDropdown
                    options={nvrOptions.map(nvr => ({ value: nvr, label: nvr }))}
                    selected={formData.nvr}
                    onChange={val => handleInputChange({ target: { name: 'nvr', value: val } })}
                    placeholder="Select NVR"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Camera Count <span className="text-red-500">*</span></label>
                  {nvrOptions.length > 0 ? (
                    <MultiSelectDropdown
                      options={locationCameras
                        .filter(c => formData.nvr.includes(c.nvr))
                        .map(c => ({ value: String(c.camera_no) + '||' + c.nvr, label: `${c.nvr} : ${c.camera_no}` }))}
                      selected={formData.camera_no}
                      onChange={val => handleInputChange({ target: { name: 'camera_no', value: val } })}
                      placeholder="Select Camera Count"
                    />
                  ) : (
                    <input
                      type="number"
                      name="camera_count"
                      value={formData.camera_count}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                      placeholder="Enter camera count"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Issue <span className="text-red-500">*</span></label>
                  <select
                    name="issue"
                    value={formData.issue}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="Enter any additional remarks..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Attachments</label>
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const imageUrls = draggedFiles.filter(f => f.type.startsWith('image/')).map(f => URL.createObjectURL(f));
                                  setSelectedImages(imageUrls);
                                  setCurrentImageIndex(index);
                                  setShowImageModal(true);
                                }}
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
                          <div
                            className="w-16 h-16 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              const imageUrls = draggedFiles.map(f => URL.createObjectURL(f));
                              setSelectedImages(imageUrls);
                              setCurrentImageIndex(3);
                              setShowImageModal(true);
                            }}
                          >
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowCreateForm(false);
                  }}
                  className="px-4 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs text-white bg-btn-primary hover:opacity-90 rounded-md transition-colors"
                >
                  {isEditMode ? 'Update Ticket' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>
      )}

      {!showCreateForm && (
        <div className="bg-white border border-red-100 rounded-lg flex flex-col flex-1 min-h-0">
          <div className="overflow-auto scroll-container flex-1 min-h-0">
            <table className="min-w-full">
              <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('ticket_number')}>Ticket Number<SortIcon col="ticket_number" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('checklist_name')}>Checklist Name<SortIcon col="checklist_name" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('location')}>Location<SortIcon col="location" /></th>
                  {/* <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('department')}>Department<SortIcon col="department" /></th> */}
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('category')}>Category<SortIcon col="category" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('camera_count')}>Camera Count<SortIcon col="camera_count" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('nvr')}>NVR<SortIcon col="nvr" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('camera_no')}>Camera No<SortIcon col="camera_no" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('issue')}>Issue<SortIcon col="issue" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('status')}>Status<SortIcon col="status" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10" style={{ backgroundColor: '#ededed' }}>Completed By</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('created_at')}>Created On<SortIcon col="created_at" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap sticky top-0 z-10" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('completed_at')}>Completed On<SortIcon col="completed_at" /></th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 right-0 z-30" style={{ backgroundColor: '#ededed' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="12" className="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan="12" className="px-4 py-6 text-center text-gray-500">No tickets found.</td></tr>
                ) : (
                  paginated.map((ticket, index) => {
                    let attachments = [];
                    if (ticket.attachments) {
                      try { attachments = typeof ticket.attachments === 'string' ? JSON.parse(ticket.attachments) : ticket.attachments; } catch (e) {}
                    }
                    return (
                      <tr key={ticket.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} cursor-pointer hover:bg-blue-50 transition-colors`}
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setShowViewModal(true);
                        }}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.ticket_number || `#${ticket.id}`}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{ticket.checklist_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ticket.location || '-'}</td>
                        {/* <td className="px-4 py-3 text-sm text-gray-600">{ticket.department || '-'}</td> */}
                        <td className="px-4 py-3 text-sm text-gray-600">{ticket.category || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{ticket.camera_count || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(() => {
                            try {
                              const arr = JSON.parse(ticket.nvr);
                              if (!Array.isArray(arr) || arr.length === 0) return ticket.nvr || '-';
                              if (arr.length <= 2) return arr.join(', ');
                              return <span className="cursor-default" title={arr.join(', ')}>{arr.slice(0, 2).join(', ')}...</span>;
                            } catch { return ticket.nvr || '-'; }
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(() => {
                            try {
                              const arr = JSON.parse(ticket.camera_no);
                              if (!Array.isArray(arr) || arr.length === 0) return ticket.camera_no || '-';
                              const labels = arr.map(k => { const [cam, nvr] = k.split('||'); return nvr ? `${nvr} : ${cam}` : cam; });
                              if (labels.length <= 2) return labels.join(', ');
                              return <span className="cursor-default" title={labels.join(', ')}>{labels.slice(0, 2).join(', ')}...</span>;
                            } catch { return ticket.camera_no || '-'; }
                          })()}
                        </td>
                        {/* <td className="px-4 py-3 text-sm text-gray-900">{ticket.user_name || '-'}</td> */}
                        <td className="px-4 py-3 text-sm text-gray-900">{ticket.issue}</td>
                        {/* <td className="px-4 py-3 text-sm text-gray-600">{ticket.remarks || '-'}</td> */}
                        {/* <td className="px-4 py-3">
                          {attachments.length > 0 ? (
                            <div className="flex gap-1">
                              {attachments.slice(0, 3).map((att, i) => {
                                const fileExt = att.split('.').pop().toLowerCase();
                                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                                return isImage ? (
                                  <img
                                    key={i}
                                    src={`${process.env.REACT_APP_BACKEND_URL}/uploads/tickets/${att}`}
                                    alt={`Attachment ${i + 1}`}
                                    className="w-8 h-8 object-cover rounded border cursor-pointer hover:opacity-80"
                                    onClick={() => {
                                      const imageAttachments = attachments.filter(a => {
                                        const ext = a.split('.').pop().toLowerCase();
                                        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                      });
                                      setSelectedImages(imageAttachments.map(a => `${process.env.REACT_APP_BACKEND_URL}/uploads/tickets/${a}`));
                                      setCurrentImageIndex(imageAttachments.indexOf(att));
                                      setShowImageModal(true);
                                    }}
                                  />
                                ) : (
                                  <a
                                    key={i}
                                    href={`${process.env.REACT_APP_BACKEND_URL}/uploads/tickets/${att}`}
                                    download
                                    className="flex items-center gap-1 px-2 py-1 border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100"
                                    title={att}
                                  >
                                    <span className="font-medium">{fileExt.toUpperCase()}</span>
                                    <span className="max-w-[60px] truncate">{att.split('-').slice(2).join('-')}</span>
                                  </a>
                                );
                              })}
                              {attachments.length > 3 && (
                                <div className="w-8 h-8 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600">+{attachments.length - 3}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td> */}
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            // Show vendor/engineer status if they have updated it, otherwise show ticket status
                            let displayStatus = ticket.status;
                            
                            // If vendor or engineer has updated their status, show their mapped database status
                            if (ticket.vendor_status) {
                              displayStatus = ticket.vendor_status;
                            } else if (ticket.engineer_status) {
                              displayStatus = ticket.engineer_status;
                            }
                            
                            return displayStatus ? (
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                displayStatus === 'Completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                                displayStatus === 'In Progress' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                displayStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                displayStatus === 'Raised' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                displayStatus === 'New' ? 'bg-gray-100 text-gray-800 border border-gray-200' :
                                'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}>
                                {displayStatus}
                              </span>
                            ) : <span className="text-gray-400">-</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(() => {
                            if (ticket.vendor_status === 'Completed') {
                              return ticket.vendor_name ? `${ticket.vendor_name}(vendor)` : 'Vendor';
                            } else if (ticket.engineer_status === 'Completed') {
                              return ticket.engineer_name ? `${ticket.engineer_name}(engineer)` : 'Engineer';
                            } else if (ticket.status === 'Completed') {
                              return 'Admin';
                            }
                            return '-';
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(ticket.created_at)}</td>
                        {/* <td className="px-4 py-3 text-sm text-gray-600">{ticket.status_remarks || '-'}</td> */}
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {(() => {
                            if (ticket.vendor_status === 'Completed' && ticket.vendor_completed_at) {
                              return formatDate(ticket.vendor_completed_at);
                            } else if (ticket.engineer_status === 'Completed' && ticket.engineer_completed_at) {
                              return formatDate(ticket.engineer_completed_at);
                            } else if (ticket.status === 'Completed' && ticket.completed_at) {
                              return formatDate(ticket.completed_at);
                            }
                            return '-';
                          })()
                        }</td>
                        <td className="px-4 py-3 sticky right-0 z-10" style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedTicket(ticket);
                                setShowViewModal(true);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                              title="View"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                                const isCompleted = effectiveStatus === 'Completed';
                                if (!isCompleted) {
                                  openEditForm(ticket);
                                }
                              }}
                              className={`p-1 rounded transition-colors ${
                                (() => {
                                  const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                                  const isCompleted = effectiveStatus === 'Completed';
                                  return isCompleted 
                                    ? 'text-gray-300 cursor-not-allowed' 
                                    : 'text-gray-400 hover:text-green-600';
                                })()
                              }`}
                              title={(() => {
                                const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                                const isCompleted = effectiveStatus === 'Completed';
                                return isCompleted ? 'Cannot edit completed ticket' : 'Edit';
                              })()}
                              disabled={(() => {
                                const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                                return effectiveStatus === 'Completed';
                              })()}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteTicket(ticket)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                              title="Delete"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
            <div className="text-gray-600">Showing <span className="font-medium">{paginated.length}</span> of <span className="font-medium">{filteredTickets.length}</span></div>
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
    </div>
  );
};

export default Tickets;