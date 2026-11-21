import React, { useMemo } from 'react';
import { ArrowUpRight, Sun, SunDim } from 'lucide-react';
import { calculatePvOutputKw } from '../../engine/solarPanels';
import { evaluateShadowConfig } from '../../engine/shadowFactor';
import { useSimulationStore } from '../../store/useSimulationStore';
import { NumericInputField } from '../ui/NumericInputField';

export const AssetsModule: React.FC = () => {
  const {
    config,
    solarPanels,
    updateConfig,
    selectSolarPanel,
    setActiveTab,
  } = useSimulationStore();

  const activePanel = config.solarPanelSnapshot;
  const shadowSummary = useMemo(
    () => evaluateShadowConfig(config.shadowConfig),
    [config.shadowConfig]
  );
  const stcPreview = calculatePvOutputKw({
    irradianceWm2: 1000,
    pvCapacityKw: config.pvCapacityKw,
    ambientTempC: 25,
    panel: activePanel,
    pvEnabled: config.plugModules.pvEnabled,
  });

  return (
    <div className="p-3.5 space-y-3">
      {(!config.plugModules.pvEnabled || !config.plugModules.batteryEnabled) && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2 text-[11px] text-slate-600">
          {!config.plugModules.pvEnabled && !config.plugModules.batteryEnabled
            ? 'Solar PV and Battery hardware modules are currently unplugged above.'
            : !config.plugModules.pvEnabled
              ? 'Solar PV module is unplugged above. Plug it in to edit PV capacity.'
              : 'Battery module is unplugged above. Plug it in to edit storage parameters.'}
        </div>
      )}

      {/* Preselected Solar Panel Model Picker (Configured in Settings) */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-500" />
            Solar Panel Model
          </span>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-600 hover:text-slate-900"
          >
            <span>Configure</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <select
          aria-label="Solar panel model"
          value={config.solarPanelId}
          disabled={!config.plugModules.pvEnabled}
          onChange={(e) => selectSolarPanel(e.target.value, false)}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-900 disabled:opacity-50"
        >
          {solarPanels.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.wattageWp}Wp · {p.efficiencyPct}%)
            </option>
          ))}
        </select>

        <div className="grid grid-cols-3 gap-1.5 pt-0.5 font-mono tabular-nums text-[10px] text-slate-600">
          <div>
            <span className="text-slate-400">Est. Panels: </span>
            <strong className="text-slate-800">{stcPreview.effectivePanelCount}</strong>
          </div>
          <div>
            <span className="text-slate-400">Area: </span>
            <strong className="text-slate-800">{stcPreview.arrayAreaM2} m²</strong>
          </div>
          <div className="text-right">
            <span className="text-slate-400">TC: </span>
            <strong className="text-slate-800">{activePanel.tempCoeffPctPerC}%/°C</strong>
          </div>
        </div>
      </div>

      {/* Site Shadow Factor Reduction Readout & Toggle */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 flex items-center justify-between gap-2 text-[11px]">
        <div className="min-w-0">
          <div className="font-semibold text-slate-700 flex items-center gap-1">
            <SunDim className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Site Shadow Factor</span>
          </div>
          <div className="font-mono tabular-nums text-[10px] text-slate-500 mt-0.5 truncate">
            {shadowSummary.enabled && shadowSummary.obstructionCount > 0
              ? `${shadowSummary.dailyEffectiveCoefficient.toFixed(2)}× (-${shadowSummary.dailyLossPct.toFixed(1)}% · ${shadowSummary.obstructionCount} obj)`
              : shadowSummary.obstructionCount > 0
                ? `Bypassed (${shadowSummary.obstructionCount} configured)`
                : '1.00× (Unobstructed)'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {shadowSummary.obstructionCount > 0 && (
            <button
              type="button"
              onClick={() =>
                updateConfig({
                  shadowConfig: {
                    ...config.shadowConfig,
                    enabled: !config.shadowConfig.enabled,
                  },
                })
              }
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                config.shadowConfig.enabled
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-600'
              }`}
            >
              {config.shadowConfig.enabled ? 'ON' : 'OFF'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="inline-flex items-center gap-0.5 font-medium text-slate-600 hover:text-slate-900"
          >
            <span>Calculator</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <NumericInputField
          label="Solar PV Array"
          value={config.pvCapacityKw}
          unit="kWp"
          min={0}
          max={50}
          step={0.5}
          disabled={!config.plugModules.pvEnabled}
          onChange={(v) => updateConfig({ pvCapacityKw: v })}
        />
        <NumericInputField
          label="Hybrid Inverter"
          value={config.inverterRatedKw}
          unit="kW"
          min={1}
          max={50}
          step={0.5}
          onChange={(v) => updateConfig({ inverterRatedKw: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <NumericInputField
          label="Battery Bank"
          value={config.batteryCapacityKwh}
          unit="kWh"
          min={0}
          max={100}
          step={1}
          disabled={!config.plugModules.batteryEnabled}
          onChange={(v) => updateConfig({ batteryCapacityKwh: v })}
        />
        <NumericInputField
          label="Inverter Eff."
          value={config.inverterEfficiencyPct}
          unit="%"
          min={75}
          max={99}
          step={1}
          onChange={(v) => updateConfig({ inverterEfficiencyPct: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <NumericInputField
          label="Max Charge"
          value={config.batteryMaxChargeKw}
          unit="kW"
          min={0.5}
          max={25}
          step={0.5}
          disabled={!config.plugModules.batteryEnabled}
          onChange={(v) => updateConfig({ batteryMaxChargeKw: v })}
        />
        <NumericInputField
          label="Max Discharge"
          value={config.batteryMaxDischargeKw}
          unit="kW"
          min={0.5}
          max={25}
          step={0.5}
          disabled={!config.plugModules.batteryEnabled}
          onChange={(v) => updateConfig({ batteryMaxDischargeKw: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <NumericInputField
          label="Initial SOC"
          value={config.batteryInitialSocPct}
          unit="%"
          min={10}
          max={100}
          step={5}
          disabled={!config.plugModules.batteryEnabled}
          onChange={(v) => updateConfig({ batteryInitialSocPct: v })}
        />
        <NumericInputField
          label="Reserve Floor"
          value={config.batteryMinReserveSocPct}
          unit="%"
          min={5}
          max={60}
          step={5}
          disabled={!config.plugModules.batteryEnabled}
          onChange={(v) => updateConfig({ batteryMinReserveSocPct: v })}
        />
      </div>
    </div>
  );
};
