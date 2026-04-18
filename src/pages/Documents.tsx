import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import '../components/Documents.css';
import UploadDocumentModal from '../pages/upload-document';

const API_URL = import.meta.env.VITE_BACKEND_URL;

interface Document {
  id: string;
  name: string;
  type: 'DWG' | 'PDF' | 'XLS' | 'DOC';
  uploaded_at: string;
  category: 'Design & Engineering' | 'Project Management' | 'Site Reference';
}

const TYPE_COLORS: Record<string, string> = {
  DWG: 'type-dwg',
  PDF: 'type-pdf',
  XLS: 'type-xls',
  DOC: 'type-doc',
};

const CATEGORIES = ['Design & Engineering', 'Project Management', 'Site Reference'] as const;
type Category = typeof CATEGORIES[number];

const Documents: React.FC = () => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const [documents, setDocuments]       = useState<Document[]>([]);
  const [search, setSearch]             = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | Category>('All');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [showUpload, setShowUpload]     = useState(false);

  // ── Fetch documents ──
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_URL}/projects/${projectCode}/documents`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load documents');
      setDocuments(data.data ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, [projectCode]);

  // ── Delete ──
  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      const res = await fetch(`${API_URL}/projects/${projectCode}/documents/${docId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete');
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ── Filter & group ──
  const filtered = documents.filter((doc) => {
    const matchesSearch   = doc.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeFilter === 'All' || doc.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  const grouped = CATEGORIES.reduce<Record<string, Document[]>>((acc, cat) => {
    acc[cat] = filtered.filter((d) => d.category === cat);
    return acc;
  }, {} as Record<string, Document[]>);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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

      {/* ── Back nav ── */}
      <button className="docs-back" onClick={() => window.history.back()}>
        <span className="docs-back-arrow">←</span> Back to Project Overview
      </button>

      {/* ── Header ── */}
      <div className="docs-header">
        <div>
          <h1 className="docs-title">Documents</h1>
          <p className="docs-subtitle">{projectCode}</p>
        </div>
        <button className="docs-upload-btn" onClick={() => setShowUpload(true)}>
          + Upload
        </button>
      </div>

      {/* ── Search ── */}
      <div className="docs-search-wrap">
        <span className="docs-search-icon">🔍</span>
        <input
          className="docs-search"
          placeholder="Search Documents"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── Filter tabs ── */}
      <div className="docs-filters">
        {(['All', ...CATEGORIES] as const).map((f) => (
          <button
            key={f}
            className={`docs-filter-btn ${activeFilter === f ? 'docs-filter-btn--active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── States ── */}
      {loading && <p className="docs-state">Loading documents…</p>}
      {error   && <p className="docs-state docs-state--error">{error}</p>}

      {/* ── Grouped sections ── */}
      {!loading && !error && CATEGORIES.map((cat) => {
        const docs = grouped[cat];
        if (!docs || docs.length === 0) return null;
        return (
          <section key={cat} className="docs-section">
            <h2 className="docs-section-title">{cat.toUpperCase()}</h2>
            <div className="docs-grid">
              {docs.map((doc) => (
                <div key={doc.id} className="doc-card">
                  <div className="doc-card-top">
                    <span className={`doc-type-badge ${TYPE_COLORS[doc.type]}`}>
                      {doc.type}
                    </span>
                    <button
                      className="doc-delete-btn"
                      title="Delete"
                      onClick={() => handleDelete(doc.id)}
                    >
                      🗑
                    </button>
                  </div>
                  <p className="doc-name">{doc.name}</p>
                  <p className="doc-date">Uploaded {formatDate(doc.uploaded_at)}</p>
                  <button className="doc-download-btn">Download</button>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {!loading && !error && filtered.length === 0 && (
        <p className="docs-state">No documents found.</p>
      )}
    </div>
  );
};

export default Documents;