import type { SolarIrradiationPreset } from '../types/simulation';

export interface SolarCurveParams {
  peakIrradianceWm2: number;
  sunriseHour: number;
  sunsetHour: number;
  cloudAttenuationPct: number;
  middayDipEnabled: boolean;
  middayDipStartHour: number;
  middayDipDurationHours: number;
  middayDipDropPct: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function computePeakSunHours(hourlyWm2: number[]): number {
  const sum = hourlyWm2.reduce((acc, v) => acc + Math.max(0, Number(v) || 0), 0);
  return Math.round((sum / 1000) * 100) / 100;
}

export function generateHourlyIrradianceWm2(params: SolarCurveParams): number[] {
  const peak = clamp(Number(params.peakIrradianceWm2) || 0, 0, 1400);
  const sunrise = clamp(Number(params.sunriseHour) || 6, 3, 11);
  const sunset = clamp(Number(params.sunsetHour) || 18, sunrise + 2, 22);
  const cloudKeep = 1 - clamp(Number(params.cloudAttenuationPct) || 0, 0, 95) / 100;
  const dipStart = clamp(Number(params.middayDipStartHour) || 12, 6, 18);
  const dipEnd = dipStart + clamp(Number(params.middayDipDurationHours) || 2, 1, 10);
  const dipKeep = 1 - clamp(Number(params.middayDipDropPct) || 0, 0, 95) / 100;

  const span = sunset - sunrise;
  const arr: number[] = [];

  for (let h = 0; h < 24; h++) {
    // Evaluate at midpoint of hour (+0.5) for smooth diurnal bell
    const t = h + 0.5;
    if (t <= sunrise || t >= sunset) {
      arr.push(0);
      continue;
    }
    const angle = ((t - sunrise) / span) * Math.PI;
    const bell = Math.pow(Math.max(0, Math.sin(angle)), 1.22);
    let wm2 = peak * bell * cloudKeep;

    if (params.middayDipEnabled) {
      if (h >= dipStart && h < dipEnd) {
        wm2 *= dipKeep;
      } else if (h === dipStart - 1 || h === dipEnd) {
        wm2 *= (1 + dipKeep) / 2;
      }
    }

    arr.push(Math.round(clamp(wm2, 0, 1400)));
  }

  return arr;
}

function buildBuiltinPreset(
  id: string,
  name: string,
  locationTag: string,
  description: string,
  params: SolarCurveParams,
  performanceRatioPct: number
): SolarIrradiationPreset {
  const hourlyWm2 = generateHourlyIrradianceWm2(params);
  return {
    id,
    name,
    locationTag,
    description,
    isBuiltIn: true,
    ...params,
    performanceRatioPct,
    isCustomHourly: false,
    hourlyWm2,
    peakSunHours: computePeakSunHours(hourlyWm2),
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export const BUILTIN_SOLAR_PRESETS: SolarIrradiationPreset[] = [
  buildBuiltinPreset(
    'solar_dhaka_summer',
    'Dhaka Summer Clear',
    'Dhaka · Dry Summer',
    'High pre-monsoon solar irradiation with 12.5h daylight and minimal cloud cover.',
    {
      peakIrradianceWm2: 950,
      sunriseHour: 5.5,
      sunsetHour: 18.5,
      cloudAttenuationPct: 4,
      middayDipEnabled: false,
      middayDipStartHour: 12,
      middayDipDurationHours: 2,
      middayDipDropPct: 50,
    },
    84
  ),
  buildBuiltinPreset(
    'solar_dhaka_winter',
    'Dhaka Winter Hazy',
    'Dhaka · Dec–Jan',
    'Shorter winter daylight window with morning mist and moderate midday haze.',
    {
      peakIrradianceWm2: 680,
      sunriseHour: 6.5,
      sunsetHour: 17.5,
      cloudAttenuationPct: 16,
      middayDipEnabled: false,
      middayDipStartHour: 12,
      middayDipDurationHours: 2,
      middayDipDropPct: 40,
    },
    86
  ),
  buildBuiltinPreset(
    'solar_monsoon_dip',
    'Monsoon Passing Squall',
    'Bengal · Jul–Aug',
    'Bright morning irradiance interrupted by a sharp 3-hour midday monsoon cloud deck.',
    {
      peakIrradianceWm2: 860,
      sunriseHour: 5.5,
      sunsetHour: 18.5,
      cloudAttenuationPct: 12,
      middayDipEnabled: true,
      middayDipStartHour: 11,
      middayDipDurationHours: 3,
      middayDipDropPct: 74,
    },
    82
  ),
  buildBuiltinPreset(
    'solar_heavy_overcast',
    'Heavy Overcast Rainy Day',
    'Bengal · Deep Monsoon',
    'Sustained low diffuse irradiance testing off-grid battery autonomy and reserve depth.',
    {
      peakIrradianceWm2: 460,
      sunriseHour: 6,
      sunsetHour: 18,
      cloudAttenuationPct: 48,
      middayDipEnabled: false,
      middayDipStartHour: 12,
      middayDipDurationHours: 3,
      middayDipDropPct: 55,
    },
    82
  ),
];

export function createEmptySolarPresetDraft(): SolarIrradiationPreset {
  const params: SolarCurveParams = {
    peakIrradianceWm2: 880,
    sunriseHour: 6,
    sunsetHour: 18,
    cloudAttenuationPct: 8,
    middayDipEnabled: false,
    middayDipStartHour: 12,
    middayDipDurationHours: 2,
    middayDipDropPct: 60,
  };
  const hourlyWm2 = generateHourlyIrradianceWm2(params);
  return {
    id: '',
    name: 'Custom Solar Profile',
    locationTag: 'Dhaka · Rooftop',
    description: 'Custom calibrated 24-hour irradiance profile.',
    isBuiltIn: false,
    ...params,
    performanceRatioPct: 84,
    isCustomHourly: false,
    hourlyWm2,
    peakSunHours: computePeakSunHours(hourlyWm2),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeSolarPreset(
  raw: Partial<SolarIrradiationPreset>
): SolarIrradiationPreset {
  const draft = createEmptySolarPresetDraft();
  const merged: SolarIrradiationPreset = {
    ...draft,
    ...raw,
  };
  const hourlyWm2 =
    Array.isArray(raw.hourlyWm2) && raw.hourlyWm2.length === 24
      ? raw.hourlyWm2.map((v) => Math.round(clamp(Number(v) || 0, 0, 1400)))
      : generateHourlyIrradianceWm2(merged);
  return {
    ...merged,
    hourlyWm2,
    peakSunHours: computePeakSunHours(hourlyWm2),
  };
}
