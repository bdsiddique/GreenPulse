import type {
  ObstructionAzimuth,
  ObstructionType,
  ShadowFactorConfig,
  ShadowObstruction,
} from '../types/simulation';

export interface AzimuthSectorMeta {
  id: ObstructionAzimuth;
  label: string;
  windowLabel: string;
  peakHour: number;
  startHour: number;
  endHour: number;
}

export const AZIMUTH_SECTORS: AzimuthSectorMeta[] = [
  {
    id: 'east',
    label: 'East (Morning)',
    windowLabel: '06:00–10:00',
    peakHour: 8,
    startHour: 6,
    endHour: 10,
  },
  {
    id: 'south_east',
    label: 'South-East (Late AM)',
    windowLabel: '09:00–12:00',
    peakHour: 10.5,
    startHour: 9,
    endHour: 12,
  },
  {
    id: 'south',
    label: 'South (Midday)',
    windowLabel: '11:00–14:00',
    peakHour: 12.5,
    startHour: 11,
    endHour: 14,
  },
  {
    id: 'south_west',
    label: 'South-West (Afternoon)',
    windowLabel: '13:00–16:00',
    peakHour: 14.5,
    startHour: 13,
    endHour: 16,
  },
  {
    id: 'west',
    label: 'West (Late PM)',
    windowLabel: '15:00–19:00',
    peakHour: 17,
    startHour: 15,
    endHour: 19,
  },
];

export const OBSTRUCTION_TYPE_META: Record<
  ObstructionType,
  { label: string; defaultDensityPct: number; defaultCoveragePct: number }
> = {
  tree: { label: 'Tree / Foliage', defaultDensityPct: 72, defaultCoveragePct: 55 },
  building: { label: 'Building / Wall', defaultDensityPct: 100, defaultCoveragePct: 70 },
  parapet: { label: 'Parapet / Water Tank', defaultDensityPct: 100, defaultCoveragePct: 40 },
  chimney: { label: 'Chimney / Utility Mast', defaultDensityPct: 95, defaultCoveragePct: 22 },
};

export const QUICK_OBSTRUCTION_TEMPLATES: Array<Omit<ShadowObstruction, 'id'>> = [
  {
    name: 'Mature Tree (East)',
    type: 'tree',
    azimuth: 'east',
    heightAboveArrayM: 10,
    distanceM: 9,
    widthCoveragePct: 60,
    foliageDensityPct: 72,
  },
  {
    name: 'Adjacent Building (West)',
    type: 'building',
    azimuth: 'west',
    heightAboveArrayM: 12,
    distanceM: 11,
    widthCoveragePct: 75,
    foliageDensityPct: 100,
  },
  {
    name: 'Roof Parapet / Tank (South)',
    type: 'parapet',
    azimuth: 'south',
    heightAboveArrayM: 3.2,
    distanceM: 4.5,
    widthCoveragePct: 42,
    foliageDensityPct: 100,
  },
  {
    name: 'Chimney / Mast (SW)',
    type: 'chimney',
    azimuth: 'south_west',
    heightAboveArrayM: 6.5,
    distanceM: 7.0,
    widthCoveragePct: 25,
    foliageDensityPct: 95,
  },
];

export interface ObstructionAnalysis {
  id: string;
  elevationDeg: number;
  peakHourLossPct: number;
  windowLabel: string;
}

export interface ShadowCalculationSummary {
  enabled: boolean;
  obstructionCount: number;
  hourlyCoefficients: number[]; // Length 24 (0.18 to 1.00 multiplier per hour of day)
  dailyEffectiveCoefficient: number; // Irradiance-weighted daylight coefficient (0.18 to 1.00)
  dailyLossPct: number; // 0 to 82%
  worstHour: number | null;
  worstHourLossPct: number;
  perObstruction: Record<string, ObstructionAnalysis>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function createDefaultShadowConfig(): ShadowFactorConfig {
  return {
    enabled: false,
    obstructions: [],
  };
}

export function normalizeShadowConfig(
  raw?: Partial<ShadowFactorConfig> | null
): ShadowFactorConfig {
  if (!raw) return createDefaultShadowConfig();
  const obstructions: ShadowObstruction[] = Array.isArray(raw.obstructions)
    ? raw.obstructions.map((o, idx) => ({
        id: String(o.id || `obs_${idx}`),
        name: String(o.name || 'Obstruction').slice(0, 60),
        type:
          o.type === 'tree' ||
          o.type === 'building' ||
          o.type === 'parapet' ||
          o.type === 'chimney'
            ? o.type
            : 'tree',
        azimuth:
          o.azimuth === 'east' ||
          o.azimuth === 'south_east' ||
          o.azimuth === 'south' ||
          o.azimuth === 'south_west' ||
          o.azimuth === 'west'
            ? o.azimuth
            : 'south',
        heightAboveArrayM: clamp(Number(o.heightAboveArrayM) || 5, 0.2, 60),
        distanceM: clamp(Number(o.distanceM) || 8, 0.5, 100),
        widthCoveragePct: clamp(Number(o.widthCoveragePct) || 50, 5, 100),
        foliageDensityPct: clamp(Number(o.foliageDensityPct) || 85, 15, 100),
      }))
    : [];

  return {
    enabled: Boolean(raw.enabled),
    obstructions,
  };
}

/**
 * Simple clear-sky solar altitude angle (degrees) for hourOfDay (0..23),
 * peaking around 66° near solar noon (12:30).
 */
function estimateSolarAltitudeDeg(hourOfDay: number): number {
  const h = hourOfDay + 0.5;
  if (h <= 5.5 || h >= 19.0) return 0;
  const frac = clamp((h - 5.5) / 13.5, 0, 1);
  return Math.sin(frac * Math.PI) * 66;
}

/**
 * Computes the geometric elevation angle (degrees) of an obstruction relative to the PV array.
 */
export function computeObstructionElevationDeg(
  heightAboveArrayM: number,
  distanceM: number
): number {
  const safeDist = Math.max(0.5, distanceM);
  const safeHeight = Math.max(0, heightAboveArrayM);
  return Number(((Math.atan2(safeHeight, safeDist) * 180) / Math.PI).toFixed(1));
}

/**
 * Evaluates a single obstruction's irradiance attenuation fraction (0..0.78) at a specific hour of day.
 * Diffuse sky radiation (~22%) remains even under 100% direct-beam blockage.
 */
function computeSingleObstructionLossAtHour(
  obs: ShadowObstruction,
  hourOfDay: number
): number {
  const sector =
    AZIMUTH_SECTORS.find((s) => s.id === obs.azimuth) || AZIMUTH_SECTORS[2];

  // Check if hour falls within the obstruction's azimuth sector (with 1h soft edge falloff)
  if (hourOfDay < sector.startHour - 1 || hourOfDay > sector.endHour) {
    return 0;
  }

  let azimuthWeight = 1.0;
  if (hourOfDay < sector.startHour) {
    azimuthWeight = 0.45;
  } else if (hourOfDay === sector.endHour) {
    azimuthWeight = 0.45;
  } else {
    const halfSpan = Math.max(1, (sector.endHour - sector.startHour) / 2);
    const distFromPeak = Math.abs(hourOfDay + 0.5 - sector.peakHour);
    azimuthWeight = clamp(1 - (distFromPeak / (halfSpan + 1.2)) * 0.35, 0.55, 1.0);
  }

  const sunAlt = estimateSolarAltitudeDeg(hourOfDay);
  if (sunAlt <= 0) return 0;

  const obsElev = computeObstructionElevationDeg(obs.heightAboveArrayM, obs.distanceM);

  // Determine vertical shadow overlap (full if sun below obstruction horizon, smooth penumbra 6° above)
  let elevationOverlap = 0;
  if (obsElev >= sunAlt) {
    elevationOverlap = 1.0;
  } else if (sunAlt - obsElev < 6) {
    elevationOverlap = (6 - (sunAlt - obsElev)) / 6;
  } else {
    return 0;
  }

  const coverageFrac = clamp(obs.widthCoveragePct, 5, 100) / 100;
  const densityFrac = clamp(obs.foliageDensityPct, 15, 100) / 100;
  // Direct beam is ~78% of GHI on typical clear/mixed days; diffuse (~22%) still reaches array
  const directBeamFraction = 0.78;

  return clamp(
    elevationOverlap * azimuthWeight * coverageFrac * densityFrac * directBeamFraction,
    0,
    0.78
  );
}

/**
 * Evaluates full 24-hour shadow transmission coefficients and daily weighted reduction metrics.
 */
export function evaluateShadowConfig(
  rawConfig?: ShadowFactorConfig | null
): ShadowCalculationSummary {
  const cfg = normalizeShadowConfig(rawConfig);
  const hourlyCoefficients: number[] = [];
  const perObstruction: Record<string, ObstructionAnalysis> = {};

  for (const obs of cfg.obstructions) {
    const sector =
      AZIMUTH_SECTORS.find((s) => s.id === obs.azimuth) || AZIMUTH_SECTORS[2];
    let peakLoss = 0;
    for (let h = 6; h <= 18; h++) {
      const loss = computeSingleObstructionLossAtHour(obs, h);
      if (loss > peakLoss) peakLoss = loss;
    }
    perObstruction[obs.id] = {
      id: obs.id,
      elevationDeg: computeObstructionElevationDeg(obs.heightAboveArrayM, obs.distanceM),
      peakHourLossPct: Number((peakLoss * 100).toFixed(1)),
      windowLabel: sector.windowLabel,
    };
  }

  let weightedBaseSum = 0;
  let weightedShadedSum = 0;
  let worstHour: number | null = null;
  let worstHourLossPct = 0;

  for (let h = 0; h < 24; h++) {
    let transmit = 1.0;
    if (cfg.enabled && cfg.obstructions.length > 0) {
      for (const obs of cfg.obstructions) {
        const loss = computeSingleObstructionLossAtHour(obs, h);
        transmit *= 1 - loss;
      }
      transmit = clamp(transmit, 0.18, 1.0);
    }

    const roundedTransmit = Number(transmit.toFixed(3));
    hourlyCoefficients.push(roundedTransmit);

    // Weight daily average by clear-sky solar bell so midday shadows count proportionally more than twilight
    const sunAlt = estimateSolarAltitudeDeg(h);
    if (sunAlt > 0) {
      const weight = Math.sin((sunAlt * Math.PI) / 180);
      weightedBaseSum += weight;
      weightedShadedSum += weight * roundedTransmit;

      const lossPct = (1 - roundedTransmit) * 100;
      if (lossPct > worstHourLossPct + 0.05) {
        worstHourLossPct = Number(lossPct.toFixed(1));
        worstHour = h;
      }
    }
  }

  const dailyEffectiveCoefficient =
    weightedBaseSum > 0
      ? Number((weightedShadedSum / weightedBaseSum).toFixed(3))
      : 1.0;
  const dailyLossPct = Number(((1 - dailyEffectiveCoefficient) * 100).toFixed(1));

  return {
    enabled: cfg.enabled,
    obstructionCount: cfg.obstructions.length,
    hourlyCoefficients,
    dailyEffectiveCoefficient,
    dailyLossPct,
    worstHour,
    worstHourLossPct,
    perObstruction,
  };
}

/**
 * Fast helper used by the dispatch engine and Fabricated Data Studio for a single hour of day.
 */
export function getHourlyShadowCoefficient(
  shadowConfig: ShadowFactorConfig | undefined | null,
  hourOfDay: number
): number {
  if (!shadowConfig || !shadowConfig.enabled || shadowConfig.obstructions.length === 0) {
    return 1.0;
  }
  const h = ((Math.floor(hourOfDay) % 24) + 24) % 24;
  let transmit = 1.0;
  for (const obs of shadowConfig.obstructions) {
    transmit *= 1 - computeSingleObstructionLossAtHour(obs, h);
  }
  return clamp(transmit, 0.18, 1.0);
}
