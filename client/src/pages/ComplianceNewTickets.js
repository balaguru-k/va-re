import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, EyeIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import Modal from '../components/UI/Modal';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sortTickets } from '../utils/ticketSort';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const ComplianceNewTickets = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isViewer = user?.role === 'Viewer';
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchTickets();
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

  const fetchTickets = () => {
    setLoading(true);
    api.get('/compliance/dashboard')
      .then(res => {
        const allTickets = res.data.data?.tickets || [];
        // Filter for new tickets using effective status logic
        const newTickets = allTickets.filter(t => {
          // If vendor or engineer has updated status, use their status
          const effectiveStatus = t.vendor_status || t.engineer_status || t.status;
          return effectiveStatus === 'New' || (!effectiveStatus && !t.vendor_status && !t.engineer_status);
        });
        setTickets(newTickets);
      })
      .catch(() => console.error('Failed to load tickets'))
      .finally(() => setLoading(false));
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
    navigate(`/compliance/ticket/${ticket.id}/edit`);
  };

  const filtered = tickets.filter(t => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match = (t.ticket_number || '').toLowerCase().includes(q) ||
        (t.user_name || '').toLowerCase().includes(q) ||
        (t.issue || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q) ||
        (t.division || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (fromDate || toDate) {
      const ticketDate = new Date(t.created_at).toISOString().split('T')[0];
      if (fromDate && ticketDate < fromDate) return false;
      if (toDate && ticketDate > toDate) return false;
    }
    return true;
  });

  const sorted = sortTickets(filtered, sortKey, sortDir);
  const paginated = itemsPerPage === 'all' ? sorted : sorted.slice(0, itemsPerPage);

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

      <PageHeader title="New Tickets">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
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
            onClick={() => navigate('/compliance/dashboard')}
            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </PageHeader>

      <div className="bg-white border border-red-100 rounded-lg flex flex-col flex-1 min-h-0">
        <div className="overflow-auto scroll-container flex-1 min-h-0">
          <table style={{ minWidth: '1400px' }} className="w-full">
            <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('ticket_number')}>Ticket Number<SortIcon col="ticket_number" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('user_name')}>Created By<SortIcon col="user_name" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('category')}>Division<SortIcon col="category" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('location')}>Location<SortIcon col="location" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('issue')}>Issue<SortIcon col="issue" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('admin_aging')}>Admin Aging<SortIcon col="admin_aging" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('vendor_aging')}>Vendor Aging<SortIcon col="vendor_aging" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('engineer_aging')}>Engineer Aging<SortIcon col="engineer_aging" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('interested_party_names')}>Interested Party<SortIcon col="interested_party_names" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('status')}>Status<SortIcon col="status" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 z-10 cursor-pointer select-none" style={{ backgroundColor: '#ededed' }} onClick={() => handleSort('created_at')}>Created On<SortIcon col="created_at" /></th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700 sticky top-0 right-0 z-30" style={{ backgroundColor: '#ededed' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="13" className="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan="13" className="px-4 py-6 text-center text-gray-500">No new tickets found</td></tr>
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
                      <td className="px-4 py-3 text-sm text-gray-900">{ticket.issue}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.admin_aging !== null ? `${ticket.admin_aging} days` : '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.vendor_aging !== null ? `${ticket.vendor_aging} days` : '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.engineer_aging !== null ? `${ticket.engineer_aging} days` : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ticket.interested_party_names || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                          {ticket.status || 'New'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(ticket.created_at)}</td>
                      <td className="px-4 py-3 sticky right-0 z-10" style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleView(ticket)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="View">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          {!isViewer && <button 
                            onClick={() => {
                              const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                              const isCompleted = effectiveStatus === 'Completed';
                              if (!isCompleted) {
                                handleEdit(ticket);
                              }
                            }} 
                            className={`p-1 rounded transition-colors ${
                              (() => {
                                const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                                const isCompleted = effectiveStatus === 'Completed';
                                return isCompleted 
                                  ? 'text-gray-300 cursor-not-allowed' 
                                  : 'text-gray-400 hover:text-red-600';
                              })()
                            }`} 
                            title={(() => {
                              const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                              const isCompleted = effectiveStatus === 'Completed';
                              return isCompleted ? 'Cannot edit completed ticket' : 'Edit';
                            })()
                            }
                            disabled={(() => {
                              const effectiveStatus = ticket.vendor_status || ticket.engineer_status || ticket.status;
                              return effectiveStatus === 'Completed';
                            })()}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>}
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
            {[50, 100, 'all'].map(val => (
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auditor</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Camera Count</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.checklist_camera_count || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Camera Count</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.camera_count || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.issue}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {(() => {
                      // Check if ticket was created by compliance admin (no assigned vendors/engineers)
                      const isAdminCreated = !selectedTicket.assigned_vendors && !selectedTicket.assigned_engineers;
                      return isAdminCreated ? 'Admin Ticket Remarks' : 'Auditor Remarks';
                    })()
                    }
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">{selectedTicket.remarks || '-'}</div>
                </div>
              </div>
              {attachments.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {(() => {
                      // Check if ticket was created by compliance admin (no assigned vendors/engineers)
                      const isAdminCreated = !selectedTicket.assigned_vendors && !selectedTicket.assigned_engineers;
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
    </div>
  );
};

export default ComplianceNewTickets;