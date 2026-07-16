import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  CameraIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  CogIcon,
  DocumentChartBarIcon,
  ChartBarSquareIcon,
  ArrowRightOnRectangleIcon,
  TableCellsIcon,
  Bars3Icon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';

const Sidebar = ({ isCollapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toggleSidebar } = useSidebar();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [openGroups, setOpenGroups] = useState(['Complaints']);

  const toggleGroup = (groupName) => {
    setOpenGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName) 
        : [...prev, groupName]
    );
  };

  const menuItems = [
    { name: 'Dashboard', icon: HomeIcon, path: '/dashboard', excludeRoles: ['Admin', 'Complaince Admin', 'Business Head', 'Lead-Auditor'] },
    { name: 'Checklists', icon: TableCellsIcon, path: '/checklist-data', auditorOnly: true },
    { name: 'Checklists', icon: TableCellsIcon, path: '/supervisor-checklist-data', supervisorOnly: true },
    { name: 'Checklists', icon: TableCellsIcon, path: '/manager-checklist-data', managerOnly: true },
    { name: 'Checklists', icon: TableCellsIcon, path: '/executive/checklist-data', executiveOnly: true },
    { name: 'Daily Checklists', icon: CalendarDaysIcon, path: '/head/dashboard', headOnly: true },
    { name: 'Completed SC Checklists', icon: DocumentCheckIcon, path: '/executive/sc-audit-trail', executiveOnly: true },
    { name: 'Daily NC Reports', icon: ChartBarIcon, path: '/daily-nc-reports', allowedRoles: ['Manager', 'Business Head'] },
    { name: 'Business Report', icon: DocumentChartBarIcon, path: '/business-report', allowedRoles: ['Manager', 'Business Head'] },
    { name: 'Checklist Report', icon: ClipboardDocumentListIcon, path: '/reports/supervisor-checklist-report', allowedRoles: ['Supervisor', 'Manager', 'Business Head'] },
    { name: 'Users', icon: UsersIcon, path: '/users', adminOnly: true },
    { name: 'Dashboard', icon: ChartBarSquareIcon, path: '/admin/analytics-dashboard', allowedRoles: ['Admin'] },
    { name: 'Daily Checklists', icon: CalendarDaysIcon, path: '/admin/dashboard', adminOnly: true },
    { name: 'NC Reports', icon: ChartBarIcon, path: '/reports/ncs', allowedRoles: ['Admin'] },
    { name: 'Repeated Reason', icon: DocumentChartBarIcon, path: '/reports/analysis', allowedRoles: ['Admin','Manager','Supervisor'] },
    { name: 'Accepted/Rejected Report', icon: ChartBarSquareIcon, path: '/reports/items', allowedRoles: ['Admin'] },
    { name: 'NC Closure Report', icon: ClipboardDocumentListIcon, path: '/reports/users-status', allowedRoles: ['Admin','Supervisor'] },
    { name: 'UserWise NCs', icon: DocumentTextIcon, path: '/reports/manager-supervisor-ncs', allowedRoles: ['Admin','Manager'] },
    { name: 'Audit Status', icon: CameraIcon, path: '/reports/audit-status', allowedRoles: ['Admin','Supervisor'] },
    { name: 'Mail Tracker', icon: EnvelopeIcon, path: '/reports/mail-tracker', allowedRoles: ['Admin'] },
    { name: 'Checklist Score', icon: ChartBarSquareIcon, path: '/reports/checklist-scores', allowedRoles: ['Admin'] },
    { name: 'Weekly NC Report', icon: CalendarDaysIcon, path: '/reports/weekly-nc', allowedRoles: ['Admin'] },
    { name: 'Supervisor Report', icon: DocumentTextIcon, path: '/reports/supervisor-report', allowedRoles: ['Supervisor'] },
    { name: 'Create Checklist', icon: ClipboardDocumentListIcon, path: '/checklists', adminOnly: true },
    { name: 'Roster Management', icon: CalendarDaysIcon, path: '/roster', adminOnly: true },
    { name: 'Rotation Roster', icon: ClipboardDocumentListIcon, path: '/rotation-roster', allowedRoles: ['Super Admin', 'Lead-Auditor'] },
    { name: 'Random Checklist', icon: ClipboardDocumentListIcon, path: '/random-checklist', adminOnly: true },
    { name: 'Masters', icon: CogIcon, path: '/masters', adminOnly: true },
    { name: 'History', icon: ClockIcon, path: '/history', adminOnly: true },
    { name: 'VA Report', icon: DocumentChartBarIcon, path: '/reports/va-report', adminOnly: true },
    { name: 'Tickets', icon: ClipboardDocumentListIcon, path: '/compliance/dashboard', adminOnly: true },
    { name: 'Tickets Report', icon: DocumentChartBarIcon, path: '/compliance/tickets-report', adminOnly: true },
    { name: 'QC Form', icon: DocumentTextIcon, path: '/lead-auditor/form', allowedRoles: ['Lead-Auditor'] },
    { name: 'QC Form Data', icon: TableCellsIcon, path: '/lead-auditor/form-data', allowedRoles: ['Lead-Auditor'] },
    { name: 'QC Form', icon: DocumentTextIcon, path: '/auditor/qc-form', auditorOnly: true },
    { name: 'Tickets', icon: ClipboardDocumentListIcon, path: '/tickets', auditorOnly: true },
    { name: 'Dashboard', icon: HomeIcon, path: '/compliance/my-tickets', myTicketsOnly: true },
    { name: 'Tickets Dashboard', icon: HomeIcon, path: '/compliance/dashboard', complianceOnly: true },
    { name: 'Admin Tickets', icon: ClipboardDocumentListIcon, path: '/compliance/admin-tickets', complianceOnly: true },
    { name: 'Tickets Report', icon: DocumentChartBarIcon, path: '/compliance/tickets-report', complianceOnly: true },
    { name: 'Masters', icon: UsersIcon, path: '/compliance/masters', complianceOnly: true },
    { name: 'Tickets Dashboard', icon: HomeIcon, path: '/compliance/dashboard', viewerOnly: true },
    { name: 'Tickets Report', icon: DocumentChartBarIcon, path: '/compliance/tickets-report', viewerOnly: true },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`bg-sidebar-gradient text-white ${isCollapsed ? 'w-16' : 'w-52'} h-full flex flex-col rounded-lg transition-all duration-300 relative`}>

      {/* Toggle Button */}
      <div className={`p-3 border-b border-white/10 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <span className="text-sm font-medium text-white">Menu</span>
        )}
        <button
          onClick={toggleSidebar}
          className="text-white/80 hover:text-white transition-colors"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-3">
        {menuItems.filter(item => {
          const userRole = user?.role?.trim();
          if (userRole === 'Lead-Auditor') {
            return item.path === '/dashboard' || item.path === '/roster' || item.path === '/admin-roster' || item.path === '/random-checklist' || item.path === '/lead-auditor/form' || item.path === '/lead-auditor/form-data' || item.path === '/rotation-roster';
          }

          if (userRole === 'Complaince Admin') {
            return !!item.complianceOnly;
          }

          if (userRole === 'Viewer') {
            return !!item.viewerOnly;
          }

          if (userRole === 'Vendor' || userRole === 'Engineer' || userRole === 'VS User') {
            return !!item.myTicketsOnly;
          }

          if (item.excludeRoles && item.excludeRoles.includes(userRole)) {
            return false;
          }

          if (item.allowedRoles) {
            return item.allowedRoles.includes(userRole);
          }

          return (!item.adminOnly || userRole === 'Super Admin') &&
            (!item.auditorOnly || userRole === 'Auditor') &&
            (!item.supervisorOnly || userRole === 'Supervisor') &&
            (!item.managerOnly || userRole === 'Manager') &&
            (!item.executiveOnly || userRole === 'Executive') &&
            (!item.headOnly || userRole === 'Business Head') &&
            !item.complianceOnly &&
            !item.viewerOnly &&
            !item.myTicketsOnly;
        }).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const isGroupOpen = openGroups.includes(item.name);

          if (item.isGroup) {
            return (
              <div key={item.name} className="mb-1">
                <div
                  onClick={() => toggleGroup(item.name)}
                  className={`${isCollapsed ? 'flex flex-col items-center justify-center px-1 py-2' : 'flex items-center px-3 py-1.5'} cursor-pointer transition-all duration-200 rounded-md text-white/80 hover:text-white hover:bg-white/10`}
                >
                  <Icon className={`w-4 h-4 ${isCollapsed ? '' : 'mr-3'}`} />
                  {!isCollapsed && (
                    <>
                      <span className="text-sm font-medium flex-1">{item.name}</span>
                      {isGroupOpen ? <ChevronDownIcon className="w-3 h-3 ml-1" /> : <ChevronRightIcon className="w-3 h-3 ml-1" />}
                    </>
                  )}
                </div>
                {!isCollapsed && isGroupOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-2">
                    {item.items.map(subItem => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location.pathname === subItem.path;
                      return (
                        <div
                          key={subItem.path}
                          onClick={() => navigate(subItem.path)}
                          className={`flex items-center px-3 py-1.5 cursor-pointer transition-all duration-200 rounded-md ${isSubActive
                            ? 'bg-red-600/20 text-white'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                        >
                          <SubIcon className="w-3.5 h-3.5 mr-3" />
                          <span className="text-xs font-medium">{subItem.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={`${item.name}-${item.path}`}
              data-menu={item.name}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => setHoveredItem(item.name)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`${isCollapsed ? 'flex flex-col items-center justify-center px-1 py-2' : 'flex items-center px-3 py-1.5'} mb-1 cursor-pointer transition-all duration-200 rounded-md relative ${isActive
                ? 'bg-sidebar-active text-white'
                : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
            >
              <Icon className={`w-4 h-4 ${isCollapsed ? 'mb-1' : 'mr-3'}`} />
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.name}</span>
              )}
              {isCollapsed && hoveredItem === item.name && (
                <div className="fixed left-20 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-[9999] pointer-events-none" style={{ top: `${document.querySelector(`[data-menu="${item.name}"]`)?.getBoundingClientRect().top || 0}px` }}>
                  {item.name}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10">
        <div
          onClick={handleLogout}
          onMouseEnter={() => setHoveredItem('Logout')}
          onMouseLeave={() => setHoveredItem(null)}
          className={`${isCollapsed ? 'flex flex-col items-center justify-center px-1 py-2' : 'flex items-center px-3 py-1.5'} cursor-pointer text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200 relative`}
        >
          <ArrowRightOnRectangleIcon className={`w-4 h-4 ${isCollapsed ? 'mb-1' : 'mr-3'}`} />
          {!isCollapsed && (
            <span className="text-sm font-medium">Logout</span>
          )}
          {isCollapsed && hoveredItem === 'Logout' && (
            <div className="absolute left-16 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-[9999] pointer-events-none">
              Logout
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;