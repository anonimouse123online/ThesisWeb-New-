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

const AddMemberModal: React.FC<AddMemberModalProps> = ({
  projectCode,
  onClose,
  onAdded,
}) => {
  const [users, setUsers]           = useState<AvailableUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  // ── Add selected users to project ──
  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    setAdding(true);
    try {
      await Promise.all(selectedIds.map(async (userId) => {
        const res = await fetchWithAuth(
          `${API_URL}/projects/${projectCode}/members`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          }
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || data.error || 'Failed to add member');
        }
      }));
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
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
                    className={`am-user-row ${selectedIds.includes(user.id) ? 'am-user-row--selected' : ''}`}
                    onClick={() => toggleSelection(user.id)}
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
            disabled={selectedIds.length === 0 || adding}
          >
            {adding ? 'Adding…' : `Add Member${selectedIds.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;