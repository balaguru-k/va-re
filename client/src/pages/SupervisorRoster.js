import React, { useState, useEffect } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { rosterAPI } from '../services/api';
import SearchBar from '../components/UI/SearchBar';
import PageHeader from '../components/UI/PageHeader';
import useApi from '../hooks/useApi';
import showToast from '../utils/toast';

const SupervisorRoster = () => {
  const [rosters, setRosters] = useState([]);
  const [allChecklists, setAllChecklists] = useState([]);
  const [users, setUsers] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const { loading, execute } = useApi();

  const filteredChecklists = allChecklists.filter(checklist => {
    if (!searchTerm) return true;
    
    const existingAssignment = rosters.find(r => r.checklist_id === checklist.id);
    
    const checklistMatch = [
      checklist.checklist_name,
      checklist.category_name,
      checklist.department_name,
      checklist.location_name,
      checklist.facility_name
    ].some(field => field?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const usernameMatch = [
      existingAssignment?.auditor_username,
      existingAssignment?.manager_username,
      existingAssignment?.supervisor_username
    ].some(username => username?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return checklistMatch || usernameMatch;
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredChecklists.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedChecklists = filteredChecklists.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchRosters();
  }, [selectedDate]);

  const fetchInitialData = async () => {
    await execute(
      async () => {
        const [checklistsRes, usersRes] = await Promise.all([
          rosterAPI.getChecklists(),
          rosterAPI.getUsers()
        ]);
        return { checklistsRes, usersRes };
      },
      {
        onSuccess: ({ checklistsRes, usersRes }) => {
          setAllChecklists(checklistsRes.data.checklists || []);
          setUsers(usersRes.data.users || {});
        },
        errorMessage: 'Failed to load data',
        showLoading: false
      }
    );
  };

  const fetchRosters = async () => {
    await execute(
      () => rosterAPI.getRosters({ date: selectedDate }),
      {
        onSuccess: (response) => setRosters(response.data.rosters || []),
        errorMessage: 'Failed to load rosters'
      }
    );
  };

  const handleAuditorAssign = async (checklistId, auditorId) => {
    if (!auditorId) return;
    
    await execute(
      () => rosterAPI.createRoster({
        checklist_id: checklistId,
        auditor_id: auditorId,
        assigned_date: selectedDate
      }),
      {
        onSuccess: (response) => {
          if (response.data.auto_assigned) {
            showToast('success', `Auditor assigned! Auto-assigned: Manager: ${response.data.auto_assigned.manager}, Supervisor: ${response.data.auto_assigned.supervisor}`);
          } else {
            showToast('success', 'Auditor assigned successfully');
          }
          fetchRosters();
        },
        errorMessage: 'Failed to assign auditor',
        showLoading: false
      }
    );
  };

  const handlePendingChange = (checklistId, field, value) => {
    setPendingChanges(prev => ({
      ...prev,
      [checklistId]: {
        ...prev[checklistId],
        [field]: value
      }
    }));
    
    if (field === 'auditor_id' && value) {
      const checklist = allChecklists.find(c => c.id === checklistId);
      if (checklist) {
        const manager = (users.all || []).find(u => 
          u.role_name === 'Manager' && 
          u.location_id === checklist.location_id &&
          u.name_id === checklist.name_id
        );
        
        const supervisor = (users.all || []).find(u => 
          u.role_name === 'Supervisor' && 
          u.location_id === checklist.location_id &&
          u.name_id === checklist.name_id &&
          u.department_id === checklist.department_id
        );
        
        setPendingChanges(prev => ({
          ...prev,
          [checklistId]: {
            ...prev[checklistId],
            [field]: value,
            manager_id: manager?.id || '',
            supervisor_id: supervisor?.id || ''
          }
        }));
      }
    }
  };

  const savePendingChanges = async () => {
    const promises = [];
    
    for (const [checklistId, changes] of Object.entries(pendingChanges)) {
      if (Object.keys(changes).length > 0) {
        promises.push(
          execute(
            () => rosterAPI.manualAssign({
              checklist_id: parseInt(checklistId),
              auditor_id: changes.auditor_id || null,
              manager_id: changes.manager_id || null,
              supervisor_id: changes.supervisor_id || null,
              assigned_date: selectedDate
            }),
            {
              errorMessage: `Failed to update assignments for checklist ${checklistId}`,
              showLoading: false
            }
          )
        );
      }
    }
    
    if (promises.length > 0) {
      await Promise.all(promises);
      showToast('success', 'All assignments updated successfully');
      setPendingChanges({});
      fetchRosters();
    }
    
    setIsAssignMode(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Supervisor Roster Management">
        <div className="flex items-center space-x-4">
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by checklist or user name..."
          />
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field"
            />
          </div>
          <button
            onClick={isAssignMode ? savePendingChanges : () => setIsAssignMode(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              isAssignMode 
                ? 'text-white bg-green-600 hover:bg-green-700' 
                : 'text-white bg-btn-primary hover:opacity-90'
            }`}
          >
            {isAssignMode ? 'Done' : 'Assign'}
          </button>
        </div>
      </PageHeader>

      <div className="bg-white border border-red-100 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">
            Supervisor Checklist Assignments for {new Date(selectedDate).toLocaleDateString()}
          </h2>
        </div>
        
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Checklist</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Location</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Department</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Auditor</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Manager</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Supervisor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedChecklists.map((checklist, index) => {
                  const existingAssignment = rosters.find(r => r.checklist_id === checklist.id);
                  return (
                    <tr key={checklist.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {checklist.checklist_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {checklist.location_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {checklist.facility_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {checklist.department_name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {isAssignMode ? (
                          <select
                            value={pendingChanges[checklist.id]?.auditor_id ?? existingAssignment?.auditor_id ?? ''}
                            onChange={(e) => handlePendingChange(checklist.id, 'auditor_id', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="">Select Auditor</option>
                            {(users.auditors || []).map(user => (
                              <option key={user.id} value={user.id}>{user.username}</option>
                            ))}
                          </select>
                        ) : existingAssignment ? (
                          <span className="text-sm text-gray-900 font-medium">
                            {existingAssignment.auditor_username}
                          </span>
                        ) : (
                          <select
                            value={''}
                            onChange={(e) => handleAuditorAssign(checklist.id, e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="">Select Auditor</option>
                            {(users.auditors || []).map(user => (
                              <option key={user.id} value={user.id}>{user.username}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAssignMode ? (
                          <select
                            value={pendingChanges[checklist.id]?.manager_id ?? existingAssignment?.manager_id ?? ''}
                            onChange={(e) => handlePendingChange(checklist.id, 'manager_id', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="">Select Manager</option>
                            {(users.all || []).filter(u => 
                              u.role_name === 'Manager' && 
                              u.location_id === checklist.location_id &&
                              u.name_id === checklist.name_id
                            ).map(user => (
                              <option key={user.id} value={user.id}>{user.username}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-gray-900">
                            {existingAssignment?.manager_username || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAssignMode ? (
                          <select
                            value={pendingChanges[checklist.id]?.supervisor_id ?? existingAssignment?.supervisor_id ?? ''}
                            onChange={(e) => handlePendingChange(checklist.id, 'supervisor_id', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="">Select Supervisor</option>
                            {(users.all || []).filter(u => 
                              u.role_name === 'Supervisor' && 
                              u.location_id === checklist.location_id &&
                              u.name_id === checklist.name_id &&
                              u.department_id === checklist.department_id
                            ).map(user => (
                              <option key={user.id} value={user.id}>{user.username}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-gray-900">
                            {existingAssignment?.supervisor_username || '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Result per page: <span className="font-medium">{itemsPerPage}</span>
          </div>
          <div className="text-gray-600">
            <span className="font-medium">{startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredChecklists.length)}</span> of <span className="font-medium">{filteredChecklists.length}</span>
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
              disabled={currentPage === totalPages}
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

export default SupervisorRoster;