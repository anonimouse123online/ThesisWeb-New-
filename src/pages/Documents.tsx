import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../components/Documents.css';
import UploadDocumentModal from '../pages/upload-document';
import DocxViewer from '../components/DocxViewer';
import * as XLSX from 'xlsx';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { downloadDocument, getDocumentBlob } from '../utils/documentStore';
import type { DocumentBlobResult } from '../utils/documentStore';
import { showToast } from '../components/Toast';
import Dropdown from '../components/Dropdown';
import ProfileDropdown from '../components/ProfileDropdown';
import {
  FolderClosed,
  FolderOpen,
  Compass,
  ClipboardList,
  Pin,
  Search,
  X,
  LayoutGrid,
  List,
  Trash2,
  Calendar,
  Download,
  ArrowLeft,
  Eye,
  ExternalLink,
  Table as TableIcon,
  AlertCircle,
  Loader2,
  Lightbulb
} from 'lucide-react';

const API_URL = API_BASE_URL;

interface Document {
  id: string;
  name: string;
  type: 'DWG' | 'PDF' | 'XLS' | 'DOC';
  uploaded_at: string;
  category: 'Design & Engineering' | 'Project Management' | 'Site Reference';
  file_path?: string;
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

  // ── Preview Modal State ──
  const [previewDoc, setPreviewDoc]         = useState<Document | null>(null);
  const [previewData, setPreviewData]       = useState<DocumentBlobResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError]     = useState<string | null>(null);
  const [sheetSearch, setSheetSearch]       = useState('');
  const [excelSheets, setExcelSheets]       = useState<{ [sheetName: string]: { headers: string[]; rows: string[][] } }>({});
  const [activeSheetName, setActiveSheetName] = useState<string>('');

  // ── Document format type checkers ──
  const isDocType = (doc: Document | null): boolean => {
    if (!doc) return false;
    const n = (doc.name || '').toLowerCase();
    return doc.type === 'DOC' || (doc as any).type === 'DOCX' || n.endsWith('.docx') || n.endsWith('.doc') || n.endsWith('.rtf');
  };

  const isXlsType = (doc: Document | null): boolean => {
    if (!doc) return false;
    const n = (doc.name || '').toLowerCase();
    return doc.type === 'XLS' || (doc as any).type === 'XLSX' || n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv');
  };

  const isDwgType = (doc: Document | null): boolean => {
    if (!doc) return false;
    const n = (doc.name || '').toLowerCase();
    return doc.type === 'DWG' || n.endsWith('.dwg') || n.endsWith('.dxf');
  };

  const isPdfType = (doc: Document | null): boolean => {
    if (!doc) return false;
    return !isDocType(doc) && !isXlsType(doc) && !isDwgType(doc);
  };

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
      if (previewDoc?.id === docId) {
        handleClosePreview();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // ── Real File Download ──
  const handleDownload = async (doc: Document) => {
    try {
      showToast(`Downloading "${doc.name}" (${doc.type})...`, 'info');
      const filename = await downloadDocument(doc, projectCode);
      showToast(`"${filename}" downloaded to your device!`, 'success');
    } catch (err: any) {
      console.error('Download error:', err);
      showToast('Failed to download document.', 'error');
    }
  };

  // ── Open Document Preview ──
  const handleOpenPreview = async (doc: Document) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewError(null);
    setSheetSearch('');
    setExcelSheets({});
    setActiveSheetName('');
    try {
      const result = await getDocumentBlob(doc, projectCode);
      setPreviewData(result);

      // Parse XLSX spreadsheet if applicable
      if (isXlsType(doc) && result.blob) {
        try {
          const ab = await result.blob.arrayBuffer();
          const wb = XLSX.read(ab, { type: 'array' });
          const sheets: { [name: string]: { headers: string[]; rows: string[][] } } = {};
          for (const sName of wb.SheetNames) {
            const raw: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sName], { header: 1, defval: '' });
            if (raw.length > 0) {
              const headers = (raw[0] || []).map((c: any) => String(c ?? ''));
              const rows = raw.slice(1).map((r: any[]) => r.map((c: any) => String(c ?? '')));
              sheets[sName] = { headers, rows };
            }
          }
          if (Object.keys(sheets).length > 0) {
            setExcelSheets(sheets);
            setActiveSheetName(wb.SheetNames[0]);
          }
        } catch (excelErr) {
          console.warn('[DOCS] XLSX parse error:', excelErr);
        }
      }
    } catch (err: any) {
      console.error('Preview error:', err);
      setPreviewError(err.message || 'Unable to load preview for this file.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Close Document Preview ──
  const handleClosePreview = () => {
    if (previewData?.url && !previewData.isServerUrl) {
      try {
        URL.revokeObjectURL(previewData.url);
      } catch { /* ignore */ }
    }
    setPreviewDoc(null);
    setPreviewData(null);
    setPreviewError(null);
    setExcelSheets({});
    setActiveSheetName('');
  };

  // Keyboard shortcut: close preview on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewDoc) {
        handleClosePreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewDoc, previewData]);

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

  // ── Parse Spreadsheet text into rows/columns for XLS preview ──
  const parsedSheetData = useMemo(() => {
    if (activeSheetName && excelSheets[activeSheetName]) {
      return excelSheets[activeSheetName];
    }
    if (!previewData?.textData || !isXlsType(previewDoc)) {
      return null;
    }
    const lines = previewData.textData.replace(/^\uFEFF/, '').trim().split('\n');
    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let inQuotes = false;
      let current = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rows = lines.map(parseRow);
    const headers = rows[0] || [];
    const bodyRows = rows.slice(1);
    return { headers, rows: bodyRows };
  }, [previewData, previewDoc, excelSheets, activeSheetName]);

  const filteredSheetRows = useMemo(() => {
    if (!parsedSheetData) return [];
    if (!sheetSearch.trim()) return parsedSheetData.rows;
    const q = sheetSearch.toLowerCase();
    return parsedSheetData.rows.filter(r => r.some(cell => cell.toLowerCase().includes(q)));
  }, [parsedSheetData, sheetSearch]);

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

      {/* ── In-Browser Document Preview Modal ── */}
      {previewDoc && (
        <div className="docs-preview-overlay" onClick={handleClosePreview}>
          <div
            className="docs-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${previewDoc.name}`}
          >
            {/* Modal Header */}
            <div className="docs-preview-header">
              <div className="docs-preview-header-left">
                <span className={`doc-type-badge ${TYPE_CLASSES[previewDoc.type] || 'type-pdf'}`}>
                  {previewDoc.name.toLowerCase().endsWith('.docx') ? 'DOCX' : previewDoc.name.toLowerCase().endsWith('.xlsx') ? 'XLSX' : previewDoc.type}
                </span>
                <div className="docs-preview-title-wrap">
                  <h3 className="docs-preview-title" title={previewDoc.name}>
                    {previewDoc.name}
                  </h3>
                  <div className="docs-preview-meta">
                    <span>{previewDoc.category}</span>
                    <span>•</span>
                    <span>{formatDate(previewDoc.uploaded_at)}</span>
                    {projectCode && (
                      <>
                        <span>•</span>
                        <span className="docs-preview-pcode">{projectCode}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="docs-preview-header-actions">
                {previewData?.url && (
                  <a
                    href={previewData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="docs-preview-action-btn"
                    title="Open in new browser tab"
                  >
                    <ExternalLink size={15} />
                    <span>Open in Tab</span>
                  </a>
                )}
                <button
                  className="docs-preview-action-btn docs-preview-action-btn--primary"
                  onClick={() => handleDownload(previewDoc)}
                  title="Download file to device"
                >
                  <Download size={15} />
                  <span>Download</span>
                </button>
                <button
                  className="docs-preview-close-btn"
                  onClick={handleClosePreview}
                  title="Close preview (Esc)"
                  aria-label="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="docs-preview-body">
              {previewLoading && (
                <div className="docs-preview-loading">
                  <Loader2 size={36} className="docs-preview-spinner" />
                  <p>Loading document preview...</p>
                </div>
              )}

              {previewError && (
                <div className="docs-preview-error">
                  <AlertCircle size={40} color="#dc2626" />
                  <h4>Unable to load preview</h4>
                  <p>{previewError}</p>
                  <button
                    className="docs-upload-btn"
                    style={{ marginTop: '12px' }}
                    onClick={() => handleDownload(previewDoc)}
                  >
                    <Download size={14} /> Download File Directly
                  </button>
                </div>
              )}

              {!previewLoading && !previewError && previewData && (
                <>
                  {/* 1. PDF Preview: Native browser PDF iframe */}
                  {isPdfType(previewDoc) && (
                    <div className="docs-preview-pdf-wrap">
                      <iframe
                        src={`${previewData.url}#toolbar=1&navpanes=0`}
                        title={previewDoc.name}
                        className="docs-preview-iframe"
                      />
                    </div>
                  )}

                  {/* 2. CAD / DWG Preview: Blueprint CAD viewer card */}
                  {isDwgType(previewDoc) && (
                    <div className="docs-preview-cad">
                      <div className="docs-cad-viewport">
                        <div className="docs-cad-grid-bg" />
                        <div className="docs-cad-watermark">
                          <Compass size={64} strokeWidth={1.2} />
                          <span>AUTOCAD DWG / CAD ARCHIVE</span>
                        </div>
                        <div className="docs-cad-blueprint-card">
                          <div className="docs-cad-card-header">
                            <div className="docs-cad-title-block">
                              <span className="docs-cad-sheet-tag">DRAWING SHEET</span>
                              <h4>{previewDoc.name}</h4>
                            </div>
                            <span className="docs-cad-stamp">APPROVED FOR CONSTRUCTION</span>
                          </div>

                          <div className="docs-cad-specs-grid">
                            <div className="docs-cad-spec-item">
                              <span className="spec-label">Format:</span>
                              <span className="spec-val">AutoCAD Drawing (DWG 2018–2025)</span>
                            </div>
                            <div className="docs-cad-spec-item">
                              <span className="spec-label">Scale:</span>
                              <span className="spec-val">1:100 / Metric (Millimeters)</span>
                            </div>
                            <div className="docs-cad-spec-item">
                              <span className="spec-label">Category:</span>
                              <span className="spec-val">{previewDoc.category}</span>
                            </div>
                            <div className="docs-cad-spec-item">
                              <span className="spec-label">Standard:</span>
                              <span className="spec-val">ISO 128 / ANSI ARCH D (24" × 36")</span>
                            </div>
                            <div className="docs-cad-spec-item">
                              <span className="spec-label">Coordinate System:</span>
                              <span className="spec-val">WGS84 / Philippine Transverse Mercator</span>
                            </div>
                            <div className="docs-cad-spec-item">
                              <span className="spec-label">Layers:</span>
                              <span className="spec-val">0-Defpoints, A-Wall-Ext, S-Rebar, M-HVAC, E-Power</span>
                            </div>
                          </div>

                          <div className="docs-cad-actions-footer">
                            <p className="docs-cad-tip" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Lightbulb size={15} style={{ color: '#F59E0B', flexShrink: 0 }} />
                              <span>To view and edit 3D layers, open this native file with AutoCAD, Autodesk DWG TrueView, or Revit.</span>
                            </p>
                            <button
                              className="docs-cad-dl-btn"
                              onClick={() => handleDownload(previewDoc)}
                            >
                              <Download size={14} /> Download Native DWG
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. XLS / CSV Preview: Interactive Spreadsheet Table */}
                  {isXlsType(previewDoc) && (
                    <div className="docs-preview-sheet">
                      <div className="docs-sheet-toolbar">
                        <div className="docs-sheet-info">
                          <TableIcon size={16} />
                          <span>Spreadsheet Data Viewer</span>
                          {parsedSheetData && (
                            <span className="docs-sheet-count">
                              {filteredSheetRows.length} of {parsedSheetData.rows.length} rows
                            </span>
                          )}
                        </div>
                        <div className="docs-sheet-search-wrap">
                          <Search size={14} />
                          <input
                            type="text"
                            placeholder="Filter table rows..."
                            value={sheetSearch}
                            onChange={(e) => setSheetSearch(e.target.value)}
                            className="docs-sheet-search-input"
                          />
                          {sheetSearch && (
                            <button onClick={() => setSheetSearch('')} className="docs-sheet-search-clear">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Multi-Sheet selector tabs if workbook has multiple sheets */}
                      {Object.keys(excelSheets).length > 1 && (
                        <div className="docs-sheet-tabs">
                          {Object.keys(excelSheets).map((sheetName) => (
                            <button
                              key={sheetName}
                              type="button"
                              className={`docs-sheet-tab-btn ${sheetName === activeSheetName ? 'active' : ''}`}
                              onClick={() => setActiveSheetName(sheetName)}
                            >
                              {sheetName}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="docs-sheet-table-wrap">
                        {parsedSheetData && parsedSheetData.headers.length > 0 ? (
                          <table className="docs-sheet-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                {parsedSheetData.headers.map((h, i) => (
                                  <th key={i}>{h.replace(/^"|"$/g, '')}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredSheetRows.map((row, rIdx) => (
                                <tr key={rIdx}>
                                  <td className="docs-sheet-row-num">{rIdx + 1}</td>
                                  {row.map((cell, cIdx) => (
                                    <td key={cIdx}>{cell.replace(/^"|"$/g, '')}</td>
                                  ))}
                                </tr>
                              ))}
                              {filteredSheetRows.length === 0 && (
                                <tr>
                                  <td colSpan={parsedSheetData.headers.length + 1} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                    No matching rows found in spreadsheet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        ) : (
                          <div className="docs-sheet-raw">
                            <pre>{previewData.textData || 'No tabular content available.'}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4. DOC / DOCX Preview: Native Word Document Viewer */}
                  {isDocType(previewDoc) && (
                    <DocxViewer
                      blob={previewData.blob}
                      filename={previewData.filename || previewDoc.name}
                      documentName={previewDoc.name}
                      category={previewDoc.category}
                      uploadedAt={previewDoc.uploaded_at}
                      projectCode={projectCode}
                      onDownload={() => handleDownload(previewDoc)}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation & Profile ── */}
      <div className="docs-nav-row">
        <button
          type="button"
          className="pd-back-btn"
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate(projectCode ? `/projects/${projectCode}` : '/projects');
            }
          }}
          title="Back to previous page"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#0f172a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          Back
        </button>

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
            <FolderClosed size={22} />
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-value">{totalCount}</span>
            <span className="docs-stat-label">Total Documents</span>
          </div>
        </div>

        <div className="docs-stat-card">
          <div className="docs-stat-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <Compass size={22} />
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-value">{countDesign}</span>
            <span className="docs-stat-label">Design & Engineering</span>
          </div>
        </div>

        <div className="docs-stat-card">
          <div className="docs-stat-icon-wrap" style={{ background: '#fff7ed', color: '#ea580c' }}>
            <ClipboardList size={22} />
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-value">{countPM}</span>
            <span className="docs-stat-label">Project Management</span>
          </div>
        </div>

        <div className="docs-stat-card">
          <div className="docs-stat-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <Pin size={22} />
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
            <span className="docs-search-icon"><Search size={16} /></span>
            <input
              className="docs-search-input"
              placeholder="Search by document title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="docs-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <X size={14} />
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
                aria-label="Grid View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                className={`docs-view-btn ${viewMode === 'table' ? 'docs-view-btn--active' : ''}`}
                title="List View"
                onClick={() => setViewMode('table')}
                aria-label="List View"
              >
                <List size={15} />
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
          <span className="docs-empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <FolderOpen size={44} style={{ color: '#94a3b8' }} />
          </span>
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
                <h2 className="docs-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{cat === 'Design & Engineering' ? <Compass size={18} /> : cat === 'Project Management' ? <ClipboardList size={18} /> : <Pin size={18} />}</span>
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
                            aria-label="Delete Document"
                            onClick={() => handleDelete(doc.id, doc.name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="doc-card-main" onClick={() => handleOpenPreview(doc)} style={{ cursor: 'pointer' }}>
                        <h4 className="doc-name" title={`Click to preview "${doc.name}"`}>{doc.name}</h4>
                        <div className="doc-meta">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} /> {formatDate(doc.uploaded_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="doc-card-footer">
                      <button
                        className="doc-preview-btn"
                        onClick={() => handleOpenPreview(doc)}
                        title="Preview document in browser"
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Eye size={13} /> Preview
                        </span>
                      </button>
                      <button
                        className="doc-download-btn"
                        onClick={() => handleDownload(doc)}
                        title="Download to device"
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Download size={13} /> Download
                        </span>
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
                      aria-label="Delete Document"
                      onClick={() => handleDelete(doc.id, doc.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="doc-card-main" onClick={() => handleOpenPreview(doc)} style={{ cursor: 'pointer' }}>
                  <h4 className="doc-name" title={`Click to preview "${doc.name}"`}>{doc.name}</h4>
                  <div className="doc-meta">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> {formatDate(doc.uploaded_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="doc-card-footer">
                <button
                  className="doc-preview-btn"
                  onClick={() => handleOpenPreview(doc)}
                  title="Preview document in browser"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Eye size={13} /> Preview
                  </span>
                </button>
                <button
                  className="doc-download-btn"
                  onClick={() => handleDownload(doc)}
                  title="Download to device"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Download size={13} /> Download
                  </span>
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
                <th style={{ textAlign: 'right', width: '220px' }}>Actions</th>
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
                    <div
                      className="docs-table-name"
                      onClick={() => handleOpenPreview(doc)}
                      style={{ cursor: 'pointer' }}
                      title="Click to preview"
                    >
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
                        className="docs-table-btn docs-table-btn--preview"
                        onClick={() => handleOpenPreview(doc)}
                        title="Preview document in browser"
                      >
                        <Eye size={12} style={{ marginRight: '4px' }} />
                        Preview
                      </button>
                      <button
                        className="docs-table-btn"
                        onClick={() => handleDownload(doc)}
                        title="Download file"
                      >
                        <Download size={12} style={{ marginRight: '4px' }} />
                        Download
                      </button>
                      <button
                        className="doc-delete-btn"
                        title="Delete Document"
                        aria-label="Delete Document"
                        onClick={() => handleDelete(doc.id, doc.name)}
                      >
                        <Trash2 size={14} />
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