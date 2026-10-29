import { getErrorMessage } from '../utils/errors';
import React, { useState, useEffect } from "react";
import "../components/UserManagement.css";
import { API_BASE_URL, fetchWithAuth } from "../utils/api";
import { showToast } from "../utils/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "Admin" | "Site Engineer" | "Project Manager" | "Supervisor";

interface User {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  current_tasks: string;
  relationship?: 'self' | 'my_member' | 'project_owner' | 'co_member';
  can_remove?: boolean;
}

const BACKEND_URL = API_BASE_URL;

// ─── Component ────────────────────────────────────────────────────────────────

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Identify the current user for the account label and removal guard.
  const storedUser = localStorage.getItem('user');
  let currentUserId: string | null = null;
  try {
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      currentUserId = parsed.id || null;
    }
  } catch { /* ignore */ }

  // ── Fetch users from backend ──
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithAuth(`${BACKEND_URL}/users`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json();
      setUsers(json.data ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '') || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string, userName?: string) => {
    if (userId === currentUserId) {
      showToast("You cannot remove your own account from your projects.", "warning");
      return;
    }
    if (!window.confirm(`Remove ${userName || 'this user'} from your project team?`)) return;
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove user from projects");
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast(`${userName || 'User'} removed from your project team.`, "success");
    } catch (err: unknown) {
      showToast(getErrorMessage(err), "error");
    }
  };

  return (
    <div className="um-container">
      {/* Header */}
      <div className="um-header">
        <h1 className="um-title">User Management</h1>
        <p className="um-subtitle">Manage Users</p>
      </div>

      {/* Loading / Error states */}
      {loading && <div className="um-loading">Loading users...</div>}
      {error && <div className="um-error" style={{ color: 'red', padding: '1rem' }}>{error}</div>}

      {/* User Cards */}
      {!loading && !error && (
        <div className="um-list">
          {users.length === 0 ? (
            <div style={{ padding: '2rem', color: '#888', textAlign: 'center' }}>No users found.</div>
          ) : (
            users.map(user => (
              <div key={user.id} className="um-card">
                <div className="um-card__name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{user.full_name}</span>
                  {user.id === currentUserId ? (
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>You</span>
                  ) : user.can_remove ? (
                    <button
                      onClick={() => handleRemoveUser(user.id, user.full_name)}
                      title="Remove member from your project team"
                      style={{
                        background: 'transparent',
                        border: '1px solid #ff4d4f',
                        color: '#ff4d4f',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Remove
                    </button>
                  ) : user.relationship === 'project_owner' ? (
                    <span
                      title="Project Owner cannot be removed by members"
                      style={{
                        fontSize: '11px',
                        color: '#0284c7',
                        background: '#e0f2fe',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}
                    >
                      Project Owner
                    </span>
                  ) : (
                    <span
                      title="Only the Project Owner can remove members"
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        background: '#f1f5f9',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 500
                      }}
                    >
                      Team Member
                    </span>
                  )}
                </div>

                <div className="um-card__grid">
                  {/* Role */}
                  <div className="um-field">
                    <span className="um-field__label">Role</span>
                    <span className="um-field__value">{user.role}</span>
                  </div>

                  {/* Email */}
                  <div className="um-field">
                    <span className="um-field__label">Email</span>
                    <span className="um-field__value">{user.email}</span>
                  </div>

                  {/* Active Tasks */}
                  <div className="um-field">
                    <span className="um-field__label">Active Tasks</span>
                    <span className="um-field__value">{user.current_tasks || '0'}</span>
                  </div>

                  {/* User ID */}
                  <div className="um-field">
                    <span className="um-field__label">User ID</span>
                    <span className="um-field__value" style={{ fontSize: '10px' }}>{user.id.slice(0, 8)}…</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
