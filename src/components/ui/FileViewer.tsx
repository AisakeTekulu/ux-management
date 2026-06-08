"use client";

/**
 * FileViewer — in-platform document viewer.
 *
 * Displays files inline based on type:
 * - PDFs: embedded iframe viewer
 * - Images: rendered inline with zoom
 * - Other files: download prompt with file info
 */

import { useCallback, useEffect, useState } from "react";

export interface FileViewerProps {
  /** The API endpoint to fetch the signed URL from. */
  fileUrl: string;
  /** The file name for display. */
  fileName: string;
  /** Whether the viewer modal is open. */
  open: boolean;
  /** Called when the viewer should close. */
  onClose: () => void;
}

function getFileType(fileName: string): "pdf" | "image" | "other" {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  return "other";
}

function getFileIcon(fileName: string) {
  const type = getFileType(fileName);
  if (type === "pdf") return "📄";
  if (type === "image") return "🖼️";
  return "📎";
}

export function FileViewer({ fileUrl, fileName, open, onClose }: FileViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSignedUrl = useCallback(async () => {
    if (!open || !fileUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) {
        setError("Could not load file.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSignedUrl(data.url);
    } catch {
      setError("Failed to load file.");
    } finally {
      setLoading(false);
    }
  }, [open, fileUrl]);

  useEffect(() => {
    if (open) fetchSignedUrl();
    else { setSignedUrl(null); setError(null); }
  }, [open, fetchSignedUrl]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const fileType = getFileType(fileName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={`Viewing ${fileName}`}>
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close viewer"
      />

      {/* Viewer panel */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-surface shadow-overlay overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-token-4 py-token-3 shrink-0">
          <div className="flex items-center gap-token-2 min-w-0">
            <span className="text-lg">{getFileIcon(fileName)}</span>
            <span className="text-sm font-medium text-text truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-token-2 shrink-0">
            {signedUrl && (
              <a
                href={signedUrl}
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-surface-subdued px-token-3 py-token-1 text-xs font-medium text-text hover:bg-surface-hovered transition-colors"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-subdued hover:bg-surface-hovered hover:text-text transition-colors"
              aria-label="Close"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-surface-subdued">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-token-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
                <p className="text-sm text-text-subdued">Loading document…</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <p className="text-sm text-status-red">{error}</p>
                <button
                  type="button"
                  onClick={fetchSignedUrl}
                  className="mt-token-2 text-xs font-medium text-primary hover:text-primary-hovered"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {signedUrl && !loading && !error && (
            <>
              {fileType === "pdf" && (
                <iframe
                  src={`${signedUrl}#toolbar=1&navpanes=0`}
                  title={fileName}
                  className="h-[75vh] w-full border-0"
                />
              )}

              {fileType === "image" && (
                <div className="flex items-center justify-center p-token-4">
                  <img
                    src={signedUrl}
                    alt={fileName}
                    className="max-h-[75vh] max-w-full rounded-md object-contain shadow-card"
                  />
                </div>
              )}

              {fileType === "other" && (
                <div className="flex flex-col items-center justify-center py-16 gap-token-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface text-3xl shadow-card">
                    {getFileIcon(fileName)}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text">{fileName}</p>
                    <p className="mt-token-1 text-xs text-text-subdued">
                      This file type can&apos;t be previewed in the browser.
                    </p>
                  </div>
                  <a
                    href={signedUrl}
                    download={fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-token-2 rounded-lg bg-primary px-token-4 py-[10px] text-sm font-semibold text-text-on-primary hover:bg-primary-hovered transition-all"
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download File
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
