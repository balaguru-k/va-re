import React, { useState, useEffect, useRef } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { rosterAPI } from '../services/api';
import SearchBar from '../components/UI/SearchBar';
import PageHeader from '../components/UI/PageHeader';
import useApi from '../hooks/useApi';
import { formatDate } from '../utils/dateFormatter';
import showToast from '../utils/toast';
import SearchableSelect from '../components/SearchableSelect';

const RandomChecklist = () => {
  const [rosters, setRosters] = useState([]);
  const [users, setUsers] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const searchTimer = useRef(null);
  const { loading, execute } = useApi();

  const totalPages = pagination.totalPages;
  const startIndex = (currentPage - 1) * itemsPerPage;

  useEffect(() => {
    execute(
      () => rosterAPI.getUsers(),
      {
        onSuccess: (res) => setUsers(res.data.users || {}),
        showLoading: false
      }
    );
  }, []);

  useEffect(() => { fetchData(); }, [selectedDate, currentPage, itemsPerPage]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setCurrentPage(1);
      fetchData();
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchTerm]);

  const fetchData = async () => {
    await execute(
      () => rosterAPI.getRandomChecklists({ date: selectedDate, page: currentPage, limit: itemsPerPage, search: searchTerm || undefined }),
      {
        onSuccess: (response) => {
          setRosters(response.data.rosters || []);
          setPagination(response.data.pagination || { total: 0, totalPages: 0 });
        },
        errorMessage: 'Failed to load random checklists'
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
          if (auditorId && response.data.auto_assigned) {
            showToast('success', `Auditor assigned! Auto-assigned: Manager: ${response.data.auto_assigned.manager}, Supervisor: ${response.data.auto_assigned.supervisor}`);
          } else {
            showToast('success', auditorId ? 'Auditor assigned successfully' : 'Auditor assignment removed');
          }
          fetchData();
        },
        errorMessage: 'Failed to assign auditor',
        showLoading: false
      }
    );
  };

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

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3">
      <PageHeader title="Random Checklist">
        <div className="flex items-center space-x-4">
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by checklist, location, department..."
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
        </div>
      </PageHeader>

      <div className="bg-white border border-red-100 rounded-lg flex flex-col flex-1 min-h-0">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">
              Unassigned Checklists for {formatDate(new Date(selectedDate))}
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
                {rosters.map((roster, index) => (
                  <tr key={roster.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{roster.checklist_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{roster.location_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{roster.facility_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{roster.department_name || '-'}</td>
                    <td className="px-4 py-3">
                      <SearchableSelect
                        options={(users.auditors || []).map(user => ({ value: user.id, label: user.username }))}
                        value=""
                        onChange={(value) => handleAuditorAssign(roster.id, roster.roster_id, value)}
                        placeholder="Select Auditor"
                      />
                    </td>
                  </tr>
                ))}
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
    </div>
  );
};

export default RandomChecklist;
