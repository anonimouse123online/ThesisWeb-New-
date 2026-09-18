import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import Notification from './pages/Notification';
import Messages from './pages/Messages';

import ProtectedRoute from './components/ProtectedRoute';
import { ToastContainer } from './components/Toast';

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

        {/* PUBLIC ROUTES */}

        <Route path="/" element={<LoginPage />} />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/signup"
          element={<RegisterPage />}
        />


        {/* DASHBOARD */}

        <Route
          path="/dashboard"
          element={
            <AuthLayout>
              <Dashboard />
            </AuthLayout>
          }
        />


        {/* PROJECTS */}

        <Route
          path="/projects"
          element={
            <AuthLayout>
              <Projects />
            </AuthLayout>
          }
        />

        <Route
          path="/projects/:projectId"
          element={
            <AuthLayout>
              <ProjectDetails />
            </AuthLayout>
          }
        />


        {/* TASKS */}

        <Route
          path="/task/:taskId"
          element={
            <Navigate
              to="/projects"
              replace
            />
          }
        />

        <Route
          path="/tasks"
          element={
            <AuthLayout>
              <Task />
            </AuthLayout>
          }
        />

        <Route
          path="/tasks/new"
          element={
            <AuthLayout>
              <CreateTask />
            </AuthLayout>
          }
        />


        {/* TIME LOG */}

        <Route
          path="/timelog"
          element={
            <AuthLayout>
              <TimeLog />
            </AuthLayout>
          }
        />


        {/* RESOURCES */}

        <Route
          path="/resources"
          element={
            <AuthLayout>
              <ResourceManagement />
            </AuthLayout>
          }
        />


        {/* USERS */}

        <Route
          path="/users"
          element={
            <AuthLayout>
              <UserManagement />
            </AuthLayout>
          }
        />


        {/* MESSAGES */}

        <Route
          path="/messages"
          element={
            <AuthLayout>
              <Messages />
            </AuthLayout>
          }
        />


        {/* NOTIFICATIONS */}

        <Route
          path="/notifications"
          element={
            <AuthLayout>
              <Notification />
            </AuthLayout>
          }
        />


        {/* SETTINGS */}

        <Route
          path="/settings"
          element={
            <AuthLayout>
              <Settings />
            </AuthLayout>
          }
        />


        {/* PROJECT TEAM */}

        <Route
          path="/projects/:projectCode/team"
          element={
            <AuthLayout>
              <ManageTeam />
            </AuthLayout>
          }
        />


        {/* PROJECT DOCUMENTS */}

        <Route
          path="/projects/:projectCode/documents"
          element={
            <AuthLayout>
              <Documents />
            </AuthLayout>
          }
        />


        {/* PROJECT PROGRESS */}

        <Route
          path="/projects/:projectCode/progress"
          element={
            <AuthLayout>
              <ProjectProgress />
            </AuthLayout>
          }
        />


        {/* ISSUE REPORT */}

        <Route
          path="/projects/:projectCode/issues/report"
          element={
            <AuthLayout>
              <IssueReport />
            </AuthLayout>
          }
        />


        {/* PROJECT REPORTS */}

        <Route
          path="/projects/:projectCode/reports"
          element={
            <AuthLayout>
              <ProjectReports />
            </AuthLayout>
          }
        />


        {/* 404 */}

        <Route
          path="*"
          element={<NotFound />}
        />

      </Routes>
    </Router>
  );
}