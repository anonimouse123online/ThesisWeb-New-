import React, { useState, useRef } from 'react';
import '../components/upload-document.css';

const API_URL = import.meta.env.VITE_BACKEND_URL;

const CATEGORIES = ['Design & Engineering', 'Project Management', 'Site Reference'] as const;
const DOC_TYPES  = ['PDF', 'DWG', 'DOC', 'DOCX', 'XLS', 'XLSX', 'JPG', 'PNG'] as const;

type Category = typeof CATEGORIES[number];
type DocType  = typeof DOC_TYPES[number];

interface UploadDocumentModalProps {
  projectCode: string;
  onClose:  () => void;
  onUploaded: () => void;
}

const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  projectCode,
  onClose,
  onUploaded,
}) => {
  const [name,     setName]     = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [docType,  setDocType]  = useState<DocType | ''>('');
  const [version,  setVersion]  = useState('');
  const [file,     setFile]     = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──
  const handleFile = (f: File) => {
    if (f.size > 50 * 1024 * 1024) {
      setError('File exceeds 50MB limit.');
      return;
    }
    setFile(f);
    setError(null);
    // Auto-detect type from extension
    const ext = f.name.split('.').pop()?.toUpperCase() as DocType;
    if (DOC_TYPES.includes(ext as any)) setDocType(ext);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const removeFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!name || !category || !docType) {
      setError('Please fill in all required fields.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Normalize type: DOCX→DOC, XLSX→XLS
      const normalizedType = docType === 'DOCX' ? 'DOC'
                           : docType === 'XLSX' ? 'XLS'
                           : docType;

      const res = await fetch(`${API_URL}/projects/${projectCode}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type:     normalizedType,
          category,
          version:  version || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to upload document');

      onUploaded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="ud-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ud-modal" role="dialog" aria-modal="true" aria-labelledby="ud-title">

        {/* ── Header ── */}
        <div className="ud-header">
          <h2 className="ud-title" id="ud-title">Upload File</h2>
          <p className="ud-subtitle">Fill in all required fields.</p>
        </div>

        {/* ── Body ── */}
        <div className="ud-body">

          {/* Document Name */}
          <div className="ud-field">
            <label className="ud-label">Document Name <span className="ud-required">*</span></label>
            <input
              className="ud-input"
              placeholder="e.g. Structural Drawings Rev3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="ud-field">
            <label className="ud-label">Category <span className="ud-required">*</span></label>
            <div className="ud-select-wrap">
              <select
                className="ud-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                <option value="" disabled>Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Document Type */}
          <div className="ud-field">
            <label className="ud-label">Document Type <span className="ud-required">*</span></label>
            <div className="ud-select-wrap">
              <select
                className="ud-select"
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
              >
                <option value="" disabled>Select document type</option>
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Version */}
          <div className="ud-field">
            <label className="ud-label">Version / Revision</label>
            <input
              className="ud-input"
              placeholder="e.g. Rev 1, v2.0 (optional)"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>

          {/* File drop zone */}
          <div className="ud-field">
            <label className="ud-label">Attach File <span className="ud-required">*</span></label>
            {!file ? (
              <div
                className={`ud-dropzone ${dragging ? 'ud-dropzone--dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <span className="ud-drop-icon">⬆</span>
                <p className="ud-drop-text">Drag & drop your file here</p>
                <p className="ud-drop-sub">
                  or <span className="ud-drop-link">browse to upload</span>
                </p>
                <p className="ud-drop-hint">
                  Supported: PDF, DWG, DOC, DOCX, XLS, XLSX, JPG, PNG • Max 50MB
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  className="ud-file-input"
                  accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            ) : (
              <div className="ud-file-preview">
                <span className="ud-file-badge">{file.name.split('.').pop()?.toUpperCase()}</span>
                <div className="ud-file-info">
                  <span className="ud-file-name">{file.name}</span>
                  <span className="ud-file-size">{formatSize(file.size)}</span>
                </div>
                <button className="ud-file-remove" onClick={removeFile}>Remove</button>
              </div>
            )}
          </div>

          {error && <p className="ud-error">{error}</p>}
        </div>

        {/* ── Footer ── */}
        <div className="ud-footer">
          <button className="ud-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="ud-btn-submit"
            onClick={handleSubmit}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Create Task'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default UploadDocumentModal;