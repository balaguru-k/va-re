import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CalendarIcon, PlayIcon, ClockIcon, ClipboardDocumentCheckIcon, UserGroupIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
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

const HeadDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({
    from: localStorage.getItem('headDashboardFrom') || today,
    to: localStorage.getItem('headDashboardTo') || today
  });
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('headDashboardSearchTerm') || '');

  const { loading, execute } = useApi();

  useEffect(() => {
    if (user?.id) fetchDashboard();
  }, [user, dateRange]);

  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/ /g, '-');

  const fetchDashboard = async () => {
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
    localStorage.setItem(`headDashboard${name === 'from' ? 'From' : 'To'}`, value);
  };

  const handleNavigation = (path) => navigate(path);

  const columns = [
    {
      header: 'Checklist',
      key: 'checklist_name',
      render: (item, onRowClick) => (
        <span 
          className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => onRowClick(`/admin/checklist/${item.checklist_id}/view`)}
        >
          {item.checklist_name}
          {item.assigned_date && (
            <span className="text-xs text-gray-400 ml-1">
              ({new Date(item.assigned_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })})
            </span>
          )}
        </span>
      )
    },
    {
      header: 'Action',
      key: 'action',
      render: (item, onRowClick) => (
        <button
          onClick={() => onRowClick(`/admin/checklist/${item.checklist_id}/view`)}
          className="p-1 text-gray-400 hover:text-red-600 rounded flex items-center"
        >
          <PlayIcon className="w-4 h-4" />
        </button>
      )
    }
  ];

  const cards = [
    { 
      label: 'Completed', 
      data: dashboard?.assignments?.auditorCompleted || [], 
      icon: CheckCircleIcon, 
      gradient: 'from-emerald-500 to-green-500', 
      bg: 'bg-emerald-50', 
      ring: 'ring-emerald-100' 
    },
    { 
      label: 'Supervisor Pending', 
      data: dashboard?.assignments?.pending || [], 
      icon: ClockIcon, 
      gradient: 'from-amber-500 to-orange-500', 
      bg: 'bg-amber-50', 
      ring: 'ring-amber-100' 
    },
    { 
      label: 'Manager Pending', 
      data: dashboard?.assignments?.completed || [], 
      icon: ClipboardDocumentCheckIcon, 
      gradient: 'from-red-500 to-rose-500', 
      bg: 'bg-red-50', 
      ring: 'ring-red-100' 
    },
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
              localStorage.setItem('headDashboardSearchTerm', e.target.value);
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
              max={dateRange.to}
              onChange={handleDateChange}
              className="input-field"
            />
            <label className="text-sm text-gray-600">To</label>
            <input
              type="date"
              name="to"
              value={dateRange.to}
              min={dateRange.from}
              max={today}
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
          <div className="grid grid-cols-3 gap-4">
            {cards.map((card, i) => {
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
              title="Completed"
              data={dashboard?.assignments?.auditorCompleted || []}
              columns={columns}
              onRowClick={handleNavigation}
              emptyMessage="No completed assignments"
              searchTerm={searchTerm}
            />
            <DashboardTable
              title="Supervisor Pending"
              data={dashboard?.assignments?.pending || []}
              columns={columns}
              onRowClick={handleNavigation}
              emptyMessage="No supervisor pending assignments"
              searchTerm={searchTerm}
            />
            <DashboardTable
              title="Manager Pending"
              data={dashboard?.assignments?.completed || []}
              columns={columns}
              onRowClick={handleNavigation}
              emptyMessage="No manager pending assignments"
              searchTerm={searchTerm}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default HeadDashboard;
