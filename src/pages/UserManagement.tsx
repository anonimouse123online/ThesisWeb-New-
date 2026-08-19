import React, { useState, useEffect } from "react";
import "../components/UserManagement.css";
import { API_BASE_URL, fetchWithAuth } from "../utils/api";
import { showToast } from "../components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "Admin" | "Site Engineer" | "Project Manager" | "Supervisor";

interface User {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  current_tasks: string;
}

const BACKEND_URL = API_BASE_URL;

const ROLES: Role[] = [
  "Admin",
  "Site Engineer",
  "Project Manager",
  "Supervisor",
];

// ─── Chevron icon ─────────────────────────────────────────────────────────────

const ChevronDown = () => (
  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
    <path d="M5 8l5 5 5-5" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  // Check if current user is admin
  const storedUser = localStorage.getItem('user');
  let isAdmin = false;
  try {
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      isAdmin = parsed.role === 'Admin';
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
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setOpenRoleDropdown(null);
    setUpdatingRole(userId);
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      const { data } = await res.json();
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, role: data.role } : u))
      );
      showToast("User role updated successfully!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to remove this user?")) return;
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove user");
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast("User removed successfully!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const toggleDropdown = (userId: string) => {
    setOpenRoleDropdown(prev => (prev === userId ? null : userId));
  };

  // Close dropdown when clicking outside
  const handleOverlayClick = () => setOpenRoleDropdown(null);

  return (
    <div className="um-container">
      {openRoleDropdown && (
        <div className="um-overlay" onClick={handleOverlayClick} />
      )}

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
                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveUser(user.id)}
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
                  )}
                </div>

                <div className="um-card__grid">
                  {/* Role */}
                  <div className="um-field">
                    <span className="um-field__label">Role</span>
                    <div className="um-role-wrap">
                      {isAdmin ? (
                        <>
                          <button
                            className="um-role-btn"
                            onClick={() => toggleDropdown(user.id)}
                            disabled={updatingRole === user.id}
                          >
                            <span>{updatingRole === user.id ? 'Saving...' : user.role}</span>
                            <ChevronDown />
                          </button>

                          {openRoleDropdown === user.id && (
                            <div className="um-dropdown">
                              {ROLES.map(role => (
                                <button
                                  key={role}
                                  className={`um-dropdown__item ${user.role === role ? "um-dropdown__item--active" : ""}`}
                                  onClick={() => handleRoleChange(user.id, role)}
                                >
                                  {role}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="um-field__value">{user.role}</span>
                      )}
                    </div>
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