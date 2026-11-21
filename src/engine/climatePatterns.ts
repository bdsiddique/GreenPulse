import type { FabricatedRow, HorizonHours } from '../types/simulation';

export type ClimateZoneId =
  | 'tropical'
  | 'arid'
  | 'temperate'
  | 'mediterranean'
  | 'continental'
  | 'nordic';

export type ClimateSeasonId = 'summer' | 'equinox' | 'winter' | 'storm';

export interface RegionalClimateZone {
  id: ClimateZoneId;
  name: string;
  koppenCode: string;
  referenceCity: string;
  lat: number;
  lon: number;
  summary: string;
  typicalPeakWm2: number;
  tempMinC: number;
  tempMaxC: number;
  sunriseHour: number;
  sunsetHour: number;
  afternoonCloudChance: number; // 0..1
  baseCloudAttenuation: number; // 0..1
}

export interface ClimatePatternResult {
  climateId: ClimateZoneId;
  climateName: string;
  season: ClimateSeasonId;
  referenceCity: string;
  source: 'archive_api' | 'synthetic_model';
  dateLabel: string;
  hourlyIrradianceWm2: number[];
  hourlyTempC: number[];
  hourlyCloudPct: number[];
  peakWm2: number;
  peakSunHoursPerDay: number;
  minTempC: number;
  maxTempC: number;
}

export const REGIONAL_CLIMATE_ZONES: RegionalClimateZone[] = [
  {
    id: 'tropical',
    name: 'Tropical Monsoon',
    koppenCode: 'Aw / Am',
    referenceCity: 'Dhaka',
    lat: 23.8103,
    lon: 90.4125,
    summary: 'High humidity, strong morning insolation, and convective afternoon cloud build-up.',
    typicalPeakWm2: 910,
    tempMinC: 25,
    tempMaxC: 35,
    sunriseHour: 5.5,
    sunsetHour: 18.2,
    afternoonCloudChance: 0.45,
    baseCloudAttenuation: 0.14,
  },
  {
    id: 'arid',
    name: 'Arid Desert',
    koppenCode: 'BWh',
    referenceCity: 'Phoenix',
    lat: 33.4484,
    lon: -112.074,
    summary: 'Ultra-clear skies, peak irradiance above 1,000 W/m², and wide diurnal heat swings.',
    typicalPeakWm2: 1040,
    tempMinC: 21,
    tempMaxC: 44,
    sunriseHour: 5.6,
    sunsetHour: 19.3,
    afternoonCloudChance: 0.05,
    baseCloudAttenuation: 0.04,
  },
  {
    id: 'temperate',
    name: 'Temperate Oceanic',
    koppenCode: 'Cfb',
    referenceCity: 'Munich',
    lat: 48.1351,
    lon: 11.582,
    summary: 'Moderate solar yield, mild ambient temperatures, and frequent passing cloud fronts.',
    typicalPeakWm2: 690,
    tempMinC: 11,
    tempMaxC: 22,
    sunriseHour: 6.2,
    sunsetHour: 19.6,
    afternoonCloudChance: 0.55,
    baseCloudAttenuation: 0.28,
  },
  {
    id: 'mediterranean',
    name: 'Mediterranean',
    koppenCode: 'Csa',
    referenceCity: 'Athens',
    lat: 37.9838,
    lon: 23.7275,
    summary: 'Dry clear afternoons, strong spring-to-autumn solar harvest, mild coastal evenings.',
    typicalPeakWm2: 950,
    tempMinC: 18,
    tempMaxC: 32,
    sunriseHour: 6.0,
    sunsetHour: 19.4,
    afternoonCloudChance: 0.12,
    baseCloudAttenuation: 0.08,
  },
  {
    id: 'continental',
    name: 'Continental',
    koppenCode: 'Dfa',
    referenceCity: 'Chicago',
    lat: 41.8781,
    lon: -87.6298,
    summary: 'Distinct seasonal swings from bright warm summers to cold, low-angle winter days.',
    typicalPeakWm2: 780,
    tempMinC: 8,
    tempMaxC: 24,
    sunriseHour: 6.3,
    sunsetHour: 19.0,
    afternoonCloudChance: 0.35,
    baseCloudAttenuation: 0.2,
  },
  {
    id: 'nordic',
    name: 'Sub-Arctic / Nordic',
    koppenCode: 'Dfb / Dfc',
    referenceCity: 'Oslo',
    lat: 59.9139,
    lon: 10.7522,
    summary: 'Extreme seasonal day-length shifts with crisp cool cell temperatures improving PV efficiency.',
    typicalPeakWm2: 610,
    tempMinC: 4,
    tempMaxC: 16,
    sunriseHour: 5.0,
    sunsetHour: 20.8,
    afternoonCloudChance: 0.42,
    baseCloudAttenuation: 0.24,
  },
];

export const SEASON_OPTIONS: Array<{
  id: ClimateSeasonId;
  label: string;
  monthDay: string; // Representative historical calendar date (MM-DD)
  hint: string;
}> = [
  { id: 'summer', label: 'Summer Peak', monthDay: '07-14', hint: 'Longest daylight & warmest ambient temps' },
  { id: 'equinox', label: 'Spring / Autumn', monthDay: '04-15', hint: 'Balanced 12h daylight & mild thermal profile' },
  { id: 'winter', label: 'Winter Low Sun', monthDay: '01-14', hint: 'Shorter sun arc, lower peak irradiance & cool temps' },
  { id: 'storm', label: 'Cloudy / Monsoon', monthDay: '08-18', hint: 'Heavy cloud attenuation & intermittent solar dips' },
];

// Deterministic PRNG (Mulberry32) so variation seeds produce reproducible engineering runs
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function summarizePattern(
  zone: RegionalClimateZone,
  season: ClimateSeasonId,
  source: 'archive_api' | 'synthetic_model',
  dateLabel: string,
  hourlyIrradianceWm2: number[],
  hourlyTempC: number[],
  hourlyCloudPct: number[]
): ClimatePatternResult {
  const days = Math.max(1, hourlyIrradianceWm2.length / 24);
  const peakWm2 = hourlyIrradianceWm2.length > 0 ? Math.max(...hourlyIrradianceWm2) : 0;
  const totalWhM2 = hourlyIrradianceWm2.reduce((a, b) => a + b, 0);
  const peakSunHoursPerDay = Number((totalWhM2 / 1000 / days).toFixed(2));
  const minTempC = hourlyTempC.length > 0 ? Number(Math.min(...hourlyTempC).toFixed(1)) : 20;
  const maxTempC = hourlyTempC.length > 0 ? Number(Math.max(...hourlyTempC).toFixed(1)) : 30;

  return {
    climateId: zone.id,
    climateName: zone.name,
    season,
    referenceCity: zone.referenceCity,
    source,
    dateLabel,
    hourlyIrradianceWm2,
    hourlyTempC,
    hourlyCloudPct,
    peakWm2,
    peakSunHoursPerDay,
    minTempC,
    maxTempC,
  };
}

/**
 * Generates a realistic, deterministic 24h or 72h historical weather pattern
 * for a chosen regional climate zone and season.
 */
export function simulateRegionalClimatePattern(params: {
  climateId: ClimateZoneId;
  season: ClimateSeasonId;
  horizonHours: HorizonHours;
  seed?: number;
}): ClimatePatternResult {
  const zone =
    REGIONAL_CLIMATE_ZONES.find((z) => z.id === params.climateId) || REGIONAL_CLIMATE_ZONES[0];
  const { season, horizonHours } = params;
  const rng = mulberry32(
    (params.seed ?? 1) * 2654435761 +
      zone.id.charCodeAt(0) * 97 +
      season.charCodeAt(0) * 31 +
      horizonHours
  );

  // Seasonal adjustments scaled by latitude
  const latNorm = Math.min(1, Math.abs(zone.lat) / 60);
  let peakScale = 1.0;
  let dayShiftHours = 0;
  let tempShiftC = 0;
  let cloudBoost = 0;

  if (season === 'summer') {
    peakScale = 1.06;
    dayShiftHours = 0.6 + latNorm * 1.4;
    tempShiftC = 3.5 + latNorm * 4;
    cloudBoost = -0.05;
  } else if (season === 'equinox') {
    peakScale = 0.94;
    dayShiftHours = 0;
    tempShiftC = -1;
    cloudBoost = 0.04;
  } else if (season === 'winter') {
    peakScale = Math.max(0.32, 0.84 - latNorm * 0.45);
    dayShiftHours = -(0.5 + latNorm * 2.1);
    tempShiftC = -(5 + latNorm * 14);
    cloudBoost = 0.14;
  } else if (season === 'storm') {
    peakScale = 0.62;
    dayShiftHours = 0.2;
    tempShiftC = -2.5;
    cloudBoost = 0.42;
  }

  const sunrise = clamp(zone.sunriseHour - dayShiftHours * 0.5, 3.8, 8.8);
  const sunset = clamp(zone.sunsetHour + dayShiftHours * 0.5, 15.2, 22.0);
  const dayLength = Math.max(6, sunset - sunrise);

  const hourlyIrradianceWm2: number[] = [];
  const hourlyTempC: number[] = [];
  const hourlyCloudPct: number[] = [];

  // Create day-level weather variation for multi-day 72h realism
  const dayMods = [0, 1, 2].map((d) => {
    const jitter = (rng() - 0.5) * 0.22;
    if (season === 'storm' && d === 1) return 0.52;
    return clamp(1 + jitter, 0.68, 1.12);
  });

  for (let h = 0; h < horizonHours; h++) {
    const dayIdx = Math.floor(h / 24);
    const hr = h % 24;
    const dayFactor = dayMods[dayIdx] ?? 1.0;

    // Smooth cloud front envelope across hours
    const waveCloud =
      0.5 +
      0.5 *
        Math.sin(h * 0.37 + rng() * 0.4 + dayIdx * 1.9);
    const afternoonConvection =
      hr >= 12 && hr <= 17 ? zone.afternoonCloudChance * (0.4 + rng() * 0.6) : 0;

    const rawCloudFraction = clamp(
      zone.baseCloudAttenuation +
        cloudBoost +
        waveCloud * 0.22 +
        afternoonConvection +
        (rng() - 0.5) * 0.12,
      0,
      0.96
    );

    const cloudPct = Math.round(rawCloudFraction * 100);

    // Clear-sky bell curve between sunrise and sunset
    let irr = 0;
    if (hr >= Math.floor(sunrise) && hr <= Math.ceil(sunset)) {
      const solarPos = clamp((hr + 0.5 - sunrise) / dayLength, 0, 1);
      const bell = Math.pow(Math.sin(solarPos * Math.PI), 1.18);
      const clearSkyWm2 = zone.typicalPeakWm2 * peakScale * bell;
      const cloudTransmit = clamp(1 - rawCloudFraction * 0.78, 0.16, 1.0);
      irr = Math.round(clamp(clearSkyWm2 * cloudTransmit * dayFactor, 0, 1250));
    }

    // Diurnal ambient temperature peaking around 15:00, moderated slightly by cloud cover
    const minT = zone.tempMinC + tempShiftC + (dayFactor - 1) * 3;
    const maxT = zone.tempMaxC + tempShiftC - rawCloudFraction * 3.5 + (dayFactor - 1) * 4;
    const meanT = (minT + maxT) / 2;
    const ampT = Math.max(1.5, (maxT - minT) / 2);
    const diurnal = Math.sin(((hr - 9) / 24) * 2 * Math.PI);
    const temp = Number((meanT + diurnal * ampT + (rng() - 0.5) * 0.6).toFixed(1));

    hourlyIrradianceWm2.push(irr);
    hourlyTempC.push(temp);
    hourlyCloudPct.push(cloudPct);
  }

  return summarizePattern(
    zone,
    season,
    'synthetic_model',
    `Synthetic ${SEASON_OPTIONS.find((s) => s.id === season)?.label ?? season} Profile`,
    hourlyIrradianceWm2,
    hourlyTempC,
    hourlyCloudPct
  );
}

/**
 * Fetches real recorded historical hourly irradiance & temperature from Open-Meteo ERA5 Archive API
 * (free, zero API key) for the climate zone's reference station and season. Falls back cleanly
 * to the deterministic climate synthesizer if offline or rate-limited.
 */
export async function fetchHistoricalClimatePattern(params: {
  climateId: ClimateZoneId;
  season: ClimateSeasonId;
  horizonHours: HorizonHours;
  seed?: number;
}): Promise<ClimatePatternResult> {
  const zone =
    REGIONAL_CLIMATE_ZONES.find((z) => z.id === params.climateId) || REGIONAL_CLIMATE_ZONES[0];
  const seasonMeta =
    SEASON_OPTIONS.find((s) => s.id === params.season) || SEASON_OPTIONS[0];

  // Pick a completed historical year (2024) so ERA5 reanalysis data is always finalized
  const year = 2024;
  const startDate = `${year}-${seasonMeta.monthDay}`;
  const startDt = new Date(`${startDate}T00:00:00Z`);
  const daysNeeded = params.horizonHours === 72 ? 3 : 1;
  const endDt = new Date(startDt.getTime() + (daysNeeded - 1) * 86400_000);
  const endDate = endDt.toISOString().slice(0, 10);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5500);
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${zone.lat.toFixed(4)}&longitude=${zone.lon.toFixed(4)}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&hourly=temperature_2m,cloud_cover,shortwave_radiation&timezone=auto`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Archive HTTP ${res.status}`);

    const data = await res.json();
    const hourly = data?.hourly;
    if (!hourly || !Array.isArray(hourly.shortwave_radiation)) {
      throw new Error('Archive payload missing irradiance series');
    }

    const len = params.horizonHours;
    const rawIrr: number[] = hourly.shortwave_radiation
      .slice(0, len)
      .map((v: unknown) => Math.round(clamp(Number(v) || 0, 0, 1400)));
    const rawTemp: number[] = Array.isArray(hourly.temperature_2m)
      ? hourly.temperature_2m
          .slice(0, len)
          .map((v: unknown) => Number((Number(v) || 24).toFixed(1)))
      : Array.from({ length: len }, () => 25);
    const rawCloud: number[] = Array.isArray(hourly.cloud_cover)
      ? hourly.cloud_cover
          .slice(0, len)
          .map((v: unknown) => Math.round(clamp(Number(v) || 0, 0, 100)))
      : Array.from({ length: len }, () => 25);

    if (rawIrr.length < 24) {
      throw new Error('Archive returned insufficient hourly points');
    }

    while (rawIrr.length < len) {
      rawIrr.push(rawIrr[rawIrr.length % 24] ?? 0);
      rawTemp.push(rawTemp[rawTemp.length % 24] ?? 24);
      rawCloud.push(rawCloud[rawCloud.length % 24] ?? 25);
    }

    return summarizePattern(
      zone,
      params.season,
      'archive_api',
      `ERA5 Historical (${startDate}${daysNeeded > 1 ? ` to ${endDate}` : ''})`,
      rawIrr,
      rawTemp,
      rawCloud
    );
  } catch {
    return simulateRegionalClimatePattern(params);
  }
}

/**
 * Applies a climate pattern's hourly irradiance & temperature onto an existing FabricatedRow[]
 * array, optionally adjusting household HVAC cooling/heating load proportionally to temperature.
 */
export function applyClimatePatternToRows(
  rows: FabricatedRow[],
  pattern: ClimatePatternResult,
  adjustHvacLoad: boolean
): FabricatedRow[] {
  return rows.map((row, idx) => {
    const irr = pattern.hourlyIrradianceWm2[Math.min(idx, pattern.hourlyIrradianceWm2.length - 1)] ?? 0;
    const temp = pattern.hourlyTempC[Math.min(idx, pattern.hourlyTempC.length - 1)] ?? 25;

    let nextLoad = row.loadKw;
    if (adjustHvacLoad) {
      // Gentle physical HVAC adjustment: cooling load rises above 29°C, heating rises below 10°C
      let hvacFactor = 1.0;
      if (temp > 29) {
        hvacFactor = 1 + Math.min(0.45, (temp - 29) * 0.032);
      } else if (temp < 10) {
        hvacFactor = 1 + Math.min(0.38, (10 - temp) * 0.025);
      }
      nextLoad = Number(Math.max(0.1, row.loadKw * hvacFactor).toFixed(2));
    }

    return {
      ...row,
      irradianceWm2: Math.round(clamp(irr, 0, 1400)),
      ambientTempC: Number(temp.toFixed(1)),
      loadKw: nextLoad,
    };
  });
}
