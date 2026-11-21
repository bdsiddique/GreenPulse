import type {
  CurrencyCode,
  ExtremeWeatherStressConfig,
  HardwareTemplate,
  PlugModulesConfig,
  ScenarioId,
  SimulationConfig,
  WeatherCityOption,
} from '../types/simulation';
import { CURRENCIES } from './currencies';
import { BUILTIN_SOLAR_PRESETS, normalizeSolarPreset } from './solarPresets';
import { BUILTIN_SOLAR_PANELS, normalizeSolarPanel } from './solarPanels';
import { createDefaultShadowConfig, normalizeShadowConfig } from './shadowFactor';

export interface ScenarioDefinition {
  id: Exclude<ScenarioId, 'custom'>;
  title: string;
  shortLabel: string;
  horizonTag: '24h' | '72h';
  description: string;
  apply: (current: SimulationConfig) => SimulationConfig;
}

export function createDefaultPlugModules(): PlugModulesConfig {
  return {
    pvEnabled: true,
    batteryEnabled: true,
    gridEnabled: true,
  };
}

export function createDefaultStressTests(): ExtremeWeatherStressConfig {
  return {
    cloudyStreak: {
      enabled: false,
      startHour: 9,
      durationHours: 7,
      irradianceDropPct: 72,
    },
    heatwaveSpike: {
      enabled: false,
      peakTempC: 44,
      loadSurgePct: 38,
      pvThermalDeratePct: 16,
    },
    monsoonSquall: {
      enabled: false,
      startHour: 13,
      durationHours: 4,
      gridTrip: true,
    },
    coldSnap: {
      enabled: false,
      minTempC: -4,
      capacityDeratePct: 18,
    },
    loadSurge: {
      enabled: false,
      startHour: 17,
      durationHours: 4,
      surgeMultiplier: 1.85,
    },
    priceSpike: {
      enabled: false,
      startHour: 16,
      durationHours: 6,
      multiplier: 3.0,
    },
  };
}

export function createDefaultConfig(currency: CurrencyCode = 'BDT'): SimulationConfig {
  const rates = CURRENCIES[currency];
  const defaultSolar = BUILTIN_SOLAR_PRESETS[0];
  const defaultPanel = BUILTIN_SOLAR_PANELS[0];
  return {
    horizonHours: 24,
    inputMode: 'parametric',
    activeScenarioId: 'clear_day',
    currency,

    plugModules: createDefaultPlugModules(),
    stressTests: createDefaultStressTests(),

    solarPresetId: defaultSolar.id,
    solarPresetSnapshot: defaultSolar,
    appliedWeatherForecast: null,

    solarPanelId: defaultPanel.id,
    solarPanelSnapshot: defaultPanel,

    shadowConfig: createDefaultShadowConfig(),

    pvCapacityKw: 6.0,
    inverterRatedKw: 6.0,
    inverterEfficiencyPct: 95,
    batteryCapacityKwh: 10.0,
    batteryMaxChargeKw: 4.0,
    batteryMaxDischargeKw: 4.5,
    batteryInitialSocPct: 55,
    batteryMinReserveSocPct: 15,
    batteryRoundTripEffPct: 90,

    householdAvgKw: 2.2,
    loadArchetype: 'residential_evening',
    loadPeakFactor: 1.7,

    netMeteringInstalled: true,
    zeroExportEnabled: false,
    gridExportCapKw: 5.0,
    permittedGridPeakKw: 5.0,
    peakShavingEnabled: true,

    weatherProfile: 'clear',
    cloudDropStartHour: 11,
    cloudDropDurationHours: 3,
    cloudDropSeverityPct: 75,

    outageWindows: [],

    touEnabled: true,
    offPeakRate: rates.defaultOffPeakRate,
    peakRate: rates.defaultPeakRate,
    peakStartHour: 17,
    peakEndHour: 22,
    exportCreditRate: rates.defaultExportCreditRate,
    touBatteryDischargeOnlyOnPeak: false,

    fabricatedRows: [],
  };
}

export function normalizeConfig(raw: Partial<SimulationConfig>): SimulationConfig {
  const base = createDefaultConfig(raw.currency || 'BDT');
  const hasExplicitSolar = 'solarPresetId' in raw;
  const matchedPanel = raw.solarPanelSnapshot
    ? normalizeSolarPanel(raw.solarPanelSnapshot)
    : BUILTIN_SOLAR_PANELS.find((p) => p.id === raw.solarPanelId) || base.solarPanelSnapshot;
  return {
    ...base,
    ...raw,
    solarPresetId: hasExplicitSolar ? (raw.solarPresetId ?? null) : base.solarPresetId,
    solarPresetSnapshot: hasExplicitSolar
      ? raw.solarPresetSnapshot
        ? normalizeSolarPreset(raw.solarPresetSnapshot)
        : null
      : base.solarPresetSnapshot,
    appliedWeatherForecast: raw.appliedWeatherForecast ?? null,
    solarPanelId: matchedPanel.id,
    solarPanelSnapshot: matchedPanel,
    shadowConfig: normalizeShadowConfig(raw.shadowConfig),
    plugModules: {
      ...base.plugModules,
      ...(raw.plugModules || {}),
    },
    stressTests: {
      cloudyStreak: {
        ...base.stressTests.cloudyStreak,
        ...(raw.stressTests?.cloudyStreak || {}),
      },
      heatwaveSpike: {
        ...base.stressTests.heatwaveSpike,
        ...(raw.stressTests?.heatwaveSpike || {}),
      },
      monsoonSquall: {
        ...base.stressTests.monsoonSquall,
        ...(raw.stressTests?.monsoonSquall || {}),
      },
      coldSnap: {
        ...base.stressTests.coldSnap,
        ...(raw.stressTests?.coldSnap || {}),
      },
      loadSurge: {
        ...base.stressTests.loadSurge,
        ...(raw.stressTests?.loadSurge || {}),
      },
      priceSpike: {
        ...base.stressTests.priceSpike,
        ...(raw.stressTests?.priceSpike || {}),
      },
    },
  };
}

export const STRESS_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'summer_peak',
    title: 'Summer Peak',
    shortLabel: 'Summer Peak',
    horizonTag: '24h',
    description:
      'High pre-monsoon solar yield with 44°C cooling load surge, PV thermal derate, and evening ToU peak shaving.',
    apply: (current) => ({
      ...current,
      horizonHours: 24,
      inputMode: 'parametric',
      activeScenarioId: 'summer_peak',
      plugModules: createDefaultPlugModules(),
      solarPresetId: BUILTIN_SOLAR_PRESETS[0].id,
      solarPresetSnapshot: BUILTIN_SOLAR_PRESETS[0],
      appliedWeatherForecast: null,
      weatherProfile: 'clear',
      householdAvgKw: Math.max(current.householdAvgKw, 3.0),
      loadPeakFactor: Math.max(current.loadPeakFactor, 1.85),
      stressTests: {
        ...createDefaultStressTests(),
        heatwaveSpike: {
          enabled: true,
          peakTempC: 44,
          loadSurgePct: 35,
          pvThermalDeratePct: 14,
        },
      },
      outageWindows: [],
      touEnabled: true,
      peakShavingEnabled: true,
      touBatteryDischargeOnlyOnPeak: false,
      netMeteringInstalled: true,
      zeroExportEnabled: false,
    }),
  },
  {
    id: 'winter_low_irradiation',
    title: 'Winter Low Irradiation',
    shortLabel: 'Winter Low Irrad.',
    horizonTag: '24h',
    description:
      'Short winter daylight window (680 W/m² peak) with morning mist haze and cold-snap battery capacity derate.',
    apply: (current) => ({
      ...current,
      horizonHours: 24,
      inputMode: 'parametric',
      activeScenarioId: 'winter_low_irradiation',
      plugModules: createDefaultPlugModules(),
      solarPresetId: BUILTIN_SOLAR_PRESETS[1].id,
      solarPresetSnapshot: BUILTIN_SOLAR_PRESETS[1],
      appliedWeatherForecast: null,
      weatherProfile: 'partly_cloudy',
      householdAvgKw: Math.min(current.householdAvgKw, 2.0),
      stressTests: {
        ...createDefaultStressTests(),
        coldSnap: {
          enabled: true,
          minTempC: 6,
          capacityDeratePct: 14,
        },
      },
      outageWindows: [],
      peakShavingEnabled: true,
      touBatteryDischargeOnlyOnPeak: false,
    }),
  },
  {
    id: 'clear_day',
    title: 'Normal Clear Day',
    shortLabel: 'Clear Day',
    horizonTag: '24h',
    description: 'Clear sky baseline with Net-Metering active and nominal 28°C ambient temperatures.',
    apply: (current) => ({
      ...current,
      horizonHours: 24,
      inputMode: 'parametric',
      activeScenarioId: 'clear_day',
      plugModules: createDefaultPlugModules(),
      stressTests: createDefaultStressTests(),
      solarPresetId: BUILTIN_SOLAR_PRESETS[0].id,
      solarPresetSnapshot: BUILTIN_SOLAR_PRESETS[0],
      appliedWeatherForecast: null,
      weatherProfile: 'clear',
      outageWindows: [],
      netMeteringInstalled: true,
      zeroExportEnabled: false,
      gridExportCapKw: Math.max(current.gridExportCapKw, 5.0),
      touBatteryDischargeOnlyOnPeak: false,
      peakShavingEnabled: true,
    }),
  },
  {
    id: 'monsoon_drop',
    title: 'Monsoon Cloud Drop',
    shortLabel: 'Monsoon Drop',
    horizonTag: '24h',
    description: 'Sudden 74% midday solar collapse (11:00–14:00) testing battery buffer and grid ramp.',
    apply: (current) => ({
      ...current,
      horizonHours: 24,
      inputMode: 'parametric',
      activeScenarioId: 'monsoon_drop',
      solarPresetId: BUILTIN_SOLAR_PRESETS[2].id,
      solarPresetSnapshot: BUILTIN_SOLAR_PRESETS[2],
      appliedWeatherForecast: null,
      weatherProfile: 'monsoon_drop',
      cloudDropStartHour: 11,
      cloudDropDurationHours: 3,
      cloudDropSeverityPct: 78,
      stressTests: {
        ...createDefaultStressTests(),
        cloudyStreak: {
          enabled: true,
          startHour: 10,
          durationHours: 5,
          irradianceDropPct: 55,
        },
      },
      outageWindows: [],
      peakShavingEnabled: true,
      touBatteryDischargeOnlyOnPeak: false,
    }),
  },
  {
    id: 'load_shedding',
    title: 'Scheduled Load Shedding',
    shortLabel: 'Load Shedding',
    horizonTag: '24h',
    description: 'Two utility grid outages (13:00–15:00 & 19:00–22:00) stressing evening reserve autonomy.',
    apply: (current) => ({
      ...current,
      horizonHours: 24,
      inputMode: 'parametric',
      activeScenarioId: 'load_shedding',
      weatherProfile: 'partly_cloudy',
      stressTests: createDefaultStressTests(),
      outageWindows: [
        { id: 'out_midday', startHour: 13, endHour: 15, label: 'Midday Load Shedding' },
        { id: 'out_evening', startHour: 19, endHour: 22, label: 'Evening Peak Outage' },
      ],
      touBatteryDischargeOnlyOnPeak: false,
      peakShavingEnabled: true,
    }),
  },
  {
    id: 'zero_export',
    title: 'Zero-Export / Feed-In Cap',
    shortLabel: 'Zero-Export',
    horizonTag: '24h',
    description: 'Strict zero grid export enforcement highlighting midday PV curtailment when battery saturates.',
    apply: (current) => ({
      ...current,
      horizonHours: 24,
      inputMode: 'parametric',
      activeScenarioId: 'zero_export',
      weatherProfile: 'clear',
      stressTests: createDefaultStressTests(),
      outageWindows: [],
      pvCapacityKw: Math.max(current.pvCapacityKw, 8.0),
      netMeteringInstalled: false,
      zeroExportEnabled: true,
      gridExportCapKw: 0,
      touBatteryDischargeOnlyOnPeak: false,
    }),
  },
  {
    id: 'tou_shaving',
    title: 'ToU Peak Tariff Shaving',
    shortLabel: 'ToU Shaving',
    horizonTag: '24h',
    description: 'Holds battery charge off-peak to shave expensive 17:00–22:00 peak utility rates and stay under cap.',
    apply: (current) => {
      const rates = CURRENCIES[current.currency];
      return {
        ...current,
        horizonHours: 24,
        inputMode: 'parametric',
        activeScenarioId: 'tou_shaving',
        weatherProfile: 'clear',
        stressTests: createDefaultStressTests(),
        outageWindows: [],
        touEnabled: true,
        offPeakRate: rates.defaultOffPeakRate,
        peakRate: Number((rates.defaultPeakRate * 1.35).toFixed(2)),
        peakStartHour: 17,
        peakEndHour: 22,
        touBatteryDischargeOnlyOnPeak: true,
        peakShavingEnabled: true,
        permittedGridPeakKw: Math.min(current.permittedGridPeakKw, 3.2),
      };
    },
  },
  {
    id: 'blackout_72h',
    title: '72-Hour Blackout Stress',
    shortLabel: '72h Blackout',
    horizonTag: '72h',
    description: 'Extended 66-hour utility blackout across overcast Day 2 testing multi-day battery autonomy.',
    apply: (current) => ({
      ...current,
      horizonHours: 72,
      inputMode: 'parametric',
      activeScenarioId: 'blackout_72h',
      weatherProfile: 'overcast_multi_day',
      stressTests: {
        ...createDefaultStressTests(),
        cloudyStreak: {
          enabled: true,
          startHour: 24,
          durationHours: 24,
          irradianceDropPct: 70,
        },
      },
      batteryInitialSocPct: 80,
      outageWindows: [
        { id: 'out_72h_main', startHour: 6, endHour: 72, label: '72h Regional Grid Blackout' },
      ],
      touBatteryDischargeOnlyOnPeak: false,
      peakShavingEnabled: true,
    }),
  },
];

export const HARDWARE_TEMPLATES: HardwareTemplate[] = [
  {
    id: 'tpl_urban_6kw',
    name: '6 kWp Urban Residential Hybrid',
    category: 'Residential',
    summary: 'Balanced rooftop PV with 10 kWh LiFePO4 pack and 5 kW sanctioned utility peak.',
    specs: '6 kWp PV · 6 kW Inv · 10 kWh Batt · 5 kW Grid Cap',
    patch: {
      plugModules: { pvEnabled: true, batteryEnabled: true, gridEnabled: true },
      pvCapacityKw: 6.0,
      inverterRatedKw: 6.0,
      inverterEfficiencyPct: 95,
      batteryCapacityKwh: 10.0,
      batteryMaxChargeKw: 4.0,
      batteryMaxDischargeKw: 4.5,
      batteryMinReserveSocPct: 15,
      householdAvgKw: 2.2,
      loadArchetype: 'residential_evening',
      permittedGridPeakKw: 5.0,
      netMeteringInstalled: true,
      zeroExportEnabled: false,
      gridExportCapKw: 5.0,
    },
  },
  {
    id: 'tpl_villa_12kw',
    name: '12 kWp High-Autonomy Villa',
    category: 'Residential Heavy',
    summary: 'Oversized solar + dual-stack 20 kWh storage built for multi-day monsoon resilience.',
    specs: '12 kWp PV · 10 kW Inv · 20 kWh Batt · 8 kW Grid Cap',
    patch: {
      plugModules: { pvEnabled: true, batteryEnabled: true, gridEnabled: true },
      pvCapacityKw: 12.0,
      inverterRatedKw: 10.0,
      inverterEfficiencyPct: 96,
      batteryCapacityKwh: 20.0,
      batteryMaxChargeKw: 8.0,
      batteryMaxDischargeKw: 8.5,
      batteryMinReserveSocPct: 15,
      householdAvgKw: 3.6,
      loadArchetype: 'work_from_home',
      permittedGridPeakKw: 8.0,
      netMeteringInstalled: true,
      zeroExportEnabled: false,
      gridExportCapKw: 8.0,
    },
  },
  {
    id: 'tpl_compact_3kw',
    name: '3 kWp Compact Essential Backup',
    category: 'Micro Hybrid',
    summary: 'Entry-level backup system under tight 2.5 kW utility feeder limit.',
    specs: '3 kWp PV · 3.5 kW Inv · 5 kWh Batt · 2.5 kW Grid Cap',
    patch: {
      plugModules: { pvEnabled: true, batteryEnabled: true, gridEnabled: true },
      pvCapacityKw: 3.0,
      inverterRatedKw: 3.5,
      inverterEfficiencyPct: 93,
      batteryCapacityKwh: 5.0,
      batteryMaxChargeKw: 2.0,
      batteryMaxDischargeKw: 2.5,
      batteryMinReserveSocPct: 20,
      householdAvgKw: 1.4,
      loadArchetype: 'residential_evening',
      permittedGridPeakKw: 2.5,
      netMeteringInstalled: false,
      zeroExportEnabled: true,
      gridExportCapKw: 0,
    },
  },
  {
    id: 'tpl_commercial_15kw',
    name: '15 kWp Commercial Daytime Zero-Export',
    category: 'Commercial',
    summary: 'Daytime office/clinic load matched to high PV yield with strict utility feed-in cap.',
    specs: '15 kWp PV · 15 kW Inv · 15 kWh Batt · 10 kW Grid Cap',
    patch: {
      plugModules: { pvEnabled: true, batteryEnabled: true, gridEnabled: true },
      pvCapacityKw: 15.0,
      inverterRatedKw: 15.0,
      inverterEfficiencyPct: 97,
      batteryCapacityKwh: 15.0,
      batteryMaxChargeKw: 7.5,
      batteryMaxDischargeKw: 7.5,
      batteryMinReserveSocPct: 15,
      householdAvgKw: 5.2,
      loadArchetype: 'commercial_daytime',
      permittedGridPeakKw: 10.0,
      netMeteringInstalled: true,
      zeroExportEnabled: false,
      gridExportCapKw: 4.0,
    },
  },
  {
    id: 'tpl_constrained_feeder',
    name: 'Tight Feeder Peak-Shaver (3 kW Cap)',
    category: 'Grid Constrained',
    summary: 'Tests battery peak shaving when household surges exceed a strict 3 kW sanctioned grid cap.',
    specs: '7.5 kWp PV · 8 kW Inv · 15 kWh Batt · 3 kW Grid Cap',
    patch: {
      plugModules: { pvEnabled: true, batteryEnabled: true, gridEnabled: true },
      pvCapacityKw: 7.5,
      inverterRatedKw: 8.0,
      inverterEfficiencyPct: 95,
      batteryCapacityKwh: 15.0,
      batteryMaxChargeKw: 6.0,
      batteryMaxDischargeKw: 6.0,
      batteryMinReserveSocPct: 10,
      householdAvgKw: 3.1,
      loadArchetype: 'residential_evening',
      loadPeakFactor: 2.0,
      permittedGridPeakKw: 3.0,
      peakShavingEnabled: true,
      netMeteringInstalled: true,
      zeroExportEnabled: false,
      gridExportCapKw: 3.0,
    },
  },
];

export const WEATHER_CITIES: WeatherCityOption[] = [
  {
    id: 'dhaka',
    name: 'Dhaka',
    lat: 23.8103,
    lon: 90.4125,
    fallbackTempC: 31,
    fallbackCloudPct: 24,
    fallbackIrradianceWm2: 740,
    fallbackCondition: 'Partly Sunny',
  },
  {
    id: 'chattogram',
    name: 'Chattogram',
    lat: 22.3569,
    lon: 91.7832,
    fallbackTempC: 29,
    fallbackCloudPct: 48,
    fallbackIrradianceWm2: 520,
    fallbackCondition: 'Coastal Clouds',
  },
  {
    id: 'new_delhi',
    name: 'New Delhi',
    lat: 28.6139,
    lon: 77.209,
    fallbackTempC: 34,
    fallbackCloudPct: 12,
    fallbackIrradianceWm2: 860,
    fallbackCondition: 'Clear Sky',
  },
  {
    id: 'san_francisco',
    name: 'San Francisco',
    lat: 37.7749,
    lon: -122.4194,
    fallbackTempC: 18,
    fallbackCloudPct: 36,
    fallbackIrradianceWm2: 610,
    fallbackCondition: 'Light Marine Layer',
  },
  {
    id: 'munich',
    name: 'Munich',
    lat: 48.1351,
    lon: 11.582,
    fallbackTempC: 14,
    fallbackCloudPct: 58,
    fallbackIrradianceWm2: 410,
    fallbackCondition: 'Broken Clouds',
  },
];
