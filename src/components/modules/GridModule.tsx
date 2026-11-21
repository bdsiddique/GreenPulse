import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { WeatherProfile } from '../../types/simulation';
import { CURRENCIES } from '../../engine/currencies';
import { useSimulationStore } from '../../store/useSimulationStore';
import { NumericInputField, SwitchRow } from '../ui/NumericInputField';

export const GridModule: React.FC = () => {
  const { config, updateConfig, addOutageWindow, removeOutageWindow } =
    useSimulationStore();

  const [newOutageStart, setNewOutageStart] = useState(14);
  const [newOutageEnd, setNewOutageEnd] = useState(16);
  const [newOutageLabel, setNewOutageLabel] = useState('Feeder Outage');

  const currencySymbol = CURRENCIES[config.currency]?.symbol ?? '৳';
  const gridDisabled = !config.plugModules.gridEnabled;

  const handleAddOutage = (e: React.FormEvent) => {
    e.preventDefault();
    const s = Math.max(0, Math.min(config.horizonHours - 1, newOutageStart));
    const end = Math.max(s + 1, Math.min(config.horizonHours, newOutageEnd));
    addOutageWindow({
      startHour: s,
      endHour: end,
      label: newOutageLabel.trim() || 'Scheduled Outage',
    });
  };

  return (
    <div className="p-3.5 space-y-3.5">
      {gridDisabled && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2 text-[11px] text-slate-600">
          Utility Grid module is unplugged above (islanded off-grid mode).
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <NumericInputField
          label="Permitted Grid Peak"
          value={config.permittedGridPeakKw}
          unit="kW"
          min={0.5}
          max={50}
          step={0.5}
          disabled={gridDisabled}
          onChange={(v) => updateConfig({ permittedGridPeakKw: v })}
        />
        <NumericInputField
          label="Export Cap"
          value={config.gridExportCapKw}
          unit="kW"
          min={0}
          max={50}
          step={0.5}
          disabled={
            gridDisabled || !config.netMeteringInstalled || config.zeroExportEnabled
          }
          onChange={(v) => updateConfig({ gridExportCapKw: v })}
        />
      </div>

      <SwitchRow
        label="Net-Metering Installed"
        description="Allow surplus PV export to grid for credit."
        checked={config.netMeteringInstalled}
        disabled={gridDisabled}
        onChange={(checked) =>
          updateConfig({
            netMeteringInstalled: checked,
            zeroExportEnabled: checked ? config.zeroExportEnabled : true,
          })
        }
      />

      <SwitchRow
        label="Zero-Export Enforcement"
        description="Curtail surplus solar once battery is full."
        checked={config.zeroExportEnabled}
        disabled={gridDisabled}
        onChange={(checked) => updateConfig({ zeroExportEnabled: checked })}
      />

      <SwitchRow
        label="Battery Peak Shaving"
        description="Discharge storage to stay under Permitted Grid Peak."
        checked={config.peakShavingEnabled}
        disabled={gridDisabled || !config.plugModules.batteryEnabled}
        onChange={(checked) => updateConfig({ peakShavingEnabled: checked })}
      />

      {/* Baseline Sky Profile */}
      <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Baseline Sky Profile</span>
          <select
            value={config.weatherProfile}
            onChange={(e) =>
              updateConfig({ weatherProfile: e.target.value as WeatherProfile })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
          >
            <option value="clear">Clear Sky (Full Solar Yield)</option>
            <option value="partly_cloudy">Partly Cloudy Intermittency</option>
            <option value="monsoon_drop">Monsoon Cloud Drop Event</option>
            <option value="overcast_multi_day">Multi-Day Overcast Monsoon</option>
          </select>
        </label>

        {config.weatherProfile === 'monsoon_drop' && (
          <div className="grid grid-cols-3 gap-2">
            <NumericInputField
              label="Start"
              value={config.cloudDropStartHour}
              unit="h"
              min={6}
              max={17}
              step={1}
              onChange={(v) => updateConfig({ cloudDropStartHour: v })}
            />
            <NumericInputField
              label="Dur."
              value={config.cloudDropDurationHours}
              unit="h"
              min={1}
              max={8}
              step={1}
              onChange={(v) => updateConfig({ cloudDropDurationHours: v })}
            />
            <NumericInputField
              label="Drop"
              value={config.cloudDropSeverityPct}
              unit="%"
              min={20}
              max={95}
              step={5}
              onChange={(v) => updateConfig({ cloudDropSeverityPct: v })}
            />
          </div>
        )}
      </div>

      {/* Scheduled Outage Windows */}
      <div className="pt-2.5 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">Scheduled Outages</span>
          <span className="font-mono text-[11px] text-slate-400">
            {config.outageWindows.length} active
          </span>
        </div>

        {config.outageWindows.length > 0 && (
          <div className="space-y-1.5">
            {config.outageWindows.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 truncate">{w.label}</div>
                  <div className="font-mono tabular-nums text-[11px] text-slate-500">
                    Hr {w.startHour} → Hr {w.endHour} ({w.endHour - w.startHour}h)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeOutageWindow(w.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Remove outage window"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddOutage} className="grid grid-cols-12 gap-1.5 items-end">
          <label className="col-span-4 text-[11px] text-slate-600">
            Start Hr
            <input
              type="number"
              min={0}
              max={config.horizonHours - 1}
              value={newOutageStart}
              onChange={(e) => setNewOutageStart(Number(e.target.value))}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900"
            />
          </label>
          <label className="col-span-4 text-[11px] text-slate-600">
            End Hr
            <input
              type="number"
              min={1}
              max={config.horizonHours}
              value={newOutageEnd}
              onChange={(e) => setNewOutageEnd(Number(e.target.value))}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900"
            />
          </label>
          <button
            type="submit"
            className="col-span-4 h-[29px] inline-flex items-center justify-center gap-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          <input
            type="text"
            value={newOutageLabel}
            onChange={(e) => setNewOutageLabel(e.target.value)}
            placeholder="Outage label"
            className="col-span-12 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
          />
        </form>
      </div>

      {/* ToU Tariffs */}
      <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
        <SwitchRow
          label="Time-of-Use (ToU) Peak Tariffs"
          description="Higher utility import rates during peak window."
          checked={config.touEnabled}
          onChange={(checked) => updateConfig({ touEnabled: checked })}
        />

        <div className="grid grid-cols-3 gap-2">
          <label className="text-[11px] text-slate-600">
            Off-Peak ({currencySymbol})
            <input
              type="number"
              min={0}
              step={0.1}
              value={config.offPeakRate}
              onChange={(e) =>
                updateConfig({ offPeakRate: Math.max(0, Number(e.target.value)) })
              }
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono tabular-nums text-xs text-slate-900"
            />
          </label>
          <label className="text-[11px] text-slate-600">
            Peak ({currencySymbol})
            <input
              type="number"
              min={0}
              step={0.1}
              value={config.peakRate}
              onChange={(e) =>
                updateConfig({ peakRate: Math.max(0, Number(e.target.value)) })
              }
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono tabular-nums text-xs text-slate-900"
            />
          </label>
          <label className="text-[11px] text-slate-600">
            Export ({currencySymbol})
            <input
              type="number"
              min={0}
              step={0.1}
              value={config.exportCreditRate}
              onChange={(e) =>
                updateConfig({
                  exportCreditRate: Math.max(0, Number(e.target.value)),
                })
              }
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono tabular-nums text-xs text-slate-900"
            />
          </label>
        </div>

        {config.touEnabled && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NumericInputField
                label="Peak Start"
                value={config.peakStartHour}
                unit="hr"
                min={0}
                max={23}
                step={1}
                onChange={(v) => updateConfig({ peakStartHour: v })}
              />
              <NumericInputField
                label="Peak End"
                value={config.peakEndHour}
                unit="hr"
                min={0}
                max={23}
                step={1}
                onChange={(v) => updateConfig({ peakEndHour: v })}
              />
            </div>
            <SwitchRow
              label="Hold Battery for Peak Window"
              description="Discharge only on peak tariff, outages, or peak shaving."
              checked={config.touBatteryDischargeOnlyOnPeak}
              onChange={(checked) =>
                updateConfig({ touBatteryDischargeOnlyOnPeak: checked })
              }
            />
          </>
        )}
      </div>
    </div>
  );
};
