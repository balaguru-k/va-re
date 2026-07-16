import React, { useState, useEffect } from 'react';
import { EyeIcon, TrashIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon, CloudArrowUpIcon, PlusIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import Modal from '../components/UI/Modal';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import showToast from '../utils/toast';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/UI/MultiSelectDropdown';
import { sortTickets } from '../utils/ticketSort';


const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const ComplianceDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isViewer = user?.role === 'Viewer';
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [textSearch, setTextSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTicketForEdit, setSelectedTicketForEdit] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [remarksText, setRemarksText] = useState('');
  const [offlineValue, setOfflineValue] = useState('');
  const [deviceValue, setDeviceValue] = useState('');
  const [vendors, setVendors] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [raiseForm, setRaiseForm] = useState({
    subject: '',
    user_assign_date: '',
    assigned_vendors: '',
    assigned_engineers: '',
    interested_party: [],
    remarks: '',
    attachments: []
  });
  const [raiseErrors, setRaiseErrors] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraList, setCameraList] = useState([]);
  const [cameraFilterLocation, setCameraFilterLocation] = useState('');
  const [cameraForm, setCameraForm] = useState({ location: '', category: '', nvr: '', camera_no_from: '', camera_no_to: '' });
  const [checklists, setChecklists] = useState([]);
  const [draggedFiles, setDraggedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [locationCameras, setLocationCameras] = useState([]);
  const [nvrOptions, setNvrOptions] = useState([]);

  const [formData, setFormData] = useState({
    checklist_id: '',
    location: '',
    department: '',
    division: '',
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
    fetchMasters();
  }, []);



  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showImageModal) return;
      if (e.key === 'Escape') setShowImageModal(false);
      else if (e.key === 'ArrowLeft') setCurrentImageIndex(p => p > 0 ? p - 1 : selectedImages.length - 1);
      else if (e.key === 'ArrowRight') setCurrentImageIndex(p => p < selectedImages.length - 1 ? p + 1 : 0);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showImageModal, selectedImages]);

  useEffect(() => {
    const handleEditModalKeyDown = (e) => {
      if (e.key === 'Escape' && isEditModalOpen) {
        setIsEditModalOpen(false);
        setSelectedTicketForEdit(null);
        setActiveAction(null);
        setRemarksText('');
        setOfflineValue('');
        setDeviceValue('');
        setRaiseForm({ subject: '', user_assign_date: '', assigned_vendors: '', assigned_engineers: '', interested_party: [], remarks: '', attachments: [] });
        setRaiseErrors({});
      }
    };
    document.addEventListener('keydown', handleEditModalKeyDown);
    return () => document.removeEventListener('keydown', handleEditModalKeyDown);
  }, [isEditModalOpen]);

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

  const fetchTickets = () => {
    setLoading(true);
    api.get('/compliance/dashboard')
      .then(res => setTickets(res.data.data?.tickets || []))
      .catch(() => toast.error('Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  const fetchMasters = async () => {
    try {
      const [locationsRes, departmentsRes, divisionsRes] = await Promise.all([
        api.get('/compliance/masters/locations-list'),
        api.get('/compliance/masters/departments-list'),
        api.get('/compliance/masters/categories')
      ]);
      setLocations(locationsRes.data.data?.locations || []);
      setDepartments(departmentsRes.data.data?.departments || []);
      setDivisions(divisionsRes.data.data?.divisions || []);
    } catch (error) {
      console.error('Error fetching masters:', error);
    }
  };

  const fetchUserChecklists = async () => {
    try {
      const response = await api.get('/compliance/masters/checklists');
      const data = response.data.data?.checklists || [];
      setChecklists(data.map(c => ({ checklist_id: c.id, checklist_name: c.checklist_name, camera_count: c.camera_count, location_name: c.location_name, department_name: c.department_name, category_name: c.category_name })));
    } catch (error) {
      console.error('Error fetching checklists:', error);
    }
  };

  const fetchLocationCameras = async (location) => {
    if (!location) { setLocationCameras([]); setNvrOptions([]); return; }
    try {
      const res = await api.get(`/tickets/location-cameras?location=${encodeURIComponent(location)}`);
      setNvrOptions(res.data.data?.nvrs || []);
      setLocationCameras(res.data.data?.cameras || []);
    } catch { setLocationCameras([]); setNvrOptions([]); }
  };

  const resetForm = () => {
    setFormData({
      checklist_id: '',
      location: '',
      department: '',
      division: '',
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
  };

  const fetchCameraList = async (loc) => {
    try {
      const params = loc ? `?location=${encodeURIComponent(loc)}` : '';
      const res = await api.get(`/tickets/location-cameras/list${params}`);
      setCameraList(res.data.data?.cameras || []);
    } catch { setCameraList([]); }
  };

  const handleAddCameras = async () => {
    const { location, category, nvr, camera_no_from, camera_no_to } = cameraForm;
    if (!location || !nvr || !camera_no_from) return toast.error('Location, NVR and Camera No are required');
    const from = parseInt(camera_no_from);
    const to = parseInt(camera_no_to) || from;
    const cameras = [];
    for (let i = from; i <= to; i++) cameras.push({ location, category, nvr, camera_no: i });
    try {
      await api.post('/tickets/location-cameras', { cameras });
      toast.success(`${cameras.length} camera(s) added`);
      setCameraForm({ location: '', category: '', nvr: '', camera_no_from: '', camera_no_to: '' });
      fetchCameraList(cameraFilterLocation);
    } catch { toast.error('Failed to add cameras'); }
  };

  const handleDeleteCamera = async (id) => {
    try {
      await api.delete(`/tickets/location-cameras/${id}`);
      setCameraList(prev => prev.filter(c => c.id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    
    if (name === 'checklist_id') {
      if (value && value.startsWith('all-location-')) {
        const locationName = value.replace('all-location-', '');
        const locationChecklists = checklists.filter(c => c.location_name === locationName);
        const division = locationChecklists[0]?.category_name || '';
        const allDepts = [...new Set(locationChecklists.map(c => c.department_name).filter(Boolean))].join(', ');
        const totalCameraCount = locationChecklists.reduce((sum, c) => sum + (parseInt(c.camera_count) || 0), 0);
        setFormData(prev => ({
          ...prev,
          checklist_id: value,
          location: locationName,
          department: allDepts,
          division,
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
          division: selectedChecklist?.category_name || '',
          checklist_camera_count: selectedChecklist?.camera_count || '',
          nvr: [],
          camera_no: []
        }));
        fetchLocationCameras(selectedChecklist?.location_name || '');
      }
    } else if (name === 'nvr') {
      const kept = formData.camera_no.filter(key => value.includes(key.split('||')[1]));
      setFormData(prev => ({ ...prev, nvr: value, camera_no: kept, camera_count: kept.length.toString() || prev.camera_count }));
    } else if (name === 'camera_no') {
      const newlySelected = value.filter(v => !formData.camera_no.includes(v));
      if (newlySelected.length > 0 && formData.location && formData.issue) {
        try {
          const resp = await api.get('/tickets/check-conflicts', {
            params: { location: formData.location, camera_nos: newlySelected.join(','), issue: formData.issue }
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
            params: { location: formData.location, camera_nos: formData.camera_no.join(','), issue: value }
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

  const checkCameraConflicts = async (location, cameraNos, issue, excludeId) => {
    if (!location || !cameraNos?.length || !issue) return null;
    try {
      const resp = await api.get('/tickets/check-conflicts', {
        params: { location, camera_nos: cameraNos.join(','), issue, exclude_ticket_id: excludeId }
      });
      return resp.data.data?.cameraConflicts || [];
    } catch { return null; }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.issue || (!formData.camera_count && formData.camera_no.length === 0)) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    if (formData.camera_no?.length > 0 && formData.location && formData.issue) {
      const conflicts = await checkCameraConflicts(formData.location, formData.camera_no, formData.issue);
      if (conflicts?.length > 0) {
        const labels = conflicts.map(c => {
          const itemLabels = c.items.map(v => { const [cam, nvr] = v.split('||'); return nvr ? `${nvr} : ${cam}` : cam; });
          return `${c.ticket} (${itemLabels.join(', ')})`;
        });
        showToast('error', `Cannot create ticket. Camera(s) already in active ticket(s) with same issue: ${labels.join(' | ')}`);
        return;
      }
    }

    try {
      const submitData = new FormData();
      // Send checklist_id as empty string if not selected or if it's a virtual all-location selection
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
      submitData.append('division', formData.division);
      
      formData.attachments.forEach((file) => {
        submitData.append('attachments', file);
      });

      const response = await api.post('/tickets', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      showToast('success', 'Ticket created successfully!');

      if (response.data.data) {
        resetForm();
        setShowCreateForm(false);
        fetchTickets();
      }
      
    } catch (error) {
      console.error('Error creating ticket:', error);
      showToast('error', error.response?.data?.error || 'Error creating ticket. Please try again.');
    }
  };

  const parseAttachments = (raw) => {
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return []; }
  };

  const openImages = (attachments, index) => {
    setSelectedImages(attachments.map(a => `${BACKEND_URL}/uploads/tickets/${a}`));
    setCurrentImageIndex(index);
    setShowImageModal(true);
  };

  const handleView = (ticket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  const handleEdit = (ticket) => {
    setSelectedTicketForEdit(ticket);
    setIsEditModalOpen(true);
    setActiveAction(null);
    setRemarksText('');
    setRaiseForm({ subject: '', user_assign_date: '', assigned_vendors: '', assigned_engineers: '', interested_party: [], remarks: '', attachments: [] });
    setRaiseErrors({});
  };

  useEffect(() => {
    if (activeAction === 'Raise' && isEditModalOpen && selectedTicketForEdit) {
      api.get('/tickets/raise/users')
        .then(res => {
          setVendors(res.data.data?.vendors || []);
          setEngineers(res.data.data?.engineers || []);
          setAllUsers(res.data.data?.allUsers || []);
        })
        .catch(() => toast.error('Failed to load vendors/engineers'));
      
      // Auto-populate date with ticket created date
      const ticketDate = new Date(selectedTicketForEdit.created_at).toISOString().split('T')[0];
      setRaiseForm(p => ({ ...p, user_assign_date: ticketDate }));
    }
  }, [activeAction, isEditModalOpen, selectedTicketForEdit]);

  const toggleAction = (key) => {
    setActiveAction(prev => prev === key ? null : key);
    setRemarksText('');
    setOfflineValue('');
    setDeviceValue('');
    setRaiseForm({ subject: '', user_assign_date: '', assigned_vendors: '', assigned_engineers: '', interested_party: [], remarks: '', attachments: [] });
    setRaiseErrors({});
  };

  const handleStatusSubmit = async () => {
    if (activeAction !== 'Offline' && activeAction !== 'Device' && !remarksText.trim()) { toast.error('Remarks are required'); return; }
    setSubmitting(true);
    try {
      const payload = { status_remarks: remarksText };
      if (activeAction === 'Offline') {
        payload.offline = offlineValue;
      } else if (activeAction === 'Device') {
        payload.device = deviceValue;
      } else {
        payload.status = activeAction;
      }
      await api.patch(`/tickets/${selectedTicketForEdit.id}/status`, payload);
      toast.success(activeAction === 'Offline' ? `Offline set to ${offlineValue}` : activeAction === 'Device' ? `Device set to ${deviceValue}` : `Ticket marked as ${activeAction}`);
      setActiveAction(null);
      setRemarksText('');
      setOfflineValue('');
      setDeviceValue('');
      // Refresh ticket data but keep modal open so user can set Offline/Device too
      const res = await api.get('/compliance/dashboard');
      const updatedTickets = res.data.data?.tickets || [];
      setTickets(updatedTickets);
      const updated = updatedTickets.find(t => t.id === selectedTicketForEdit.id);
      if (updated) setSelectedTicketForEdit(updated);
    } catch {
      toast.error('Failed to update status');
    } finally { setSubmitting(false); }
  };

  const handleRaiseFiles = (files) => {
    const validFiles = Array.from(files);
    setRaiseForm(p => ({ ...p, attachments: [...p.attachments, ...validFiles] }));
  };

  const removeRaiseFile = (index) => {
    setRaiseForm(p => ({ ...p, attachments: p.attachments.filter((_, i) => i !== index) }));
  };

  const toggleMultiSelect = (field, value) => {
    setRaiseForm(p => ({
      ...p,
      [field]: p[field].includes(value) ? p[field].filter(v => v !== value) : [...p[field], value]
    }));
  };

  const validateRaiseForm = () => {
    const errors = {};
    if (!raiseForm.subject.trim()) errors.subject = 'Subject is required';
    
    const hasVendor = !!raiseForm.assigned_vendors;
    const hasEngineer = !!raiseForm.assigned_engineers;
    
    if (!hasVendor && !hasEngineer) {
      errors.assigned_vendors = 'Select vendor or engineer';
      errors.assigned_engineers = 'Select vendor or engineer';
    } else if (hasVendor && hasEngineer) {
      errors.assigned_vendors = 'Select only one';
      errors.assigned_engineers = 'Select only one';
    }
    

    setRaiseErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRaiseSave = async (isDraft) => {
    if (!isDraft && !validateRaiseForm()) return;
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('subject', raiseForm.subject);
      data.append('user_assign_date', raiseForm.user_assign_date);
      data.append('assigned_vendors', raiseForm.assigned_vendors || '');
      data.append('assigned_engineers', raiseForm.assigned_engineers || '');
      data.append('interested_party', JSON.stringify(raiseForm.interested_party));
      data.append('status_remarks', raiseForm.remarks);
      data.append('is_draft', isDraft ? 'true' : 'false');
      raiseForm.attachments.forEach(f => data.append('raise_attachments', f));

      await api.patch(`/tickets/${selectedTicketForEdit.id}/raise`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(isDraft ? 'Draft saved' : 'Ticket raised successfully');
      setIsEditModalOpen(false);
      fetchTickets();
    } catch {
      toast.error('Failed to save raise ticket');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (ticket) => {
    const result = await Swal.fire({
      title: 'Delete Ticket',
      text: `Are you sure you want to delete this ticket? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      width: '400px',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/tickets/${ticket.id}`);
      toast.success('Ticket deleted successfully');
      fetchTickets();
    } catch {
      toast.error('Failed to delete ticket');
    }
  };

  const filtered = tickets.filter(t => {
    if (textSearch) {
      const q = textSearch.toLowerCase();
      const matchSearch =
        (t.ticket_number || '').toLowerCase().includes(q) ||
        (t.user_name || '').toLowerCase().includes(q) ||
        (t.issue || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q) ||
        (t.department || '').toLowerCase().includes(q) ||
        (t.engineer_name || '').toLowerCase().includes(q);
      if (!matchSearch) return false;
    }
    if (fromDate || toDate) {
      const ticketDate = new Date(t.created_at).toISOString().split('T')[0];
      if (fromDate && ticketDate < fromDate) return false;
      if (toDate && ticketDate > toDate) return false;
    }
    return true;
  });

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = sortTickets(filtered, sortKey, sortDir);

  const paginated = itemsPerPage === 'all' ? sorted : sorted.slice(0, itemsPerPage);

  const SortIcon = ({ col }) => (
    <span className={`ml-1 text-base ${sortKey === col ? 'text-red-500' : 'text-gray-400'}`}>
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3 overflow-y-auto scroll-container">

      {/* Image Modal */}
      {showImageModal && selectedImages.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[200]" onClick={() => setShowImageModal(false)}>
          <div className="relative w-full h-full flex items-center justify-center">
            <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
              <XMarkIcon className="w-6 h-6" />
            </button>
            <a href={selectedImages[currentImageIndex]} download onClick={e => e.stopPropagation()}
              className="absolute top-4 right-16 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
              <ArrowDownTrayIcon className="w-6 h-6" />
            </a>
            {selectedImages.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); setCurrentImageIndex(p => p > 0 ? p - 1 : selectedImages.length - 1); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button onClick={e => { e.stopPropagation(); setCurrentImageIndex(p => p < selectedImages.length - 1 ? p + 1 : 0); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}
            <img src={selectedImages[currentImageIndex]} alt="Preview" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
            {selectedImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">
                {currentImageIndex + 1} / {selectedImages.length}
              </div>
            )}
          </div>
        </div>
      )}

      <PageHeader title="Tickets Dashboard">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search tickets..."
            value={textSearch}
            onChange={e => setTextSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={e => setFromDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={e => setToDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-2 py-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-300 rounded-lg">Clear</button>
          )}
          <button
            onClick={() => {
              const headers = ['Ticket Number','Created By','Division','Location','Department','Engineer','Issue','Admin Aging','Vendor Aging','Engineer Aging','Interested Party','Status','Completed By','Completed On','Created On'];
              const rows = filtered.map(t => { const s = t.vendor_status||t.engineer_status||t.status; const by = t.vendor_status==='Completed'?(t.vendor_name?t.vendor_name+'(vendor)':'Vendor'):t.engineer_status==='Completed'?(t.engineer_name?t.engineer_name+'(engineer)':'Engineer'):t.status==='Completed'?'Admin':'-'; const on = t.vendor_status==='Completed'&&t.vendor_completed_at?formatDate(t.vendor_completed_at):t.engineer_status==='Completed'&&t.engineer_completed_at?formatDate(t.engineer_completed_at):t.status==='Completed'&&t.admin_completed_at?formatDate(t.admin_completed_at):'-'; return [t.ticket_number||('#'+t.id),t.user_name,t.category||t.division||'-',t.location||'-',t.department||'-',t.engineer_name||'-',t.issue,t.admin_aging!=null?t.admin_aging+' days':'-',t.vendor_aging!=null?t.vendor_aging+' days':'-',t.engineer_aging!=null?t.engineer_aging+' days':'-',t.interested_party_names||'-',s||'-',by,on,formatDate(t.created_at)]; });
              const csv = [headers,...rows].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
              const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='tickets_'+new Date().toISOString().split('T')[0]+'.csv'; a.click(); URL.revokeObjectURL(url);
            }}
            className="px-3 py-2 text-xs font-medium text-white rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
            style={{ background: '#16a34a' }}
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span>Export</span>
          </button>
          {!isViewer && (
            <button
              onClick={() => { setShowCameraModal(true); fetchCameraList(''); }}
              className="px-3 py-2 text-xs font-medium text-white rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
              style={{ background: '#6366f1' }}
            >
              <PlusIcon className="w-4 h-4" />
              <span>Manage Cameras</span>
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

      {/* Stats Cards - Only show when create form is closed */}
      {!showCreateForm && (
      <div className="grid grid-cols-5 gap-3">
        {/* Total Tickets */}
        <div className="bg-gray-50 border border-gray-400 rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-1">
          <div className="text-[50px] font-bold text-gray-700">{filtered.length}</div>
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide text-center leading-tight">Total Tickets</div>
        </div>

        {/* New */}
        <div 
          className="bg-purple-50 border border-purple-400 rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-purple-100 transition-colors"
          onClick={() => navigate('/compliance/new-tickets')}
        >
          <div className="text-[50px] font-bold text-purple-600">
            {filtered.filter(t => {
              // If vendor or engineer has updated status, use their status
              const effectiveStatus = t.vendor_status || t.engineer_status || t.status;
              return effectiveStatus === 'New' || (!effectiveStatus && !t.vendor_status && !t.engineer_status);
            }).length}
          </div>
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide text-center leading-tight">New</div>
        </div>

        {/* Pending */}
        <div 
          className="bg-yellow-50 border border-yellow-400 rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-yellow-100 transition-colors"
          onClick={() => navigate('/compliance/pending-tickets')}
        >
          <div className="text-[50px] font-bold text-yellow-600">
            {filtered.filter(t => {
              // If vendor or engineer has updated status, use their status
              const effectiveStatus = t.vendor_status || t.engineer_status || t.status;
              return effectiveStatus === 'Pending' || effectiveStatus === 'Raised';
            }).length}
          </div>
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide text-center leading-tight">Pending</div>
        </div>

        {/* In Progress */}
        <div 
          className="bg-blue-50 border border-blue-400 rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => navigate('/compliance/in-progress-tickets')}
        >
          <div className="text-[50px] font-bold text-blue-600">
            {filtered.filter(t => {
              // If vendor or engineer has updated status, use their status
              const effectiveStatus = t.vendor_status || t.engineer_status || t.status;
              return effectiveStatus === 'In Progress';
            }).length}
          </div>
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide text-center leading-tight">In Progress</div>
        </div>

        {/* Completed */}
        <div 
          className="bg-green-50 border border-green-400 rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-green-100 transition-colors"
          onClick={() => navigate('/compliance/completed-tickets')}
        >
          <div className="text-[50px] font-bold text-green-600">
            {filtered.filter(t => {
              // If vendor or engineer has updated status, use their status
              const effectiveStatus = t.vendor_status || t.engineer_status || t.status;
              return effectiveStatus === 'Completed' || effectiveStatus === 'Duplicate' || effectiveStatus === 'Ticket by mistake';
            }).length}
          </div>
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide text-center leading-tight">Completed</div>
        </div>
      </div>
      )}

      {/* Create Ticket Accordion */}
      {showCreateForm && (
        <div style={{ marginTop: '40px' }}>
        <div className="max-w-5xl mx-auto mt-5 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Create New Ticket</h2>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Checklist</label>
                  <SearchableSelect
                    options={(() => {
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
                    })()}
                    value={formData.checklist_id}
                    onChange={val => handleInputChange({ target: { name: 'checklist_id', value: val } })}
                    placeholder="Select Checklist (Optional)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Division</label>
                  <SearchableSelect
                    options={divisions.map(d => ({ value: d.name, label: d.name }))}
                    value={formData.division}
                    onChange={val => setFormData(prev => ({ ...prev, division: val }))}
                    placeholder="Select Division"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <SearchableSelect
                    options={locations.map(l => ({ value: l.name, label: l.name }))}
                    value={formData.location}
                    onChange={val => setFormData(prev => ({ ...prev, location: val }))}
                    placeholder="Select Location"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                  {formData.checklist_id && formData.checklist_id.startsWith('all-location-') ? (
                    <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-600 min-h-[38px]">
                      {formData.department ? formData.department.split(', ').map((d, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 mr-1 mb-1 bg-red-100 text-red-700 text-xs rounded-full">{d}</span>
                      )) : '-'}
                    </div>
                  ) : (
                    <SearchableSelect
                      options={departments.map(d => ({ value: d.name, label: d.name }))}
                      value={formData.department}
                      onChange={val => setFormData(prev => ({ ...prev, department: val }))}
                      placeholder="Select Department"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Checklist Camera Count</label>
                  <input
                    type="number"
                    name="checklist_camera_count"
                    value={formData.checklist_camera_count}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Enter checklist camera count"
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Camera Count <span className="text-red-500">*</span></label>
                  {nvrOptions.length > 0 ? (
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400"
                      placeholder="Enter camera count"
                      required
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
                  Create Ticket
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
          <table style={{ minWidth: '1960px' }} className="w-full">
            <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
              <tr>
                {[['ticket_number','Ticket Number'],['user_name','Created By'],['division','Division'],['location','Location'],['department','Department'],['nvr','NVR'],['camera no','Camera NO'],['engineer_name','Engineer'],['issue','Issue'],['admin_aging','Admin Aging'],['vendor_aging','Vendor Aging'],['engineer_aging','Engineer Aging'],['interested_party_names','Interested Party'],['status','Status']].map(([key, label]) => (
                  <th key={key} style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort(key)}>
                    {label}<SortIcon col={key} />
                  </th>
                ))}
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10">Completed By</th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('completed_at')}>Completed On<SortIcon col="completed_at" /></th>
                
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('created_at')}>Created On<SortIcon col="created_at" /></th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('raised_at')}>Raised On<SortIcon col="raised_at" /></th>

                <th style={{ backgroundColor: '#ededed', width: '140px', minWidth: '140px' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 right-0 z-30">Actions</th>

              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="14" className="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan="14" className="px-4 py-6 text-center text-gray-500">No tickets found</td></tr>
              ) : (
                paginated.map((ticket, index) => {
                  const attachments = parseAttachments(ticket.attachments);
                  return (
                    <tr key={ticket.id} className={`cursor-pointer hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`} onClick={() => handleView(ticket)}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.ticket_number || `#${ticket.id}`}</td>
                      {/* <td className="px-4 py-3 text-sm text-gray-900">{ticket.checklist_name || '-'}</td> */}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.user_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{ticket.category || ticket.division || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{ticket.location || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {ticket.department ? (() => {
                          const depts = ticket.department.split(', ');
                          if (depts.length <= 2) return ticket.department;
                          return <span className="cursor-pointer" title={ticket.department}>{depts.slice(0, 2).join(', ')}...</span>;
                        })() : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {(() => {
                          try {
                            const arr = JSON.parse(ticket.nvr);
                            if (!Array.isArray(arr) || arr.length === 0) return ticket.nvr || '-';
                            if (arr.length <= 2) return arr.join(', ');
                            return <span className="cursor-default" title={arr.join(', ')}>{arr.slice(0, 2).join(', ')}...</span>;
                          } catch { return ticket.nvr || '-'; }
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {(() => {
                          try {
                            const arr = JSON.parse(ticket.camera_no);
                            if (!Array.isArray(arr) || arr.length === 0) return ticket.camera_no || '-';
                            const labels = arr.map(k => { const [cam, nvr] = k.split('||'); return nvr ? `${nvr} : ${cam}` : cam; });
                            if (labels.length <= 2) return labels.join(', ');
                            const full = labels.join(', ');
                            return (
                                <span
                                className="cursor-default"
                                title={full}
                              >
                                {labels.slice(0, 2).join(', ')}...
                              </span>
                            );
                          } catch { return ticket.camera_no || '-'; }
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{ticket.engineer_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{ticket.issue}</td>
                      {/* <td className="px-4 py-3 text-sm text-gray-600">{ticket.vendor_name || '-'}</td> */}
                      {/* <td className="px-4 py-3">
                        {ticket.vendor_status ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            ticket.vendor_status === 'Completed' ? 'bg-green-100 text-green-700' :
                            ticket.vendor_status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{ticket.vendor_status}</span>
                        ) : <span className="text-gray-400">-</span>}
                      </td> */}
                      {/* <td className="px-4 py-3 text-sm text-gray-600">{ticket.engineer_name || '-'}</td> */}
                      {/* <td className="px-4 py-3">
                        {ticket.engineer_status ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            ticket.engineer_status === 'Completed' ? 'bg-green-100 text-green-700' :
                            ticket.engineer_status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{ticket.engineer_status}</span>
                        ) : <span className="text-gray-400">-</span>}
                      </td> */}
                      {/* <td className="px-4 py-3 text-sm text-gray-600">{ticket.interested_party_names || '-'}</td> */}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate">{ticket.admin_aging !== null ? `${ticket.admin_aging} days` : '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate">{ticket.vendor_aging !== null ? `${ticket.vendor_aging} days` : '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate">{ticket.engineer_aging !== null ? `${ticket.engineer_aging} days` : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ticket.interested_party_names || '-'}</td>
                      {/* <td className="px-4 py-3 text-sm text-gray-600">{ticket.remarks || '-'}</td> */}
                      {/* <td className="px-4 py-3">
                        {attachments.length > 0 ? (
                          <div className="flex gap-1 items-center flex-wrap">
                            {attachments.slice(0, 3).map((att, idx) => {
                              const fileExt = att.split('.').pop().toLowerCase();
                              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                              return isImage ? (
                                <img key={idx} src={`${BACKEND_URL}/uploads/tickets/${att}`} alt={`att-${idx}`}
                                  className="w-9 h-9 object-cover rounded border cursor-pointer hover:opacity-80"
                                  onClick={() => {
                                    const imageAttachments = attachments.filter(a => {
                                      const ext = a.split('.').pop().toLowerCase();
                                      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                    });
                                    openImages(imageAttachments, imageAttachments.indexOf(att));
                                  }} />
                              ) : (
                                <a key={idx} href={`${BACKEND_URL}/uploads/tickets/${att}`} download
                                  className="flex items-center gap-1 px-2 py-1 border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100"
                                  title={att}>
                                  <span className="font-medium">{fileExt.toUpperCase()}</span>
                                  <span className="max-w-[60px] truncate">{att.split('-').slice(2).join('-')}</span>
                                </a>
                              );
                            })}
                            {attachments.length > 3 && (
                              <div className="w-9 h-9 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                onClick={() => {
                                  const imageAttachments = attachments.filter(a => {
                                    const ext = a.split('.').pop().toLowerCase();
                                    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                  });
                                  openImages(imageAttachments, 0);
                                }}>
                                +{attachments.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No files</span>
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
                      {/* <td className="px-4 py-3 text-sm text-gray-600">{ticket.status_remarks || '-'}</td> */}
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
                      <td className="px-4 py-3 text-sm text-gray-600 truncate">
                        {(() => {
                          if (ticket.vendor_status === 'Completed' && ticket.vendor_completed_at) {
                            return formatDate(ticket.vendor_completed_at);
                          } else if (ticket.engineer_status === 'Completed' && ticket.engineer_completed_at) {
                            return formatDate(ticket.engineer_completed_at);
                          } else if (ticket.status === 'Completed' && ticket.admin_completed_at) {
                            return formatDate(ticket.admin_completed_at);
                          }
                          return '-';
                        })()
                      }</td>
                      <td className="px-4 py-3 text-sm text-gray-600 truncate">{formatDateTime(ticket.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 truncate">{ticket.raised_at ? formatDateTime(ticket.raised_at) : '-'}</td>
                      <td className="px-4 py-3 sticky right-0 z-10" style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleView(ticket)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="View">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          {(() => {
                            const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                            const isTerminal = effectiveStatus === 'Completed';
                            const needsOfflineOrDevice = !ticket.offline || !ticket.device;
                            const canEdit = !isTerminal || needsOfflineOrDevice;
                            return (
                              <>
                              {!isViewer && <button 
                                onClick={() => canEdit && handleEdit(ticket)} 
                                className={`p-1 rounded transition-colors ${
                                  canEdit 
                                    ? 'text-gray-400 hover:text-red-600' 
                                    : 'text-gray-300 cursor-not-allowed'
                                }`} 
                                title={canEdit ? 'Edit' : 'Cannot edit completed ticket'}
                                disabled={!canEdit}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>}
                              </>
                            );
                          })()}
                          {/* <button onClick={() => handleDelete(ticket)} className="p-1 text-gray-600 hover:text-red-600 rounded transition-colors" title="Delete">
                            <TrashIcon className="w-4 h-4" />
                          </button> */}
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
          <div className="text-gray-600">Showing <span className="font-medium">{paginated.length}</span> of <span className="font-medium">{filtered.length}</span></div>
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
      {isEditModalOpen && selectedTicketForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Ticket Status</h2>
              <button onClick={() => {
                setIsEditModalOpen(false);
                setSelectedTicketForEdit(null);
                setActiveAction(null);
                setRemarksText('');
                setOfflineValue('');
                setDeviceValue('');
                setRaiseForm({ subject: '', user_assign_date: '', assigned_vendors: '', assigned_engineers: '', interested_party: [], remarks: '', attachments: [] });
                setRaiseErrors({});
                fetchTickets();
              }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-4">
              {(() => {
                const effectiveStatus = selectedTicketForEdit.vendor_status || selectedTicketForEdit.engineer_status || selectedTicketForEdit.status;
                const isCompleted = effectiveStatus === 'Completed';
                const missingOfflineDevice = !selectedTicketForEdit.offline || !selectedTicketForEdit.device;
                return isCompleted && missingOfflineDevice ? (
                  <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
                    This ticket is completed but <span className="font-semibold">Offline</span> and/or <span className="font-semibold">Device</span> is not set. Please update them using the buttons below.
                  </div>
                ) : null;
              })()}
              <div className="bg-white border border-red-100 rounded-lg">
                <div className="px-4 py-3 border-b border-gray-200" style={{ backgroundColor: '#ededed' }}>
                  <span className="text-sm font-medium text-gray-700">Status</span>
                </div>
                <div className="p-4 flex gap-3 flex-wrap">
                  <div className="relative">
                    <button onClick={() => toggleAction(activeAction === 'Pending' || activeAction === 'Completed' || activeAction === 'In progress' || activeAction === 'Duplicate' || activeAction === 'Ticket by mistake' ? null : 'Pending')}
                      className={`px-4 py-2 text-sm font-medium border-2 rounded-lg transition-colors flex items-center gap-2 ${(activeAction === 'Pending' || activeAction === 'Completed' || activeAction === 'In progress' || activeAction === 'Duplicate' || activeAction === 'Ticket by mistake') ? 'border-yellow-500 bg-yellow-500 text-white' : 'border-yellow-400 bg-white text-yellow-600 hover:bg-yellow-50'}`}>
                      {activeAction === 'Completed' ? 'Completed' : activeAction === 'In progress' ? 'In progress' : activeAction === 'Duplicate' ? 'Duplicate' : activeAction === 'Ticket by mistake' ? 'Ticket by mistake' : 'Pending'}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {(activeAction === 'Pending' || activeAction === 'Completed' || activeAction === 'In progress' || activeAction === 'Duplicate' || activeAction === 'Ticket by mistake') && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <button onClick={() => setActiveAction('Pending')}
                          className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${activeAction === 'Pending' ? 'bg-yellow-50 text-yellow-700' : 'text-gray-700'}`}>
                          Pending
                        </button>
                        <button onClick={() => setActiveAction('Completed')}
                          className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${activeAction === 'Completed' ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}>
                          Completed
                        </button>
                        <button onClick={() => setActiveAction('In progress')}
                          className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${activeAction === 'In progress' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}>
                          In progress
                        </button>
                        <button onClick={() => setActiveAction('Duplicate')}
                          className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${activeAction === 'Duplicate' ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}>
                          Duplicate
                        </button>
                        <button onClick={() => setActiveAction('Ticket by mistake')}
                          className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 whitespace-nowrap ${activeAction === 'Ticket by mistake' ? 'bg-red-50 text-red-700' : 'text-gray-700'}`}>
                          Ticket by mistake
                        </button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => toggleAction('Raise')}
                    className={`px-4 py-2 text-sm font-medium border-2 rounded-lg transition-colors ${activeAction === 'Raise' ? 'border-blue-500 bg-blue-500 text-white' : 'border-blue-400 bg-white text-blue-600 hover:bg-blue-50'}`}>
                    Raise Ticket
                  </button>
                  {/* Offline button */}
                  <button onClick={() => toggleAction('Offline')}
                    className={`px-4 py-2 text-sm font-medium border-2 rounded-lg transition-colors ${activeAction === 'Offline' ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-400 bg-white text-orange-600 hover:bg-orange-50'}`}>
                    Offline
                  </button>
                  {/* Device button */}
                  <button onClick={() => toggleAction('Device')}
                    className={`px-4 py-2 text-sm font-medium border-2 rounded-lg transition-colors ${activeAction === 'Device' ? 'border-teal-500 bg-teal-500 text-white' : 'border-teal-400 bg-white text-teal-600 hover:bg-teal-50'}`}>
                    Device
                  </button>
                </div>
                {activeAction && activeAction !== 'Raise' && activeAction !== 'Offline' && activeAction !== 'Device' && (
                  <div className="px-4 pb-4">
                    <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm mt-2">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-800">{activeAction}</span>
                      </div>
                      <div className="px-5 py-4 space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Remarks <span className="text-red-500">*</span></label>
                          <textarea value={remarksText} onChange={e => setRemarksText(e.target.value)} rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Enter remarks for marking as ${activeAction}...`} />
                        </div>
                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                          <button onClick={() => setActiveAction(null)}
                            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                          <button onClick={handleStatusSubmit} disabled={submitting}
                            className={`px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                              activeAction === 'Completed' ? 'bg-green-600 hover:bg-green-700' :
                              activeAction === 'In progress' ? 'bg-blue-600 hover:bg-blue-700' :
                              activeAction === 'Duplicate' ? 'bg-purple-600 hover:bg-purple-700' :
                              activeAction === 'Ticket by mistake' ? 'bg-red-600 hover:bg-red-700' :
                              'bg-yellow-500 hover:bg-yellow-600'
                            }`}>
                            {submitting ? 'Saving...' : `Confirm ${activeAction}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Offline sub-form */}
                {activeAction === 'Offline' && (
                  <div className="px-4 pb-4">
                    <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm mt-2">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-800">Offline</span>
                      </div>
                      <div className="px-5 py-4 space-y-4">
                        <div className="flex gap-2">
                          {['Internet', 'Power'].map(opt => (
                            <button key={opt} type="button" onClick={() => setOfflineValue(opt)}
                              className={`px-4 py-2 text-sm font-medium border-2 rounded-lg transition-colors ${offlineValue === opt ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-300 bg-white text-orange-600 hover:bg-orange-50'}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                          <button onClick={() => { setActiveAction(null); setOfflineValue(''); }}
                            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                          <button onClick={handleStatusSubmit} disabled={submitting || !offlineValue}
                            className="px-6 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50">
                            {submitting ? 'Saving...' : 'Confirm Offline'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Device sub-form */}
                {activeAction === 'Device' && (
                  <div className="px-4 pb-4">
                    <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm mt-2">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-800">Device</span>
                      </div>
                      <div className="px-5 py-4 space-y-4">
                        <div className="flex gap-2">
                          {['Hardware', 'Software'].map(opt => (
                            <button key={opt} type="button" onClick={() => setDeviceValue(opt)}
                              className={`px-4 py-2 text-sm font-medium border-2 rounded-lg transition-colors ${deviceValue === opt ? 'border-teal-500 bg-teal-500 text-white' : 'border-teal-300 bg-white text-teal-600 hover:bg-teal-50'}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                          <button onClick={() => { setActiveAction(null); setDeviceValue(''); }}
                            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                          <button onClick={handleStatusSubmit} disabled={submitting || !deviceValue}
                            className="px-6 py-2 text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 rounded-lg disabled:opacity-50">
                            {submitting ? 'Saving...' : 'Confirm Device'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeAction === 'Raise' && (
                  <div className="px-4 pb-4">
                    <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm mt-2">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-800">Raise Ticket</span>
                      </div>
                      <div className="px-5 py-4 space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Ticket ID</label>
                            <input type="text" value={selectedTicketForEdit.ticket_number || `#${selectedTicketForEdit.id}`} readOnly
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                            <input type="date" value={raiseForm.user_assign_date} onChange={e => setRaiseForm(p => ({ ...p, user_assign_date: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Subject <span className="text-red-500">*</span></label>
                            <input type="text" value={raiseForm.subject} onChange={e => { setRaiseForm(p => ({ ...p, subject: e.target.value })); setRaiseErrors(p => ({ ...p, subject: '' })); }}
                              placeholder="Enter subject"
                              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${raiseErrors.subject ? 'border-red-500' : 'border-gray-300'}`} />
                            {raiseErrors.subject && <p className="text-red-500 text-xs mt-1">{raiseErrors.subject}</p>}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Choose Vendor <span className="text-red-500">*</span></label>
                            <select value={raiseForm.assigned_vendors} onChange={e => { setRaiseForm(p => ({ ...p, assigned_vendors: e.target.value })); setRaiseErrors(p => ({ ...p, assigned_vendors: '', assigned_engineers: '' })); }}
                              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${raiseErrors.assigned_vendors ? 'border-red-500' : 'border-gray-300'}`}>
                              <option value="">Select vendor...</option>
                              {vendors.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                            {raiseErrors.assigned_vendors && <p className="text-red-500 text-xs mt-1">{raiseErrors.assigned_vendors}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Choose Engineer <span className="text-red-500">*</span></label>
                            <select value={raiseForm.assigned_engineers} onChange={e => { setRaiseForm(p => ({ ...p, assigned_engineers: e.target.value })); setRaiseErrors(p => ({ ...p, assigned_vendors: '', assigned_engineers: '' })); }}
                              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${raiseErrors.assigned_engineers ? 'border-red-500' : 'border-gray-300'}`}>
                              <option value="">Select engineer...</option>
                              {engineers.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                            {raiseErrors.assigned_engineers && <p className="text-red-500 text-xs mt-1">{raiseErrors.assigned_engineers}</p>}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Choose Interested Party</label>
                            <select onChange={e => { if (e.target.value) toggleMultiSelect('interested_party', Number(e.target.value)); e.target.value = ''; }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="">Select user...</option>
                              {allUsers.filter(u => !raiseForm.interested_party.includes(u.id)).map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                              ))}
                            </select>
                            {raiseForm.interested_party.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {raiseForm.interested_party.map(uid => {
                                  const u = allUsers.find(x => x.id === uid);
                                  return u ? (
                                    <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                      {u.name}
                                      <button type="button" onClick={() => toggleMultiSelect('interested_party', uid)} className="hover:text-purple-900">×</button>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                          <textarea value={raiseForm.remarks} onChange={e => setRaiseForm(p => ({ ...p, remarks: e.target.value }))} rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter remarks..." />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Attachments</label>
                          <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${raiseErrors.attachments ? 'border-red-500' : dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={e => { e.preventDefault(); setDragOver(false); handleRaiseFiles(e.dataTransfer.files); setRaiseErrors(p => ({ ...p, attachments: '' })); }}
                            onClick={() => document.getElementById('raise-file').click()}>
                            {raiseForm.attachments.length > 0 ? (
                              <div className="flex gap-2 flex-wrap justify-center">
                                {raiseForm.attachments.map((f, i) => (
                                  <div key={i} className="relative">
                                    {f.type.startsWith('image/') ? (
                                      <img src={URL.createObjectURL(f)} alt={`p-${i}`} className="w-16 h-16 object-cover rounded border" />
                                    ) : (
                                      <div className="w-16 h-16 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 p-1">
                                        <span className="truncate w-full text-center">{f.name.split('.').pop().toUpperCase()}</span>
                                      </div>
                                    )}
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeRaiseFile(i); }}
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">×</button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div>
                                <CloudArrowUpIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                <p className="text-sm text-gray-500">Drag & drop files here, or click to browse</p>
                              </div>
                            )}
                            <input id="raise-file" type="file" multiple className="hidden"
                              onChange={e => { handleRaiseFiles(e.target.files); setRaiseErrors(p => ({ ...p, attachments: '' })); }} />
                          </div>
                          {raiseErrors.attachments && <p className="text-red-500 text-xs mt-1">{raiseErrors.attachments}</p>}
                        </div>
                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                          <button onClick={() => setActiveAction(null)}
                            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                          <button onClick={() => handleRaiseSave(true)} disabled={submitting}
                            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-400 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                            {submitting ? 'Saving...' : 'Save as Draft'}
                          </button>
                          <button onClick={() => handleRaiseSave(false)} disabled={submitting}
                            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                            {submitting ? 'Sending...' : 'Send Raise Ticket'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedTicket(null); }} title="Ticket Details" size="2xl">
        {selectedTicket && (() => {
          const attachments = parseAttachments(selectedTicket.attachments);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Number</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.ticket_number || `#${selectedTicket.id}`}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Checklist</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.checklist_name || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.user_name}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.location || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.department || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Camera Count</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.camera_count || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NVR</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{(() => { try { const arr = JSON.parse(selectedTicket.nvr); return Array.isArray(arr) ? arr.join(', ') : selectedTicket.nvr || '-'; } catch { return selectedTicket.nvr || '-'; } })()}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Camera No</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{(() => { try { const arr = JSON.parse(selectedTicket.camera_no); return Array.isArray(arr) ? arr.map(k => { const [cam, nvr] = k.split('||'); return nvr ? `${nvr} : ${cam}` : cam; }).join(', ') : selectedTicket.camera_no || '-'; } catch { return selectedTicket.camera_no || '-'; } })()}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.issue}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    {(() => {
                      // Show vendor/engineer status if they have updated it, otherwise show ticket status
                      let displayStatus = selectedTicket.status;
                      
                      // If vendor or engineer has updated their status, show their mapped database status
                      if (selectedTicket.vendor_status) {
                        displayStatus = selectedTicket.vendor_status;
                      } else if (selectedTicket.engineer_status) {
                        displayStatus = selectedTicket.engineer_status;
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
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{formatDateTime(selectedTicket.created_at)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Offline</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.offline || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Device</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.device || '-'}</div>
                </div>
                
                {/* Other fields */}
                {selectedTicket.assigned_vendors && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.vendor_name || '-'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Status</label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        {selectedTicket.vendor_status ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedTicket.vendor_status === 'Completed' ? 'bg-green-100 text-green-700' :
                            selectedTicket.vendor_status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{selectedTicket.vendor_status}</span>
                        ) : '-'}
                      </div>
                    </div>
                  </>
                )}
                {selectedTicket.assigned_engineers && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Engineer</label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.engineer_name || '-'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Engineer Status</label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        {selectedTicket.engineer_status ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedTicket.engineer_status === 'Completed' ? 'bg-green-100 text-green-700' :
                            selectedTicket.engineer_status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{selectedTicket.engineer_status}</span>
                        ) : '-'}
                      </div>
                    </div>
                  </>
                )}
                {selectedTicket.interested_party && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interested Party</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.interested_party_names || '-'}</div>
                  </div>
                )}
              </div>
              
              {/* REMARKS AND ATTACHMENTS SECTION IN 3-COLUMN LAYOUT */}
              <div className="grid grid-cols-3 gap-6">
                {/* 1. Auditor/Admin Remarks (original creator) */}
                <div>
                  <label className="block text-lg font-bold text-gray-900 mb-3">
                    {(() => {
                      // Check creator's role - roles 1 (Super Admin) and 8 (Compliance Admin) are admin
                      const isAdminCreated = selectedTicket.creator_role_id === 1 || selectedTicket.creator_role_id === 8;
                      return isAdminCreated ? 'Admin Ticket Remarks' : 'Auditor Remarks';
                    })()
                    }
                  </label>
                  <div className="px-5 py-4 bg-blue-50 border-2 border-blue-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.remarks || '-'}</div>
                  
                  {/* 1. Auditor/Admin Attachments (original creator) */}
                  {attachments.length > 0 && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {(() => {
                          // Check creator's role - roles 1 (Super Admin) and 8 (Compliance Admin) are admin
                          const isAdminCreated = selectedTicket.creator_role_id === 1 || selectedTicket.creator_role_id === 8;
                          return isAdminCreated ? `Admin Ticket Attachments (${attachments.length})` : `Auditor Attachments (${attachments.length})`;
                        })()
                        }
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((att, idx) => {
                          const fileExt = att.split('.').pop().toLowerCase();
                          const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                          return isImage ? (
                            <img key={idx} src={`${BACKEND_URL}/uploads/tickets/${att}`} alt={`att-${idx}`}
                              className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                              onClick={() => {
                                const imageAttachments = attachments.filter(a => {
                                  const ext = a.split('.').pop().toLowerCase();
                                  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                });
                                openImages(imageAttachments, imageAttachments.indexOf(att));
                              }} />
                          ) : (
                            <a key={idx} href={`${BACKEND_URL}/uploads/tickets/${att}`} download
                              className="w-32 h-20 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-2"
                              title={att}>
                              <span className="text-lg font-medium">{fileExt.toUpperCase()}</span>
                              <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{att.split('-').slice(2).join('-')}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 2. Admin Raised Remarks and Attachments (if escalated) */}
                {selectedTicket.status_remarks && (selectedTicket.assigned_vendors || selectedTicket.assigned_engineers) && (
                  <div>
                    <label className="block text-lg font-bold text-gray-900 mb-3">Admin Raised Remarks</label>
                    <div className="px-5 py-4 bg-orange-50 border-2 border-orange-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.status_remarks || '-'}</div>
                    
                    {/* 2. Admin Raised Attachments (if escalated) */}
                    {selectedTicket.raise_attachments && (() => {
                      const raiseAttachments = parseAttachments(selectedTicket.raise_attachments);
                      return raiseAttachments.length > 0 ? (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Admin Raised Attachments ({raiseAttachments.length})</label>
                          <div className="flex flex-wrap gap-2">
                            {raiseAttachments.map((att, idx) => {
                              const fileExt = att.split('.').pop().toLowerCase();
                              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                              return isImage ? (
                                <img key={idx} src={`${BACKEND_URL}/uploads/tickets/${att}`} alt={`raise-att-${idx}`}
                                  className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                  onClick={() => {
                                    const imageAttachments = raiseAttachments.filter(a => {
                                      const ext = a.split('.').pop().toLowerCase();
                                      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                    });
                                    openImages(imageAttachments, imageAttachments.indexOf(att));
                                  }} />
                              ) : (
                                <a key={idx} href={`${BACKEND_URL}/uploads/tickets/${att}`} download
                                  className="w-32 h-20 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-2"
                                  title={att}>
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
                
                {/* 3. Vendor/Engineer Remarks and Attachments */}
                {(() => {
                  const hasVendor = selectedTicket.assigned_vendors && (selectedTicket.vendor_remarks || parseAttachments(selectedTicket.vendor_attachments).length > 0);
                  const hasEngineer = selectedTicket.assigned_engineers && (selectedTicket.engineer_remarks || parseAttachments(selectedTicket.engineer_attachments).length > 0);
                  if (!hasVendor && !hasEngineer) return null;
                  return (
                    <div>
                      {hasVendor && (
                        <>
                          <label className="block text-lg font-bold text-gray-900 mb-3">Vendor Remarks</label>
                          <div className="px-5 py-4 bg-green-50 border-2 border-green-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.vendor_remarks || '-'}</div>
                          {(() => {
                            const vendorAttachments = parseAttachments(selectedTicket.vendor_attachments);
                            return vendorAttachments.length > 0 ? (
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Attachments ({vendorAttachments.length})</label>
                                <div className="flex flex-wrap gap-2">
                                  {vendorAttachments.map((att, idx) => {
                                    const fileExt = att.split('.').pop().toLowerCase();
                                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                                    return isImage ? (
                                      <img key={idx} src={`${BACKEND_URL}/uploads/tickets/${att}`} alt={`vendor-att-${idx}`}
                                        className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                        onClick={() => { const imgs = vendorAttachments.filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())); openImages(imgs, imgs.indexOf(att)); }} />
                                    ) : (
                                      <a key={idx} href={`${BACKEND_URL}/uploads/tickets/${att}`} download
                                        className="w-32 h-20 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-2" title={att}>
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
                            const engineerAttachments = parseAttachments(selectedTicket.engineer_attachments);
                            return engineerAttachments.length > 0 ? (
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Engineer Attachments ({engineerAttachments.length})</label>
                                <div className="flex flex-wrap gap-2">
                                  {engineerAttachments.map((att, idx) => {
                                    const fileExt = att.split('.').pop().toLowerCase();
                                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                                    return isImage ? (
                                      <img key={idx} src={`${BACKEND_URL}/uploads/tickets/${att}`} alt={`engineer-att-${idx}`}
                                        className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                        onClick={() => { const imgs = engineerAttachments.filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())); openImages(imgs, imgs.indexOf(att)); }} />
                                    ) : (
                                      <a key={idx} href={`${BACKEND_URL}/uploads/tickets/${att}`} download
                                        className="w-32 h-20 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-2" title={att}>
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
                
                {/* 4. Admin Closed Remarks (if admin closed it) */}
                {selectedTicket.status_remarks && !selectedTicket.assigned_vendors && !selectedTicket.assigned_engineers && (
                  <div>
                    <label className="block text-lg font-bold text-gray-900 mb-3">Admin Closed Remarks</label>
                    <div className="px-5 py-4 bg-red-50 border-2 border-red-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.status_remarks || '-'}</div>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button onClick={() => { setIsModalOpen(false); setSelectedTicket(null); }}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Camera Management Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-base font-semibold text-gray-800">Manage Location Cameras</h3>
              <button onClick={() => setShowCameraModal(false)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Add Form */}
              <div className="grid grid-cols-5 gap-2 items-end">
                <div>
                  <label className="text-xs font-medium text-gray-600">Location *</label>
                  <input type="text" value={cameraForm.location} onChange={e => setCameraForm(p => ({...p, location: e.target.value}))} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" placeholder="CHETHPET" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Category</label>
                  <input type="text" value={cameraForm.category} onChange={e => setCameraForm(p => ({...p, category: e.target.value}))} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" placeholder="RMCC" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">NVR *</label>
                  <input type="text" value={cameraForm.nvr} onChange={e => setCameraForm(p => ({...p, nvr: e.target.value}))} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" placeholder="BHANAMPATTU" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Camera No (From-To)</label>
                  <div className="flex gap-1">
                    <input type="number" value={cameraForm.camera_no_from} onChange={e => setCameraForm(p => ({...p, camera_no_from: e.target.value}))} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" placeholder="1" />
                    <input type="number" value={cameraForm.camera_no_to} onChange={e => setCameraForm(p => ({...p, camera_no_to: e.target.value}))} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" placeholder="3" />
                  </div>
                </div>
                <button onClick={handleAddCameras} className="px-3 py-1.5 text-sm font-medium text-white rounded hover:opacity-90" style={{background:'#C50B34'}}>Add</button>
              </div>
              {/* Filter & List */}
              <div className="flex items-center gap-2 border-t pt-3">
                <input type="text" placeholder="Filter by location..." value={cameraFilterLocation} onChange={e => setCameraFilterLocation(e.target.value)} className="px-2 py-1.5 text-sm border border-gray-300 rounded w-48 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" />
                <button onClick={() => fetchCameraList(cameraFilterLocation)} className="px-3 py-1.5 text-xs font-medium text-white bg-gray-600 rounded hover:bg-gray-700">Filter</button>
                <button onClick={() => { setCameraFilterLocation(''); setCameraList([]); }} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded">Clear</button>
                <span className="ml-auto text-xs text-gray-500">{cameraList.length} camera(s)</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Location</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Category</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">NVR</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Camera No</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cameraList.map(cam => (
                      <tr key={cam.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{cam.location}</td>
                        <td className="px-3 py-2">{cam.category}</td>
                        <td className="px-3 py-2">{cam.nvr}</td>
                        <td className="px-3 py-2">{cam.camera_no}</td>
                        <td className="px-3 py-2"><button onClick={() => handleDeleteCamera(cam.id)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                    {cameraList.length === 0 && <tr><td colSpan="5" className="px-3 py-4 text-center text-gray-400">No cameras found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceDashboard;
