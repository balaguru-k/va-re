import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownTrayIcon, XMarkIcon, EyeIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { qcAPI } from '../services/api';
import { buildImageUrl } from '../utils/checklistUtils';

const LeadAuditorFormData = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [editModal, setEditModal] = useState({ show: false, submissionId: null, items: [], saving: false });

  const filteredSubmissions = submissions.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.checklist_name || '').toLowerCase().includes(term) ||
      (item.auditor_name || '').toLowerCase().includes(term) ||
      (item.emp_id || '').toLowerCase().includes(term) ||
      (item.location || '').toLowerCase().includes(term) ||
      (item.submitted_by_name || '').toLowerCase().includes(term)
    );
  });

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateRange.from && dateRange.to) {
        params.fromDate = dateRange.from;
        params.toDate = dateRange.to;
      }
      const response = await qcAPI.getSubmissions(params);
      setSubmissions(response.data.submissions || []);
    } catch (error) {
      toast.error('Failed to fetch submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleFilter = () => {
    fetchSubmissions();
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleExport = async () => {
    if (submissions.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      toast.loading('Generating Excel...');
      const params = {};
      if (dateRange.from && dateRange.to) {
        params.fromDate = dateRange.from;
        params.toDate = dateRange.to;
      }
      const response = await qcAPI.exportExcel(params);
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `QC_Form_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success('Excel exported successfully');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export Excel');
    }
  };

  const openEditModal = async (submissionId) => {
    try {
      const response = await qcAPI.getSubmissionEditData(submissionId);
      const items = (response.data.items || []).map(item => ({
        qc_submission_item_id: item.qc_submission_item_id,
        checklist_item_id: item.checklist_item_id,
        activities: item.activities || '',
        process: item.process || '',
        criticality: item.criticality || '',
        item_status: item.item_status || '',
        reason: item.reason || '',
        item_images: item.item_images || '',
        qc_update: item.qc_update || '',
        remark: item.remark || '',
        images: item.images || null,
        auditor_qc_remark: item.auditor_qc_remark || '',
        qc_final_remark: item.qc_final_remark || ''
      }));
      setEditModal({ show: true, submissionId, items, saving: false });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load submission details');
    }
  };

  const handleEditItemChange = (qcItemId, field, value) => {
    setEditModal(prev => ({
      ...prev,
      items: prev.items.map(item => item.qc_submission_item_id === qcItemId ? { ...item, [field]: value } : item)
    }));
  };

  const handleEditSave = async () => {
    setEditModal(prev => ({ ...prev, saving: true }));
    try {
      const payload = {
        items: editModal.items.map(item => ({
          qc_submission_item_id: item.qc_submission_item_id,
          qc_update: item.qc_update,
          remark: item.remark,
          auditor_qc_remark: item.auditor_qc_remark,
          qc_final_remark: item.qc_final_remark
        }))
      };
      await qcAPI.updateSubmission(editModal.submissionId, payload);
      toast.success('Submission updated successfully');
      setEditModal({ show: false, submissionId: null, items: [], saving: false });
      fetchSubmissions();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update submission');
    } finally {
      setEditModal(prev => ({ ...prev, saving: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">QC Form Data</h1>
        <button onClick={handleExport} disabled={submissions.length === 0} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50" style={{ background: '#C50B34' }}>
          <ArrowDownTrayIcon className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-red-100 rounded-lg">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">Filters</h2>
        </div>
        <div className="p-4 flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input type="date" value={dateRange.from} onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input type="date" value={dateRange.to} onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-red-500" />
          </div>
          <button onClick={handleFilter} className="px-4 py-2 text-sm font-medium text-white rounded-md" style={{ background: '#C50B34' }}>
            Apply
          </button>
          <button onClick={() => { setDateRange({ from: '', to: '' }); setSearchTerm(''); setTimeout(fetchSubmissions, 0); }} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            Reset
          </button>
          <div className="ml-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name, auditor, location..." className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-red-500 w-64" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-red-100 rounded-lg">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">Submissions</h2>
          <span className="text-xs text-gray-500">{filteredSubmissions.length} record(s)</span>
        </div>
        <div className="overflow-auto" style={{ maxHeight: '600px' }}>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No submissions found</div>
          ) : (
            <table className="min-w-full">
              <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">S.No</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Video Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Checklist Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Auditor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Emp ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Camera</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">NC Count</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">QC Items</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Submitted By</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Submitted At</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubmissions.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(item.video_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.checklist_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.auditor_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.emp_id || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.location || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.camera_audited || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.nc_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.qc_filled_items || 0}/{item.total_items || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.submitted_by_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/lead-auditor/form-data/${item.id}`)}
                          className="text-blue-600 hover:text-blue-800" title="View"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {!item.is_edited && (
                          <button
                            onClick={() => openEditModal(item.id)}
                            className="text-orange-600 hover:text-orange-800" title="Edit"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setEditModal({ show: false, submissionId: null, items: [], saving: false })}>
          <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit QC Submission</h3>
              <button onClick={() => setEditModal({ show: false, submissionId: null, items: [], saving: false })} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="min-w-full">
                <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Activities</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '120px' }}>Process</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '90px' }}>Criticality</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '70px' }}>Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '140px' }}>Reason</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '100px' }}>Auditor Images</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '140px' }}>QC Update</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '200px' }}>Remark</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '100px' }}>QC Images</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '160px' }}>Auditor QC Remark</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '160px' }}>Final QC Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editModal.items.map((item, idx) => {
                    const auditorImages = item.item_images ? (item.item_images.startsWith('[') ? JSON.parse(item.item_images) : item.item_images.split(',').filter(i => i.trim())) : [];
                    const qcImages = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : [];
                    return (
                      <tr key={item.qc_submission_item_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.activities || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.process || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.criticality === 'High' ? 'bg-red-100 text-red-800' : item.criticality === 'Low' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                            {item.criticality || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.item_status || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.reason || '-'}</td>
                        <td className="px-4 py-3">
                          {auditorImages.length > 0 ? (
                            <div className="flex gap-1">
                              {auditorImages.slice(0, 2).map((img, i) => (
                                <a key={i} href={buildImageUrl(img)} target="_blank" rel="noopener noreferrer">
                                  <img src={buildImageUrl(img)} alt="" className="w-10 h-10 object-cover rounded border hover:opacity-75" />
                                </a>
                              ))}
                              {auditorImages.length > 2 && <span className="text-xs text-gray-500 self-center">+{auditorImages.length - 2}</span>}
                            </div>
                          ) : <span className="text-sm text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={item.qc_update}
                            onChange={e => handleEditItemChange(item.qc_submission_item_id, 'qc_update', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            <option value="">Select</option>
                            <option value="Missed">Missed</option>
                            <option value="Wrong">Wrong</option>
                            <option value="Invalid">Invalid</option>
                            <option value="Others">Others</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.remark}
                            onChange={e => handleEditItemChange(item.qc_submission_item_id, 'remark', e.target.value)}
                            placeholder="Enter remark"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {qcImages.length > 0 ? (
                            <div className="flex gap-1">
                              {qcImages.slice(0, 2).map((img, i) => (
                                <a key={i} href={`${process.env.REACT_APP_BACKEND_URL}/uploads/qc-images/${img}`} target="_blank" rel="noopener noreferrer">
                                  <img src={`${process.env.REACT_APP_BACKEND_URL}/uploads/qc-images/${img}`} alt="" className="w-10 h-10 object-cover rounded border hover:opacity-75" />
                                </a>
                              ))}
                              {qcImages.length > 2 && <span className="text-xs text-gray-500 self-center">+{qcImages.length - 2}</span>}
                            </div>
                          ) : <span className="text-sm text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.auditor_qc_remark}
                            onChange={e => handleEditItemChange(item.qc_submission_item_id, 'auditor_qc_remark', e.target.value)}
                            placeholder="Enter auditor remark"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.qc_final_remark}
                            onChange={e => handleEditItemChange(item.qc_submission_item_id, 'qc_final_remark', e.target.value)}
                            placeholder="Enter final remark"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setEditModal({ show: false, submissionId: null, items: [], saving: false })} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={editModal.saving} className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50" style={{ background: '#C50B34' }}>
                {editModal.saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadAuditorFormData;
