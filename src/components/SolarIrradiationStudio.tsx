import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  RotateCcw,
  Save,
  Sun,
  Trash2,
} from 'lucide-react';
import type { SolarIrradiationPreset } from '../types/simulation';
import {
  BUILTIN_SOLAR_PRESETS,
  computePeakSunHours,
  createEmptySolarPresetDraft,
  generateHourlyIrradianceWm2,
} from '../engine/solarPresets';
import { useSimulationStore } from '../store/useSimulationStore';
import { NumericInputField, SwitchRow } from './ui/NumericInputField';

export const SolarIrradiationStudio: React.FC = () => {
  const {
    customSolarPresets,
    config,
    saveSolarPreset,
    duplicateSolarPreset,
    deleteSolarPreset,
    applySolarPresetToSimulation,
  } = useSimulationStore();

  const allPresets = useMemo(
    () => [...customSolarPresets, ...BUILTIN_SOLAR_PRESETS],
    [customSolarPresets]
  );

  const [draft, setDraft] = useState<SolarIrradiationPreset>(() => {
    if (config.solarPresetSnapshot) {
      return { ...config.solarPresetSnapshot, hourlyWm2: [...config.solarPresetSnapshot.hourlyWm2] };
    }
    return { ...BUILTIN_SOLAR_PRESETS[0], hourlyWm2: [...BUILTIN_SOLAR_PRESETS[0].hourlyWm2] };
  });
  const [showHourlyGrid, setShowHourlyGrid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateParametric = (patch: Partial<SolarIrradiationPreset>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      const hourlyWm2 = generateHourlyIrradianceWm2(next);
      return {
        ...next,
        isCustomHourly: false,
        hourlyWm2,
        peakSunHours: computePeakSunHours(hourlyWm2),
      };
    });
  };

  const updateSingleHour = (hourIndex: number, rawValue: number) => {
    const clamped = Math.round(Math.max(0, Math.min(1400, Number(rawValue) || 0)));
    setDraft((prev) => {
      const nextHours = [...prev.hourlyWm2];
      nextHours[hourIndex] = clamped;
      const peak = Math.max(...nextHours);
      return {
        ...prev,
        isCustomHourly: true,
        peakIrradianceWm2: peak,
        hourlyWm2: nextHours,
        peakSunHours: computePeakSunHours(nextHours),
      };
    });
  };

  const resetHourlyToParametric = () => {
    setDraft((prev) => {
      const hourlyWm2 = generateHourlyIrradianceWm2(prev);
      return {
        ...prev,
        isCustomHourly: false,
        hourlyWm2,
        peakSunHours: computePeakSunHours(hourlyWm2),
      };
    });
  };

  const chartData = useMemo(
    () =>
      draft.hourlyWm2.map((wm2, h) => ({
        hour: `${String(h).padStart(2, '0')}:00`,
        wm2,
        estKw: Number(
          (config.pvCapacityKw * (wm2 / 1000) * (draft.performanceRatioPct / 100)).toFixed(2)
        ),
      })),
    [draft.hourlyWm2, draft.performanceRatioPct, config.pvCapacityKw]
  );

  const estDailyPvKwh = useMemo(
    () =>
      Number(
        (
          draft.peakSunHours *
          config.pvCapacityKw *
          (draft.performanceRatioPct / 100)
        ).toFixed(1)
      ),
    [draft.peakSunHours, config.pvCapacityKw, draft.performanceRatioPct]
  );

  const handleSave = async (applyAfter = false) => {
    setIsSaving(true);
    try {
      const payload: SolarIrradiationPreset = draft.isBuiltIn
        ? {
            ...draft,
            id: '',
            name: draft.name.endsWith('(Custom)') ? draft.name : `${draft.name} (Custom)`,
            isBuiltIn: false,
          }
        : draft;
      const saved = await saveSolarPreset(payload);
      setDraft({ ...saved, hourlyWm2: [...saved.hourlyWm2] });
      if (applyAfter) {
        applySolarPresetToSimulation(saved, true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isEditingBuiltIn = Boolean(draft.isBuiltIn);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Left: Saved & Built-In Presets Directory */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Solar Irradiation Presets
            </h2>
            <p className="text-xs text-slate-500">
              {customSolarPresets.length} custom saved · {BUILTIN_SOLAR_PRESETS.length} calibrated baselines
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const fresh = createEmptySolarPresetDraft();
              setDraft(fresh);
              setShowHourlyGrid(false);
            }}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Preset
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {allPresets.map((preset) => {
            const isSelectedForEdit = draft.id === preset.id && draft.id !== '';
            const isActiveInSim = config.solarPresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={`px-4 py-3 transition-colors ${
                  isSelectedForEdit ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ ...preset, hourlyWm2: [...preset.hourlyWm2] });
                    }}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {preset.name}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span>{preset.locationTag || 'Custom'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-slate-700 font-medium">
                        {preset.peakIrradianceWm2} W/m²
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-amber-700 font-medium">
                        {preset.peakSunHours.toFixed(2)} PSH
                      </span>
                      {preset.isBuiltIn ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Built-in</span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-700">Saved</span>
                        </>
                      )}
                      {isActiveInSim && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 font-semibold">Active in Sim</span>
                        </>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => applySolarPresetToSimulation(preset, true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors whitespace-nowrap"
                      title="Use this solar preset in Simulations"
                    >
                      Use
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const created = await duplicateSolarPreset(preset);
                        setDraft({ ...created, hourlyWm2: [...created.hourlyWm2] });
                      }}
                      className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
                      title="Duplicate preset"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {!preset.isBuiltIn && (
                      <button
                        type="button"
                        onClick={() => deleteSolarPreset(preset.id)}
                        className="p-1.5 rounded border border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                        title="Delete custom preset"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Right: Parametric W/m² Curve Builder + Live Preview + Optional 24h Editor */}
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {isEditingBuiltIn
                ? `Inspecting Built-In: ${draft.name}`
                : draft.id
                  ? `Editing Custom Preset: ${draft.name}`
                  : 'Create New Solar Irradiation Preset'}
            </h2>
            <p className="text-xs text-slate-500">
              {isEditingBuiltIn
                ? 'Adjust parameters below and click Save as Custom Copy to store your own variant.'
                : 'Define parametric W/m² curve settings or fine-tune individual hours below.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving || !draft.name.trim()}
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              {isEditingBuiltIn ? 'Save Custom Copy' : 'Save Preset'}
            </button>
            <button
              type="button"
              disabled={isSaving || !draft.name.trim()}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <span>Save & Use in Sim</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Preset Name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Dhaka April Peak Sun"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Location / Season Tag</span>
              <input
                type="text"
                value={draft.locationTag}
                onChange={(e) => setDraft((p) => ({ ...p, locationTag: e.target.value }))}
                placeholder="e.g., Dhaka · Summer"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </label>
          </div>

          {/* Live 24-Hour W/m² Preview Chart & Summary Metrics */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-semibold text-slate-800">
                24-Hour Solar Irradiance Curve (W/m²)
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px] text-slate-600">
                <span>
                  Peak: <strong className="text-slate-900">{Math.max(...draft.hourlyWm2)} W/m²</strong>
                </span>
                <span>
                  Peak Sun Hours:{' '}
                  <strong className="text-amber-700">{draft.peakSunHours.toFixed(2)} kWh/m²/d</strong>
                </span>
                <span>
                  Est. Yield ({config.pvCapacityKw} kWp):{' '}
                  <strong className="text-emerald-700">{estDailyPvKwh.toFixed(1)} kWh/d</strong>
                </span>
              </div>
            </div>

            <div className="h-[175px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                    interval={2}
                  />
                  <YAxis
                    domain={[0, 1200]}
                    tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                    unit=" W"
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
                      name === 'wm2'
                        ? `${Number(val ?? 0).toFixed(0)} W/m²`
                        : `${Number(val ?? 0).toFixed(2)} kW`,
                      name === 'wm2' ? 'Solar Irradiance' : `Est. PV (${config.pvCapacityKw} kWp)`,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="wm2"
                    stroke="#D97706"
                    fill="#FEF3C7"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Parametric Controls (Precision Numeric Input Boxes Only) */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <NumericInputField
                label="Peak Irradiance"
                value={draft.peakIrradianceWm2}
                unit="W/m²"
                min={50}
                max={1350}
                step={25}
                onChange={(v) => updateParametric({ peakIrradianceWm2: v })}
              />
              <NumericInputField
                label="Sunrise Hour"
                value={draft.sunriseHour}
                unit="hr"
                min={4}
                max={9}
                step={0.5}
                onChange={(v) => updateParametric({ sunriseHour: v })}
              />
              <NumericInputField
                label="Sunset Hour"
                value={draft.sunsetHour}
                unit="hr"
                min={15}
                max={21}
                step={0.5}
                onChange={(v) => updateParametric({ sunsetHour: v })}
              />
              <NumericInputField
                label="Cloud Attenuation"
                value={draft.cloudAttenuationPct}
                unit="%"
                min={0}
                max={90}
                step={2}
                onChange={(v) => updateParametric({ cloudAttenuationPct: v })}
              />
              <NumericInputField
                label="Panel Perf. Ratio"
                value={draft.performanceRatioPct}
                unit="%"
                min={55}
                max={98}
                step={1}
                onChange={(v) => setDraft((p) => ({ ...p, performanceRatioPct: v }))}
              />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <SwitchRow
                label="Midday Cloud Dip Window"
                description="Simulate passing monsoon cloud banks cutting irradiance mid-day."
                checked={draft.middayDipEnabled}
                onChange={(checked) => updateParametric({ middayDipEnabled: checked })}
              />
              {draft.middayDipEnabled && (
                <div className="grid grid-cols-3 gap-2.5">
                  <NumericInputField
                    label="Dip Start"
                    value={draft.middayDipStartHour}
                    unit="hr"
                    min={7}
                    max={17}
                    step={1}
                    onChange={(v) => updateParametric({ middayDipStartHour: v })}
                  />
                  <NumericInputField
                    label="Duration"
                    value={draft.middayDipDurationHours}
                    unit="hrs"
                    min={1}
                    max={8}
                    step={1}
                    onChange={(v) => updateParametric({ middayDipDurationHours: v })}
                  />
                  <NumericInputField
                    label="Irradiance Drop"
                    value={draft.middayDipDropPct}
                    unit="%"
                    min={10}
                    max={95}
                    step={5}
                    onChange={(v) => updateParametric({ middayDipDropPct: v })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Optional 24-Hour Hour-by-Hour W/m² Numeric Grid */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowHourlyGrid((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-slate-900"
              >
                {showHourlyGrid ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>24-Hour W/m² Fine-Tuning Grid</span>
                {draft.isCustomHourly && (
                  <span className="font-mono text-[11px] text-amber-700 font-normal">
                    · Manual overrides active
                  </span>
                )}
              </button>

              {draft.isCustomHourly && (
                <button
                  type="button"
                  onClick={resetHourlyToParametric}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to Parametric
                </button>
              )}
            </div>

            {showHourlyGrid && (
              <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                {draft.hourlyWm2.map((val, hr) => (
                  <label key={hr} className="block space-y-0.5">
                    <span className="block font-mono text-[10px] text-slate-500">
                      {String(hr).padStart(2, '0')}:00
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={1400}
                      step={25}
                      value={val}
                      onChange={(e) => updateSingleHour(hr, Number(e.target.value))}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
