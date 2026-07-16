import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintAPI } from '../../services/api';
import PageHeader from '../../components/UI/PageHeader';
import { formatDate } from '../../utils/dateFormatter';
import { CheckCircleIcon, EyeIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Modal from '../../components/UI/Modal';
import Swal from 'sweetalert2';

const ComplaintsList = () => {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, [activeTab]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const response = await complaintAPI.getComplaints({ status: activeTab });
      setComplaints(response.data.data.complaints || []);
    } catch (error) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (id) => {
    const result = await Swal.fire({
      title: 'Complete Complaint',
      text: 'Mark this complaint as completed?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981', // green-500
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Complete',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      await complaintAPI.completeComplaint(id);
      toast.success('Complaint completed successfully');
      fetchComplaints();
    } catch (error) {
      toast.error('Failed to complete complaint');
    }
  };

  const handleView = (complaint) => {
    setSelectedComplaint(complaint);
    setIsViewModalOpen(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Complaint',
      text: 'Are you sure you want to delete this complaint? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626', // red-600
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      await complaintAPI.deleteComplaint(id);
      toast.success('Complaint deleted successfully');
      fetchComplaints();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete complaint');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Completed': 'bg-green-100 text-green-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Complaints Inbox">
        <button
          onClick={() => navigate('/complaints/camera')}
          className="flex items-center space-x-2 px-4 py-2 bg-[#C50B34] text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          <span>New Complaint</span>
        </button>
      </PageHeader>

      <div className="bg-white border border-red-100 rounded-lg overflow-hidden shadow-sm">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {['Pending', 'Completed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-sm font-medium transition-all duration-200 border-b-2 ${
                activeTab === tab 
                  ? 'border-red-600 text-red-600 bg-red-50' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#efeeee] border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">TKT No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Issues</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Reporter</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">Loading complaints...</td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">No complaints found</td>
                </tr>
              ) : (
                complaints.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.ticket_no}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.location_name}
                      {item.department_name && <span className="block text-xs text-gray-400">{item.department_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {item.issue.split(',').map((iss, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-[10px] rounded border border-gray-200">{iss.trim()}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.reporter_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleView(item)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        {item.status === 'Pending' && (
                          <button
                            onClick={() => handleComplete(item.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Mark Complete"
                          >
                            <CheckCircleIcon className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete Complaint"
                        >
                          <TrashIcon className="w-5 h-5" />
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

      {/* View Complaint Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedComplaint(null);
        }}
        title={`Complaint Details - ${selectedComplaint?.ticket_no}`}
        size="lg"
      >
        {selectedComplaint && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Ticket Number</label>
                <p className="mt-1 text-sm font-medium text-gray-900">{selectedComplaint.ticket_no}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Status</label>
                <div className="mt-1">{getStatusBadge(selectedComplaint.status)}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Date Logged</label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(selectedComplaint.created_at)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Reporter</label>
                <p className="mt-1 text-sm text-gray-900">{selectedComplaint.reporter_name}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Location</label>
                <p className="mt-1 text-sm text-gray-900">{selectedComplaint.location_name}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Department</label>
                <p className="mt-1 text-sm text-gray-900">{selectedComplaint.department_name || 'N/A'}</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase">Issues</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedComplaint.issue.split(',').map((iss, i) => (
                  <span key={i} className="px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-md border border-red-100 italic">
                    {iss.trim()}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase">Remarks</label>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap min-h-[80px]">
                {selectedComplaint.remarks || 'No remarks provided.'}
              </div>
            </div>

            {selectedComplaint.attachment && (
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-3">Attachment</label>
                <div className="relative group overflow-hidden rounded-lg border border-gray-200">
                  <img 
                    src={`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${selectedComplaint.attachment}`} 
                    alt="Attachment" 
                    className="w-full h-auto max-h-[300px] object-contain bg-white"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center">
                    <a 
                      href={`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${selectedComplaint.attachment}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 bg-white text-blue-600 px-4 py-2 rounded-md shadow-lg font-medium transition-opacity"
                    >
                      View Full Size
                    </a>
                  </div>
                </div>
              </div>
            )}
            
            {selectedComplaint.status === 'Completed' && (
              <div className="border-t border-gray-100 pt-4 bg-green-50 p-4 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-semibold text-green-800">Completed By:</span>
                    <span className="ml-2 text-green-700">{selectedComplaint.completed_by_name}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-green-800">Date:</span>
                    <span className="ml-2 text-green-700">{formatDate(selectedComplaint.completed_at)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 mt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedComplaint(null);
                }}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ComplaintsList;
