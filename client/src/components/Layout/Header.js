import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon, ArrowRightOnRectangleIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import ChangePasswordModal from '../UI/ChangePasswordModal';

const isMobile = window.innerWidth <= 768;

const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isMobile) {
    const isTicketUser = user?.role === 'Vendor' || user?.role === 'Engineer' || user?.role === 'VS User' || user?.role === 'Supervisor' || user?.role === 'Manager';
    return (
      <>
        <header className="bg-white shadow border-b-2 border-red-700 px-4 py-2 w-full flex items-center justify-between">
          <img src={require('../../images/logo.png')} alt="Logo" className="h-9 w-auto object-contain" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{user?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-gray-800 leading-tight">{user?.username || 'User'}</p>
              <p className="text-[10px] text-red-600 font-medium uppercase">{user?.role || ''}</p>
            </div>
            {isTicketUser && (
              <button onClick={() => setShowLogoutConfirm(true)} className="p-1.5 text-gray-500 hover:text-red-600 rounded-full" title="Logout">
                <ArrowRightOnRectangleIcon className="w-7 h-7" />
              </button>
            )}
          </div>
        </header>

        {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
              <div className="text-4xl mb-3">🚪</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Logout</h2>
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to logout?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 text-sm font-semibold text-gray-700 border border-gray-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}
                  className="flex-1 py-3 text-sm font-semibold text-white bg-red-600 rounded-xl"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      <header className="bg-gradient-to-r from-white-100 to-red shadow-lg border-b-2 border-red-800 px-6 py-3 w-full">
        <div className="flex items-center justify-between max-w-8xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img
                src={require('../../images/logo.png')}
                alt="Logo"
                className="h-14 w-auto object-contain cursor-pointer transition-transform hover:scale-105"
                onClick={() => {
                  if (user?.role === 'Lead-Auditor') {
                    navigate('/roster');
                  } else {
                    navigate('/dashboard');
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <button
              onClick={() => setShowChangePassword(true)}
              className="relative p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all duration-200"
              title="Change Password"
            >
              <KeyIcon className="w-6 h-6" />
            </button>

            <button className="relative p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all duration-200">
              <BellIcon className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
              </span>
            </button>

            <div className="flex items-center space-x-3 bg-gradient-to-r from-gray-50 to-red-50 rounded-full px-4 py-2 border border-gray-200">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md">
                <span className="text-white text-sm font-bold">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-gray-800">{user?.username || 'User'}</p>
                <p className="text-xs text-red-600 font-medium uppercase tracking-wide">{user?.role || 'ADMIN'}</p>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
