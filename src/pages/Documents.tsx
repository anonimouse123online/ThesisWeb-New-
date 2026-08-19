import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../components/Documents.css';
import UploadDocumentModal from '../pages/upload-document';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { showToast } from '../components/Toast';
import Dropdown from '../components/Dropdown';
import ProfileDropdown from '../components/ProfileDropdown';

const API_URL = API_BASE_URL;

interface Document {
  id: string;
  name: string;
  type: 'DWG' | 'PDF' | 'XLS' | 'DOC';
  uploaded_at: string;
  category: 'Design & Engineering' | 'Project Management' | 'Site Reference';
}

const TYPE_CLASSES: Record<string, string> = {
  DWG: 'type-dwg',
  PDF: 'type-pdf',
  XLS: 'type-xls',
  DOC: 'type-doc',
};

const CATEGORIES = ['Design & Engineering', 'Project Management', 'Site Reference'] as const;
type Category = typeof CATEGORIES[number];

const Documents: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();

  const [documents, setDocuments]       = useState<Document[]>([]);
  const [projectName, setProjectName]   = useState<string>('');
  const [search, setSearch]             = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | Category>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedSort, setSelectedSort] = useState<string>('newest');
  const [viewMode, setViewMode]         = useState<'grid' | 'table'>('grid');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [showUpload, setShowUpload]     = useState(false);

  // Fetch project details for header breadcrumb
  useEffect(() => {
    if (!projectCode) return;
    const fetchProject = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}`);
        if (res.ok) {
          const json = await res.json();
          setProjectName(json.data?.name || '');
        }
      } catch { /* ignore */ }
    };
    fetchProject();
  }, [projectCode]);

  // ── Fetch documents ──
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/documents`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to load documents');
      setDocuments(data.data ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [projectCode]);

  // ── Delete document ──
  const handleDelete = async (docId: string, docName: string) => {
    if (!confirm(`Delete "${docName}"? This action cannot be undone.`)) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/documents/${docId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete');
      setDocuments(prev => prev.filter(d => d.id !== docId));
      showToast(`"${docName}" deleted successfully.`, 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // ── Simulate Download ──
  const handleDownload = (doc: Document) => {
    showToast(`Downloading "${doc.name}" (${doc.type})...`, 'success');
  };

  // ── Statistics calculation ──
  const totalCount = documents.length;
  const countDesign = documents.filter(d => d.category === 'Design & Engineering').length;
  const countPM     = documents.filter(d => d.category === 'Project Management').length;
  const countSite   = documents.filter(d => d.category === 'Site Reference').length;

  // ── Filter and Sort ──
  const filtered = documents
    .filter((doc) => {
      const matchesSearch   = doc.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'All' || doc.category === activeCategory;
      const matchesType     = selectedType === 'All' || doc.type === selectedType;
      return matchesSearch && matchesCategory && matchesType;
    })
    .sort((a, b) => {
      if (selectedSort === 'newest') return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      if (selectedSort === 'oldest') return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
      if (selectedSort === 'name')   return a.name.localeCompare(b.name);
      return 0;
    });

  const grouped = CATEGORIES.reduce<Record<string, Document[]>>((acc, cat) => {
    acc[cat] = filtered.filter(d => d.category === cat);
    return acc;
  }, {} as Record<string, Document[]>);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const typeOptions = [
    { value: 'All', label: 'All Formats' },
    { value: 'PDF', label: 'PDF Documents' },
    { value: 'DWG', label: 'CAD / DWG' },
    { value: 'XLS', label: 'Spreadsheets (XLS)' },
    { value: 'DOC', label: 'Word Docs (DOC)' },
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'name',   label: 'Name (A-Z)' },
  ];

  return (
    <div className="docs-page">

      {/* ── Upload Modal ── */}
      {showUpload && (
        <UploadDocumentModal
          projectCode={projectCode!}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { fetchDocuments(); setShowUpload(false); }}
        />
      )}

      {/* ── Breadcrumb & Navigation ── */}
      <div className="docs-nav-row">
        <div className="docs-breadcrumb">
          <button className="docs-breadcrumb-link" onClick={() => navigate('/projects')}>
            Projects
          </button>
          <span className="docs-breadcrumb-sep">/</span>
          <button className="docs-breadcrumb-link" onClick={() => navigate(`/projects/${projectCode}`)}>
            {projectCode}
          </button>
          <span className="docs-breadcrumb-sep">/</span>
          <span className="docs-breadcrumb-current">Documents</span>
        </div>

        <ProfileDropdown />
      </div>

      {/* ── Header ── */}
      <div className="docs-header">
        <div className="docs-header-left">
          <div className="docs-title-wrap">
            <h1 className="docs-title">Project Documents</h1>
            <span className="docs-count-badge">{totalCount} files</span>
          </div>
          <p className="docs-subtitle">
            {projectName ? `${projectName} (${projectCode})` : projectCode} • Central blueprint and document repository
          </p>
        </div>

        <div className="docs-header-right">
          <button className="docs-upload-btn" onClick={() => setShowUpload(true)}>
            <span>+ Upload Documents</span>
          </button>
        </div>
      </div>

      {/* ── Stat Summary Cards ── */}
      <div className="docs-stats-grid">
        <div className="docs-stat-card">
          <div className="docs-stat-icon-wrap" style={{ background: '#fff0e8', color: '#f05a28' }}>
            📁
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-value">{totalCount}</span>
            <span className="docs-stat-label">Total Documents</span>
          </div>
        </div>

        <div className="docs-stat-card">
          <div className="docs-stat-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
            📐
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-value">{countDesign}</span>
            <span className="docs-stat-label">Design & Engineering</span>
          </div>
        </div>

        <div className="docs-stat-card">
          <div className="docs-stat-icon-wrap" style={{ background: '#fff7ed', color: '#ea580c' }}>
            📋
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-value">{countPM}</span>
            <span className="docs-stat-label">Project Management</span>
          </div>
        </div>

        <div className="docs-stat-card">
          <div className="docs-stat-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
            📌
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-value">{countSite}</span>
            <span className="docs-stat-label">Site Reference</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="docs-toolbar">
        <div className="docs-toolbar-top">
          {/* Search bar */}
          <div className="docs-search-wrap">
            <span className="docs-search-icon">🔍</span>
            <input
              className="docs-search-input"
              placeholder="Search by document title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="docs-search-clear" onClick={() => setSearch('')}>
                ✕
              </button>
            )}
          </div>

          {/* Action Filters & View Switcher */}
          <div className="docs-toolbar-actions">
            <Dropdown
              options={typeOptions}
              value={selectedType}
              onChange={setSelectedType}
              prefix="Type"
            />
            <Dropdown
              options={sortOptions}
              value={selectedSort}
              onChange={setSelectedSort}
              prefix="Sort"
            />
            <div className="docs-view-toggle">
              <button
                type="button"
                className={`docs-view-btn ${viewMode === 'grid' ? 'docs-view-btn--active' : ''}`}
                title="Grid View"
                onClick={() => setViewMode('grid')}
              >
                ⊞
              </button>
              <button
                type="button"
                className={`docs-view-btn ${viewMode === 'table' ? 'docs-view-btn--active' : ''}`}
                title="List View"
                onClick={() => setViewMode('table')}
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="docs-filters">
          <button
            className={`docs-filter-pill ${activeCategory === 'All' ? 'docs-filter-pill--active' : ''}`}
            onClick={() => setActiveCategory('All')}
          >
            <span>All Categories</span>
            <span className="docs-pill-count">{totalCount}</span>
          </button>
          {CATEGORIES.map((cat) => {
            const count = cat === 'Design & Engineering' ? countDesign : cat === 'Project Management' ? countPM : countSite;
            return (
              <button
                key={cat}
                className={`docs-filter-pill ${activeCategory === cat ? 'docs-filter-pill--active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                <span>{cat}</span>
                <span className="docs-pill-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content States ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontSize: '14px' }}>
          Loading document repository…
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#dc2626', background: '#fef2f2', borderRadius: '12px' }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="docs-empty-card">
          <span className="docs-empty-icon">📁</span>
          <h3 className="docs-empty-title">No documents found</h3>
          <p className="docs-empty-sub">
            {search || selectedType !== 'All' || activeCategory !== 'All'
              ? 'Try adjusting your search or category filters.'
              : 'Start by uploading drawings, blueprints, specifications, or schedules.'}
          </p>
          <button className="docs-upload-btn" style={{ marginTop: '8px' }} onClick={() => setShowUpload(true)}>
            + Upload Document
          </button>
        </div>
      )}

      {/* ── Grid View ── */}
      {!loading && !error && viewMode === 'grid' && activeCategory === 'All' && (
        CATEGORIES.map((cat) => {
          const catDocs = grouped[cat];
          if (!catDocs || catDocs.length === 0) return null;
          return (
            <section key={cat} className="docs-section">
              <div className="docs-section-header">
                <h2 className="docs-section-title">
                  <span>{cat === 'Design & Engineering' ? '📐' : cat === 'Project Management' ? '📋' : '📌'}</span>
                  <span>{cat}</span>
                </h2>
                <span className="docs-section-count">{catDocs.length} item(s)</span>
              </div>

              <div className="docs-grid">
                {catDocs.map((doc) => (
                  <div key={doc.id} className="doc-card">
                    <div>
                      <div className="doc-card-top">
                        <span className={`doc-type-badge ${TYPE_CLASSES[doc.type] || 'type-pdf'}`}>
                          {doc.type}
                        </span>
                        <div className="doc-card-actions">
                          <button
                            className="doc-delete-btn"
                            title="Delete Document"
                            onClick={() => handleDelete(doc.id, doc.name)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>

                      <div className="doc-card-main">
                        <h4 className="doc-name" title={doc.name}>{doc.name}</h4>
                        <div className="doc-meta">
                          <span>📅 {formatDate(doc.uploaded_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="doc-card-footer">
                      <button
                        className="doc-download-btn"
                        onClick={() => handleDownload(doc)}
                      >
                        <span>⬇ Download</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      {/* Grid View when single category is active */}
      {!loading && !error && viewMode === 'grid' && activeCategory !== 'All' && filtered.length > 0 && (
        <div className="docs-grid">
          {filtered.map((doc) => (
            <div key={doc.id} className="doc-card">
              <div>
                <div className="doc-card-top">
                  <span className={`doc-type-badge ${TYPE_CLASSES[doc.type] || 'type-pdf'}`}>
                    {doc.type}
                  </span>
                  <div className="doc-card-actions">
                    <button
                      className="doc-delete-btn"
                      title="Delete Document"
                      onClick={() => handleDelete(doc.id, doc.name)}
                    >
                      🗑
                    </button>
                  </div>
                </div>

                <div className="doc-card-main">
                  <h4 className="doc-name" title={doc.name}>{doc.name}</h4>
                  <div className="doc-meta">
                    <span>📅 {formatDate(doc.uploaded_at)}</span>
                  </div>
                </div>
              </div>

              <div className="doc-card-footer">
                <button
                  className="doc-download-btn"
                  onClick={() => handleDownload(doc)}
                >
                  <span>⬇ Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table / List View ── */}
      {!loading && !error && viewMode === 'table' && filtered.length > 0 && (
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Type</th>
                <th>Document Name</th>
                <th>Category</th>
                <th>Uploaded Date</th>
                <th style={{ textAlign: 'right', width: '180px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className={`doc-type-badge ${TYPE_CLASSES[doc.type] || 'type-pdf'}`}>
                      {doc.type}
                    </span>
                  </td>
                  <td>
                    <div className="docs-table-name">
                      <span>{doc.name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                      {doc.category}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {formatDate(doc.uploaded_at)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="docs-table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        className="docs-table-btn"
                        onClick={() => handleDownload(doc)}
                      >
                        Download
                      </button>
                      <button
                        className="doc-delete-btn"
                        title="Delete Document"
                        onClick={() => handleDelete(doc.id, doc.name)}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

export default Documents;