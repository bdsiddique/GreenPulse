import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  Plug,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  BD_APPLIANCE_CATALOG,
  computeApplianceSummary,
  type DescoInputMode,
  type DescoTariffCategory,
  solveDescoBill,
} from '../engine/descoTariff';
import { useSimulationStore } from '../store/useSimulationStore';
import { NumericInputField, SwitchRow } from './ui/NumericInputField';

type EstimatorSubTab = 'desco' | 'appliances';

export const LoadEstimatorView: React.FC = () => {
  const {
    descoConfig,
    appliances,
    config,
    updateDescoConfig,
    syncDescoToSimulation,
    addAppliance,
    updateAppliance,
    removeAppliance,
    resetAppliancesToStarter,
    clearAppliances,
    syncAppliancesToSimulation,
  } = useSimulationStore();

  const [subTab, setSubTab] = useState<EstimatorSubTab>('desco');

  const descoResult = useMemo(() => solveDescoBill(descoConfig), [descoConfig]);
  const applianceSummary = useMemo(
    () => computeApplianceSummary(appliances, config.permittedGridPeakKw),
    [appliances, config.permittedGridPeakKw]
  );

  const handleAddCustomAppliance = () => {
    addAppliance({
      name: 'Custom Appliance',
      category: 'Custom',
      watts: 300,
      qty: 1,
      hoursPerDay: 4,
      runsAtPeak: true,
    });
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Compact Inline Header + Underline Sub-Tabs (No Second Top Bar) */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-0">
        <div className="flex flex-wrap items-center gap-6">
          <div className="pb-2.5">
            <h1 className="text-base font-bold tracking-tight text-slate-900">
              Load & Bill Estimator
            </h1>
          </div>

          <nav className="flex items-center gap-5" aria-label="Load estimator sections">
            <button
              type="button"
              onClick={() => setSubTab('desco')}
              className={`relative pb-2.5 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'desco'
                  ? 'text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>DESCO BD Bill</span>
              {subTab === 'desco' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSubTab('appliances')}
              className={`relative pb-2.5 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'appliances'
                  ? 'text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Plug className="w-3.5 h-3.5" />
              <span>Appliance Estimator</span>
              <span className="font-mono tabular-nums text-[11px] text-slate-400">
                ({appliances.length})
              </span>
              {subTab === 'appliances' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
              )}
            </button>
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-2 pb-2.5 text-xs text-slate-500">
          <span>Active Sim Avg Load:</span>
          <strong className="font-mono tabular-nums text-slate-900">
            {config.householdAvgKw.toFixed(2)} kW
          </strong>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {subTab === 'desco' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Input Card */}
            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">
                  DESCO Bangladesh Bill Parameters
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reverse-calculate average household load from your monthly DESCO electricity bill or billed units using BERC slab tariffs.
                </p>
              </div>

              <div className="p-4 space-y-4">
                {/* Input Mode Toggle */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-700">Input Method</span>
                  <div className="grid grid-cols-2 border border-slate-200 rounded-lg overflow-hidden text-xs font-semibold">
                    {(
                      [
                        { id: 'bill_bdt', label: 'From Monthly Bill (৳)' },
                        { id: 'units_kwh', label: 'From Units (kWh)' },
                      ] as Array<{ id: DescoInputMode; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateDescoConfig({ inputMode: opt.id })}
                        className={`py-2 px-3 transition-colors ${
                          descoConfig.inputMode === opt.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tariff Category */}
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">
                    DESCO / BERC Tariff Category
                  </span>
                  <select
                    value={descoConfig.tariffCategory}
                    onChange={(e) =>
                      updateDescoConfig({
                        tariffCategory: e.target.value as DescoTariffCategory,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    <option value="LT-A">LT-A Residential (Progressive 7-Slab · ৳42/kW demand)</option>
                    <option value="LT-E-FLAT">LT-E Commercial Flat (৳15.36/kWh · ৳90/kW demand)</option>
                    <option value="LT-E-TOU">LT-E Commercial ToU (৳18.43 Peak / ৳13.82 Off-Peak)</option>
                  </select>
                </label>

                {/* Primary Bill or kWh Entry */}
                {descoConfig.inputMode === 'bill_bdt' ? (
                  <NumericInputField
                    label="Monthly DESCO Bill (Total Payable)"
                    value={descoConfig.monthlyBillBdt}
                    unit="৳ BDT"
                    min={0}
                    max={500000}
                    step={100}
                    onChange={(v) => updateDescoConfig({ monthlyBillBdt: v })}
                    hint="Includes energy slabs, demand charge, optional prepaid rebate, and 5% VAT."
                  />
                ) : (
                  <NumericInputField
                    label="Monthly Metered Units"
                    value={descoConfig.monthlyUnitsKwh}
                    unit="kWh"
                    min={0}
                    max={50000}
                    step={10}
                    onChange={(v) => updateDescoConfig({ monthlyUnitsKwh: v })}
                    hint="Total billed kWh on your DESCO statement."
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <NumericInputField
                    label="Sanctioned Load"
                    value={descoConfig.sanctionedLoadKw}
                    unit="kW"
                    min={1}
                    max={50}
                    step={0.5}
                    onChange={(v) => updateDescoConfig({ sanctionedLoadKw: v })}
                  />
                  <NumericInputField
                    label="Billing Cycle"
                    value={descoConfig.billingDays}
                    unit="days"
                    min={15}
                    max={35}
                    step={1}
                    onChange={(v) => updateDescoConfig({ billingDays: v })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <NumericInputField
                    label="Peak Surge Factor"
                    value={descoConfig.peakFactor}
                    unit="x"
                    min={1.1}
                    max={2.8}
                    step={0.1}
                    onChange={(v) => updateDescoConfig({ peakFactor: v })}
                  />
                  {descoConfig.tariffCategory === 'LT-E-TOU' && (
                    <NumericInputField
                      label="Peak Window Share"
                      value={descoConfig.touPeakSharePct}
                      unit="%"
                      min={0}
                      max={100}
                      step={5}
                      onChange={(v) => updateDescoConfig({ touPeakSharePct: v })}
                    />
                  )}
                </div>

                <SwitchRow
                  label="DESCO Prepaid Smart Meter (0.5% Rebate)"
                  description="Applies standard 0.5% energy charge rebate before 5% VAT."
                  checked={descoConfig.prepaidMeter}
                  onChange={(checked) => updateDescoConfig({ prepaidMeter: checked })}
                />
              </div>
            </section>

            {/* Right Results & Slab Breakdown */}
            <div className="lg:col-span-7 space-y-4">
              {descoResult.belowMinimumNotice && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-start gap-2.5 text-xs text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{descoResult.belowMinimumNotice}</span>
                </div>
              )}

              {/* 4-Metric KPI Strip */}
              <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 overflow-hidden">
                <div className="p-3.5">
                  <div className="text-[11px] font-medium text-slate-500">
                    Derived Avg Load
                  </div>
                  <div className="mt-1 font-mono tabular-nums text-xl font-bold text-slate-900">
                    {descoResult.averageLoadKw.toFixed(2)}
                    <span className="text-xs font-normal text-slate-500 ml-1">kW</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {descoResult.dailyKwh.toFixed(1)} kWh/day
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="text-[11px] font-medium text-slate-500">
                    Monthly Energy
                  </div>
                  <div className="mt-1 font-mono tabular-nums text-xl font-bold text-slate-900">
                    {descoResult.monthlyKwh.toFixed(0)}
                    <span className="text-xs font-normal text-slate-500 ml-1">kWh</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {descoConfig.billingDays}-day billing
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="text-[11px] font-medium text-slate-500">
                    Est. Peak Demand
                  </div>
                  <div className="mt-1 font-mono tabular-nums text-xl font-bold text-amber-700">
                    {descoResult.estimatedPeakKw.toFixed(2)}
                    <span className="text-xs font-normal text-slate-500 ml-1">kW</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Sanctioned {descoConfig.sanctionedLoadKw.toFixed(1)} kW
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="text-[11px] font-medium text-slate-500">
                    Blended Rate
                  </div>
                  <div className="mt-1 font-mono tabular-nums text-xl font-bold text-emerald-700">
                    ৳{descoResult.effectiveBlendedRateBdt.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    per kWh incl. VAT
                  </div>
                </div>
              </div>

              {/* Itemized DESCO Slab Breakdown Table */}
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Itemized DESCO / BERC Tariff Breakdown ({descoConfig.tariffCategory})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Exact progressive slab billing including demand charge and 5% VAT.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={syncDescoToSimulation}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    <span>Sync Average Load & Tariff to Simulation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2 px-4">Tariff Slab / Charge Item</th>
                        <th className="py-2 px-4 text-right">Units (kWh)</th>
                        <th className="py-2 px-4 text-right">Rate (৳/kWh)</th>
                        <th className="py-2 px-4 text-right">Amount (৳ BDT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {descoResult.slabLines.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-5 px-4 text-center text-slate-400">
                            Enter a bill above fixed demand charge or positive kWh units to view slab energy charges.
                          </td>
                        </tr>
                      ) : (
                        descoResult.slabLines.map((line) => (
                          <tr key={line.label} className="h-[38px]">
                            <td className="px-4 font-medium text-slate-800">{line.label}</td>
                            <td className="px-4 text-right font-mono tabular-nums text-slate-700">
                              {line.units.toFixed(2)}
                            </td>
                            <td className="px-4 text-right font-mono tabular-nums text-slate-600">
                              ৳{line.rateBdt.toFixed(2)}
                            </td>
                            <td className="px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                              ৳{line.amountBdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                      <tr className="h-[38px] bg-slate-50/50">
                        <td className="px-4 text-slate-600">
                          Demand Charge ({descoConfig.sanctionedLoadKw.toFixed(1)} kW sanctioned)
                        </td>
                        <td className="px-4 text-right font-mono tabular-nums text-slate-400">—</td>
                        <td className="px-4 text-right font-mono tabular-nums text-slate-600">
                          ৳{descoConfig.tariffCategory === 'LT-A' ? '42.00' : '90.00'}/kW
                        </td>
                        <td className="px-4 text-right font-mono tabular-nums text-slate-900">
                          ৳{descoResult.demandChargeBdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {descoConfig.prepaidMeter && (
                        <tr className="h-[38px] bg-emerald-50/40">
                          <td className="px-4 text-emerald-800">
                            Prepaid Meter Rebate (0.5% on energy charge)
                          </td>
                          <td className="px-4 text-right font-mono tabular-nums text-slate-400">—</td>
                          <td className="px-4 text-right font-mono tabular-nums text-emerald-700">
                            -0.5%
                          </td>
                          <td className="px-4 text-right font-mono tabular-nums font-medium text-emerald-700">
                            -৳{descoResult.prepaidRebateBdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                      <tr className="h-[38px] bg-slate-50/50">
                        <td className="px-4 text-slate-600">Government VAT (5%)</td>
                        <td className="px-4 text-right font-mono tabular-nums text-slate-400">—</td>
                        <td className="px-4 text-right font-mono tabular-nums text-slate-600">
                          5.0%
                        </td>
                        <td className="px-4 text-right font-mono tabular-nums text-slate-900">
                          ৳{descoResult.vatBdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="h-11 bg-slate-900 text-white font-semibold">
                        <td className="px-4">Estimated Total Monthly DESCO Bill</td>
                        <td className="px-4 text-right font-mono tabular-nums">
                          {descoResult.monthlyKwh.toFixed(1)} kWh
                        </td>
                        <td className="px-4 text-right font-mono tabular-nums text-slate-300">
                          ৳{descoResult.effectiveBlendedRateBdt.toFixed(2)} avg
                        </td>
                        <td className="px-4 text-right font-mono tabular-nums text-sm">
                          ৳{descoResult.totalBillBdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}

        {subTab === 'appliances' && (
          <div className="space-y-4">
            {/* Top Summary KPI Strip + Sync CTA */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-3.5">
                  <div className="text-[11px] font-medium text-slate-500">Derived Avg Load</div>
                  <div className="mt-1 font-mono tabular-nums text-xl font-bold text-slate-900">
                    {applianceSummary.averageLoadKw.toFixed(2)}
                    <span className="text-xs font-normal text-slate-500 ml-1">kW</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Peak factor {applianceSummary.derivedPeakFactor.toFixed(2)}x
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="text-[11px] font-medium text-slate-500">Simultaneous Peak</div>
                  <div className="mt-1 font-mono tabular-nums text-xl font-bold text-amber-700">
                    {applianceSummary.simultaneousPeakKw.toFixed(2)}
                    <span className="text-xs font-normal text-slate-500 ml-1">kW</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Peak-flagged loads
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="text-[11px] font-medium text-slate-500">Connected Load</div>
                  <div className="mt-1 font-mono tabular-nums text-xl font-bold text-slate-900">
                    {applianceSummary.connectedLoadKw.toFixed(2)}
                    <span className="text-xs font-normal text-slate-500 ml-1">kW</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {(applianceSummary.connectedLoadKw * 1000).toFixed(0)} W installed
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="text-[11px] font-medium text-slate-500">Daily / Monthly</div>
                  <div className="mt-1 font-mono tabular-nums text-xl font-bold text-slate-900">
                    {applianceSummary.dailyEnergyKwh.toFixed(1)}
                    <span className="text-xs font-normal text-slate-500 ml-1">kWh/d</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {applianceSummary.monthlyEnergyKwh.toFixed(0)} kWh / 30d
                  </div>
                </div>

                <div className="p-3.5 col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-medium text-slate-500">Est. DESCO LT-A Bill</div>
                  <div className="mt-1 font-mono tabular-nums text-xl font-bold text-emerald-700">
                    ৳{applianceSummary.estimatedDescoBill.totalBillBdt.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    ৳{applianceSummary.estimatedDescoBill.effectiveBlendedRateBdt.toFixed(2)}/kWh avg
                  </div>
                </div>
              </div>

              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddCustomAppliance}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Custom Appliance
                  </button>
                  <button
                    type="button"
                    onClick={resetAppliancesToStarter}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    Load Dhaka Home Kit
                  </button>
                  {appliances.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAppliances}
                      className="h-8 px-2.5 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={appliances.length === 0}
                  onClick={syncAppliancesToSimulation}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <span>Sync Appliance Load to Simulation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick-Add Bangladesh Appliance Palette */}
            <section className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-900">
                  Quick-Add Common Bangladesh Appliances
                </h3>
                <span className="text-[11px] text-slate-500">
                  Click any item to append to your load schedule
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {BD_APPLIANCE_CATALOG.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      addAppliance({
                        name: preset.name,
                        category: preset.category,
                        watts: preset.watts,
                        qty: 1,
                        hoursPerDay: preset.defaultHours,
                        runsAtPeak: preset.runsAtPeak,
                      })
                    }
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors"
                  >
                    <div className="text-xs font-medium text-slate-900 truncate">
                      {preset.name}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                      <span>{preset.watts} W</span>
                      <span>{preset.defaultHours}h/d</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Editable Appliance Schedule Table */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 px-3 min-w-[200px]">Appliance Name</th>
                      <th className="py-2.5 px-3 w-28">Wattage (W)</th>
                      <th className="py-2.5 px-3 w-20">Qty</th>
                      <th className="py-2.5 px-3 w-24">Hrs / Day</th>
                      <th className="py-2.5 px-3 w-28 text-center">Peak Load</th>
                      <th className="py-2.5 px-3 text-right w-24">Daily kWh</th>
                      <th className="py-2.5 px-3 text-right w-28">Monthly kWh</th>
                      <th className="py-2.5 px-3 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appliances.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 px-4 text-center">
                          <div className="text-xs font-medium text-slate-700">
                            No appliances in your load schedule yet.
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Select items from the quick-add catalog above, click Custom Appliance, or load the starter Dhaka Home Kit.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      appliances.map((item) => {
                        const dailyKwh =
                          ((Math.max(0, item.watts) *
                            Math.max(0, item.qty) *
                            Math.max(0, Math.min(24, item.hoursPerDay))) /
                            1000);
                        const monthlyKwh = dailyKwh * 30;
                        return (
                          <tr key={item.id} className="h-[42px] hover:bg-slate-50/60">
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  updateAppliance(item.id, { name: e.target.value })
                                }
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="number"
                                min={0}
                                max={50000}
                                step={10}
                                value={item.watts}
                                onChange={(e) =>
                                  updateAppliance(item.id, {
                                    watts: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="number"
                                min={0}
                                max={500}
                                step={1}
                                value={item.qty}
                                onChange={(e) =>
                                  updateAppliance(item.id, {
                                    qty: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                  })
                                }
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="number"
                                min={0}
                                max={24}
                                step={0.5}
                                value={item.hoursPerDay}
                                onChange={(e) =>
                                  updateAppliance(item.id, {
                                    hoursPerDay: Math.max(
                                      0,
                                      Math.min(24, Number(e.target.value) || 0)
                                    ),
                                  })
                                }
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  updateAppliance(item.id, { runsAtPeak: !item.runsAtPeak })
                                }
                                className={`px-2.5 py-1 rounded border text-[11px] font-semibold transition-colors ${
                                  item.runsAtPeak
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                              >
                                {item.runsAtPeak ? 'Peak' : 'Off-Peak'}
                              </button>
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono tabular-nums font-medium text-slate-900">
                              {dailyKwh.toFixed(2)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-600">
                              {monthlyKwh.toFixed(1)}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => removeAppliance(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Remove appliance"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
