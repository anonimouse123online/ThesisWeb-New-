import React, {
  useEffect,
  useState,
  useMemo,
} from 'react';

import { fetchWithAuth } from '../utils/api';
import '../components/Notification.css';
import Dropdown, { type DropdownOption } from '../components/Dropdown';
import { Users, User, Globe, Wrench, Building2 } from 'lucide-react';

interface ProjectItem {
  id: string;
  code: string;
  name: string;
}

interface ProjectMember {
  id: string;
  name?: string;
  full_name?: string;
  email: string;
  role?: string;
}

interface NotificationItem {
  id: number | string;
  title: string;
  message: string;
  audience?: string;
  project_id?: string;
  project_name?: string;
  target_user_id?: string;
  target_user_name?: string;
  target_user_email?: string;
  created_at?: string;
  sender_name?: string;
  created_by?: string;
}

type AudienceType = 'all' | 'engineer' | 'project' | 'individual';
type FilterTabType = 'all' | 'project' | 'individual' | 'broadcast';

const Notification: React.FC = () => {

  // ============================================================
  // STATE
  // ============================================================

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<AudienceType>('project');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<string>('');

  const [filterTab, setFilterTab] = useState<FilterTabType>('all');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dropdown options
  const audienceOptions: DropdownOption[] = useMemo(() => [
    {
      value: 'project',
      label: 'Project Team',
      sublabel: 'Only members in this project receive the alert',
      badge: 'Team',
      badgeColor: 'purple',
      icon: <Users size={16} />,
    },
    {
      value: 'individual',
      label: 'Single Person in Project',
      sublabel: 'Private 1-on-1 alert (sent alone to them)',
      badge: 'Direct',
      badgeColor: 'orange',
      icon: <User size={16} />,
    },
    {
      value: 'all',
      label: 'All Users',
      sublabel: 'Global announcement to all registered users',
      badge: 'Global',
      badgeColor: 'green',
      icon: <Globe size={16} />,
    },
    {
      value: 'engineer',
      label: 'Engineers Only',
      sublabel: 'Broadcast to all site & project engineers',
      badge: 'Engineers',
      badgeColor: 'blue',
      icon: <Wrench size={16} />,
    },
  ], []);

  const projectOptions: DropdownOption[] = useMemo(() => {
    return projects.map((p) => ({
      value: p.code,
      label: p.name,
      sublabel: `Code: ${p.code}`,
      icon: <Building2 size={16} />,
    }));
  }, [projects]);

  const memberOptions: DropdownOption[] = useMemo(() => {
    return projectMembers.map((m) => ({
      value: m.id,
      label: m.full_name || m.name || m.email,
      sublabel: m.email,
      badge: m.role || 'Member',
      badgeColor: m.role?.toLowerCase().includes('admin') ? 'red' : 'blue',
      icon: <User size={16} />,
    }));
  }, [projectMembers]);


  // ============================================================
  // FETCH NOTIFICATIONS
  // ============================================================

  const fetchNotifications = async () => {
    try {
      setFetching(true);
      setError('');

      const response = await fetchWithAuth('/notifications');

      if (!response.ok) {
        throw new Error('Failed to fetch notifications.');
      }

      const json = await response.json();
      const data = json.data || json.notifications || [];

      setNotifications(Array.isArray(data) ? data : []);

    } catch (err) {
      console.error('Fetch notifications error:', err);
      setError('Unable to load notifications.');
    } finally {
      setFetching(false);
    }
  };


  // ============================================================
  // FETCH PROJECTS
  // ============================================================

  const fetchProjects = async () => {
    try {
      const response = await fetchWithAuth('/projects');
      if (response.ok) {
        const json = await response.json();
        const list: ProjectItem[] = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];

        setProjects(list);

        if (list.length > 0 && !selectedProject) {
          const firstCode = list[0].code;
          setSelectedProject(firstCode);
          fetchProjectMembers(firstCode);
        }
      }
    } catch (err) {
      console.warn('Fetch projects error:', err);
    }
  };


  // ============================================================
  // FETCH MEMBERS OF A SPECIFIC PROJECT
  // ============================================================

  const fetchProjectMembers = async (projectCode: string) => {
    if (!projectCode) {
      setProjectMembers([]);
      setSelectedMember('');
      return;
    }

    try {
      setFetchingMembers(true);
      const response = await fetchWithAuth(`/projects/${encodeURIComponent(projectCode)}/members`);

      if (response.ok) {
        const json = await response.json();
        const members: ProjectMember[] = Array.isArray(json.data) ? json.data : [];
        setProjectMembers(members);

        if (members.length > 0) {
          setSelectedMember(members[0].id);
        } else {
          setSelectedMember('');
        }
      } else {
        setProjectMembers([]);
        setSelectedMember('');
      }
    } catch (err) {
      console.warn('Fetch project members error:', err);
      setProjectMembers([]);
      setSelectedMember('');
    } finally {
      setFetchingMembers(false);
    }
  };


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    fetchNotifications();
    fetchProjects();
  }, []);


  // ============================================================
  // HANDLE PROJECT CHANGE
  // ============================================================

  const handleProjectChange = (projectCode: string) => {
    setSelectedProject(projectCode);
    fetchProjectMembers(projectCode);
  };


  // ============================================================
  // HANDLE AUDIENCE CHANGE
  // ============================================================

  const handleAudienceChange = (newAudience: AudienceType) => {
    setAudience(newAudience);

    if ((newAudience === 'project' || newAudience === 'individual') && projects.length > 0) {
      const codeToUse = selectedProject || projects[0].code;
      if (!selectedProject) {
        setSelectedProject(codeToUse);
      }
      if (projectMembers.length === 0) {
        fetchProjectMembers(codeToUse);
      }
    }
  };


  // ============================================================
  // CREATE NOTIFICATION
  // ============================================================

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    // VALIDATION
    if (!title.trim()) {
      setError('Notification title is required.');
      return;
    }

    if (!message.trim()) {
      setError('Notification message is required.');
      return;
    }

    if (audience === 'project' && !selectedProject) {
      setError('Please select a project to send notification to.');
      return;
    }

    if (audience === 'individual') {
      if (!selectedProject) {
        setError('Please select a project first.');
        return;
      }
      if (!selectedMember) {
        setError('Please select the specific person in the project to notify.');
        return;
      }
    }

    try {
      setLoading(true);

      const payload = {
        title: title.trim(),
        message: message.trim(),
        audience,
        projectId: (audience === 'project' || audience === 'individual') ? selectedProject : undefined,
        targetUserId: audience === 'individual' ? selectedMember : undefined,
      };

      const response = await fetchWithAuth('/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Failed to send notification.');
      }

      setSuccess('Notification sent successfully and delivered to target recipients.');
      setTitle('');
      setMessage('');

      // Refresh list
      await fetchNotifications();

    } catch (err) {
      console.error('Create notification error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to send notification.');
      }
    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (date?: string) => {
    if (!date) return 'Unknown date';
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return date;

    return parsedDate.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };


  // ============================================================
  // FILTERED NOTIFICATIONS
  // ============================================================

  const filteredNotifications = notifications.filter((item) => {
    if (filterTab === 'project') return item.audience === 'project';
    if (filterTab === 'individual') return item.audience === 'individual';
    if (filterTab === 'broadcast') return item.audience === 'all' || item.audience === 'engineer';
    return true;
  });


  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="notification-page">

      {/* HEADER */}
      <div className="notification-header">
        <div>
          <span className="notification-eyebrow">SITEPULSE</span>
          <h1>Project Notifications</h1>
          <p>
            Send targeted notifications to your project teams, alert specific members alone, or broadcast updates.
          </p>
        </div>
      </div>

      {/* CREATE CARD */}
      <section className="notification-create-card">
        <div className="notification-card-header">
          <div className="notification-card-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>

          <div>
            <h2>Compose Notification</h2>
            <p>Select who should receive this notification (isolated to your project or targeted to an individual).</p>
          </div>
        </div>

        {/* STATUS MESSAGES */}
        {error && (
          <div className="notification-alert notification-alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="notification-alert notification-alert-success">
            {success}
          </div>
        )}

        {/* FORM */}
        <form className="notification-form" onSubmit={handleSubmit}>

          {/* AUDIENCE SELECTOR */}
          <div className="notification-form-group">
            <label htmlFor="notification-audience">Target Audience</label>
            <Dropdown
              id="notification-audience"
              options={audienceOptions}
              value={audience}
              onChange={(val) => handleAudienceChange(val as AudienceType)}
              fullWidth
              size="md"
            />
          </div>

          {/* DYNAMIC ROW: PROJECT & MEMBER SELECTORS */}
          {(audience === 'project' || audience === 'individual') && (
            <div className="notification-form-row">
              {/* SELECT PROJECT */}
              <div className="notification-form-group">
                <label htmlFor="notification-project">Select Project</label>
                <Dropdown
                  id="notification-project"
                  options={projectOptions}
                  value={selectedProject}
                  onChange={(val) => handleProjectChange(val)}
                  placeholder={projects.length === 0 ? 'No projects available' : 'Select a project'}
                  disabled={projects.length === 0}
                  fullWidth
                  searchable={projectOptions.length > 5}
                />
                <div className="notification-subtext">
                  {audience === 'project'
                    ? 'Only users assigned to this project will receive the alert.'
                    : 'Choose the project containing the person you want to notify.'}
                </div>
              </div>

              {/* SELECT MEMBER (WHEN SENDING ALONE TO SOMEONE) */}
              {audience === 'individual' && (
                <div className="notification-form-group">
                  <label htmlFor="notification-member">Select Person to Notify Alone</label>
                  <Dropdown
                    id="notification-member"
                    options={memberOptions}
                    value={selectedMember}
                    onChange={(val) => setSelectedMember(val)}
                    placeholder={
                      fetchingMembers
                        ? 'Loading members...'
                        : memberOptions.length === 0
                        ? 'No members found in this project'
                        : 'Select a member to notify'
                    }
                    disabled={fetchingMembers || memberOptions.length === 0}
                    fullWidth
                    searchable={memberOptions.length > 5}
                  />
                  <div className="notification-subtext">
                    This notification will only be visible to this person and nobody else.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TITLE */}
          <div className="notification-form-group">
            <label htmlFor="notification-title">Notification Title</label>
            <input
              id="notification-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Concrete Pouring Schedule / Urgent Inspection"
              maxLength={150}
            />
          </div>

          {/* MESSAGE */}
          <div className="notification-form-group">
            <label htmlFor="notification-message">Message</label>
            <textarea
              id="notification-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the details of your notification here..."
              rows={5}
              maxLength={1000}
            />
            <div className="notification-character-count">
              {message.length} / 1000
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="notification-form-actions">
            <button
              type="submit"
              className="notification-send-button"
              disabled={loading}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {loading ? 'Sending Notification...' : 'Send Notification'}
            </button>
          </div>

        </form>
      </section>

      {/* NOTIFICATION HISTORY */}
      <section className="notification-history">
        <div className="notification-history-header">
          <div>
            <h2>Notification History</h2>
            <p>All notifications accessible to your account.</p>

            {/* FILTER PILLS */}
            <div className="notification-filter-tabs">
              <button
                type="button"
                className={`notification-filter-btn ${filterTab === 'all' ? 'notification-filter-btn--active' : ''}`}
                onClick={() => setFilterTab('all')}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                className={`notification-filter-btn ${filterTab === 'project' ? 'notification-filter-btn--active' : ''}`}
                onClick={() => setFilterTab('project')}
              >
                Project Teams ({notifications.filter((n) => n.audience === 'project').length})
              </button>
              <button
                type="button"
                className={`notification-filter-btn ${filterTab === 'individual' ? 'notification-filter-btn--active' : ''}`}
                onClick={() => setFilterTab('individual')}
              >
                Direct / 1-on-1 ({notifications.filter((n) => n.audience === 'individual').length})
              </button>
              <button
                type="button"
                className={`notification-filter-btn ${filterTab === 'broadcast' ? 'notification-filter-btn--active' : ''}`}
                onClick={() => setFilterTab('broadcast')}
              >
                Broadcasts ({notifications.filter((n) => n.audience === 'all' || n.audience === 'engineer').length})
              </button>
            </div>
          </div>

          <button
            type="button"
            className="notification-refresh-button"
            onClick={fetchNotifications}
            disabled={fetching}
          >
            Refresh
          </button>
        </div>

        {/* LOADING STATE */}
        {fetching && (
          <div className="notification-state">
            Loading notifications...
          </div>
        )}

        {/* EMPTY STATE */}
        {!fetching && filteredNotifications.length === 0 && (
          <div className="notification-empty">
            <div className="notification-empty-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h3>No notifications in this view</h3>
            <p>Notifications you send or receive will appear here.</p>
          </div>
        )}

        {/* LIST */}
        {!fetching && filteredNotifications.length > 0 && (
          <div className="notification-list">
            {filteredNotifications.map((notif) => {
              const aud = notif.audience || 'all';

              return (
                <article className="notification-item" key={notif.id}>
                  <div className="notification-item-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>

                  <div className="notification-item-content">
                    <div className="notification-item-top">
                      <h3>{notif.title}</h3>
                      <span className="notification-date">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>

                    <p className="notification-message">
                      {notif.message}
                    </p>

                    <div className="notification-meta">
                      {/* TARGET AUDIENCE BADGE */}
                      {aud === 'individual' && (
                        <span className="notification-audience-badge notification-audience-badge--individual">
                          👤 Direct to: {notif.target_user_name || notif.target_user_email || 'Specific Member'}
                        </span>
                      )}

                      {aud === 'project' && (
                        <span className="notification-audience-badge notification-audience-badge--project">
                          📁 Project: {notif.project_name || notif.project_id || 'Project Team'}
                        </span>
                      )}

                      {aud === 'engineer' && (
                        <span className="notification-audience-badge notification-audience-badge--engineer">
                          ⚡ Engineers Only
                        </span>
                      )}

                      {aud === 'all' && (
                        <span className="notification-audience-badge notification-audience-badge--all">
                          🌐 All Users
                        </span>
                      )}

                      {/* EXTRA PROJECT TAG IF INDIVIDUAL IN PROJECT */}
                      {aud === 'individual' && notif.project_name && (
                        <span className="notification-project-tag">
                          📁 {notif.project_name}
                        </span>
                      )}

                      {/* SENDER NAME */}
                      {notif.sender_name && (
                        <span>
                          Sent by <strong>{notif.sender_name}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </section>

    </div>
  );
};

export default Notification;