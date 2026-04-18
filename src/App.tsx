import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects'; // 1. Import the new Projects page
import Sidebar from './components/Sidebar';
import ProjectDetails from './pages/ProjectDetails';
import Task from './pages/Task';
import CreateTask from './pages/CreateTask';
import TimeLog from '../src/pages/TimeLog';
import ResourceManagement from '../src/pages/Resourcemanagement';
import UserManagement from './pages/UserManagement';
import RegisterPage from './pages/RegisterPage';
import ManageTeam from './pages/manage-team';
import Documents from './pages/Documents';


export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<RegisterPage />} />
        <Route 
          path="/dashboard" 
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <Dashboard />
            </div>
          } 
        />

        <Route 
          path="/projects" 
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <Projects />
            </div>
          } 
        />
        <Route 
          path="/projects/:projectId" 
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <ProjectDetails />
            </div>
          } 
        />
        <Route 
          path="/task/:taskId" 
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <Task/>
            </div>
          } 
        />
        <Route 
          path="/tasks" 
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <Task />
            </div>
          } 
        />
        <Route 
          path="/tasks/new" 
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <CreateTask />
            </div>
          } 
        />
        <Route 
          path="/timelog" 
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <TimeLog />
            </div>
          } 
        />
        <Route 
          path="/resources" 
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <ResourceManagement />
            </div>
          } 
        />
        <Route
          path="/users"
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <UserManagement />
            </div>
          }
        />
        <Route 
          path="/projects/:projectCode/team"
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <ManageTeam />
            </div>
          }
        />
        <Route 
          path="/projects/:projectCode/documents"
          element={
            <div className="dashboard-wrapper">
              <Sidebar />
              <Documents />
            </div>
          }
        />
      </Routes>
    </Router>
  );
}