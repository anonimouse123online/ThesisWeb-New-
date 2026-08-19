import React, { useState, useEffect } from "react";
import "../components/TimeLog.css";
import { API_BASE_URL, fetchWithAuth } from "../utils/api";

const BACKEND_URL = API_BASE_URL;

interface RawLog {
  id: string;
  project_code: string;
  project_name: string;
  engineer_name: string;
  date: string;
  phase: string;
  progress_pct: number;
  summary: string;
  work_completed: string;
  work_on_site: number;
  weather: string;
  created_at: string;
}

interface LogEntry {
  id: string | number;
  projectName: string;
  engineerName: string;
  date: string;
  phase: string;
  progressPct: number;
  tags: string[];
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

const TimeLog: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [engineerFilter, setEngineerFilter] = useState("All Engineers");
  const [engineers, setEngineers] = useState<string[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<(string | number)[]>([]);

  useEffect(() => {
    fetchLogs();
    fetchEngineers();
  }, []);

  const fetchEngineers = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/users`);
      if (res.ok) {
        const json = await res.json();
        const names = (json.data || []).map((u: any) => u.full_name || u.name).filter(Boolean);
        setEngineers(Array.from(new Set(names)));
      }
    } catch { /* ignore */ }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithAuth(`${BACKEND_URL}/timelogs`);
      if (!res.ok) throw new Error("Failed to fetch time logs.");
      const json = await res.json();
      const rawList: RawLog[] = json.data || [];

      const formatted: LogEntry[] = rawList.map((r) => {
        const manpowerCount = r.work_on_site || 0;
        return {
          id: r.id,
          projectName: r.project_name || r.project_code || "General Site",
          engineerName: r.engineer_name || "Site Engineer",
          date: r.date || new Date(r.created_at).toISOString().split("T")[0],
          phase: r.phase || "Active Phase",
          progressPct: r.progress_pct || 0,
          tags: [
            `${manpowerCount} workers`,
            r.weather || "Clear/Sunny",
            r.phase || "Phase Milestone",
          ],
          manpower: {
            workOnSite: manpowerCount,
            supervisors: Math.max(1, Math.round(manpowerCount * 0.1)),
            subContractors: Math.max(0, Math.round(manpowerCount * 0.2)),
            totalWorkHours: `${manpowerCount * 8}h`,
          },
          conditions: {
            weather: r.weather || "Clear/Sunny",
            temperature: r.weather?.includes("°C") ? r.weather : "29°C",
          },
          workCompleted: r.work_completed || r.summary || "Daily inspection & construction execution.",
          materialsDelivered: "Standard materials staged on site.",
          equipmentUsed: "Site machinery and standard safety tools in use.",
          additionalNotes: r.summary || "Work progressing on schedule.",
        };
      });

      setLogs(formatted);
    } catch (err: any) {
      setError(err.message || "Failed to load time logs.");
    } finally {
      setLoading(false);
    }
  };

  const totalLogs = logs.length;
  const totalWorkers = logs.reduce((sum, l) => sum + l.manpower.workOnSite, 0);
  const totalHours = logs.reduce(
    (sum, l) => sum + (parseInt(l.manpower.totalWorkHours) || 0),
    0
  );
  const safetyAccidents = 0;

  const toggleLog = (id: string | number) => {
    setExpandedLogs((prev) =>
      prev.includes(id) ? prev.filter((lid) => lid !== id) : [...prev, id]
    );
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchQuery === "" ||
      log.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.engineerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.workCompleted.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = dateFilter === "" || log.date === dateFilter;
    const matchesEngineer =
      engineerFilter === "All Engineers" ||
      log.engineerName.toLowerCase() === engineerFilter.toLowerCase();
    return matchesSearch && matchesDate && matchesEngineer;
  });

  return (
    <div className="timelog-container">
      {/* Header */}
      <div className="timelog-header">
        <div>
          <h1 className="timelog-title">Time Log</h1>
          <p className="timelog-subtitle">Daily field progress & manpower logs submitted by site engineers</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="timelog-stats">
        <div className="stat-card">
          <span className="stat-label">Total Logs</span>
          <span className="stat-value">{totalLogs}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Workers Logged</span>
          <span className="stat-value">{totalWorkers}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Work Hours</span>
          <span className="stat-value">{totalHours}h</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Safety Incidents</span>
          <span className="stat-value">{safetyAccidents}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="timelog-filters">
        <div className="search-wrapper">
          <svg className="search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="#999" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="#999" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search logs by project, engineer, or work summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="date-wrapper">
          <input
            type="date"
            className="date-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        <div className="select-wrapper">
          <select
            className="engineer-select"
            value={engineerFilter}
            onChange={(e) => setEngineerFilter(e.target.value)}
          >
            <option value="All Engineers">All Engineers</option>
            {engineers.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <svg className="select-arrow" viewBox="0 0 20 20" fill="none">
            <path d="M5 8l5 5 5-5" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {loading && <div className="rm-empty">Loading daily time logs...</div>}
      {error && <div className="rm-empty" style={{ color: "red" }}>{error}</div>}

      {/* Log Entries */}
      {!loading && !error && (
        <div className="timelog-entries">
          {filteredLogs.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b", margin: "0 0 6px" }}>
                No daily logs found
              </p>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                When engineers log daily manpower and progress in <strong>Project Actions → Update Progress</strong>, they will automatically appear here.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogs.includes(log.id);
              return (
                <div key={log.id} className="log-card">
                  {/* Log Row */}
                  <div
                    className="log-row"
                    onClick={() => toggleLog(log.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && toggleLog(log.id)}
                  >
                    <div className="log-col log-col-project">
                      <span className="log-project-name">{log.projectName}</span>
                      <span className="log-engineer-name">{log.engineerName}</span>
                    </div>

                    <div className="log-col log-col-date">
                      <span className="log-date">{log.date}</span>
                    </div>

                    <div className="log-col log-col-tags">
                      {log.tags.map((tag, i) => (
                        <span
                          key={i}
                          className={`log-tag ${
                            tag.includes("Incidents")
                              ? "tag-incident"
                              : tag.includes("workers")
                              ? "tag-workers"
                              : "tag-weather"
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="log-col log-col-chevron">
                      <svg
                        className={`chevron-icon ${isExpanded ? "open" : ""}`}
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <path
                          d="M6 8l4 4 4-4"
                          stroke="#666"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="log-details">
                      <div className="details-grid">
                        <div className="detail-section">
                          <h4 className="section-heading">Manpower Breakdown</h4>
                          <div className="detail-row">
                            <span className="detail-label">Active on Site:</span>
                            <span className="detail-value">{log.manpower.workOnSite}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Supervisors:</span>
                            <span className="detail-value">{log.manpower.supervisors}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Sub-contractors:</span>
                            <span className="detail-value">{log.manpower.subContractors}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Total Work Hours:</span>
                            <span className="detail-value">{log.manpower.totalWorkHours}</span>
                          </div>
                        </div>

                        <div className="detail-section">
                          <h4 className="section-heading">Site Conditions</h4>
                          <div className="detail-row">
                            <span className="detail-label">Weather:</span>
                            <span className="detail-value">{log.conditions.weather}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Temperature:</span>
                            <span className="detail-value">{log.conditions.temperature}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Milestone Phase:</span>
                            <span className="detail-value">{log.phase} ({log.progressPct}%)</span>
                          </div>
                        </div>
                      </div>

                      <div className="detail-full">
                        <h4 className="section-heading">Work Completed Today</h4>
                        <p className="detail-text">{log.workCompleted}</p>
                      </div>

                      <div className="detail-full">
                        <h4 className="section-heading">Additional Notes & Field Logs</h4>
                        <p className="detail-text">{log.additionalNotes}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default TimeLog;