import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  CloudRain,
  CloudSun,
  Download,
  Droplets,
  FileText,
  FolderOpen,
  Lock,
  MapPin,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sun,
  Sunrise,
  Sunset,
  User,
  Wind,
} from 'lucide-react';
import type {
  HorizonHours,
  SimWorkspaceMode,
  WeatherForecastProfile,
  WeatherSnapshot,
} from '../types/simulation';
import { WEATHER_CITIES } from '../engine/presets';
import { ensureFabricatedRows, rowsToCsv, solveSimulation } from '../engine/dispatchEngine';
import { useSimulationStore } from '../store/useSimulationStore';
import { WeatherCoordinateMap } from './WeatherCoordinateMap';

type OpenMenu = 'file' | 'weather' | 'user' | null;

function mapWmoCodeToLabel(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 2) return 'Partly Sunny';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Hazy / Fog';
  if (code >= 51 && code <= 67) return 'Light Rain';
  if (code >= 80 && code <= 99) return 'Monsoon Showers';
  return 'Variable Clouds';
}

function formatCoordLabel(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

function extractClockHHMM(isoString?: string): string {
  if (!isoString) return '06:00';
  const idx = isoString.indexOf('T');
  if (idx >= 0 && isoString.length >= idx + 6) {
    return isoString.slice(idx + 1, idx + 6);
  }
  return isoString.slice(0, 5);
}

function buildFallbackForecast(
  lat: number,
  lon: number,
  label: string,
  baseTempC: number,
  baseCloudPct: number,
  peakIrradiance: number
): WeatherForecastProfile {
  const latFactor = Math.max(0.55, Math.min(1.05, Math.cos((Math.abs(lat) * Math.PI) / 180) * 1.08));
  const cloudKeep = Math.max(0.28, 1 - (baseCloudPct / 100) * 0.65);
  const hourlyIrradianceWm2: number[] = [];
  const hourlyTempC: number[] = [];
  const hourlyCloudPct: number[] = [];

  for (let h = 0; h < 72; h++) {
    const hr = h % 24;
    const dayIdx = Math.floor(h / 24);
    const dayMod = dayIdx === 1 ? 0.92 : dayIdx === 2 ? 0.97 : 1.0;
    const solar =
      hr >= 6 && hr <= 18
        ? Math.round(
            Math.pow(Math.sin(((hr - 5.5) / 13) * Math.PI), 1.2) *
              peakIrradiance *
              latFactor *
              cloudKeep *
              dayMod
          )
        : 0;
    const temp =
      Math.round(
        (baseTempC - 2.5 + Math.sin(((hr - 9) / 24) * 2 * Math.PI) * 4.5 + (dayIdx === 1 ? -0.8 : 0)) *
          10
      ) / 10;
    const cloud = Math.round(
      Math.max(0, Math.min(100, baseCloudPct + Math.sin(h * 0.45) * 12))
    );
    hourlyIrradianceWm2.push(Math.max(0, solar));
    hourlyTempC.push(temp);
    hourlyCloudPct.push(cloud);
  }

  return {
    locationLabel: label,
    lat,
    lon,
    timezone: 'Local Solar Model',
    fetchedAt: 'Regional baseline',
    source: 'fallback',
    hourlyIrradianceWm2,
    hourlyTempC,
    hourlyCloudPct,
  };
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const TopMenuBar: React.FC = () => {
  const {
    activeTab,
    workspaceMode,
    config,
    activeSavedId,
    activeSavedName,
    hasUnsavedChanges,
    savedSimulations,
    appName,
    appIcon,
    userProfile,
    adminStatus,
    openSaveModal,
    openPdfModal,
    setSavedDrawerOpen,
    resetSandbox,
    setActiveTab,
    setWorkspaceMode,
    setHorizonHours,
    applyWeatherToSimulation,
    updateLocationCity,
    showToast,
  } = useSimulationStore();

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [clockText, setClockText] = useState('');

  const initialCity = useMemo(() => {
    return (
      WEATHER_CITIES.find(
        (c) => c.name.toLowerCase() === userProfile.locationCity.toLowerCase()
      ) || WEATHER_CITIES[0]
    );
  }, [userProfile.locationCity]);

  const [selectedCoords, setSelectedCoords] = useState<{
    lat: number;
    lon: number;
    label: string;
    cityId: string;
  }>(() => ({
    lat: initialCity.lat,
    lon: initialCity.lon,
    label: initialCity.name,
    cityId: initialCity.id,
  }));

  const [latInput, setLatInput] = useState(String(initialCity.lat));
  const [lonInput, setLonInput] = useState(String(initialCity.lon));

  const [weather, setWeather] = useState<WeatherSnapshot>(() => {
    const forecast = buildFallbackForecast(
      initialCity.lat,
      initialCity.lon,
      initialCity.name,
      initialCity.fallbackTempC,
      initialCity.fallbackCloudPct,
      Math.max(760, initialCity.fallbackIrradianceWm2)
    );
    return {
      city: initialCity.name,
      lat: initialCity.lat,
      lon: initialCity.lon,
      timezone: 'Asia/Dhaka',
      temperatureC: initialCity.fallbackTempC,
      feelsLikeC: initialCity.fallbackTempC + 2,
      humidityPct: 68,
      cloudCoverPct: initialCity.fallbackCloudPct,
      irradianceWm2: initialCity.fallbackIrradianceWm2,
      uvIndex: 6.2,
      condition: initialCity.fallbackCondition,
      windKmh: 11,
      sunrise: '05:52',
      sunset: '17:48',
      source: 'fallback',
      updatedAt: 'Local baseline',
      forecast,
    };
  });

  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Live macOS clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const dayStr = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      setClockText(`${dayStr}  ${timeStr}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  const fetchWeatherForCoords = useCallback(
    async (lat: number, lon: number, label: string) => {
      setIsRefreshingWeather(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,weather_code,wind_speed_10m,shortwave_radiation,uv_index` +
          `&hourly=temperature_2m,cloud_cover,shortwave_radiation` +
          `&daily=sunrise,sunset` +
          `&forecast_days=4&timezone=auto`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        const cur = data.current || {};
        const hourly = data.hourly || {};
        const daily = data.daily || {};

        const rawIrr: number[] = Array.isArray(hourly.shortwave_radiation)
          ? hourly.shortwave_radiation.slice(0, 72).map((v: unknown) => Math.max(0, Math.round(Number(v) || 0)))
          : [];
        const rawTemp: number[] = Array.isArray(hourly.temperature_2m)
          ? hourly.temperature_2m.slice(0, 72).map((v: unknown) => Math.round((Number(v) || 26) * 10) / 10)
          : [];
        const rawCloud: number[] = Array.isArray(hourly.cloud_cover)
          ? hourly.cloud_cover.slice(0, 72).map((v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0))))
          : [];

        const fetchedTime = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        const tz = String(data.timezone || 'Auto');
        const fallbackModel = buildFallbackForecast(
          lat,
          lon,
          label,
          Number(cur.temperature_2m ?? 28),
          Number(cur.cloud_cover ?? 25),
          880
        );

        const forecast: WeatherForecastProfile = {
          locationLabel: label,
          lat,
          lon,
          timezone: tz,
          fetchedAt: fetchedTime,
          source: 'live',
          hourlyIrradianceWm2: rawIrr.length >= 24 ? rawIrr : fallbackModel.hourlyIrradianceWm2,
          hourlyTempC: rawTemp.length >= 24 ? rawTemp : fallbackModel.hourlyTempC,
          hourlyCloudPct: rawCloud.length >= 24 ? rawCloud : fallbackModel.hourlyCloudPct,
        };

        setWeather({
          city: label,
          lat,
          lon,
          timezone: tz,
          temperatureC: Math.round(Number(cur.temperature_2m ?? 28)),
          feelsLikeC: Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 29)),
          humidityPct: Math.round(Number(cur.relative_humidity_2m ?? 65)),
          cloudCoverPct: Math.round(Number(cur.cloud_cover ?? 25)),
          irradianceWm2: Math.round(Number(cur.shortwave_radiation ?? 0)),
          uvIndex: Number((Number(cur.uv_index ?? 0)).toFixed(1)),
          condition: mapWmoCodeToLabel(Number(cur.weather_code ?? 1)),
          windKmh: Math.round(Number(cur.wind_speed_10m ?? 10)),
          sunrise: extractClockHHMM(daily.sunrise?.[0]),
          sunset: extractClockHHMM(daily.sunset?.[0]),
          source: 'live',
          updatedAt: fetchedTime,
          forecast,
        });
      } catch {
        const matchedCity = WEATHER_CITIES.find(
          (c) => Math.abs(c.lat - lat) < 0.25 && Math.abs(c.lon - lon) < 0.25
        );
        const baseTemp = matchedCity?.fallbackTempC ?? Math.round(30 - Math.abs(lat) * 0.35);
        const baseCloud = matchedCity?.fallbackCloudPct ?? 28;
        const baseIrr = matchedCity?.fallbackIrradianceWm2 ?? 720;
        const forecast = buildFallbackForecast(lat, lon, label, baseTemp, baseCloud, Math.max(760, baseIrr));

        setWeather({
          city: label,
          lat,
          lon,
          timezone: 'Regional model',
          temperatureC: baseTemp,
          feelsLikeC: baseTemp + 1,
          humidityPct: 64,
          cloudCoverPct: baseCloud,
          irradianceWm2: baseIrr,
          uvIndex: 5.5,
          condition: matchedCity?.fallbackCondition ?? 'Estimated Clear/Partly Cloudy',
          windKmh: 12,
          sunrise: '05:55',
          sunset: '17:50',
          source: 'fallback',
          updatedAt: 'Regional model',
          forecast,
        });
      } finally {
        setIsRefreshingWeather(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchWeatherForCoords(selectedCoords.lat, selectedCoords.lon, selectedCoords.label);
  }, [selectedCoords, fetchWeatherForCoords]);

  const handleSelectMapCoordinate = useCallback((lat: number, lon: number) => {
    const matched = WEATHER_CITIES.find(
      (c) => Math.abs(c.lat - lat) < 0.2 && Math.abs(c.lon - lon) < 0.2
    );
    const label = matched ? matched.name : formatCoordLabel(lat, lon);
    setLatInput(lat.toFixed(4));
    setLonInput(lon.toFixed(4));
    setSelectedCoords({
      lat,
      lon,
      label,
      cityId: matched ? matched.id : '__custom__',
    });
  }, []);

  const handleApplyManualCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = Number(latInput);
    const parsedLon = Number(lonInput);
    if (
      Number.isNaN(parsedLat) ||
      Number.isNaN(parsedLon) ||
      parsedLat < -90 ||
      parsedLat > 90 ||
      parsedLon < -180 ||
      parsedLon > 180
    ) {
      showToast('Enter valid coordinates (Lat -90 to 90, Lon -180 to 180).', 'error');
      return;
    }
    handleSelectMapCoordinate(Number(parsedLat.toFixed(4)), Number(parsedLon.toFixed(4)));
  };

  const handleExportCsv = () => {
    const rows = ensureFabricatedRows(config);
    downloadTextFile(
      `${activeSavedName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${config.horizonHours}h.csv`,
      rowsToCsv(rows, config.horizonHours),
      'text/csv'
    );
    setOpenMenu(null);
    showToast('Exported hourly simulation profile to CSV.', 'info');
  };

  const handleExportJson = () => {
    const solved = solveSimulation(config);
    downloadTextFile(
      `${activeSavedName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.json`,
      JSON.stringify({ name: activeSavedName, config, summary: solved.summary }, null, 2),
      'application/json'
    );
    setOpenMenu(null);
    showToast('Exported simulation configuration as JSON.', 'info');
  };

  const initials = userProfile.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const WeatherIcon =
    weather.cloudCoverPct >= 75
      ? CloudRain
      : weather.cloudCoverPct >= 45
        ? Cloud
        : weather.cloudCoverPct >= 20
          ? CloudSun
          : Sun;

  const toggleMenu = (menu: OpenMenu) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  // Forecast slice for the active simulation horizon (24h or 72h)
  const horizonSlice = useMemo(() => {
    const len = config.horizonHours;
    const irr = weather.forecast.hourlyIrradianceWm2.slice(0, len);
    const temps = weather.forecast.hourlyTempC.slice(0, len);
    const clouds = weather.forecast.hourlyCloudPct.slice(0, len);
    const peakWm2 = irr.length > 0 ? Math.max(...irr) : 0;
    const pshPerDay =
      irr.length > 0
        ? irr.reduce((a, b) => a + b, 0) / 1000 / (len / 24)
        : 0;
    const avgTemp =
      temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : weather.temperatureC;
    const avgCloud =
      clouds.length > 0 ? clouds.reduce((a, b) => a + b, 0) / clouds.length : weather.cloudCoverPct;
    return { irr, peakWm2, pshPerDay, avgTemp, avgCloud };
  }, [weather, config.horizonHours]);

  // Build crisp SVG sparkline path for the 24h / 72h solar irradiance forecast
  const sparklinePath = useMemo(() => {
    const arr = horizonSlice.irr;
    if (arr.length < 2) return { line: '', area: '' };
    const w = 340;
    const h = 44;
    const maxVal = Math.max(1000, ...arr);
    const pts = arr.map((val, i) => {
      const x = (i / (arr.length - 1)) * w;
      const y = h - (val / maxVal) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = `M ${pts.join(' L ')}`;
    const area = `${line} L ${w},${h} L 0,${h} Z`;
    return { line, area };
  }, [horizonSlice.irr]);

  return (
    <header
      ref={barRef}
      className="fixed top-0 left-0 right-0 z-50 h-8 bg-white/88 backdrop-blur-md border-b border-slate-200/90 px-3 flex items-center justify-between text-[12px] select-none"
    >
      {/* Left macOS-style App Mark & File Menu */}
      <div className="flex items-center gap-0.5 min-w-0">
        <button
          type="button"
          onClick={() => {
            setActiveTab('simulations');
            setOpenMenu(null);
          }}
          className="flex items-center gap-1.5 px-2 h-6 rounded hover:bg-slate-200/70 transition-colors font-semibold text-slate-900 whitespace-nowrap shrink-0"
        >
          <img
            src={appIcon}
            alt={`${appName} logo`}
            referrerPolicy="no-referrer"
            className="w-5 h-5 object-contain shrink-0 rounded-sm"
          />
          <span className="max-w-[140px] truncate">{appName}</span>
        </button>

        {/* File Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('file')}
            className={`px-2.5 h-6 rounded transition-colors whitespace-nowrap ${
              openMenu === 'file'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            File
          </button>
          {openMenu === 'file' && (
            <div className="absolute left-0 top-7 w-56 bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg py-1.5 z-50">
              <button
                type="button"
                onClick={() => {
                  resetSandbox();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  New Default Simulation
                </span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => {
                  openSaveModal('save');
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-800 font-medium hover:bg-slate-100 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Save className="w-3.5 h-3.5 text-blue-600" />
                  {activeSavedId ? 'Save / Update Simulation' : 'Save Simulation...'}
                </span>
              </button>
              {activeSavedId && (
                <button
                  type="button"
                  onClick={() => {
                    openSaveModal('save_as');
                    setOpenMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <Save className="w-3.5 h-3.5 text-slate-400" />
                  Save As New Copy...
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('simulations');
                  setSavedDrawerOpen(true);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                  Open Saved Runs
                </span>
                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                  {savedSimulations.length}
                </span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => {
                  openPdfModal(null);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-800 font-medium hover:bg-slate-100 flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                Export PDF Report...
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Export Hourly CSV
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Export Config JSON
              </button>
            </div>
          )}
        </div>

        {/* Folded Simulation Workspace Tabs (Overview | Hourly Data | Stress Test) */}
        {activeTab === 'simulations' && (
          <nav
            aria-label="Simulation views"
            className="flex items-center gap-0.5 ml-2 pl-2 border-l border-slate-200/90"
          >
            {(
              [
                { id: 'sandbox', label: 'Overview' },
                { id: 'fabricated', label: 'Hourly Data' },
                { id: 'stress_test', label: 'Stress Test' },
              ] as Array<{ id: SimWorkspaceMode; label: string }>
            ).map((tab) => {
              const active = workspaceMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setWorkspaceMode(tab.id)}
                  className={`relative px-2 h-6 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Active document title hint (quiet metadata on wide screens) */}
        <span className="hidden xl:inline-flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200/90 text-slate-500 truncate max-w-[175px]">
          <span className="truncate font-medium text-slate-700">{activeSavedName}</span>
          {hasUnsavedChanges && (
            <span className="text-[11px] text-amber-600 whitespace-nowrap">· Edited</span>
          )}
        </span>
      </div>

      {/* Right macOS-style Simulation Quick Actions, Informative Weather Widget, Clock & User Info */}
      <div className="flex items-center gap-1 shrink-0">
        {activeTab === 'simulations' && (
          <div className="hidden md:flex items-center gap-1 pr-2 mr-1 border-r border-slate-200/90">
            {/* 24h / 72h Horizon Toggle */}
            <div className="inline-flex items-center font-mono tabular-nums text-[11px]">
              {([24, 72] as HorizonHours[]).map((hr) => (
                <button
                  key={hr}
                  type="button"
                  onClick={() => setHorizonHours(hr)}
                  className={`px-1.5 h-6 rounded transition-colors ${
                    config.horizonHours === hr
                      ? 'bg-slate-200/80 text-slate-900 font-bold'
                      : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  {hr}h
                </button>
              ))}
            </div>

            {/* Saved Runs Drawer */}
            <button
              type="button"
              onClick={() => setSavedDrawerOpen(true)}
              className="hidden lg:inline-flex items-center gap-1 px-2 h-6 rounded text-[11px] font-medium text-slate-700 hover:bg-slate-200/70 transition-colors whitespace-nowrap"
              title="Open Saved Runs"
            >
              <FolderOpen className="w-3 h-3 text-slate-500" />
              <span className="font-mono tabular-nums">{savedSimulations.length}</span>
            </button>

            {/* Compact Save Button */}
            <button
              type="button"
              onClick={() => openSaveModal('save')}
              className="inline-flex items-center gap-1 px-2 h-6 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors whitespace-nowrap"
            >
              <Save className="w-3 h-3" />
              <span>{activeSavedId ? 'Update' : 'Save'}</span>
            </button>
          </div>
        )}

        {/* Informative Weather, Solar Irradiance & Coordinate Map Widget */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('weather')}
            className={`flex items-center gap-1.5 px-2 h-6 rounded transition-colors whitespace-nowrap ${
              openMenu === 'weather'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-200/70'
            }`}
            title="Live local weather, solar irradiance & coordinate forecast"
          >
            <WeatherIcon
              className={`w-3.5 h-3.5 ${
                openMenu === 'weather' ? 'text-amber-400' : 'text-amber-600'
              }`}
            />
            <span className="font-mono tabular-nums font-medium">{weather.temperatureC}°C</span>
            <span className="hidden lg:inline text-slate-400">·</span>
            <span
              className={`hidden lg:inline font-mono tabular-nums text-[11px] ${
                openMenu === 'weather' ? 'text-amber-300' : 'text-amber-700'
              }`}
            >
              {weather.irradianceWm2} W/m²
            </span>
            <span className="hidden md:inline text-slate-400">·</span>
            <span className="hidden md:inline max-w-[110px] truncate">{weather.city}</span>
          </button>

          {openMenu === 'weather' && (
            <div className="absolute right-0 top-7 w-[392px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-white/98 backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl p-3.5 z-50 text-slate-800 space-y-3 select-text">
              {/* Popover Header */}
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <WeatherIcon className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="truncate">{weather.city}</span>
                    <span className="font-mono text-[10px] font-normal text-slate-500 shrink-0">
                      ({weather.source === 'live' ? 'Open-Meteo' : 'Model'})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>{weather.condition}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">
                      {formatCoordLabel(weather.lat, weather.lon)}
                    </span>
                    <span>·</span>
                    <span>{weather.updatedAt}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    fetchWeatherForCoords(
                      selectedCoords.lat,
                      selectedCoords.lon,
                      selectedCoords.label
                    )
                  }
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 shrink-0"
                  title="Refresh live weather & 72h forecast"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingWeather ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* 6-Metric Informative Live Telemetry Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2">
                  <div className="text-[10px] text-slate-500">Temperature</div>
                  <div className="font-mono tabular-nums text-sm font-bold text-slate-900">
                    {weather.temperatureC}°C
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Feels {weather.feelsLikeC}°C
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 px-2.5 py-2">
                  <div className="text-[10px] text-amber-800">Solar Irradiance</div>
                  <div className="font-mono tabular-nums text-sm font-bold text-amber-700">
                    {weather.irradianceWm2}
                    <span className="text-[10px] font-normal ml-0.5">W/m²</span>
                  </div>
                  <div className="text-[10px] text-amber-800/80 font-mono">
                    UV {weather.uvIndex}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-2">
                  <div className="text-[10px] text-slate-500">Cloud Cover</div>
                  <div className="font-mono tabular-nums text-sm font-bold text-slate-900">
                    {weather.cloudCoverPct}%
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{weather.condition}</div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-sky-600" />
                    Hum
                  </span>
                  <span className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                    {weather.humidityPct}%
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Wind className="w-3 h-3 text-slate-500" />
                    Wind
                  </span>
                  <span className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                    {weather.windKmh} km/h
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2 py-1.5 flex items-center justify-between gap-1 font-mono tabular-nums text-[10px] text-slate-700">
                  <span className="inline-flex items-center gap-0.5" title="Sunrise">
                    <Sunrise className="w-3 h-3 text-amber-500" />
                    {weather.sunrise}
                  </span>
                  <span className="inline-flex items-center gap-0.5" title="Sunset">
                    <Sunset className="w-3 h-3 text-orange-500" />
                    {weather.sunset}
                  </span>
                </div>
              </div>

              {/* Interactive Leaflet OpenStreetMap Coordinate Picker (Zero API Key) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    Select Simulation Coordinates
                  </span>
                  <select
                    aria-label="Quick reference city"
                    value={selectedCoords.cityId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const matched = WEATHER_CITIES.find((c) => c.id === nextId);
                      if (matched) {
                        setLatInput(String(matched.lat));
                        setLonInput(String(matched.lon));
                        setSelectedCoords({
                          lat: matched.lat,
                          lon: matched.lon,
                          label: matched.name,
                          cityId: matched.id,
                        });
                        updateLocationCity(matched.name);
                      }
                    }}
                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-700 focus:outline-none focus:border-slate-400"
                  >
                    {selectedCoords.cityId === '__custom__' && (
                      <option value="__custom__">Custom Pin</option>
                    )}
                    {WEATHER_CITIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <WeatherCoordinateMap
                  lat={selectedCoords.lat}
                  lon={selectedCoords.lon}
                  onSelectCoordinate={handleSelectMapCoordinate}
                />

                {/* Precision Lat / Lon Numeric Controls */}
                <form
                  onSubmit={handleApplyManualCoords}
                  className="grid grid-cols-12 gap-1.5 items-end"
                >
                  <label className="col-span-5 text-[10px] font-medium text-slate-600">
                    Latitude
                    <input
                      type="number"
                      step="0.0001"
                      min={-90}
                      max={90}
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono tabular-nums text-[11px] text-slate-900 focus:outline-none focus:border-slate-500"
                    />
                  </label>
                  <label className="col-span-5 text-[10px] font-medium text-slate-600">
                    Longitude
                    <input
                      type="number"
                      step="0.0001"
                      min={-180}
                      max={180}
                      value={lonInput}
                      onChange={(e) => setLonInput(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono tabular-nums text-[11px] text-slate-900 focus:outline-none focus:border-slate-500"
                    />
                  </label>
                  <button
                    type="submit"
                    className="col-span-2 h-[26px] rounded border border-slate-300 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-800 transition-colors"
                  >
                    Go
                  </button>
                </form>
              </div>

              {/* Active Horizon (24h or 72h) Solar Irradiance Forecast Sparkline */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800">
                    {config.horizonHours}h Solar & Sky Forecast
                  </span>
                  <span className="font-mono tabular-nums text-[10px] text-slate-600">
                    Peak {horizonSlice.peakWm2} W/m² · {horizonSlice.pshPerDay.toFixed(1)} PSH/d
                  </span>
                </div>

                <svg
                  viewBox="0 0 340 44"
                  className="w-full h-11 overflow-visible"
                  role="img"
                  aria-label={`${config.horizonHours}-hour solar irradiance forecast curve`}
                >
                  {sparklinePath.area && (
                    <path d={sparklinePath.area} fill="#F59E0B" fillOpacity="0.18" />
                  )}
                  {sparklinePath.line && (
                    <path
                      d={sparklinePath.line}
                      fill="none"
                      stroke="#D97706"
                      strokeWidth="1.75"
                    />
                  )}
                </svg>

                <div className="flex items-center justify-between font-mono tabular-nums text-[10px] text-slate-500">
                  <span>Avg Temp {horizonSlice.avgTemp.toFixed(1)}°C</span>
                  <span>Avg Cloud {Math.round(horizonSlice.avgCloud)}%</span>
                  <span>Horizon: {config.horizonHours}h</span>
                </div>
              </div>

              {/* Apply Sky Conditions to Simulation (24h or 72h) */}
              <button
                type="button"
                onClick={() => {
                  applyWeatherToSimulation(weather);
                  setOpenMenu(null);
                }}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Apply Sky Conditions to Simulation ({config.horizonHours}h Forecast)
              </button>
            </div>
          )}
        </div>

        {/* Tabular Live Clock */}
        <div className="hidden sm:flex items-center px-2 h-6 font-mono tabular-nums text-[11px] text-slate-600 whitespace-nowrap">
          {clockText}
        </div>

        {/* User Info Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('user')}
            className={`flex items-center gap-1.5 px-2 h-6 rounded transition-colors whitespace-nowrap ${
              openMenu === 'user'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                openMenu === 'user'
                  ? 'bg-white text-slate-900'
                  : 'bg-slate-800 text-white'
              }`}
            >
              {initials || <User className="w-2.5 h-2.5" />}
            </span>
            <span className="hidden md:inline font-medium max-w-[120px] truncate">
              {userProfile.name}
            </span>
          </button>

          {openMenu === 'user' && (
            <div className="absolute right-0 top-7 w-72 bg-white/96 backdrop-blur-md border border-slate-200 rounded-lg shadow-xl p-3.5 z-50 text-slate-800">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {userProfile.name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {userProfile.role}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {userProfile.email}
                  </div>
                </div>
              </div>

              <div className="py-2.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                <span className="truncate pr-2">{userProfile.organization}</span>
                <span className="font-mono tabular-nums text-slate-800 font-medium shrink-0">
                  {savedSimulations.length} saved
                </span>
              </div>

              <div className="pt-2.5 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('settings');
                    setOpenMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded text-left text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2">
                    {adminStatus.authenticated ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    Edit App Name & Profile
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {adminStatus.authenticated ? 'Unlocked' : 'Admin'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('library');
                    setOpenMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded text-left text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                  Open Saved Simulations Library
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('settings');
                    setOpenMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded text-left text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  Workspace Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
