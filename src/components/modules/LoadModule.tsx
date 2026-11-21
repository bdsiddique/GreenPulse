import React from 'react';
import { ArrowUpRight, Calculator } from 'lucide-react';
import type { LoadArchetype } from '../../types/simulation';
import { useSimulationStore } from '../../store/useSimulationStore';
import { NumericInputField } from '../ui/NumericInputField';

export const LoadModule: React.FC = () => {
  const { config, updateConfig, setActiveTab } = useSimulationStore();

  const dailyKwh = config.householdAvgKw * 24;
  const monthlyKwh = dailyKwh * 30;

  return (
    <div className="p-3.5 space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        <NumericInputField
          label="Avg Power"
          value={config.householdAvgKw}
          unit="kW"
          min={0.2}
          max={25}
          step={0.1}
          onChange={(v) => updateConfig({ householdAvgKw: v })}
        />
        <NumericInputField
          label="Peak Surge"
          value={config.loadPeakFactor}
          unit="x"
          min={1.0}
          max={3.0}
          step={0.1}
          onChange={(v) => updateConfig({ loadPeakFactor: v })}
        />
      </div>

      {/* Derived daily/monthly energy readout */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[10px] text-slate-500">Est. Daily Demand</div>
          <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
            {dailyKwh.toFixed(1)} kWh/d
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500">Est. 30-Day Usage</div>
          <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
            {monthlyKwh.toFixed(0)} kWh/mo
          </div>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-700">Demand Archetype</span>
        <select
          value={config.loadArchetype}
          onChange={(e) =>
            updateConfig({ loadArchetype: e.target.value as LoadArchetype })
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
        >
          <option value="residential_evening">Residential Evening Peak</option>
          <option value="work_from_home">Work-From-Home Balanced</option>
          <option value="flat_baseload">Flat 24h Baseload</option>
          <option value="commercial_daytime">Commercial Daytime Surge</option>
        </select>
      </label>

      <div className="pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setActiveTab('load_bill')}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-2">
            <Calculator className="w-3.5 h-3.5 text-slate-500" />
            Derive from DESCO Bill or Appliances
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
