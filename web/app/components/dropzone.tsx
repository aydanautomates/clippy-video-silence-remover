"use client";

import { useCallback, useState, useRef } from "react";

interface DropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export default function Dropzone({ files, onFilesChange, disabled }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const videoFiles = Array.from(newFiles).filter((f) => f.type.startsWith("video/"));
      if (videoFiles.length > 0) {
        onFilesChange([...files, ...videoFiles]);
      }
    },
    [files, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (disabled) return;
      addFiles(e.dataTransfer.files);
    },
    [addFiles, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles]
  );

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange]
  );

  const handleReorderDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleReorderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setOverIndex(index);
  };

  const handleReorderDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const reordered = [...files];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    onFilesChange(reordered);
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleReorderDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          dragCounter.current++;
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragCounter.current--;
          if (dragCounter.current <= 0) {
            setIsDragging(false);
            dragCounter.current = 0;
          }
        }}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${isDragging
            ? "border-violet-400 bg-violet-500/10"
            : files.length > 0
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"
          }
        `}
      >
        <input
          type="file"
          accept="video/*"
          multiple
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
        />

        {files.length > 0 ? (
          <>
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-neutral-200">
              {files.length} video{files.length !== 1 ? "s" : ""} selected
            </p>
            <p className="text-xs text-neutral-500">Click or drop to add more</p>
          </>
        ) : (
          <>
            <svg className="w-10 h-10 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-neutral-400">
              <span className="font-medium text-violet-400">Click to upload</span> or drag & drop
            </p>
            <p className="text-xs text-neutral-600">MP4, MOV, AVI, MKV — select one or multiple</p>
          </>
        )}
      </label>

      {/* File list with drag-to-reorder */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.length > 1 && (
            <p className="text-xs text-neutral-500 px-1">Drag to reorder — videos will merge in this order</p>
          )}
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              draggable={!disabled && files.length > 1}
              onDragStart={() => handleReorderDragStart(index)}
              onDragOver={(e) => handleReorderDragOver(e, index)}
              onDrop={(e) => handleReorderDrop(e, index)}
              onDragEnd={handleReorderDragEnd}
              className={`
                flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all
                ${dragIndex === index ? "opacity-40" : ""}
                ${overIndex === index && dragIndex !== index
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-neutral-800 bg-neutral-900"
                }
                ${!disabled && files.length > 1 ? "cursor-grab active:cursor-grabbing" : ""}
              `}
            >
              {/* Drag handle */}
              {files.length > 1 && (
                <svg className="w-4 h-4 text-neutral-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}

              {/* Order number */}
              <span className="text-xs font-mono text-neutral-500 shrink-0 w-5 text-center">
                {index + 1}
              </span>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-200 truncate">{file.name}</p>
              </div>

              {/* Size */}
              <span className="text-xs text-neutral-500 shrink-0">{formatSize(file.size)}</span>

              {/* Remove button */}
              {!disabled && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    removeFile(index);
                  }}
                  className="text-neutral-600 hover:text-red-400 transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
