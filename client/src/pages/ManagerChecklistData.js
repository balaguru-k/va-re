import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checklistAPI } from '../services/api';
import { PlayIcon, CalendarIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/UI/PageHeader';
import { formatDate } from '../utils/dateFormatter';

const ManagerChecklistData = () => {
  const navigate = useNavigate();
  const [checklistsData, setChecklistsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    fetchChecklistsData();
  }, [fromDate, toDate]);

  const fetchChecklistsData = async () => {
    try {
      setLoading(true);
      const response = await checklistAPI.getManagerChecklistsData(fromDate, toDate);
      setChecklistsData(response.data.data || []);
    } catch (error) {
      setError('Failed to fetch checklists data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      'Completed': 'bg-green-100 text-green-800',
      'Completed without NCs': 'bg-green-100 text-green-800',
      'Awaiting for NC response': 'bg-yellow-100 text-yellow-800',
      'Waiting NC Response': 'bg-yellow-100 text-yellow-800',
      'Manager Review': 'bg-purple-100 text-purple-800',
      'Active': 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manager Checklists">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-5 h-5 text-gray-500" />
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className="input-field"
          />
          <span className="text-gray-500 text-sm">to</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="input-field"
          />
        </div>
      </PageHeader>

      <div className="bg-white border border-purple-100 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">S.No</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Checklist Date</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Checklist Name</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Checklist Type</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Department</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Location</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                {/* <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Date Created</th> */}
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {checklistsData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-6 text-center text-gray-500">
                    No checklist found
                  </td>
                </tr>
              ) : (
                checklistsData.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.sno}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.checklist_date}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.checklist_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.checklist_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.department}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.division}</td>
                    <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                    {/* <td className="px-4 py-3 text-sm text-gray-900">{item.date_created}</td> */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/manager-checklist/${item.id}/view`)}
                        className="p-1 text-gray-400 hover:text-purple-600 rounded flex items-center"
                      >
                        <PlayIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagerChecklistData;