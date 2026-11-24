import { getErrorMessage } from '../utils/errors';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../components/manage-team.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import ProfileDropdown from '../components/ProfileDropdown';
import StatusBadge from '../components/StatusBadge';
import { showToast } from '../utils/toast';
import { ArrowLeft, X, Crown, ShieldCheck } from 'lucide-react';

const API_URL = API_BASE_URL;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [removingId, setRemovingId]   = useState<string | null>(null);

  // Read logged-in user from localStorage
  const storedUser = localStorage.getItem('user');
  let userName = 'User';
  let userRole = 'Member';
  try {
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      userName = parsed.name || parsed.full_name || parsed.email?.split('@')[0] || 'User';
      userRole = parsed.role || 'Member';
    }
  } catch { /* ignore */ }

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, membersRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/projects/${projectCode}`),
        fetchWithAuth(`${API_URL}/projects/${projectCode}/members`),
      ]);

      if (projRes.ok) {
        const projData = await projRes.json();
        setProjectName(projData.data?.name ?? '');
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.data ?? []);
      } else {
        throw new Error('Failed to load project members.');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, '') || 'Failed to load team data.');
    } finally {
      setLoading(false);
    }
  }, [projectCode]);

  useEffect(() => {
    if (projectCode) fetchRoster();
  }, [projectCode, fetchRoster]);

  // Remove member from project
  const handleRemove = async (memberId: string) => {
    if (!window.confirm('Remove this member from the project?')) return;
    setRemovingId(memberId);
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove member');
      showToast('Member removed from project.', 'info');
      fetchRoster();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, '') || 'Error removing member.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const getInitials = (name: string) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const avatarColors = ['#4f6ef7', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
  const getAvatarColor = (name: string) => avatarColors[(name || 'A').charCodeAt(0) % avatarColors.length];

  // Filtering
  const filteredMembers = members.filter((m) =>
    !searchQuery ||
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="main-content">
      <header className="pm-header">
        <div>
          <button
            type="button"
            className="pd-back-btn"
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate(projectCode ? `/projects/${projectCode}?tab=team` : '/projects');
              }
            }}
            title="Back to previous page"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#0f172a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
            Back
          </button>
        </div>
        <ProfileDropdown userName={userName} userRole={userRole} />
      </header>

      {/* Page Title */}
      <div className="mt-title-row">
        <div>
          <h1 className="mt-page-title">Project Team &amp; Roster</h1>
          <p className="mt-page-sub">
            {projectName ? `${projectName} (${projectCode})` : projectCode} — Manage team access and roster
          </p>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="mt-toolbar">
        <div className="mt-tabs-bar">
          <div className="mt-tab-btn mt-tab-btn--active" style={{ cursor: 'default' }}>
            <span>Active Project Team</span>
            <span className="mt-tab-badge">{members.length}</span>
          </div>
        </div>

        <div className="mt-search-wrap">
          <input
            type="text"
            className="mt-search-input"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="mt-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-content">
        {loading ? (
          <div className="mt-state">Loading project roster…</div>
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
            <p className="mt-empty-title">No team members joined yet</p>
            <p className="mt-empty-sub">
              Team members will appear here once they join using the project invite code from the project dashboard.
            </p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="mt-state">No matching team members found for "{searchQuery}".</div>
        ) : (
          <div className="mt-table-wrap">
            <table className="mt-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Joined Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => (
                  <tr key={m.id} style={m.role === 'Owner' ? { background: '#fffbeb' } : undefined}>
                    <td>
                      <div className="mt-member-cell">
                        <span className="mt-avatar" style={{ background: m.role === 'Owner' ? '#f59e0b' : getAvatarColor(m.name) }}>
                          {getInitials(m.name)}
                        </span>
                        <div>
                          <span className="mt-member-name">{m.name} {m.role === 'Owner' && <Crown size={14} style={{ color: '#f59e0b', verticalAlign: '-2px', marginLeft: 4 }} />}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="mt-role-chip" style={m.role === 'Owner' ? { background: '#fef3c7', color: '#b45309', fontWeight: 700 } : undefined}>
                        {m.role === 'Owner' ? <><ShieldCheck size={13} style={{ verticalAlign: '-2px', marginRight: 3 }} /> Project Owner</> : m.role}
                      </span>
                    </td>
                    <td className="mt-email">{m.email || '—'}</td>
                    <td className="mt-joined">
                      {m.joined_at
                        ? new Date(m.joined_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td>
                      <StatusBadge status="Active" />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {m.role === 'Owner' ? (
                        <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Owner</span>
                      ) : (
                        <button
                          className="mt-remove-btn"
                          onClick={() => handleRemove(m.id)}
                          disabled={removingId === m.id}
                        >
                          {removingId === m.id ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
};

export default ManageTeam;
