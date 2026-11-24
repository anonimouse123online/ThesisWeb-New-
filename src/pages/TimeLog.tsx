import React, { useEffect, useMemo, useState } from "react";
import "../components/TimeLog.css";
import { API_BASE_URL, fetchWithAuth } from "../utils/api";
import Dropdown, { type DropdownOption } from "../components/Dropdown";
import { Users, User } from "lucide-react";

const BACKEND_URL = API_BASE_URL;

// ============================================================
// RAW API MODEL
// ============================================================

interface RawLog {
  id: string | number;

  project_name?: string | null;
  engineer_name?: string | null;
  date?: string | null;
  time_in?: string | null;
  time_out?: string | null;

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
  timeIn?: string | null;
  timeOut?: string | null;
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
  value: number | string | null | undefined,
  timeIn?: string | null,
  timeOut?: string | null,
  explicitDuration?: string | null
): string => {
  // 1. Prioritize explicit duration tag if valid (e.g. from [Duration: 00h 02m 15s])
  if (explicitDuration && explicitDuration.trim()) {
    const trimmed = explicitDuration.trim();
    if (/^\d{1,2}h\s*\d{1,2}m\s*\d{1,2}s$/i.test(trimmed)) {
      return trimmed;
    }
  }

  if (value === null || value === undefined || value === "") {
    return "00h 00m 00s";
  }

  const text = String(value).trim();
  if (!text || text === "—") {
    return "—";
  }

  // 2. Check if already formatted as HHh MMm SSs (e.g. "00h 02m 15s", "1h 30m 45s")
  const hmsMatch = text.match(/^(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?\s*(?:(\d+)\s*s(?:ec(?:onds?)?)?)?$/i);
  if (hmsMatch && (hmsMatch[1] !== undefined || hmsMatch[2] !== undefined || hmsMatch[3] !== undefined)) {
    const h = parseInt(hmsMatch[1] || "0", 10);
    const m = parseInt(hmsMatch[2] || "0", 10);
    const s = parseInt(hmsMatch[3] || "0", 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s) && (h > 0 || m > 0 || s > 0 || text.includes("00s") || text.includes("0s"))) {
      return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    }
  }

  // 3. Check if formatted as HH:mm:ss
  const colonMatch = text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    const s = parseInt(colonMatch[3], 10);
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }

  // 4. If timeIn and timeOut are identical (e.g. "02:17 PM" and "02:17 PM") and value is small (<= 0.1),
  // this is a test shift where mobile clamped duration to 0.1 hrs
  if (timeIn && timeOut && timeIn.trim().toLowerCase() === timeOut.trim().toLowerCase()) {
    const num = parseFloat(text.replace(/[^0-9.]/g, ""));
    if (!isNaN(num) && num <= 0.1) {
      return "00h 00m 00s";
    }
  }

  // 5. Numeric / decimal hours (e.g. "8", "8.5", "0.1", "0.1 hrs", "0.1 hrsh", "8 hrs")
  const cleanNumeric = parseFloat(text.replace(/[^0-9.]/g, ""));
  if (!isNaN(cleanNumeric) && isFinite(cleanNumeric)) {
    const totalSeconds = Math.round(cleanNumeric * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }

  return text;
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
// LOG METADATA PARSER (Location, Geofencing, Offline Status)
// ============================================================

interface GeofenceAlertInfo {
  leftTime: string;
  returnTime: string;
  duration?: string;
}

interface ParsedLogNotes {
  location: string | null;
  geofence: string | null;
  isGeofenceVerified: boolean;
  offlineRecord: string | null;
  timeIn: string | null;
  timeOut: string | null;
  geofenceAlert: GeofenceAlertInfo | null;
  geofenceAlerts: GeofenceAlertInfo[];
  duration: string | null;
  cleanNotes: string;
}

const parseLogNotes = (
  rawNotes?: string | null,
  fallbackTime?: string | null
): ParsedLogNotes => {
  if (!rawNotes) {
    return {
      location: null,
      geofence: null,
      isGeofenceVerified: false,
      offlineRecord: null,
      timeIn: null,
      timeOut: null,
      geofenceAlert: null,
      geofenceAlerts: [],
      duration: null,
      cleanNotes: "",
    };
  }

  let text = rawNotes;
  let location: string | null = null;
  let geofence: string | null = null;
  let isGeofenceVerified = false;
  let offlineRecord: string | null = null;
  let timeIn: string | null = null;
  let timeOut: string | null = null;
  const geofenceAlerts: GeofenceAlertInfo[] = [];
  let duration: string | null = null;

  // Extract Duration: [Duration: ...]
  const durationMatch = text.match(/\[Duration:\s*([^\]]+)\]/i);
  if (durationMatch) {
    duration = durationMatch[1].trim();
    text = text.replace(durationMatch[0], "");
  }

  // Extract Time In: [Time In: ...]
  const timeInMatch = text.match(/\[Time In:\s*([^\]]+)\]/i);
  if (timeInMatch) {
    timeIn = timeInMatch[1].trim();
    text = text.replace(timeInMatch[0], "");
  }

  // Extract Time Out: [Time Out: ...]
  const timeOutMatch = text.match(/\[Time Out:\s*([^\]]+)\]/i);
  if (timeOutMatch) {
    timeOut = timeOutMatch[1].trim();
    text = text.replace(timeOutMatch[0], "");
  }

  // Extract all Geofence Alerts: [Geofence Alert: ...] or [Alert: ...]
  const alertRegex = /\[(?:Geofence\s*)?Alert(?:\s*#?\d+)?:?\s*([^\]]+)\]/gi;
  let alertExecMatch: RegExpExecArray | null;
  while ((alertExecMatch = alertRegex.exec(text)) !== null) {
    const rawAlertContent = alertExecMatch[1].trim();
    const leftMatch = rawAlertContent.match(/left(?:\s*at|\s*zone)?[:\s]+([0-9]{1,2}:[0-9]{2}(?:\s*[AaPp][Mm])?)/i);
    const returnMatch = rawAlertContent.match(/return(?:ed)?(?:\s*at|\s*to\s*(?:site|zone))?[:\s]+([0-9]{1,2}:[0-9]{2}(?:\s*[AaPp][Mm])?)/i);

    const leftTime = leftMatch ? leftMatch[1].trim() : "";
    const returnTime = returnMatch ? returnMatch[1].trim() : (rawAlertContent.toLowerCase().includes("outside") ? "Still Outside" : "—");

    if (leftTime || returnTime !== "—") {
      geofenceAlerts.push({
        leftTime: leftTime || "Recorded Outside",
        returnTime: returnTime,
      });
    } else {
      geofenceAlerts.push({
        leftTime: rawAlertContent,
        returnTime: "—",
      });
    }
  }
  text = text.replace(alertRegex, "");

  // Extract Offline Record: [Offline Record: ...]
  const offlineMatch = text.match(/\[Offline Record:\s*([^\]]+)\]/i);
  if (offlineMatch) {
    const rawOffline = offlineMatch[1].trim();
    if (rawOffline.toLowerCase() === "queued for sync") {
      offlineRecord = fallbackTime ? `${fallbackTime} (Queued Offline)` : "Queued Offline";
    } else {
      offlineRecord = rawOffline.replace(/^recorded offline at\s*/i, "");
    }
    text = text.replace(offlineMatch[0], "");
  }

  // Extract Geofence: [Geofence: ...]
  const geofenceMatch = text.match(/\[Geofence:\s*([^\]]+)\]/i);
  if (geofenceMatch) {
    geofence = geofenceMatch[1].trim();
    isGeofenceVerified = geofence.toLowerCase().includes("verified");
    text = text.replace(geofenceMatch[0], "");
  }

  // Extract Location: Location: ...
  const locationMatch = text.match(/Location:\s*([^•\[]+)/i);
  if (locationMatch) {
    location = locationMatch[1].trim();
    text = text.replace(locationMatch[0], "");
  }

  // Clean up notes: remove bullets, trim
  const cleanNotes = text
    .split("•")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" • ");

  return {
    location,
    geofence,
    isGeofenceVerified,
    offlineRecord,
    timeIn,
    timeOut,
    geofenceAlert: geofenceAlerts[0] || null,
    geofenceAlerts,
    duration,
    cleanNotes,
  };
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

            timeIn:
              r.time_in?.trim() ||
              null,

            timeOut:
              r.time_out?.trim() ||
              null,

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
                  r.total_work_hours,
                  r.time_in,
                  r.time_out
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

  const engineerOptions: DropdownOption[] = useMemo(() => [
    {
      value: "All Engineers",
      label: "All Engineers",
      icon: <Users size={14} />,
    },
    ...engineers.map((name) => ({
      value: name,
      label: name,
      icon: <User size={14} />,
    })),
  ], [engineers]);

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

        <Dropdown
          options={engineerOptions}
          value={engineerFilter}
          onChange={setEngineerFilter}
          prefix="Engineer"
          searchable={engineers.length > 5}
        />

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

                                        const fallbackTimestamp = `${formatPrettyDate(
                                          log.createdAt || log.date
                                        )}${
                                          log.createdAt
                                            ? ` • ${formatTime(log.createdAt)}`
                                            : ""
                                        }`;

                                        const meta = parseLogNotes(
                                          log.additionalNotes,
                                          fallbackTimestamp
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

                                                    {/* Location */}
                                                    {meta.location && (
                                                      <div className="detail-row">
                                                        <span className="detail-label">
                                                          Location:
                                                        </span>
                                                        <span
                                                          className="detail-value"
                                                          style={{
                                                            wordBreak: "break-word",
                                                            fontSize: "12px",
                                                          }}
                                                        >
                                                          {meta.location}
                                                        </span>
                                                      </div>
                                                    )}

                                                    {/* Geofencing */}
                                                    {meta.geofence && (
                                                      <div className="detail-row">
                                                        <span className="detail-label">
                                                          Geofencing:
                                                        </span>
                                                        <span className="detail-value">
                                                          <span
                                                            style={{
                                                              display: "inline-block",
                                                              padding: "2px 8px",
                                                              borderRadius: "4px",
                                                              fontSize: "11px",
                                                              fontWeight: 600,
                                                              background: meta.isGeofenceVerified
                                                                ? "#ecfdf5"
                                                                : "#fef2f2",
                                                              color: meta.isGeofenceVerified
                                                                ? "#065f46"
                                                                : "#991b1b",
                                                              border: `1px solid ${
                                                                meta.isGeofenceVerified
                                                                  ? "#a7f3d0"
                                                                  : "#fecaca"
                                                              }`,
                                                            }}
                                                          >
                                                            {meta.geofence}
                                                          </span>
                                                        </span>
                                                      </div>
                                                    )}

                                                    {/* Offline Record with timestamp - only displays if logged offline */}
                                                    {meta.offlineRecord && (
                                                      <div className="detail-row">
                                                        <span className="detail-label">
                                                          Offline Record:
                                                        </span>
                                                        <span className="detail-value">
                                                          <span
                                                            style={{
                                                              display: "inline-block",
                                                              padding: "2px 8px",
                                                              borderRadius: "4px",
                                                              fontSize: "11px",
                                                              fontWeight: 600,
                                                              background: "#fffbeb",
                                                              color: "#92400e",
                                                              border: "1px solid #fde68a",
                                                            }}
                                                          >
                                                            {meta.offlineRecord}
                                                          </span>
                                                        </span>
                                                      </div>
                                                    )}
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
                                                        Time In:
                                                      </span>
                                                      <span className="detail-value">
                                                        {meta.timeIn || log.timeIn || "—"}
                                                      </span>
                                                    </div>

                                                    <div className="detail-row">
                                                      <span className="detail-label">
                                                        Time Out:
                                                      </span>
                                                      <span className="detail-value">
                                                        {meta.timeOut || log.timeOut || "—"}
                                                      </span>
                                                    </div>

                                                    <div className="detail-row">
                                                      <span className="detail-label">
                                                        Work Hours:
                                                      </span>
                                                      <span className="detail-value">
                                                        {formatHours(
                                                          meta.duration || log.manpower.totalWorkHours,
                                                          meta.timeIn || log.timeIn,
                                                          meta.timeOut || log.timeOut,
                                                          meta.duration
                                                        )}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  {/* GEOFENCE ALERT COLUMN (PERIMETER MONITORING) */}
                                                  <div className="detail-col">
                                                    <h4 className="section-title">
                                                      <span
                                                        style={{
                                                          display: "inline-flex",
                                                          alignItems: "center",
                                                          gap: "6px",
                                                          background: meta.geofenceAlerts.length > 0
                                                            ? "#fee2e2"
                                                            : "#f1f5f9",
                                                          color: meta.geofenceAlerts.length > 0
                                                            ? "#dc2626"
                                                            : "#475569",
                                                          padding: "2px 8px",
                                                          borderRadius: "4px",
                                                          fontSize: "12px",
                                                          fontWeight: 800,
                                                          border: `1px solid ${
                                                            meta.geofenceAlerts.length > 0
                                                              ? "#fca5a5"
                                                              : "#cbd5e1"
                                                          }`,
                                                          letterSpacing: "0.5px",
                                                        }}
                                                      >
                                                        ALERT
                                                        {meta.geofenceAlerts.length > 0 && (
                                                          <span
                                                            style={{
                                                              fontSize: "10px",
                                                              fontWeight: 700,
                                                              background: "#dc2626",
                                                              color: "#ffffff",
                                                              padding: "0 6px",
                                                              borderRadius: "999px",
                                                              minWidth: "16px",
                                                              textAlign: "center",
                                                              lineHeight: "16px",
                                                            }}
                                                          >
                                                            {meta.geofenceAlerts.length}
                                                          </span>
                                                        )}
                                                      </span>
                                                    </h4>

                                                    {meta.geofenceAlerts.length > 0 ? (
                                                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                        {meta.geofenceAlerts.map((alert, idx) => (
                                                          <div
                                                            key={idx}
                                                            style={{
                                                              background: "#fff1f2",
                                                              border: "1.5px solid #fecdd3",
                                                              borderRadius: "8px",
                                                              padding: "10px 12px",
                                                              display: "flex",
                                                              flexDirection: "column",
                                                              gap: "4px",
                                                            }}
                                                          >
                                                            <div
                                                              style={{
                                                                fontSize: "11px",
                                                                fontWeight: 700,
                                                                color: "#9f1239",
                                                                textTransform: "uppercase",
                                                                letterSpacing: "0.5px",
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                alignItems: "center",
                                                              }}
                                                            >
                                                              <span>Outside Geofencing Zone</span>
                                                            </div>

                                                            <div className="detail-row" style={{ marginTop: "2px" }}>
                                                              <span
                                                                className="detail-label"
                                                                style={{
                                                                  color: "#be123c",
                                                                  fontWeight: 600,
                                                                  minWidth: "125px",
                                                                }}
                                                              >
                                                                Left Geofence Zone:
                                                              </span>
                                                              <span
                                                                className="detail-value"
                                                                style={{
                                                                  fontWeight: 700,
                                                                  color: "#9f1239",
                                                                }}
                                                              >
                                                                {alert.leftTime}
                                                              </span>
                                                            </div>

                                                            <div className="detail-row">
                                                              <span
                                                                className="detail-label"
                                                                style={{
                                                                  color: "#047857",
                                                                  fontWeight: 600,
                                                                  minWidth: "125px",
                                                                }}
                                                              >
                                                                Returned to Zone:
                                                              </span>
                                                              <span
                                                                className="detail-value"
                                                                style={{
                                                                  fontWeight: 700,
                                                                  color: "#065f46",
                                                                }}
                                                              >
                                                                {alert.returnTime}
                                                              </span>
                                                            </div>

                                                            {alert.duration && (
                                                              <div
                                                                style={{
                                                                  fontSize: "10px",
                                                                  color: "#881337",
                                                                  marginTop: "2px",
                                                                }}
                                                              >
                                                                Duration Outside: {alert.duration}
                                                              </div>
                                                            )}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    ) : (
                                                      <div
                                                        style={{
                                                          background: "#f8fafc",
                                                          border: "1px solid #e2e8f0",
                                                          borderRadius: "8px",
                                                          padding: "10px 12px",
                                                          display: "flex",
                                                          flexDirection: "column",
                                                          gap: "4px",
                                                        }}
                                                      >
                                                        <div
                                                          style={{
                                                            fontSize: "11px",
                                                            fontWeight: 600,
                                                            color: "#166534",
                                                          }}
                                                        >
                                                          • Monitored Shift
                                                        </div>
                                                        <div
                                                          style={{
                                                            fontSize: "11px",
                                                            color: "#64748b",
                                                            lineHeight: "15px",
                                                          }}
                                                        >
                                                          No geofence violations detected. Engineer remained on-site during active work hours.
                                                        </div>
                                                      </div>
                                                    )}
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
                                                    {meta.cleanNotes || "None"}
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
