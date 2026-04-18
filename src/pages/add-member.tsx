import React, { useState, useEffect } from 'react';
import '../components/add-member.css';

const API_URL = import.meta.env.VITE_BACKEND_URL;

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string; // e.g. "Civil Engineer"
}

interface AddMemberModalProps {
  projectCode: string;
  onClose: () => void;
  onAdded: () => void; // refetch members after adding
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({
  projectCode,
  onClose,
  onAdded,
}) => {
  const [users, setUsers]           = useState<AvailableUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding]         = useState(false);

  // ── Fetch available users (not yet in this project) ──
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_URL}/projects/${projectCode}/available-members`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load users');
        setUsers(data.data ?? []);
      } catch (err: any) {
        setError(err.message);
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

  // ── Add selected user to project ──
  const handleAdd = async () => {
    if (!selectedId) return;
    setAdding(true);
    try {
      const res = await fetch(
        `${API_URL}/projects/${projectCode}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add member');
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="am-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
                    className={`am-user-row ${selectedId === user.id ? 'am-user-row--selected' : ''}`}
                    onClick={() =>
                      setSelectedId((prev) => (prev === user.id ? null : user.id))
                    }
                  >
                    <span className="am-user-name">{user.name}</span>
                    <span className="am-user-email">{user.email}</span>
                    <span className="am-user-phone">{user.phone}</span>
                  </button>
                ))}
              </div>
            ))
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
            disabled={!selectedId || adding}
          >
            {adding ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;