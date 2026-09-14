import React, {
  useEffect,
  useState,
} from 'react';

import { fetchWithAuth } from '../utils/api';

import '../components/Notification.css';

interface NotificationItem {
  id: number | string;
  title: string;
  message: string;
  audience?: string;
  created_at?: string;
  sender_name?: string;
}

const Notification: React.FC = () => {

  // ============================================================
  // STATE
  // ============================================================

  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);

  const [title, setTitle] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [audience, setAudience] =
    useState('all');

  const [loading, setLoading] =
    useState(false);

  const [fetching, setFetching] =
    useState(true);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');


  // ============================================================
  // FETCH NOTIFICATIONS
  // ============================================================

  const fetchNotifications =
    async () => {

      try {

        setFetching(true);

        setError('');

        const response =
          await fetchWithAuth(
            '/notifications'
          );

        if (!response.ok) {
          throw new Error(
            'Failed to fetch notifications.'
          );
        }

        const json =
          await response.json();

        const data =
          json.data ||
          json.notifications ||
          [];

        setNotifications(
          Array.isArray(data)
            ? data
            : []
        );

      } catch (err) {

        console.error(
          'Fetch notifications error:',
          err
        );

        setError(
          'Unable to load notifications.'
        );

      } finally {

        setFetching(false);

      }
    };


  // ============================================================
  // INITIAL FETCH
  // ============================================================

  useEffect(() => {

    fetchNotifications();

  }, []);


  // ============================================================
  // CREATE NOTIFICATION
  // ============================================================

  const handleSubmit =
    async (
      event:
        React.FormEvent<HTMLFormElement>
    ) => {

      event.preventDefault();

      setError('');
      setSuccess('');


      // ========================================================
      // VALIDATION
      // ========================================================

      if (!title.trim()) {

        setError(
          'Notification title is required.'
        );

        return;
      }

      if (!message.trim()) {

        setError(
          'Notification message is required.'
        );

        return;
      }


      try {

        setLoading(true);


        // ======================================================
        // SEND TO BACKEND
        // ======================================================

        const response =
          await fetchWithAuth(
            '/notifications',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                title:
                  title.trim(),

                message:
                  message.trim(),

                audience,
              }),
            }
          );


        const json =
          await response.json();


        if (!response.ok) {

          throw new Error(
            json.message ||
              'Failed to send notification.'
          );

        }


        // ======================================================
        // SUCCESS
        // ======================================================

        setSuccess(
          'Notification sent successfully.'
        );

        setTitle('');
        setMessage('');
        setAudience('all');


        // Refresh notification history
        await fetchNotifications();


      } catch (err) {

        console.error(
          'Create notification error:',
          err
        );

        if (err instanceof Error) {

          setError(
            err.message
          );

        } else {

          setError(
            'Unable to send notification.'
          );

        }

      } finally {

        setLoading(false);

      }
    };


  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate =
    (
      date?: string
    ) => {

      if (!date) {
        return 'Unknown date';
      }

      const parsedDate =
        new Date(date);

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return date;
      }

      return parsedDate.toLocaleString(
        undefined,
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',

          hour: 'numeric',
          minute: '2-digit',
        }
      );
    };


  // ============================================================
  // RENDER
  // ============================================================

  return (

    <div className="notification-page">

      {/* ========================================================
          HEADER
      ======================================================== */}

      <div className="notification-header">

        <div>

          <span className="notification-eyebrow">
            SITEPULSE
          </span>

          <h1>
            Notifications
          </h1>

          <p>
            Send announcements and important
            updates to SitePulse users.
          </p>

        </div>

      </div>


      {/* ========================================================
          CREATE NOTIFICATION
      ======================================================== */}

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

            <h2>
              Send notification
            </h2>

            <p>
              Create an announcement for
              SitePulse users.
            </p>

          </div>

        </div>


        {/* ======================================================
            STATUS MESSAGES
        ====================================================== */}

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


        {/* ======================================================
            FORM
        ====================================================== */}

        <form
          className="notification-form"
          onSubmit={handleSubmit}
        >

          {/* TITLE */}

          <div className="notification-form-group">

            <label htmlFor="notification-title">
              Title
            </label>

            <input
              id="notification-title"
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              placeholder="Example: Project maintenance notice"
              maxLength={150}
            />

          </div>


          {/* AUDIENCE */}

          <div className="notification-form-group">

            <label htmlFor="notification-audience">
              Send to
            </label>

            <select
              id="notification-audience"
              value={audience}
              onChange={(event) =>
                setAudience(
                  event.target.value
                )
              }
            >

              <option value="all">
                All Users
              </option>

              <option value="engineer">
                Engineers Only
              </option>

            </select>

          </div>


          {/* MESSAGE */}

          <div className="notification-form-group">

            <label htmlFor="notification-message">
              Message
            </label>

            <textarea
              id="notification-message"
              value={message}
              onChange={(event) =>
                setMessage(
                  event.target.value
                )
              }
              placeholder="Write your announcement here..."
              rows={6}
              maxLength={1000}
            />

            <div className="notification-character-count">
              {message.length} / 1000
            </div>

          </div>


          {/* BUTTON */}

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

                <line
                  x1="22"
                  y1="2"
                  x2="11"
                  y2="13"
                />

                <polygon points="22 2 15 22 11 13 2 9 22 2" />

              </svg>

              {loading
                ? 'Sending...'
                : 'Send Notification'}

            </button>

          </div>

        </form>

      </section>


      {/* ========================================================
          NOTIFICATION HISTORY
      ======================================================== */}

      <section className="notification-history">

        <div className="notification-history-header">

          <div>

            <h2>
              Notification History
            </h2>

            <p>
              Previously sent announcements.
            </p>

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


        {/* LOADING */}

        {fetching && (

          <div className="notification-state">
            Loading notifications...
          </div>

        )}


        {/* EMPTY */}

        {!fetching &&
          notifications.length === 0 && (

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

              <h3>
                No notifications yet
              </h3>

              <p>
                Notifications sent by the
                administrator will appear here.
              </p>

            </div>

          )}


        {/* NOTIFICATION LIST */}

        {!fetching &&
          notifications.length > 0 && (

            <div className="notification-list">

              {notifications.map(
                (
                  notification
                ) => (

                  <article
                    className="notification-item"
                    key={
                      notification.id
                    }
                  >

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

                        <h3>
                          {
                            notification.title
                          }
                        </h3>

                        <span className="notification-date">
                          {formatDate(
                            notification.created_at
                          )}
                        </span>

                      </div>


                      <p className="notification-message">
                        {
                          notification.message
                        }
                      </p>


                      <div className="notification-meta">

                        <span className="notification-audience-badge">

                          {notification.audience ===
                          'engineer'
                            ? 'Engineers'
                            : 'All Users'}

                        </span>


                        {notification.sender_name && (

                          <span>
                            Sent by{' '}
                            {
                              notification.sender_name
                            }
                          </span>

                        )}

                      </div>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

      </section>

    </div>
  );
};

export default Notification;