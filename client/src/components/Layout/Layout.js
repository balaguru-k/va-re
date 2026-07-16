import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAuth } from '../../contexts/AuthContext';

const isMobile = window.innerWidth <= 768;

const Layout = ({ children }) => {
  const { isCollapsed } = useSidebar();
  const { user } = useAuth();

  // Hide sidebar on mobile for these roles
  const hideSidebar = isMobile && (user?.role === 'Vendor' || user?.role === 'Engineer' || user?.role === 'VS User' || user?.role === 'Supervisor' || user?.role === 'Manager');

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {!hideSidebar && (
          <div className="p-2">
            <Sidebar isCollapsed={isMobile ? true : isCollapsed} />
          </div>
        )}
        <main className={`flex-1 overflow-y-auto flex flex-col ${isMobile ? 'p-1' : 'p-3'}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;