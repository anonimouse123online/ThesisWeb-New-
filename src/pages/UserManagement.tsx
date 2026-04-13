import React, { useState } from "react";
import "../components/UserManagement.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "Senior Site Engineer" | "Site Engineer" | "Project Manager" | "Supervisor";

interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  createdAt: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const initialUsers: User[] = [
  {
    id: "USR-001",
    name: "Mike Johnson",
    role: "Senior Site Engineer",
    email: "mike.j@construction.com",
    createdAt: "02/01/2026",
  },
  {
    id: "USR-002",
    name: "Robert Martinez",
    role: "Site Engineer",
    email: "robert.m@construction.com",
    createdAt: "02/01/2026",
  },
  {
    id: "USR-003",
    name: "Sarah Chen",
    role: "Site Engineer",
    email: "sarah.c@construction.com",
    createdAt: "02/04/2026",
  },
];

const ROLES: Role[] = [
  "Senior Site Engineer",
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
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);

  const handleRoleChange = (userId: string, newRole: Role) => {
    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, role: newRole } : u))
    );
    setOpenRoleDropdown(null);
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

      {/* User Cards */}
      <div className="um-list">
        {users.map(user => (
          <div key={user.id} className="um-card">
            <div className="um-card__name">{user.name}</div>

            <div className="um-card__grid">
              {/* Role */}
              <div className="um-field">
                <span className="um-field__label">Role</span>
                <div className="um-role-wrap">
                  <button
                    className="um-role-btn"
                    onClick={() => toggleDropdown(user.id)}
                  >
                    <span>{user.role}</span>
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
                </div>
              </div>

              {/* Email */}
              <div className="um-field">
                <span className="um-field__label">Email</span>
                <span className="um-field__value">{user.email}</span>
              </div>

              {/* User ID */}
              <div className="um-field">
                <span className="um-field__label">User ID</span>
                <span className="um-field__value">{user.id}</span>
              </div>

              {/* Created */}
              <div className="um-field">
                <span className="um-field__label">Created</span>
                <span className="um-field__value">{user.createdAt}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserManagement;