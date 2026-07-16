import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { checklistAPI } from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import useApi from '../hooks/useApi';
import { EyeIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import showToast from '../utils/toast';
import Swal from 'sweetalert2';

const History = () => {
  const [deletedChecklists, setDeletedChecklists] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { loading, execute } = useApi();
  const navigate = useNavigate();

  const filteredChecklists = useMemo(() => {
    if (!searchTerm.trim()) return deletedChecklists;
    const term = searchTerm.toLowerCase();
    return deletedChecklists.filter(c =>
      (c.checklist_name || '').toLowerCase().includes(term) ||
      (c.category_name || '').toLowerCase().includes(term) ||
      (c.location_name || '').toLowerCase().includes(term)
    );
  }, [deletedChecklists, searchTerm]);

  useEffect(() => {
    fetchDeletedChecklists();
  }, []);

  const fetchDeletedChecklists = async () => {
    await execute(
      () => checklistAPI.getDeletedChecklists(),
      {
        onSuccess: (response) => {
          setDeletedChecklists(response.data.checklists);
        },
        errorMessage: 'Failed to fetch deleted checklists'
      }
    );
  };

  const handleViewDetails = (checklistId) => {
    navigate(`/history/${checklistId}`);
  };

  const handleRestoreChecklist = async (checklistId) => {
    const checklist = deletedChecklists.find(c => c.id === checklistId);
    const result = await Swal.fire({
      title: 'Restore Checklist',
      text: `Are you sure you want to restore "${checklist?.checklist_name}".`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#3fc3ee',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Restore',
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
      await checklistAPI.restoreChecklist(checklistId);
      await fetchDeletedChecklists();
      showToast('success', 'Checklist Restored successfully');
    } catch (error) {
      showToast('error', 'Failed to Restore checklist');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Deleted Checklists History" />
        <div className="relative w-72">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, category, or location"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (
        <div className="bg-white border border-red-100 rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead style={{backgroundColor: '#efeeee'}} className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Checklist Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Department</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Facility</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Deleted At</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredChecklists.length > 0 ? (
                  filteredChecklists.map((checklist, index) => (
                    <tr key={checklist.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-700">{checklist.checklist_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{checklist.category_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{checklist.location_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{checklist.department_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{checklist.facility_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(checklist.deleted_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewDetails(checklist.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button> 
                        <button
                          onClick={() => handleRestoreChecklist(checklist.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="Restore Checklist"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500 text-sm">
                      No deleted checklists found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
