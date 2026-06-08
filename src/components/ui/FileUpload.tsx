"use client";

/**
 * FileUpload — drag-and-drop or click-to-upload component for design files.
 * Uploads to /api/phases/[phaseId]/files and creates a design_link record.
 */

import { useCallback, useRef, useState } from "react";

export interface FileUploadProps {
  /** The phase ID to upload files to. */
  phaseId: string;
  /** Called after a successful upload with the created design link. */
  onUploadComplete?: () => void;
  /** Accepted file types. */
  accept?: string;
  /** Maximum file size in bytes (default 50MB). */
  maxSize?: number;
}

export function FileUpload({
  phaseId,
  onUploadComplete,
  accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.svg",
  maxSize = 50 * 1024 * 1024,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > maxSize) {
        setError(`File exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit.`);
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/phases/${phaseId}/files`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || `Upload failed (${res.status})`);
          return;
        }

        onUploadComplete?.();
      } catch (err) {
        setError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [phaseId, maxSize, onUploadComplete]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  return (
    <div className="mt-token-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-token-4 py-token-6 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-surface-subdued"
        }`}
      >
        <UploadIcon />
        <p className="mt-token-2 text-sm font-medium text-text">
          {uploading ? "Uploading..." : "Drop a file here or click to upload"}
        </p>
        <p className="mt-token-1 text-xs text-text-subdued">
          PDF, Word, images up to 50MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />

      {error && (
        <p className="mt-token-2 text-xs text-status-red">{error}</p>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-text-subdued">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
