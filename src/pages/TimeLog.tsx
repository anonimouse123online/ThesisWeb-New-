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
  // DASHBOARD STATISTICS
  // ==========================================================

  const totalLogs = logs.length;

  const totalProjects = useMemo(
    () =>
      new Set(
        logs
          .map((log) => log.projectName)
          .filter((name) => name && name !== "—")
      ).size,
    [logs]
  );

  const totalEngineers = engineers.length;

  const safetyIncidents = logs.filter(
    (log) => log.hasIncident
  ).length;

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    dateFilter !== "" ||
    engineerFilter !== "All Engineers";

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("");
    setEngineerFilter("All Engineers");
  };

  // ==========================================================
  // DISPLAY HELPERS
  // ==========================================================

  const getLogTimestamp = (
    log: LogEntry
  ): number => {
    const raw = log.createdAt || log.date;

    if (!raw || raw === "—") {
      return 0;
    }

    const timestamp = new Date(raw).getTime();

    return Number.isNaN(timestamp)
      ? 0
      : timestamp;
  };

  const previewText = (
    value: string,
    maxLength = 105
  ): string => {
    if (!value || value === "—") {
      return "No work summary provided.";
    }

    return value.length > maxLength
      ? `${value.slice(0, maxLength).trim()}…`
      : value;
  };

  const clampProgress = (
    value: number | null
  ): number => {
    if (value === null) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(0, value)
    );
  };

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
              ) ||

            (log.phase || "")
              .toLowerCase()
              .includes(
                normalizedSearch
              );

          const matchesDate =
            dateFilter === "" ||
            log.date === dateFilter;

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
            (a, b) =>
              getLogTimestamp(b) -
              getLogTimestamp(a)
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
            (a, b) =>
              getLogTimestamp(b) -
              getLogTimestamp(a)
          );
        }
      );

    return groups;
  };

  const projectEntries =
    useMemo(
      () =>
        Object.entries(
          groupedProjects
        ).sort(
          ([, aLogs], [, bLogs]) =>
            getLogTimestamp(bLogs[0]) -
            getLogTimestamp(aLogs[0])
        ),
      [groupedProjects]
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="timelog-container">

      {/* HEADER */}
      <div className="timelog-header">
        <div>
          <h1 className="timelog-title">
            Time Log
          </h1>

          <p className="timelog-subtitle">
            Review daily field activity by project and engineer.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "999px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            color: "#475569",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {filteredLogs.length} visible
        </div>
      </div>

      {/* SUMMARY */}
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
            Projects
          </span>
          <span className="stat-value">
            {totalProjects}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Engineers
          </span>
          <span className="stat-value">
            {totalEngineers}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Safety Incidents
          </span>
          <span className="stat-value">
            {safetyIncidents}
          </span>
        </div>
      </div>

      {/* FILTERS */}
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
            placeholder="Search project, engineer, phase, or work..."
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

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              minHeight: "42px",
              padding: "0 14px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* LOADING */}
      {loading && (
        <div className="rm-empty">
          Loading time logs...
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div
          className="rm-empty"
          style={{ color: "#b91c1c" }}
        >
          {error}
        </div>
      )}

      {/* PROJECTS */}
      {!loading && !error && (
        <div className="timelog-entries">
          {projectEntries.length === 0 ? (
            <div
              style={{
                padding: "3rem",
                textAlign: "center",
                background: "#fff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
              }}
            >
              <p
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#1e293b",
                  margin: "0 0 6px",
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
                Try changing the search, date, or engineer filter.
              </p>
            </div>
          ) : (
            projectEntries.map(
              ([projectName, projectLogs]) => {
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

                const projectIncidentCount =
                  projectLogs.filter(
                    (log) => log.hasIncident
                  ).length;

                const latestProgress =
                  latestLog?.progressPct;

                return (
                  <div
                    key={projectName}
                    className="log-card"
                    style={{
                      borderRadius: "16px",
                      overflow: "hidden",
                    }}
                  >
                    {/* PROJECT HEADER */}
                    <div
                      className="log-row"
                      onClick={
                        () =>
                          toggleProject(
                            projectName
                          )
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" ||
                          e.key === " "
                        ) {
                          e.preventDefault();
                          toggleProject(
                            projectName
                          );
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-expanded={projectExpanded}
                      style={{
                        padding: "18px 20px",
                        alignItems: "center",
                      }}
                    >
                      <div
                        className="log-row-left"
                        style={{ minWidth: 0 }}
                      >
                        <div
                          className="log-meta"
                          style={{ minWidth: 0 }}
                        >
                          <span className="log-project-name">
                            {projectName}
                          </span>

                          <span className="log-engineer">
                            Latest update: {formatPrettyDate(
                              latestLog?.createdAt ||
                              latestLog?.date
                            )}
                            {latestLog?.createdAt && (
                              <>
                                {" • "}
                                {formatTime(
                                  latestLog.createdAt
                                )}
                              </>
                            )}
                          </span>

                          <span
                            style={{
                              marginTop: "7px",
                              color: "#475569",
                              fontSize: "13px",
                              lineHeight: 1.45,
                            }}
                          >
                            {previewText(
                              latestLog?.workCompleted ||
                              "—",
                              125
                            )}
                          </span>
                        </div>
                      </div>

                      <div
                        className="log-tags"
                        style={{
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <span className="log-tag">
                          {engineerEntries.length} {engineerEntries.length === 1 ? "Engineer" : "Engineers"}
                        </span>

                        <span className="log-tag">
                          {projectLogs.length} {projectLogs.length === 1 ? "Entry" : "Entries"}
                        </span>

                        {latestLog?.phase && (
                          <span className="log-tag">
                            {latestLog.phase}
                            {latestProgress !== null &&
                            latestProgress !== undefined
                              ? ` • ${latestProgress}%`
                              : ""}
                          </span>
                        )}

                        {projectIncidentCount > 0 && (
                          <span
                            className="log-tag"
                            style={{
                              background: "#fef2f2",
                              color: "#b91c1c",
                              borderColor: "#fecaca",
                            }}
                          >
                            {projectIncidentCount} Incident{projectIncidentCount === 1 ? "" : "s"}
                          </span>
                        )}
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

                    {/* PROJECT CONTENT */}
                    {projectExpanded && (
                      <div
                        className="log-detail"
                        style={{
                          padding: "16px",
                          background: "#f8fafc",
                        }}
                      >
                        {engineerEntries.map(
                          ([engineerName, engineerLogs]) => {
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
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "14px",
                                  background: "#ffffff",
                                  marginBottom: "12px",
                                  overflow: "hidden",
                                }}
                              >
                                {/* ENGINEER HEADER */}
                                <div
                                  className="log-row"
                                  onClick={
                                    () =>
                                      toggleEngineer(
                                        projectName,
                                        engineerName
                                      )
                                  }
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" ||
                                      e.key === " "
                                    ) {
                                      e.preventDefault();
                                      toggleEngineer(
                                        projectName,
                                        engineerName
                                      );
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={engineerExpanded}
                                  style={{
                                    background: "#ffffff",
                                    padding: "14px 16px",
                                  }}
                                >
                                  <div
                                    className="log-row-left"
                                    style={{ minWidth: 0 }}
                                  >
                                    <div
                                      className="log-meta"
                                      style={{ minWidth: 0 }}
                                    >
                                      <span className="log-project-name">
                                        {engineerName}
                                      </span>

                                      <span className="log-engineer">
                                        {engineerLogs.length} {engineerLogs.length === 1 ? "time log" : "time logs"}
                                        {" • Last entry "}
                                        {formatPrettyDate(
                                          latestEngineerLog?.createdAt ||
                                          latestEngineerLog?.date
                                        )}
                                      </span>

                                      <span
                                        style={{
                                          marginTop: "6px",
                                          color: "#64748b",
                                          fontSize: "12px",
                                          lineHeight: 1.4,
                                        }}
                                      >
                                        Latest: {previewText(
                                          latestEngineerLog?.workCompleted ||
                                          "—",
                                          95
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="log-tags">
                                    {latestEngineerLog?.conditions.weather &&
                                    latestEngineerLog.conditions.weather !== "—" && (
                                      <span className="log-tag">
                                        {latestEngineerLog.conditions.weather}
                                      </span>
                                    )}

                                    {latestEngineerLog?.phase && (
                                      <span className="log-tag">
                                        {latestEngineerLog.phase}
                                      </span>
                                    )}
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

                                {/* ENGINEER LOGS */}
                                {engineerExpanded && (
                                  <div
                                    style={{
                                      padding: "12px",
                                      background: "#f8fafc",
                                      borderTop: "1px solid #eef2f7",
                                    }}
                                  >
                                    {engineerLogs.map(
                                      (log) => {
                                        const logExpanded =
                                          expandedLogs.includes(
                                            log.id
                                          );

                                        const progress =
                                          clampProgress(
                                            log.progressPct
                                          );

                                        return (
                                          <div
                                            key={log.id}
                                            style={{
                                              background: "#ffffff",
                                              border: "1px solid #e2e8f0",
                                              borderRadius: "12px",
                                              marginBottom: "10px",
                                              overflow: "hidden",
                                            }}
                                          >
                                            {/* LOG SUMMARY */}
                                            <div
                                              className="log-row"
                                              onClick={
                                                () =>
                                                  toggleLog(
                                                    log.id
                                                  )
                                              }
                                              onKeyDown={(e) => {
                                                if (
                                                  e.key === "Enter" ||
                                                  e.key === " "
                                                ) {
                                                  e.preventDefault();
                                                  toggleLog(
                                                    log.id
                                                  );
                                                }
                                              }}
                                              role="button"
                                              tabIndex={0}
                                              aria-expanded={logExpanded}
                                              style={{
                                                alignItems: "flex-start",
                                                padding: "14px 16px",
                                              }}
                                            >
                                              <div
                                                className="log-row-left"
                                                style={{ minWidth: 0 }}
                                              >
                                                <div
                                                  className="log-meta"
                                                  style={{ minWidth: 0 }}
                                                >
                                                  <span className="log-project-name">
                                                    {formatPrettyDate(
                                                      log.createdAt ||
                                                      log.date
                                                    )}
                                                    {log.createdAt && (
                                                      <>
                                                        {" • "}
                                                        {formatTime(
                                                          log.createdAt
                                                        )}
                                                      </>
                                                    )}
                                                  </span>

                                                  <span className="log-engineer">
                                                    Daily field entry
                                                  </span>

                                                  <span
                                                    style={{
                                                      marginTop: "7px",
                                                      color: "#334155",
                                                      fontSize: "13px",
                                                      lineHeight: 1.5,
                                                      maxWidth: "720px",
                                                    }}
                                                  >
                                                    {previewText(
                                                      log.workCompleted,
                                                      150
                                                    )}
                                                  </span>
                                                </div>
                                              </div>

                                              <div
                                                className="log-tags"
                                                style={{
                                                  flexWrap: "wrap",
                                                  justifyContent: "flex-end",
                                                }}
                                              >
                                                {log.phase && (
                                                  <span className="log-tag">
                                                    {log.phase}
                                                    {log.progressPct !== null
                                                      ? ` • ${log.progressPct}%`
                                                      : ""}
                                                  </span>
                                                )}

                                                {log.conditions.weather !== "—" && (
                                                  <span className="log-tag">
                                                    {log.conditions.weather}
                                                  </span>
                                                )}

                                                <span
                                                  className="log-tag"
                                                  style={
                                                    log.hasIncident
                                                      ? {
                                                          background: "#fef2f2",
                                                          color: "#b91c1c",
                                                          borderColor: "#fecaca",
                                                        }
                                                      : {
                                                          background: "#f0fdf4",
                                                          color: "#166534",
                                                          borderColor: "#bbf7d0",
                                                        }
                                                  }
                                                >
                                                  {log.hasIncident
                                                    ? "Incident recorded"
                                                    : "No incident"}
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

                                            {/* LOG DETAILS */}
                                            {logExpanded && (
                                              <div
                                                className="log-detail"
                                                style={{
                                                  borderTop: "1px solid #eef2f7",
                                                  padding: "18px",
                                                }}
                                              >
                                                {/* PROJECT STATUS */}
                                                {(log.phase ||
                                                  log.progressPct !== null) && (
                                                  <div
                                                    className="detail-section"
                                                    style={{
                                                      marginBottom: "18px",
                                                    }}
                                                  >
                                                    <h4 className="section-title">
                                                      Project Status
                                                    </h4>

                                                    <div
                                                      style={{
                                                        padding: "14px",
                                                        border: "1px solid #e2e8f0",
                                                        borderRadius: "10px",
                                                        background: "#f8fafc",
                                                      }}
                                                    >
                                                      <div
                                                        style={{
                                                          display: "flex",
                                                          justifyContent: "space-between",
                                                          gap: "16px",
                                                          flexWrap: "wrap",
                                                          marginBottom:
                                                            log.progressPct !== null
                                                              ? "10px"
                                                              : 0,
                                                        }}
                                                      >
                                                        <span
                                                          style={{
                                                            color: "#475569",
                                                            fontSize: "13px",
                                                          }}
                                                        >
                                                          Phase
                                                        </span>
                                                        <strong
                                                          style={{
                                                            color: "#0f172a",
                                                            fontSize: "13px",
                                                          }}
                                                        >
                                                          {log.phase || "Not specified"}
                                                          {log.progressPct !== null
                                                            ? ` • ${log.progressPct}%`
                                                            : ""}
                                                        </strong>
                                                      </div>

                                                      {log.progressPct !== null && (
                                                        <div
                                                          style={{
                                                            height: "8px",
                                                            borderRadius: "999px",
                                                            background: "#e2e8f0",
                                                            overflow: "hidden",
                                                          }}
                                                        >
                                                          <div
                                                            style={{
                                                              width: `${progress}%`,
                                                              height: "100%",
                                                              background: "#334155",
                                                              borderRadius: "999px",
                                                            }}
                                                          />
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* QUICK FACTS */}
                                                <div className="detail-grid">
                                                  <div className="detail-col">
                                                    <h4 className="section-title">
                                                      Site Conditions
                                                    </h4>

                                                    <div className="detail-row">
                                                      <span className="detail-label">
                                                        Weather:
                                                      </span>
                                                      <span className="detail-value">
                                                        {log.conditions.weather}
                                                      </span>
                                                    </div>

                                                    <div className="detail-row">
                                                      <span className="detail-label">
                                                        Temperature:
                                                      </span>
                                                      <span className="detail-value">
                                                        {log.conditions.temperature}
                                                      </span>
                                                    </div>

                                                    <div className="detail-row">
                                                      <span className="detail-label">
                                                        Safety Incident:
                                                      </span>
                                                      <span
                                                        className="detail-value"
                                                        style={{
                                                          fontWeight: 700,
                                                          color: log.hasIncident
                                                            ? "#b91c1c"
                                                            : "#166534",
                                                        }}
                                                      >
                                                        {log.hasIncident
                                                          ? "Yes"
                                                          : "No"}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  <div className="detail-col">
                                                    <h4 className="section-title">
                                                      Recorded Site Activity
                                                    </h4>

                                                    <div className="detail-row">
                                                      <span className="detail-label">
                                                        Workers on Site:
                                                      </span>
                                                      <span className="detail-value">
                                                        {log.manpower.workOnSite}
                                                      </span>
                                                    </div>

                                                    <div className="detail-row">
                                                      <span className="detail-label">
                                                        Supervisors:
                                                      </span>
                                                      <span className="detail-value">
                                                        {log.manpower.supervisors}
                                                      </span>
                                                    </div>

                                                    <div className="detail-row">
                                                      <span className="detail-label">
                                                        Sub-contractors:
                                                      </span>
                                                      <span className="detail-value">
                                                        {log.manpower.subContractors}
                                                      </span>
                                                    </div>

                                                    <div className="detail-row">
                                                      <span className="detail-label">
                                                        Work Hours:
                                                      </span>
                                                      <span className="detail-value">
                                                        {log.manpower.totalWorkHours}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>

                                                {/* WORK COMPLETED */}
                                                <div
                                                  className="detail-section"
                                                  style={{
                                                    marginTop: "18px",
                                                  }}
                                                >
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
                                                    marginTop: "16px",
                                                  }}
                                                >
                                                  <div>
                                                    <h4 className="section-title">
                                                      Materials Delivered
                                                    </h4>
                                                    <div className="detail-box">
                                                      {log.materialsDelivered}
                                                    </div>
                                                  </div>

                                                  <div>
                                                    <h4 className="section-title">
                                                      Equipment Used
                                                    </h4>
                                                    <div className="detail-box">
                                                      {log.equipmentUsed}
                                                    </div>
                                                  </div>
                                                </div>

                                                {/* NOTES */}
                                                <div
                                                  className="detail-section"
                                                  style={{
                                                    marginTop: "16px",
                                                  }}
                                                >
                                                  <h4 className="section-title">
                                                    Additional Notes
                                                  </h4>

                                                  <div className="detail-box">
                                                    {log.additionalNotes}
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
