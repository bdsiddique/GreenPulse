import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BatteryWarning,
  CheckCircle2,
  CloudLightning,
  CloudOff,
  DollarSign,
  FileText,
  Flame,
  Plus,
  RotateCcw,
  ShieldAlert,
  Snowflake,
  Trash2,
  TrendingUp,
  Zap,
  ZapOff,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CURRENCIES, formatMoney } from '../engine/currencies';
import { formatHourClock, solveSimulation } from '../engine/dispatchEngine';
import { createDefaultStressTests } from '../engine/presets';
import { useSimulationStore } from '../store/useSimulationStore';
import type { HorizonHours, SimulationConfig } from '../types/simulation';

interface StressPreset {
  id: string;
  label: string;
  subtitle: string;
  apply: (cfg: SimulationConfig) => Partial<SimulationConfig>;
}

const COMPOSITE_PRESETS: StressPreset[] = [
  {
    id: 'blackout_surge',
    label: 'Evening Blackout + Surge',
    subtitle: '18:00–22:00 outage + 1.9× pre-outage load spike',
    apply: () => ({
      horizonHours: 24,
      inputMode: 'parametric',
      plugModules: { pvEnabled: true, batteryEnabled: true, gridEnabled: true },
      outageWindows: [
        { id: 'st_eve_blackout', startHour: 18, endHour: 22, label: 'Peak Evening Blackout' },
      ],
      stressTests: {
        ...createDefaultStressTests(),
        loadSurge: {
          enabled: true,
          startHour: 16,
          durationHours: 4,
          surgeMultiplier: 1.9,
        },
      },
    }),
  },
  {
    id: 'price_shock',
    label: 'Tariff Price Spike (3.5×)',
    subtitle: 'Emergency 16:00–22:00 variable price shock + tight cap',
    apply: (cfg) => ({
      horizonHours: 24,
      inputMode: 'parametric',
      plugModules: { pvEnabled: true, batteryEnabled: true, gridEnabled: true },
      outageWindows: [],
      touEnabled: true,
      peakShavingEnabled: true,
      permittedGridPeakKw: Math.min(cfg.permittedGridPeakKw, 3.5),
      stressTests: {
        ...createDefaultStressTests(),
        priceSpike: {
          enabled: true,
          startHour: 16,
          durationHours: 6,
          multiplier: 3.5,
        },
        loadSurge: {
          enabled: true,
          startHour: 17,
          durationHours: 3,
          surgeMultiplier: 1.5,
        },
      },
    }),
  },
  {
    id: 'squall_feeder_trip',
    label: 'Monsoon Squall + Feeder Trip',
    subtitle: 'Sudden 86% solar collapse + 5h storm feeder outage',
    apply: () => ({
      horizonHours: 24,
      inputMode: 'parametric',
      plugModules: { pvEnabled: true, batteryEnabled: true, gridEnabled: true },
      outageWindows: [],
      stressTests: {
        ...createDefaultStressTests(),
        monsoonSquall: {
          enabled: true,
          startHour: 12,
          durationHours: 5,
          gridTrip: true,
        },
        cloudyStreak: {
          enabled: true,
          startHour: 10,
          durationHours: 8,
          irradianceDropPct: 75,
        },
      },
    }),
  },
  {
    id: 'siege_72h',
    label: '72h Blackout Autonomy Siege',
    subtitle: '36h blackout across cloudy Day 2 + overnight load surge',
    apply: () => ({
      horizonHours: 72,
      inputMode: 'parametric',
      plugModules: { pvEnabled: true, batteryEnabled: true, gridEnabled: true },
      outageWindows: [
        { id: 'st_72h_siege', startHour: 18, endHour: 54, label: '36h Regional Grid Collapse' },
      ],
      stressTests: {
        ...createDefaultStressTests(),
        cloudyStreak: {
          enabled: true,
          startHour: 24,
          durationHours: 24,
          irradianceDropPct: 68,
        },
        loadSurge: {
          enabled: true,
          startHour: 18,
          durationHours: 5,
          surgeMultiplier: 1.55,
        },
      },
    }),
  },
];

export const StressTestDashboard: React.FC = () => {
  const {
    config,
    updateConfig,
    updateStressTest,
    addOutageWindow,
    removeOutageWindow,
    setHorizonHours,
    setWorkspaceMode,
    setSelectedHour,
    openPdfModal,
    showToast,
  } = useSimulationStore();

  const [newOutageStart, setNewOutageStart] = useState(18);
  const [newOutageEnd, setNewOutageEnd] = useState(22);
  const [newOutageLabel, setNewOutageLabel] = useState('Emergency Blackout');

  const currencyMeta = CURRENCIES[config.currency];

  // Solve the active stressed configuration (always evaluated in parametric mode when stress controls are active)
  const stressedResult = useMemo(() => solveSimulation(config), [config]);

  // Solve a clean stress-free baseline reference for apples-to-apples stability delta comparison
  const baselineConfig = useMemo<SimulationConfig>(
    () => ({
      ...config,
      inputMode: 'parametric',
      plugModules: {
        ...config.plugModules,
        gridEnabled: true,
      },
      outageWindows: [],
      stressTests: createDefaultStressTests(),
    }),
    [config]
  );

  const baselineResult = useMemo(() => solveSimulation(baselineConfig), [baselineConfig]);

  const { loadSurge, priceSpike, cloudyStreak, heatwaveSpike, monsoonSquall, coldSnap } =
    config.stressTests;

  const activeStressorCount =
    [
      loadSurge.enabled,
      priceSpike.enabled,
      cloudyStreak.enabled,
      heatwaveSpike.enabled,
      monsoonSquall.enabled,
      coldSnap.enabled,
      !config.plugModules.gridEnabled,
    ].filter(Boolean).length + config.outageWindows.length;

  // Compute Battery Backup Stability & Vulnerability diagnostics from real step telemetry
  const stabilityMetrics = useMemo(() => {
    const steps = stressedResult.steps;
    const minReserve = config.batteryMinReserveSocPct;
    const firstReserveHit = steps.find(
      (s) =>
        config.plugModules.batteryEnabled &&
        config.batteryCapacityKwh > 0 &&
        s.batterySocPct <= minReserve + 0.25 &&
        (s.unservedLoadKw > 0.01 || !s.gridOnline || s.batteryDischargeKw > 0)
    );
    const reserveMarginPct = Math.max(0, stressedResult.summary.minBatterySocPct - minReserve);
    const outageTotal = stressedResult.summary.outageHoursTotal;
    const outageSurvived = stressedResult.summary.outageHoursSurvived;
    const survivalRatePct =
      outageTotal > 0 ? (outageSurvived / outageTotal) * 100 : 100;

    const costDelta =
      stressedResult.summary.netEnergyCost - baselineResult.summary.netEnergyCost;
    const maxImportRate = steps.reduce((m, s) => Math.max(m, s.importRate), 0);
    const peakDemandKw = steps.reduce((m, s) => Math.max(m, s.householdLoadKw), 0);
    const baselinePeakDemandKw = baselineResult.steps.reduce(
      (m, s) => Math.max(m, s.householdLoadKw),
      0
    );

    const status: 'stable' | 'strained' | 'critical' =
      stressedResult.summary.totalUnservedLoadKwh > 0.05 ||
      stressedResult.summary.gridCapBreachHours > 0
        ? 'critical'
        : reserveMarginPct < 5 ||
            stressedResult.summary.peakBatteryCellTempC >= 45 ||
            costDelta > Math.max(50, Math.abs(baselineResult.summary.netEnergyCost) * 0.35)
          ? 'strained'
          : 'stable';

    return {
      firstReserveHit,
      reserveMarginPct,
      outageTotal,
      outageSurvived,
      survivalRatePct,
      costDelta,
      maxImportRate,
      peakDemandKw,
      baselinePeakDemandKw,
      status,
    };
  }, [stressedResult, baselineResult, config]);

  // Combined chart data series (Baseline vs Stressed)
  const chartData = useMemo(() => {
    return stressedResult.steps.map((st, i) => {
      const base = baselineResult.steps[i] || st;
      return {
        hour: st.hour,
        label: st.shortLabel,
        clockLabel: st.clockLabel,
        stressedSoc: st.batterySocPct,
        baselineSoc: base.batterySocPct,
        stressedLoad: st.householdLoadKw,
        baselineLoad: base.householdLoadKw,
        servedLoad: Number(Math.max(0, st.householdLoadKw - st.unservedLoadKw).toFixed(2)),
        unservedLoad: st.unservedLoadKw,
        batteryDischarge: st.batteryDischargeKw,
        gridImport: st.gridImportKw,
        gridCap: st.gridPeakCapKw,
        stressedRate: st.importRate,
        baselineRate: base.importRate,
        hourlyNetCost: st.hourlyNetCost,
        baselineHourlyCost: base.hourlyNetCost,
        gridOnline: st.gridOnline,
        isLoadSurge: st.activeEvents.includes('LOAD_SURGE'),
        isPriceSpike: st.activeEvents.includes('PRICE_SPIKE'),
      };
    });
  }, [stressedResult, baselineResult]);

  // Compute contiguous blackout bands for chart shading
  const blackoutBands = useMemo(() => {
    const bands: Array<{ x1: string; x2: string }> = [];
    let startLabel: string | null = null;
    let lastLabel = '';
    for (const pt of chartData) {
      if (!pt.gridOnline) {
        if (!startLabel) startLabel = pt.label;
        lastLabel = pt.label;
      } else if (startLabel) {
        bands.push({ x1: startLabel, x2: lastLabel });
        startLabel = null;
      }
    }
    if (startLabel) {
      bands.push({ x1: startLabel, x2: lastLabel });
    }
    return bands;
  }, [chartData]);

  // Impacted hours for the vulnerability log table
  const impactedSteps = useMemo(() => {
    return stressedResult.steps.filter(
      (s) =>
        !s.gridOnline ||
        s.unservedLoadKw > 0.01 ||
        s.gridCapBreachKw > 0.01 ||
        s.activeEvents.includes('LOAD_SURGE') ||
        s.activeEvents.includes('PRICE_SPIKE') ||
        s.activeEvents.includes('MONSOON_SQUALL') ||
        s.batterySocPct <= config.batteryMinReserveSocPct + 0.5
    );
  }, [stressedResult.steps, config.batteryMinReserveSocPct]);

  const handleApplyPreset = (preset: StressPreset) => {
    updateConfig(preset.apply(config), true);
    showToast(`Activated stress test: ${preset.label}`, 'info');
  };

  const handleClearAllStressors = () => {
    updateConfig(
      {
        inputMode: 'parametric',
        plugModules: { ...config.plugModules, gridEnabled: true },
        outageWindows: [],
        stressTests: createDefaultStressTests(),
      },
      true
    );
    showToast('Cleared all grid & weather stressors back to baseline.', 'info');
  };

  const handleAddOutage = (e: React.FormEvent) => {
    e.preventDefault();
    const s = Math.max(0, Math.min(config.horizonHours - 1, Math.round(newOutageStart)));
    const en = Math.max(s + 1, Math.min(config.horizonHours, Math.round(newOutageEnd)));
    addOutageWindow({
      startHour: s,
      endHour: en,
      label: newOutageLabel.trim() || 'Grid Blackout',
    });
    if (config.inputMode !== 'parametric') {
      updateConfig({ inputMode: 'parametric' }, false);
    }
    showToast(`Added blackout window ${formatHourClock(s, config.horizonHours).shortLabel}–${en}h.`, 'info');
  };

  const handleQuickOutage = (startHour: number, endHour: number, label: string) => {
    const clampedEnd = Math.min(config.horizonHours, endHour);
    const clampedStart = Math.min(clampedEnd - 1, startHour);
    addOutageWindow({ startHour: clampedStart, endHour: clampedEnd, label });
    if (config.inputMode !== 'parametric') {
      updateConfig({ inputMode: 'parametric' }, false);
    }
    showToast(`Injected ${label} (${clampedStart}h–${clampedEnd}h).`, 'info');
  };

  return (
    <div className="space-y-4">
      {/* Header & Quick Composite Stress Scenarios */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-slate-900">
                Extreme Grid Stress Test Lab
              </h2>
              <span className="text-xs text-slate-500">
                · {activeStressorCount} active stressor{activeStressorCount === 1 ? '' : 's'} · {config.horizonHours}h horizon
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
              Simulate utility blackouts, sudden load surges, and variable tariff spikes against your active {config.pvCapacityKw} kWp PV / {config.batteryCapacityKwh} kWh battery bank to verify backup stability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-mono">
              {([24, 72] as HorizonHours[]).map((hr) => (
                <button
                  key={hr}
                  type="button"
                  onClick={() => setHorizonHours(hr)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                    config.horizonHours === hr
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {hr}h
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleClearAllStressors}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Stressors
            </button>

            <button
              type="button"
              onClick={() => openPdfModal(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              Export Stress PDF
            </button>
          </div>
        </div>

        {/* One-Click Composite Stress Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {COMPOSITE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="text-left p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 transition-colors"
            >
              <div className="text-xs font-semibold text-slate-900">{preset.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {preset.subtitle}
              </div>
            </button>
          ))}
        </div>

        {config.inputMode === 'fabricated' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
            <span>
              Fabricated Hourly Dataset mode is currently active. Parametric stress toggles switch input mode to Parametric automatically when enabled.
            </span>
            <button
              type="button"
              onClick={() => updateConfig({ inputMode: 'parametric' }, false)}
              className="font-semibold underline hover:text-amber-950 whitespace-nowrap"
            >
              Switch to Parametric Now
            </button>
          </div>
        )}
      </section>

      {/* Stability Verdict Banner & 5 Key Backup Resilience KPIs */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div
          className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
            stabilityMetrics.status === 'critical'
              ? 'bg-rose-50/80 border-rose-200 text-rose-900'
              : stabilityMetrics.status === 'strained'
                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {stabilityMetrics.status === 'critical' ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            ) : stabilityMetrics.status === 'strained' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>
              {stabilityMetrics.status === 'critical'
                ? 'Backup Stability Failure Detected — Battery Exhausted or Grid Cap Breached'
                : stabilityMetrics.status === 'strained'
                  ? 'System Strained — Operating Near Reserve Floor or Elevated Cost / Thermal Load'
                  : 'Backup Battery Stable — 100% Load Served Within Reserve & Grid Limits'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setWorkspaceMode('sandbox')}
            className="font-semibold underline hover:opacity-80 whitespace-nowrap"
          >
            Inspect in Overview
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Outage Survival</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-slate-900">
              {stabilityMetrics.outageTotal > 0
                ? `${stabilityMetrics.survivalRatePct.toFixed(0)}%`
                : 'No Outage'}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
              {stabilityMetrics.outageTotal > 0
                ? `${stabilityMetrics.outageSurvived}/${stabilityMetrics.outageTotal}h survived`
                : 'Add blackout to test'}
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Min Battery SOC</div>
            <div
              className={`mt-1 font-mono tabular-nums text-lg font-bold ${
                stressedResult.summary.minBatterySocPct <= config.batteryMinReserveSocPct + 0.5
                  ? 'text-rose-600'
                  : 'text-slate-900'
              }`}
            >
              {stressedResult.summary.minBatterySocPct.toFixed(1)}%
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
              Floor {config.batteryMinReserveSocPct}% · Margin +{stabilityMetrics.reserveMarginPct.toFixed(1)}%
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Unserved Shortfall</div>
            <div
              className={`mt-1 font-mono tabular-nums text-lg font-bold ${
                stressedResult.summary.totalUnservedLoadKwh > 0.02
                  ? 'text-rose-600'
                  : 'text-emerald-700'
              }`}
            >
              {stressedResult.summary.totalUnservedLoadKwh.toFixed(2)} kWh
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
              {stabilityMetrics.firstReserveHit
                ? `Floor hit at ${stabilityMetrics.firstReserveHit.shortLabel}`
                : `${stressedResult.summary.gridCapBreachHours}h grid cap breach`}
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-[11px] font-medium text-slate-500">Cost Shock Delta</div>
            <div
              className={`mt-1 font-mono tabular-nums text-lg font-bold ${
                stabilityMetrics.costDelta > 0.5 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {stabilityMetrics.costDelta >= 0 ? '+' : ''}
              {formatMoney(stabilityMetrics.costDelta, config.currency)}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
              Net {formatMoney(stressedResult.summary.netEnergyCost, config.currency)} · Peak {currencyMeta.symbol}
              {stabilityMetrics.maxImportRate.toFixed(2)}/kWh
            </div>
          </div>

          <div className="p-3.5 col-span-2 lg:col-span-1">
            <div className="text-[11px] font-medium text-slate-500">Peak Load & Thermal</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-slate-900">
              {stabilityMetrics.peakDemandKw.toFixed(2)} kW
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
              Cell {stressedResult.summary.peakBatteryCellTempC.toFixed(1)}°C · Life {stressedResult.summary.projectedLifespanYears.toFixed(1)}y
            </div>
          </div>
        </div>
      </section>

      {/* Main Split: Left Stress Controls + Right Stability Overlays */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left Column: Extreme Condition Injectors (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          {/* 1. Grid Blackout Injector */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ZapOff className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-semibold text-slate-900">Blackout & Outage Windows</h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateConfig(
                    {
                      inputMode: 'parametric',
                      plugModules: {
                        ...config.plugModules,
                        gridEnabled: !config.plugModules.gridEnabled,
                      },
                    },
                    true
                  )
                }
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  !config.plugModules.gridEnabled
                    ? 'bg-rose-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {config.plugModules.gridEnabled ? 'Force Full Island' : 'Grid Unplugged'}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickOutage(18, 22, 'Evening Peak Blackout')}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700"
              >
                + 4h Evening (18–22h)
              </button>
              <button
                type="button"
                onClick={() => handleQuickOutage(20, 30, 'Overnight Grid Failure')}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700"
              >
                + Overnight Outage
              </button>
              <button
                type="button"
                onClick={() => handleQuickOutage(10, 16, 'Midday Feeder Fault')}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700"
              >
                + 6h Midday Fault
              </button>
            </div>

            <form onSubmit={handleAddOutage} className="grid grid-cols-12 gap-1.5 items-end pt-1">
              <label className="col-span-3 text-[11px] text-slate-600">
                Start Hr
                <input
                  type="number"
                  min={0}
                  max={config.horizonHours - 1}
                  value={newOutageStart}
                  onChange={(e) => setNewOutageStart(Number(e.target.value))}
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-900"
                />
              </label>
              <label className="col-span-3 text-[11px] text-slate-600">
                End Hr
                <input
                  type="number"
                  min={1}
                  max={config.horizonHours}
                  value={newOutageEnd}
                  onChange={(e) => setNewOutageEnd(Number(e.target.value))}
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-900"
                />
              </label>
              <label className="col-span-4 text-[11px] text-slate-600">
                Label
                <input
                  type="text"
                  value={newOutageLabel}
                  onChange={(e) => setNewOutageLabel(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-900"
                />
              </label>
              <button
                type="submit"
                className="col-span-2 h-[28px] inline-flex items-center justify-center rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium"
                title="Add outage window"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>

            {config.outageWindows.length === 0 ? (
              <p className="text-xs text-slate-500 pt-1">
                No scheduled blackout windows active. Click a quick button or add custom hours above.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border-t border-slate-100 pt-1">
                {config.outageWindows.map((win) => (
                  <div
                    key={win.id}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800">{win.label}</span>
                      <span className="ml-2 font-mono tabular-nums text-[11px] text-rose-700">
                        Hr {win.startHour}–{win.endHour} ({win.endHour - win.startHour}h)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOutageWindow(win.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      aria-label={`Remove ${win.label}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. Load Surge Event Control */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-slate-900">Load Surge Event</h3>
              </div>
              <button
                type="button"
                onClick={() => updateStressTest('loadSurge', { enabled: !loadSurge.enabled })}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  loadSurge.enabled
                    ? 'bg-amber-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {loadSurge.enabled ? 'Active' : 'Disabled'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Multiplies household demand (e.g., simultaneous EV charging, HVAC startup, or motor inrush) to stress inverter discharge and grid peak caps.
            </p>
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Surge Multiplier</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {loadSurge.surgeMultiplier.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={1.2}
                max={3.5}
                step={0.05}
                value={loadSurge.surgeMultiplier}
                onChange={(e) =>
                  updateStressTest('loadSurge', {
                    enabled: true,
                    surgeMultiplier: Number(e.target.value),
                  })
                }
                className="w-full accent-slate-900"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-600">
                  Start Hour (0–{config.horizonHours - 1})
                  <input
                    type="number"
                    min={0}
                    max={config.horizonHours - 1}
                    value={loadSurge.startHour}
                    onChange={(e) =>
                      updateStressTest('loadSurge', {
                        enabled: true,
                        startHour: Math.max(0, Math.min(config.horizonHours - 1, Number(e.target.value) || 0)),
                      })
                    }
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-900"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  Duration (hours)
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={loadSurge.durationHours}
                    onChange={(e) =>
                      updateStressTest('loadSurge', {
                        enabled: true,
                        durationHours: Math.max(1, Math.min(24, Number(e.target.value) || 1)),
                      })
                    }
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-900"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* 3. Variable Pricing Spike Control */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-semibold text-slate-900">Variable Pricing Spike</h3>
              </div>
              <button
                type="button"
                onClick={() => updateStressTest('priceSpike', { enabled: !priceSpike.enabled })}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  priceSpike.enabled
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {priceSpike.enabled ? 'Active' : 'Disabled'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Injects emergency real-time utility tariff surcharges to measure how effectively battery peak shaving shields energy bills.
            </p>
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Tariff Multiplier</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {priceSpike.multiplier.toFixed(1)}× ({currencyMeta.symbol}
                  {(config.peakRate * priceSpike.multiplier).toFixed(2)}/kWh peak)
                </span>
              </div>
              <input
                type="range"
                min={1.5}
                max={5.5}
                step={0.1}
                value={priceSpike.multiplier}
                onChange={(e) =>
                  updateStressTest('priceSpike', {
                    enabled: true,
                    multiplier: Number(e.target.value),
                  })
                }
                className="w-full accent-slate-900"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-600">
                  Start Hour (0–{config.horizonHours - 1})
                  <input
                    type="number"
                    min={0}
                    max={config.horizonHours - 1}
                    value={priceSpike.startHour}
                    onChange={(e) =>
                      updateStressTest('priceSpike', {
                        enabled: true,
                        startHour: Math.max(0, Math.min(config.horizonHours - 1, Number(e.target.value) || 0)),
                      })
                    }
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-900"
                  />
                </label>
                <label className="text-[11px] text-slate-600">
                  Duration (hours)
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={priceSpike.durationHours}
                    onChange={(e) =>
                      updateStressTest('priceSpike', {
                        enabled: true,
                        durationHours: Math.max(1, Math.min(24, Number(e.target.value) || 1)),
                      })
                    }
                    className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-900"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* 4. Compound Environmental Stressors */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900">Compound Weather Accelerators</h3>
            <p className="text-[11px] text-slate-500">
              Stack weather extremes onto grid events to simulate multi-hazard backup stress.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => updateStressTest('cloudyStreak', { enabled: !cloudyStreak.enabled })}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  cloudyStreak.enabled
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CloudOff className="w-3.5 h-3.5" />
                  <span className="font-mono text-[10px]">
                    -{cloudyStreak.irradianceDropPct}%
                  </span>
                </div>
                <div className="mt-1 text-xs font-semibold">Cloudy Streak</div>
              </button>

              <button
                type="button"
                onClick={() => updateStressTest('heatwaveSpike', { enabled: !heatwaveSpike.enabled })}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  heatwaveSpike.enabled
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Flame className="w-3.5 h-3.5" />
                  <span className="font-mono text-[10px]">{heatwaveSpike.peakTempC}°C</span>
                </div>
                <div className="mt-1 text-xs font-semibold">Heatwave Surge</div>
              </button>

              <button
                type="button"
                onClick={() => updateStressTest('monsoonSquall', { enabled: !monsoonSquall.enabled })}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  monsoonSquall.enabled
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CloudLightning className="w-3.5 h-3.5" />
                  <span className="font-mono text-[10px]">Trip</span>
                </div>
                <div className="mt-1 text-xs font-semibold">Monsoon Squall</div>
              </button>

              <button
                type="button"
                onClick={() => updateStressTest('coldSnap', { enabled: !coldSnap.enabled })}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  coldSnap.enabled
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Snowflake className="w-3.5 h-3.5" />
                  <span className="font-mono text-[10px]">
                    -{coldSnap.capacityDeratePct}% Cap
                  </span>
                </div>
                <div className="mt-1 text-xs font-semibold">Cold Snap Derate</div>
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Stability Analytics Charts & Impacted Hours Table (8 cols) */}
        <div className="xl:col-span-8 space-y-4">
          {/* Chart 1: Battery Backup SOC Stability (Stressed vs Baseline) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <BatteryWarning className="w-4 h-4 text-blue-600" />
                  Battery Backup Stability — SOC Trajectory (%)
                </h3>
                <p className="text-xs text-slate-500">
                  Compares stressed state-of-charge against stress-free baseline and minimum reserve floor ({config.batteryMinReserveSocPct}%). Shaded bands indicate grid blackouts.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Stressed SOC
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-slate-400 border-t border-dashed border-slate-500 inline-block" /> Baseline
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-rose-500 inline-block" /> Min Reserve
                </span>
              </div>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 14, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    interval={config.horizonHours === 72 ? 5 : 2}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  {blackoutBands.map((band, idx) => (
                    <ReferenceArea
                      key={idx}
                      x1={band.x1}
                      x2={band.x2}
                      fill="#FECDD3"
                      fillOpacity={0.35}
                    />
                  ))}
                  <ReferenceLine
                    y={config.batteryMinReserveSocPct}
                    stroke="#DC2626"
                    strokeDasharray="4 4"
                    label={{
                      value: `Reserve ${config.batteryMinReserveSocPct}%`,
                      position: 'insideTopRight',
                      fill: '#DC2626',
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="baselineSoc"
                    name="Baseline SOC (%)"
                    stroke="#94A3B8"
                    strokeWidth={1.75}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="stressedSoc"
                    name="Stressed SOC (%)"
                    stroke="#2563EB"
                    fill="#3B82F6"
                    fillOpacity={0.14}
                    strokeWidth={2.25}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Chart 2 & 3 Split: Load Surge/Unserved Deficit + Pricing Spike Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-600" />
                  Surge Load vs. Battery Backup & Shortfall (kW)
                </h3>
                <p className="text-xs text-slate-500">
                  Red bars highlight unserved blackout or grid-cap shortfall; amber line tracks stressed demand.
                </p>
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      interval={config.horizonHours === 72 ? 8 : 3}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="kW" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CBD5E1',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <ReferenceLine
                      y={config.permittedGridPeakKw}
                      stroke="#64748B"
                      strokeDasharray="3 3"
                    />
                    <Bar
                      dataKey="batteryDischarge"
                      name="Battery Discharge (kW)"
                      fill="#0284C7"
                      fillOpacity={0.65}
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="unservedLoad"
                      name="Unserved Shortfall (kW)"
                      fill="#DC2626"
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="baselineLoad"
                      name="Baseline Load (kW)"
                      stroke="#94A3B8"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="stressedLoad"
                      name="Stressed Load (kW)"
                      stroke="#D97706"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  Variable Pricing Spike & Hourly Cost ({currencyMeta.symbol})
                </h3>
                <p className="text-xs text-slate-500">
                  Compares spiked import rate ({currencyMeta.symbol}/kWh) against hourly net utility bill impact.
                </p>
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      interval={config.horizonHours === 72 ? 8 : 3}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CBD5E1',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="hourlyNetCost"
                      name={`Hourly Net Cost (${currencyMeta.symbol})`}
                      fill="#0F172A"
                      fillOpacity={0.75}
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="baselineRate"
                      name={`Base Rate (${currencyMeta.symbol}/kWh)`}
                      stroke="#94A3B8"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="stressedRate"
                      name={`Active Rate (${currencyMeta.symbol}/kWh)`}
                      stroke="#DC2626"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Stress Event Vulnerability Log Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Stressed Hours & Vulnerability Log
                </h3>
                <p className="text-xs text-slate-500">
                  {impactedSteps.length} hour{impactedSteps.length === 1 ? '' : 's'} experiencing outage, load surge, price spike, grid cap breach, or reserve floor proximity.
                </p>
              </div>
              <span className="font-mono text-[11px] text-slate-500">
                Click a row to inspect hour in Overview
              </span>
            </div>

            {impactedSteps.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                No stressed or vulnerable hours detected under current settings. Activate a blackout, load surge, or price spike on the left to evaluate backup stability.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="py-2 px-3.5">Time</th>
                      <th className="py-2 px-3">Active Conditions</th>
                      <th className="py-2 px-3 text-right">Load (kW)</th>
                      <th className="py-2 px-3 text-right">Batt Disch</th>
                      <th className="py-2 px-3 text-right">SOC</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3.5 text-right">Unserved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {impactedSteps.map((st) => {
                      const tags: string[] = [];
                      if (!st.gridOnline) tags.push('Blackout');
                      if (st.activeEvents.includes('LOAD_SURGE')) tags.push('Load Surge');
                      if (st.activeEvents.includes('PRICE_SPIKE')) tags.push('Price Spike');
                      if (st.activeEvents.includes('MONSOON_SQUALL')) tags.push('Squall');
                      if (st.gridCapBreachKw > 0.01) tags.push('Cap Breach');
                      if (st.batterySocPct <= config.batteryMinReserveSocPct + 0.5) {
                        tags.push('At Reserve');
                      }
                      return (
                        <tr
                          key={st.hour}
                          onClick={() => {
                            setSelectedHour(st.hour);
                            setWorkspaceMode('sandbox');
                          }}
                          className={`h-9 cursor-pointer transition-colors ${
                            st.unservedLoadKw > 0.01
                              ? 'bg-rose-50/50 hover:bg-rose-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3.5 font-mono tabular-nums font-medium text-slate-800 whitespace-nowrap">
                            {st.clockLabel}
                          </td>
                          <td className="px-3 text-[11px] text-slate-600">
                            {tags.join(' · ') || 'Stressed'}
                          </td>
                          <td className="px-3 text-right font-mono tabular-nums text-slate-800">
                            {st.householdLoadKw.toFixed(2)}
                          </td>
                          <td className="px-3 text-right font-mono tabular-nums text-sky-700">
                            {st.batteryDischargeKw.toFixed(2)} kW
                          </td>
                          <td
                            className={`px-3 text-right font-mono tabular-nums font-semibold ${
                              st.batterySocPct <= config.batteryMinReserveSocPct + 0.5
                                ? 'text-rose-600'
                                : 'text-slate-800'
                            }`}
                          >
                            {st.batterySocPct.toFixed(1)}%
                          </td>
                          <td className="px-3 text-right font-mono tabular-nums text-slate-700">
                            {currencyMeta.symbol}
                            {st.importRate.toFixed(2)}
                          </td>
                          <td
                            className={`px-3.5 text-right font-mono tabular-nums font-semibold ${
                              st.unservedLoadKw > 0.01 ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {st.unservedLoadKw > 0.01 ? `${st.unservedLoadKw.toFixed(2)} kW` : '0.00'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
