import React, { useState, useEffect } from 'react';
import { CalendarIcon, PencilIcon, TrashIcon, PlusIcon, EnvelopeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Modal from '../components/UI/Modal';
import PageHeader from '../components/UI/PageHeader';
import Swal from 'sweetalert2';
import { checklistAPI, rosterAPI } from '../services/api';
import showToast from '../utils/toast';
import axios from 'axios';

const AdminRoster = () => {
  const [data, setData] = useState({ users: [], checklists: [], date: '' });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState({ open: false, assignment: null });
  const [users, setUsers] = useState({});
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({ to: '', cc: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAdminRoster();
    fetchUsers();
  }, [selectedDate]);

  const fetchUsers = async () => {
    try {
      const response = await rosterAPI.getUsers();
      setUsers(response.data.users || {});
    } catch (error) {
      // Failed to fetch users
    }
  };

  const fetchAdminRoster = async () => {
    try {
      setLoading(true);
      const response = await rosterAPI.getAdminRoster({ date: selectedDate });
      setData(response.data.data || { users: [], checklists: [], date: selectedDate });
    } catch (error) {
      if (error.response?.status === 403) {
       showToast('error', 'Access denied: Insufficient permissions');
      } else {
        showToast('error', 'Failed to load roster data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (assignment) => {
    setEditModal({ open: true, assignment: { ...assignment } });
  };

  const handleUpdate = async () => {
    try {
      // Handle unselect case
      if (editModal.assignment.auditor_id === 'unselect') {
        await rosterAPI.updateRoster(editModal.assignment.id, {
          auditor_id: null
        });
        showToast('success','User unassigned successfully');
        setEditModal({ open: false, assignment: null });
        fetchAdminRoster();
        return;
      }
      
      const response = await rosterAPI.updateRoster(editModal.assignment.id, {
        auditor_id: editModal.assignment.auditor_id
      });
      
      if (response.data.autoAssigned) {
        showToast('success', 'Assignment updated successfully');
      } else {
        showToast('success', 'Assignment updated successfully');
      }
      
      setEditModal({ open: false, assignment: null });
      fetchAdminRoster();
    } catch (error) {
      showToast('error', 'Failed to update assignment');
    }
  };

  const handleDelete = async (assignmentId) => {
    const result = await Swal.fire({
      title: 'Delete Assignment',
      text: 'Are you sure you want to delete this assignment? This action cannot be undone.',
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
      await rosterAPI.deleteRoster(assignmentId);
      
      showToast('success', 'Assignment deleted successfully');
      fetchAdminRoster();
    } catch (error) {
      showToast('error', 'Failed to delete assignment');
    }
  };

  const updateEditAssignment = (field, value) => {
    setEditModal(prev => ({
      ...prev,
      assignment: { ...prev.assignment, [field]: value }
    }));
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

  // Flatten all assignments for card view
  const allAssignments = (data?.users || []).reduce((acc, user) => {
    user.assignments.forEach(assignment => {
      acc.push({ ...assignment, user_info: user });
    });
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title="Admin Roster">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleOpenEmailModal}
            className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
            style={{ background: '#C50B34' }}
          >
            <EnvelopeIcon className="w-4 h-4" />
            <span>Email</span>
          </button>
          <p className="text-sm text-gray-500">{allAssignments.length} total assignments</p>
          {/* <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border">
            <CalendarIcon className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-0 focus:ring-0 text-sm"
            />
          </div> */}
        </div>
      </PageHeader>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white border border-red-100 rounded-lg">
          <div className="overflow-x-auto">
            {allAssignments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No assignments found</div>
            ) : (
              <table className="min-w-full">
                <thead style={{backgroundColor: '#ededed'}} className="border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Checklist</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Location</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Auditor</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Supervisors</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Managers</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allAssignments.map((assignment, idx) => (
                    <tr key={`${assignment.id}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{assignment.checklist_name}</div>
                        {assignment.facility_name && (
                          <div className="text-xs text-gray-500">{assignment.facility_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{assignment.location_name || '-'}</div>
                        {assignment.department_name && (
                          <div className="text-xs text-gray-500">{assignment.department_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{assignment.auditor_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{assignment.supervisor_names || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{assignment.manager_names || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEdit(assignment)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
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
                            onClick={() => handleDelete(assignment.id)}
                            className="p-1 text-gray-600 hover:text-red-600 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

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

      {/* Edit Modal */}
      <Modal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, assignment: null })}
        title="Edit Roster Assignment"
        size="xl"
      >
        {editModal.assignment && (
          <div className="space-y-5">
            {/* Checklist Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">{editModal.assignment.checklist_name}</h4>
              <div className="text-sm text-gray-600">
                {editModal.assignment.location_name && <div>Location: {editModal.assignment.location_name}</div>}
                {editModal.assignment.facility_name && <div>Facility: {editModal.assignment.facility_name}</div>}
                {editModal.assignment.department_name && <div>Department: {editModal.assignment.department_name}</div>}
              </div>
            </div>

            {/* User Assignments */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auditor *</label>
                <select
                  value={String(editModal.assignment.auditor_id || '')}
                  onChange={(e) => updateEditAssignment('auditor_id', e.target.value)}
                  className="input-field w-full"
                  style={{maxHeight: '8rem', overflowY: 'auto'}}
                >
                  <option value="">Select Auditor</option>
                  <option value="unselect" style={{color: 'red', fontWeight: 'bold'}}>Unselect Auditor</option>
                  {(users.auditors || []).map(user => (
                    <option key={user.id} value={String(user.id)}>
                      {user.username}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Supervisor and Manager will be auto-assigned in background for checklist workflow
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
              <button
                onClick={() => setEditModal({ open: false, assignment: null })}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={!editModal.assignment.auditor_id || editModal.assignment.auditor_id === ''}
                className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminRoster;