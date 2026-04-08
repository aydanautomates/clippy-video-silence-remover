"use client";

import { useState, useCallback } from "react";

interface TrimmedFile {
  index: number;
  filename: string;
  size_mb: number;
}

interface StatusBarProps {
  status: "idle" | "uploading" | "processing" | "done" | "error";
  step: string;
  segments: number | null;
  inputSizeMb: number | null;
  outputSizeMb: number | null;
  jobId: string | null;
  batch?: boolean;
  totalFiles?: number;
  currentFile?: number;
  trimmedFiles?: TrimmedFile[];
  segmentCount?: number | null;
  onReset: () => void;
  onReprocess?: () => void;
}

export default function StatusBar({
  status,
  step,
  segments,
  inputSizeMb,
  outputSizeMb,
  jobId,
  batch,
  totalFiles,
  currentFile,
  trimmedFiles,
  segmentCount,
  onReset,
  onReprocess,
}: StatusBarProps) {
  const [showIndividual, setShowIndividual] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const isBatchMulti = batch && totalFiles && totalFiles > 1;

  const toggleSelect = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!trimmedFiles) return;
    if (selected.size === trimmedFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(trimmedFiles.map((f) => f.index)));
    }
  }, [trimmedFiles, selected.size]);

  const downloadSelected = useCallback(() => {
    const indices = Array.from(selected).sort((a, b) => a - b).join(",");
    const link = document.createElement("a");
    link.href = `http://localhost:8000/api/download-zip/${jobId}?indices=${indices}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [selected, jobId]);

  if (status === "idle") return null;

  const allSelected = trimmedFiles ? selected.size === trimmedFiles.length : false;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
      {/* Processing / Uploading */}
      {(status === "uploading" || status === "processing") && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <p className="text-sm text-neutral-300">{step}</p>
          </div>

          {/* Batch progress bar */}
          {isBatchMulti && currentFile != null && status === "processing" && (
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${(currentFile / totalFiles) * 100}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 text-right">
                Video {currentFile} of {totalFiles}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-300">{step}</p>
          </div>
          <button
            onClick={onReset}
            className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Done */}
      {status === "done" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-emerald-300">
              {isBatchMulti
                ? `All ${totalFiles} videos processed & merged!`
                : "Processing complete!"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-neutral-800 p-3">
              <p className="text-lg font-semibold text-neutral-100">{segments}</p>
              <p className="text-xs text-neutral-500">Segments</p>
            </div>
            <div className="rounded-lg bg-neutral-800 p-3">
              <p className="text-lg font-semibold text-neutral-100">{inputSizeMb} MB</p>
              <p className="text-xs text-neutral-500">Original</p>
            </div>
            <div className="rounded-lg bg-neutral-800 p-3">
              <p className="text-lg font-semibold text-neutral-100">{outputSizeMb} MB</p>
              <p className="text-xs text-neutral-500">
                {isBatchMulti ? "Merged" : "Trimmed"}
              </p>
            </div>
          </div>

          {/* Download options */}
          <div className="space-y-2">
            <a
              href={`http://localhost:8000/api/download/${jobId}`}
              download
              className="block w-full rounded-lg bg-emerald-600 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              {isBatchMulti
                ? "Download Merged Video"
                : "Download Trimmed Video"}
            </a>

            {segmentCount && segmentCount > 1 && (
              <a
                href={`http://localhost:8000/api/download-segments/${jobId}`}
                download
                className="block w-full rounded-lg border border-violet-600 py-2.5 text-center text-sm font-medium text-violet-400 hover:bg-violet-600/10 transition-colors"
              >
                Download Timeline Clips ({segmentCount} segments)
              </a>
            )}

            {/* Individual downloads for batch */}
            {isBatchMulti && trimmedFiles && trimmedFiles.length > 1 && (
              <>
                <button
                  onClick={() => {
                    setShowIndividual(!showIndividual);
                    if (!showIndividual && selected.size === 0) {
                      setSelected(new Set(trimmedFiles.map((f) => f.index)));
                    }
                  }}
                  className="w-full rounded-lg border border-neutral-700 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Download Individual Clips</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showIndividual ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {showIndividual && (
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 space-y-2">
                    {/* Select all + download button */}
                    <div className="flex items-center justify-between px-1 pb-1 border-b border-neutral-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="accent-violet-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="text-xs text-neutral-400">
                          {allSelected ? "Deselect All" : "Select All"}
                        </span>
                      </label>
                      <button
                        onClick={downloadSelected}
                        disabled={selected.size === 0}
                        className="text-xs font-medium text-violet-400 hover:text-violet-300 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download {selected.size > 0 ? `(${selected.size})` : ""}
                      </button>
                    </div>

                    {/* File list with checkboxes */}
                    <div className="space-y-0.5">
                      {trimmedFiles.map((tf) => (
                        <label
                          key={tf.index}
                          className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-neutral-800 transition-colors cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(tf.index)}
                            onChange={() => toggleSelect(tf.index)}
                            className="accent-violet-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                          />
                          <span className="text-xs font-mono text-neutral-500 shrink-0 w-4 text-center">
                            {tf.index + 1}
                          </span>
                          <span className="text-sm text-neutral-300 truncate flex-1">{tf.filename}</span>
                          <span className="text-xs text-neutral-500 shrink-0">{tf.size_mb} MB</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3">
            {onReprocess && (
              <button
                onClick={onReprocess}
                className="flex-1 rounded-lg border border-violet-600 px-4 py-2.5 text-sm text-violet-400 hover:bg-violet-600/10 transition-colors"
              >
                Adjust & Reprocess
              </button>
            )}
            <button
              onClick={onReset}
              className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Process Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
