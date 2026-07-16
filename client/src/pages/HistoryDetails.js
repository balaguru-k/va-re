import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { checklistAPI } from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import useApi from '../hooks/useApi';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const HistoryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState(null);
  const { loading, execute } = useApi();

  useEffect(() => {
    fetchChecklistDetails();
  }, [id]);

  const fetchChecklistDetails = async () => {
    await execute(
      () => checklistAPI.getDeletedChecklistById(id),
      {
        onSuccess: (response) => {
          setChecklist(response.data);
        },
        errorMessage: 'Failed to fetch checklist details'
      }
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Checklist Details" />
        <div className="text-center py-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="space-y-6">
        <PageHeader title="Checklist Details" />
        <div className="text-center py-8">
          <div className="text-gray-500">Checklist not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/history')}
          className="text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
        <PageHeader title="Deleted Checklist Details" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500">Checklist Name</p>
            <p className="text-base text-gray-900 mt-1">{checklist.checklist_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Category</p>
            <p className="text-base text-gray-900 mt-1">{checklist.category_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Location</p>
            <p className="text-base text-gray-900 mt-1">{checklist.location_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Department</p>
            <p className="text-base text-gray-900 mt-1">{checklist.department_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Facility</p>
            <p className="text-base text-gray-900 mt-1">{checklist.facility_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Deleted At</p>
            <p className="text-base text-gray-900 mt-1">{new Date(checklist.deleted_at).toLocaleString()}</p>
          </div>
        </div>

        {checklist.items && checklist.items.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Checklist Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead style={{backgroundColor: '#efeeee'}} className="border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Activities</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Process</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Criticality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {checklist.items.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.type || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.activities || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.process || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.criticality || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryDetails;
