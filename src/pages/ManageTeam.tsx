import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AddMemberModal from './add-member';
import '../components/manage-team.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import ProfileDropdown from '../components/ProfileDropdown';
import { showToast } from '../components/Toast';
import { ArrowLeft, ArrowRight, X, UserPlus, Check, CheckCircle2, Clock } from 'lucide-react';

const API_URL = API_BASE_URL;

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  joined_at: string;
}

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ManageTeam: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();

  const [projectName, setProjectName]             = useState<string>('');
  const [members, setMembers]                     = useState<TeamMember[]>([]);
  const [availableMembers, setAvailableMembers]   = useState<AvailableUser[]>([]);
  const [activeTab, setActiveTab]                 = useState<'active' | 'available'>('active');
  const [searchQuery, setSearchQuery]             = useState('');
  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState<string | null>(null);
  const [showAddModal, setShowAddModal]           = useState(false);
  const [showInviteModal, setShowInviteModal]     = useState(false);
  const [inviteCode, setInviteCode]               = useState<string | null>(null);
  const [inviteLoading, setInviteLoading]         = useState(false);
  const [copied, setCopied]                       = useState(false);
  const [removingId, setRemovingId]               = useState<string | null>(null);
  const [addingId, setAddingId]                   = useState<string | null>(null);

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

  const fetchRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, membersRes, availRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/projects/${projectCode}`),
        fetchWithAuth(`${API_URL}/projects/${projectCode}/members`),
        fetchWithAuth(`${API_URL}/projects/${projectCode}/available-members`),
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

      if (availRes.ok) {
        const availData = await availRes.json();
        setAvailableMembers(availData.data ?? []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectCode) fetchRoster();
  }, [projectCode]);

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
    } catch (err: any) {
      showToast(err.message || 'Error removing member.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  // Add registered user directly to project
  const handleAddDirect = async (user: AvailableUser) => {
    setAddingId(user.id);
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, role: user.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add member');

      showToast(`${user.name} added to project!`, 'success');
      await fetchRoster();
    } catch (err: any) {
      showToast(err.message || 'Error adding member.', 'error');
    } finally {
      setAddingId(null);
    }
  };

  // Generate / View project invite code
  const handleOpenInviteModal = async () => {
    setShowInviteModal(true);
    setCopied(false);
    setInviteLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/generate-code`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setInviteCode(data.code);
      } else {
        throw new Error(data.message || 'Failed to generate invite code');
      }
    } catch (err: any) {
      showToast(err.message || 'Could not generate code', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    showToast('Invite code copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
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

  const filteredAvailable = availableMembers.filter((u) =>
    !searchQuery ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
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

      {/* Page Title & Quick Actions */}
      <div className="mt-title-row">
        <div>
          <h1 className="mt-page-title">Project Team &amp; Roster</h1>
          <p className="mt-page-sub">
            {projectName ? `${projectName} (${projectCode})` : projectCode} — Manage team access and invitations
          </p>
        </div>
        <div className="mt-actions-group">
          <button className="mt-invite-btn" onClick={handleOpenInviteModal} title="Generate or share invite code" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <UserPlus size={14} /> Invite Code
          </button>
          <button className="mt-add-btn" onClick={() => setShowAddModal(true)}>
            + Add Member
          </button>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="mt-toolbar">
        <div className="mt-tabs-bar">
          <button
            className={`mt-tab-btn ${activeTab === 'active' ? 'mt-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            <span>Active Project Team</span>
            <span className="mt-tab-badge">{members.length}</span>
          </button>
          <button
            className={`mt-tab-btn ${activeTab === 'available' ? 'mt-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('available')}
          >
            <span>Available Accounts</span>
            <span className="mt-tab-badge mt-tab-badge--avail">{availableMembers.length}</span>
          </button>
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
        ) : activeTab === 'active' ? (
          /* TAB 1: ACTIVE PROJECT TEAM */
          members.length === 0 ? (
            <div className="mt-empty">
              <div className="mt-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="mt-empty-title">No team members assigned yet</p>
              <p className="mt-empty-sub">
                {availableMembers.length > 0
                  ? `There are ${availableMembers.length} registered team members ready to be added to this project, or you can share an invite code.`
                  : 'Add engineers and site personnel to this project or generate an invite code.'}
              </p>
              <div className="mt-empty-actions">
                {availableMembers.length > 0 && (
                  <button className="mt-add-btn mt-add-btn--center" onClick={() => setActiveTab('available')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    Browse Available Members ({availableMembers.length}) <ArrowRight size={14} />
                  </button>
                )}
                <button className="mt-invite-btn" onClick={handleOpenInviteModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <UserPlus size={15} /> Generate Invite Code
                </button>
              </div>
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
                    <tr key={m.id}>
                      <td>
                        <div className="mt-member-cell">
                          <span className="mt-avatar" style={{ background: getAvatarColor(m.name) }}>
                            {getInitials(m.name)}
                          </span>
                          <div>
                            <span className="mt-member-name">{m.name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="mt-role-chip">{m.role}</span>
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
                        <span className="mt-status-tag mt-status-tag--active" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                          Active
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="mt-remove-btn"
                          onClick={() => handleRemove(m.id)}
                          disabled={removingId === m.id}
                        >
                          {removingId === m.id ? 'Removing…' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* TAB 2: AVAILABLE REGISTERED ACCOUNTS */
          availableMembers.length === 0 ? (
            <div className="mt-empty">
              <div className="mt-empty-icon"><CheckCircle2 size={40} style={{ color: '#16a34a' }} /></div>
              <p className="mt-empty-title">All registered members are in this project</p>
              <p className="mt-empty-sub">
                Every registered user in the system has already been added to {projectName || projectCode}.
              </p>
            </div>
          ) : filteredAvailable.length === 0 ? (
            <div className="mt-state">No matching registered accounts found for "{searchQuery}".</div>
          ) : (
            <div className="mt-table-wrap">
              <div className="mt-section-intro">
                <div>
                  <h3 className="mt-section-h3">Registered Accounts Ready to Join</h3>
                  <p className="mt-section-sub">
                    These users have registered accounts in SitePulse. Click <strong>+ Add to Project</strong> to give them immediate access.
                  </p>
                </div>
              </div>
              <table className="mt-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>System Role</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAvailable.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="mt-member-cell">
                          <span className="mt-avatar" style={{ background: getAvatarColor(u.name) }}>
                            {getInitials(u.name)}
                          </span>
                          <div>
                            <span className="mt-member-name">{u.name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="mt-role-chip">{u.role || 'Member'}</span>
                      </td>
                      <td className="mt-email">{u.email}</td>
                      <td>
                        <span className="mt-status-tag mt-status-tag--avail">Ready to Join</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="mt-add-direct-btn"
                          onClick={() => handleAddDirect(u)}
                          disabled={addingId === u.id}
                        >
                          {addingId === u.id ? 'Adding…' : '+ Add to Project'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && projectCode && (
        <AddMemberModal
          projectCode={projectCode}
          onClose={() => setShowAddModal(false)}
          onAdded={fetchRoster}
        />
      )}

      {/* Invite Code Modal */}
      {showInviteModal && (
        <div className="mt-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="mt-modal mt-modal--invite" onClick={(e) => e.stopPropagation()}>
            <div className="mt-modal-header">
              <h2 className="mt-modal-title">Project Invite Code</h2>
              <button className="mt-modal-close" onClick={() => setShowInviteModal(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="mt-modal-body">
              <p className="mt-invite-info">
                Share this unique 6-character code with site engineers and field personnel. They can enter it in the <strong>SitePulse Mobile App</strong> or portal to join <strong>{projectName || projectCode}</strong> instantly.
              </p>

              {inviteLoading ? (
                <div className="mt-invite-loading">Generating secure invite code…</div>
              ) : (
                <div className="mt-invite-box">
                  <span className="mt-invite-code-text">{inviteCode || 'CODE-ERR'}</span>
                  <button className="mt-copy-btn" onClick={handleCopyCode} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {copied ? <><Check size={14} /> Copied</> : 'Copy Code'}
                  </button>
                </div>
              )}

              <p className="mt-invite-note" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={13} /> Codes are valid for 7 days and can be used by team members to join directly.
              </p>
            </div>
            <div className="mt-modal-footer">
              <button className="mt-btn-add" onClick={() => setShowInviteModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default ManageTeam;