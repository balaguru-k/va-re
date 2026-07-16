import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const Login = () => {
  const navigate = useNavigate();
  const { login, logout, loading, error } = useAuth();
  const { register, handleSubmit, formState: { errors }, getValues } = useForm();
  const [mobileBlocked, setMobileBlocked] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const MOBILE_ALLOWED_ROLES = ['Vendor', 'Engineer', 'Supervisor', 'Manager'];

  const isMobile = window.innerWidth <= 768;

  const navigateToDashboard = (user) => {
    if (user?.user_type === 'compliance') {
      navigate(user?.role === 'Viewer' ? '/compliance/dashboard' : '/compliance/my-tickets');
    } else if (user?.role === 'Complaince Admin') {
      navigate('/compliance/dashboard');
    } else if (user?.role === 'Lead-Auditor') {
      navigate('/dashboard');
    } else if (user?.role === 'Admin') {
      navigate('/admin/analytics-dashboard');
    } else if (user?.role === 'Business Head') {
      navigate('/head/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

   const validatePassword = (password) => {
    const isValid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    return isValid ? null : 'Password must be at least 8 characters and contain uppercase, lowercase, number & special character';
  };

  const onSubmit = async (data) => {
    const result = await login(data);
    if (result.success) {
      const user = JSON.parse(localStorage.getItem('user'));
      if (isMobile && !MOBILE_ALLOWED_ROLES.includes(user?.role)) {
        setMobileBlocked(true);
        return;
      }
      if (user?.is_first_login) {
        setShowResetForm(true);
      } else {
        toast.success('Login successful!');
        navigateToDashboard(user);
      }
    } else {
      toast.error(result.error);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const validationError = validatePassword(newPassword);
    if (validationError) return toast.error(validationError);
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');

    setResetLoading(true);
    try {
      const { email, password } = getValues();
      await authAPI.resetPassword({ email, currentPassword: password, newPassword });
      toast.success('Password reset successfully!');
      setShowResetForm(false);
      setNewPassword('');
      setConfirmPassword('');
      const user = JSON.parse(localStorage.getItem('user'));
      if (user) {
        user.is_first_login = false;
        localStorage.setItem('user', JSON.stringify(user));
      }
      navigateToDashboard(user);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };



  return (
    <div className={isMobile ? "bg-white h-screen flex flex-col" : "min-h-screen flex flex-col bg-white"}>
      {/* Mobile Blocked Modal */}
      {mobileBlocked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-5xl mb-4">🚫</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Mobile Access Not Available</h2>
            <p className="text-sm text-gray-500 mb-6">This portal is not supported on mobile for your role. Please use a desktop browser.</p>
            <button
              onClick={() => { logout(); setMobileBlocked(false); }}
              className="w-full py-3 bg-red-600 text-white text-base font-semibold rounded-xl"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {isMobile ? (
        <>
          <div className="flex-1 flex flex-col justify-center px-8">
            <div className="text-center mb-10">
              <img src={require('../images/logo.png')} alt="CavinCare Logo" className="h-20 w-auto mx-auto object-contain" />
            </div>
            <div className="mb-8">
              <h2 className="mobile-heading font-bold text-gray-900 mb-1">{showResetForm ? 'Reset Password' : 'Log in'}</h2>
              <p className="mobile-subtext text-gray-500">{showResetForm ? 'Set a new password for your account' : 'Welcome back! Please enter your details.'}</p>
            </div>

            {showResetForm ? (
              <form className="space-y-6" onSubmit={handleResetPassword}>

                <div>
                  <label className="mobile-label block font-semibold text-gray-700 mb-2">Current Password</label>
                  <input type="password" value={getValues('password')} disabled className="mobile-input w-full px-4 py-5 border border-gray-200 rounded-xl bg-gray-100 text-gray-500" />
                </div>
                <div>
                  <label className="mobile-label block font-semibold text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="mobile-input w-full px-4 py-5 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Enter new password"
                    />
                    <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNewPass ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Min 8 chars, uppercase, lowercase, number & special character</p>
                </div>
                <div>
                  <label className="mobile-label block font-semibold text-gray-700 mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="mobile-input w-full px-4 py-5 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Confirm new password"
                    />
                    <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirmPass ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs mt-1 text-red-600">Passwords do not match</p>
                  )}
                </div>
                <button type="submit" disabled={resetLoading} className="mobile-btn-text w-full bg-btn-primary text-white font-bold py-5 rounded-xl disabled:opacity-50">
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <label className="mobile-label block font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    {...register('email', {
                      required: 'Email is required',
                      pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email address' }
                    })}
                    type="email"
                    className="mobile-input w-full px-4 py-5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Enter your email"
                    autoComplete="off"
                  />
                  {errors.email && <p className="mobile-subtext mt-1 text-red-600">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="mobile-label block font-semibold text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      {...register('password', { required: 'Password is required' })}
                      type={showLoginPass ? 'text' : 'password'}
                      className="mobile-input w-full px-4 py-5 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="••••••••"
                      autoComplete="off"
                    />
                    <button type="button" onClick={() => setShowLoginPass(!showLoginPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showLoginPass ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mobile-subtext mt-1 text-red-600">{errors.password.message}</p>}
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mobile-subtext">{error}</div>
                )}
                <button type="submit" disabled={loading} className="mobile-btn-text w-full bg-btn-primary text-white font-bold py-5 rounded-xl disabled:opacity-50">
                  {loading ? 'Signing in...' : 'Login'}
                </button>
              </form>
            )}
          </div>
          <footer className="py-4 text-center">
            <p className="text-xs text-gray-400">© 2026 CavinKare Ltd. All Rights Reserved.</p>
          </footer>
        </>
      ) : (
        <>
          <div className="flex-1 flex">
            <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
              <img src={require('../images/loginImage.png')} alt="Login Background" className="max-w-3xl w-full h-auto object-contain" />
            </div>
            <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-10 lg:p-8">
              <div className="w-full max-w-md">
                <div className="text-center mb-8">
                  <img src={require('../images/logo.png')} alt="CavinCare Logo" className="object-contain h-20 w-auto mx-auto mb-2" />
                </div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{showResetForm ? 'Reset Password' : 'Log in'}</h2>
                  {/* <p className="text-gray-500 text-sm">{showResetForm ? 'Set a new password for your account' : 'Welcome back! Please enter your details.'}</p> */}
                </div>

                {showResetForm ? (
                  <form className="space-y-5" onSubmit={handleResetPassword}>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                      <input type="password" value={getValues('password')} disabled className="w-full px-4 py-3.5 text-base border border-gray-200 rounded-xl bg-gray-100 text-gray-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPass ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          className="w-full px-4 py-3.5 pr-12 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          placeholder="Enter new password"
                        />
                        <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showNewPass ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Min 8 chars, uppercase, lowercase, number & special character</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPass ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="w-full px-4 py-3.5 pr-12 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          placeholder="Confirm new password"
                        />
                        <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showConfirmPass ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                        </button>
                      </div>
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs mt-1 text-red-600">Passwords do not match</p>
                      )}
                    </div>
                    <button type="submit" disabled={resetLoading} className="w-full bg-btn-primary text-white font-semibold py-3.5 px-4 rounded-xl text-base disabled:opacity-50">
                      {resetLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                      <input
                        {...register('email', {
                          required: 'Email is required',
                          pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email address' }
                        })}
                        type="email"
                        className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-base"
                        placeholder="Enter your email"
                        autoComplete="off"
                      />
                      {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                      <div className="relative">
                        <input
                          {...register('password', { required: 'Password is required' })}
                          type={showLoginPass ? 'text' : 'password'}
                          className="w-full px-4 py-3.5 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-base"
                          placeholder="••••••••"
                          autoComplete="off"
                        />
                        <button type="button" onClick={() => setShowLoginPass(!showLoginPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showLoginPass ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                        </button>
                      </div>
                      {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                    </div>
                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
                    )}
                    <button type="submit" disabled={loading} className="w-full bg-btn-primary text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-base mt-2">
                      {loading ? 'Signing in...' : 'Login'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
          <footer className="bg-white border-t border-gray-100 py-4">
            <div className="text-center">
              <p className="text-xs text-gray-400">© 2026 CavinKare Ltd. All Rights Reserved.</p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

export default Login;
