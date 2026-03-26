"use client";

interface StatusBarProps {
  status: "idle" | "uploading" | "processing" | "done" | "error";
  step: string;
  segments: number | null;
  inputSizeMb: number | null;
  outputSizeMb: number | null;
  jobId: string | null;
  onReset: () => void;
}

export default function StatusBar({
  status,
  step,
  segments,
  inputSizeMb,
  outputSizeMb,
  jobId,
  onReset,
}: StatusBarProps) {
  if (status === "idle") return null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
      {/* Processing / Uploading */}
      {(status === "uploading" || status === "processing") && (
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-sm text-neutral-300">{step}</p>
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
            <p className="text-sm text-emerald-300">Processing complete!</p>
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
              <p className="text-xs text-neutral-500">Trimmed</p>
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href={`http://localhost:8000/api/download/${jobId}`}
              download
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Download Trimmed Video
            </a>
            <button
              onClick={onReset}
              className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Process Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
