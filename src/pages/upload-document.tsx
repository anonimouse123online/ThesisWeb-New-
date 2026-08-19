import React, { useState, useRef } from 'react';
import '../components/upload-document.css';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';

const API_URL = API_BASE_URL;

const CATEGORIES = ['Design & Engineering', 'Project Management', 'Site Reference'] as const;
const DOC_TYPES  = ['PDF', 'DWG', 'DOC', 'DOCX', 'XLS', 'XLSX', 'JPG', 'PNG'] as const;

type Category = typeof CATEGORIES[number];
type DocType  = typeof DOC_TYPES[number];

interface AttachedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
}

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
  const [category, setCategory] = useState<Category | ''>('Design & Engineering');
  const [docType,  setDocType]  = useState<DocType | ''>('PDF');
  const [version,  setVersion]  = useState('');
  const [files,    setFiles]    = useState<AttachedFileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect Document Type from file extension
  const detectDocType = (fileName: string): DocType => {
    const ext = fileName.split('.').pop()?.toUpperCase() as DocType;
    if (DOC_TYPES.includes(ext as any)) return ext;
    return 'PDF';
  };

  // ── Handle multiple files ──
  const handleAddFiles = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList);
    if (!newFiles.length) return;

    setError(null);
    const oversized = newFiles.filter(f => f.size > 50 * 1024 * 1024);
    if (oversized.length > 0) {
      setError(`Some file(s) exceed the 50MB limit: ${oversized.map(f => f.name).join(', ')}`);
      return;
    }

    const items: AttachedFileItem[] = newFiles.map(f => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${f.name}`,
      file: f,
      name: f.name,
      size: f.size,
      type: detectDocType(f.name),
    }));

    setFiles(prev => {
      const updated = [...prev, ...items];
      // If single file and name is empty, auto-fill document name
      if (updated.length === 1 && !name) {
        setName(updated[0].file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
        setDocType(detectDocType(updated[0].file.name));
      }
      return updated;
    });

    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const normalizeType = (t: string): 'DWG' | 'PDF' | 'XLS' | 'DOC' => {
    const upper = t.toUpperCase();
    if (upper === 'DOCX') return 'DOC';
    if (upper === 'XLSX') return 'XLS';
    if (['JPG', 'PNG', 'JPEG'].includes(upper)) return 'PDF';
    if (['DWG', 'PDF', 'XLS', 'DOC'].includes(upper)) return upper as any;
    return 'PDF';
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!category) {
      setError('Please select a category.');
      return;
    }

    if (files.length === 0) {
      setError('Please attach at least one file.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      let documentsPayload = [];

      if (files.length === 1) {
        // Single file upload
        const docName = name.trim() || files[0].name.replace(/\.[^/.]+$/, '');
        const selectedType = docType ? normalizeType(docType) : normalizeType(files[0].type);

        documentsPayload.push({
          name: docName,
          type: selectedType,
          category,
          version: version || null,
        });
      } else {
        // Multiple files attached
        documentsPayload = files.map((f, index) => {
          const docName = files.length === 1 && name.trim()
            ? name.trim()
            : name.trim()
            ? `${name.trim()} - Part ${index + 1} (${f.name.replace(/\.[^/.]+$/, '')})`
            : f.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

          return {
            name: docName,
            type: normalizeType(f.type || docType || 'PDF'),
            category,
            version: version || null,
          };
        });
      }

      const primary = documentsPayload[0];
      const res = await fetchWithAuth(`${API_URL}/projects/${projectCode}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: primary.name,
          type: primary.type,
          category: primary.category,
          version: primary.version,
          documents: documentsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to upload document(s)');

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
          <p className="ud-subtitle">Fill in all required fields and attach your files.</p>
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

          {/* ── Attach File (supports multiple files) ── */}
          <div className="ud-field">
            <label className="ud-label">
              <span>Attach File <span className="ud-required">*</span></span>
              {files.length > 0 && (
                <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                  {files.length} file{files.length > 1 ? 's' : ''} selected
                </span>
              )}
            </label>

            {/* Dropzone */}
            <div
              className={`ud-dropzone ${dragging ? 'ud-dropzone--dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <span className="ud-drop-icon">⬆</span>
              <p className="ud-drop-text">
                {files.length > 0 ? 'Drag & drop more files here' : 'Drag & drop your files here'}
              </p>
              <p className="ud-drop-sub">
                or <span className="ud-drop-link">browse to upload (multiple files allowed)</span>
              </p>
              <p className="ud-drop-hint">
                Supported: PDF, DWG, DOC, DOCX, XLS, XLSX, JPG, PNG • Max 50MB per file
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="ud-file-input"
                accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files) handleAddFiles(e.target.files);
                }}
              />
            </div>

            {/* List of Attached Files */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {files.map((item) => (
                  <div key={item.id} className="ud-file-preview">
                    <span className="ud-file-badge">{item.type}</span>
                    <div className="ud-file-info">
                      <span className="ud-file-name">{item.name}</span>
                      <span className="ud-file-size">{formatSize(item.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="ud-file-remove"
                      onClick={() => removeFile(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="ud-error">{error}</p>}
        </div>

        {/* ── Footer ── */}
        <div className="ud-footer">
          <button type="button" className="ud-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ud-btn-submit"
            onClick={handleSubmit}
            disabled={uploading || files.length === 0}
          >
            {uploading
              ? 'Uploading…'
              : files.length > 1
              ? `Upload ${files.length} Files`
              : 'Upload File'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default UploadDocumentModal;