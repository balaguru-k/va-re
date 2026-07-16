import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { CalendarIcon, CheckCircleIcon, CogIcon, PlayIcon, ClockIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { rosterAPI, executiveAPI, checklistAPI } from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import useApi from '../hooks/useApi';
import useSearch from '../hooks/useSearch';
import { ROUTES, ROLES, MESSAGES } from '../constants';
import { navigateWithParams } from '../utils/navigation';
import toast from 'react-hot-toast';
import MobileDatePicker from '../components/UI/MobileDatePicker';
import SearchableSelect from '../components/SearchableSelect';

// Reusable Dashboard Table Component
const DashboardTable = ({ title, data, columns, onRowClick, emptyMessage, maxHeight = '800px', searchTerm = '' }) => {
  const filteredData = searchTerm
    ? data.filter(item =>
      item.checklist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.auditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : data;

  return (
    <div className="bg-white border border-red-100 rounded-lg min-h-[450px]">
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
            <thead style={{ backgroundColor: '#efeeee' }} className="border-b border-gray-200 sticky top-0">
              <tr>
                {columns.map((col, index) => (
                  <th key={index} className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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

const MobileAccordion = ({ title, count, defaultOpen, accentColor, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const headerColor = accentColor === 'green' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200';
  const countColor = accentColor === 'green' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 ${headerColor} border-b`}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800" style={{ fontSize: '16px' }}>{title}</span>
          <span className={`px-2 py-0.5 rounded-full font-semibold ${countColor}`} style={{ fontSize: '13px' }}>{count}</span>
        </div>
        <svg className={`w-5 h-5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="bg-gray-50 p-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const today = new Date().toISOString().split('T')[0];
  const isSupervisorOrManager = user?.role === 'Supervisor' || user?.role === 'Manager';
  const [dateRange, setDateRange] = useState(() => {
    const saved = localStorage.getItem('dashboardDateRange');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return isSupervisorOrManager ? { from: '', to: '' } : { from: today, to: today };
  });

  const [allAssignments, setAllAssignments] = useState([]);
  const [completedChecklists, setCompletedChecklists] = useState([]);
  const [executiveChecklist, setExecutiveChecklist] = useState({ pending: [], completed: [] });
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('dashboardSearchTerm') || '');
  const [showFilters, setShowFilters] = useState(false);

  // Super Admin specific states
  const [adminReportData, setAdminReportData] = useState([]);
  const [adminCounts, setAdminCounts] = useState({ total: 0, total_checklists: 0, completed: 0, pending: 0, supervisor_pending: 0, auditor_completed: 0 });
  const [adminFilters, setAdminFilters] = useState({ locationId: '', auditorId: '' });
  const [locations, setLocations] = useState([]);
  const [auditors, setAuditors] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [completeModal, setCompleteModal] = useState(null);

  const { loading, execute } = useApi();
  const { filteredData } = useSearch(allAssignments, ['checklist_name']);


  useEffect(() => {
    if (!user) return;
    if (user.role === 'Compliance Admin' || user.role === 'Viewer') {
      navigate('/compliance/dashboard');
      return;
    }
    if (user.role === ROLES.HEAD) {
      navigate('/head/dashboard');
      return;
    }
    if (user.role === ROLES.SUPER_ADMIN) {
      fetchAdminDropdownData();
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    if (user.role === ROLES.SUPER_ADMIN) {
      fetchAdminDashboardData();
    } else if (user.role === ROLES.EXECUTIVE) {
      fetchExecutiveChecklist();
    } else if (user.role === ROLES.LEAD_AUDITOR) {
      fetchLeadAuditorDashboard();
    } else {
      fetchUserDashboard();
    }
  }, [dateRange, adminFilters.locationId, adminFilters.auditorId]);

  useEffect(() => {
    if (dashboard) {
      // Use the dashboard response for both pending and completed
      const pending = dashboard.assignments?.pending || [];
      const completed = dashboard.assignments?.completed || [];

      setAllAssignments(pending);
      setCompletedChecklists(completed);
    }
  }, [dashboard]);

  const fetchExecutiveChecklist = async () => {
    const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/ /g, '-');
    const params = dateRange.from && dateRange.to
      ? { fromDate: fmt(dateRange.from), toDate: fmt(dateRange.to) }
      : {};

    await execute(
      () => executiveAPI.getChecklist(params),
      {
        onSuccess: (response) => setExecutiveChecklist({
          pending: response.data.pending || [],
          completed: response.data.completed || []

        }),
        errorMessage: 'Failed to fetch executive checklist'
      }
    );
  };

  const fetchLeadAuditorDashboard = async () => {
    const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/ /g, '-');
    const params = dateRange.from && dateRange.to
      ? { fromDate: fmt(dateRange.from), toDate: fmt(dateRange.to) }
      : {};

    await execute(
      () => rosterAPI.getLeadAuditorDashboard(params),
      {
        onSuccess: (response) => {
          setDashboard(response.data.dashboard);
        },
        errorMessage: MESSAGES.FETCH_DASHBOARD_ERROR
      }
    );
  };

  const fetchUserDashboard = async () => {
    const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/ /g, '-');
    const params = dateRange.from && dateRange.to
      ? { fromDate: fmt(dateRange.from), toDate: fmt(dateRange.to) }
      : {};

    await execute(
      () => rosterAPI.getUserDashboard(user.id, params),
      {
        onSuccess: (response) => {
          setDashboard(response.data.dashboard);
        },
        errorMessage: MESSAGES.FETCH_DASHBOARD_ERROR
      }
    );
  };

  const fetchCompletedChecklists = async () => {
    await execute(
      () => rosterAPI.getCompletedChecklists(user.id),
      {
        onSuccess: (response) => setCompletedChecklists(response.data.completed || []),
        errorMessage: MESSAGES.FETCH_COMPLETED_ERROR,
        showLoading: false
      }
    );
  };

  const fetchAdminDropdownData = async () => {
    try {
      const [locRes, usersRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checklists/locations`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checklists/users`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setLocations(locRes.data.locations || []);
      setAuditors(usersRes.data.data.users.auditors || []);
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      toast.error('Failed to load filter options');
    }
  };

  const fetchAdminDashboardData = async () => {
    try {
      const params = new URLSearchParams();
      // Use date range params
      params.append('fromDate', dateRange.from);
      params.append('toDate', dateRange.to);

      if (adminFilters.locationId) params.append('locationId', adminFilters.locationId);
      if (adminFilters.auditorId) params.append('auditorId', adminFilters.auditorId);

      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/rosters/admin-dashboard?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAdminReportData(response.data.data || []);
      setAdminCounts(response.data.counts || { total: 0, total_checklists: 0, completed: 0, pending: 0, auditor_completed: 0 });
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
      toast.error('Failed to load dashboard data');
    }
  };

  const handleAdminFilterChange = (e) => {
    const { name, value } = e.target;
    setAdminFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => {
      const updated = { ...prev, [name]: value };
      localStorage.setItem('dashboardDateRange', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAdminApplyFilters = () => {
    setCurrentPage(1);
    fetchAdminDashboardData();
  };

  const handleAdminResetFilters = () => {
    setAdminFilters({ locationId: '', auditorId: '' });
    const today = new Date().toISOString().split('T')[0];
    const resetRange = { from: today, to: today };
    setDateRange(resetRange);
    localStorage.setItem('dashboardDateRange', JSON.stringify(resetRange));
    setCurrentPage(1);
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = adminReportData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(adminReportData.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const getStatusBadge = (status) => {
    if (status === 'Completed without NC') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed without NC</span>;
    }
    if (status === 'Completed') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
    }
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
  };

  const handleNavigation = (path, params = {}) => {
    if (path.startsWith('/')) {
      navigate(path);
    } else {
      navigateWithParams(navigate, path, params);
    }
  };

  // Dynamic column configurations
  const pendingColumns = [
    {
      header: 'Checklist',
      key: 'checklist_name',
      render: (item, onRowClick) => (
        <span
          className={user?.role === 'Super Admin' ? "text-sm font-medium text-gray-700" : "text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"}
          onClick={() => {
            if (user?.role === 'Super Admin') return; // No navigation for Super Admin
            let route;
            if (user?.role === 'Supervisor') {
              route = `/supervisor-checklist/${item.checklist_id}/form`;
            } else if (user?.role === 'Manager') {
              route = `/manager-checklist/${item.checklist_id}`;
            } else {
              route = `/checklist/${item.checklist_id}/form`;
            }
            onRowClick(route);
          }}
        >
          {item.checklist_name}
          {item.assigned_date && (
            <span className="text-gray-500 font-normal">
              {' ('}{new Date(item.assigned_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              }).replace(/ /g, '-')}{')'}
            </span>
          )}
        </span>
      )
    },
    {
      header: user?.role === 'Super Admin' ? 'Auditor' : 'Action',
      key: user?.role === 'Super Admin' ? 'auditor_name' : 'action',
      render: (item, onRowClick) => {
        if (user?.role === 'Super Admin') {
          return <span className="text-sm text-gray-600">{item.auditor_name}</span>;
        }
        return (
          <button
            onClick={() => {
              let route;
              if (user?.role === 'Supervisor') {
                route = `/supervisor-checklist/${item.checklist_id}/form`;
              } else if (user?.role === 'Manager') {
                route = `/manager-checklist/${item.checklist_id}`;
              } else {
                route = `/checklist/${item.checklist_id}/form`;
              }
              onRowClick(route);
            }}
            className="p-1 text-gray-400 hover:text-red-600 rounded flex items-center"
          >
            <PlayIcon className="w-4 h-4" />
          </button>
        );
      }
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
            onClick={() => {
              if (user?.role === 'Super Admin') {
                onRowClick(`/admin/checklist/${item.checklist_id}/view`);
              } else {
                let route;
                if (user?.role === 'Supervisor') {
                  route = `/supervisor-checklist/${item.checklist_id}`;
                } else if (user?.role === 'Manager') {
                  route = `/manager-checklist/${item.checklist_id}/view`;
                } else {
                  route = `/checklist/${item.checklist_id}`;
                }
                onRowClick(route);
              }
            }}
          >
            {item.checklist_name}
            {item.assigned_date && (
              <span className="text-gray-500 font-normal">
                {' ('}{new Date(item.assigned_date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                }).replace(/ /g, '-')}{')'}
              </span>
            )}
          </span>
          <CheckCircleIcon className="w-4 h-4 text-green-500 ml-2" />
        </div>
      )
    },
    {
      header: user?.role === 'Super Admin' ? 'Auditor' : 'Action',
      key: user?.role === 'Super Admin' ? 'auditor_name' : 'action',
      render: (item, onRowClick) => {
        if (user?.role === 'Super Admin') {
          return <span className="text-sm text-gray-600">{item.auditor_name}</span>;
        }
        return (
          <button
            onClick={() => {
              let route;
              if (user?.role === 'Supervisor') {
                route = `/supervisor-checklist/${item.checklist_id}`;
              } else if (user?.role === 'Manager') {
                route = `/manager-checklist/${item.checklist_id}/view`;
              } else {
                route = `/checklist/${item.checklist_id}`;
              }
              onRowClick(route);
            }}
            className="p-1 text-gray-400 hover:text-red-600 rounded flex items-center"
          >
            <PlayIcon className="w-4 h-4" />
          </button>
        );
      }
    }
  ];

  const executiveColumns = [
    {
      header: 'Checklist Name',
      key: 'name',
      render: (item, onRowClick) => (
        <span
          className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
          onClick={() => onRowClick(`/executive/checklist/${item.daily_checklist_id}`)}
        >
          {item.checklist_name}
          {item.assigned_date && (
            <span className="text-gray-500 text-xs font-normal ml-1">
              {' ('}{new Date(item.assigned_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              }).replace(/ /g, '-')}{')'}
            </span>
          )}
        </span>
      )
    },
    {
      header: 'Location',
      key: 'location_name',
      render: (item) => (
        <span className="text-sm text-gray-600">
          {item.location_name}
        </span>
      )
    },
    {
      header: 'Department',
      key: 'department_name',
      render: (item) => (
        <span className="text-sm text-gray-600">
          {item.department_name}
        </span>
      )
    },
    {
      header: 'Action',
      key: 'action',
      render: (item, onRowClick) => (
        <button
          onClick={() => onRowClick(`/executive/checklist/${item.id}`)}
          className="p-1 text-gray-400 hover:text-red-600 rounded flex items-center"
        >
          <PlayIcon className="w-4 h-4" />
        </button>
      )
    }
  ];

  const executiveCompletedColumns = [
    {
      header: 'Checklist Name',
      key: 'name',
      render: (item, onRowClick) => (
        <div className="flex items-center">
          <span
            className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
            onClick={() => onRowClick(`/executive/checklist/${item.daily_checklist_id}/view?date=${selectedDate}`)}
          >
            {item.checklist_name}
            {item.assigned_date && (
              <span className="text-gray-500 text-xs font-normal ml-1">
                {' ('}{new Date(item.assigned_date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                }).replace(/ /g, '-')}{')'}
              </span>
            )}
          </span>
          <CheckCircleIcon className="w-4 h-4 text-green-500 ml-2" />
        </div>
      )
    },
    {
      header: 'Location',
      key: 'location_name',
      render: (item) => (
        <span className="text-sm text-gray-600">
          {item.location_name}
        </span>
      )
    },
    {
      header: 'Department',
      key: 'department_name',
      render: (item) => (
        <span className="text-sm text-gray-600">
          {item.department_name}
        </span>
      )
    },
    {
      header: 'Action',
      key: 'action',
      render: (item, onRowClick) => (
        <button
          onClick={() => onRowClick(`/executive/checklist/${item.id}/view?date=${selectedDate}`)}
          className="p-1 text-gray-400 hover:text-red-600 rounded flex items-center"
        >
          <PlayIcon className="w-4 h-4" />
        </button>
      )
    }
  ];

  const handleLeadAuditorComplete = (item) => {
    setCompleteModal(item);
  };

  const isNonSuperAdmin = user?.role !== ROLES.SUPER_ADMIN;
  const isExecutive = user?.role === ROLES.EXECUTIVE;
  const isLeadAuditor = user?.role === ROLES.LEAD_AUDITOR;
  const hasPendingAssignments = dashboard && dashboard.total_pending > 0;

  const CompleteConfirmModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircleIcon className="w-6 h-6 text-green-500 shrink-0" />
          <h3 className="text-base font-semibold text-gray-800">Complete Checklist</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to complete <span className="font-medium text-gray-800">{completeModal?.checklist_name}</span>?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setCompleteModal(null)}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={async () => {
              try {
                await checklistAPI.completeRandomChecklist(completeModal.checklist_id);
                setCompleteModal(null);
                fetchLeadAuditorDashboard();
              } catch (error) {
                toast.error('Failed to complete checklist');
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ background: '#C50B34' }}
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );

  if (window.innerWidth <= 768) {
    if (user?.role === 'Supervisor' || user?.role === 'Manager') {
      const pendingList = hasPendingAssignments ? filteredData : [];
      const completedList = completedChecklists;

      const getPendingRoute = (item) =>
        user?.role === 'Supervisor'
          ? `/supervisor-checklist/${item.checklist_id}/form`
          : `/manager-checklist/${item.checklist_id}`;

      const getCompletedRoute = (item) =>
        user?.role === 'Supervisor'
          ? `/supervisor-checklist/${item.checklist_id}`
          : `/manager-checklist/${item.checklist_id}/view`;

      const formatDate = (d) =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

      return (
        <div className="flex flex-col min-h-screen bg-gray-100">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-gray-800" style={{ fontSize: '18px' }}>Dashboard</h1>
              <button
                onClick={() => setShowFilters(f => !f)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                Filters
                {(searchTerm || dateRange.from || dateRange.to) && (
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                )}
                <svg className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {showFilters && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  placeholder="Search checklists..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); localStorage.setItem('dashboardSearchTerm', e.target.value); }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <MobileDatePicker label="From Date" value={dateRange.from} max={dateRange.to || undefined} onChange={val => handleDateRangeChange({ target: { name: 'from', value: val } })} placeholder="From date" />
                  </div>
                  <span className="text-xs text-gray-400">to</span>
                  <div className="flex-1">
                    <MobileDatePicker label="To Date" value={dateRange.to} min={dateRange.from || undefined} onChange={val => handleDateRangeChange({ target: { name: 'to', value: val } })} placeholder="To date" />
                  </div>
                  {(dateRange.from || dateRange.to) && (
                    <button onClick={() => { handleDateRangeChange({ target: { name: 'from', value: '' } }); handleDateRangeChange({ target: { name: 'to', value: '' } }); }} className="text-xs text-red-500 font-medium">Clear</button>
                  )}
                </div>
                {(searchTerm || dateRange.from || dateRange.to) && (
                  <button onClick={() => { setSearchTerm(''); localStorage.setItem('dashboardSearchTerm', ''); handleDateRangeChange({ target: { name: 'from', value: '' } }); handleDateRangeChange({ target: { name: 'to', value: '' } }); }}
                    className="text-xs text-red-500 font-medium">Clear All Filters</button>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">Loading...</div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-6">
              {/* Pending Accordion */}
              <MobileAccordion
                title="Pending Checklists"
                count={pendingList.length}
                defaultOpen={true}
                accentColor="amber"
              >
                {pendingList.length === 0 ? (
                  <p className="text-center text-gray-400 py-4" style={{ fontSize: '14px' }}>No pending checklists</p>
                ) : pendingList.map((item, i) => (
                  <button
                    key={item.checklist_id || i}
                    onClick={() => navigate(getPendingRoute(item))}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl active:bg-gray-50"
                  >
                    <div className="text-left">
                      <p className="font-semibold text-gray-800" style={{ fontSize: '15px' }}>{item.checklist_name}</p>
                      {item.assigned_date && (
                        <p className="text-gray-400 mt-0.5" style={{ fontSize: '13px' }}>{formatDate(item.assigned_date)}</p>
                      )}
                      {(item.location_name || item.department_name) && (
                        <p className="text-gray-400 mt-0.5" style={{ fontSize: '12px' }}>{[item.location_name, item.department_name].filter(Boolean).join(' • ')}</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </MobileAccordion>

              {/* Completed Accordion */}
              <MobileAccordion
                title="Completed Checklists"
                count={completedList.length}
                defaultOpen={false}
                accentColor="green"
              >
                {completedList.length === 0 ? (
                  <p className="text-center text-gray-400 py-4" style={{ fontSize: '14px' }}>No completed checklists</p>
                ) : completedList.map((item, i) => (
                  <button
                    key={item.checklist_id || i}
                    onClick={() => navigate(getCompletedRoute(item))}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl active:bg-gray-50"
                  >
                    <div className="text-left">
                      <p className="font-semibold text-gray-800" style={{ fontSize: '15px' }}>{item.checklist_name}</p>
                      {item.assigned_date && (
                        <p className="text-gray-400 mt-0.5" style={{ fontSize: '13px' }}>{formatDate(item.assigned_date)}</p>
                      )}
                      {(item.location_name || item.department_name) && (
                        <p className="text-gray-400 mt-0.5" style={{ fontSize: '12px' }}>{[item.location_name, item.department_name].filter(Boolean).join(' • ')}</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </MobileAccordion>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
        <div className="text-5xl mb-4">🖥️</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Not Available on Mobile</h2>
        <p className="text-sm text-gray-500">Please use a desktop browser to access the Dashboard.</p>
      </div>
    );
  }

  // Super Admin Dashboard
  if (user?.role === ROLES.SUPER_ADMIN) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />

        {/* Count Cards */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Total Checklists', value: adminCounts.total_checklists || dashboard?.total_checklists || 0, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
            { label: 'Assigned', value: adminCounts.total || dashboard?.total_pending + dashboard?.total_completed || 0, bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600' },
            { label: 'Pending', value: adminCounts.pending || dashboard?.total_pending || 0, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' },
            { label: 'Auditor Completed', value: adminCounts.auditor_completed || dashboard?.total_auditor_completed || 0, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
            { label: 'Supervisor Pending', value: adminCounts.supervisor_pending || 0, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600' },
            { label: 'Completed', value: adminCounts.completed || dashboard?.total_completed || 0, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600' },
          ].map((card, i) => (
            <div key={i} className={`${card.bg} border ${card.border} rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-1`}>
              <div className={`text-[50px] font-bold ${card.text}`}>{card.value}</div>
              <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide text-center leading-tight">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-red-100 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <SearchableSelect
                options={[{ id: '', name: 'All Locations' }, ...locations]}
                value={adminFilters.locationId}
                onChange={(value) => handleAdminFilterChange({ target: { name: 'locationId', value } })}
                placeholder="All Locations"
                displayKey="name"
                valueKey="id"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Auditor</label>
              <SearchableSelect
                options={[{ id: '', username: 'All Auditors' }, ...auditors]}
                value={adminFilters.auditorId}
                onChange={(value) => handleAdminFilterChange({ target: { name: 'auditorId', value } })}
                placeholder="All Auditors"
                displayKey="username"
                valueKey="id"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                name="from"
                value={dateRange.from}
                max={dateRange.to || undefined}
                onChange={handleDateRangeChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                name="to"
                value={dateRange.to}
                min={dateRange.from || undefined}
                onChange={handleDateRangeChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex items-end space-x-2 md:col-span-4 justify-end">
              <button
                onClick={handleAdminApplyFilters}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                style={{ background: '#C50B34' }}
              >
                {loading ? 'Loading...' : 'Apply Filters'}
              </button>
              <button
                onClick={handleAdminResetFilters}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Results Table */}
        < div className="bg-white border border-red-100 rounded-lg min-h-[450px]" >
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-700">Checklist Status</h2>
          </div>
          {
            adminReportData.length > 0 ? (
              <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                <table className="min-w-full">
                  <thead style={{ backgroundColor: '#efeeee' }} className="border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">S.No</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Location</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Checklist Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Assigned User</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Auditor Completed</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Completed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentItems.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{indexOfFirstItem + index + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {new Date(item.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.location_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.checklist_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.auditor_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.auditor_completed === 'Yes' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {item.auditor_completed}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.completed_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-xs">
                {loading ? 'Loading data...' : 'No records found for the selected date and filters.'}
              </div>
            )
          }

          {/* Pagination */}
          {
            adminReportData.length > itemsPerPage && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
                <div className="text-gray-600">
                  Result per page: <span className="font-medium">{itemsPerPage}</span>
                </div>
                <div className="text-gray-600">
                  <span className="font-medium">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, adminReportData.length)}</span> of <span className="font-medium">{adminReportData.length}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ›
                  </button>
                </div>
              </div>
            )
          }
        </div >
      </div >
    );
  }

  return (
    <div className="space-y-6">
      {completeModal && <CompleteConfirmModal />}
      <PageHeader title="Dashboard">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search checklists..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              localStorage.setItem('dashboardSearchTerm', e.target.value);
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#C50B34] focus:border-[#C50B34]"
          />
          {user?.role === ROLES.SUPER_ADMIN && (
            <button
              onClick={() => handleNavigation('/roster')}
              className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-lg flex items-center space-x-2 hover:opacity-90 transition-all duration-200"
            >
              <CogIcon className="w-4 h-4" />
              <span>Admin Roster</span>
            </button>
          )}
          {(user?.role === ROLES.SUPERVISOR || user?.role === ROLES.MANAGER || user?.role === ROLES.AUDITOR || user?.role === ROLES.LEAD_AUDITOR || user?.role === ROLES.EXECUTIVE) && (
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">From</label>
              <input
                type="date"
                name="from"
                value={dateRange.from}
                max={dateRange.to || undefined}
                onChange={handleDateRangeChange}
                className="input-field"
              />
              <label className="text-sm text-gray-600">To</label>
              <input
                type="date"
                name="to"
                value={dateRange.to}
                min={dateRange.from || undefined}
                onChange={handleDateRangeChange}
                className="input-field"
              />
            </div>
          )}
        </div>
      </PageHeader>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">{MESSAGES.LOADING}</div>
        </div>
      ) : (
        <>
          {isExecutive ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { 
                    label: 'Pending Checklists', 
                    data: executiveChecklist.pending || [], 
                    icon: ClockIcon, 
                    gradient: 'from-amber-500 to-orange-500', 
                    bg: 'bg-amber-50', 
                    ring: 'ring-amber-100' 
                  },
                  { 
                    label: 'Completed Checklists', 
                    data: executiveChecklist.completed || [], 
                    icon: ClipboardDocumentCheckIcon, 
                    gradient: 'from-emerald-500 to-green-500', 
                    bg: 'bg-emerald-50', 
                    ring: 'ring-emerald-100' 
                  },
                ].map((card, i) => {
                  const filteredCount = searchTerm 
                    ? card.data.filter(item => 
                        item.checklist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
                      ).length
                    : card.data.length;
                  
                  return (
                  <div key={i} className={`${card.bg} ring-1 ${card.ring} rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md`}>
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
              <div className="grid grid-cols-2 gap-6">
                <DashboardTable
                  title="Pending Checklists"
                  data={executiveChecklist.pending}
                  columns={executiveColumns}
                  onRowClick={handleNavigation}
                  emptyMessage="No pending checklists"
                  maxHeight="290px"
                  searchTerm={searchTerm}
                />
                <DashboardTable
                  title="Completed Checklists"
                  data={executiveChecklist.completed}
                  columns={executiveCompletedColumns}
                  onRowClick={handleNavigation}
                  emptyMessage="No completed checklists"
                  maxHeight="290px"
                  searchTerm={searchTerm}
                />
              </div>
            </>
          ) : isLeadAuditor ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: 'Pending (Unassigned)',
                    data: dashboard?.assignments?.pending || [],
                    icon: ClockIcon,
                    gradient: 'from-amber-500 to-orange-500',
                    bg: 'bg-amber-50',
                    ring: 'ring-amber-100'
                  },
                  {
                    label: 'Completed (Unassigned)',
                    data: dashboard?.assignments?.completed || [],
                    icon: ClipboardDocumentCheckIcon,
                    gradient: 'from-emerald-500 to-green-500',
                    bg: 'bg-emerald-50',
                    ring: 'ring-emerald-100'
                  },
                ].map((card, i) => {
                  const filteredCount = searchTerm
                    ? card.data.filter(item =>
                        item.checklist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.location_name?.toLowerCase().includes(searchTerm.toLowerCase())
                      ).length
                    : card.data.length;
                  return (
                    <div key={i} className={`${card.bg} ring-1 ${card.ring} rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md`}>
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
              <div className="grid grid-cols-2 gap-6">
                <DashboardTable
                  title="Pending (No Auditor Assigned)"
                  data={dashboard?.assignments?.pending || []}
                  columns={[
                    {
                      header: 'Checklist',
                      key: 'checklist_name',
                      render: (item, onRowClick) => (
                        <div>
                          <span
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                            onClick={() => onRowClick(`/checklist/${item.checklist_id || item.daily_checklist_id}/form`)}
                          >{item.checklist_name}</span>
                          {item.assigned_date && (
                            <span className="text-gray-500 text-xs font-normal ml-1">
                              ({new Date(item.assigned_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')})
                            </span>
                          )}
                        </div>
                      )
                    },
                    {
                      header: 'Location',
                      key: 'location_name',
                      render: (item) => <span className="text-sm text-gray-600">{item.location_name || '-'}</span>
                    },
                    {
                      header: 'Department',
                      key: 'department_name',
                      render: (item) => <span className="text-sm text-gray-600">{item.department_name || '-'}</span>
                    },
                    {
                      header: 'Action',
                      key: 'action',
                      render: (item, onRowClick) => (
                        <button
                          onClick={() => onRowClick(`/checklist/${item.checklist_id || item.daily_checklist_id}/form`)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded flex items-center"
                        >
                          <PlayIcon className="w-4 h-4" />
                        </button>
                      )
                    },
                    {
                      header: 'Complete',
                      key: 'complete',
                      render: (item) => (
                        <button
                          onClick={() => handleLeadAuditorComplete(item)}
                          className="p-1 text-gray-400 hover:text-green-600 rounded flex items-center"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                        </button>
                      )
                    }
                  ]}
                  onRowClick={handleNavigation}
                  emptyMessage="No pending unassigned checklists"
                  searchTerm={searchTerm}
                />
                <DashboardTable
                  title="Completed (No Auditor Assigned)"
                  data={dashboard?.assignments?.completed || []}
                  columns={[
                    {
                      header: 'Checklist',
                      key: 'checklist_name',
                      render: (item, onRowClick) => (
                        <div className="flex items-center">
                          <span
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                            onClick={() => onRowClick(`/checklist/${item.checklist_id || item.daily_checklist_id}`)}
                          >{item.checklist_name}</span>
                          <CheckCircleIcon className="w-4 h-4 text-green-500 ml-2" />
                          {item.assigned_date && (
                            <span className="text-gray-500 text-xs font-normal ml-1">
                              ({new Date(item.assigned_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')})
                            </span>
                          )}
                        </div>
                      )
                    },
                    {
                      header: 'Location',
                      key: 'location_name',
                      render: (item) => <span className="text-sm text-gray-600">{item.location_name || '-'}</span>
                    },
                    {
                      header: 'Department',
                      key: 'department_name',
                      render: (item) => <span className="text-sm text-gray-600">{item.department_name || '-'}</span>
                    },
                    {
                      header: 'Action',
                      key: 'action',
                      render: (item, onRowClick) => (
                        <button
                          onClick={() => onRowClick(`/checklist/${item.checklist_id || item.daily_checklist_id}`)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded flex items-center"
                        >
                          <PlayIcon className="w-4 h-4" />
                        </button>
                      )
                    }
                  ]}
                  onRowClick={handleNavigation}
                  emptyMessage="No completed unassigned checklists"
                  searchTerm={searchTerm}
                />
              </div>
            </>
          ) : (
            <>
              {user?.role === ROLES.SUPER_ADMIN ? (
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
              ) : (
                isNonSuperAdmin && (
                 <>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { 
                          label: 'Pending Checklists', 
                          data: hasPendingAssignments ? filteredData : [], 
                          icon: ClockIcon, 
                          gradient: 'from-amber-500 to-orange-500', 
                          bg: 'bg-amber-50', 
                          ring: 'ring-amber-100' 
                        },
                        { 
                          label: 'Completed Checklists', 
                          data: completedChecklists, 
                          icon: ClipboardDocumentCheckIcon, 
                          gradient: 'from-emerald-500 to-green-500', 
                          bg: 'bg-emerald-50', 
                          ring: 'ring-emerald-100' 
                        },
                      ].map((card, i) => {
                        const filteredCount = searchTerm 
                          ? card.data.filter(item => 
                              item.checklist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              item.auditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
                            ).length
                          : card.data.length;
                        
                        return (
                        <div key={i} className={`${card.bg} ring-1 ${card.ring} rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md`}>
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
                    <div className="grid grid-cols-2 gap-6">
                      <DashboardTable
                        title="Pending Checklists"
                        data={hasPendingAssignments ? filteredData : []}
                        columns={pendingColumns}
                        onRowClick={handleNavigation}
                        emptyMessage={MESSAGES.NO_PENDING}
                        maxHeight="290px"
                        searchTerm={searchTerm}
                      />
                      <DashboardTable
                        title="Completed Checklists"
                        data={completedChecklists}
                        columns={completedColumns}
                        onRowClick={handleNavigation}
                        emptyMessage={MESSAGES.NO_COMPLETED}
                        maxHeight="200px"
                        searchTerm={searchTerm}
                      />
                    </div>
                  </>
                )
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;