import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AddMemberModal from './add-member';
import '../components/manage-team.css';

const API_URL = import.meta.env.VITE_BACKEND_URL;

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  joined_at: string;
}

const ManageTeam: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState<string>('');
  const [members, setMembers]         = useState<TeamMember[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId]   = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, membersRes] = await Promise.all([
        fetch(`${API_URL}/projects/${projectCode}`),
        fetch(`${API_URL}/projects/${projectCode}/members`),
      ]);
      if (projRes.ok) {
        const projData = await projRes.json();
        setProjectName(projData.data?.name ?? '');
      }
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.data ?? []);
      } else {
        throw new Error('Failed to load team members.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectCode) fetchMembers();
  }, [projectCode]);

  const handleRemove = async (memberId: string) => {
    if (!window.confirm('Remove this member from the project?')) return;
    setRemovingId(memberId);
    try {
      const res = await fetch(`${API_URL}/projects/${projectCode}/members/${memberId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove member');
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRemovingId(null);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  const avatarColors = ['#4f6ef7','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#db2777','#65a30d'];
  const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

  return (
    <main className="main-content">
      <header className="pm-header">
        <div>
          <button className="pd-back-btn" onClick={() => navigate(`/projects/${projectCode}`)}>
            ← Back to Project Overview
          </button>
        </div>
        <div className="pm-profile">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" alt="Alex" className="user-avatar" />
          <div className="profile-info">
            <p className="profile-name">Alex meian</p>
            <p className="profile-role">Product manager</p>
          </div>
          <span className="chevron">▾</span>
        </div>
      </header>

      <div className="mt-title-row">
        <div>
          <h1 className="mt-page-title">Project Team</h1>
          <p className="mt-page-sub">{projectName || projectCode}</p>
        </div>
        <button className="mt-add-btn" onClick={() => setShowAddModal(true)}>
          + Add Member
        </button>
      </div>

      <div className="mt-content">
        {loading ? (
          <div className="mt-state">Loading team…</div>
        ) : error ? (
          <div className="mt-state mt-state--error">{error}</div>
        ) : members.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="mt-empty-title">No team members yet</p>
            <p className="mt-empty-sub">Add engineers and workers to this project to get started.</p>
            <button className="mt-add-btn mt-add-btn--center" onClick={() => setShowAddModal(true)}>
              + Add First Member
            </button>
          </div>
        ) : (
          <div className="mt-table-wrap">
            <table className="mt-table">
              <thead>
                <tr>
                  <th>Member</th><th>Role</th><th>Email</th><th>Joined</th><th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="mt-member-cell">
                        <span className="mt-avatar" style={{ background: getAvatarColor(m.name) }}>
                          {getInitials(m.name)}
                        </span>
                        <span className="mt-member-name">{m.name}</span>
                      </div>
                    </td>
                    <td><span className="mt-role-chip">{m.role}</span></td>
                    <td className="mt-email">{m.email || '—'}</td>
                    <td className="mt-joined">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      <button className="mt-remove-btn" onClick={() => handleRemove(m.id)} disabled={removingId === m.id}>
                        {removingId === m.id ? '…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && projectCode && (
        <AddMemberModal
          projectCode={projectCode}
          onClose={() => setShowAddModal(false)}
          onAdded={fetchMembers}
        />
      )}
    </main>
  );
};

export default ManageTeam;