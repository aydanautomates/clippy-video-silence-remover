"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Dropzone from "./components/dropzone";
import Controls from "./components/controls";
import StatusBar from "./components/status-bar";
import ClippyLogo from "./components/clippy-logo";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

const API = "http://localhost:8000";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState(-35);
  const [padding, setPadding] = useState(100);
  const [minSilence, setMinSilence] = useState(300);

  const [status, setStatus] = useState<Status>("idle");
  const [step, setStep] = useState("");
  const [segments, setSegments] = useState<number | null>(null);
  const [inputSizeMb, setInputSizeMb] = useState<number | null>(null);
  const [outputSizeMb, setOutputSizeMb] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollStatus = useCallback(
    (id: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API}/api/status/${id}`);
          if (res.status === 404) {
            setStatus("error");
            setStep("Job not found. Please try again.");
            stopPolling();
            return;
          }
          if (!res.ok) return;
          const data = await res.json();

          setStep(data.step);
          setSegments(data.segments);

          if (data.status === "done") {
            setStatus("done");
            setInputSizeMb(data.input_size_mb);
            setOutputSizeMb(data.output_size_mb);
            stopPolling();
          } else if (data.status === "error") {
            setStatus("error");
            stopPolling();
          }
        } catch {
          // Network error — keep polling
        }
      }, 2000);
    },
    [stopPolling]
  );

  const handleProcess = useCallback(async () => {
    if (!file) return;

    setStatus("uploading");
    setStep("Uploading video...");
    setSegments(null);
    setInputSizeMb(null);
    setOutputSizeMb(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("threshold", threshold.toString());
      formData.append("padding", padding.toString());
      formData.append("min_silence", minSilence.toString());

      const res = await fetch(`${API}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }

      const data = await res.json();
      setJobId(data.job_id);
      setStatus("processing");
      setStep("Starting processing...");
      pollStatus(data.job_id);
    } catch (err) {
      setStatus("error");
      setStep(err instanceof Error ? err.message : "Upload failed");
    }
  }, [file, threshold, padding, minSilence, pollStatus]);

  const handleReset = useCallback(() => {
    stopPolling();
    setFile(null);
    setStatus("idle");
    setStep("");
    setSegments(null);
    setInputSizeMb(null);
    setOutputSizeMb(null);
    setJobId(null);
  }, [stopPolling]);

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <main className="flex-1 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <ClippyLogo className="h-8 w-8" />
            <h1 className="text-3xl font-bold tracking-tight text-neutral-100">
              Clippy
            </h1>
          </div>
          <p className="text-sm text-neutral-500">
            Remove silence from your videos automatically
          </p>
        </div>

        <Dropzone file={file} onFileSelect={setFile} disabled={isProcessing} />

        <Controls
          threshold={threshold}
          padding={padding}
          minSilence={minSilence}
          onThresholdChange={setThreshold}
          onPaddingChange={setPadding}
          onMinSilenceChange={setMinSilence}
          disabled={isProcessing}
        />

        {status === "idle" && (
          <button
            onClick={handleProcess}
            disabled={!file}
            className="w-full rounded-lg bg-violet-600 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Process Video
          </button>
        )}

        <StatusBar
          status={status}
          step={step}
          segments={segments}
          inputSizeMb={inputSizeMb}
          outputSizeMb={outputSizeMb}
          jobId={jobId}
          onReset={handleReset}
        />
      </div>
    </main>
  );
}
