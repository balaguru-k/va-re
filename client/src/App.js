import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { TimerProvider } from './contexts/TimerContext';
import Layout from './components/Layout/Layout';
import PageHeader from './components/UI/PageHeader';
import ExecutiveChecklistForm from './pages/ExecutiveChecklistForm';
import ExecutiveCompletedChecklists from './pages/ExecutiveCompletedChecklists';
import ExecutiveViewChecklist from './pages/ExecutiveViewChecklist';
import ExecutiveSCAuditTrail from './pages/ExecutiveSCAuditTrail';
import ExecutiveSCAuditTrailView from './pages/ExecutiveSCAuditTrailView';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import History from './pages/History';
import HistoryDetails from './pages/HistoryDetails';
import Checklists from './pages/Checklists';
import EditChecklist from './pages/EditChecklist';
import ChecklistForm from './pages/ChecklistForm';
import ChecklistData from './pages/ChecklistData';
import ViewChecklist from './pages/ViewChecklist';
import ChecklistView from './pages/ChecklistView';
import Roster from './pages/Roster';
import AdminRoster from './pages/AdminRoster';
import RandomChecklist from './pages/RandomChecklist';
import AdminDashboard from './pages/AdminDashboard';
import AdminAnalyticsDashboard from './pages/AdminAnalyticsDashboard';
import HeadDashboard from './pages/HeadDashboard';
import SupervisorChecklistData from './pages/SupervisorChecklistData';
import NCReport from './pages/Reports/NCReport';
import SupervisorRoster from './pages/SupervisorRoster';
import SupervisorChecklistForm from './pages/SupervisorChecklistForm';
import SupervisorViewChecklist from './pages/SupervisorViewChecklist';
import ManagerChecklistForm from './pages/ManagerChecklistForm';
import ManagerChecklistData from './pages/ManagerChecklistData';
import ManagerChecklistView from './pages/ManagerChecklistView';
import AdminChecklistView from './pages/AdminChecklistView';
import SupervisorReport from './pages/SupervisorReport';
import SupervisorChecklistReport from './pages/SupervisorChecklistReport';
import ReasonAnalysisReport from './pages/Reports/ReasonAnalysisReport';
import ChecklistItemsReport from './pages/Reports/ChecklistItemsReport';
import UserStatusReport from './pages/Reports/UserStatusReport';
import ManagerSupervisorNCReport from './pages/Reports/ManagerSupervisorNCReport';
import AuditStatusReport from './pages/Reports/AuditStatusReport';
import MailTrackerReport from './pages/Reports/MailTrackerReport';
import ChecklistScoreReport from './pages/Reports/ChecklistScoreReport';
import WeeklyNCReport from './pages/Reports/WeeklyNCReport';
import NCReports from './pages/NCReports';
import ComplaintsList from './pages/Complaints/ComplaintsList';
import ComplaintForm from './pages/Complaints/ComplaintForm';
import Tickets from './pages/Tickets';
import ComplianceDashboard from './pages/ComplianceDashboard';
import ComplianceMasters from './pages/ComplianceMasters';
import ComplianceTicketEdit from './pages/ComplianceTicketEdit';
import ComplianceUserDashboard from './pages/ComplianceUserDashboard';
import ComplianceNewTickets from './pages/ComplianceNewTickets';
import CompliancePendingTickets from './pages/CompliancePendingTickets';
import ComplianceInProgressTickets from './pages/ComplianceInProgressTickets';
import ComplianceCompletedTickets from './pages/ComplianceCompletedTickets';
import ComplianceAdminTickets from './pages/ComplianceAdminTickets';
import ComplianceTicketsReport from './pages/ComplianceTicketsReport';
import VAReport from './pages/VAReport';
import BusinessReport from './pages/BusinessReport';
import Masters from './pages/Masters';
import LeadAuditorForm from './pages/LeadAuditorForm';
import LeadAuditorFormData from './pages/LeadAuditorFormData';
import LeadAuditorFormDataView from './pages/LeadAuditorFormDataView';
import AuditorQcForm from './pages/AuditorQcForm';
import AuditorQcFormView from './pages/AuditorQcFormView';
import RotationRoster from './pages/RotationRoster';

const queryClient = new QueryClient();

const isMobile = window.innerWidth <= 768;
const MOBILE_ALLOWED_ROLES = ['Vendor', 'Engineer'];
const MOBILE_PARTIAL_ROLES = ['Supervisor', 'Manager'];
const MOBILE_PARTIAL_ALLOWED_PATHS = [
  '/dashboard',
  '/supervisor-checklist',
  '/manager-checklist',
];

// Blocks non-allowed roles on mobile, shows modal popup
const MobileGuard = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (isMobile && user && !MOBILE_ALLOWED_ROLES.includes(user.role)) {
    // Supervisor/Manager: allow only specific paths
    if (MOBILE_PARTIAL_ROLES.includes(user.role)) {
      const isAllowed = MOBILE_PARTIAL_ALLOWED_PATHS.some(p => location.pathname.startsWith(p));
      if (isAllowed) return children;
    }

    return (
      <>
        {children}
        {/* Modal popup over the page */}
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-5xl mb-4">🚫</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Mobile Access Not Available</h2>
            <p className="text-sm text-gray-500 mb-6">This portal is not supported on mobile for your role. Please use a desktop browser.</p>
            <button
              onClick={() => logout()}
              className="w-full py-3 bg-red-600 text-white text-base font-semibold rounded-xl"
            >
              Logout
            </button>
          </div>
        </div>
      </>
    );
  }

  return children;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const RoleGuard = ({ allowedRoles, children }) => {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role?.trim())) {
    return <Navigate to="/dashboard" />;
  }
  return children;
};

const AppRoutes = () => {
  return (
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics-dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminAnalyticsDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/head/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <HeadDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Layout>
              <Users />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <Layout>
              <History />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <HistoryDetails />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklists"
        element={
          <ProtectedRoute>
            <Layout>
              <Checklists />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklist/:id/edit"
        element={
          <ProtectedRoute>
            <Layout>
              <EditChecklist />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklist/:id/form"
        element={
          <ProtectedRoute>
            <Layout>
              <ChecklistForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/executive/checklist/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ExecutiveChecklistForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/executive/checklist-data"
        element={
          <ProtectedRoute>
            <Layout>
              <ExecutiveCompletedChecklists />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/executive/checklist/:id/view"
        element={
          <ProtectedRoute>
            <Layout>
              <ExecutiveViewChecklist />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/executive/sc-audit-trail"
        element={
          <ProtectedRoute>
            <Layout>
              <ExecutiveSCAuditTrail />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/executive/sc-audit-trail/:id/view"
        element={
          <ProtectedRoute>
            <Layout>
              <ExecutiveSCAuditTrailView />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/roster"
        element={
          <ProtectedRoute>
            <Layout>
              <Roster />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-roster"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminRoster />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/random-checklist"
        element={
          <ProtectedRoute>
            <Layout>
              <RandomChecklist />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklist-data"
        element={
          <ProtectedRoute>
            <Layout>
              <ChecklistData />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklist/:id/view"
        element={
          <ProtectedRoute>
            <Layout>
              <ChecklistView />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklist/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ViewChecklist />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisor/checklists/:id/data"
        element={
          <ProtectedRoute>
            <Layout>
              <SupervisorChecklistData />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/ncs"
        element={
          <ProtectedRoute>
            <Layout>
              <NCReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/analysis"
        element={
          <ProtectedRoute>
            <Layout>
              <ReasonAnalysisReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/items"
        element={
          <ProtectedRoute>
            <Layout>
              <ChecklistItemsReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/users-status"
        element={
          <ProtectedRoute>
            <Layout>
              <UserStatusReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/manager-supervisor-ncs"
        element={
          <ProtectedRoute>
            <Layout>
              <ManagerSupervisorNCReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/audit-status"
        element={
          <ProtectedRoute>
            <Layout>
              <AuditStatusReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/mail-tracker"
        element={
          <ProtectedRoute>
            <Layout>
              <MailTrackerReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/checklist-scores"
        element={
          <ProtectedRoute>
            <Layout>
              <ChecklistScoreReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/weekly-nc"
        element={
          <ProtectedRoute>
            <Layout>
              <WeeklyNCReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/supervisor-report"
        element={
          <ProtectedRoute>
            <Layout>
              <SupervisorReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/supervisor-checklist-report"
        element={
          <ProtectedRoute>
            <Layout>
              <SupervisorChecklistReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisor-checklist-data"
        element={
          <ProtectedRoute>
            <Layout>
              <SupervisorChecklistData />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisor-roster"
        element={
          <ProtectedRoute>
            <Layout>
              <SupervisorRoster />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisor-checklist/:id/form"
        element={
          <ProtectedRoute>
            <Layout>
              <SupervisorChecklistForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisor-checklist/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <SupervisorViewChecklist />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager-checklist/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ManagerChecklistForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager-checklist-data"
        element={
          <ProtectedRoute>
            <Layout>
              <ManagerChecklistData />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager-checklist/:id/view"
        element={
          <ProtectedRoute>
            <Layout>
              <ManagerChecklistView />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/checklist/:checklistId/view"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminChecklistView />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklist-status"
        element={
          <ProtectedRoute>
            <Layout>
              <div className="space-y-6">
                <PageHeader title="Checklist Status" />
                <p className="text-gray-600">Coming soon...</p>
              </div>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/camera-count"
        element={
          <ProtectedRoute>
            <Layout>
              <div className="space-y-6">
                <PageHeader title="Camera Count" />
                <p className="text-gray-600">Coming soon...</p>
              </div>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/login-report"
        element={
          <ProtectedRoute>
            <Layout>
              <div className="space-y-6">
                <PageHeader title="Login Report" />
                <p className="text-gray-600">Coming soon...</p>
              </div>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manifests"
        element={
          <ProtectedRoute>
            <Layout>
              <div className="space-y-6">
                <PageHeader title="Manifests" />
                <p className="text-gray-600">Coming soon...</p>
              </div>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/va-report"
        element={
          <ProtectedRoute>
            <Layout>
              <VAReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/daily-nc-reports"
        element={
          <ProtectedRoute>
            <Layout>
              <NCReports />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/business-report"
        element={
          <ProtectedRoute>
            <Layout>
              <BusinessReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters"
        element={
          <ProtectedRoute>
            <Layout>
              <Masters />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Layout>
              <div className="space-y-6">
                <PageHeader title="Reports" />
                <p className="text-gray-600">Coming soon...</p>
              </div>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets"
        element={
          <ProtectedRoute>
            <Layout>
              <Tickets />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplianceDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/ticket/:id/edit"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplianceTicketEdit />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/masters"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplianceMasters />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/my-tickets"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplianceUserDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/new-tickets"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplianceNewTickets />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/pending-tickets"
        element={
          <ProtectedRoute>
            <Layout>
              <CompliancePendingTickets />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/in-progress-tickets"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplianceInProgressTickets />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/completed-tickets"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplianceCompletedTickets />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/admin-tickets"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplianceAdminTickets />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance/tickets-report"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplianceTicketsReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/lead-auditor/form"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['Lead-Auditor']}>
              <Layout>
                <LeadAuditorForm />
              </Layout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/lead-auditor/form-data"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['Lead-Auditor']}>
              <Layout>
                <LeadAuditorFormData />
              </Layout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/lead-auditor/form-data/:id"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['Lead-Auditor']}>
              <Layout>
                <LeadAuditorFormDataView />
              </Layout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditor/qc-form"
        element={
          <ProtectedRoute>
            <Layout>
              <AuditorQcForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditor/qc-form/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <AuditorQcFormView />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rotation-roster"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['Super Admin', 'Lead-Auditor']}>
              <Layout>
                <RotationRoster />
              </Layout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/complaints/checklist"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplaintsList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/complaints/camera"
        element={
          <ProtectedRoute>
            <Layout>
              <ComplaintForm />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TimerProvider>
        <AuthProvider>
          <SidebarProvider>
            <Router>
              <MobileGuard>
                <div className="App">
                  <AppRoutes />
                  <Toaster position="top-right" />
                </div>
              </MobileGuard>
            </Router>
          </SidebarProvider>
        </AuthProvider>
      </TimerProvider>
    </QueryClientProvider>
  );
}

export default App;
