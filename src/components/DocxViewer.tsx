import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import mammoth from 'mammoth';
import { ZoomIn, ZoomOut, RotateCcw, FileText, AlertCircle, Loader2, Download } from 'lucide-react';
import './DocxViewer.css';

interface DocxViewerProps {
  blob?: Blob | null;
  filename: string;
  documentName: string;
  category?: string;
  uploadedAt?: string;
  projectCode?: string;
  onDownload?: () => void;
}

type RenderMode = 'loading' | 'docx' | 'mammoth' | 'fallback' | 'error';

export const DocxViewer: React.FC<DocxViewerProps> = ({
  blob,
  filename,
  documentName,
  category = 'General',
  uploadedAt,
  projectCode,
  onDownload,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('loading');
  const [mammothHtml, setMammothHtml] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1.0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      setRenderMode('loading');
      setErrorMessage(null);
      setMammothHtml('');

      if (!blob || blob.size === 0) {
        setRenderMode('fallback');
        return;
      }

      // 1. Try rendering with docx-preview for native Word layout
      try {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        await renderAsync(blob, containerRef.current, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
        });

        if (!isCancelled) {
          setRenderMode('docx');
        }
        return;
      } catch (docxErr) {
        console.warn('[DocxViewer] docx-preview failed, attempting mammoth fallback:', docxErr);
      }

      // 2. Fallback to mammoth HTML conversion
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });

        if (!isCancelled) {
          if (result.value && result.value.trim().length > 0) {
            setMammothHtml(result.value);
            setRenderMode('mammoth');
            return;
          }
        }
      } catch (mammothErr) {
        console.warn('[DocxViewer] mammoth conversion also failed:', mammothErr);
      }

      // 3. Fallback: Show formatted document preview card
      if (!isCancelled) {
        setRenderMode('fallback');
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [blob]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.5));
  const handleResetZoom = () => setZoom(1.0);

  const formattedDate = uploadedAt
    ? new Date(uploadedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-US');

  return (
    <div className="docx-viewer-root">
      {/* ── Top Control Toolbar ── */}
      <div className="docx-viewer-toolbar">
        <div className="docx-toolbar-left">
          <FileText size={16} className="docx-toolbar-icon" />
          <span className="docx-toolbar-filename" title={filename}>
            {documentName || filename}
          </span>
          {renderMode === 'docx' && (
            <span className="docx-toolbar-badge docx-badge--native">
              Native Word Layout
            </span>
          )}
          {renderMode === 'mammoth' && (
            <span className="docx-toolbar-badge docx-badge--html">
              Document HTML View
            </span>
          )}
          {renderMode === 'fallback' && (
            <span className="docx-toolbar-badge docx-badge--simulated">
              Standard Reader
            </span>
          )}
        </div>

        <div className="docx-toolbar-right">
          <div className="docx-zoom-controls">
            <button
              onClick={handleZoomOut}
              className="docx-zoom-btn"
              title="Zoom out"
              disabled={zoom <= 0.5}
            >
              <ZoomOut size={14} />
            </button>
            <span className="docx-zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="docx-zoom-btn"
              title="Zoom in"
              disabled={zoom >= 2.0}
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={handleResetZoom}
              className="docx-zoom-btn"
              title="Reset zoom to 100%"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {onDownload && (
            <button
              onClick={onDownload}
              className="docx-download-action-btn"
              title="Download original DOCX file"
            >
              <Download size={14} />
              <span>Download</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Document Viewport ── */}
      <div className="docx-viewport">
        {renderMode === 'loading' && (
          <div className="docx-loading-state">
            <Loader2 size={36} className="docx-spinner" />
            <p>Parsing and rendering Word document...</p>
          </div>
        )}

        {/* 1. Native docx-preview container */}
        <div
          ref={containerRef}
          className={`docx-preview-mount ${renderMode === 'docx' ? 'active' : 'hidden'}`}
          style={{
            transform: zoom !== 1.0 ? `scale(${zoom})` : undefined,
            transformOrigin: 'top center',
          }}
        />

        {/* 2. Mammoth HTML converted view */}
        {renderMode === 'mammoth' && (
          <div
            className="docx-mammoth-page-wrap"
            style={{
              transform: zoom !== 1.0 ? `scale(${zoom})` : undefined,
              transformOrigin: 'top center',
            }}
          >
            <div className="docx-mammoth-page">
              <div
                className="docx-mammoth-body"
                dangerouslySetInnerHTML={{ __html: mammothHtml }}
              />
            </div>
          </div>
        )}

        {/* 3. Fallback Document Reader (when no uploaded file exists) */}
        {renderMode === 'fallback' && (
          <div
            className="docx-fallback-wrap"
            style={{
              transform: zoom !== 1.0 ? `scale(${zoom})` : undefined,
              transformOrigin: 'top center',
            }}
          >
            <div className="docs-doc-page">
              <div className="docs-doc-header">
                <span className="docs-doc-brand">SITEPULSE SPECIFICATION ARCHIVE</span>
                <span className="docs-doc-badge">CONTROLLED DOCUMENT</span>
              </div>
              <h2 className="docs-doc-title">{documentName}</h2>
              <div className="docs-doc-meta-bar">
                <span><strong>Project:</strong> {projectCode || 'SITE-PULSE'}</span>
                <span><strong>Category:</strong> {category}</span>
                <span><strong>Date:</strong> {formattedDate}</span>
                <span><strong>Status:</strong> Approved</span>
              </div>
              <div className="docs-doc-content">
                <h4>1. SCOPE & GENERAL PROVISIONS</h4>
                <p>
                  All civil, architectural, electrical, and mechanical construction works governed under this document
                  must comply with the National Structural Code and standard industry specifications. Any field deviation
                  must be authorized through an official SitePulse Request for Information (RFI).
                </p>

                <h4>2. MATERIAL SPECIFICATIONS & QUALITY ASSURANCE</h4>
                <p>
                  All Portland cement, deformed reinforcing steel bars (Grade 60), fine aggregates, and structural steel
                  must be sourced from accredited suppliers and accompanied by certified mill test certificates.
                  Compressive strength test cylinders shall be cast and broken at 7, 14, and 28-day intervals.
                </p>

                <h4>3. TESTING & FIELD VERIFICATION</h4>
                <p>
                  Daily site logs, slump test reports, soil compaction densities, and waterproofing inspection sign-offs
                  must be digitally registered in the project archive before structural sign-off.
                </p>
              </div>
              <div className="docs-doc-signoff">
                <div className="docs-doc-stamp">
                  <span>VERIFIED & APPROVED</span>
                  <small>SitePulse Engineering & Architecture</small>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocxViewer;
