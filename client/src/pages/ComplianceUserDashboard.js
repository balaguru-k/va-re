import React, { useState, useEffect } from 'react';
import { EyeIcon, PencilIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import Modal from '../components/UI/Modal';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import toast from 'react-hot-toast';
import { sortTickets } from '../utils/ticketSort';
import MobileSelect from '../components/UI/MobileSelect';
import MobileDatePicker from '../components/UI/MobileDatePicker';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const ITEMS_PER_PAGE = 10;
const isMobile = window.innerWidth <= 768;

const ComplianceUserDashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => (
    <span className={`ml-1 text-base ${sortKey === col ? 'text-red-500' : 'text-gray-400'}`}>
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ status: '', remarks: '', attachments: [] });
  const [dragOver, setDragOver] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    api.get('/tickets/my-tickets')
      .then(res => setTickets(res.data.data?.tickets || []))
      .catch(() => toast.error('Failed to load tickets'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

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

  const openEditModal = (ticket) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const role = user?.role;
    const userId = user?.id;

    if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) {
      // Load original user selection from display field for editing
      setEditForm({ 
        status: ticket.vendor_status_display || ticket.vendor_status || '', 
        remarks: ticket.vendor_remarks || '',
        offline: ticket.offline || '',
        device: ticket.device || '',
        attachments: []
      });
    } else if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId) {
      // Load original user selection from display field for editing
      setEditForm({ 
        status: ticket.engineer_status_display || ticket.engineer_status || '', 
        remarks: ticket.engineer_remarks || '',
        offline: ticket.offline || '',
        device: ticket.device || '',
        attachments: []
      });
    }
    setSelectedTicket(ticket);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const role = user?.role;

    const effectiveStatus = selectedTicket?.vendor_status || selectedTicket?.engineer_status || selectedTicket?.status;
    const isAlreadyCompleted = effectiveStatus === 'Completed';
    const missingOfflineDevice = !selectedTicket?.offline || !selectedTicket?.device;
    const offlineOnlyMode = isAlreadyCompleted && missingOfflineDevice;

    if (!offlineOnlyMode) {
      const terminalStatuses = ['Completed', 'Duplicate', 'Ticket by mistake'];
      const adminFilledOfflineDevice = selectedTicket?.offline && selectedTicket?.device;
      if (terminalStatuses.includes(editForm.status) && !adminFilledOfflineDevice) {
        if (!editForm.offline || !editForm.device) {
          toast.error('Please select both Offline and Device before completing the ticket');
          return;
        }
      }
    } else {
      if (!editForm.offline || !editForm.device) {
        toast.error('Please select both Offline and Device');
        return;
      }
    }

    const formData = new FormData();
    if (!offlineOnlyMode) {
      if (role === 'Vendor') {
        formData.append('vendor_status', editForm.status);
        formData.append('vendor_remarks', editForm.remarks);
      } else if (role === 'Engineer') {
        formData.append('engineer_status', editForm.status);
        formData.append('engineer_remarks', editForm.remarks);
      }
    } else {
      // In offlineOnlyMode keep existing status
      if (role === 'Vendor') formData.append('vendor_status', selectedTicket.vendor_status_display || selectedTicket.vendor_status || '');
      else if (role === 'Engineer') formData.append('engineer_status', selectedTicket.engineer_status_display || selectedTicket.engineer_status || '');
    }
    if (editForm.offline) formData.append('offline', editForm.offline);
    if (editForm.device) formData.append('device', editForm.device);
    editForm.attachments.forEach(file => formData.append('attachments', file));

    try {
      await api.patch(`/tickets/${selectedTicket.id}/vendor-engineer-status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Updated successfully');
      setIsEditModalOpen(false);
      const res = await api.get('/tickets/my-tickets');
      const updatedTickets = res.data.data?.tickets || [];
      setTickets(updatedTickets);
      // Update selectedTicket so view modal shows fresh data
      if (selectedTicket) {
        const updated = updatedTickets.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const parseJSON = (raw) => {
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  };

  const handleFileSelect = (files) => {
    const validFiles = Array.from(files);
    setEditForm(prev => ({ ...prev, attachments: [...prev.attachments, ...validFiles] }));
  };

  const removeFile = (index) => {
    setEditForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));
  };

  const openImages = (images, index) => {
    setSelectedImages(images);
    setCurrentImageIndex(index);
    setShowImageModal(true);
  };

  const filtered = tickets.filter(t => {
    if (statusFilter) {
      const effectiveStatus = t.vendor_status || t.engineer_status || t.status;
      if (effectiveStatus !== statusFilter) return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchSearch = t.issue?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q) ||
        t.user_name?.toLowerCase().includes(q) ||
        t.location?.toLowerCase().includes(q) ||
        t.department?.toLowerCase().includes(q) ||
        (t.category || t.division || '').toLowerCase().includes(q);
      if (!matchSearch) return false;
    }
    if (fromDate || toDate) {
      const ticketDate = new Date(t.created_at).toISOString().split('T')[0];
      if (fromDate && ticketDate < fromDate) return false;
      if (toDate && ticketDate > toDate) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = itemsPerPage === 'all' ? filtered : filtered.slice(0, itemsPerPage);
  const sorted = sortTickets(paginated, sortKey, sortDir);

  const statusColor = (s) => {
    if (s === 'Completed') return 'bg-green-100 text-green-800 border-green-200';
    if (s === 'In Progress') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s === 'Pending') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (s === 'Duplicate') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (s === 'Ticket by mistake') return 'bg-red-100 text-red-800 border-red-200';
    if (s === 'Raised') return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getDisplayStatus = (ticket) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const role = user?.role;
    const userId = user?.id;
    if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) return ticket.vendor_status || ticket.status;
    if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId) return ticket.engineer_status || ticket.status;
    if (role === 'VS User') return ticket.vendor_status || ticket.engineer_status || ticket.status;
    return ticket.status;
  };

  const getMyStatus = (ticket) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const role = user?.role;
    const userId = user?.id;
    if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) return ticket.vendor_status_display || ticket.vendor_status;
    if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId) return ticket.engineer_status_display || ticket.engineer_status;
    return null;
  };

  const getAging = (ticket) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const role = user?.role;
    const userId = user?.id;
    if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) return ticket.vendor_aging;
    if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId) return ticket.engineer_aging;
    return null;
  };

  if (isMobile) {
    const user = JSON.parse(localStorage.getItem('user'));
    const role = user?.role;
    const userId = user?.id;
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        {/* Mobile Image Modal */}
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
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
                    <ChevronLeftIcon className="w-6 h-6" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setCurrentImageIndex(p => p < selectedImages.length - 1 ? p + 1 : 0); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
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

        {/* Mobile Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-gray-800">My Tickets</h1>
            <button
              onClick={() => setShowFilters(f => !f)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters
              {(searchTerm || fromDate || toDate || statusFilter) && (
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              )}
              <svg className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-2">
              <input type="text" placeholder="Search..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
              <div className="flex gap-2 items-center">
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
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <MobileSelect
                    label="Filter by Status"
                    value={statusFilter}
                    onChange={val => setStatusFilter(val)}
                    options={[
                      { value: 'Raised', label: 'Raised' },
                      { value: 'Pending', label: 'Pending' },
                      { value: 'In Progress', label: 'In Progress' },
                      { value: 'Completed', label: 'Completed' },
                      { value: 'Duplicate', label: 'Duplicate' },
                      { value: 'Ticket by mistake', label: 'Ticket by mistake' },
                      // { value: 'New', label: 'New' }
                    ]}
                    placeholder="All Status"
                  />
                </div>
                {statusFilter && (
                  <button onClick={() => setStatusFilter('')} className="text-xs text-red-500 font-medium whitespace-nowrap">Clear</button>
                )}
              </div>
              {(searchTerm || fromDate || toDate || statusFilter) && (
                <button onClick={() => { setSearchTerm(''); setFromDate(''); setToDate(''); setStatusFilter(''); }}
                  className="text-xs text-red-500 font-medium">Clear All Filters</button>
              )}
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-6">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No tickets assigned to you.</div>
          ) : sorted.map((ticket) => {
            const displayStatus = getDisplayStatus(ticket);
            const myStatus = getMyStatus(ticket);
            const aging = getAging(ticket);
            const canEdit = (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) ||
                            (role === 'Engineer' && Number(ticket.assigned_engineers) === userId);
            const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
            const isCompleted = effectiveStatus === 'Completed';
            const missingOfflineDevice = !ticket.offline || !ticket.device;
            const canEditTicket = canEdit && (!isCompleted || (isCompleted && missingOfflineDevice));
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
                <div className="px-4 py-3 space-y-2">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
                    <div>
                      <span className="text-xs text-gray-500 block mb-0.5">Issue</span>
                      <span className="font-medium text-gray-800">{ticket.issue || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-0.5">Subject</span>
                      <span className="font-medium text-gray-800">{ticket.subject || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-0.5">Location</span>
                      <span className="text-gray-700">{ticket.location || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-0.5">Division</span>
                      <span className="text-gray-700">{ticket.category || ticket.division || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-0.5">Department</span>
                      <span className="text-gray-700">{ticket.department || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-0.5">Created On</span>
                      <span className="text-gray-700">{formatDateTime(ticket.created_at)}</span>
                    </div>
                    {aging !== null && aging !== undefined && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-0.5">Aging</span>
                        <span className={`font-medium ${aging > 7 ? 'text-red-600' : 'text-gray-800'}`}>{aging} days</span>
                      </div>
                    )}
                    {myStatus && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-0.5">My Status</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor(myStatus)}`}>{myStatus}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Card Actions */}
                <div className="flex border-t border-gray-100">
                  <button
                    onClick={() => { setSelectedTicket(ticket); setIsModalOpen(true); }}
                    className="mobile-btn-text flex-1 py-4 font-semibold text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                    <EyeIcon className="w-6 h-6" /> View
                  </button>
                  {canEdit && (
                    <>
                      <div className="w-px bg-gray-100" />
                      <button 
                        onClick={() => canEditTicket && openEditModal(ticket)}
                        disabled={!canEditTicket}
                        className={`mobile-btn-text flex-1 py-4 font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                          canEditTicket ? 'text-green-600 hover:bg-green-50' : 'text-gray-300 cursor-not-allowed'
                        }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        {isCompleted && missingOfflineDevice ? 'Update' : 'Edit'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile count footer */}
        <div className="bg-white border-t border-gray-200 px-4 py-2 text-xs text-gray-500 text-center">
          {sorted.length} of {filtered.length} tickets
        </div>

        {/* View Modal (reused) */}
        <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedTicket(null); }} title="Ticket Details" size="2xl">
          {selectedTicket && (() => {
            const parseJ = (raw) => { if (!raw) return []; try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; } };
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[['Ticket ID', ticket => ticket.ticket_number || `#${ticket.id}`],['Subject', t => t.subject || '-'],['Issue', t => t.issue],['Location', t => t.location || '-'],['Department', t => t.department || '-'],['Division', t => t.category || t.division || '-'],['Camera Count', t => t.camera_count || '-'],['Created By', t => t.user_name],['Created At', t => formatDateTime(t.created_at)],['Offline', t => t.offline || '-'],['Device', t => t.device || '-'],['Status', t => getDisplayStatus(t)]].map(([label, fn]) => (
                    <div key={label}>
                      <span className="block text-xs text-gray-500 mb-0.5">{label}</span>
                      <div className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm">
                        {label === 'Status' ? (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor(fn(selectedTicket))}`}>{fn(selectedTicket)}</span>
                        ) : fn(selectedTicket)}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Remarks sections */}
                {selectedTicket.remarks && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">{selectedTicket.creator_role_id === 1 || selectedTicket.creator_role_id === 8 ? 'Admin Remarks' : 'Auditor Remarks'}</span>
                    <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">{selectedTicket.remarks}</div>
                  </div>
                )}
                {selectedTicket.status_remarks && (selectedTicket.assigned_vendors || selectedTicket.assigned_engineers) && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Admin Raised Remarks</span>
                    <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded text-sm">{selectedTicket.status_remarks}</div>
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
                {selectedTicket.status_remarks && !selectedTicket.assigned_vendors && !selectedTicket.assigned_engineers && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Admin Closed Remarks</span>
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm">{selectedTicket.status_remarks}</div>
                  </div>
                )}
                {/* Attachments */}
                {parseJ(selectedTicket.raise_attachments).length > 0 && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Admin Attachments</span>
                    <div className="flex flex-wrap gap-2">
                      {parseJ(selectedTicket.raise_attachments).map((att, idx) => {
                        const ext = att.split('.').pop().toLowerCase();
                        const isImg = ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);
                        const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                        return isImg ? (
                          <img key={idx} src={src} alt={`a-${idx}`} className="w-16 h-16 object-cover rounded border cursor-pointer" onClick={() => { const imgs = parseJ(selectedTicket.raise_attachments).filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())).map(a => `${BACKEND_URL}/uploads/tickets/${a}`); openImages(imgs, imgs.indexOf(src)); }} />
                        ) : (
                          <a key={idx} href={src} download className="w-16 h-16 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 p-1">
                            <span className="font-medium">{ext.toUpperCase()}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
                {parseJ(selectedTicket.vendor_attachments).length > 0 && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">My Attachments ({parseJ(selectedTicket.vendor_attachments).length})</span>
                    <div className="flex flex-wrap gap-2">
                      {parseJ(selectedTicket.vendor_attachments).map((att, idx) => {
                        const ext = att.split('.').pop().toLowerCase();
                        const isImg = ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);
                        const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                        return isImg ? (
                          <img key={idx} src={src} alt={`va-${idx}`} className="w-16 h-16 object-cover rounded border cursor-pointer" onClick={() => { const imgs = parseJ(selectedTicket.vendor_attachments).filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())).map(a => `${BACKEND_URL}/uploads/tickets/${a}`); openImages(imgs, imgs.indexOf(src)); }} />
                        ) : (
                          <a key={idx} href={src} download className="w-16 h-16 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 p-1">
                            <span className="font-medium">{ext.toUpperCase()}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
                {parseJ(selectedTicket.engineer_attachments).length > 0 && (
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 mb-1">My Attachments ({parseJ(selectedTicket.engineer_attachments).length})</span>
                    <div className="flex flex-wrap gap-2">
                      {parseJ(selectedTicket.engineer_attachments).map((att, idx) => {
                        const ext = att.split('.').pop().toLowerCase();
                        const isImg = ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);
                        const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                        return isImg ? (
                          <img key={idx} src={src} alt={`ea-${idx}`} className="w-16 h-16 object-cover rounded border cursor-pointer" onClick={() => { const imgs = parseJ(selectedTicket.engineer_attachments).filter(a => ['jpg','jpeg','png','gif','webp','bmp'].includes(a.split('.').pop().toLowerCase())).map(a => `${BACKEND_URL}/uploads/tickets/${a}`); openImages(imgs, imgs.indexOf(src)); }} />
                        ) : (
                          <a key={idx} href={src} download className="w-16 h-16 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 p-1">
                            <span className="font-medium">{ext.toUpperCase()}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-2 border-t border-gray-200">
                  <button onClick={() => { setIsModalOpen(false); setSelectedTicket(null); }}
                    className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg">Close</button>
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* Edit Status Modal (reused) */}
        <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedTicket(null); }} title="Update Status" size="lg">
          {(() => {
            const effectiveStatus = selectedTicket?.vendor_status || selectedTicket?.engineer_status || selectedTicket?.status;
            const isAlreadyCompleted = effectiveStatus === 'Completed';
            const missingOfflineDevice = !selectedTicket?.offline || !selectedTicket?.device;
            const offlineOnlyMode = isAlreadyCompleted && missingOfflineDevice;
            return (
              <div className="space-y-4">
                {offlineOnlyMode && (
                  <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
                    This ticket is completed. Please fill in the missing <span className="font-semibold">Offline</span> and <span className="font-semibold">Device</span> fields.
                  </div>
                )}
                {!offlineOnlyMode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                    <MobileSelect
                      label="Select Status"
                      value={editForm.status}
                      onChange={val => setEditForm({ ...editForm, status: val })}
                      options={[
                        { value: "Pending", label: "Pending" },
                        { value: "In Progress", label: "In Progress" },
                        { value: "Completed", label: "Completed" },
                        { value: "Duplicate", label: "Duplicate" },
                        { value: "Ticket by mistake", label: "Ticket by mistake" }
                      ]}
                      placeholder="Select Status"
                    />
                  </div>
                )}
                {selectedTicket?.offline && selectedTicket?.device ? (
                  <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    Offline &amp; Device already set: <span className="font-medium">{selectedTicket.offline}</span> / <span className="font-medium">{selectedTicket.device}</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Offline <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        {['Internet', 'Power'].map(opt => (
                          <button key={opt} type="button" onClick={() => setEditForm(p => ({ ...p, offline: p.offline === opt ? '' : opt }))}
                            className={`flex-1 py-2.5 text-sm font-medium border-2 rounded-lg transition-colors ${
                              editForm.offline === opt ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-300 bg-white text-orange-600'
                            }`}>{opt}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Device <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        {['Hardware', 'Software'].map(opt => (
                          <button key={opt} type="button" onClick={() => setEditForm(p => ({ ...p, device: p.device === opt ? '' : opt }))}
                            className={`flex-1 py-2.5 text-sm font-medium border-2 rounded-lg transition-colors ${
                              editForm.device === opt ? 'border-teal-500 bg-teal-500 text-white' : 'border-teal-300 bg-white text-teal-600'
                            }`}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer border-gray-300"
                    onClick={() => document.getElementById('edit-file-mobile').click()}>
                    {editForm.attachments.length > 0 ? (
                      <div className="flex gap-2 flex-wrap justify-center">
                        {editForm.attachments.map((file, i) => (
                          <div key={i} className="relative">
                            {file.type.startsWith('image/') ? (
                              <img src={URL.createObjectURL(file)} alt={`p-${i}`} className="w-16 h-16 object-cover rounded border" />
                            ) : (
                              <div className="w-16 h-16 flex items-center justify-center border rounded bg-gray-50 text-xs text-gray-600">
                                {file.name.split('.').pop().toUpperCase()}
                              </div>
                            )}
                            <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">×</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Tap to select files</p>
                    )}
                    <input id="edit-file-mobile" type="file" multiple className="hidden" onChange={e => handleFileSelect(e.target.files)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <textarea value={editForm.remarks} onChange={e => setEditForm({ ...editForm, remarks: e.target.value })}
                    rows="3" placeholder="Enter remarks..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <button onClick={() => { setIsEditModalOpen(false); setSelectedTicket(null); }}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg">Cancel</button>
                  <button onClick={handleEditSubmit} disabled={!offlineOnlyMode && !editForm.status}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg disabled:opacity-50">Update</button>
                </div>
              </div>
            );
          })()}
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3">

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

      <PageHeader title="My Tickets">
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Search tickets..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
          <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
          <span className="text-sm text-gray-500">to</span>
          <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-2 py-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-300 rounded-lg">Clear</button>
          )}
        </div>
      </PageHeader>

      <div className="bg-white border border-red-100 rounded-lg flex flex-col flex-1 min-h-0">
        <div className="overflow-auto scroll-container flex-1 min-h-0">
          <table style={{ minWidth: '1680px' }} className="w-full">
            <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
              <tr>
                <th style={{ width: '10px', minWidth: '10px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10">S.No</th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('ticket_number')}>Ticket ID<SortIcon col="ticket_number" /></th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('division')}>Division<SortIcon col="division" /></th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('location')}>Location<SortIcon col="location" /></th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('department')}>Department<SortIcon col="department" /></th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('subject')}>Subject<SortIcon col="subject" /></th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('issue')}>Issue<SortIcon col="issue" /></th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10">NVR</th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10">Camera No</th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('user_assign_date')}>Created On<SortIcon col="user_assign_date" /></th>
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 cursor-pointer select-none sticky top-0 z-10" onClick={() => handleSort('raised_at')}>Raised On<SortIcon col="raised_at" /></th>
                {(() => {
                  const user = JSON.parse(localStorage.getItem('user'));
                  const role = user?.role;
                  return role === 'VS User' ? (
                    <>
                      <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" onClick={() => handleSort('admin_aging')}>Admin Aging<SortIcon col="admin_aging" /></th>
                      <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" onClick={() => handleSort('vendor_aging')}>Vendor Aging<SortIcon col="vendor_aging" /></th>
                      <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" onClick={() => handleSort('engineer_aging')}>Engineer Aging<SortIcon col="engineer_aging" /></th>
                    </>
                  ) : null;
                })()}
                {(() => {
                  const user = JSON.parse(localStorage.getItem('user'));
                  const role = user?.role;
                  return (role === 'Vendor' || role === 'Engineer') ? (
                    <>
                      <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" onClick={() => handleSort('vendor_aging')}>Aging<SortIcon col="vendor_aging" /></th>
                      <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" onClick={() => handleSort('vendor_status')}>My Status<SortIcon col="vendor_status" /></th>
                    </>
                  ) : null;
                })()}
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" onClick={() => handleSort('status')}>Status<SortIcon col="status" /></th>
                {(() => {
                  const user = JSON.parse(localStorage.getItem('user'));
                  const role = user?.role;
                  return role === 'VS User' ? (
                    <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" onClick={() => handleSort('completed_at')}>Completed By<SortIcon col="completed_at" /></th>
                  ) : null;
                })()}
                <th style={{ width: '140px', minWidth: '140px', backgroundColor: '#ededed' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" onClick={() => handleSort('completed_at')}>Completed On<SortIcon col="completed_at" /></th>
                <th style={{ backgroundColor: '#ededed', width: '140px', minWidth: '140px' }} className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 right-0 z-30">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="18" className="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan="18" className="px-4 py-6 text-center text-gray-500">No tickets assigned to you.</td></tr>
              ) : sorted.map((ticket, index) => {
                const attachments = parseJSON(ticket.raise_attachments).map(a => `${BACKEND_URL}/uploads/tickets/${a}`);
                const user = JSON.parse(localStorage.getItem('user'));
                const role = user?.role;
                const userId = user?.id;
                return (
                  <tr key={ticket.id} className={`cursor-pointer hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`} onClick={() => { setSelectedTicket(ticket); setIsModalOpen(true); }}>
                    <td className="px-4 py-3 text-sm text-gray-500">{startIndex + index + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.ticket_number || `#${ticket.id}`}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ticket.category || ticket.division || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ticket.location || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {ticket.department ? (() => {
                        const depts = ticket.department.split(', ');
                        if (depts.length <= 2) return ticket.department;
                        return <span className="cursor-pointer" title={ticket.department}>{depts.slice(0, 2).join(', ')}...</span>;
                      })() : '-'}
                    </td>
                    {/* <td className="px-4 py-3 text-sm text-gray-900">{ticket.checklist_name || '-'}</td> */}
                    {/* <td className="px-4 py-3 text-sm text-gray-900">{ticket.camera_count || '-'}</td> */}
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.subject || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{ticket.issue}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{(() => { try { const arr = JSON.parse(ticket.nvr); return Array.isArray(arr) ? arr.join(', ') : ticket.nvr || '-'; } catch { return ticket.nvr || '-'; } })()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{(() => { try { const arr = JSON.parse(ticket.camera_no); return Array.isArray(arr) ? arr.map(k => { const [cam, nvr] = k.split('||'); return nvr ? `${nvr} : ${cam}` : cam; }).join(', ') : ticket.camera_no || '-'; } catch { return ticket.camera_no || '-'; } })()}</td>
                    {/* <td className="px-4 py-3 text-sm text-gray-600">{ticket.user_name}</td> */}
                    <td className="px-4 py-3 text-sm text-gray-600 truncate">
                      {formatDateTime(ticket.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 truncate">{ticket.raised_at ? formatDateTime(ticket.raised_at) : '-'}</td>
                    {(() => {
                      const user = JSON.parse(localStorage.getItem('user'));
                      const role = user?.role;
                      return role === 'VS User' ? (
                        <>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.admin_aging !== null ? `${ticket.admin_aging} days` : '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.vendor_aging !== null ? `${ticket.vendor_aging} days` : '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.engineer_aging !== null ? `${ticket.engineer_aging} days` : '-'}</td>
                        </>
                      ) : null;
                    })()}
                    {(role === 'Vendor' || role === 'Engineer') && (
                      <>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {(() => {
                            if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) {
                              return ticket.vendor_aging !== null ? `${ticket.vendor_aging} days` : '-';
                            } else if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId) {
                              return ticket.engineer_aging !== null ? `${ticket.engineer_aging} days` : '-';
                            }
                            return '-';
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            let myStatus = null;
                            if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) {
                              // Show original user selection from display field
                              myStatus = ticket.vendor_status_display || ticket.vendor_status;
                            } else if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId) {
                              // Show original user selection from display field
                              myStatus = ticket.engineer_status_display || ticket.engineer_status;
                            }
                            return myStatus ? (
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                myStatus === 'Completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                                myStatus === 'In Progress' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                myStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                myStatus === 'Duplicate' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                myStatus === 'Ticket by mistake' ? 'bg-red-100 text-red-800 border border-red-200' :
                                'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}>
                                {myStatus}
                              </span>
                            ) : <span className="text-gray-400">-</span>;
                          })()}
                        </td>
                        {/* <td className="px-4 py-3">
                          {(() => {
                            let attachments = [];
                            if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId && ticket.vendor_attachments) {
                              try {
                                attachments = typeof ticket.vendor_attachments === 'string' ? JSON.parse(ticket.vendor_attachments) : ticket.vendor_attachments;
                              } catch (e) {}
                            } else if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId && ticket.engineer_attachments) {
                              try {
                                attachments = typeof ticket.engineer_attachments === 'string' ? JSON.parse(ticket.engineer_attachments) : ticket.engineer_attachments;
                              } catch (e) {}
                            }
                            
                            return attachments.length > 0 ? (
                              <div className="flex gap-1 items-center flex-wrap">
                                {attachments.slice(0, 2).map((att, idx) => {
                                  const fileExt = att.split('.').pop().toLowerCase();
                                  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                                  return isImage ? (
                                    <img key={idx} src={`${BACKEND_URL}/uploads/tickets/${att}`} alt={`att-${idx}`}
                                      className="w-8 h-8 object-cover rounded border cursor-pointer hover:opacity-80"
                                      onClick={() => {
                                        const imageAttachments = attachments.filter(a => {
                                          const ext = a.split('.').pop().toLowerCase();
                                          return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                        });
                                        openImages(imageAttachments.map(a => `${BACKEND_URL}/uploads/tickets/${a}`), imageAttachments.indexOf(att));
                                      }} />
                                  ) : (
                                    <a key={idx} href={`${BACKEND_URL}/uploads/tickets/${att}`} download
                                      className="flex items-center gap-1 px-1 py-0.5 border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100"
                                      title={att}>
                                      <span className="font-medium">{fileExt.toUpperCase()}</span>
                                    </a>
                                  );
                                })}
                                {attachments.length > 2 && (
                                  <div className="w-8 h-8 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                    onClick={() => {
                                      const imageAttachments = attachments.filter(a => {
                                        const ext = a.split('.').pop().toLowerCase();
                                        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                      });
                                      openImages(imageAttachments.map(a => `${BACKEND_URL}/uploads/tickets/${a}`), 0);
                                    }}>
                                    +{attachments.length - 2}
                                  </div>
                                )}
                              </div>
                            ) : <span className="text-gray-400 text-xs">-</span>;
                          })()}
                        </td> */}
                        {/* <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate">
                          {(() => {
                            if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) {
                              return ticket.vendor_remarks || '-';
                            } else if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId) {
                              return ticket.engineer_remarks || '-';
                            }
                            return '-';
                          })()}
                        </td> */}
                      </>
                    )}
                    <td className="px-4 py-3">
                      {(() => {
                        const user = JSON.parse(localStorage.getItem('user'));
                        const role = user?.role;
                        const userId = user?.id;
                        
                        // For Vendor/Engineer: Show their mapped database status if they have updated it
                        // For VS User: Show vendor/engineer status if exists, otherwise show ticket status
                        let displayStatus = ticket.status;
                        
                        if (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) {
                          // Show vendor's mapped database status if they have updated it
                          displayStatus = ticket.vendor_status || ticket.status;
                        } else if (role === 'Engineer' && Number(ticket.assigned_engineers) === userId) {
                          // Show engineer's mapped database status if they have updated it
                          displayStatus = ticket.engineer_status || ticket.status;
                        } else if (role === 'VS User') {
                          if (ticket.vendor_status) {
                            displayStatus = ticket.vendor_status;
                          } else if (ticket.engineer_status) {
                            displayStatus = ticket.engineer_status;
                          }
                        }
                        
                        return (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            displayStatus === 'Completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                            displayStatus === 'In Progress' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            displayStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                            displayStatus === 'Duplicate' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            displayStatus === 'Ticket by mistake' ? 'bg-red-100 text-red-800 border border-red-200' :
                            displayStatus === 'Raised' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            displayStatus === 'New' ? 'bg-gray-100 text-gray-800 border border-gray-200' :
                            'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                    {(() => {
                      const user = JSON.parse(localStorage.getItem('user'));
                      const role = user?.role;
                      return role === 'VS User' ? (
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
                      ) : null;
                    })()}
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
                    {/* <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate" title={ticket.status_remarks || ''}>
                      {ticket.status_remarks || '-'}
                    </td> */}
                    {/* <td className="px-4 py-3">
                      {attachments.length > 0 ? (
                        <div className="flex gap-1 items-center flex-wrap">
                          {attachments.slice(0, 3).map((src, idx) => {
                            const fileName = src.split('/').pop();
                            const fileExt = fileName.split('.').pop().toLowerCase();
                            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                            return isImage ? (
                              <img key={idx} src={src} alt={`att-${idx}`}
                                className="w-9 h-9 object-cover rounded border cursor-pointer hover:opacity-80"
                                onClick={() => {
                                  const imageAttachments = attachments.filter(a => {
                                    const ext = a.split('.').pop().toLowerCase();
                                    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                  });
                                  openImages(imageAttachments, imageAttachments.indexOf(src));
                                }} />
                            ) : (
                              <a key={idx} href={src} download
                                className="flex items-center gap-1 px-2 py-1 border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100"
                                title={fileName}>
                                <span className="font-medium">{fileExt.toUpperCase()}</span>
                                <span className="max-w-[60px] truncate">{fileName.split('-').slice(2).join('-')}</span>
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
                      ) : <span className="text-gray-400 text-xs">No files</span>}
                    </td> */}
                    <td className="px-4 py-3 sticky right-0 z-10" style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setSelectedTicket(ticket); setIsModalOpen(true); }}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="View">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                          {(() => {
                            const canEdit = (role === 'Vendor' && Number(ticket.assigned_vendors) === userId) ||
                                           (role === 'Engineer' && Number(ticket.assigned_engineers) === userId);
                            if (!canEdit) return null;
                            
                            // Check if ticket is completed using effective status logic
                            const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                            const isCompleted = effectiveStatus === 'Completed';
                            
                            // Allow edit if not completed, OR if completed but offline/device missing
                            const missingOfflineDevice = !ticket.offline || !ticket.device;
                            const canEditTicket = !isCompleted || (isCompleted && missingOfflineDevice);
                            
                            return (
                              <button 
                                onClick={() => canEditTicket && openEditModal(ticket)}
                                className={`p-1 rounded transition-colors ${
                                  !canEditTicket 
                                    ? 'text-gray-300 cursor-not-allowed' 
                                    : 'text-gray-400 hover:text-green-600'
                                }`} 
                                title={!canEditTicket ? 'Cannot edit completed ticket' : isCompleted ? 'Update Offline / Device' : 'Edit Status'}
                                disabled={!canEditTicket}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            );
                          })()}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {/* View Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedTicket(null); }} title="Ticket Details" size="2xl">
        {selectedTicket && (() => {
          const attachments = parseJSON(selectedTicket.raise_attachments).map(a => `${BACKEND_URL}/uploads/tickets/${a}`);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ticket ID</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">NVR</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{(() => { try { const arr = JSON.parse(selectedTicket.nvr); return Array.isArray(arr) ? arr.join(', ') : selectedTicket.nvr || '-'; } catch { return selectedTicket.nvr || '-'; } })()}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Camera No</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{(() => { try { const arr = JSON.parse(selectedTicket.camera_no); return Array.isArray(arr) ? arr.map(k => { const [cam, nvr] = k.split('||'); return nvr ? `${nvr} : ${cam}` : cam; }).join(', ') : selectedTicket.camera_no || '-'; } catch { return selectedTicket.camera_no || '-'; } })()}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.user_name}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.subject || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.issue}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created at</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    {formatDateTime(selectedTicket.created_at)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Offline</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.offline || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Device</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.device || '-'}</div>
                </div>
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {(() => {
                      const user = JSON.parse(localStorage.getItem('user'));
                      const isComplianceAdmin = user?.role === 'Complaince Admin';
                      // Check if ticket was created by compliance admin (no assigned vendors/engineers)
                      const isAdminCreated = !selectedTicket.assigned_vendors && !selectedTicket.assigned_engineers;
                      return isAdminCreated ? 'Admin Ticket Remarks' : 'Auditor Remarks';
                    })()
                    }
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.remarks || '-'}</div>
                </div> */}
                {(() => {
                  const user = JSON.parse(localStorage.getItem('user'));
                  const role = user?.role;
                  const userId = user?.id;
                  return (role === 'Vendor' || role === 'Engineer') ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Aging</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                          {(() => {
                            if (role === 'Vendor' && Number(selectedTicket.assigned_vendors) === userId) {
                              return selectedTicket.vendor_aging !== null ? `${selectedTicket.vendor_aging} days` : '-';
                            } else if (role === 'Engineer' && Number(selectedTicket.assigned_engineers) === userId) {
                              return selectedTicket.engineer_aging !== null ? `${selectedTicket.engineer_aging} days` : '-';
                            }
                            return '-';
                          })()}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">My Status</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                          {(() => {
                            let myStatus = null;
                            if (role === 'Vendor' && Number(selectedTicket.assigned_vendors) === userId) {
                              // Show original user selection from display field
                              myStatus = selectedTicket.vendor_status_display || selectedTicket.vendor_status;
                            } else if (role === 'Engineer' && Number(selectedTicket.assigned_engineers) === userId) {
                              // Show original user selection from display field
                              myStatus = selectedTicket.engineer_status_display || selectedTicket.engineer_status;
                            }
                            return myStatus ? (
                              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
                                myStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                                myStatus === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                myStatus === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                myStatus === 'Duplicate' ? 'bg-purple-100 text-purple-700' :
                                myStatus === 'Ticket by mistake' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{myStatus}</span>
                            ) : '-';
                          })()}
                        </div>
                      </div>
                      {/* <div> */}
                        {/* <label className="block text-sm font-medium text-gray-700 mb-1">My Attachments</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                          {(() => {
                            let attachments = [];
                            if (role === 'Vendor' && Number(selectedTicket.assigned_vendors) === userId && selectedTicket.vendor_attachments) {
                              try {
                                attachments = typeof selectedTicket.vendor_attachments === 'string' ? JSON.parse(selectedTicket.vendor_attachments) : selectedTicket.vendor_attachments;
                              } catch (e) {}
                            } else if (role === 'Engineer' && Number(selectedTicket.assigned_engineers) === userId && selectedTicket.engineer_attachments) {
                              try {
                                attachments = typeof selectedTicket.engineer_attachments === 'string' ? JSON.parse(selectedTicket.engineer_attachments) : selectedTicket.engineer_attachments;
                              } catch (e) {}
                            }
                            
                            return attachments.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {attachments.map((att, idx) => {
                                  const fileExt = att.split('.').pop().toLowerCase();
                                  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                                  return isImage ? (
                                    <img key={idx} src={`${BACKEND_URL}/uploads/tickets/${att}`} alt={`att-${idx}`}
                                      className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                      onClick={() => {
                                        const imageAttachments = attachments.filter(a => {
                                          const ext = a.split('.').pop().toLowerCase();
                                          return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                        });
                                        openImages(imageAttachments.map(a => `${BACKEND_URL}/uploads/tickets/${a}`), imageAttachments.indexOf(att));
                                      }} />
                                  ) : (
                                    <a key={idx} href={`${BACKEND_URL}/uploads/tickets/${att}`} download
                                      className="w-24 h-16 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 hover:bg-gray-100 p-2"
                                      title={att}>
                                      <span className="text-sm font-medium">{fileExt.toUpperCase()}</span>
                                      <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{att.split('-').slice(2).join('-')}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            ) : '-';
                          })()}
                        </div> */}
                      {/* </div> */}
                      {/* <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">My Remarks</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                          {(() => {
                            if (role === 'Vendor' && Number(selectedTicket.assigned_vendors) === userId) {
                              return selectedTicket.vendor_remarks || '-';
                            } else if (role === 'Engineer' && Number(selectedTicket.assigned_engineers) === userId) {
                              return selectedTicket.engineer_remarks || '-';
                            }
                            return '-';
                          })()}
                        </div>
                      </div> */}
                    </>
                  ) : null;
                })()}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    {(() => {
                      const user = JSON.parse(localStorage.getItem('user'));
                      const role = user?.role;
                      const userId = user?.id;
                      
                      // For Vendor/Engineer: Show their mapped database status if they have updated it
                      // For VS User: Show vendor/engineer status if exists, otherwise show ticket status
                      let displayStatus = selectedTicket.status;
                      
                      if (role === 'Vendor' && Number(selectedTicket.assigned_vendors) === userId) {
                        // Show vendor's mapped database status if they have updated it
                        displayStatus = selectedTicket.vendor_status || selectedTicket.status;
                      } else if (role === 'Engineer' && Number(selectedTicket.assigned_engineers) === userId) {
                        // Show engineer's mapped database status if they have updated it
                        displayStatus = selectedTicket.engineer_status || selectedTicket.status;
                      } else if (role === 'VS User') {
                        if (selectedTicket.vendor_status) {
                          displayStatus = selectedTicket.vendor_status;
                        } else if (selectedTicket.engineer_status) {
                          displayStatus = selectedTicket.engineer_status;
                        }
                      }
                      
                      return (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
                          displayStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                          displayStatus === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                          displayStatus === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                          displayStatus === 'Duplicate' ? 'bg-purple-100 text-purple-700' :
                          displayStatus === 'Ticket by mistake' ? 'bg-red-100 text-red-700' :
                          displayStatus === 'Raised' ? 'bg-blue-100 text-blue-700' :
                          displayStatus === 'New' ? 'bg-gray-100 text-gray-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{displayStatus || '-'}</span>
                      );
                    })()}
                  </div>
                </div>
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Raised Remarks</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">{selectedTicket.status_remarks || '-'}</div>
                </div> */}
              </div>
              
              {/* REMARKS AND ATTACHMENTS SECTION IN 3-COLUMN LAYOUT */}
              <div className="grid grid-cols-3 gap-6">
                {/* 1. Auditor/Admin Remarks and Attachments (original creator) */}
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
              
                  {/* Original Attachments */}
                  {(() => {
                    const attachments = parseJSON(selectedTicket.attachments);
                    return attachments.length > 0 ? (
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
                            const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                            return isImage ? (
                              <img key={idx} src={src} alt={`att-${idx}`}
                                className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                onClick={() => {
                                  const imageAttachments = attachments.filter(a => {
                                    const ext = a.split('.').pop().toLowerCase();
                                    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                  }).map(a => `${BACKEND_URL}/uploads/tickets/${a}`);
                                  openImages(imageAttachments, imageAttachments.indexOf(att));
                                }} />
                            ) : (
                              <a key={idx} href={src} download
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

                
                {/* 2. Admin Raised Remarks and Attachments (if escalated) */}
                {selectedTicket.status_remarks && (selectedTicket.assigned_vendors || selectedTicket.assigned_engineers) && (
                  <div>
                    <label className="block text-lg font-bold text-gray-900 mb-3">Admin Raised Remarks</label>
                    <div className="px-5 py-4 bg-orange-50 border-2 border-orange-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.status_remarks || '-'}</div>
                    
                    {/* Admin Raised Attachments */}
                    {selectedTicket.raise_attachments && (() => {
                      const raiseAttachments = parseJSON(selectedTicket.raise_attachments);
                      return raiseAttachments.length > 0 ? (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Admin Raised Attachments ({raiseAttachments.length})</label>
                          <div className="flex flex-wrap gap-2">
                            {raiseAttachments.map((att, idx) => {
                              const fileExt = att.split('.').pop().toLowerCase();
                              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                              const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                              return isImage ? (
                                <img key={idx} src={src} alt={`raise-att-${idx}`}
                                  className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                  onClick={() => {
                                    const imageAttachments = raiseAttachments.filter(a => {
                                      const ext = a.split('.').pop().toLowerCase();
                                      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                    }).map(a => `${BACKEND_URL}/uploads/tickets/${a}`);
                                    openImages(imageAttachments, imageAttachments.map(a => a.split('/').pop()).indexOf(att));
                                  }} />
                              ) : (
                                <a key={idx} href={src} download
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
                  const user = JSON.parse(localStorage.getItem('user'));
                  const role = user?.role;
                  const userId = user?.id;
                  
                  // Check if vendor has remarks/attachments
                  const hasVendorData = selectedTicket.assigned_vendors && 
                    (selectedTicket.vendor_remarks || (selectedTicket.vendor_attachments && parseJSON(selectedTicket.vendor_attachments).length > 0));
                  
                  // Check if engineer has remarks/attachments
                  const hasEngineerData = selectedTicket.assigned_engineers && 
                    (selectedTicket.engineer_remarks || (selectedTicket.engineer_attachments && parseJSON(selectedTicket.engineer_attachments).length > 0));
                  
                  if (!hasVendorData && !hasEngineerData) return null;
                  
                  return (
                    <div>
                      {/* Vendor Remarks and Attachments */}
                      {hasVendorData && (
                        <>
                          <label className="block text-lg font-bold text-gray-900 mb-3">Vendor Remarks</label>
                          <div className="px-5 py-4 bg-green-50 border-2 border-green-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.vendor_remarks || '-'}</div>
                          
                          {/* Vendor Attachments */}
                          {selectedTicket.vendor_attachments && (() => {
                            const vendorAttachments = parseJSON(selectedTicket.vendor_attachments);
                            return vendorAttachments.length > 0 ? (
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Attachments ({vendorAttachments.length})</label>
                                <div className="flex flex-wrap gap-2">
                                  {vendorAttachments.map((att, idx) => {
                                    const fileExt = att.split('.').pop().toLowerCase();
                                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                                    const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                                    return isImage ? (
                                      <img key={idx} src={src} alt={`vendor-att-${idx}`}
                                        className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                        onClick={() => {
                                          const imageAttachments = vendorAttachments.filter(a => {
                                            const ext = a.split('.').pop().toLowerCase();
                                            return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                          }).map(a => `${BACKEND_URL}/uploads/tickets/${a}`);
                                          openImages(imageAttachments, imageAttachments.map(a => a.split('/').pop()).indexOf(att));
                                        }} />
                                    ) : (
                                      <a key={idx} href={src} download
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
                        </>
                      )}
                      
                      {/* Engineer Remarks and Attachments */}
                      {hasEngineerData && (
                        <>
                          <label className="block text-lg font-bold text-gray-900 mb-3">Engineer Remarks</label>
                          <div className="px-5 py-4 bg-purple-50 border-2 border-purple-200 rounded-lg text-lg text-gray-900 min-h-[80px] font-medium">{selectedTicket.engineer_remarks || '-'}</div>
                          
                          {/* Engineer Attachments */}
                          {selectedTicket.engineer_attachments && (() => {
                            const engineerAttachments = parseJSON(selectedTicket.engineer_attachments);
                            return engineerAttachments.length > 0 ? (
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Engineer Attachments ({engineerAttachments.length})</label>
                                <div className="flex flex-wrap gap-2">
                                  {engineerAttachments.map((att, idx) => {
                                    const fileExt = att.split('.').pop().toLowerCase();
                                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                                    const src = `${BACKEND_URL}/uploads/tickets/${att}`;
                                    return isImage ? (
                                      <img key={idx} src={src} alt={`engineer-att-${idx}`}
                                        className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                        onClick={() => {
                                          const imageAttachments = engineerAttachments.filter(a => {
                                            const ext = a.split('.').pop().toLowerCase();
                                            return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
                                          }).map(a => `${BACKEND_URL}/uploads/tickets/${a}`);
                                          openImages(imageAttachments, imageAttachments.map(a => a.split('/').pop()).indexOf(att));
                                        }} />
                                    ) : (
                                      <a key={idx} href={src} download
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

      {/* Edit Status Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedTicket(null); }} title="Update Status" size="lg">
        {(() => {
          const effectiveStatus = selectedTicket?.vendor_status || selectedTicket?.engineer_status || selectedTicket?.status;
          const isAlreadyCompleted = effectiveStatus === 'Completed';
          const missingOfflineDevice = !selectedTicket?.offline || !selectedTicket?.device;
          const offlineOnlyMode = isAlreadyCompleted && missingOfflineDevice;
          return (
        <div className="space-y-4">
          {offlineOnlyMode && (
            <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
              This ticket is completed. Please fill in the missing <span className="font-semibold">Offline</span> and <span className="font-semibold">Device</span> fields.
            </div>
          )}
          {!offlineOnlyMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
            <MobileSelect
              label="Select Status"
              value={editForm.status}
              onChange={val => setEditForm({ ...editForm, status: val })}
              options={[
                { value: 'Pending', label: 'Pending' },
                { value: 'In Progress', label: 'In Progress' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Duplicate', label: 'Duplicate' },
                { value: 'Ticket by mistake', label: 'Ticket by mistake' }
              ]}
              placeholder="Select Status"
            />
          </div>
          )}
          {selectedTicket?.offline && selectedTicket?.device ? (
            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Offline &amp; Device already set by admin: <span className="font-medium">{selectedTicket.offline}</span> / <span className="font-medium">{selectedTicket.device}</span>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Offline <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {['Internet', 'Power'].map(opt => (
                    <button key={opt} type="button" onClick={() => setEditForm(p => ({ ...p, offline: p.offline === opt ? '' : opt }))}
                      className={`px-4 py-2 text-sm font-medium border-2 rounded-lg transition-colors ${
                        editForm.offline === opt ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-300 bg-white text-orange-600 hover:bg-orange-50'
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Device <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {['Hardware', 'Software'].map(opt => (
                    <button key={opt} type="button" onClick={() => setEditForm(p => ({ ...p, device: p.device === opt ? '' : opt }))}
                      className={`px-4 py-2 text-sm font-medium border-2 rounded-lg transition-colors ${
                        editForm.device === opt ? 'border-teal-500 bg-teal-500 text-white' : 'border-teal-300 bg-white text-teal-600 hover:bg-teal-50'
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
            <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files); }}
              onClick={() => document.getElementById('edit-file').click()}>
              {editForm.attachments.length > 0 ? (
                <div className="flex gap-2 flex-wrap justify-center">
                  {editForm.attachments.map((file, i) => (
                    <div key={i} className="relative">
                      {file.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(file)} alt={`p-${i}`} className="w-16 h-16 object-cover rounded border" />
                      ) : (
                        <div className="w-16 h-16 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 p-1">
                          <span className="truncate w-full text-center">{file.name.split('.').pop().toUpperCase()}</span>
                        </div>
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">Drag & drop files here, or click to browse</p>
                </div>
              )}
              <input id="edit-file" type="file" multiple className="hidden"
                onChange={e => handleFileSelect(e.target.files)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
            <textarea value={editForm.remarks} onChange={e => setEditForm({ ...editForm, remarks: e.target.value })}
              rows="4" placeholder="Enter remarks..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button onClick={() => { setIsEditModalOpen(false); setSelectedTicket(null); }}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleEditSubmit} disabled={!offlineOnlyMode && !editForm.status}
              className="px-6 py-2 text-sm font-medium text-white bg-btn-primary rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
              Update
            </button>
          </div>
        </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default ComplianceUserDashboard;
