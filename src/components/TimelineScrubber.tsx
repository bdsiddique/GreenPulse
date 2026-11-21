import React, { useCallback, useMemo, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { HorizonHours, HourlyStepResult } from '../types/simulation';

interface TimelineScrubberProps {
  steps: HourlyStepResult[];
  selectedHour: number;
  horizonHours: HorizonHours;
  onScrub: (hour: number) => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  steps,
  selectedHour,
  horizonHours,
  onScrub,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  const maxIdx = Math.max(0, steps.length - 1);
  const clampedHour = Math.max(0, Math.min(maxIdx, selectedHour));
  const activeStep = steps[clampedHour] || steps[0];

  const getHourFromClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el || maxIdx === 0) return 0;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * maxIdx);
    },
    [maxIdx]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    const hr = getHourFromClientX(e.clientX);
    setHoverHour(hr);
    onScrub(hr);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const hr = getHourFromClientX(e.clientX);
    setHoverHour(hr);
    if (isDragging && hr !== clampedHour) {
      onScrub(hr);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onScrub(Math.min(maxIdx, clampedHour + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onScrub(Math.max(0, clampedHour - 1));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      onScrub(Math.min(maxIdx, clampedHour + 4));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      onScrub(Math.max(0, clampedHour - 4));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onScrub(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onScrub(maxIdx);
    }
  };

  // Precompute normalized SVG waveform curves for PV generation, Household Load, and Battery SOC
  const waveform = useMemo(() => {
    if (steps.length === 0) {
      return {
        pvAreaPath: '',
        pvLinePath: '',
        loadLinePath: '',
        socLinePath: '',
        maxPowerKw: 1,
      };
    }

    const maxPowerKw = Math.max(
      1,
      ...steps.map((s) => Math.max(s.pvAvailableKw, s.householdLoadKw, 0.5))
    );
    const denom = Math.max(1, steps.length - 1);
    const xAt = (i: number) => (i / denom) * 1000;
    const yPower = (kw: number) => 94 - (Math.max(0, kw) / maxPowerKw) * 80;
    const ySoc = (soc: number) => 94 - (Math.max(0, Math.min(100, soc)) / 100) * 80;

    const pvPts = steps.map((s, i) => `${xAt(i).toFixed(1)},${yPower(s.pvAvailableKw).toFixed(1)}`);
    const loadPts = steps.map(
      (s, i) => `${xAt(i).toFixed(1)},${yPower(s.householdLoadKw).toFixed(1)}`
    );
    const socPts = steps.map((s, i) => `${xAt(i).toFixed(1)},${ySoc(s.batterySocPct).toFixed(1)}`);

    const pvLinePath = `M ${pvPts.join(' L ')}`;
    const pvAreaPath = `M 0,96 L ${pvPts.join(' L ')} L 1000,96 Z`;
    const loadLinePath = `M ${loadPts.join(' L ')}`;
    const socLinePath = `M ${socPts.join(' L ')}`;

    return { pvAreaPath, pvLinePath, loadLinePath, socLinePath, maxPowerKw };
  }, [steps]);

  if (!activeStep) return null;

  const progressPct = maxIdx > 0 ? (clampedHour / maxIdx) * 100 : 0;
  const hoverPct = hoverHour !== null && maxIdx > 0 ? (hoverHour / maxIdx) * 100 : null;
  const inspectedStep =
    !isDragging && hoverHour !== null && steps[hoverHour] ? steps[hoverHour] : activeStep;

  const battDirectionLabel =
    inspectedStep.batteryChargeKw > 0.02
      ? `CHG +${inspectedStep.batteryChargeKw.toFixed(1)}kW`
      : inspectedStep.batteryDischargeKw > 0.02
        ? `DIS -${inspectedStep.batteryDischargeKw.toFixed(1)}kW`
        : 'IDLE';

  const gridLabel = !inspectedStep.gridOnline
    ? 'OFFLINE'
    : inspectedStep.gridExportKw > 0.02
      ? `EXP ${inspectedStep.gridExportKw.toFixed(1)}kW`
      : inspectedStep.gridImportKw > 0.02
        ? `IMP ${inspectedStep.gridImportKw.toFixed(1)}kW`
        : '0.0kW';

  const rulerTicks =
    horizonHours === 72
      ? [
          { label: 'Day 1 · 00:00', pct: 0 },
          { label: 'Day 1 · 12:00', pct: (12 / 71) * 100 },
          { label: 'Day 2 · 00:00', pct: (24 / 71) * 100 },
          { label: 'Day 2 · 12:00', pct: (36 / 71) * 100 },
          { label: 'Day 3 · 00:00', pct: (48 / 71) * 100 },
          { label: 'Day 3 · 23:00', pct: 100 },
        ]
      : [
          { label: '00:00', pct: 0 },
          { label: '04:00', pct: (4 / 23) * 100 },
          { label: '08:00', pct: (8 / 23) * 100 },
          { label: '12:00', pct: (12 / 23) * 100 },
          { label: '16:00', pct: (16 / 23) * 100 },
          { label: '20:00', pct: (20 / 23) * 100 },
          { label: '23:00', pct: 100 },
        ];

  return (
    <div className="space-y-1.5">
      {/* Live Scrubbing Telemetry Readout + Waveform Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-300">
          <span className="font-semibold text-amber-400">
            {inspectedStep.clockLabel}
            {isDragging ? ' · SCRUBBING' : ''}
          </span>
          <span>
            <span className="text-amber-400">PV</span> {inspectedStep.pvAvailableKw.toFixed(2)} kW
          </span>
          <span>
            <span className="text-sky-400">Load</span> {inspectedStep.householdLoadKw.toFixed(2)} kW
          </span>
          <span>
            <span className="text-emerald-400">SOC</span> {inspectedStep.batterySocPct.toFixed(0)}%{' '}
            <span className="text-slate-500">({battDirectionLabel})</span>
          </span>
          <span className="hidden sm:inline">
            <span className="text-indigo-400">Grid</span> {gridLabel}
          </span>
        </div>

        <span className="text-[10px] text-slate-400 font-sans whitespace-nowrap">
          {isDragging ? 'Release to lock hour' : 'Drag handle across timeline for live flow'}
        </span>
      </div>

      {/* Interactive Draggable Visual Scrubber Track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Interactive simulation timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={maxIdx}
        aria-valuenow={clampedHour}
        aria-valuetext={`${activeStep.clockLabel}, PV ${activeStep.pvAvailableKw.toFixed(2)} kW, Load ${activeStep.householdLoadKw.toFixed(2)} kW, SOC ${activeStep.batterySocPct.toFixed(0)}%`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          if (!isDragging) setHoverHour(null);
        }}
        onKeyDown={handleKeyDown}
        className={`relative h-[68px] w-full rounded-lg border bg-slate-950/95 overflow-hidden select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors ${
          isDragging
            ? 'border-amber-400/80 cursor-grabbing'
            : 'border-slate-700/90 hover:border-slate-600 cursor-ew-resize'
        }`}
      >
        {/* Background Hourly Fault / Outage / Export Zone Strips */}
        <div className="absolute inset-0 flex pointer-events-none">
          {steps.map((s) => {
            const bg =
              s.gridCapBreachKw > 0.01 || s.unservedLoadKw > 0.01
                ? 'bg-rose-500/25'
                : !s.gridOnline
                  ? 'bg-amber-500/18'
                  : s.activeEvents.includes('HEATWAVE_SPIKE')
                    ? 'bg-orange-500/10'
                    : s.activeEvents.includes('PEAK_TARIFF')
                      ? 'bg-indigo-500/10'
                      : 'bg-transparent';
            return (
              <div
                key={s.hour}
                className={`flex-1 h-full border-r border-slate-800/35 last:border-r-0 ${bg}`}
              />
            );
          })}
        </div>

        {/* Visual Mini-Waveform SVG (Solar PV Area + Household Load + Battery SOC) */}
        <svg
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="scrubberPvFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Horizontal reference hairline */}
          <line
            x1="0"
            y1="54"
            x2="1000"
            y2="54"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="4 6"
            vectorEffect="non-scaling-stroke"
          />

          {/* Solar PV Generation Area & Curve */}
          <path d={waveform.pvAreaPath} fill="url(#scrubberPvFill)" />
          <path
            d={waveform.pvLinePath}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="1.75"
            vectorEffect="non-scaling-stroke"
          />

          {/* Battery SOC Trajectory */}
          <path
            d={waveform.socLinePath}
            fill="none"
            stroke="#34D399"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            strokeOpacity="0.9"
            vectorEffect="non-scaling-stroke"
          />

          {/* Household Load Curve */}
          <path
            d={waveform.loadLinePath}
            fill="none"
            stroke="#38BDF8"
            strokeWidth="1.9"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Elapsed Progress Tint */}
        <div
          className="absolute inset-y-0 left-0 bg-amber-400/[0.04] pointer-events-none"
          style={{ width: `${progressPct}%` }}
        />

        {/* Hover Preview Ghost Line */}
        {!isDragging && hoverPct !== null && hoverHour !== clampedHour && (
          <div
            className="absolute inset-y-0 w-px bg-slate-400/50 pointer-events-none"
            style={{ left: `${hoverPct}%` }}
          />
        )}

        {/* Active Draggable Playhead Needle & Precision Handle */}
        <div
          className="absolute inset-y-0 pointer-events-none z-10"
          style={{ left: `${progressPct}%` }}
        >
          <div className="absolute inset-y-0 -translate-x-1/2 w-[2px] bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]" />
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-md border bg-amber-400 text-slate-950 shadow-md transition-transform ${
              isDragging
                ? 'w-5 h-8 border-white scale-110 ring-2 ring-amber-300/60'
                : 'w-4 h-7 border-amber-200'
            }`}
          >
            <GripVertical className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Bottom Monospace Ruler Ticks */}
      <div className="relative h-4 text-[10px] font-mono tabular-nums text-slate-400 select-none">
        {rulerTicks.map((tick, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === rulerTicks.length - 1;
          return (
            <span
              key={tick.label}
              style={{ left: `${tick.pct}%` }}
              className={`absolute top-0 whitespace-nowrap ${
                isFirst
                  ? 'translate-x-0'
                  : isLast
                    ? '-translate-x-full'
                    : '-translate-x-1/2'
              }`}
            >
              {tick.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};
