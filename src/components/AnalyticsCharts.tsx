import React, { useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, HeartPulse, ShieldAlert } from 'lucide-react';
import type { SimulationConfig, SimulationResult } from '../types/simulation';
import { CURRENCIES, formatMoney } from '../engine/currencies';
import { useSimulationStore } from '../store/useSimulationStore';

interface AnalyticsChartsProps {
  result: SimulationResult;
  config: SimulationConfig;
}

type AnalyticsTabId = 'power' | 'longevity' | 'soc' | 'billing' | 'all';

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  result,
  config,
}) => {
  const { selectedHour, setSelectedHour, setIsPlaying } = useSimulationStore();
  const [activeChartTab, setActiveChartTab] = useState<AnalyticsTabId>('power');
  const { steps, summary, longevityCurve } = result;
  const currencyMeta = CURRENCIES[config.currency] || CURRENCIES.BDT;

  const selectedShortLabel = steps[selectedHour]?.shortLabel ?? steps[0]?.shortLabel;

  // Build contiguous outage bands for Recharts ReferenceArea
  const outageSpans: Array<{ x1: string; x2: string }> = [];
  let spanStart: string | null = null;
  let lastLabel = '';
  for (const s of steps) {
    if (!s.gridOnline) {
      if (spanStart === null) spanStart = s.shortLabel;
      lastLabel = s.shortLabel;
    } else if (spanStart !== null) {
      outageSpans.push({ x1: spanStart, x2: lastLabel });
      spanStart = null;
    }
  }
  if (spanStart !== null) {
    outageSpans.push({ x1: spanStart, x2: lastLabel });
  }

  const chartData = steps.map((s) => ({
    ...s,
    gridExportNegative: s.gridExportKw > 0 ? -s.gridExportKw : 0,
    hourlyExportCreditNeg: s.hourlyExportCredit > 0 ? -s.hourlyExportCredit : 0,
  }));

  const handleChartClick = (state: { activeTooltipIndex?: number | string | null }) => {
    const idx = Number(state?.activeTooltipIndex);
    if (!Number.isNaN(idx) && idx >= 0 && idx < steps.length) {
      setIsPlaying(false);
      setSelectedHour(idx);
    }
  };

  const hasFaults = summary.gridCapBreachHours > 0 || summary.totalUnservedLoadKwh > 0.05;
  const batteryActive = config.plugModules.batteryEnabled && config.batteryCapacityKwh > 0;

  const longevityTone =
    summary.longevityRating === 'Optimal'
      ? 'text-emerald-700'
      : summary.longevityRating === 'Moderate Wear'
        ? 'text-amber-700'
        : 'text-rose-700';

  const activeExtremeLabels = [
    config.stressTests.cloudyStreak.enabled && 'Cloudy Streak',
    config.stressTests.heatwaveSpike.enabled &&
      `Heatwave (${config.stressTests.heatwaveSpike.peakTempC}°C)`,
    config.stressTests.monsoonSquall.enabled && 'Monsoon Squall',
    config.stressTests.coldSnap.enabled &&
      `Cold Snap (${config.stressTests.coldSnap.minTempC}°C)`,
  ].filter(Boolean) as string[];

  const isOffGrid = !config.plugModules.gridEnabled;
  const offGridAutonomyPct =
    summary.totalLoadKwh > 0.01
      ? Math.min(100, (summary.totalServedLoadKwh / summary.totalLoadKwh) * 100)
      : 100;

  const chartTabs: Array<{ id: AnalyticsTabId; label: string; count?: number }> = [
    { id: 'power', label: 'Generation & Battery' },
    { id: 'longevity', label: 'Battery Longevity', count: activeExtremeLabels.length },
    { id: 'soc', label: 'SOC & Curtailment' },
    { id: 'billing', label: 'ToU Billing' },
    { id: 'all', label: 'All' },
  ];

  const showPower = activeChartTab === 'power' || activeChartTab === 'all';
  const showLongevity = activeChartTab === 'longevity' || activeChartTab === 'all';
  const showSoc = activeChartTab === 'soc' || activeChartTab === 'all';
  const showBilling = activeChartTab === 'billing' || activeChartTab === 'all';

  return (
    <div className="space-y-3.5">
      {/* Inline Fault & Breach Diagnostics Banner */}
      {hasFaults ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/75 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-950 space-y-0.5">
              <div className="font-semibold">
                {isOffGrid
                  ? 'Off-Grid Battery Depletion / Unserved Load Detected'
                  : 'Hybrid Grid Limit or Autonomy Breach Detected'}
              </div>
              <div className="text-rose-800">
                {summary.gridCapBreachHours > 0 && (
                  <span>
                    Permitted Grid Peak ({summary.permittedGridPeakKw.toFixed(1)} kW) exceeded
                    during <strong className="font-mono">{summary.gridCapBreachHours}h</strong>{' '}
                    (max overshoot{' '}
                    <strong className="font-mono">
                      +{summary.maxGridCapOvershootKw.toFixed(2)} kW
                    </strong>
                    ).{' '}
                  </span>
                )}
                {summary.totalUnservedLoadKwh > 0.05 && (
                  <span>
                    Total unserved load:{' '}
                    <strong className="font-mono">
                      {summary.totalUnservedLoadKwh.toFixed(2)} kWh
                    </strong>{' '}
                    ({offGridAutonomyPct.toFixed(1)}% demand covered).
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {summary.worstBreachHour !== null && (
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setSelectedHour(summary.worstBreachHour!);
                }}
                className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
              >
                Inspect Breach (Hr {summary.worstBreachHour})
              </button>
            )}
            {summary.worstUnservedHour !== null &&
              summary.worstUnservedHour !== summary.worstBreachHour && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setSelectedHour(summary.worstUnservedHour!);
                  }}
                  className="px-3 py-1.5 rounded-md bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 text-xs font-medium transition-colors whitespace-nowrap"
                >
                  Inspect Unserved (Hr {summary.worstUnservedHour})
                </button>
              )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              {isOffGrid
                ? `Off-Grid 100% Autonomous (${summary.horizonHours}h) · Saved ${summary.totalPvToBatteryKwh.toFixed(1)} kWh solar to battery (Min SOC ${summary.minBatterySocPct.toFixed(0)}%)`
                : `Hybrid Nominal (${summary.horizonHours}h) · Peak Grid ${summary.peakGridImportKw.toFixed(2)} / ${summary.permittedGridPeakKw.toFixed(1)} kW · Saved ${summary.totalPvToBatteryKwh.toFixed(1)} kWh to battery`}
            </span>
          </div>
          {summary.totalCurtailedPvKwh > 0.1 && (
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {summary.totalCurtailedPvKwh.toFixed(1)} kWh solar curtailed (battery full)
            </span>
          )}
        </div>
      )}

      {/* Full-Width Tabular KPI Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 overflow-hidden">
        <div className="px-3.5 py-3">
          <div className="text-[11px] font-medium text-slate-500">
            PV Generated ({summary.horizonHours}h)
          </div>
          <div className="mt-0.5 font-mono tabular-nums text-lg font-bold text-amber-700">
            {summary.totalPvYieldKwh.toFixed(1)}
            <span className="text-xs font-normal text-slate-500 ml-1">kWh</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            Direct {summary.totalPvDirectKwh.toFixed(1)} · Use {summary.selfConsumptionPct.toFixed(0)}%
          </div>
        </div>

        <div className="px-3.5 py-3">
          <div className="text-[11px] font-medium text-slate-500">Saved to Battery</div>
          <div className="mt-0.5 font-mono tabular-nums text-lg font-bold text-sky-700">
            {summary.totalPvToBatteryKwh.toFixed(1)}
            <span className="text-xs font-normal text-slate-500 ml-1">kWh</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            Disch {summary.totalBatteryDischargedKwh.toFixed(1)} · End {summary.endBatterySocPct.toFixed(0)}%
          </div>
        </div>

        <div className="px-3.5 py-3">
          <div className="text-[11px] font-medium text-slate-500">Household Consumed</div>
          <div className="mt-0.5 font-mono tabular-nums text-lg font-bold text-slate-900">
            {summary.totalLoadKwh.toFixed(1)}
            <span className="text-xs font-normal text-slate-500 ml-1">kWh</span>
          </div>
          <div
            className={`text-[11px] font-mono tabular-nums ${
              summary.totalUnservedLoadKwh > 0.05 ? 'text-rose-600 font-semibold' : 'text-emerald-700'
            }`}
          >
            {summary.totalUnservedLoadKwh > 0.05
              ? `Unserved ${summary.totalUnservedLoadKwh.toFixed(1)} kWh`
              : `100% Served · Min ${summary.minBatterySocPct.toFixed(0)}%`}
          </div>
        </div>

        <div className="px-3.5 py-3">
          <div className="text-[11px] font-medium text-slate-500">
            {isOffGrid ? 'Off-Grid Autonomy' : 'Grid Independence'}
          </div>
          <div
            className={`mt-0.5 font-mono tabular-nums text-lg font-bold ${
              isOffGrid
                ? offGridAutonomyPct < 99.5
                  ? 'text-rose-600'
                  : 'text-emerald-700'
                : 'text-emerald-700'
            }`}
          >
            {(isOffGrid ? offGridAutonomyPct : summary.gridIndependencePct).toFixed(1)}
            <span className="text-xs font-normal text-slate-500 ml-1">%</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            {isOffGrid
              ? `Curtailed ${summary.totalCurtailedPvKwh.toFixed(1)} kWh`
              : `Imp ${summary.totalGridImportKwh.toFixed(1)} · Exp ${summary.totalGridExportKwh.toFixed(1)}`}
          </div>
        </div>

        <div className="px-3.5 py-3 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-medium text-slate-500">
            {isOffGrid ? 'Battery Longevity' : 'Net Cost · Life'}
          </div>
          <div
            className={`mt-0.5 font-mono tabular-nums text-lg font-bold ${
              isOffGrid
                ? longevityTone
                : summary.netEnergyCost < 0
                  ? 'text-emerald-700'
                  : 'text-slate-900'
            }`}
          >
            {isOffGrid
              ? batteryActive
                ? `${summary.projectedLifespanYears.toFixed(1)} yrs`
                : '—'
              : formatMoney(summary.netEnergyCost, config.currency)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            {isOffGrid
              ? `${summary.annualizedFadePct.toFixed(1)}%/yr · ${summary.peakBatteryCellTempC.toFixed(0)}°C pk`
              : batteryActive
                ? `Life ${summary.projectedLifespanYears.toFixed(1)}y · Saved ${formatMoney(summary.estimatedSavings, config.currency)}`
                : `Saved ${formatMoney(summary.estimatedSavings, config.currency)}`}
          </div>
        </div>
      </div>

      {/* Tabbed Analytics Deck */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Hairline Underline Tabs */}
        <div className="px-4 border-b border-slate-200 flex items-center justify-between gap-3 overflow-x-auto">
          <nav className="flex items-center gap-5 shrink-0" aria-label="Analytics charts">
            {chartTabs.map((tab) => {
              const active = activeChartTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveChartTab(tab.id)}
                  className={`relative py-2.5 text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span
                      className={`font-mono tabular-nums text-[10px] ${
                        active ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    >
                      ({tab.count})
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                  )}
                </button>
              );
            })}
          </nav>

          <span className="hidden md:inline font-mono tabular-nums text-[11px] text-slate-400 whitespace-nowrap">
            Click chart to scrub Hr {selectedHour}
          </span>
        </div>

        {/* Active Chart Panels */}
        <div className="divide-y divide-slate-200">
          {/* Panel 1: Power Generation, Consumption & Saving to Battery */}
          {showPower && (
            <div className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Power Generation, Consumption & Saving to Battery ({isOffGrid ? 'Off-Grid' : 'Hybrid'})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isOffGrid
                      ? 'Islanded Off-Grid balance: solar generation directly powers load (amber) and banks surplus (blue) into battery storage.'
                      : `Grid-tied Hybrid balance: solar serves load (amber), saves surplus to battery (blue), exports excess (magenta), and respects utility cap (${config.permittedGridPeakKw.toFixed(1)} kW).`}
                  </p>
                </div>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  PV {summary.totalPvYieldKwh.toFixed(1)} · Saved {summary.totalPvToBatteryKwh.toFixed(1)} · Load {summary.totalLoadKwh.toFixed(1)} kWh
                </span>
              </div>

              <div className="h-[275px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    onClick={handleChartClick}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                      interval={config.horizonHours === 72 ? 5 : 2}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                      unit=" kW"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono',
                        color: '#F8FAFC',
                      }}
                      formatter={(value, name) => [
                        `${Math.abs(Number(value ?? 0)).toFixed(2)} kW`,
                        String(name ?? ''),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />

                    {!isOffGrid &&
                      outageSpans.map((span, idx) => (
                        <ReferenceArea
                          key={idx}
                          x1={span.x1}
                          x2={span.x2}
                          fill="#FEE2E2"
                          fillOpacity={0.55}
                        />
                      ))}

                    {!isOffGrid && (
                      <ReferenceLine
                        y={config.permittedGridPeakKw}
                        stroke="#DC2626"
                        strokeDasharray="5 4"
                        strokeWidth={1.5}
                      />
                    )}
                    <ReferenceLine
                      x={selectedShortLabel}
                      stroke="#0F172A"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                    />

                    <Bar dataKey="pvUsedDirectKw" name="PV Direct to Load" stackId="supply" fill="#F59E0B" />
                    <Bar dataKey="pvToBatteryKw" name="Saved to Battery (PV Charge)" stackId="supply" fill="#0284C7" />
                    <Bar dataKey="batteryDischargeKw" name="Battery Discharge" stackId="supply" fill="#16A34A" />
                    {!isOffGrid && (
                      <Bar dataKey="gridImportKw" name="Grid Import" stackId="supply" fill="#7C3AED" />
                    )}
                    <Bar dataKey="unservedLoadKw" name="Unserved Load" stackId="supply" fill="#DC2626" />
                    {!isOffGrid && (
                      <Bar
                        dataKey="gridExportNegative"
                        name="Net-Metering Export"
                        fill="#DB2777"
                        fillOpacity={0.85}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="householdLoadKw"
                      name="Consumption (Load)"
                      stroke="#0F172A"
                      strokeWidth={2.2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="pvAvailableKw"
                      name="PV Generation"
                      stroke="#EA580C"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Panel 2: Battery Storage Longevity & Extreme Weather Stress */}
          {showLongevity && (
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-slate-700" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Battery Storage Longevity & Extreme Weather Stress
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeExtremeLabels.length > 0
                      ? `Active stress tests: ${activeExtremeLabels.join(' · ')} — comparing 10-year SoH trajectory against 25°C nominal baseline.`
                      : 'No extreme weather stress tests active. Toggle Cloudy Streak, Heatwave Spike, Monsoon Squall, or Cold Snap in the Stress tab.'}
                  </p>
                </div>

                {batteryActive && (
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                    <div>
                      <span className="text-slate-500">Cycles/day: </span>
                      <strong className="text-slate-900">
                        {summary.equivalentFullCyclesPerDay.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Wear Mult: </span>
                      <strong className={longevityTone}>
                        {summary.avgThermalStressFactor.toFixed(2)}x
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Life Impact: </span>
                      <strong
                        className={
                          summary.lifespanDeltaYears < -0.1 ? 'text-rose-600' : 'text-emerald-700'
                        }
                      >
                        {summary.lifespanDeltaYears >= 0 ? '+' : ''}
                        {summary.lifespanDeltaYears.toFixed(1)} yrs
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-800">
                      10-Year Projected State of Health (SoH %)
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      EOL Threshold: 80% SoH
                    </span>
                  </div>
                  <div className="h-[225px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={longevityCurve}
                        margin={{ top: 6, right: 12, left: -14, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis
                          dataKey="yearLabel"
                          tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                        />
                        <YAxis
                          domain={[60, 100]}
                          tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontFamily: 'JetBrains Mono',
                            color: '#F8FAFC',
                          }}
                          formatter={(val, name) => [
                            `${Number(val ?? 0).toFixed(1)}% SoH`,
                            String(name ?? ''),
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                        <ReferenceLine
                          y={80}
                          stroke="#DC2626"
                          strokeDasharray="5 4"
                          label={{
                            value: '80% EOL',
                            position: 'insideBottomRight',
                            fill: '#DC2626',
                            fontSize: 10,
                            fontFamily: 'JetBrains Mono',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="baselineSohPct"
                          name="Nominal 25°C Baseline"
                          stroke="#16A34A"
                          strokeWidth={2}
                          strokeDasharray="5 3"
                          dot={{ r: 2.5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="stressedSohPct"
                          name="Active Weather Profile"
                          stroke="#DC2626"
                          strokeWidth={2.4}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Hourly Cell Temperature & Wear Stress Index
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Peak: {summary.peakBatteryCellTempC.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="h-[225px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartData}
                        onClick={handleChartClick}
                        margin={{ top: 6, right: 6, left: -14, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis
                          dataKey="shortLabel"
                          tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                          interval={config.horizonHours === 72 ? 8 : 3}
                        />
                        <YAxis
                          yAxisId="temp"
                          domain={['auto', 'auto']}
                          tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                          unit="°C"
                        />
                        <YAxis
                          yAxisId="stress"
                          orientation="right"
                          domain={[0, 100]}
                          tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontFamily: 'JetBrains Mono',
                            color: '#F8FAFC',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                        <ReferenceLine
                          yAxisId="temp"
                          y={35}
                          stroke="#D97706"
                          strokeDasharray="4 4"
                        />
                        <ReferenceLine
                          yAxisId="temp"
                          x={selectedShortLabel}
                          stroke="#0F172A"
                          strokeDasharray="2 2"
                        />
                        <Bar
                          yAxisId="stress"
                          dataKey="hourlyWearIndex"
                          name="Hourly Wear Index (0–100)"
                          fill="#F59E0B"
                          fillOpacity={0.5}
                          barSize={8}
                        />
                        <Line
                          yAxisId="temp"
                          type="monotone"
                          dataKey="batteryCellTempC"
                          name="Battery Cell Temp (°C)"
                          stroke="#DC2626"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          yAxisId="temp"
                          type="monotone"
                          dataKey="ambientTempC"
                          name="Ambient Temp (°C)"
                          stroke="#64748B"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panel 3: Battery SOC & Solar Curtailment */}
          {showSoc && (
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Battery SOC & Solar Curtailment
                  </h3>
                  <p className="text-xs text-slate-500">
                    SOC (%) against {config.batteryMinReserveSocPct}% reserve floor, curtailed PV & shed load.
                  </p>
                </div>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  Min SOC: {summary.minBatterySocPct.toFixed(0)}% · Curtailed: {summary.totalCurtailedPvKwh.toFixed(1)} kWh
                </span>
              </div>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    onClick={handleChartClick}
                    margin={{ top: 6, right: 6, left: -14, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                      interval={config.horizonHours === 72 ? 6 : 2}
                    />
                    <YAxis
                      yAxisId="soc"
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                      unit="%"
                    />
                    <YAxis
                      yAxisId="kw"
                      orientation="right"
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                      unit=" kW"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                        color: '#F8FAFC',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />

                    <ReferenceLine
                      yAxisId="soc"
                      y={config.batteryMinReserveSocPct}
                      stroke="#D97706"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      yAxisId="soc"
                      x={selectedShortLabel}
                      stroke="#0F172A"
                      strokeDasharray="2 2"
                    />

                    <Area
                      yAxisId="soc"
                      type="monotone"
                      dataKey="batterySocPct"
                      name="Battery SOC %"
                      stroke="#16A34A"
                      fill="#DCFCE7"
                      strokeWidth={2}
                    />
                    <Bar
                      yAxisId="kw"
                      dataKey="pvCurtailedKw"
                      name="Curtailed PV (kW)"
                      fill="#F59E0B"
                      barSize={10}
                    />
                    <Bar
                      yAxisId="kw"
                      dataKey="unservedLoadKw"
                      name="Unserved Load (kW)"
                      fill="#DC2626"
                      barSize={10}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Panel 4: ToU Tariff & Net Billing Impact */}
          {showBilling && (
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    ToU Tariff & Net Billing ({currencyMeta.code})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hourly import cost vs. net-metering export credit and cumulative bill.
                  </p>
                </div>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  Net: {formatMoney(summary.netEnergyCost, config.currency)}
                </span>
              </div>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    onClick={handleChartClick}
                    margin={{ top: 6, right: 6, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                      interval={config.horizonHours === 72 ? 6 : 2}
                    />
                    <YAxis
                      yAxisId="hr"
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                    />
                    <YAxis
                      yAxisId="cum"
                      orientation="right"
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                        color: '#F8FAFC',
                      }}
                      formatter={(val, name) => [
                        formatMoney(Number(val ?? 0), config.currency, { exactDecimals: 2 }),
                        String(name ?? ''),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />

                    <ReferenceLine yAxisId="hr" y={0} stroke="#CBD5E1" />
                    <ReferenceLine
                      yAxisId="hr"
                      x={selectedShortLabel}
                      stroke="#0F172A"
                      strokeDasharray="2 2"
                    />

                    <Bar
                      yAxisId="hr"
                      dataKey="hourlyImportCost"
                      name="Import Cost"
                      fill="#4F46E5"
                      barSize={10}
                    />
                    <Bar
                      yAxisId="hr"
                      dataKey="hourlyExportCreditNeg"
                      name="Export Credit"
                      fill="#16A34A"
                      barSize={10}
                    />
                    <Line
                      yAxisId="cum"
                      type="monotone"
                      dataKey="cumulativeNetCost"
                      name="Cumulative Net"
                      stroke="#0F172A"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
