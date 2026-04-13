import React, { useState } from "react";
import "../components/TimeLog.css";

interface LogEntry {
  id: number;
  projectName: string;
  engineerName: string;
  date: string;
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

const mockLogs: LogEntry[] = [
  {
    id: 1,
    projectName: "Riverside Bridge Renovation",
    engineerName: "Mike Johnson",
    date: "2026-02-06",
    tags: ["No Incidents", "Clear/Sunny", "25 workers"],
    manpower: {
      workOnSite: 25,
      supervisors: 3,
      subContractors: 5,
      totalWorkHours: "8h",
    },
    conditions: {
      weather: "Clear/Sunny",
      temperature: "28°C",
    },
    workCompleted: "Completed the base of the bridge.",
    materialsDelivered: "50 tons of concrete, 20 steel beams",
    equipmentUsed: "2 excavators, 1 crane, 3 dump trucks",
    additionalNotes: "Work progressing as scheduled. Weather conditions favorable.",
  },
];

const TimeLog: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [engineerFilter, setEngineerFilter] = useState("All Engineers");
  const [expandedLogs, setExpandedLogs] = useState<number[]>([]);

  const totalLogs = mockLogs.length;
  const totalWorkers = mockLogs.reduce((sum, l) => sum + l.manpower.workOnSite, 0);
  const totalHours = mockLogs.reduce(
    (sum, l) => sum + parseInt(l.manpower.totalWorkHours),
    0
  );
  const safetyAccidents = 0;

  const toggleLog = (id: number) => {
    setExpandedLogs((prev) =>
      prev.includes(id) ? prev.filter((lid) => lid !== id) : [...prev, id]
    );
  };

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch =
      searchQuery === "" ||
      log.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.engineerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = dateFilter === "" || log.date === dateFilter;
    const matchesEngineer =
      engineerFilter === "All Engineers" ||
      log.engineerName === engineerFilter;
    return matchesSearch && matchesDate && matchesEngineer;
  });

  return (
    <div className="timelog-container">
      {/* Header */}
      <div className="timelog-header">
        <h1 className="timelog-title">Time Log</h1>
        <p className="timelog-subtitle">View daily logs submitted by site engineers</p>
      </div>

      {/* Stats Cards */}
      <div className="timelog-stats">
        <div className="stat-card">
          <span className="stat-label">Total Logs</span>
          <span className="stat-value">{totalLogs}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Workers</span>
          <span className="stat-value">{totalWorkers}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Hours</span>
          <span className="stat-value">{totalHours}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Safety Accidents</span>
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
            placeholder="Search logs..."
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
            placeholder="mm/dd/yyyy"
          />
        </div>

        <div className="select-wrapper">
          <select
            className="engineer-select"
            value={engineerFilter}
            onChange={(e) => setEngineerFilter(e.target.value)}
          >
            <option value="All Engineers">All Engineers</option>
            <option value="Mike Johnson">Mike Johnson</option>
          </select>
          <svg className="select-arrow" viewBox="0 0 20 20" fill="none">
            <path d="M5 8l5 5 5-5" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Log Entries */}
      <div className="timelog-entries">
        {filteredLogs.map((log) => {
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
                <div className="log-row-left">
                  <span className={`log-chevron ${isExpanded ? "expanded" : ""}`}>
                    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                      <path
                        d={isExpanded ? "M5 8l5 5 5-5" : "M8 5l5 5-5 5"}
                        stroke="#555"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div className="log-meta">
                    <span className="log-project-name">{log.projectName}</span>
                    <span className="log-engineer">
                      {log.engineerName} • {log.date}
                    </span>
                  </div>
                </div>
                <div className="log-tags">
                  {log.tags.map((tag) => (
                    <span key={tag} className="log-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="log-detail">
                  {/* Manpower */}
                  <section className="detail-section">
                    <h3 className="section-title">Manpower</h3>
                    <div className="detail-grid">
                      <div className="detail-col">
                        <div className="detail-row">
                          <span className="detail-label">Work on Site:</span>
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
                      <div className="detail-col">
                        <div className="detail-row">
                          <span className="detail-label">Conditions:</span>
                          <span className="detail-value">{log.conditions.weather}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Temperature:</span>
                          <span className="detail-value">{log.conditions.temperature}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Work Completed Today */}
                  <section className="detail-section">
                    <h3 className="section-title">Work Completed Today</h3>
                    <div className="detail-box">{log.workCompleted}</div>
                  </section>

                  {/* Materials & Equipment */}
                  <div className="two-col-sections">
                    <section className="detail-section">
                      <h3 className="section-title">Materials Delivered</h3>
                      <div className="detail-box">{log.materialsDelivered}</div>
                    </section>
                    <section className="detail-section">
                      <h3 className="section-title">Equipment Used</h3>
                      <div className="detail-box">{log.equipmentUsed}</div>
                    </section>
                  </div>

                  {/* Additional Notes */}
                  <section className="detail-section">
                    <h3 className="section-title">Additional Notes</h3>
                    <div className="detail-box">{log.additionalNotes}</div>
                  </section>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimeLog;