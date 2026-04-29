"use client";

import { useState } from "react";

interface ControlsProps {
  threshold: number;
  startPadding: number;
  endPadding: number;
  minSilence: number;
  onThresholdChange: (v: number) => void;
  onStartPaddingChange: (v: number) => void;
  onEndPaddingChange: (v: number) => void;
  onMinSilenceChange: (v: number) => void;
  disabled?: boolean;
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow((s) => !s)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-700 text-neutral-400 text-[10px] font-bold hover:bg-neutral-600 hover:text-neutral-200 transition-colors cursor-help"
        aria-label="More info"
      >
        ?
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-neutral-800 border border-neutral-700 p-2.5 text-xs text-neutral-300 leading-relaxed shadow-xl z-10">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-neutral-700" />
        </div>
      )}
    </span>
  );
}

function Slider({
  label,
  tooltip,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  tooltip: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-400 flex items-center">
          {label}
          <Tooltip text={tooltip} />
        </span>
        <span className="font-mono text-neutral-200">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-violet-500 disabled:opacity-50"
      />
      <div className="flex justify-between text-xs text-neutral-600">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

export default function Controls({
  threshold,
  startPadding,
  endPadding,
  minSilence,
  onThresholdChange,
  onStartPaddingChange,
  onEndPaddingChange,
  onMinSilenceChange,
  disabled,
}: ControlsProps) {
  return (
    <div className="space-y-5 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-sm font-medium text-neutral-300">Settings</h2>
      <Slider
        label="Silence Threshold"
        tooltip="The volume level (in decibels) below which audio is considered silence. Lower values (e.g. -50dB) mean only very quiet parts are cut. Higher values (e.g. -20dB) will cut more aggressively, removing even soft speech. Start at -35dB and adjust from there."
        value={threshold}
        min={-60}
        max={-10}
        step={1}
        unit="dB"
        onChange={onThresholdChange}
        disabled={disabled}
      />
      <Slider
        label="Start Padding"
        tooltip="Buffer kept BEFORE each speech segment. Prevents the first word from getting clipped. If openings sound cut off, increase this."
        value={startPadding}
        min={0}
        max={500}
        step={10}
        unit="ms"
        onChange={onStartPaddingChange}
        disabled={disabled}
      />
      <Slider
        label="End Padding"
        tooltip="Buffer kept AFTER each speech segment. Prevents trailing syllables and breaths from getting clipped. Usually wants a bit more room than Start Padding — try 150-250ms if endings sound chopped."
        value={endPadding}
        min={0}
        max={500}
        step={10}
        unit="ms"
        onChange={onEndPaddingChange}
        disabled={disabled}
      />
      <Slider
        label="Min Silence Length"
        tooltip="How long a pause must last (in milliseconds) before it counts as silence worth removing. Short values (e.g. 100ms) remove even brief pauses between words. Longer values (e.g. 500ms+) only remove extended dead air, keeping natural pauses in your speech intact."
        value={minSilence}
        min={100}
        max={1000}
        step={50}
        unit="ms"
        onChange={onMinSilenceChange}
        disabled={disabled}
      />
    </div>
  );
}
