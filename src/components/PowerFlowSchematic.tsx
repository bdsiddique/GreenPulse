import React, { useEffect } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  Flame,
  Home,
  Pause,
  Play,
  ShieldAlert,
  Sun,
  UtilityPole,
  Zap,
} from 'lucide-react';
import type { HourlyStepResult, SimulationConfig } from '../types/simulation';
import { formatMoney } from '../engine/currencies';
import { useSimulationStore } from '../store/useSimulationStore';

interface PowerFlowSchematicProps {
  steps: HourlyStepResult[];
  config: SimulationConfig;
}

function getStrokeWidth(kw: number): number {
  if (kw <= 0.02) return 1.5;
  return Math.min(6.5, 2.2 + kw * 0.45);
}

function getFlowDuration(kw: number): string {
  if (kw <= 0.02) return '0s';
  const sec = Math.max(0.45, Math.min(2.2, 2.0 - kw * 0.16));
  return `${sec.toFixed(2)}s`;
}

export const PowerFlowSchematic: React.FC<PowerFlowSchematicProps> = ({
  steps,
  config,
}) => {
  const {
    selectedHour,
    setSelectedHour,
    stepHour,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    setOperatingMode,
  } = useSimulationStore();

  const step = steps[Math.min(selectedHour, steps.length - 1)] || steps[0];

  useEffect(() => {
    if (!isPlaying) return;
    const ms = playbackSpeed === 4 ? 190 : playbackSpeed === 2 ? 380 : 760;
    const id = setInterval(() => {
      stepHour(1);
    }, ms);
    return () => clearInterval(id);
  }, [isPlaying, playbackSpeed, stepHour]);

  if (!step) return null;

  const pvPlugged = config.plugModules.pvEnabled;
  const battPlugged = config.plugModules.batteryEnabled && config.batteryCapacityKwh > 0;
  const gridPlugged = config.plugModules.gridEnabled;

  const pvTotalActive = step.pvUsedDirectKw + step.pvToBatteryKw + step.pvExportedKw;
  const isBattCharging = step.batteryChargeKw > 0.02;
  const isBattDischarging = step.batteryDischargeKw > 0.02;
  const battFlowKw = isBattCharging ? step.batteryChargeKw : step.batteryDischargeKw;

  const isGridImporting = step.gridImportKw > 0.02;
  const isGridExporting = step.gridExportKw > 0.02;
  const gridFlowKw = isGridImporting ? step.gridImportKw : step.gridExportKw;

  const servedLoadKw = Math.max(0, step.householdLoadKw - step.unservedLoadKw);
  const gridUtilizationPct =
    step.gridPeakCapKw > 0
      ? Math.min(100, Math.round((step.gridImportKw / step.gridPeakCapKw) * 100))
      : 0;

  const statusInfo = (() => {
    if (step.gridCapBreachKw > 0.01) {
      return {
        label: `Grid Cap Breached (+${step.gridCapBreachKw.toFixed(2)} kW)`,
        toneClass: 'text-rose-400',
        Icon: ShieldAlert,
      };
    }
    if (step.unservedLoadKw > 0.01) {
      return {
        label: `Unserved Load (${step.unservedLoadKw.toFixed(2)} kW Shed)`,
        toneClass: 'text-rose-400',
        Icon: AlertTriangle,
      };
    }
    if (!step.gridOnline) {
      return {
        label: step.outageLabel || 'Grid Offline · Island Mode',
        toneClass: 'text-amber-400',
        Icon: AlertTriangle,
      };
    }
    if (step.activeEvents.includes('HEATWAVE_SPIKE')) {
      return {
        label: `Heatwave Thermal Stress (${step.batteryCellTempC.toFixed(1)}°C Cell)`,
        toneClass: 'text-rose-400',
        Icon: Flame,
      };
    }
    if (step.activeEvents.includes('PEAK_SHAVING')) {
      return {
        label: 'Peak Shaving Active',
        toneClass: 'text-emerald-400',
        Icon: BatteryCharging,
      };
    }
    if (step.pvCurtailedKw > 0.05) {
      return {
        label: `PV Curtailed (${step.pvCurtailedKw.toFixed(2)} kW)`,
        toneClass: 'text-amber-400',
        Icon: Sun,
      };
    }
    return {
      label: 'Nominal Dispatch',
      toneClass: 'text-emerald-400',
      Icon: Zap,
    };
  })();

  const StatusIcon = statusInfo.Icon;

  return (
    <section className="rounded-xl border border-slate-800 bg-[#0F172A] text-slate-100 overflow-hidden">
      {/* Dark Telemetry Stage Header */}
      <div className="px-4 py-2.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-white whitespace-nowrap">
            Live Power-Flow
          </h2>

          {/* Live Hybrid vs Off-Grid Operating Mode Toggle */}
          <div
            role="group"
            aria-label="Operating mode"
            className="inline-flex items-center rounded-md bg-slate-900 border border-slate-700/90 p-0.5 text-[11px] font-semibold"
          >
            <button
              type="button"
              onClick={() => setOperatingMode('hybrid')}
              className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                gridPlugged
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hybrid
            </button>
            <button
              type="button"
              onClick={() => setOperatingMode('off_grid')}
              className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                !gridPlugged
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Off-Grid
            </button>
          </div>

          <span className="font-mono tabular-nums text-xs text-slate-300 whitespace-nowrap">
            {step.clockLabel}
          </span>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusInfo.toneClass}`}
          >
            <StatusIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{statusInfo.label}</span>
          </span>
        </div>

        <div className="flex items-center gap-3.5 text-xs font-mono tabular-nums text-slate-400">
          <span>
            Solar:{' '}
            <strong className="text-amber-400">{step.irradianceWm2} W/m²</strong>
          </span>
          <span className="hidden sm:inline">
            Temp: <strong className="text-slate-200">{step.ambientTempC.toFixed(1)}°C</strong>
          </span>
          {gridPlugged ? (
            <span className="hidden md:inline">
              Net:{' '}
              <strong
                className={
                  step.hourlyNetCost < 0
                    ? 'text-emerald-400'
                    : step.hourlyNetCost > 0
                      ? 'text-slate-100'
                      : 'text-slate-400'
                }
              >
                {formatMoney(step.hourlyNetCost, config.currency, {
                  signed: true,
                  exactDecimals: 2,
                })}
              </strong>
            </span>
          ) : (
            <span className="hidden md:inline text-amber-400 font-semibold">
              ISLANDED
            </span>
          )}
        </div>
      </div>

      {/* Interactive SVG Power-Flow Canvas */}
      <div className="relative px-3 pt-3 pb-2 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
        <svg
          viewBox="0 0 880 330"
          className="w-full h-auto max-h-[340px] block"
          role="img"
          aria-label={`Power flow diagram at ${step.clockLabel}`}
        >
          {/* Base static conduit tracks */}
          <g fill="none" stroke="#1E293B" strokeWidth="5" strokeLinecap="round">
            <path d="M 220 82 L 340 82 L 340 165 L 368 165" />
            <path d="M 512 165 L 540 165 L 540 82 L 660 82" />
            <path d="M 220 248 L 340 248 L 340 165 L 368 165" />
            <path d="M 512 165 L 540 165 L 540 248 L 660 248" />
          </g>

          {/* 1. PV -> Inverter */}
          <path
            d="M 220 82 L 340 82 L 340 165 L 368 165"
            fill="none"
            stroke={!pvPlugged ? '#1E293B' : pvTotalActive > 0.02 ? '#F59E0B' : '#334155'}
            strokeWidth={pvPlugged ? getStrokeWidth(pvTotalActive) : 1.5}
            strokeDasharray={
              !pvPlugged ? '3 6' : pvTotalActive > 0.02 ? '10 8' : undefined
            }
            strokeLinecap="round"
            className={pvPlugged && pvTotalActive > 0.02 ? 'animate-flow-forward' : undefined}
            style={{ ['--flow-duration' as string]: getFlowDuration(pvTotalActive) }}
          />

          {/* 2. Inverter -> Household */}
          <path
            d="M 512 165 L 540 165 L 540 82 L 660 82"
            fill="none"
            stroke={
              step.unservedLoadKw > 0.01
                ? '#EF4444'
                : servedLoadKw > 0.02
                  ? '#38BDF8'
                  : '#334155'
            }
            strokeWidth={getStrokeWidth(servedLoadKw)}
            strokeDasharray={servedLoadKw > 0.02 ? '10 8' : undefined}
            strokeLinecap="round"
            className={servedLoadKw > 0.02 ? 'animate-flow-forward' : undefined}
            style={{ ['--flow-duration' as string]: getFlowDuration(servedLoadKw) }}
          />

          {/* 3. Battery <-> Inverter */}
          <path
            d="M 220 248 L 340 248 L 340 165 L 368 165"
            fill="none"
            stroke={
              !battPlugged
                ? '#1E293B'
                : isBattCharging
                  ? '#22C55E'
                  : isBattDischarging
                    ? '#10B981'
                    : '#334155'
            }
            strokeWidth={battPlugged ? getStrokeWidth(battFlowKw) : 1.5}
            strokeDasharray={
              !battPlugged ? '3 6' : battFlowKw > 0.02 ? '10 8' : undefined
            }
            strokeLinecap="round"
            className={
              battPlugged && isBattCharging
                ? 'animate-flow-reverse'
                : battPlugged && isBattDischarging
                  ? 'animate-flow-forward'
                  : undefined
            }
            style={{ ['--flow-duration' as string]: getFlowDuration(battFlowKw) }}
          />

          {/* 4. Grid <-> Inverter */}
          <path
            d="M 512 165 L 540 165 L 540 248 L 660 248"
            fill="none"
            stroke={
              !gridPlugged
                ? '#1E293B'
                : !step.gridOnline
                  ? '#DC2626'
                  : step.gridCapBreachKw > 0.01
                    ? '#EF4444'
                    : isGridExporting
                      ? '#22C55E'
                      : isGridImporting
                        ? '#6366F1'
                        : '#334155'
            }
            strokeWidth={!gridPlugged || !step.gridOnline ? 2 : getStrokeWidth(gridFlowKw)}
            strokeDasharray={
              !gridPlugged || !step.gridOnline
                ? '4 6'
                : gridFlowKw > 0.02
                  ? '10 8'
                  : undefined
            }
            strokeLinecap="round"
            className={
              gridPlugged && isGridExporting
                ? 'animate-flow-forward'
                : gridPlugged && isGridImporting
                  ? 'animate-flow-reverse'
                  : undefined
            }
            style={{ ['--flow-duration' as string]: getFlowDuration(gridFlowKw) }}
          />

          {/* Flow Value Callouts */}
          <g transform="translate(280, 62)">
            <rect x="-44" y="-12" width="88" height="22" rx="4" fill="#0F172A" stroke="#334155" />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              className="font-mono text-[11px] font-semibold"
              fill={!pvPlugged ? '#64748B' : pvTotalActive > 0.02 ? '#FBBF24' : '#64748B'}
            >
              {!pvPlugged ? 'BYPASSED' : `${pvTotalActive.toFixed(2)} kW →`}
            </text>
          </g>

          <g transform="translate(600, 62)">
            <rect
              x="-44"
              y="-12"
              width="88"
              height="22"
              rx="4"
              fill="#0F172A"
              stroke={step.unservedLoadKw > 0.01 ? '#EF4444' : '#334155'}
            />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              className="font-mono text-[11px] font-semibold"
              fill={step.unservedLoadKw > 0.01 ? '#F87171' : '#7DD3FC'}
            >
              → {servedLoadKw.toFixed(2)} kW
            </text>
          </g>

          <g transform="translate(280, 268)">
            <rect x="-48" y="-12" width="96" height="22" rx="4" fill="#0F172A" stroke="#334155" />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              className="font-mono text-[11px] font-semibold"
              fill={
                !battPlugged
                  ? '#64748B'
                  : isBattCharging
                    ? '#4ADE80'
                    : isBattDischarging
                      ? '#34D399'
                      : '#64748B'
              }
            >
              {!battPlugged
                ? 'UNPLUGGED'
                : isBattCharging
                  ? `← CHG ${step.batteryChargeKw.toFixed(2)}`
                  : isBattDischarging
                    ? `DIS ${step.batteryDischargeKw.toFixed(2)} →`
                    : 'IDLE 0.00 kW'}
            </text>
          </g>

          <g transform="translate(600, 268)">
            <rect
              x="-52"
              y="-12"
              width="104"
              height="22"
              rx="4"
              fill="#0F172A"
              stroke={
                gridPlugged && (!step.gridOnline || step.gridCapBreachKw > 0.01)
                  ? '#EF4444'
                  : '#334155'
              }
            />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              className="font-mono text-[11px] font-semibold"
              fill={
                !gridPlugged
                  ? '#64748B'
                  : !step.gridOnline
                    ? '#F87171'
                    : isGridExporting
                      ? '#4ADE80'
                      : isGridImporting
                        ? '#A5B4FC'
                        : '#64748B'
              }
            >
              {!gridPlugged
                ? 'UNPLUGGED'
                : !step.gridOnline
                  ? 'GRID OFFLINE'
                  : isGridExporting
                    ? `EXP ${step.gridExportKw.toFixed(2)} →`
                    : isGridImporting
                      ? `← IMP ${step.gridImportKw.toFixed(2)}`
                      : '0.00 kW'}
            </text>
          </g>

          {/* NODE 1: SOLAR PV ARRAY */}
          <g transform="translate(20, 22)" opacity={pvPlugged ? 1 : 0.45}>
            <rect
              width="200"
              height="118"
              rx="8"
              fill="#1E293B"
              stroke={!pvPlugged ? '#475569' : pvTotalActive > 0.02 ? '#D97706' : '#334155'}
              strokeWidth="1.5"
              strokeDasharray={!pvPlugged ? '5 4' : undefined}
            />
            <text x="16" y="25" fill="#94A3B8" className="text-[11px] font-semibold">
              Solar PV Module
            </text>
            <text x="184" y="25" textAnchor="end" fill="#FBBF24" className="font-mono text-[10px]">
              {pvPlugged ? `${step.irradianceWm2} W/m²` : 'UNPLUGGED'}
            </text>
            <text x="16" y="60" fill="#F8FAFC" className="font-mono text-[24px] font-bold">
              {step.pvAvailableKw.toFixed(2)}
              <tspan dx="5" fontSize="11" fill="#94A3B8" fontWeight="500">
                kW
              </tspan>
            </text>
            <text x="16" y="84" fill="#CBD5E1" className="font-mono text-[11px]">
              Direct: {step.pvUsedDirectKw.toFixed(2)} kW
            </text>
            <text
              x="16"
              y="102"
              fill={step.pvToBatteryKw > 0.05 ? '#38BDF8' : step.pvCurtailedKw > 0.05 ? '#FBBF24' : '#94A3B8'}
              className="font-mono text-[11px]"
            >
              {step.pvToBatteryKw > 0.05
                ? `Saved to Batt: ${step.pvToBatteryKw.toFixed(2)} kW`
                : step.pvCurtailedKw > 0.05
                  ? `Curtailed: ${step.pvCurtailedKw.toFixed(2)} kW`
                  : `To Batt: ${step.pvToBatteryKw.toFixed(2)} kW`}
            </text>
          </g>

          {/* NODE 2: HYBRID INVERTER */}
          <g transform="translate(368, 108)">
            <rect
              width="144"
              height="114"
              rx="8"
              fill="#1E293B"
              stroke="#475569"
              strokeWidth="1.5"
            />
            <text
              x="72"
              y="26"
              textAnchor="middle"
              fill="#94A3B8"
              className="text-[11px] font-semibold"
            >
              Hybrid Inverter
            </text>
            <text
              x="72"
              y="58"
              textAnchor="middle"
              fill="#FFFFFF"
              className="font-mono text-[21px] font-bold"
            >
              {step.inverterLoadKw.toFixed(2)}
              <tspan dx="4" fontSize="10" fill="#94A3B8">
                kW
              </tspan>
            </text>
            <text
              x="72"
              y="78"
              textAnchor="middle"
              fill="#94A3B8"
              className="font-mono text-[10px]"
            >
              Rated {config.inverterRatedKw.toFixed(1)} kW · {config.inverterEfficiencyPct}%
            </text>
            <line x1="16" y1="88" x2="128" y2="88" stroke="#334155" />
            <text
              x="72"
              y="104"
              textAnchor="middle"
              fill={step.gridOnline ? '#38BDF8' : '#FBBF24'}
              className="font-mono text-[10px] font-medium"
            >
              {step.gridOnline ? 'GRID-TIED AC BUS' : 'ISLANDED BACKUP'}
            </text>
          </g>

          {/* NODE 3: HOUSEHOLD LOAD */}
          <g transform="translate(660, 22)">
            <rect
              width="200"
              height="118"
              rx="8"
              fill="#1E293B"
              stroke={step.unservedLoadKw > 0.01 ? '#EF4444' : '#0284C7'}
              strokeWidth="1.5"
            />
            <text x="16" y="25" fill="#94A3B8" className="text-[11px] font-semibold">
              Household Demand
            </text>
            <text x="184" y="25" textAnchor="end" fill="#64748B" className="font-mono text-[10px]">
              Avg {config.householdAvgKw.toFixed(1)} kW
            </text>
            <text x="16" y="60" fill="#F8FAFC" className="font-mono text-[24px] font-bold">
              {step.householdLoadKw.toFixed(2)}
              <tspan dx="5" fontSize="11" fill="#94A3B8" fontWeight="500">
                kW
              </tspan>
            </text>
            <text x="16" y="84" fill="#7DD3FC" className="font-mono text-[11px]">
              Served: {servedLoadKw.toFixed(2)} kW
            </text>
            <text
              x="16"
              y="102"
              fill={step.unservedLoadKw > 0.01 ? '#F87171' : '#94A3B8'}
              className="font-mono text-[11px] font-medium"
            >
              {step.unservedLoadKw > 0.01
                ? `Unserved: ${step.unservedLoadKw.toFixed(2)} kW`
                : '100% Demand Covered'}
            </text>
          </g>

          {/* NODE 4: BATTERY STORAGE MODULE */}
          <g transform="translate(20, 188)" opacity={battPlugged ? 1 : 0.45}>
            <rect
              width="200"
              height="122"
              rx="8"
              fill="#1E293B"
              stroke={
                !battPlugged
                  ? '#475569'
                  : step.batteryCellTempC >= 40
                    ? '#EF4444'
                    : step.batterySocPct <= config.batteryMinReserveSocPct + 2
                      ? '#F59E0B'
                      : '#16A34A'
              }
              strokeWidth="1.5"
              strokeDasharray={!battPlugged ? '5 4' : undefined}
            />
            <text x="16" y="25" fill="#94A3B8" className="text-[11px] font-semibold">
              Battery Module
            </text>
            <text
              x="184"
              y="25"
              textAnchor="end"
              fill={step.batteryCellTempC >= 40 ? '#F87171' : '#94A3B8'}
              className="font-mono text-[10px]"
            >
              {battPlugged ? `${step.batteryCellTempC.toFixed(1)}°C Cell` : 'UNPLUGGED'}
            </text>
            <text x="16" y="58" fill="#F8FAFC" className="font-mono text-[24px] font-bold">
              {battPlugged ? step.batterySocPct.toFixed(1) : '—'}
              {battPlugged && (
                <tspan dx="4" fontSize="11" fill="#94A3B8" fontWeight="500">
                  % SOC
                </tspan>
              )}
            </text>
            <rect x="16" y="70" width="168" height="8" rx="4" fill="#0F172A" />
            {battPlugged && (
              <>
                <rect
                  x="16"
                  y="70"
                  width={Math.max(4, (168 * Math.min(100, step.batterySocPct)) / 100)}
                  height="8"
                  rx="4"
                  fill={
                    step.batterySocPct <= config.batteryMinReserveSocPct + 2
                      ? '#F59E0B'
                      : '#22C55E'
                  }
                />
                <line
                  x1={16 + (168 * config.batteryMinReserveSocPct) / 100}
                  y1="67"
                  x2={16 + (168 * config.batteryMinReserveSocPct) / 100}
                  y2="81"
                  stroke="#F8FAFC"
                  strokeWidth="1.5"
                />
              </>
            )}
            <text x="16" y="102" fill="#CBD5E1" className="font-mono text-[11px]">
              {battPlugged ? `${step.batteryEnergyKwh.toFixed(2)} kWh` : 'Bypassed'}
            </text>
            <text
              x="184"
              y="102"
              textAnchor="end"
              fill={step.thermalStressFactor > 1.5 ? '#FBBF24' : '#94A3B8'}
              className="font-mono text-[10px]"
            >
              {battPlugged ? `Wear ${step.thermalStressFactor.toFixed(1)}x` : ''}
            </text>
          </g>

          {/* NODE 5: UTILITY GRID MODULE */}
          <g transform="translate(660, 188)" opacity={gridPlugged ? 1 : 0.45}>
            <rect
              width="200"
              height="122"
              rx="8"
              fill="#1E293B"
              stroke={
                !gridPlugged
                  ? '#475569'
                  : !step.gridOnline || step.gridCapBreachKw > 0.01
                    ? '#EF4444'
                    : isGridExporting
                      ? '#16A34A'
                      : '#4F46E5'
              }
              strokeWidth="1.5"
              strokeDasharray={!gridPlugged ? '5 4' : undefined}
            />
            <text x="16" y="25" fill="#94A3B8" className="text-[11px] font-semibold">
              Utility Grid Module
            </text>
            <text
              x="184"
              y="25"
              textAnchor="end"
              fill={
                !gridPlugged
                  ? '#64748B'
                  : !step.gridOnline
                    ? '#F87171'
                    : config.netMeteringInstalled && !config.zeroExportEnabled
                      ? '#4ADE80'
                      : '#FBBF24'
              }
              className="font-mono text-[10px] font-semibold"
            >
              {!gridPlugged
                ? 'UNPLUGGED'
                : !step.gridOnline
                  ? 'OFFLINE'
                  : config.netMeteringInstalled && !config.zeroExportEnabled
                    ? 'NM ACTIVE'
                    : 'NO EXPORT'}
            </text>
            <text
              x="16"
              y="58"
              fill={!gridPlugged ? '#94A3B8' : !step.gridOnline ? '#F87171' : '#F8FAFC'}
              className="font-mono text-[22px] font-bold"
            >
              {!gridPlugged
                ? 'OFF-GRID'
                : !step.gridOnline
                  ? 'OUTAGE'
                  : isGridExporting
                    ? `-${step.gridExportKw.toFixed(2)}`
                    : `+${step.gridImportKw.toFixed(2)}`}
              {gridPlugged && step.gridOnline && (
                <tspan dx="4" fontSize="11" fill="#94A3B8" fontWeight="500">
                  kW
                </tspan>
              )}
            </text>
            <rect x="16" y="70" width="168" height="8" rx="4" fill="#0F172A" />
            {gridPlugged && (
              <rect
                x="16"
                y="70"
                width={step.gridOnline ? Math.max(0, (168 * gridUtilizationPct) / 100) : 0}
                height="8"
                rx="4"
                fill={
                  step.gridCapBreachKw > 0.01
                    ? '#EF4444'
                    : gridUtilizationPct >= 85
                      ? '#F59E0B'
                      : '#6366F1'
                }
              />
            )}
            <text x="16" y="102" fill="#CBD5E1" className="font-mono text-[11px]">
              Peak Cap: {step.gridPeakCapKw.toFixed(1)} kW
            </text>
            <text
              x="184"
              y="102"
              textAnchor="end"
              fill={step.gridCapBreachKw > 0.01 ? '#F87171' : '#94A3B8'}
              className="font-mono text-[10px]"
            >
              {!gridPlugged
                ? 'Island'
                : step.gridCapBreachKw > 0.01
                  ? `+${step.gridCapBreachKw.toFixed(1)} OVER`
                  : `${gridUtilizationPct}% cap`}
            </text>
          </g>
        </svg>

        {/* Compact Node Legend Row */}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 px-2 pb-1 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Sun className="w-3 h-3 text-amber-400" /> Solar PV
            </span>
            <span className="inline-flex items-center gap-1">
              <BatteryCharging className="w-3 h-3 text-emerald-400" /> Storage
            </span>
            <span className="inline-flex items-center gap-1">
              <Home className="w-3 h-3 text-sky-400" /> Household
            </span>
            <span className="inline-flex items-center gap-1">
              <UtilityPole className="w-3 h-3 text-indigo-400" /> Utility Grid
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Net-Metering: {config.netMeteringInstalled ? 'Installed' : 'Not Installed'} · Export Cap:{' '}
            {config.zeroExportEnabled ? '0.0 kW (Zero-Export)' : `${config.gridExportCapKw.toFixed(1)} kW`}
          </span>
        </div>
      </div>

      {/* Hourly Playback Transport & Direct Hour Input Box (Zero Range Sliders) */}
      <div className="px-4 py-3 bg-[#1E293B]/75 border-t border-slate-800 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Transport Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                stepHour(-1);
              }}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              title="Previous hour"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                stepHour(1);
              }}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              title="Next hour"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="ml-1 inline-flex items-center bg-slate-900 rounded-md p-0.5 border border-slate-700/80">
              {([1, 2, 4] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Direct Numeric Hour Input Box + Day Jumps */}
          <div className="flex items-center gap-2">
            {config.horizonHours === 72 && (
              <div className="inline-flex items-center bg-slate-900 rounded-md p-0.5 border border-slate-700/80">
                {[0, 1, 2].map((d) => {
                  const activeDay = Math.floor(selectedHour / 24) === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setSelectedHour(d * 24 + (selectedHour % 24));
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                        activeDay
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Day {d + 1}
                    </button>
                  );
                })}
              </div>
            )}

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-mono">
              <span className="text-slate-400">Hr</span>
              <input
                type="number"
                min={0}
                max={config.horizonHours - 1}
                value={selectedHour}
                onChange={(e) => {
                  setIsPlaying(false);
                  const val = Number(e.target.value);
                  if (!Number.isNaN(val)) setSelectedHour(val);
                }}
                aria-label="Inspect hour index"
                className="w-14 h-7 rounded bg-slate-900 border border-slate-700 px-2 text-right font-mono tabular-nums text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
              />
              <span className="text-slate-500">/ {config.horizonHours - 1}</span>
            </label>
          </div>
        </div>

        {/* Interactive Clickable Hourly Timeline Bar (replaces range slider) */}
        <div className="space-y-1">
          <div className="flex items-center gap-[2px] h-3.5 rounded overflow-hidden bg-slate-900/90 p-0.5">
            {steps.map((s) => {
              const color =
                s.gridCapBreachKw > 0.01 || s.unservedLoadKw > 0.01
                  ? 'bg-rose-500'
                  : !s.gridOnline
                    ? 'bg-amber-500'
                    : s.activeEvents.includes('HEATWAVE_SPIKE')
                      ? 'bg-orange-500/85'
                      : s.pvCurtailedKw > 0.05
                        ? 'bg-yellow-500/75'
                        : s.gridExportKw > 0.05
                          ? 'bg-emerald-500/80'
                          : 'bg-slate-700/80';
              return (
                <button
                  key={s.hour}
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setSelectedHour(s.hour);
                  }}
                  title={`${s.clockLabel} · Load ${s.householdLoadKw} kW · Cell ${s.batteryCellTempC}°C`}
                  className={`flex-1 h-full rounded-[1px] transition-opacity ${color} ${
                    s.hour === selectedHour
                      ? 'opacity-100 ring-1 ring-white scale-y-110'
                      : 'opacity-65 hover:opacity-100'
                  }`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>00:00 (Click any bar or type hour)</span>
            <span>
              {config.horizonHours === 72 ? 'Day 2 · 12:00' : '12:00'}
            </span>
            <span>{config.horizonHours === 72 ? 'Day 3 · 23:00' : '23:00'}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
