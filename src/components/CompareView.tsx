import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeftRight, Play, Save } from 'lucide-react';
import type { SimulationConfig } from '../types/simulation';
import { formatMoney } from '../engine/currencies';
import { solveSimulation } from '../engine/dispatchEngine';
import { createDefaultConfig, STRESS_SCENARIOS } from '../engine/presets';
import { useSimulationStore } from '../store/useSimulationStore';

type OptionGroup = 'active' | 'saved' | 'profiles' | 'reference';
type OverlayFilter = 'all' | 'power' | 'storage' | 'economics';

interface CompareOption {
  id: string;
  label: string;
  shortName: string;
  group: OptionGroup;
  config: SimulationConfig;
}

function summarizeConfigLine(cfg: SimulationConfig): string {
  const mode = cfg.plugModules?.gridEnabled === false ? 'Off-Grid' : 'Hybrid';
  const panel = cfg.solarPanelSnapshot?.wattageWp
    ? `${cfg.solarPanelSnapshot.wattageWp}Wp`
    : 'Std PV';
  return `${cfg.pvCapacityKw} kWp · ${cfg.batteryCapacityKwh} kWh · ${cfg.horizonHours}h · ${mode} · ${panel}`;
}

export const CompareView: React.FC = () => {
  const {
    config,
    activeSavedName,
    savedSimulations,
    scenarioProfiles,
    compareAId,
    compareBId,
    setCompareAId,
    setCompareBId,
    loadConfigToSandbox,
    openSaveModal,
  } = useSimulationStore();

  const [overlayFilter, setOverlayFilter] = useState<OverlayFilter>('all');
  const [showLoadCurves, setShowLoadCurves] = useState(true);

  const options = useMemo<CompareOption[]>(() => {
    const list: CompareOption[] = [
      {
        id: '__active__',
        label: `Active Sandbox (${activeSavedName})`,
        shortName: activeSavedName,
        group: 'active',
        config,
      },
    ];

    for (const saved of savedSimulations) {
      list.push({
        id: saved.id,
        label: `${saved.name} (${saved.horizonHours}h)`,
        shortName: saved.name,
        group: 'saved',
        config: saved.config,
      });
    }

    for (const prof of scenarioProfiles) {
      list.push({
        id: `profile:${prof.id}`,
        label: `${prof.name} (${prof.config.horizonHours}h)`,
        shortName: prof.name,
        group: 'profiles',
        config: prof.config,
      });
    }

    const base = createDefaultConfig(config.currency);
    for (const sc of STRESS_SCENARIOS) {
      list.push({
        id: `__baseline_${sc.id}__`,
        label: `${sc.title} (${sc.horizonTag})`,
        shortName: sc.title,
        group: 'reference',
        config: sc.apply(base),
      });
    }

    return list;
  }, [config, activeSavedName, savedSimulations, scenarioProfiles]);

  const optA = options.find((o) => o.id === compareAId) || options[0];
  const optB =
    options.find((o) => o.id === compareBId) ||
    options.find((o) => o.id === '__baseline_summer_peak__') ||
    options[1] ||
    options[0];

  const resA = useMemo(() => solveSimulation(optA.config), [optA]);
  const resB = useMemo(() => solveSimulation(optB.config), [optB]);

  const displayCurrency = config.currency;
  const maxLen = Math.max(resA.steps.length, resB.steps.length);

  const overlayData = useMemo(() => {
    const out = [];
    for (let i = 0; i < maxLen; i++) {
      const a = resA.steps[i];
      const b = resB.steps[i];
      out.push({
        label: a?.shortLabel ?? b?.shortLabel ?? `${i}h`,
        pvA: a ? Number(a.pvAvailableKw.toFixed(2)) : null,
        pvB: b ? Number(b.pvAvailableKw.toFixed(2)) : null,
        loadA: a ? Number(a.householdLoadKw.toFixed(2)) : null,
        loadB: b ? Number(b.householdLoadKw.toFixed(2)) : null,
        savedToBattA: a ? Number(a.pvToBatteryKw.toFixed(2)) : null,
        savedToBattB: b ? Number(b.pvToBatteryKw.toFixed(2)) : null,
        battDischargeA: a ? Number(a.batteryDischargeKw.toFixed(2)) : null,
        battDischargeB: b ? Number(b.batteryDischargeKw.toFixed(2)) : null,
        importA: a ? Number(a.gridImportKw.toFixed(2)) : null,
        importB: b ? Number(b.gridImportKw.toFixed(2)) : null,
        socA: a ? Number(a.batterySocPct.toFixed(1)) : null,
        socB: b ? Number(b.batterySocPct.toFixed(1)) : null,
        tempA: a ? Number(a.batteryCellTempC.toFixed(1)) : null,
        tempB: b ? Number(b.batteryCellTempC.toFixed(1)) : null,
        costA: a ? Number(a.cumulativeNetCost.toFixed(2)) : null,
        costB: b ? Number(b.cumulativeNetCost.toFixed(2)) : null,
      });
    }
    return out;
  }, [resA, resB, maxLen]);

  const longevityOverlay = useMemo(() => {
    const len = Math.max(resA.longevityCurve.length, resB.longevityCurve.length);
    const out = [];
    for (let i = 0; i < len; i++) {
      const a = resA.longevityCurve[i];
      const b = resB.longevityCurve[i];
      out.push({
        yearLabel: a?.yearLabel ?? b?.yearLabel ?? `Yr ${i}`,
        sohA: a ? Number(a.stressedSohPct.toFixed(1)) : null,
        sohB: b ? Number(b.stressedSohPct.toFixed(1)) : null,
      });
    }
    return out;
  }, [resA.longevityCurve, resB.longevityCurve]);

  const sA = resA.summary;
  const sB = resB.summary;

  interface MetricRow {
    label: string;
    valA: string;
    valB: string;
    delta: number;
    deltaText: string;
    lowerIsBetter?: boolean;
  }

  const rows: MetricRow[] = [
    {
      label: 'PV Generation Yield',
      valA: `${sA.totalPvYieldKwh.toFixed(1)} kWh`,
      valB: `${sB.totalPvYieldKwh.toFixed(1)} kWh`,
      delta: sA.totalPvYieldKwh - sB.totalPvYieldKwh,
      deltaText: `${sA.totalPvYieldKwh - sB.totalPvYieldKwh >= 0 ? '+' : ''}${(sA.totalPvYieldKwh - sB.totalPvYieldKwh).toFixed(1)} kWh`,
    },
    {
      label: 'Solar Energy Saved to Battery',
      valA: `${sA.totalPvToBatteryKwh.toFixed(1)} kWh`,
      valB: `${sB.totalPvToBatteryKwh.toFixed(1)} kWh`,
      delta: sA.totalPvToBatteryKwh - sB.totalPvToBatteryKwh,
      deltaText: `${sA.totalPvToBatteryKwh - sB.totalPvToBatteryKwh >= 0 ? '+' : ''}${(sA.totalPvToBatteryKwh - sB.totalPvToBatteryKwh).toFixed(1)} kWh`,
    },
    {
      label: 'Self-Consumption Rate',
      valA: `${sA.selfConsumptionPct.toFixed(1)}%`,
      valB: `${sB.selfConsumptionPct.toFixed(1)}%`,
      delta: sA.selfConsumptionPct - sB.selfConsumptionPct,
      deltaText: `${sA.selfConsumptionPct - sB.selfConsumptionPct >= 0 ? '+' : ''}${(sA.selfConsumptionPct - sB.selfConsumptionPct).toFixed(1)} pp`,
    },
    {
      label: 'Grid Independence',
      valA: `${sA.gridIndependencePct.toFixed(1)}%`,
      valB: `${sB.gridIndependencePct.toFixed(1)}%`,
      delta: sA.gridIndependencePct - sB.gridIndependencePct,
      deltaText: `${sA.gridIndependencePct - sB.gridIndependencePct >= 0 ? '+' : ''}${(sA.gridIndependencePct - sB.gridIndependencePct).toFixed(1)} pp`,
    },
    {
      label: 'Peak Grid Import vs. Permitted Cap',
      valA: `${sA.peakGridImportKw.toFixed(2)} / ${sA.permittedGridPeakKw.toFixed(1)} kW`,
      valB: `${sB.peakGridImportKw.toFixed(2)} / ${sB.permittedGridPeakKw.toFixed(1)} kW`,
      delta: sA.peakGridImportKw - sB.peakGridImportKw,
      deltaText: `${sA.peakGridImportKw - sB.peakGridImportKw >= 0 ? '+' : ''}${(sA.peakGridImportKw - sB.peakGridImportKw).toFixed(2)} kW`,
      lowerIsBetter: true,
    },
    {
      label: 'Curtailed PV Energy',
      valA: `${sA.totalCurtailedPvKwh.toFixed(2)} kWh`,
      valB: `${sB.totalCurtailedPvKwh.toFixed(2)} kWh`,
      delta: sA.totalCurtailedPvKwh - sB.totalCurtailedPvKwh,
      deltaText: `${sA.totalCurtailedPvKwh - sB.totalCurtailedPvKwh >= 0 ? '+' : ''}${(sA.totalCurtailedPvKwh - sB.totalCurtailedPvKwh).toFixed(2)} kWh`,
      lowerIsBetter: true,
    },
    {
      label: 'Unserved / Shed Load',
      valA: `${sA.totalUnservedLoadKwh.toFixed(2)} kWh`,
      valB: `${sB.totalUnservedLoadKwh.toFixed(2)} kWh`,
      delta: sA.totalUnservedLoadKwh - sB.totalUnservedLoadKwh,
      deltaText: `${sA.totalUnservedLoadKwh - sB.totalUnservedLoadKwh >= 0 ? '+' : ''}${(sA.totalUnservedLoadKwh - sB.totalUnservedLoadKwh).toFixed(2)} kWh`,
      lowerIsBetter: true,
    },
    {
      label: 'Minimum Battery SOC',
      valA: `${sA.minBatterySocPct.toFixed(1)}%`,
      valB: `${sB.minBatterySocPct.toFixed(1)}%`,
      delta: sA.minBatterySocPct - sB.minBatterySocPct,
      deltaText: `${sA.minBatterySocPct - sB.minBatterySocPct >= 0 ? '+' : ''}${(sA.minBatterySocPct - sB.minBatterySocPct).toFixed(1)} pp`,
    },
    {
      label: 'Projected Battery Lifespan (80% SoH)',
      valA: `${sA.projectedLifespanYears.toFixed(1)} yrs`,
      valB: `${sB.projectedLifespanYears.toFixed(1)} yrs`,
      delta: sA.projectedLifespanYears - sB.projectedLifespanYears,
      deltaText: `${sA.projectedLifespanYears - sB.projectedLifespanYears >= 0 ? '+' : ''}${(sA.projectedLifespanYears - sB.projectedLifespanYears).toFixed(1)} yrs`,
    },
    {
      label: 'Peak Battery Cell Temperature',
      valA: `${sA.peakBatteryCellTempC.toFixed(1)}°C`,
      valB: `${sB.peakBatteryCellTempC.toFixed(1)}°C`,
      delta: sA.peakBatteryCellTempC - sB.peakBatteryCellTempC,
      deltaText: `${sA.peakBatteryCellTempC - sB.peakBatteryCellTempC >= 0 ? '+' : ''}${(sA.peakBatteryCellTempC - sB.peakBatteryCellTempC).toFixed(1)}°C`,
      lowerIsBetter: true,
    },
    {
      label: 'Outage Autonomy Survived',
      valA:
        sA.outageHoursTotal > 0
          ? `${sA.outageHoursSurvived} / ${sA.outageHoursTotal} hrs`
          : 'No outages',
      valB:
        sB.outageHoursTotal > 0
          ? `${sB.outageHoursSurvived} / ${sB.outageHoursTotal} hrs`
          : 'No outages',
      delta: sA.outageHoursSurvived - sB.outageHoursSurvived,
      deltaText: `${sA.outageHoursSurvived - sB.outageHoursSurvived >= 0 ? '+' : ''}${sA.outageHoursSurvived - sB.outageHoursSurvived} hrs`,
    },
    {
      label: 'Net Energy Cost',
      valA: formatMoney(sA.netEnergyCost, displayCurrency),
      valB: formatMoney(sB.netEnergyCost, displayCurrency),
      delta: sA.netEnergyCost - sB.netEnergyCost,
      deltaText: formatMoney(sA.netEnergyCost - sB.netEnergyCost, displayCurrency, {
        signed: true,
      }),
      lowerIsBetter: true,
    },
  ];

  const groupedOptions = useMemo(
    () => ({
      active: options.filter((o) => o.group === 'active'),
      saved: options.filter((o) => o.group === 'saved'),
      profiles: options.filter((o) => o.group === 'profiles'),
      reference: options.filter((o) => o.group === 'reference'),
    }),
    [options]
  );

  const renderSelectOptions = () => (
    <>
      <optgroup label="Active Workspace">
        {groupedOptions.active.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </optgroup>
      {groupedOptions.saved.length > 0 && (
        <optgroup label="Saved Simulation Runs">
          {groupedOptions.saved.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
      {groupedOptions.profiles.length > 0 && (
        <optgroup label="Saved Scenario Profiles">
          {groupedOptions.profiles.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Built-In Reference Scenarios">
        {groupedOptions.reference.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </>
  );

  const tooltipStyle = {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderRadius: '8px',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono',
    color: '#F8FAFC',
  };

  const headlineCards = [
    {
      label: 'PV Generation Yield',
      valA: `${sA.totalPvYieldKwh.toFixed(1)} kWh`,
      valB: `${sB.totalPvYieldKwh.toFixed(1)} kWh`,
      delta: sA.totalPvYieldKwh - sB.totalPvYieldKwh,
      deltaText: `${sA.totalPvYieldKwh - sB.totalPvYieldKwh >= 0 ? '+' : ''}${(sA.totalPvYieldKwh - sB.totalPvYieldKwh).toFixed(1)} kWh`,
      lowerIsBetter: false,
    },
    {
      label: 'Grid Independence',
      valA: `${sA.gridIndependencePct.toFixed(1)}%`,
      valB: `${sB.gridIndependencePct.toFixed(1)}%`,
      delta: sA.gridIndependencePct - sB.gridIndependencePct,
      deltaText: `${sA.gridIndependencePct - sB.gridIndependencePct >= 0 ? '+' : ''}${(sA.gridIndependencePct - sB.gridIndependencePct).toFixed(1)} pp`,
      lowerIsBetter: false,
    },
    {
      label: 'Net Energy Cost',
      valA: formatMoney(sA.netEnergyCost, displayCurrency),
      valB: formatMoney(sB.netEnergyCost, displayCurrency),
      delta: sA.netEnergyCost - sB.netEnergyCost,
      deltaText: formatMoney(sA.netEnergyCost - sB.netEnergyCost, displayCurrency, {
        signed: true,
      }),
      lowerIsBetter: true,
    },
    {
      label: 'Battery Lifespan (80% SoH)',
      valA: `${sA.projectedLifespanYears.toFixed(1)} yrs`,
      valB: `${sB.projectedLifespanYears.toFixed(1)} yrs`,
      delta: sA.projectedLifespanYears - sB.projectedLifespanYears,
      deltaText: `${sA.projectedLifespanYears - sB.projectedLifespanYears >= 0 ? '+' : ''}${(sA.projectedLifespanYears - sB.projectedLifespanYears).toFixed(1)} yrs`,
      lowerIsBetter: false,
    },
  ];

  const showPowerCharts = overlayFilter === 'all' || overlayFilter === 'power';
  const showStorageCharts = overlayFilter === 'all' || overlayFilter === 'storage';
  const showEconCharts = overlayFilter === 'all' || overlayFilter === 'economics';

  return (
    <div className="space-y-4">
      {/* Run A vs Run B Selector & Configuration Context */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Side-by-Side Comparison Mode
            </h2>
            <p className="text-xs text-slate-500">
              Overlay two simulation runs, saved profiles, or seasonal baselines using the live dispatch and longevity engine.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCompareAId('__baseline_summer_peak__');
                setCompareBId('__baseline_winter_low_irradiation__');
              }}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors"
            >
              Summer Peak vs. Winter Low Irrad.
            </button>

            {savedSimulations.length === 0 && (
              <button
                type="button"
                onClick={() => openSaveModal('save')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Current Run
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-start">
          {/* Run A Selector */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="compare-run-a" className="text-xs font-semibold text-blue-700">
                Run A · Primary Solid Series
              </label>
              {optA.id !== '__active__' && (
                <button
                  type="button"
                  onClick={() => loadConfigToSandbox(optA.config, optA.shortName)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap"
                >
                  <Play className="w-3 h-3" />
                  Load in Sandbox
                </button>
              )}
            </div>
            <select
              id="compare-run-a"
              value={optA.id}
              onChange={(e) => setCompareAId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
            >
              {renderSelectOptions()}
            </select>
            <div className="font-mono tabular-nums text-[11px] text-slate-500 truncate">
              {summarizeConfigLine(optA.config)}
            </div>
          </div>

          {/* Swap Button */}
          <div className="md:col-span-1 flex justify-center md:pt-6">
            <button
              type="button"
              onClick={() => {
                setCompareAId(optB.id);
                setCompareBId(optA.id);
              }}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Swap Run A and Run B"
              aria-label="Swap Run A and Run B"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Run B Selector */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="compare-run-b" className="text-xs font-semibold text-amber-700">
                Run B · Comparison Dashed Series
              </label>
              {optB.id !== '__active__' && (
                <button
                  type="button"
                  onClick={() => loadConfigToSandbox(optB.config, optB.shortName)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap"
                >
                  <Play className="w-3 h-3" />
                  Load in Sandbox
                </button>
              )}
            </div>
            <select
              id="compare-run-b"
              value={optB.id}
              onChange={(e) => setCompareBId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-600"
            >
              {renderSelectOptions()}
            </select>
            <div className="font-mono tabular-nums text-[11px] text-slate-500 truncate">
              {summarizeConfigLine(optB.config)}
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Comparative KPI Summary Strip (Single Elevation, Hairline Dividers) */}
      <section className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        {headlineCards.map((kpi) => {
          const isZero = Math.abs(kpi.delta) < 0.01;
          const isBetter = kpi.lowerIsBetter ? kpi.delta < -0.01 : kpi.delta > 0.01;
          const deltaTone = isZero
            ? 'text-slate-500'
            : isBetter
              ? 'text-emerald-700'
              : 'text-rose-600';
          return (
            <div key={kpi.label} className="p-4 space-y-1.5">
              <div className="text-[11px] font-medium text-slate-500">{kpi.label}</div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono tabular-nums text-base font-bold text-slate-900">
                  {kpi.valA}
                </span>
                <span className={`font-mono tabular-nums text-xs font-semibold ${deltaTone}`}>
                  {isZero ? 'No diff' : `${kpi.deltaText} vs B`}
                </span>
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                Run B: {kpi.valB}
              </div>
            </div>
          );
        })}
      </section>

      {/* Graphical Overlay Filter & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Comparison chart categories"
          className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg text-xs"
        >
          {(
            [
              { id: 'all', label: 'All Overlays' },
              { id: 'power', label: 'Solar & Load' },
              { id: 'storage', label: 'Battery & Longevity' },
              { id: 'economics', label: 'Grid & Cost' },
            ] as Array<{ id: OverlayFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={overlayFilter === tab.id}
              onClick={() => setOverlayFilter(tab.id)}
              className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                overlayFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          {showPowerCharts && (
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showLoadCurves}
                onChange={(e) => setShowLoadCurves(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span>Show Load Demand Curves</span>
            </label>
          )}
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold">
              <span className="w-4 h-0.5 bg-blue-600 inline-block" />
              A: {optA.shortName}
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
              <span className="w-4 border-t-2 border-dashed border-amber-600 inline-block" />
              B: {optB.shortName}
            </span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Graphical Overlay Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Solar PV Generation & Household Load Overlay */}
        {showPowerCharts && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-semibold text-slate-900">
                Solar PV Generation {showLoadCurves ? '& Household Load' : ''} Overlay (kW)
              </h3>
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                A: {sA.totalPvYieldKwh.toFixed(1)} kWh · B: {sB.totalPvYieldKwh.toFixed(1)} kWh
              </span>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={overlayData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    interval={maxLen > 24 ? 11 : 3}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit=" kW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    dataKey="pvA"
                    name={`PV · A (${optA.shortName})`}
                    stroke="#2563EB"
                    fill="#2563EB"
                    fillOpacity={0.12}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pvB"
                    name={`PV · B (${optB.shortName})`}
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                  {showLoadCurves && (
                    <Line
                      type="monotone"
                      dataKey="loadA"
                      name="Load · A"
                      stroke="#0F172A"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      dot={false}
                    />
                  )}
                  {showLoadCurves && (
                    <Line
                      type="monotone"
                      dataKey="loadB"
                      name="Load · B"
                      stroke="#94A3B8"
                      strokeWidth={1.5}
                      strokeDasharray="2 3"
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 2. Solar Saved to Battery (Charging Power) Overlay */}
        {showPowerCharts && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-semibold text-slate-900">
                Solar Saved to Battery Overlay (kW)
              </h3>
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                A: {sA.totalPvToBatteryKwh.toFixed(1)} kWh · B: {sB.totalPvToBatteryKwh.toFixed(1)} kWh
              </span>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={overlayData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    interval={maxLen > 24 ? 11 : 3}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit=" kW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    dataKey="savedToBattA"
                    name={`Saved to Batt · A`}
                    stroke="#2563EB"
                    fill="#2563EB"
                    fillOpacity={0.14}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="savedToBattB"
                    name={`Saved to Batt · B`}
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 3. Battery SOC Trajectory Overlay */}
        {showStorageCharts && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-semibold text-slate-900">
                Battery State of Charge (SOC %) Trajectory
              </h3>
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                Min SOC · A: {sA.minBatterySocPct.toFixed(0)}% · B: {sB.minBatterySocPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overlayData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    interval={maxLen > 24 ? 11 : 3}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <ReferenceLine
                    y={optA.config.batteryMinReserveSocPct}
                    stroke="#94A3B8"
                    strokeDasharray="3 3"
                  />
                  <Line
                    type="monotone"
                    dataKey="socA"
                    name={`SOC · A (${optA.shortName})`}
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="socB"
                    name={`SOC · B (${optB.shortName})`}
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 4. 10-Year Battery SoH Longevity Overlay */}
        {showStorageCharts && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-semibold text-slate-900">
                10-Year Battery State-of-Health (SoH %) Overlay
              </h3>
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                80% EoL · A: {sA.projectedLifespanYears.toFixed(1)}y · B:{' '}
                {sB.projectedLifespanYears.toFixed(1)}y
              </span>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={longevityOverlay} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="yearLabel" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis domain={[65, 100]} tick={{ fontSize: 10, fill: '#64748B' }} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <ReferenceLine y={80} stroke="#DC2626" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="sohA"
                    name={`SoH · A (${optA.shortName})`}
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sohB"
                    name={`SoH · B (${optB.shortName})`}
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 5. Grid Import & Permitted Peak Cap Overlay */}
        {showEconCharts && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-semibold text-slate-900">
                Grid Import & Permitted Peak Cap Overlay (kW)
              </h3>
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                Peak · A: {sA.peakGridImportKw.toFixed(2)} kW · B: {sB.peakGridImportKw.toFixed(2)} kW
              </span>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overlayData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    interval={maxLen > 24 ? 11 : 3}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit=" kW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <ReferenceLine
                    y={optA.config.permittedGridPeakKw}
                    stroke="#DC2626"
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="importA"
                    name={`Grid Import · A`}
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="importB"
                    name={`Grid Import · B`}
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 6. Cumulative Net Energy Cost Overlay */}
        {showEconCharts && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-semibold text-slate-900">
                Cumulative Net Energy Cost ({displayCurrency})
              </h3>
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                A: {formatMoney(sA.netEnergyCost, displayCurrency)} · B:{' '}
                {formatMoney(sB.netEnergyCost, displayCurrency)}
              </span>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overlayData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    interval={maxLen > 24 ? 11 : 3}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v, name) => [
                      formatMoney(Number(v ?? 0), displayCurrency, { exactDecimals: 2 }),
                      String(name ?? ''),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <ReferenceLine y={0} stroke="#CBD5E1" />
                  <Line
                    type="monotone"
                    dataKey="costA"
                    name={`Net Cost · A`}
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="costB"
                    name={`Net Cost · B`}
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Structured Side-by-Side Performance Delta Matrix */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Side-by-Side Performance Delta Matrix
          </h3>
          <span className="text-xs text-slate-500">
            Delta reflects Run A minus Run B
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="py-2.5 px-4">Engineering Metric</th>
                <th className="py-2.5 px-4 text-right text-blue-700">
                  Run A ({optA.shortName})
                </th>
                <th className="py-2.5 px-4 text-right text-amber-700">
                  Run B ({optB.shortName})
                </th>
                <th className="py-2.5 px-4 text-right">Delta (A − B)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {rows.map((r) => {
                const isZero = Math.abs(r.delta) < 0.01;
                const isBetter = r.lowerIsBetter ? r.delta < -0.01 : r.delta > 0.01;
                const deltaColor = isZero
                  ? 'text-slate-400'
                  : isBetter
                    ? 'text-emerald-700 font-semibold'
                    : 'text-rose-600 font-semibold';
                return (
                  <tr key={r.label} className="h-10 hover:bg-slate-50/70">
                    <td className="px-4 font-medium text-slate-800">{r.label}</td>
                    <td className="px-4 text-right font-mono tabular-nums text-slate-900">
                      {r.valA}
                    </td>
                    <td className="px-4 text-right font-mono tabular-nums text-slate-700">
                      {r.valB}
                    </td>
                    <td className={`px-4 text-right font-mono tabular-nums ${deltaColor}`}>
                      {isZero ? '0.0' : r.deltaText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
