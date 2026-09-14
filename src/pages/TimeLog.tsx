import React, { useEffect, useMemo, useState } from "react";
import "../components/TimeLog.css";
import { API_BASE_URL, fetchWithAuth } from "../utils/api";

const BACKEND_URL = API_BASE_URL;

// ============================================================
// RAW API MODEL
// ============================================================

interface RawLog {
  id: string | number;

  project_name?: string | null;
  engineer_name?: string | null;
  date?: string | null;

  work_on_site?: number | string | null;
  supervisors?: number | string | null;
  sub_contractors?: number | string | null;
  total_work_hours?: number | string | null;

  weather?: string | null;
  temperature?: number | string | null;

  work_completed?: string | null;
  materials_delivered?: string | null;
  equipment_used?: string | null;
  additional_notes?: string | null;

  has_incident?: boolean | null;

  created_at?: string | null;

  phase?: string | null;
  progress_pct?: number | string | null;
}

// ============================================================
// UI MODEL
// ============================================================

interface LogEntry {
  id: string | number;

  projectName: string;
  engineerName: string;

  date: string;
  createdAt: string | null;

  phase: string | null;
  progressPct: number | null;

  manpower: {
    workOnSite: number;
    supervisors: number;
    subContractors: number;
    totalWorkHours: string;
  };

  conditions: {
    weather: string;
    temperature: string;
  };

  workCompleted: string;
  materialsDelivered: string;
  equipmentUsed: string;
  additionalNotes: string;

  hasIncident: boolean;
}

// ============================================================
// HELPERS
// ============================================================

const toNumber = (
  value: number | string | null | undefined
): number => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsed = Number.parseFloat(
    String(value).replace(/[^0-9.-]/g, "")
  );

  return Number.isNaN(parsed)
    ? 0
    : parsed;
};

const displayText = (
  value: string | null | undefined
): string => {
  const text = value?.trim();

  return text
    ? text
    : "—";
};

const formatDate = (
  date?: string | null,
  createdAt?: string | null
): string => {
  const rawDate =
    date || createdAt;

  if (!rawDate) {
    return "—";
  }

  return rawDate.includes("T")
    ? rawDate.split("T")[0]
    : rawDate.slice(0, 10);
};

const formatPrettyDate = (
  value?: string | null
): string => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
};

const formatTime = (
  value?: string | null
): string => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString(
    undefined,
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
};

const formatHours = (
  value: number | string | null | undefined
): string => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const text =
    String(value).trim();

  if (!text) {
    return "—";
  }

  return /h(ours?)?$/i.test(text)
    ? text
    : `${text}h`;
};

const formatTemperature = (
  value: number | string | null | undefined
): string => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const text =
    String(value).trim();

  if (!text) {
    return "—";
  }

  return /°\s*c|celsius/i.test(text)
    ? text
    : `${text}°C`;
};

// ============================================================
// TIME LOG PAGE
// ============================================================

const TimeLog: React.FC = () => {

  // ==========================================================
  // API DATA
  // ==========================================================

  const [logs, setLogs] =
    useState<LogEntry[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  // ==========================================================
  // FILTERS
  // ==========================================================

  const [searchQuery, setSearchQuery] =
    useState("");

  const [dateFilter, setDateFilter] =
    useState("");

  const [
    engineerFilter,
    setEngineerFilter
  ] =
    useState("All Engineers");

  // ==========================================================
  // EXPANDED PROJECTS
  // ==========================================================

  const [
    expandedProjects,
    setExpandedProjects
  ] =
    useState<string[]>([]);

  // ==========================================================
  // EXPANDED ENGINEERS
  // ==========================================================

  const [
    expandedEngineers,
    setExpandedEngineers
  ] =
    useState<string[]>([]);

  // ==========================================================
  // EXPANDED LOGS
  // ==========================================================

  const [
    expandedLogs,
    setExpandedLogs
  ] =
    useState<(string | number)[]>([]);

  // ==========================================================
  // LOAD LOGS
  // ==========================================================

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const res =
        await fetchWithAuth(
          `${BACKEND_URL}/timelogs`
        );

      if (!res.ok) {
        let message =
          "Failed to fetch time logs.";

        try {
          const body =
            await res.json();

          message =
            body?.message ||
            body?.error ||
            message;
        } catch {
          // Keep default message
        }

        throw new Error(message);
      }

      const json =
        await res.json();

      const rawList: RawLog[] =
        Array.isArray(json?.data)
          ? json.data
          : [];

      const formatted: LogEntry[] =
        rawList.map((r) => {

          const workOnSite =
            toNumber(
              r.work_on_site
            );

          const supervisors =
            toNumber(
              r.supervisors
            );

          const subContractors =
            toNumber(
              r.sub_contractors
            );

          const progressPct =
            r.progress_pct === null ||
            r.progress_pct === undefined ||
            r.progress_pct === ""
              ? null
              : toNumber(
                  r.progress_pct
                );

          return {
            id:
              r.id,

            projectName:
              displayText(
                r.project_name
              ),

            engineerName:
              displayText(
                r.engineer_name
              ),

            date:
              formatDate(
                r.date,
                r.created_at
              ),

            createdAt:
              r.created_at ||
              null,

            phase:
              r.phase?.trim() ||
              null,

            progressPct,

            manpower: {
              workOnSite,
              supervisors,
              subContractors,

              totalWorkHours:
                formatHours(
                  r.total_work_hours
                ),
            },

            conditions: {
              weather:
                displayText(
                  r.weather
                ),

              temperature:
                formatTemperature(
                  r.temperature
                ),
            },

            workCompleted:
              displayText(
                r.work_completed
              ),

            materialsDelivered:
              displayText(
                r.materials_delivered
              ),

            equipmentUsed:
              displayText(
                r.equipment_used
              ),

            additionalNotes:
              displayText(
                r.additional_notes
              ),

            hasIncident:
              Boolean(
                r.has_incident
              ),
          };
        });

      setLogs(formatted);

    } catch (err: unknown) {

      const message =
        err instanceof Error
          ? err.message
          : "Failed to load time logs.";

      setError(message);
      setLogs([]);

    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // ENGINEER FILTER OPTIONS
  // ==========================================================

  const engineers =
    useMemo(() => {

      const names =
        logs
          .map(
            (log) =>
              log.engineerName
          )
          .filter(
            (name) =>
              name &&
              name !== "—"
          );

      return Array.from(
        new Set(names)
      ).sort(
        (a, b) =>
          a.localeCompare(b)
      );

    }, [logs]);

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const totalLogs =
    logs.length;

  const totalWorkers =
    logs.reduce(
      (sum, log) =>
        sum +
        log.manpower.workOnSite,
      0
    );

  const totalHours =
    logs.reduce(
      (sum, log) =>
        sum +
        toNumber(
          log.manpower.totalWorkHours
        ),
      0
    );

  const safetyAccidents =
    logs.filter(
      (log) =>
        log.hasIncident
    ).length;

  // ==========================================================
  // PROJECT TOGGLE
  // ==========================================================

  const toggleProject = (
    projectName: string
  ) => {

    setExpandedProjects(
      (prev) =>
        prev.includes(projectName)
          ? prev.filter(
              (name) =>
                name !== projectName
            )
          : [
              ...prev,
              projectName
            ]
    );
  };

  // ==========================================================
  // ENGINEER TOGGLE
  // ==========================================================

  const toggleEngineer = (
    projectName: string,
    engineerName: string
  ) => {

    const engineerKey =
      `${projectName}::${engineerName}`;

    setExpandedEngineers(
      (prev) =>
        prev.includes(engineerKey)
          ? prev.filter(
              (key) =>
                key !== engineerKey
            )
          : [
              ...prev,
              engineerKey
            ]
    );
  };

  // ==========================================================
  // LOG TOGGLE
  // ==========================================================

  const toggleLog = (
    id: string | number
  ) => {

    setExpandedLogs(
      (prev) =>
        prev.includes(id)
          ? prev.filter(
              (logId) =>
                logId !== id
            )
          : [
              ...prev,
              id
            ]
    );
  };

  // ==========================================================
  // FILTER LOGS
  // ==========================================================

  const filteredLogs =
    useMemo(() => {

      const normalizedSearch =
        searchQuery
          .trim()
          .toLowerCase();

      return logs.filter(
        (log) => {

          const matchesSearch =
            normalizedSearch === "" ||

            log.projectName
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||

            log.engineerName
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||

            log.workCompleted
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||

            log.materialsDelivered
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||

            log.equipmentUsed
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||

            log.additionalNotes
              .toLowerCase()
              .includes(
                normalizedSearch
              );

          const matchesDate =
            dateFilter === "" ||
            log.date ===
              dateFilter;

          const matchesEngineer =
            engineerFilter ===
              "All Engineers" ||

            log.engineerName
              .toLowerCase() ===
              engineerFilter
                .toLowerCase();

          return (
            matchesSearch &&
            matchesDate &&
            matchesEngineer
          );
        }
      );

    }, [
      logs,
      searchQuery,
      dateFilter,
      engineerFilter
    ]);

  // ==========================================================
  // GROUP BY PROJECT
  // ==========================================================

  const groupedProjects =
    useMemo(() => {

      const groups:
        Record<
          string,
          LogEntry[]
        > = {};

      filteredLogs.forEach(
        (log) => {

          const project =
            log.projectName ||
            "Unknown Project";

          if (!groups[project]) {
            groups[project] = [];
          }

          groups[project].push(log);
        }
      );

      Object.values(groups)
        .forEach((projectLogs) => {

          projectLogs.sort(
            (a, b) => {

              const aTime =
                a.createdAt
                  ? new Date(
                      a.createdAt
                    ).getTime()
                  : 0;

              const bTime =
                b.createdAt
                  ? new Date(
                      b.createdAt
                    ).getTime()
                  : 0;

              return bTime - aTime;
            }
          );
        });

      return groups;

    }, [filteredLogs]);

  // ==========================================================
  // GROUP PROJECT LOGS BY ENGINEER
  // ==========================================================

  const groupByEngineer = (
    projectLogs: LogEntry[]
  ): Record<string, LogEntry[]> => {

    const groups:
      Record<string, LogEntry[]> = {};

    projectLogs.forEach(
      (log) => {

        const engineer =
          log.engineerName ||
          "Unknown Engineer";

        if (!groups[engineer]) {
          groups[engineer] = [];
        }

        groups[engineer]
          .push(log);
      }
    );

    Object.values(groups)
      .forEach(
        (engineerLogs) => {

          engineerLogs.sort(
            (a, b) => {

              const aTime =
                a.createdAt
                  ? new Date(
                      a.createdAt
                    ).getTime()
                  : 0;

              const bTime =
                b.createdAt
                  ? new Date(
                      b.createdAt
                    ).getTime()
                  : 0;

              return bTime - aTime;
            }
          );
        }
      );

    return groups;
  };

  const projectEntries =
    Object.entries(
      groupedProjects
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="timelog-container">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="timelog-header">

        <div>

          <h1 className="timelog-title">
            Time Log
          </h1>

          <p className="timelog-subtitle">
            Engineer time logs grouped by project
          </p>

        </div>

      </div>

      {/* ======================================================
          STATISTICS
      ====================================================== */}

      <div className="timelog-stats">

        <div className="stat-card">

          <span className="stat-label">
            Total Logs
          </span>

          <span className="stat-value">
            {totalLogs}
          </span>

        </div>

        <div className="stat-card">

          <span className="stat-label">
            Total Workers Logged
          </span>

          <span className="stat-value">
            {totalWorkers}
          </span>

        </div>

        <div className="stat-card">

          <span className="stat-label">
            Total Work Hours
          </span>

          <span className="stat-value">
            {totalHours}h
          </span>

        </div>

        <div className="stat-card">

          <span className="stat-label">
            Safety Incidents
          </span>

          <span className="stat-value">
            {safetyAccidents}
          </span>

        </div>

      </div>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="timelog-filters">

        <div className="search-wrapper">

          <svg
            className="search-icon"
            viewBox="0 0 20 20"
            fill="none"
          >

            <circle
              cx="9"
              cy="9"
              r="6"
              stroke="#999"
              strokeWidth="1.5"
            />

            <path
              d="M13.5 13.5L17 17"
              stroke="#999"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

          </svg>

          <input
            type="text"
            className="search-input"
            placeholder="Search project, engineer, or work summary..."
            value={searchQuery}
            onChange={
              (e) =>
                setSearchQuery(
                  e.target.value
                )
            }
          />

        </div>

        <div className="date-wrapper">

          <input
            type="date"
            className="date-input"
            value={dateFilter}
            onChange={
              (e) =>
                setDateFilter(
                  e.target.value
                )
            }
          />

        </div>

        <div className="select-wrapper">

          <select
            className="engineer-select"
            value={engineerFilter}
            onChange={
              (e) =>
                setEngineerFilter(
                  e.target.value
                )
            }
          >

            <option value="All Engineers">
              All Engineers
            </option>

            {engineers.map(
              (name) => (

                <option
                  key={name}
                  value={name}
                >
                  {name}
                </option>

              )
            )}

          </select>

          <svg
            className="select-arrow"
            viewBox="0 0 20 20"
            fill="none"
          >

            <path
              d="M5 8l5 5 5-5"
              stroke="#555"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

          </svg>

        </div>

      </div>

      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading && (

        <div className="rm-empty">
          Loading time logs...
        </div>

      )}

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (

        <div
          className="rm-empty"
          style={{
            color: "red"
          }}
        >
          {error}
        </div>

      )}

      {/* ======================================================
          PROJECTS
      ====================================================== */}

      {!loading &&
        !error && (

        <div className="timelog-entries">

          {projectEntries.length === 0 ? (

            <div
              style={{
                padding: "3rem",
                textAlign: "center",
                background: "#fff",
                borderRadius: "14px",
                border:
                  "1px solid #e2e8f0",
              }}
            >

              <p
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#1e293b",
                  margin:
                    "0 0 6px",
                }}
              >
                No time logs found
              </p>

              <p
                style={{
                  fontSize: "13px",
                  color: "#64748b",
                  margin: 0,
                }}
              >
                Engineer time logs will appear here.
              </p>

            </div>

          ) : (

            projectEntries.map(
              ([
                projectName,
                projectLogs
              ]) => {

                const projectExpanded =
                  expandedProjects.includes(
                    projectName
                  );

                const engineerGroups =
                  groupByEngineer(
                    projectLogs
                  );

                const engineerEntries =
                  Object.entries(
                    engineerGroups
                  );

                const latestLog =
                  projectLogs[0];

                return (

                  <div
                    key={projectName}
                    className="log-card"
                  >

                    {/* ==========================================
                        PROJECT HEADER
                    ========================================== */}

                    <div
                      className="log-row"
                      onClick={
                        () =>
                          toggleProject(
                            projectName
                          )
                      }
                      role="button"
                      tabIndex={0}
                    >

                      <div className="log-row-left">

                        <div className="log-meta">

                          <span className="log-project-name">
                            {projectName}
                          </span>

                          <span className="log-engineer">

                            {engineerEntries.length}{" "}

                            {engineerEntries.length === 1
                              ? "Engineer"
                              : "Engineers"}

                            {" • "}

                            {projectLogs.length}{" "}

                            {projectLogs.length === 1
                              ? "Log"
                              : "Logs"}

                            {latestLog?.createdAt && (
                              <>
                                {" • Latest "}
                                {formatTime(
                                  latestLog.createdAt
                                )}
                              </>
                            )}

                          </span>

                        </div>

                      </div>

                      <div className="log-tags">

                        <span className="log-tag">
                          {engineerEntries.length} Engineers
                        </span>

                        <span className="log-tag">
                          {projectLogs.length} Logs
                        </span>

                      </div>

                      <div className="log-chevron">

                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          width="18"
                          height="18"
                          style={{
                            transform:
                              projectExpanded
                                ? "rotate(180deg)"
                                : "rotate(0deg)",

                            transition:
                              "transform 0.2s ease",
                          }}
                        >

                          <path
                            d="M5 8l5 5 5-5"
                            stroke="#666"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                        </svg>

                      </div>

                    </div>

                    {/* ==========================================
                        ENGINEERS
                    ========================================== */}

                    {projectExpanded && (

                      <div className="log-detail">

                        {engineerEntries.map(
                          ([
                            engineerName,
                            engineerLogs
                          ]) => {

                            const engineerKey =
                              `${projectName}::${engineerName}`;

                            const engineerExpanded =
                              expandedEngineers.includes(
                                engineerKey
                              );

                            const latestEngineerLog =
                              engineerLogs[0];

                            return (

                              <div
                                key={engineerKey}
                                style={{
                                  border:
                                    "1px solid #e5eaf0",
                                  borderRadius:
                                    "12px",
                                  background:
                                    "#ffffff",
                                  marginBottom:
                                    "10px",
                                  overflow:
                                    "hidden",
                                }}
                              >

                                {/* ==================================
                                    ENGINEER HEADER
                                ================================== */}

                                <div
                                  className="log-row"
                                  onClick={
                                    () =>
                                      toggleEngineer(
                                        projectName,
                                        engineerName
                                      )
                                  }
                                  role="button"
                                  tabIndex={0}
                                  style={{
                                    background:
                                      "#fbfcfd",
                                  }}
                                >

                                  <div className="log-row-left">

                                    <div className="log-meta">

                                      <span className="log-project-name">
                                        {engineerName}
                                      </span>

                                      <span className="log-engineer">

                                        {engineerLogs.length}{" "}

                                        {engineerLogs.length === 1
                                          ? "time log"
                                          : "time logs"}

                                        {latestEngineerLog
                                          ?.createdAt && (
                                          <>
                                            {" • Latest "}
                                            {formatTime(
                                              latestEngineerLog
                                                .createdAt
                                            )}
                                          </>
                                        )}

                                      </span>

                                    </div>

                                  </div>

                                  <div className="log-tags">

                                    <span className="log-tag">

                                      {engineerLogs.length}{" "}

                                      {engineerLogs.length === 1
                                        ? "Log"
                                        : "Logs"}

                                    </span>

                                  </div>

                                  <div className="log-chevron">

                                    <svg
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      width="18"
                                      height="18"
                                      style={{
                                        transform:
                                          engineerExpanded
                                            ? "rotate(180deg)"
                                            : "rotate(0deg)",

                                        transition:
                                          "transform 0.2s ease",
                                      }}
                                    >

                                      <path
                                        d="M5 8l5 5 5-5"
                                        stroke="#666"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />

                                    </svg>

                                  </div>

                                </div>

                                {/* ==================================
                                    ENGINEER TIME LOGS
                                ================================== */}

                                {engineerExpanded && (

                                  <div
                                    style={{
                                      padding:
                                        "10px 14px 14px",
                                      background:
                                        "#f8fafc",
                                    }}
                                  >

                                    {engineerLogs.map(
                                      (log) => {

                                        const logExpanded =
                                          expandedLogs.includes(
                                            log.id
                                          );

                                        return (

                                          <div
                                            key={log.id}
                                            style={{
                                              background:
                                                "#ffffff",

                                              border:
                                                "1px solid #e8edf3",

                                              borderRadius:
                                                "10px",

                                              marginBottom:
                                                "8px",

                                              overflow:
                                                "hidden",
                                            }}
                                          >

                                            {/* ======================
                                                LOG TIME
                                            ====================== */}

                                            <div
                                              className="log-row"
                                              onClick={
                                                () =>
                                                  toggleLog(
                                                    log.id
                                                  )
                                              }
                                              role="button"
                                              tabIndex={0}
                                            >

                                              <div className="log-row-left">

                                                <div className="log-meta">

                                                  <span className="log-project-name">

                                                    {formatTime(
                                                      log.createdAt
                                                    )}

                                                  </span>

                                                  <span className="log-engineer">

                                                    {formatPrettyDate(
                                                      log.createdAt ||
                                                      log.date
                                                    )}

                                                  </span>

                                                </div>

                                              </div>

                                              <div className="log-tags">

                                                <span className="log-tag">

                                                  {
                                                    log.manpower
                                                      .workOnSite
                                                  }{" "}
                                                  Workers

                                                </span>

                                                <span className="log-tag">

                                                  {
                                                    log.conditions
                                                      .weather
                                                  }

                                                </span>

                                                <span className="log-tag">

                                                  {
                                                    log.hasIncident
                                                      ? "Incident"
                                                      : "No Incident"
                                                  }

                                                </span>

                                              </div>

                                              <div className="log-chevron">

                                                <svg
                                                  viewBox="0 0 20 20"
                                                  fill="none"
                                                  width="18"
                                                  height="18"
                                                  style={{
                                                    transform:
                                                      logExpanded
                                                        ? "rotate(180deg)"
                                                        : "rotate(0deg)",

                                                    transition:
                                                      "transform 0.2s ease",
                                                  }}
                                                >

                                                  <path
                                                    d="M5 8l5 5 5-5"
                                                    stroke="#666"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                  />

                                                </svg>

                                              </div>

                                            </div>

                                            {/* ======================
                                                LOG DETAILS
                                            ====================== */}

                                            {logExpanded && (

                                              <div className="log-detail">

                                                <div className="detail-grid">

                                                  {/* MANPOWER */}

                                                  <div className="detail-col">

                                                    <h4 className="section-title">
                                                      Manpower Breakdown
                                                    </h4>

                                                    <div className="detail-row">

                                                      <span className="detail-label">
                                                        Active on Site:
                                                      </span>

                                                      <span className="detail-value">
                                                        {
                                                          log
                                                            .manpower
                                                            .workOnSite
                                                        }
                                                      </span>

                                                    </div>

                                                    <div className="detail-row">

                                                      <span className="detail-label">
                                                        Supervisors:
                                                      </span>

                                                      <span className="detail-value">
                                                        {
                                                          log
                                                            .manpower
                                                            .supervisors
                                                        }
                                                      </span>

                                                    </div>

                                                    <div className="detail-row">

                                                      <span className="detail-label">
                                                        Sub-contractors:
                                                      </span>

                                                      <span className="detail-value">
                                                        {
                                                          log
                                                            .manpower
                                                            .subContractors
                                                        }
                                                      </span>

                                                    </div>

                                                    <div className="detail-row">

                                                      <span className="detail-label">
                                                        Total Work Hours:
                                                      </span>

                                                      <span className="detail-value">
                                                        {
                                                          log
                                                            .manpower
                                                            .totalWorkHours
                                                        }
                                                      </span>

                                                    </div>

                                                  </div>

                                                  {/* CONDITIONS */}

                                                  <div className="detail-col">

                                                    <h4 className="section-title">
                                                      Site Conditions
                                                    </h4>

                                                    <div className="detail-row">

                                                      <span className="detail-label">
                                                        Weather:
                                                      </span>

                                                      <span className="detail-value">
                                                        {
                                                          log
                                                            .conditions
                                                            .weather
                                                        }
                                                      </span>

                                                    </div>

                                                    <div className="detail-row">

                                                      <span className="detail-label">
                                                        Temperature:
                                                      </span>

                                                      <span className="detail-value">
                                                        {
                                                          log
                                                            .conditions
                                                            .temperature
                                                        }
                                                      </span>

                                                    </div>

                                                    <div className="detail-row">

                                                      <span className="detail-label">
                                                        Safety Incident:
                                                      </span>

                                                      <span className="detail-value">

                                                        {
                                                          log.hasIncident
                                                            ? "Yes"
                                                            : "No"
                                                        }

                                                      </span>

                                                    </div>

                                                    {log.phase && (

                                                      <div className="detail-row">

                                                        <span className="detail-label">
                                                          Milestone Phase:
                                                        </span>

                                                        <span className="detail-value">

                                                          {log.phase}

                                                          {
                                                            log.progressPct !==
                                                            null
                                                              ? ` (${log.progressPct}%)`
                                                              : ""
                                                          }

                                                        </span>

                                                      </div>

                                                    )}

                                                  </div>

                                                </div>

                                                {/* WORK COMPLETED */}

                                                <div className="detail-section">

                                                  <h4 className="section-title">
                                                    Work Completed
                                                  </h4>

                                                  <div className="detail-box">
                                                    {log.workCompleted}
                                                  </div>

                                                </div>

                                                {/* MATERIALS / EQUIPMENT */}

                                                <div
                                                  className="two-col-sections"
                                                  style={{
                                                    marginTop:
                                                      "16px",
                                                  }}
                                                >

                                                  <div>

                                                    <h4 className="section-title">
                                                      Materials Delivered
                                                    </h4>

                                                    <div className="detail-box">
                                                      {
                                                        log.materialsDelivered
                                                      }
                                                    </div>

                                                  </div>

                                                  <div>

                                                    <h4 className="section-title">
                                                      Equipment Used
                                                    </h4>

                                                    <div className="detail-box">
                                                      {
                                                        log.equipmentUsed
                                                      }
                                                    </div>

                                                  </div>

                                                </div>

                                                {/* NOTES */}

                                                <div
                                                  className="detail-section"
                                                  style={{
                                                    marginTop:
                                                      "16px",
                                                  }}
                                                >

                                                  <h4 className="section-title">
                                                    Additional Notes
                                                  </h4>

                                                  <div className="detail-box">
                                                    {
                                                      log.additionalNotes
                                                    }
                                                  </div>

                                                </div>

                                              </div>

                                            )}

                                          </div>

                                        );
                                      }
                                    )}

                                  </div>

                                )}

                              </div>

                            );
                          }
                        )}

                      </div>

                    )}

                  </div>

                );
              }
            )
          )}

        </div>

      )}

    </div>
  );
};

export default TimeLog;