import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../components/ProjectDetails.css';

const API_URL = import.meta.env.VITE_BACKEND_URL;

interface Project {
  id: string;
  code: string;
  name: string;
  location: string;
  client: string;
  due_date: string;
  status: string;
  progress: string;
}

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`${API_URL}/projects/${projectId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch project');
        setProject(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) fetchProject();
  }, [projectId]);

  if (loading) return <div className="rm-empty">Loading project...</div>;
  if (error)   return <div className="rm-empty" style={{ color: 'red' }}>{error}</div>;
  if (!project) return <div className="rm-empty">Project not found.</div>;

  return (
    <main className="main-content">
      <header className="header-top">
        <div className="flex items-center gap-4">
          <div className="back-btn" onClick={() => navigate('/projects')}>‹</div>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="profile-section">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"
              alt="Alex"
              className="user-avatar"
            />
            <div className="profile-info">
              <p className="profile-name">Alex meian</p>
              <p className="profile-role">Product manager</p>
            </div>
            <span className="chevron">▾</span>
          </div>
        </div>
      </header>

      <div className="data-container detail-view-container">
        <button className="back-to-projects" onClick={() => navigate('/projects')}>
          ← Back To Projects
        </button>

        <div className="project-header-info">
          <h2 className="detail-title">Project Title: <span>{project.name}</span></h2>
          <p className="detail-meta">Project Code: {project.code}</p>
          <p className="detail-meta">Location: {project.location}</p>
          <p className="detail-meta">Client: {project.client}</p>
          <p className="detail-meta">Due Date: {project.due_date}</p>
          <p className="detail-meta">Status: {project.status}</p>
          <p className="detail-meta">Progress: {project.progress}</p>
        </div>

        <div className="details-grid">
          <div className="detail-stat-card">
            <div className="detail-icon-box purple">👤</div>
            <p className="detail-label">Manpower On-Site:</p>
            <h3 className="detail-value">42 / 50</h3>
            <span className="detail-subtext">Personnel</span>
          </div>

          <div className="detail-stat-card">
            <div className="detail-icon-box purple">📍</div>
            <p className="detail-label">Geofence Status</p>
            <h3 className="detail-value active-status">Active</h3>
          </div>

          <div className="detail-stat-card">
            <div className="detail-icon-box purple">📍</div>
            <p className="detail-label">Geofence Status</p>
            <h3 className="detail-value active-status">Active</h3>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ProjectDetails;