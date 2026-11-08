import { getErrorMessage } from '../utils/errors';
import React, { useState, useEffect } from 'react';
import '../components/add-member.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';

const API_URL = API_BASE_URL;

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string; // e.g. "Civil Engineer"
}

interface AddMemberModalProps {
  projectCode: string;
  onClose: () => void;
  onAdded: () => void; // refetch members after adding
}

const ROLE_SUGGESTIONS = [
  'Site Engineer',
  'Project Engineer',
  'Safety Officer',
  'QA/QC Engineer',
  'Lead Architect',
  'MEP Coordinator',
  'Structural Engineer',
  'Foreman',
];

const AddMemberModal: React.FC<AddMemberModalProps> = ({
  projectCode,
  onClose,
  onAdded,
}) => {
  const [users, setUsers]           = useState<AvailableUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleInput, setRoleInput]   = useState<string>('');
  const [adding, setAdding]         = useState(false);

  // ── Fetch available users (not yet in this project) ──
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth(
          `${API_URL}/projects/${projectCode}/available-members`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Failed to load users');
        setUsers(data.data ?? []);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [projectCode]);

  // ── Group by role ──
  const grouped = users.reduce<Record<string, AvailableUser[]>>((acc, user) => {
    const key = user.role || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(user);
    return acc;
  }, {});

  // ── Handle user selection ──
  const handleSelectUser = (user: AvailableUser) => {
    if (selectedId === user.id) {
      setSelectedId(null);
      setRoleInput('');
    } else {
      setSelectedId(user.id);
      const sysRole = (user.role || '').toLowerCase();
      const defaultRole = sysRole.includes('engineer')
        ? 'Site Engineer'
        : sysRole.includes('architect')
          ? 'Lead Architect'
          : sysRole.includes('admin')
            ? 'Project Manager'
            : user.role || 'Site Engineer';
      setRoleInput(defaultRole);
    }
  };

  // ── Add selected user to project ──
  const handleAdd = async () => {
    if (!selectedId) return;
    setAdding(true);
    try {
      const res = await fetchWithAuth(
        `${API_URL}/projects/${projectCode}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedId, role: roleInput.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to add member');
      onAdded();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="am-overlay"
    >
      <div
        className="am-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="am-title"
      >
        {/* ── Header ── */}
        <div className="am-header">
          <div>
            <h2 className="am-title" id="am-title">Add Members</h2>
            <p className="am-subtitle">Select someone who's suitable for the job</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="am-body">
          {loading ? (
            <p className="am-state">Loading available members…</p>
          ) : error ? (
            <p className="am-state am-state--error">{error}</p>
          ) : users.length === 0 ? (
            <p className="am-state">No available members to add.</p>
          ) : (
            Object.entries(grouped).map(([role, members]) => (
              <div key={role} className="am-group">
                <p className="am-group-label">{role}</p>
                {members.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`am-user-row ${selectedId === user.id ? 'am-user-row--selected' : ''}`}
                    onClick={() => handleSelectUser(user)}
                  >
                    <span className="am-user-name">{user.name}</span>
                    <span className="am-user-email">{user.email}</span>
                    <span className="am-user-phone">{user.phone}</span>
                  </button>
                ))}
              </div>
            ))
          )}

          {selectedId && (
            <div style={{ marginTop: '16px', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Project Role / Position <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Site Engineer, Lead Architect, QA/QC Inspector..."
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                {ROLE_SUGGESTIONS.map((role) => {
                  const isSelected = roleInput.trim().toLowerCase() === role.toLowerCase();
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleInput(role)}
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #ea580c' : '1px solid #e2e8f0',
                        background: isSelected ? '#fff7ed' : '#ffffff',
                        color: isSelected ? '#c2410c' : '#475569',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="am-footer">
          <button className="am-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="am-btn-add"
            onClick={handleAdd}
            disabled={!selectedId || !roleInput.trim() || adding}
          >
            {adding ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;