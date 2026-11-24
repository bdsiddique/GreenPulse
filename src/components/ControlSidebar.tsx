import React, { useMemo } from 'react';
import {
  ArrowUpRight,
  BatteryCharging,
  CloudLightning,
  Power,
  Sun,
  UtilityPole,
} from 'lucide-react';
import type {
  PlugModulesConfig,
  SimulationSummary,
  WeatherEventProfile,
} from '../types/simulation';
import { BUILTIN_SOLAR_PRESETS } from '../engine/solarPresets';
import {
  type SandboxPanelId,
  useSimulationStore,
} from '../store/useSimulationStore';
import { StressTestsPanel } from './modules/StressTestsPanel';
import { AssetsModule } from './modules/AssetsModule';
import { LoadModule } from './modules/LoadModule';
import { GridModule } from './modules/GridModule';
import { NumericInputField } from './ui/NumericInputField';

const WEATHER_EVENT_PROFILES: Array<{
  id: WeatherEventProfile;
  label: string;
  startHour: number;
  durationHours: number;
  solarDropPct: number;
}> = [
  {
    id: 'passing_squall',
    label: 'Squall -82%',
    startHour: 11,
    durationHours: 3,
    solarDropPct: 82,
  },
  {
    id: 'storm_front',
    label: 'Front -70%',
    startHour: 10,
    durationHours: 5,
    solarDropPct: 70,
  },
  {
    id: 'cloud_flicker',
    label: 'Cloud Ramp',
    startHour: 9,
    durationHours: 6,
    solarDropPct: 78,
  },
];

interface ControlSidebarProps {
  summary: SimulationSummary;
}

export const ControlSidebar: React.FC<ControlSidebarProps> = ({ summary }) => {
  const {
    config,
    customSolarPresets,
    activeSidebarTab,
    setActiveSidebarTab,
    togglePlugModule,
    updateConfig,
    applySolarPresetToSimulation,
    clearSolarPreset,
    clearAppliedWeatherForecast,
    setSelectedHour,
    setIsPlaying,
    setActiveTab,
    setLibraryTab,
  } = useSimulationStore();

  const allSolarPresets = useMemo(
    () => [...customSolarPresets, ...BUILTIN_SOLAR_PRESETS],
    [customSolarPresets]
  );

  const weatherEvent = config.weatherEvent;
  const activeStressCount = [
    config.stressTests.cloudyStreak.enabled,
    config.stressTests.heatwaveSpike.enabled,
    config.stressTests.monsoonSquall.enabled,
    config.stressTests.coldSnap.enabled,
  ].filter(Boolean).length;

  const handleToggleWeatherEvent = () => {
    const nextEnabled = !weatherEvent.enabled;
    updateConfig({
      weatherEvent: {
        ...weatherEvent,
        enabled: nextEnabled,
      },
    });
    if (nextEnabled) {
      setIsPlaying(false);
      setSelectedHour(Math.min(config.horizonHours - 1, weatherEvent.startHour));
    }
  };

  const handleSelectWeatherProfile = (preset: (typeof WEATHER_EVENT_PROFILES)[number]) => {
    updateConfig({
      weatherEvent: {
        enabled: true,
        profile: preset.id,
        startHour: preset.startHour,
        durationHours: preset.durationHours,
        solarDropPct: preset.solarDropPct,
      },
    });
    setIsPlaying(false);
    setSelectedHour(Math.min(config.horizonHours - 1, preset.startHour));
  };

  const hardwareModules: Array<{
    key: keyof PlugModulesConfig;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'pvEnabled', label: 'Solar PV', icon: Sun },
    { key: 'batteryEnabled', label: 'Battery', icon: BatteryCharging },
    { key: 'gridEnabled', label: 'Utility Grid', icon: UtilityPole },
  ];

  const tabs: Array<{
    id: SandboxPanelId;
    label: string;
    count?: number;
  }> = [
    { id: 'stressTests', label: 'Stress', count: activeStressCount },
    { id: 'assets', label: 'Assets' },
    { id: 'load', label: 'Load' },
    { id: 'grid', label: 'Grid', count: config.outageWindows.length },
  ];

  return (
    <aside className="w-full xl:w-[364px] shrink-0">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Compact Pinned Plug & Play Hardware Strip + Solar Preset & Scenario Selectors */}
        <div className="p-3 border-b border-slate-200 space-y-2.5 bg-slate-50/60">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Hardware Modules
            </span>
            <span className="font-mono text-[11px] font-medium text-slate-600">
              {config.plugModules.gridEnabled ? 'Hybrid Mode' : 'Off-Grid Island'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {hardwareModules.map((mod) => {
              const Icon = mod.icon;
              const plugged = config.plugModules[mod.key];
              return (
                <button
                  key={mod.key}
                  type="button"
                  onClick={() => togglePlugModule(mod.key)}
                  className={`px-2 py-1.5 rounded-lg border text-left transition-colors ${
                    plugged
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        plugged ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="font-mono text-[10px] font-semibold tracking-tight">
                      {plugged ? 'IN' : 'OUT'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium truncate flex items-center justify-between">
                    <span>{mod.label}</span>
                    {!plugged && <Power className="w-2.5 h-2.5 text-slate-300 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Solar Irradiation Preset Picker */}
          <div className="pt-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-500" />
                Solar Irradiation Preset
              </span>
              <button
                type="button"
                onClick={() => {
                  setLibraryTab('solar');
                  setActiveTab('library');
                }}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-600 hover:text-slate-900"
              >
                <span>Edit in Library</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <select
              aria-label="Solar irradiation preset"
              value={config.solarPresetId || '__legacy__'}
              onChange={(e) => {
                const id = e.target.value;
                if (id === '__legacy__') {
                  clearSolarPreset();
                  return;
                }
                const found = allSolarPresets.find((p) => p.id === id);
                if (found) {
                  applySolarPresetToSimulation(found, false);
                }
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-900"
            >
              {customSolarPresets.length > 0 && (
                <optgroup label="My Saved Solar Presets">
                  {customSolarPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.peakIrradianceWm2} W/m² · {p.peakSunHours.toFixed(1)} PSH)
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Calibrated Regional Presets">
                {BUILTIN_SOLAR_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.peakIrradianceWm2} W/m² · {p.peakSunHours.toFixed(1)} PSH)
                  </option>
                ))}
              </optgroup>
              <option value="__legacy__">Legacy Sky Profile (Grid Tab)</option>
            </select>

            {config.appliedWeatherForecast && (
              <div className="rounded-md border border-sky-200 bg-sky-50/80 px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                <div className="min-w-0">
                  <div className="font-semibold text-sky-900 truncate">
                    Live Map Forecast ({config.appliedWeatherForecast.hourlyIrradianceWm2.length}h)
                  </div>
                  <div className="font-mono text-[10px] text-sky-700 truncate">
                    {config.appliedWeatherForecast.locationLabel} ({config.appliedWeatherForecast.lat.toFixed(2)}°, {config.appliedWeatherForecast.lon.toFixed(2)}°)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearAppliedWeatherForecast}
                  className="text-[11px] font-medium text-sky-800 hover:text-slate-900 underline shrink-0"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Rapid Solar-Drop Weather Event Resilience Toggle */}
          <div className="pt-2.5 border-t border-slate-200 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 min-w-0">
                <CloudLightning
                  className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                    weatherEvent.enabled ? 'text-amber-600' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    Weather Event
                  </div>
                  <div className="text-[11px] text-slate-500 leading-snug">
                    Simulate rapid solar output drop to test grid resilience
                  </div>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={weatherEvent.enabled}
                aria-label="Toggle rapid solar drop weather event"
                onClick={handleToggleWeatherEvent}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
                  weatherEvent.enabled ? 'bg-amber-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    weatherEvent.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {weatherEvent.enabled && (
              <div className="space-y-2 pt-0.5">
                <div
                  role="group"
                  aria-label="Weather event profile"
                  className="grid grid-cols-3 gap-1"
                >
                  {WEATHER_EVENT_PROFILES.map((preset) => {
                    const active = weatherEvent.profile === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectWeatherProfile(preset)}
                        className={`px-1.5 py-1 rounded-md text-[10px] font-semibold font-mono tabular-nums whitespace-nowrap transition-colors ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <NumericInputField
                    label="Start Hr"
                    value={weatherEvent.startHour}
                    unit="h"
                    min={0}
                    max={config.horizonHours - 1}
                    step={1}
                    onChange={(v) =>
                      updateConfig({
                        weatherEvent: {
                          ...weatherEvent,
                          startHour: Math.round(v),
                        },
                      })
                    }
                  />
                  <NumericInputField
                    label="Duration"
                    value={weatherEvent.durationHours}
                    unit="h"
                    min={1}
                    max={Math.min(24, config.horizonHours)}
                    step={1}
                    onChange={(v) =>
                      updateConfig({
                        weatherEvent: {
                          ...weatherEvent,
                          durationHours: Math.round(v),
                        },
                      })
                    }
                  />
                  <NumericInputField
                    label="Solar Drop"
                    value={weatherEvent.solarDropPct}
                    unit="%"
                    min={20}
                    max={95}
                    step={5}
                    onChange={(v) =>
                      updateConfig({
                        weatherEvent: {
                          ...weatherEvent,
                          solarDropPct: Math.round(v),
                        },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] font-mono tabular-nums">
                  <span
                    className={
                      summary.gridCapBreachHours > 0 || summary.totalUnservedLoadKwh > 0.05
                        ? 'text-rose-700 font-semibold'
                        : 'text-emerald-700 font-medium'
                    }
                  >
                    {summary.gridCapBreachHours > 0
                      ? `Cap Breach ${summary.gridCapBreachHours}h (+${summary.maxGridCapOvershootKw.toFixed(1)} kW)`
                      : summary.totalUnservedLoadKwh > 0.05
                        ? `Unserved ${summary.totalUnservedLoadKwh.toFixed(1)} kWh`
                        : `Peak Grid ${summary.peakGridImportKw.toFixed(2)} / ${summary.permittedGridPeakKw.toFixed(1)} kW`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setSelectedHour(
                        Math.min(config.horizonHours - 1, weatherEvent.startHour)
                      );
                    }}
                    className="text-[11px] font-sans font-medium text-slate-700 hover:text-slate-950 underline whitespace-nowrap shrink-0"
                  >
                    Inspect Hr {weatherEvent.startHour}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4-Tab Underline Navigation */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-white">
          {tabs.map((tab) => {
            const active = activeSidebarTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSidebarTab(tab.id)}
                className={`relative py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                  active
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={`font-mono tabular-nums text-[10px] ${
                      active ? 'text-amber-600' : 'text-slate-400'
                    }`}
                  >
                    ({tab.count})
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-slate-900" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Tab Module Body */}
        <div>
          {activeSidebarTab === 'stressTests' && <StressTestsPanel summary={summary} />}
          {activeSidebarTab === 'assets' && <AssetsModule summary={summary} />}
          {activeSidebarTab === 'load' && <LoadModule />}
          {activeSidebarTab === 'grid' && <GridModule />}
        </div>
      </div>
    </aside>
  );
};
