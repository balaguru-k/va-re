import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { qcAPI } from '../services/api';

const AuditorQcForm = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateRange.from && dateRange.to) {
        params.fromDate = dateRange.from;
        params.toDate = dateRange.to;
      }
      const response = await qcAPI.getAuditorSubmissions(params);
      setSubmissions(response.data.submissions || []);
    } catch (error) {
      toast.error('Failed to fetch QC submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubmissions(); }, []);

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">QC Form</h1>

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
          <button onClick={fetchSubmissions} className="px-4 py-2 text-sm font-medium text-white rounded-md" style={{ background: '#C50B34' }}>Apply</button>
          <button onClick={() => { setDateRange({ from: '', to: '' }); setTimeout(fetchSubmissions, 0); }} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Reset</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-red-100 rounded-lg">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">QC Submissions</h2>
          <span className="text-xs text-gray-500">{submissions.length} record(s)</span>
        </div>
        <div className="overflow-auto" style={{ maxHeight: '600px' }}>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No QC submissions found</div>
          ) : (
            <table className="min-w-full">
              <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">S.No</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Video Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Checklist Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">NC Count</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">QC Items</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Remarks Filled</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Submitted By</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(item.video_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.checklist_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.location || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.nc_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.total_items || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.remarks_filled || 0}/{item.total_items || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.submitted_by_name || '-'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/auditor/qc-form/${item.id}`)} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                        View & Remark
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditorQcForm;
