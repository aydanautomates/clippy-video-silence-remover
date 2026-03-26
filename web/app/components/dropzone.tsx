"use client";

import { useCallback, useState } from "react";

interface DropzoneProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function Dropzone({ file, onFileSelect, disabled }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const dropped = e.dataTransfer.files[0];
      if (dropped?.type.startsWith("video/")) {
        onFileSelect(dropped);
      }
    },
    [onFileSelect, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) onFileSelect(selected);
    },
    [onFileSelect]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center gap-3
        rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${isDragging
          ? "border-violet-400 bg-violet-500/10"
          : file
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"
        }
      `}
    >
      <input
        type="file"
        accept="video/*"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />

      {file ? (
        <>
          <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-neutral-200">{file.name}</p>
          <p className="text-xs text-neutral-500">{formatSize(file.size)}</p>
        </>
      ) : (
        <>
          <svg className="w-10 h-10 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-neutral-400">
            <span className="font-medium text-violet-400">Click to upload</span> or drag & drop
          </p>
          <p className="text-xs text-neutral-600">MP4, MOV, AVI, MKV</p>
        </>
      )}
    </label>
  );
}
