import React, { useMemo, useState } from 'react';
import {
  Building2,
  Compass,
  Plus,
  RotateCcw,
  SunDim,
  Trash2,
  Trees,
} from 'lucide-react';
import type {
  ObstructionAzimuth,
  ObstructionType,
  ShadowObstruction,
} from '../types/simulation';
import {
  AZIMUTH_SECTORS,
  computeObstructionElevationDeg,
  evaluateShadowConfig,
  OBSTRUCTION_TYPE_META,
  QUICK_OBSTRUCTION_TEMPLATES,
} from '../engine/shadowFactor';
import { useSimulationStore } from '../store/useSimulationStore';

const DAYLIGHT_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export const ShadowFactorCalculator: React.FC = () => {
  const { config, updateConfig, showToast } = useSimulationStore();
  const shadowConfig = config.shadowConfig;

  const [name, setName] = useState('East Yard Tree');
  const [type, setType] = useState<ObstructionType>('tree');
  const [azimuth, setAzimuth] = useState<ObstructionAzimuth>('east');
  const [heightAboveArrayM, setHeightAboveArrayM] = useState<number>(9.5);
  const [distanceM, setDistanceM] = useState<number>(10.0);
  const [widthCoveragePct, setWidthCoveragePct] = useState<number>(55);
  const [foliageDensityPct, setFoliageDensityPct] = useState<number>(72);

  const summary = useMemo(() => evaluateShadowConfig(shadowConfig), [shadowConfig]);

  const draftElevationDeg = useMemo(
    () => computeObstructionElevationDeg(heightAboveArrayM, distanceM),
    [heightAboveArrayM, distanceM]
  );

  const handleTypeChange = (nextType: ObstructionType) => {
    setType(nextType);
    const meta = OBSTRUCTION_TYPE_META[nextType];
    setFoliageDensityPct(meta.defaultDensityPct);
    setWidthCoveragePct(meta.defaultCoveragePct);
  };

  const toggleEnabled = () => {
    const nextEnabled = !shadowConfig.enabled;
    updateConfig({
      shadowConfig: {
        ...shadowConfig,
        enabled: nextEnabled,
      },
    });
    showToast(
      nextEnabled
        ? 'Enabled site shadow factor reduction on solar irradiation.'
        : 'Disabled site shadow shading reduction.',
      'info'
    );
  };

  const addObstruction = (obs: Omit<ShadowObstruction, 'id'>) => {
    const newItem: ShadowObstruction = {
      ...obs,
      id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    updateConfig({
      shadowConfig: {
        enabled: true,
        obstructions: [...shadowConfig.obstructions, newItem],
      },
    });
    showToast(`Added "${newItem.name}" to shadow calculator.`, 'success');
  };

  const handleSubmitDraft = (e: React.FormEvent) => {
    e.preventDefault();
    addObstruction({
      name: name.trim() || `${OBSTRUCTION_TYPE_META[type].label} (${azimuth})`,
      type,
      azimuth,
      heightAboveArrayM: Math.max(0.2, Math.min(60, Number(heightAboveArrayM) || 5)),
      distanceM: Math.max(0.5, Math.min(100, Number(distanceM) || 8)),
      widthCoveragePct: Math.max(5, Math.min(100, Number(widthCoveragePct) || 50)),
      foliageDensityPct: Math.max(15, Math.min(100, Number(foliageDensityPct) || 80)),
    });
  };

  const handleRemoveObstruction = (id: string) => {
    const remaining = shadowConfig.obstructions.filter((o) => o.id !== id);
    updateConfig({
      shadowConfig: {
        ...shadowConfig,
        obstructions: remaining,
      },
    });
  };

  const handleClearAll = () => {
    updateConfig({
      shadowConfig: {
        enabled: false,
        obstructions: [],
      },
    });
    showToast('Cleared all site shading obstructions.', 'info');
  };

  return (
    <section
      id="shadow-factor-calculator"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <SunDim className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Site Shadow Factor Calculator</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Model nearby trees, neighboring buildings, roof parapets, or masts to compute hourly horizon shading and apply an automatic reduction coefficient to solar irradiation input data.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleEnabled}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              shadowConfig.enabled
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {shadowConfig.enabled ? 'Shading Active' : 'Enable Shading'}
          </button>

          {shadowConfig.obstructions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Summary Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/70">
        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500">
            Daily Reduction Coeff.
          </div>
          <div className="mt-0.5 font-mono tabular-nums text-base font-bold text-slate-900">
            {summary.dailyEffectiveCoefficient.toFixed(2)}×
          </div>
          <div className="text-[10px] text-slate-500">
            {shadowConfig.enabled ? 'Applied to irradiation' : 'Currently bypassed'}
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500">
            Daily Irradiance Loss
          </div>
          <div
            className={`mt-0.5 font-mono tabular-nums text-base font-bold ${
              summary.dailyLossPct > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            -{summary.dailyLossPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">
            Weighted across daylight arc
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500">
            Peak Shading Hour
          </div>
          <div className="mt-0.5 font-mono tabular-nums text-base font-bold text-slate-900">
            {summary.worstHour !== null
              ? `${String(summary.worstHour).padStart(2, '0')}:00`
              : 'None'}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-500">
            {summary.worstHour !== null
              ? `-${summary.worstHourLossPct.toFixed(1)}% beam attenuation`
              : 'Unobstructed sky'}
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500">
            Active Obstructions
          </div>
          <div className="mt-0.5 font-mono tabular-nums text-base font-bold text-slate-900">
            {shadowConfig.obstructions.length}
          </div>
          <div className="text-[10px] text-slate-500">
            Diffuse sky floor ~22%
          </div>
        </div>
      </div>

      {/* Quick-Add Common Site Obstructions */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] font-medium text-slate-500 mr-1">Quick Add:</span>
        {QUICK_OBSTRUCTION_TEMPLATES.map((tpl) => (
          <button
            key={tpl.name}
            type="button"
            onClick={() => addObstruction(tpl)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3 h-3 text-slate-500" />
            {tpl.name}
          </button>
        ))}
      </div>

      {/* Main Split: Obstruction Builder Form (Left) + Active Obstructions & Hourly Profile (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Add Obstruction Form (5 cols) */}
        <form
          onSubmit={handleSubmitDraft}
          className="lg:col-span-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-semibold text-slate-900">
              Add Tree or Structure Obstruction
            </span>
            <span className="font-mono tabular-nums text-[11px] text-amber-700 font-semibold">
              Elev. {draftElevationDeg.toFixed(1)}°
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="block text-[11px] font-medium text-slate-700">
              Obstruction Name
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Mango Tree (East)"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </label>

            <label className="block text-[11px] font-medium text-slate-700">
              Obstruction Type
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as ObstructionType)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              >
                {(Object.keys(OBSTRUCTION_TYPE_META) as ObstructionType[]).map((key) => (
                  <option key={key} value={key}>
                    {OBSTRUCTION_TYPE_META[key].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-[11px] font-medium text-slate-700">
            Direction from PV Array (Solar Azimuth Sector)
            <select
              value={azimuth}
              onChange={(e) => setAzimuth(e.target.value as ObstructionAzimuth)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
            >
              {AZIMUTH_SECTORS.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.label} · {sec.windowLabel}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block text-[11px] font-medium text-slate-700">
              Height Above Array (m)
              <input
                type="number"
                min={0.2}
                max={60}
                step={0.5}
                value={heightAboveArrayM}
                onChange={(e) => setHeightAboveArrayM(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </label>

            <label className="block text-[11px] font-medium text-slate-700">
              Distance from Array (m)
              <input
                type="number"
                min={0.5}
                max={100}
                step={0.5}
                value={distanceM}
                onChange={(e) => setDistanceM(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block text-[11px] font-medium text-slate-700">
              <div className="flex justify-between">
                <span>Array Width Coverage</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {widthCoveragePct}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={widthCoveragePct}
                onChange={(e) => setWidthCoveragePct(Number(e.target.value))}
                className="mt-1.5 w-full accent-slate-900"
              />
            </label>

            <label className="block text-[11px] font-medium text-slate-700">
              <div className="flex justify-between">
                <span>Opacity / Density</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {foliageDensityPct}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={foliageDensityPct}
                onChange={(e) => setFoliageDensityPct(Number(e.target.value))}
                className="mt-1.5 w-full accent-slate-900"
              />
            </label>
          </div>

          <div className="pt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500 font-mono">
              tan⁻¹({heightAboveArrayM}m / {distanceM}m) = {draftElevationDeg.toFixed(1)}°
            </span>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Obstruction
            </button>
          </div>
        </form>

        {/* Right: Hourly Coefficient Visualization + Obstructions List (7 cols) */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* Hourly Daylight Transmission Bar Chart */}
          <div className="rounded-lg border border-slate-200 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900">
                Hourly Solar Irradiation Transmission Coefficient (06:00–18:00)
              </span>
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                1.00× = Unshaded · Lower = Shaded
              </span>
            </div>

            <div className="grid grid-cols-13 gap-1 items-end h-28 pt-3">
              {DAYLIGHT_HOURS.map((hr) => {
                const coeff = summary.hourlyCoefficients[hr] ?? 1.0;
                const heightPct = Math.round(coeff * 100);
                const isShaded = coeff < 0.99;
                return (
                  <div
                    key={hr}
                    className="flex flex-col items-center gap-1 h-full justify-end"
                    title={`${String(hr).padStart(2, '0')}:00 — Transmission ${(coeff * 100).toFixed(0)}% (-${((1 - coeff) * 100).toFixed(1)}% shade)`}
                  >
                    <span
                      className={`font-mono tabular-nums text-[9px] ${
                        isShaded ? 'text-amber-700 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {coeff.toFixed(2)}
                    </span>
                    <div className="w-full h-16 bg-slate-100 rounded-sm overflow-hidden flex items-end">
                      <div
                        className={`w-full transition-all duration-150 ${
                          isShaded ? 'bg-amber-500' : 'bg-slate-800'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-[10px] text-slate-500">
                      {String(hr).padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configured Obstructions List */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>Configured Obstructions ({shadowConfig.obstructions.length})</span>
              <span>Elevation · Window · Peak Loss</span>
            </div>

            {shadowConfig.obstructions.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                No site obstructions added. Add a tree or neighboring structure on the left (or use a Quick Add button above) to apply shading reduction to solar irradiation.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {shadowConfig.obstructions.map((obs) => {
                  const analysis = summary.perObstruction[obs.id];
                  const isTree = obs.type === 'tree';
                  return (
                    <div
                      key={obs.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        {isTree ? (
                          <Trees className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        ) : (
                          <Building2 className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {obs.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                            {OBSTRUCTION_TYPE_META[obs.type].label} · H {obs.heightAboveArrayM}m / D{' '}
                            {obs.distanceM}m · Cov {obs.widthCoveragePct}% · Opacity{' '}
                            {obs.foliageDensityPct}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono tabular-nums text-[11px]">
                          <div className="text-slate-800 font-semibold flex items-center justify-end gap-1">
                            <Compass className="w-3 h-3 text-slate-400" />
                            <span>{analysis?.elevationDeg.toFixed(1) ?? '0.0'}°</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-amber-700">
                              -{analysis?.peakHourLossPct.toFixed(0) ?? '0'}% peak
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {analysis?.windowLabel}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveObstruction(obs.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title={`Remove ${obs.name}`}
                          aria-label={`Remove ${obs.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
