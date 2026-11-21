export type CurrencyCode = 'BDT' | 'USD' | 'EUR' | 'INR';
export type HorizonHours = 24 | 72;
export type InputMode = 'parametric' | 'fabricated';
export type AppTab = 'simulations' | 'load_bill' | 'library' | 'settings';
export type SimWorkspaceMode = 'sandbox' | 'fabricated' | 'stress_test' | 'compare';

export type LoadArchetype =
  | 'residential_evening'
  | 'work_from_home'
  | 'flat_baseload'
  | 'commercial_daytime';

export type WeatherProfile =
  | 'clear'
  | 'partly_cloudy'
  | 'monsoon_drop'
  | 'overcast_multi_day';

export type ScenarioId =
  | 'summer_peak'
  | 'winter_low_irradiation'
  | 'clear_day'
  | 'monsoon_drop'
  | 'load_shedding'
  | 'zero_export'
  | 'tou_shaving'
  | 'blackout_72h'
  | 'custom';

export type StepEventTag =
  | 'OUTAGE'
  | 'MONSOON_DROP'
  | 'CLOUDY_STREAK'
  | 'HEATWAVE_SPIKE'
  | 'MONSOON_SQUALL'
  | 'COLD_SNAP'
  | 'PEAK_TARIFF'
  | 'PEAK_SHAVING'
  | 'EXPORT_CAPPED'
  | 'PV_CURTAILED'
  | 'GRID_CAP_BREACH'
  | 'UNSERVED_LOAD'
  | 'LOAD_SURGE'
  | 'PRICE_SPIKE';

export interface OutageWindow {
  id: string;
  startHour: number;
  endHour: number;
  label: string;
}

export interface FabricatedRow {
  hour: number;
  irradianceWm2: number;
  loadKw: number;
  gridOnline: boolean;
  importRate: number;
  exportRate: number;
  ambientTempC?: number;
  pvKw?: number; // Legacy fallback only; PV is dynamically calculated from irradiance + panel specs
}

export type SolarPanelTechnology =
  | 'N-Type TOPCon'
  | 'Mono PERC'
  | 'Bifacial HJT'
  | 'Polycrystalline'
  | 'Custom';

export interface SolarPanelSpec {
  id: string;
  name: string;
  manufacturer: string;
  technology: SolarPanelTechnology;
  wattageWp: number;
  efficiencyPct: number;
  areaM2: number;
  tempCoeffPctPerC: number;
  noctC: number;
  systemLossPct: number;
  isBuiltIn?: boolean;
}

export type ObstructionType = 'tree' | 'building' | 'parapet' | 'chimney';

export type ObstructionAzimuth =
  | 'east'
  | 'south_east'
  | 'south'
  | 'south_west'
  | 'west';

export interface ShadowObstruction {
  id: string;
  name: string;
  type: ObstructionType;
  azimuth: ObstructionAzimuth;
  heightAboveArrayM: number; // Height above PV array plane in meters
  distanceM: number;         // Horizontal distance from array edge in meters
  widthCoveragePct: number;  // Horizontal sector/array coverage (10–100%)
  foliageDensityPct: number; // Opacity (100% for solid buildings, 40–90% for trees)
}

export interface ShadowFactorConfig {
  enabled: boolean;
  obstructions: ShadowObstruction[];
}

export interface WeatherForecastProfile {
  locationLabel: string;
  lat: number;
  lon: number;
  timezone: string;
  fetchedAt: string;
  source: 'live' | 'fallback';
  hourlyIrradianceWm2: number[]; // Up to 72 hourly W/m² values
  hourlyTempC: number[];         // Up to 72 hourly ambient °C values
  hourlyCloudPct: number[];      // Up to 72 hourly cloud cover % values
}

export interface PlugModulesConfig {
  pvEnabled: boolean;
  batteryEnabled: boolean;
  gridEnabled: boolean;
}

export interface ExtremeWeatherStressConfig {
  cloudyStreak: {
    enabled: boolean;
    startHour: number;
    durationHours: number;
    irradianceDropPct: number;
  };
  heatwaveSpike: {
    enabled: boolean;
    peakTempC: number;
    loadSurgePct: number;
    pvThermalDeratePct: number;
  };
  monsoonSquall: {
    enabled: boolean;
    startHour: number;
    durationHours: number;
    gridTrip: boolean;
  };
  coldSnap: {
    enabled: boolean;
    minTempC: number;
    capacityDeratePct: number;
  };
  loadSurge: {
    enabled: boolean;
    startHour: number;
    durationHours: number;
    surgeMultiplier: number;
  };
  priceSpike: {
    enabled: boolean;
    startHour: number;
    durationHours: number;
    multiplier: number;
  };
}

export interface SolarIrradiationPreset {
  id: string;
  name: string;
  locationTag: string;
  description: string;
  isBuiltIn?: boolean;
  peakIrradianceWm2: number;
  sunriseHour: number;
  sunsetHour: number;
  cloudAttenuationPct: number;
  performanceRatioPct: number;
  middayDipEnabled: boolean;
  middayDipStartHour: number;
  middayDipDurationHours: number;
  middayDipDropPct: number;
  isCustomHourly: boolean;
  hourlyWm2: number[]; // Length 24 (00:00 to 23:00 in W/m²)
  peakSunHours: number; // kWh/m²/day
  updatedAt: string;
}

export interface SimulationConfig {
  horizonHours: HorizonHours;
  inputMode: InputMode;
  activeScenarioId: ScenarioId;
  currency: CurrencyCode;

  // Plug-and-play physical modules
  plugModules: PlugModulesConfig;

  // Extreme weather stress tests
  stressTests: ExtremeWeatherStressConfig;

  // Custom / Library Solar Irradiation Preset & Live Coordinate Weather Forecast
  solarPresetId: string | null;
  solarPresetSnapshot: SolarIrradiationPreset | null;
  appliedWeatherForecast: WeatherForecastProfile | null;

  // Selected Solar Panel Model & Specs (configured in Settings)
  solarPanelId: string;
  solarPanelSnapshot: SolarPanelSpec;

  // Site Shading / Obstruction Factor Calculator
  shadowConfig: ShadowFactorConfig;

  // System assets
  pvCapacityKw: number;
  inverterRatedKw: number;
  inverterEfficiencyPct: number;
  batteryCapacityKwh: number;
  batteryMaxChargeKw: number;
  batteryMaxDischargeKw: number;
  batteryInitialSocPct: number;
  batteryMinReserveSocPct: number;
  batteryRoundTripEffPct: number;

  // Household demand
  householdAvgKw: number;
  loadArchetype: LoadArchetype;
  loadPeakFactor: number;

  // Grid & Net-Metering
  netMeteringInstalled: boolean;
  zeroExportEnabled: boolean;
  gridExportCapKw: number;
  permittedGridPeakKw: number;
  peakShavingEnabled: boolean;

  // Weather & Monsoon
  weatherProfile: WeatherProfile;
  cloudDropStartHour: number;
  cloudDropDurationHours: number;
  cloudDropSeverityPct: number;

  // Outages
  outageWindows: OutageWindow[];

  // Time-of-Use Tariffs (in active currency)
  touEnabled: boolean;
  offPeakRate: number;
  peakRate: number;
  peakStartHour: number;
  peakEndHour: number;
  exportCreditRate: number;
  touBatteryDischargeOnlyOnPeak: boolean;

  // User-fabricated rows (length matches 24 or 72)
  fabricatedRows: FabricatedRow[];
}

export interface HourlyInputStep {
  hour: number;
  dayIndex: number;
  hourOfDay: number;
  clockLabel: string;
  shortLabel: string;
  irradianceWm2: number;
  pvRawKw: number;
  loadKw: number;
  gridOnline: boolean;
  importRate: number;
  exportRate: number;
  ambientTempC: number;
  isPeakTariff: boolean;
  isMonsoonDrop: boolean;
  isCloudyStreak: boolean;
  isHeatwave: boolean;
  isMonsoonSquall: boolean;
  isColdSnap: boolean;
  isLoadSurge: boolean;
  isPriceSpike: boolean;
  outageLabel: string | null;
}

export interface HourlyStepResult {
  hour: number;
  dayIndex: number;
  hourOfDay: number;
  clockLabel: string;
  shortLabel: string;

  irradianceWm2: number;
  pvAvailableKw: number;
  pvUsedDirectKw: number;
  pvToBatteryKw: number;
  pvExportedKw: number;
  pvCurtailedKw: number;

  batteryChargeKw: number;
  batteryDischargeKw: number;
  batterySocPct: number;
  batteryEnergyKwh: number;

  // Battery thermal & longevity telemetry
  ambientTempC: number;
  batteryCellTempC: number;
  thermalStressFactor: number;
  hourlyWearIndex: number;
  cumulativeDegradationPct: number;

  gridOnline: boolean;
  gridImportKw: number;
  gridExportKw: number;
  gridPeakCapKw: number;
  gridCapBreachKw: number;
  unservedLoadKw: number;

  householdLoadKw: number;
  inverterLoadKw: number;

  importRate: number;
  exportRate: number;
  hourlyImportCost: number;
  hourlyExportCredit: number;
  hourlyNetCost: number;
  cumulativeNetCost: number;

  activeEvents: StepEventTag[];
  outageLabel: string | null;
}

export interface LongevityProjectionPoint {
  year: number;
  yearLabel: string;
  baselineSohPct: number;
  stressedSohPct: number;
}

export interface SimulationSummary {
  horizonHours: HorizonHours;
  totalPvYieldKwh: number;
  totalPvDirectKwh: number;
  totalPvToBatteryKwh: number;
  totalPvExportedKwh: number;
  totalCurtailedPvKwh: number;

  totalLoadKwh: number;
  totalServedLoadKwh: number;
  totalUnservedLoadKwh: number;

  totalBatteryChargedKwh: number;
  totalBatteryDischargedKwh: number;
  minBatterySocPct: number;
  endBatterySocPct: number;

  // Battery storage longevity metrics
  equivalentFullCyclesPerDay: number;
  peakBatteryCellTempC: number;
  avgThermalStressFactor: number;
  annualizedFadePct: number;
  baselineLifespanYears: number;
  projectedLifespanYears: number;
  lifespanDeltaYears: number;
  longevityRating: 'Optimal' | 'Moderate Wear' | 'Accelerated Wear' | 'Severe Stress';

  totalGridImportKwh: number;
  totalGridExportKwh: number;
  peakGridImportKw: number;
  permittedGridPeakKw: number;
  gridCapBreachHours: number;
  maxGridCapOvershootKw: number;
  worstBreachHour: number | null;
  worstUnservedHour: number | null;

  selfConsumptionPct: number;
  gridIndependencePct: number;

  outageHoursTotal: number;
  outageHoursSurvived: number;

  totalImportCost: number;
  totalExportCredit: number;
  netEnergyCost: number;
  baselineGridOnlyCost: number;
  estimatedSavings: number;
}

export interface SimulationResult {
  steps: HourlyStepResult[];
  summary: SimulationSummary;
  longevityCurve: LongevityProjectionPoint[];
}

export interface SavedSimulationRecord {
  id: string;
  name: string;
  description: string;
  horizonHours: HorizonHours;
  inputMode: InputMode;
  currency: CurrencyCode;
  config: SimulationConfig;
  summary: SimulationSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioProfile {
  id: string;
  name: string;
  description: string;
  config: SimulationConfig;
  createdAt: string;
  updatedAt: string;
}

export interface HardwareTemplate {
  id: string;
  name: string;
  category: string;
  summary: string;
  specs: string;
  patch: Partial<SimulationConfig>;
}

export interface UserProfile {
  name: string;
  role: string;
  organization: string;
  email: string;
  locationCity: string;
}

export interface WeatherCityOption {
  id: string;
  name: string;
  lat: number;
  lon: number;
  fallbackTempC: number;
  fallbackCloudPct: number;
  fallbackIrradianceWm2: number;
  fallbackCondition: string;
}

export interface WeatherSnapshot {
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  cloudCoverPct: number;
  irradianceWm2: number;
  uvIndex: number;
  condition: string;
  windKmh: number;
  sunrise: string;
  sunset: string;
  source: 'live' | 'fallback';
  updatedAt: string;
  forecast: WeatherForecastProfile;
}
