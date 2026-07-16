import React, { useState, useEffect, useRef } from 'react';
import { CalendarIcon, EnvelopeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { rosterAPI } from '../services/api';
import Table from '../components/UI/Table';
import SearchBar from '../components/UI/SearchBar';
import PageHeader from '../components/UI/PageHeader';
import useApi from '../hooks/useApi';
import { formatDate } from '../utils/dateFormatter';
import showToast from '../utils/toast';
import SearchableSelect from '../components/SearchableSelect';
import axios from 'axios';

const Roster = () => {
  const [rosters, setRosters] = useState([]); 
  const [users, setUsers] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const searchTimer = useRef(null);

  const { loading, execute } = useApi();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({ to: '', cc: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const token = localStorage.getItem('token');

  const totalPages = pagination.totalPages;
  const startIndex = (currentPage - 1) * itemsPerPage;

  const handleItemsPerPageChange = (size) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  };

  const getPageSizeOptions = () => {
    const total = pagination.total || 0;
    if (total <= 100) return [25, 50, 100];
    if (total <= 250) return [50, 100, 250];
    return [100, 250, 500];
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchRosters();
  }, [selectedDate, currentPage, itemsPerPage]);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setCurrentPage(1);
      fetchRosters();
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchTerm]);

  const fetchInitialData = async () => {
    await execute(
      () => rosterAPI.getUsers(),
      {
        onSuccess: (usersRes) => {
          setUsers(usersRes.data.users || {});
        },
        errorMessage: 'Failed to load users',
        showLoading: false
      }
    );
  };

  const fetchRosters = async () => {
    await execute(
      () => rosterAPI.getRosters({ date: selectedDate, page: currentPage, limit: itemsPerPage, search: searchTerm || undefined }),
      {
        onSuccess: (response) => {
          setRosters(response.data.rosters || []);
          setPagination(response.data.pagination || { total: 0, totalPages: 0 });
        },
        errorMessage: 'Failed to load rosters'
      }
    );
  };

  const handleAuditorAssign = async (checklistId, rosterId, auditorId) => {
    const today = new Date().toISOString().split('T')[0];

    await execute(
      () => rosterAPI.manualAssign({
        checklist_id: checklistId,
        roster_id: rosterId || null,
        auditor_id: auditorId || null,
        assigned_date: today
      }),
      {
        onSuccess: (response) => {
          if (auditorId) {
            if (response.data.auto_assigned) {
              showToast('success', `Auditor assigned! Auto-assigned: Manager: ${response.data.auto_assigned.manager}, Supervisor: ${response.data.auto_assigned.supervisor}`);
            } else {
              showToast('success', 'Auditor assigned successfully');
            }
          } else {
            showToast('success', 'Auditor assignment removed successfully');
          }
          fetchRosters();
        },
        errorMessage: auditorId ? 'Failed to assign auditor' : 'Failed to remove auditor assignment',
        showLoading: false
      }
    );
  };

  const handleManagerAssign = async (rosterId, managerId) => {
    if (!managerId) return;

    await execute(
      () => rosterAPI.manualAssign({
        roster_id: rosterId,
        manager_id: managerId,
        assigned_date: selectedDate
      }),
      {
        onSuccess: () => fetchRosters(),
        successMessage: 'Manager assigned successfully',
        errorMessage: 'Failed to assign manager',
        showLoading: false
      }
    );
  };

  const handleSupervisorAssign = async (rosterId, supervisorId) => {
    if (!supervisorId) return;

    await execute(
      () => rosterAPI.manualAssign({
        roster_id: rosterId,
        supervisor_id: supervisorId,
        assigned_date: selectedDate
      }),
      {
        onSuccess: () => fetchRosters(),
        successMessage: 'Supervisor assigned successfully',
        errorMessage: 'Failed to assign supervisor',
        showLoading: false
      }
    );
  };


  const handleOpenEmailModal = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/rosters/admin/email-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmailData({ to: response.data.to || '', cc: response.data.cc || '' });
    } catch (error) {
      setEmailData({ to: '', cc: '' });
    }
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/rosters/admin/send-email`, {
        to: emailData.to,
        cc: emailData.cc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('success', 'Email queued successfully');
      setShowEmailModal(false);
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadRoster = () => {
    // Prepare CSV data
    const headers = ['Checklist Name', 'Location', 'Name', 'Department', 'Auditor', 'Date'];
    const csvRows = [headers.join(',')];

    rosters.forEach(roster => {
      const auditor = roster.auditor_id ?
        (users.auditors || []).find(u => u.id === roster.auditor_id) : null;

      const row = [
        `"${roster.checklist_name || '-'}"`,
        `"${roster.location_name || '-'}"`,
        `"${roster.facility_name || '-'}"`,
        `"${roster.department_name || '-'}"`,
        `"${auditor?.username || 'Unassigned'}"`,
        `"${formatDate(new Date(selectedDate))}"`
      ];
      csvRows.push(row.join(','));
    });

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `roster_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('success', 'Roster downloaded successfully');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3">
      <PageHeader title="Roster Management">
        <div className="flex items-center space-x-4">
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by checklist, location, department or auditor..."
          />
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="input-field"
            />
          </div>
          <button
            onClick={handleDownloadRoster}
            disabled={rosters.length === 0}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-btn-primary hover:opacity-90 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Download</span>
          </button>
          <button
            onClick={handleOpenEmailModal}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center space-x-2"
            style={{ background: '#C50B34' }}
          >
            <EnvelopeIcon className="w-4 h-4" />
            <span>Email</span>
          </button>

        </div>
      </PageHeader>

      <div className="bg-white border border-red-100 rounded-lg flex flex-col flex-1 min-h-0">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">
              Checklist Assignments for {formatDate(new Date(selectedDate))}
            </h2>
            <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
              {pagination.total} {pagination.total === 1 ? 'Checklist' : 'Checklists'}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-auto scroll-container flex-1 min-h-0">
            <table className="min-w-full">
              <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Checklist</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Location</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Department</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Auditor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rosters.map((roster, index) => {
                  return (
                    <tr key={roster.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {roster.checklist_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {roster.location_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {roster.facility_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {roster.department_name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">
                          {(users.auditors || []).find(u => u.id === roster.auditor_id)?.username || <span className="text-gray-400 italic">Unassigned</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span>Show:</span>
            {getPageSizeOptions().map(size => (
              <button
                key={size}
                onClick={() => handleItemsPerPageChange(size)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  itemsPerPage === size
                    ? 'bg-btn-primary text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {size}
              </button>
            ))}
            <button
              onClick={() => handleItemsPerPageChange(pagination.total || 9999)}
              className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                itemsPerPage >= (pagination.total || 9999)
                  ? 'bg-btn-primary text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
              }`}
            >
              All
            </button>
          </div>
          <div className="text-gray-600">
            <span className="font-medium">{pagination.total > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + itemsPerPage, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      </div>



      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Send Roster Report</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <textarea
                  value={emailData.to}
                  onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                  placeholder="user1@example.com, user2@example.com"
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CC</label>
                <textarea
                  value={emailData.cc}
                  onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
                  placeholder="cc1@example.com, cc2@example.com"
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!emailData.to || sendingEmail}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 flex items-center space-x-1 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#C50B34' }}
              >
                {sendingEmail ? 'Sending...' : 'Send Mail'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roster;