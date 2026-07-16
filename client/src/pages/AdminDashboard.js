import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CalendarIcon, CheckCircleIcon, PlayIcon, ClockIcon, ClipboardDocumentCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { rosterAPI } from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import useApi from '../hooks/useApi';
import { MESSAGES } from '../constants';

const DashboardTable = ({ title, data, columns, onRowClick, emptyMessage, searchTerm = '' }) => {
  const filteredData = searchTerm 
    ? data.filter(item => 
        item.checklist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.auditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : data;

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-medium text-gray-700">{title}</h2>
          {/* <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
            {filteredData.length}
          </span> */}
        </div>
      </div>
      {filteredData.length > 0 ? (
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="min-w-full">
            <thead style={{backgroundColor: '#efeeee'}} className="border-b border-gray-200 sticky top-0">
              <tr>
                {columns.map((col, index) => (
                  <th key={index} className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 [&>tr:last-child]:border-b-0">
              {filteredData.map((item, index) => (
                <tr key={item.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className="px-4 py-3">
                      {col.render ? col.render(item, onRowClick) : item[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 text-center text-gray-500 text-xs">
          {searchTerm ? 'No matching results found' : emptyMessage}
        </div>
      )}
    </div>
  );
};

const formatTime = (seconds) => {
  if (!seconds) return '0h 00m 00s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({
    from: localStorage.getItem('adminDashboardFrom') || today,
    to: localStorage.getItem('adminDashboardTo') || today
  });
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('adminDashboardSearchTerm') || '');

  const { loading, execute } = useApi();

  useEffect(() => {
    if (user?.id) fetchUserDashboard();
  }, [user, dateRange]);

  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/ /g, '-');

  const fetchUserDashboard = async () => {
    await execute(
      () => rosterAPI.getUserDashboard(user.id, { fromDate: fmt(dateRange.from), toDate: fmt(dateRange.to) }),
      {
        onSuccess: (response) => setDashboard(response.data.dashboard),
        errorMessage: MESSAGES.FETCH_DASHBOARD_ERROR
      }
    );
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
    localStorage.setItem(`adminDashboard${name === 'from' ? 'From' : 'To'}`, value);
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const pendingColumns = [
    {
      header: 'Checklist',
      key: 'checklist_name',
      render: (item) => (
        <span className="text-sm font-medium text-gray-700">
          {item.checklist_name}
        </span>
      )
    },
    {
      header: 'Auditor',
      key: 'auditor_name',
      render: (item) => (
        <span className="text-sm text-gray-600">{item.auditor_name}</span>
      )
    }
  ];

  const completedColumns = [
    {
      header: 'Checklist',
      key: 'checklist_name',
      render: (item, onRowClick) => (
        <div className="flex items-center">
          <span 
            className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
            onClick={() => onRowClick(`/admin/checklist/${item.checklist_id}/view`)}
          >
            {item.checklist_name}
          </span>
          <CheckCircleIcon className="w-4 h-4 text-green-500 ml-2" />
          <span className="ml-3 px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800 whitespace-nowrap">
            {formatTime(item.time_taken_seconds)}
          </span>
        </div>
      )
    },
    {
      header: 'Auditor',
      key: 'auditor_name',
      render: (item) => (
        <span className="text-sm text-gray-600">{item.auditor_name}</span>
      )
    },
    // {
    //   header: 'Time',
    //   key: 'time_taken_seconds',
    //   render: (item) => (
    //     <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
    //       {formatTime(item.time_taken_seconds)}
    //     </span>
    //   )
    // }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Daily Checklists">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search checklists..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              localStorage.setItem('adminDashboardSearchTerm', e.target.value);
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#C50B34] focus:border-[#C50B34]"
          />
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-gray-500" />
            <label className="text-sm text-gray-600">From</label>
            <input
              type="date"
              name="from"
              value={dateRange.from}
              max={dateRange.to || undefined}
              onChange={handleDateChange}
              className="input-field"
            />
            <label className="text-sm text-gray-600">To</label>
            <input
              type="date"
              name="to"
              value={dateRange.to}
              min={dateRange.from || undefined}
              onChange={handleDateChange}
              className="input-field"
            />
          </div>
        </div>
      </PageHeader>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">{MESSAGES.LOADING}</div>
        </div>
      ) : (
        <>
        {/* Count Cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { 
              label: 'Pending', 
              data: dashboard?.assignments?.pending || [], 
              icon: ClockIcon, 
              gradient: 'from-amber-500 to-orange-500', 
              bg: 'bg-amber-50', 
              ring: 'ring-amber-100' 
            },
            { 
              label: 'Completed', 
              data: dashboard?.assignments?.completed || [], 
              icon: ClipboardDocumentCheckIcon, 
              gradient: 'from-emerald-500 to-green-500', 
              bg: 'bg-emerald-50', 
              ring: 'ring-emerald-100' 
            },
            { 
              label: 'Auditor Completed', 
              data: dashboard?.assignments?.auditorCompleted || [], 
              icon: UserGroupIcon, 
              gradient: 'from-blue-500 to-indigo-500', 
              bg: 'bg-blue-50', 
              ring: 'ring-blue-100' 
            },
          ].map((card, i) => {
            const filteredCount = searchTerm 
              ? card.data.filter(item => 
                  item.checklist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  item.auditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
                ).length
              : card.data.length;
            
            return (
            <div key={i} className={`relative overflow-hidden ${card.bg} ring-1 ${card.ring} rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md`}>
              <div className={`shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-sm`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 leading-none">{filteredCount}</p>
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mt-1">{card.label}</p>
              </div>
            </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <DashboardTable
            title="Pending Assignments"
            data={dashboard?.assignments?.pending || []}
            columns={pendingColumns}
            onRowClick={handleNavigation}
            emptyMessage="No pending assignments"
            maxHeight="290px"
            searchTerm={searchTerm}
          />
          <DashboardTable
            title="Completed Assignments"
            data={dashboard?.assignments?.completed || []}
            columns={completedColumns}
            onRowClick={handleNavigation}
            emptyMessage="No completed assignments"
            maxHeight="290px"
            searchTerm={searchTerm}
          />
          <DashboardTable
            title="Auditor Completed Assignments"
            data={dashboard?.assignments?.auditorCompleted || []}
            columns={completedColumns}
            onRowClick={handleNavigation}
            emptyMessage="No auditor completed assignments"
            maxHeight="290px"
            searchTerm={searchTerm}
          />
        </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
