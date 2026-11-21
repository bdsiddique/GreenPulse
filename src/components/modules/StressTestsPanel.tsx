import React from 'react';
import {
  CloudLightning,
  CloudOff,
  Flame,
  HeartPulse,
  Snowflake,
} from 'lucide-react';
import type { SimulationSummary } from '../../types/simulation';
import { useSimulationStore } from '../../store/useSimulationStore';
import { NumericInputField, SwitchRow } from '../ui/NumericInputField';

interface StressTestsPanelProps {
  summary: SimulationSummary;
}

export const StressTestsPanel: React.FC<StressTestsPanelProps> = ({ summary }) => {
  const { config, updateStressTest } = useSimulationStore();
  const { cloudyStreak, heatwaveSpike, monsoonSquall, coldSnap } = config.stressTests;

  const ratingColor =
    summary.longevityRating === 'Optimal'
      ? 'text-emerald-700'
      : summary.longevityRating === 'Moderate Wear'
        ? 'text-amber-700'
        : 'text-rose-700';

  return (
    <div>
      {/* Live Battery Longevity Impact Strip */}
      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <HeartPulse className="w-3 h-3 text-slate-500" />
            Est. Life
          </div>
          <div className={`font-mono tabular-nums text-sm font-bold mt-0.5 ${ratingColor}`}>
            {config.plugModules.batteryEnabled && config.batteryCapacityKwh > 0
              ? `${summary.projectedLifespanYears.toFixed(1)}y`
              : 'N/A'}
          </div>
          {config.plugModules.batteryEnabled && summary.lifespanDeltaYears < -0.05 && (
            <div className="font-mono tabular-nums text-[10px] text-rose-600">
              {summary.lifespanDeltaYears.toFixed(1)}y delta
            </div>
          )}
        </div>

        <div>
          <div className="text-[10px] text-slate-500">Peak Cell Temp</div>
          <div
            className={`font-mono tabular-nums text-sm font-bold mt-0.5 ${
              summary.peakBatteryCellTempC >= 40
                ? 'text-rose-600'
                : summary.peakBatteryCellTempC >= 35
                  ? 'text-amber-600'
                  : 'text-slate-900'
            }`}
          >
            {summary.peakBatteryCellTempC.toFixed(1)}°C
          </div>
          <div className="font-mono tabular-nums text-[10px] text-slate-500">
            {summary.avgThermalStressFactor.toFixed(2)}x wear
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-500">Annual Fade</div>
          <div className="font-mono tabular-nums text-sm font-bold text-slate-900 mt-0.5">
            {summary.annualizedFadePct.toFixed(2)}%
          </div>
          <div className={`text-[10px] font-medium ${ratingColor}`}>
            {summary.longevityRating}
          </div>
        </div>
      </div>

      {/* Toggleable Extreme Weather Modules */}
      <div className="divide-y divide-slate-200">
        {/* 1. Cloudy Streak */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <CloudOff
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                  cloudyStreak.enabled ? 'text-slate-900' : 'text-slate-400'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">Cloudy Streak</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Dense cloud deck reducing solar output and forcing deeper battery cycling.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cloudyStreak.enabled}
              onClick={() =>
                updateStressTest('cloudyStreak', { enabled: !cloudyStreak.enabled })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                cloudyStreak.enabled ? 'bg-slate-900' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  cloudyStreak.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {cloudyStreak.enabled && (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <NumericInputField
                label="Start Hour"
                value={cloudyStreak.startHour}
                unit="hr"
                min={0}
                max={config.horizonHours - 1}
                step={1}
                onChange={(v) => updateStressTest('cloudyStreak', { startHour: v })}
              />
              <NumericInputField
                label="Duration"
                value={cloudyStreak.durationHours}
                unit="hrs"
                min={1}
                max={config.horizonHours}
                step={1}
                onChange={(v) => updateStressTest('cloudyStreak', { durationHours: v })}
              />
              <div className="col-span-2">
                <NumericInputField
                  label="Irradiance Attenuation"
                  value={cloudyStreak.irradianceDropPct}
                  unit="%"
                  min={15}
                  max={95}
                  step={5}
                  onChange={(v) => updateStressTest('cloudyStreak', { irradianceDropPct: v })}
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. Heatwave Spike */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <Flame
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                  heatwaveSpike.enabled ? 'text-rose-600' : 'text-slate-400'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">Heatwave Spike</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Extreme ambient heat driving HVAC surge, PV thermal loss, and cell aging.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={heatwaveSpike.enabled}
              onClick={() => {
                const next = !heatwaveSpike.enabled;
                updateStressTest('heatwaveSpike', { enabled: next });
                if (next && coldSnap.enabled) {
                  updateStressTest('coldSnap', { enabled: false });
                }
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                heatwaveSpike.enabled ? 'bg-rose-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  heatwaveSpike.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {heatwaveSpike.enabled && (
            <div className="space-y-2 pt-0.5">
              <div className="grid grid-cols-2 gap-2">
                <NumericInputField
                  label="Peak Ambient"
                  value={heatwaveSpike.peakTempC}
                  unit="°C"
                  min={34}
                  max={54}
                  step={1}
                  onChange={(v) => updateStressTest('heatwaveSpike', { peakTempC: v })}
                />
                <NumericInputField
                  label="HVAC Load Surge"
                  value={heatwaveSpike.loadSurgePct}
                  unit="%"
                  min={5}
                  max={100}
                  step={5}
                  onChange={(v) => updateStressTest('heatwaveSpike', { loadSurgePct: v })}
                />
              </div>
              <NumericInputField
                label="PV Thermal Derating"
                value={heatwaveSpike.pvThermalDeratePct}
                unit="%"
                min={0}
                max={35}
                step={1}
                onChange={(v) => updateStressTest('heatwaveSpike', { pvThermalDeratePct: v })}
              />
            </div>
          )}
        </div>

        {/* 3. Monsoon Squall */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <CloudLightning
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                  monsoonSquall.enabled ? 'text-amber-600' : 'text-slate-400'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">Monsoon Squall</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Sudden 86% solar collapse with optional utility feeder trip into backup.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={monsoonSquall.enabled}
              onClick={() =>
                updateStressTest('monsoonSquall', { enabled: !monsoonSquall.enabled })
              }
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                monsoonSquall.enabled ? 'bg-amber-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  monsoonSquall.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {monsoonSquall.enabled && (
            <div className="space-y-2 pt-0.5">
              <div className="grid grid-cols-2 gap-2">
                <NumericInputField
                  label="Squall Start"
                  value={monsoonSquall.startHour}
                  unit="hr"
                  min={0}
                  max={config.horizonHours - 1}
                  step={1}
                  onChange={(v) => updateStressTest('monsoonSquall', { startHour: v })}
                />
                <NumericInputField
                  label="Duration"
                  value={monsoonSquall.durationHours}
                  unit="hrs"
                  min={1}
                  max={12}
                  step={1}
                  onChange={(v) => updateStressTest('monsoonSquall', { durationHours: v })}
                />
              </div>
              <SwitchRow
                label="Trip Utility Grid Feeder"
                description="Force islanded battery discharge during the squall."
                checked={monsoonSquall.gridTrip}
                onChange={(checked) => updateStressTest('monsoonSquall', { gridTrip: checked })}
              />
            </div>
          )}
        </div>

        {/* 4. Cold Snap */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <Snowflake
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                  coldSnap.enabled ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">Sub-Zero Cold Snap</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Freezing ambient conditions derating usable pack capacity and charge stress.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={coldSnap.enabled}
              onClick={() => {
                const next = !coldSnap.enabled;
                updateStressTest('coldSnap', { enabled: next });
                if (next && heatwaveSpike.enabled) {
                  updateStressTest('heatwaveSpike', { enabled: false });
                }
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                coldSnap.enabled ? 'bg-sky-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  coldSnap.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {coldSnap.enabled && (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <NumericInputField
                label="Min Ambient"
                value={coldSnap.minTempC}
                unit="°C"
                min={-25}
                max={5}
                step={1}
                onChange={(v) => updateStressTest('coldSnap', { minTempC: v })}
              />
              <NumericInputField
                label="Pack Derating"
                value={coldSnap.capacityDeratePct}
                unit="%"
                min={5}
                max={40}
                step={1}
                onChange={(v) => updateStressTest('coldSnap', { capacityDeratePct: v })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
