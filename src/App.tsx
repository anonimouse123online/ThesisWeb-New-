import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects'; 
import Sidebar from './components/Sidebar';
import ProjectDetails from './pages/ProjectDetails';
import Task from './pages/Task';
import CreateTask from './pages/CreateTask';
import TimeLog from './pages/TimeLog';
import ResourceManagement from './pages/Resourcemanagement';
import UserManagement from './pages/UserManagement';
import RegisterPage from './pages/RegisterPage';
import ManageTeam from './pages/ManageTeam';
import Documents from './pages/Documents';
import NotFound from './pages/NotFound';
import ProjectProgress from './pages/ProjectProgress';
import IssueReport from './pages/IssueReport';
import ProjectReports from './pages/ProjectReports';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastContainer } from './components/Toast';

// ─── Layout wrapper for authenticated pages ─────────────────────────────────
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="dashboard-wrapper">
        <Sidebar />
        {children}
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Router>
      <ToastContainer />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<AuthLayout><Dashboard /></AuthLayout>} />
        <Route path="/projects" element={<AuthLayout><Projects /></AuthLayout>} />
        <Route path="/projects/:projectId" element={<AuthLayout><ProjectDetails /></AuthLayout>} />
        <Route path="/task/:taskId" element={<AuthLayout><Task /></AuthLayout>} />
        <Route path="/tasks" element={<AuthLayout><Task /></AuthLayout>} />
        <Route path="/tasks/new" element={<AuthLayout><CreateTask /></AuthLayout>} />
        <Route path="/timelog" element={<AuthLayout><TimeLog /></AuthLayout>} />
        <Route path="/resources" element={<AuthLayout><ResourceManagement /></AuthLayout>} />
        <Route path="/users" element={<AuthLayout><UserManagement /></AuthLayout>} />
        <Route path="/settings" element={<AuthLayout><Settings /></AuthLayout>} />
        <Route path="/projects/:projectCode/team" element={<AuthLayout><ManageTeam /></AuthLayout>} />
        <Route path="/projects/:projectCode/documents" element={<AuthLayout><Documents /></AuthLayout>} />
        <Route path="/projects/:projectCode/progress" element={<AuthLayout><ProjectProgress /></AuthLayout>} />
        <Route path="/projects/:projectCode/issues/report" element={<AuthLayout><IssueReport /></AuthLayout>} />
        <Route path="/projects/:projectCode/reports" element={<AuthLayout><ProjectReports /></AuthLayout>} />

        {/* 404 catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}