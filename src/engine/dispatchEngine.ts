import type {
  FabricatedRow,
  HorizonHours,
  HourlyInputStep,
  HourlyStepResult,
  LoadArchetype,
  LongevityProjectionPoint,
  SimulationConfig,
  SimulationResult,
  SimulationSummary,
  StepEventTag,
} from '../types/simulation';
import { normalizeConfig } from './presets';
import { calculatePvOutputKw } from './solarPanels';
import { getHourlyShadowCoefficient } from './shadowFactor';

// Normalized 24-hour shape factors (mean === 1.0)
const LOAD_SHAPES: Record<LoadArchetype, number[]> = {
  residential_evening: [
    0.58, 0.52, 0.48, 0.46, 0.48, 0.58, 0.85, 1.08, 1.02, 0.88, 0.84, 0.90,
    0.96, 0.94, 0.90, 0.96, 1.15, 1.48, 1.72, 1.78, 1.62, 1.38, 1.04, 0.88,
  ],
  work_from_home: [
    0.55, 0.50, 0.48, 0.47, 0.50, 0.62, 0.88, 1.10, 1.24, 1.28, 1.26, 1.22,
    1.20, 1.18, 1.16, 1.18, 1.24, 1.38, 1.44, 1.38, 1.22, 1.02, 0.82, 0.68,
  ],
  flat_baseload: [
    0.94, 0.92, 0.91, 0.90, 0.91, 0.94, 0.98, 1.02, 1.04, 1.05, 1.06, 1.07,
    1.07, 1.06, 1.05, 1.05, 1.06, 1.07, 1.06, 1.04, 1.01, 0.98, 0.96, 0.95,
  ],
  commercial_daytime: [
    0.34, 0.32, 0.31, 0.30, 0.32, 0.40, 0.62, 0.98, 1.42, 1.68, 1.78, 1.82,
    1.76, 1.74, 1.70, 1.64, 1.48, 1.12, 0.78, 0.58, 0.48, 0.44, 0.40, 0.39,
  ],
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function formatHourClock(hourIndex: number, horizon: HorizonHours): {
  dayIndex: number;
  hourOfDay: number;
  clockLabel: string;
  shortLabel: string;
} {
  const dayIndex = Math.floor(hourIndex / 24) + 1;
  const hourOfDay = hourIndex % 24;
  const hh = String(hourOfDay).padStart(2, '0');
  const clockLabel = horizon > 24 ? `Day ${dayIndex} · ${hh}:00` : `${hh}:00`;
  const shortLabel = horizon > 24 ? `D${dayIndex} ${hh}h` : `${hh}:00`;
  return { dayIndex, hourOfDay, clockLabel, shortLabel };
}

function isHourInPeak(hourOfDay: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) {
    return hourOfDay >= start && hourOfDay < end;
  }
  return hourOfDay >= start || hourOfDay < end;
}

function computeSolarMultiplier(
  hourOfDay: number,
  dayIndex: number,
  config: SimulationConfig
): { mult: number; isMonsoonDrop: boolean } {
  if (hourOfDay < 6 || hourOfDay >= 19) {
    return { mult: 0, isMonsoonDrop: false };
  }
  const solarAngle = ((hourOfDay - 5.5) / 13) * Math.PI;
  const baseBell = Math.max(0, Math.sin(solarAngle));
  let mult = Math.pow(baseBell, 1.25) * 0.86;
  let isMonsoonDrop = false;

  if (config.weatherProfile === 'partly_cloudy') {
    const cloudRipple = 0.78 + 0.16 * Math.sin(hourOfDay * 1.45 + dayIndex * 0.9);
    mult *= clamp(cloudRipple, 0.55, 0.95);
  } else if (config.weatherProfile === 'monsoon_drop') {
    const dropEnd = config.cloudDropStartHour + config.cloudDropDurationHours;
    if (hourOfDay >= config.cloudDropStartHour && hourOfDay < dropEnd) {
      const keepFactor = 1 - clamp(config.cloudDropSeverityPct, 10, 95) / 100;
      mult *= keepFactor;
      isMonsoonDrop = true;
    } else if (hourOfDay === config.cloudDropStartHour - 1 || hourOfDay === dropEnd) {
      mult *= 0.76;
    }
  } else if (config.weatherProfile === 'overcast_multi_day') {
    if (dayIndex === 1) mult *= 0.78;
    else if (dayIndex === 2) {
      mult *= 0.28;
      isMonsoonDrop = true;
    } else {
      mult *= 0.58;
    }
  }

  return { mult, isMonsoonDrop };
}

function computeAmbientTempC(hourOfDay: number, config: SimulationConfig): {
  tempC: number;
  isHeatwave: boolean;
  isColdSnap: boolean;
} {
  // Smooth diurnal swing peaking around 15:00
  const diurnalWave = Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI); // -1 at 03:00, +1 at 15:00
  let baseTemp = 26 + diurnalWave * 4.5; // 21.5°C night -> 30.5°C afternoon
  let isHeatwave = false;
  let isColdSnap = false;

  const { heatwaveSpike, coldSnap } = config.stressTests;

  if (heatwaveSpike.enabled) {
    // Heatwave elevates midday/evening temperature toward peakTempC
    const peak = clamp(heatwaveSpike.peakTempC, 34, 55);
    const nightFloor = Math.max(28, peak - 9);
    const heatSwing = (peak - nightFloor) / 2;
    baseTemp = nightFloor + heatSwing + diurnalWave * heatSwing;
    isHeatwave = hourOfDay >= 10 && hourOfDay <= 21;
  } else if (coldSnap.enabled) {
    const minT = clamp(coldSnap.minTempC, -25, 10);
    const dayMax = minT + 7;
    const coldSwing = (dayMax - minT) / 2;
    baseTemp = minT + coldSwing + diurnalWave * coldSwing;
    isColdSnap = true;
  }

  return { tempC: round2(baseTemp), isHeatwave, isColdSnap };
}

export function generateParametricInputs(rawConfig: SimulationConfig): HourlyInputStep[] {
  const config = normalizeConfig(rawConfig);
  const steps: HourlyInputStep[] = [];
  const shape = LOAD_SHAPES[config.loadArchetype] || LOAD_SHAPES.residential_evening;
  const rawMean = shape.reduce((a, b) => a + b, 0) / shape.length;
  const peakContrast = clamp((config.loadPeakFactor - 1.0) / 0.7, 0.2, 2.2);

  const { cloudyStreak, heatwaveSpike, monsoonSquall, coldSnap, loadSurge, priceSpike } =
    config.stressTests;
  const effectivePvCap = config.plugModules.pvEnabled ? config.pvCapacityKw : 0;
  const forecast = config.appliedWeatherForecast;

  for (let h = 0; h < config.horizonHours; h++) {
    const { dayIndex, hourOfDay, clockLabel, shortLabel } = formatHourClock(
      h,
      config.horizonHours
    );

    let isMonsoonDrop = false;
    let irradianceWm2 = 0;

    if (forecast && Array.isArray(forecast.hourlyIrradianceWm2) && forecast.hourlyIrradianceWm2.length > 0) {
      const fIdx = Math.min(h, forecast.hourlyIrradianceWm2.length - 1);
      irradianceWm2 = Math.max(0, Number(forecast.hourlyIrradianceWm2[fIdx]) || 0);
      const cloudPct = Number(forecast.hourlyCloudPct?.[fIdx] ?? 0);
      if (cloudPct >= 75 && hourOfDay >= 9 && hourOfDay <= 16) {
        isMonsoonDrop = true;
      }
    } else if (config.solarPresetSnapshot && Array.isArray(config.solarPresetSnapshot.hourlyWm2)) {
      const preset = config.solarPresetSnapshot;
      irradianceWm2 = Math.max(0, Number(preset.hourlyWm2[hourOfDay]) || 0);
      if (
        preset.middayDipEnabled &&
        hourOfDay >= preset.middayDipStartHour &&
        hourOfDay < preset.middayDipStartHour + preset.middayDipDurationHours
      ) {
        isMonsoonDrop = true;
      }
    } else {
      const legacy = computeSolarMultiplier(hourOfDay, dayIndex, config);
      isMonsoonDrop = legacy.isMonsoonDrop;
      irradianceWm2 = Math.round((legacy.mult / 0.86) * 1000);
    }

    const baseAmbient = computeAmbientTempC(hourOfDay, config);
    let tempC = baseAmbient.tempC;
    const isHeatwave = baseAmbient.isHeatwave;
    const isColdSnap = baseAmbient.isColdSnap;
    if (
      forecast &&
      Array.isArray(forecast.hourlyTempC) &&
      forecast.hourlyTempC.length > 0 &&
      !heatwaveSpike.enabled &&
      !coldSnap.enabled
    ) {
      const fIdx = Math.min(h, forecast.hourlyTempC.length - 1);
      tempC = round2(Number(forecast.hourlyTempC[fIdx]) || tempC);
    }

    let isCloudyStreak = false;
    let isMonsoonSquall = false;

    // Extreme Weather 1: Cloudy Streak
    if (
      cloudyStreak.enabled &&
      h >= cloudyStreak.startHour &&
      h < cloudyStreak.startHour + cloudyStreak.durationHours
    ) {
      const keep = 1 - clamp(cloudyStreak.irradianceDropPct, 10, 96) / 100;
      irradianceWm2 *= keep;
      isCloudyStreak = true;
    }

    // Extreme Weather 3: Monsoon Squall (severe solar blackout + optional feeder trip)
    if (
      monsoonSquall.enabled &&
      h >= monsoonSquall.startHour &&
      h < monsoonSquall.startHour + monsoonSquall.durationHours
    ) {
      irradianceWm2 *= 0.14;
      isMonsoonSquall = true;
    }

    // Apply Site Shadow Factor Reduction Coefficient (trees / structures)
    const shadowCoeff = getHourlyShadowCoefficient(config.shadowConfig, hourOfDay);
    irradianceWm2 = Math.round(clamp(irradianceWm2 * shadowCoeff, 0, 1400));

    // Calculate physical PV generation from solar irradiation, installed kWp, ambient temp, and selected panel specs
    const panelCalc = calculatePvOutputKw({
      irradianceWm2,
      pvCapacityKw: effectivePvCap,
      ambientTempC: tempC,
      panel: config.solarPanelSnapshot,
      pvEnabled: config.plugModules.pvEnabled,
    });
    let pvRawKw = panelCalc.pvKw;

    // Extreme Weather 2: Extra Heatwave PV thermal stress derating beyond NOCT
    if (heatwaveSpike.enabled && hourOfDay >= 10 && hourOfDay <= 17) {
      const thermalKeep = 1 - clamp(heatwaveSpike.pvThermalDeratePct, 0, 40) / 100;
      pvRawKw = round2(pvRawKw * thermalKeep);
    }

    const normalized = shape[hourOfDay] / rawMean;
    const shaped = Math.max(0.18, 1 + (normalized - 1) * peakContrast);
    const dayDrift = dayIndex === 2 ? 1.05 : dayIndex === 3 ? 0.96 : 1.0;
    let loadKw = Math.max(0.1, config.householdAvgKw * shaped * dayDrift);

    // Heatwave HVAC cooling surge (peaks 11:00–22:00)
    if (heatwaveSpike.enabled) {
      const surgeFraction =
        hourOfDay >= 11 && hourOfDay <= 21
          ? 1.0
          : hourOfDay >= 8 && hourOfDay <= 23
            ? 0.55
            : 0.25;
      loadKw *= 1 + (clamp(heatwaveSpike.loadSurgePct, 0, 120) / 100) * surgeFraction;
    }

    // Cold snap heating load boost overnight/morning
    if (coldSnap.enabled && (hourOfDay <= 8 || hourOfDay >= 19)) {
      loadKw *= 1.22;
    }

    // Extreme Grid Stress: Load Surge Event
    let isLoadSurge = false;
    if (
      loadSurge.enabled &&
      h >= loadSurge.startHour &&
      h < loadSurge.startHour + loadSurge.durationHours
    ) {
      loadKw *= clamp(loadSurge.surgeMultiplier, 1.1, 4.0);
      isLoadSurge = true;
    }

    loadKw = round2(loadKw);

    const matchedOutage = config.outageWindows.find(
      (w) => h >= w.startHour && h < w.endHour
    );

    const squallTrippedGrid = isMonsoonSquall && monsoonSquall.gridTrip;
    const gridOnline =
      config.plugModules.gridEnabled && !matchedOutage && !squallTrippedGrid;

    const outageLabel = !config.plugModules.gridEnabled
      ? 'Grid Module Unplugged (Off-Grid)'
      : squallTrippedGrid
        ? 'Monsoon Squall Feeder Trip'
        : matchedOutage
          ? matchedOutage.label
          : null;

    const isPeakTariff =
      config.touEnabled &&
      isHourInPeak(hourOfDay, config.peakStartHour, config.peakEndHour);
    let importRate = isPeakTariff ? config.peakRate : config.offPeakRate;

    // Extreme Grid Stress: Variable Pricing Spike Event
    let isPriceSpike = false;
    if (
      priceSpike.enabled &&
      h >= priceSpike.startHour &&
      h < priceSpike.startHour + priceSpike.durationHours
    ) {
      importRate = round2(importRate * clamp(priceSpike.multiplier, 1.2, 6.0));
      isPriceSpike = true;
    }

    const exportRate = config.netMeteringInstalled ? config.exportCreditRate : 0;

    steps.push({
      hour: h,
      dayIndex,
      hourOfDay,
      clockLabel,
      shortLabel,
      irradianceWm2,
      pvRawKw,
      loadKw,
      gridOnline,
      importRate,
      exportRate,
      ambientTempC: tempC,
      isPeakTariff,
      isMonsoonDrop,
      isCloudyStreak,
      isHeatwave,
      isMonsoonSquall,
      isColdSnap,
      isLoadSurge,
      isPriceSpike,
      outageLabel,
    });
  }

  return steps;
}

export function normalizeFabricatedRow(
  row: Partial<FabricatedRow>,
  hourIndex: number,
  pvCapacityKw: number
): FabricatedRow {
  const hasIrradiance =
    typeof row.irradianceWm2 === 'number' && !Number.isNaN(row.irradianceWm2);
  let irradianceWm2 = hasIrradiance ? Math.round(clamp(row.irradianceWm2!, 0, 1400)) : 0;
  // Backwards compatibility for legacy saved runs that only stored pvKw
  if (!hasIrradiance && typeof row.pvKw === 'number' && row.pvKw > 0 && pvCapacityKw > 0.05) {
    irradianceWm2 = Math.round(clamp((row.pvKw / (pvCapacityKw * 0.85)) * 1000, 0, 1400));
  }
  return {
    hour: hourIndex,
    irradianceWm2,
    loadKw: round2(Math.max(0, Number(row.loadKw) || 0)),
    gridOnline: row.gridOnline !== undefined ? Boolean(row.gridOnline) : true,
    importRate: round2(Math.max(0, Number(row.importRate) || 0)),
    exportRate: round2(Math.max(0, Number(row.exportRate) || 0)),
    ...(typeof row.ambientTempC === 'number' && !Number.isNaN(row.ambientTempC)
      ? { ambientTempC: round2(row.ambientTempC) }
      : {}),
  };
}

export function buildFabricatedRowsFromParametric(
  config: SimulationConfig
): FabricatedRow[] {
  const inputs = generateParametricInputs({ ...config, inputMode: 'parametric' });
  return inputs.map((step) => ({
    hour: step.hour,
    irradianceWm2: step.irradianceWm2,
    loadKw: step.loadKw,
    gridOnline: step.gridOnline,
    importRate: step.importRate,
    exportRate: step.exportRate,
    ambientTempC: step.ambientTempC,
  }));
}

export function ensureFabricatedRows(config: SimulationConfig): FabricatedRow[] {
  const expected = config.horizonHours;
  if (config.fabricatedRows && config.fabricatedRows.length === expected) {
    return config.fabricatedRows.map((row, idx) =>
      normalizeFabricatedRow(row, idx, config.pvCapacityKw)
    );
  }
  const seeded = buildFabricatedRowsFromParametric(config);
  if (!config.fabricatedRows || config.fabricatedRows.length === 0) {
    return seeded;
  }
  return seeded.map((fallbackRow, idx) => {
    const existing = config.fabricatedRows[idx % config.fabricatedRows.length];
    if (!existing) return fallbackRow;
    return normalizeFabricatedRow(existing, idx, config.pvCapacityKw);
  });
}

function resolveInputSteps(config: SimulationConfig): HourlyInputStep[] {
  if (config.inputMode !== 'fabricated') {
    return generateParametricInputs(config);
  }
  const rows = ensureFabricatedRows(config);
  return rows.map((row, idx) => {
    const { dayIndex, hourOfDay, clockLabel, shortLabel } = formatHourClock(
      idx,
      config.horizonHours
    );
    const ambientCalc = computeAmbientTempC(hourOfDay, config);
    const tempC =
      typeof row.ambientTempC === 'number' && !Number.isNaN(row.ambientTempC)
        ? row.ambientTempC
        : ambientCalc.tempC;
    const isPeakTariff =
      config.touEnabled &&
      isHourInPeak(hourOfDay, config.peakStartHour, config.peakEndHour);
    const gridOnline = config.plugModules.gridEnabled && Boolean(row.gridOnline);
    const rawIrradianceWm2 = Math.round(clamp(Number(row.irradianceWm2) || 0, 0, 1400));
    const shadowCoeff = getHourlyShadowCoefficient(config.shadowConfig, hourOfDay);
    const irradianceWm2 = Math.round(clamp(rawIrradianceWm2 * shadowCoeff, 0, 1400));

    // Dynamically calculate PV output from irradiance + installed solar capacity + selected panel specs
    const panelCalc = calculatePvOutputKw({
      irradianceWm2,
      pvCapacityKw: config.pvCapacityKw,
      ambientTempC: tempC,
      panel: config.solarPanelSnapshot,
      pvEnabled: config.plugModules.pvEnabled,
    });

    return {
      hour: idx,
      dayIndex,
      hourOfDay,
      clockLabel,
      shortLabel,
      irradianceWm2,
      pvRawKw: panelCalc.pvKw,
      loadKw: Math.max(0, Number(row.loadKw) || 0),
      gridOnline,
      importRate: Math.max(0, Number(row.importRate) || 0),
      exportRate: Math.max(0, Number(row.exportRate) || 0),
      ambientTempC: tempC,
      isPeakTariff,
      isMonsoonDrop: false,
      isCloudyStreak: false,
      isHeatwave: ambientCalc.isHeatwave,
      isMonsoonSquall: false,
      isColdSnap: ambientCalc.isColdSnap,
      isLoadSurge: false,
      isPriceSpike: false,
      outageLabel: !config.plugModules.gridEnabled
        ? 'Grid Module Unplugged (Off-Grid)'
        : row.gridOnline
          ? null
          : 'Fabricated Grid Outage',
    };
  });
}

export function solveSimulation(rawConfig: SimulationConfig): SimulationResult {
  const config = normalizeConfig(rawConfig);
  const inputs = resolveInputSteps(config);

  const invEff = clamp(config.inverterEfficiencyPct, 70, 100) / 100;
  const rtEff = clamp(config.batteryRoundTripEffPct, 65, 100) / 100;
  const chargeEff = Math.sqrt(rtEff);
  const dischargeEff = Math.sqrt(rtEff);

  // Plug-and-play Battery Module + Cold Snap capacity derating
  const nominalBattCap = config.plugModules.batteryEnabled
    ? Math.max(0, config.batteryCapacityKwh)
    : 0;
  const coldDerateFactor = config.stressTests.coldSnap.enabled
    ? 1 - clamp(config.stressTests.coldSnap.capacityDeratePct, 0, 45) / 100
    : 1.0;
  const battCap = nominalBattCap * coldDerateFactor;

  const minReserveKwh = battCap * (clamp(config.batteryMinReserveSocPct, 0, 90) / 100);
  let batteryEnergyKwh = battCap * (clamp(config.batteryInitialSocPct, 0, 100) / 100);

  const invRated = Math.max(0.5, config.inverterRatedKw);
  const maxChgKw = config.plugModules.batteryEnabled ? Math.max(0, config.batteryMaxChargeKw) : 0;
  const maxDisKw = config.plugModules.batteryEnabled ? Math.max(0, config.batteryMaxDischargeKw) : 0;
  const gridPeakCap = config.plugModules.gridEnabled ? Math.max(0, config.permittedGridPeakKw) : 0;

  const steps: HourlyStepResult[] = [];

  let totalPvYieldKwh = 0;
  let totalPvDirectKwh = 0;
  let totalPvToBatteryKwh = 0;
  let totalPvExportedKwh = 0;
  let totalCurtailedPvKwh = 0;

  let totalLoadKwh = 0;
  let totalServedLoadKwh = 0;
  let totalUnservedLoadKwh = 0;

  let totalBatteryChargedKwh = 0;
  let totalBatteryDischargedKwh = 0;
  let minBatterySocPct = battCap > 0 ? (batteryEnergyKwh / battCap) * 100 : 0;

  // Longevity accumulators
  let peakBatteryCellTempC = 25;
  let thermalStressSum = 0;
  let cumulativeDegradationPct = 0;
  let baselineDegradationPct = 0;

  let totalGridImportKwh = 0;
  let totalGridExportKwh = 0;
  let peakGridImportKw = 0;
  let gridCapBreachHours = 0;
  let maxGridCapOvershootKw = 0;
  let worstBreachHour: number | null = null;
  let worstUnservedHour: number | null = null;
  let maxUnservedAtHour = 0;

  let outageHoursTotal = 0;
  let outageHoursSurvived = 0;

  let totalImportCost = 0;
  let totalExportCredit = 0;
  let cumulativeNetCost = 0;
  let baselineGridOnlyCost = 0;

  for (const step of inputs) {
    const activeEvents: StepEventTag[] = [];
    if (!step.gridOnline) activeEvents.push('OUTAGE');
    if (step.isMonsoonDrop) activeEvents.push('MONSOON_DROP');
    if (step.isCloudyStreak) activeEvents.push('CLOUDY_STREAK');
    if (step.isHeatwave) activeEvents.push('HEATWAVE_SPIKE');
    if (step.isMonsoonSquall) activeEvents.push('MONSOON_SQUALL');
    if (step.isColdSnap) activeEvents.push('COLD_SNAP');
    if (step.isLoadSurge) activeEvents.push('LOAD_SURGE');
    if (step.isPriceSpike) activeEvents.push('PRICE_SPIKE');
    if (step.isPeakTariff) activeEvents.push('PEAK_TARIFF');

    const pvAvailableKw = step.pvRawKw;
    const loadKw = step.loadKw;

    // 1. Direct PV self-consumption
    const maxPvAcKw = Math.min(pvAvailableKw * invEff, invRated);
    const pvUsedDirectKw = Math.min(loadKw, maxPvAcKw);
    const pvRawUsedForDirect = invEff > 0 ? pvUsedDirectKw / invEff : 0;
    let pvSurplusRawKw = Math.max(0, pvAvailableKw - pvRawUsedForDirect);

    let batteryChargeKw = 0;
    let batteryDischargeKw = 0;
    let pvToBatteryKw = 0;
    let pvExportedKw = 0;
    let pvCurtailedKw = 0;
    let gridImportKw = 0;
    let gridExportKw = 0;
    let gridCapBreachKw = 0;
    let unservedLoadKw = 0;

    // 2. Surplus PV -> Battery Charge -> Net-Metering Export -> Curtailment
    if (pvSurplusRawKw > 0.0001) {
      if (battCap > 0 && maxChgKw > 0) {
        const batteryHeadroomKwh = Math.max(0, battCap - batteryEnergyKwh);
        const maxInputForHeadroom = chargeEff > 0 ? batteryHeadroomKwh / chargeEff : 0;
        pvToBatteryKw = Math.min(pvSurplusRawKw, maxChgKw, maxInputForHeadroom);
        batteryChargeKw = pvToBatteryKw;
        batteryEnergyKwh += pvToBatteryKw * chargeEff;
        pvSurplusRawKw = Math.max(0, pvSurplusRawKw - pvToBatteryKw);
      }

      if (pvSurplusRawKw > 0.0001) {
        const exportableAcKw = pvSurplusRawKw * invEff;
        const inverterHeadroomKw = Math.max(0, invRated - pvUsedDirectKw);
        const canExport =
          step.gridOnline &&
          config.netMeteringInstalled &&
          !config.zeroExportEnabled;

        if (canExport) {
          const allowedExportCap = Math.min(
            Math.max(0, config.gridExportCapKw),
            gridPeakCap,
            inverterHeadroomKw
          );
          pvExportedKw = Math.min(exportableAcKw, allowedExportCap);
          gridExportKw = pvExportedKw;

          const leftoverAc = Math.max(0, exportableAcKw - pvExportedKw);
          if (leftoverAc > 0.01) {
            pvCurtailedKw = leftoverAc;
            activeEvents.push('EXPORT_CAPPED');
            activeEvents.push('PV_CURTAILED');
          }
        } else {
          pvCurtailedKw = exportableAcKw;
          if (pvCurtailedKw > 0.01) {
            activeEvents.push('PV_CURTAILED');
          }
        }
      }
    }

    // 3. Load Deficit -> Battery Discharge -> Utility Grid Import -> Unserved / Breach
    let remainingDeficitKw = Math.max(0, loadKw - pvUsedDirectKw);

    if (remainingDeficitKw > 0.0001) {
      const usableStoredKwh = Math.max(0, batteryEnergyKwh - minReserveKwh);
      const maxDeliverableAcFromEnergy = usableStoredKwh * dischargeEff * invEff;
      const inverterHeadroomKw = Math.max(0, invRated - pvUsedDirectKw);
      const maxBattAcOutputKw = Math.min(
        maxDisKw * invEff,
        inverterHeadroomKw,
        maxDeliverableAcFromEnergy
      );

      let targetBattDischargeAcKw = 0;

      if (!step.gridOnline) {
        targetBattDischargeAcKw = Math.min(remainingDeficitKw, maxBattAcOutputKw);
      } else {
        const mustShavePeak =
          config.peakShavingEnabled && remainingDeficitKw > gridPeakCap;
        const allowNormalDischarge =
          !config.touEnabled ||
          !config.touBatteryDischargeOnlyOnPeak ||
          step.isPeakTariff;

        if (allowNormalDischarge) {
          targetBattDischargeAcKw = Math.min(remainingDeficitKw, maxBattAcOutputKw);
          if (mustShavePeak && targetBattDischargeAcKw > 0.01) {
            activeEvents.push('PEAK_SHAVING');
          }
        } else if (mustShavePeak) {
          const peakExcessKw = remainingDeficitKw - gridPeakCap;
          targetBattDischargeAcKw = Math.min(peakExcessKw, maxBattAcOutputKw);
          if (targetBattDischargeAcKw > 0.01) {
            activeEvents.push('PEAK_SHAVING');
          }
        }
      }

      if (targetBattDischargeAcKw > 0.0001) {
        batteryDischargeKw = targetBattDischargeAcKw;
        const dcDrawKwh =
          dischargeEff * invEff > 0
            ? targetBattDischargeAcKw / (dischargeEff * invEff)
            : 0;
        batteryEnergyKwh = Math.max(minReserveKwh, batteryEnergyKwh - dcDrawKwh);
        remainingDeficitKw = Math.max(0, remainingDeficitKw - targetBattDischargeAcKw);
      }

      if (remainingDeficitKw > 0.0001) {
        if (step.gridOnline) {
          if (remainingDeficitKw > gridPeakCap + 0.001) {
            gridImportKw = gridPeakCap;
            gridCapBreachKw = remainingDeficitKw - gridPeakCap;
            unservedLoadKw = gridCapBreachKw;
            activeEvents.push('GRID_CAP_BREACH');
            activeEvents.push('UNSERVED_LOAD');
          } else {
            gridImportKw = remainingDeficitKw;
          }
        } else {
          unservedLoadKw = remainingDeficitKw;
          activeEvents.push('UNSERVED_LOAD');
        }
      }
    }

    const batterySocPct =
      battCap > 0 ? clamp((batteryEnergyKwh / battCap) * 100, 0, 100) : 0;
    const inverterLoadKw = pvUsedDirectKw + pvExportedKw + batteryDischargeKw;

    // 4. Battery Thermal & Longevity Degradation Physics (LiFePO4 electrochemical model)
    const activePowerKw = Math.max(batteryChargeKw, batteryDischargeKw);
    const cRate = battCap > 0 ? activePowerKw / battCap : 0;
    // Internal ohmic heating scales with C-rate squared + linear factor
    const selfHeatingC = battCap > 0 ? cRate * 6.5 + cRate * cRate * 4.0 : 0;
    const batteryCellTempC = round2(step.ambientTempC + selfHeatingC);
    if (batteryCellTempC > peakBatteryCellTempC) peakBatteryCellTempC = batteryCellTempC;

    // Arrhenius-like thermal acceleration above 25°C, plus lithium-plating stress when charging cold (<5°C)
    let thermalStressFactor = 1.0;
    if (batteryCellTempC > 25) {
      thermalStressFactor = Math.pow(2, (batteryCellTempC - 25) / 14);
    } else if (batteryCellTempC < 5 && batteryChargeKw > 0.05) {
      thermalStressFactor = 1.0 + ((5 - batteryCellTempC) / 10) * 1.45;
    } else if (batteryCellTempC < 5) {
      thermalStressFactor = 1.15;
    }
    thermalStressFactor = round2(clamp(thermalStressFactor, 0.85, 4.5));
    thermalStressSum += thermalStressFactor;

    // Depth-of-discharge & C-rate stress multipliers
    const dodPenalty = batterySocPct < 22 ? 1.45 : batterySocPct > 96 && batteryCellTempC > 35 ? 1.25 : 1.0;
    const cRatePenalty = cRate > 0.5 ? 1 + (cRate - 0.5) * 0.9 : 1.0;

    // Nominal LiFePO4 baseline: ~1.1% calendar fade/yr + ~0.004% capacity fade per full equivalent cycle (5000 cycles to 80% SoH)
    const hourlyEqCycle = battCap > 0 ? (batteryChargeKw + batteryDischargeKw) / (2 * battCap) : 0;
    const baseCalendarPerHour = 0.95 / 8760; // % SoH fade/hr at 25°C
    const baseCycleFade = hourlyEqCycle * 0.0042; // % SoH fade per equivalent cycle at 25°C

    const hourlyBaselineFade = battCap > 0 ? baseCalendarPerHour + baseCycleFade : 0;
    const hourlyStressedFade =
      battCap > 0
        ? baseCalendarPerHour * thermalStressFactor +
          baseCycleFade * thermalStressFactor * dodPenalty * cRatePenalty
        : 0;

    cumulativeDegradationPct += hourlyStressedFade;
    baselineDegradationPct += hourlyBaselineFade;

    // Human-readable Hourly Stress Index (0–100 scale for charting)
    const hourlyWearIndex =
      battCap > 0
        ? round2(
            clamp(
              (thermalStressFactor - 0.85) * 26 +
                cRate * 32 +
                (dodPenalty - 1) * 35 +
                (step.isHeatwave ? 12 : 0) +
                (step.isColdSnap ? 10 : 0),
              2,
              100
            )
          )
        : 0;

    const hourlyImportCost = gridImportKw * step.importRate;
    const hourlyExportCredit = gridExportKw * step.exportRate;
    const hourlyNetCost = hourlyImportCost - hourlyExportCredit;
    cumulativeNetCost += hourlyNetCost;

    if (step.gridOnline) {
      baselineGridOnlyCost += loadKw * step.importRate;
    }

    totalPvYieldKwh += pvAvailableKw;
    totalPvDirectKwh += pvUsedDirectKw;
    totalPvToBatteryKwh += pvToBatteryKw;
    totalPvExportedKwh += pvExportedKw;
    totalCurtailedPvKwh += pvCurtailedKw;

    totalLoadKwh += loadKw;
    totalServedLoadKwh += Math.max(0, loadKw - unservedLoadKw);
    totalUnservedLoadKwh += unservedLoadKw;

    totalBatteryChargedKwh += batteryChargeKw;
    totalBatteryDischargedKwh += batteryDischargeKw;
    if (batterySocPct < minBatterySocPct) minBatterySocPct = batterySocPct;

    totalGridImportKwh += gridImportKw;
    totalGridExportKwh += gridExportKw;
    if (gridImportKw > peakGridImportKw) peakGridImportKw = gridImportKw;

    if (gridCapBreachKw > 0.01) {
      gridCapBreachHours += 1;
      if (gridCapBreachKw > maxGridCapOvershootKw) {
        maxGridCapOvershootKw = gridCapBreachKw;
        worstBreachHour = step.hour;
      }
    }

    if (unservedLoadKw > maxUnservedAtHour) {
      maxUnservedAtHour = unservedLoadKw;
      worstUnservedHour = step.hour;
    }

    if (!step.gridOnline) {
      outageHoursTotal += 1;
      if (unservedLoadKw <= 0.02) {
        outageHoursSurvived += 1;
      }
    }

    totalImportCost += hourlyImportCost;
    totalExportCredit += hourlyExportCredit;

    steps.push({
      hour: step.hour,
      dayIndex: step.dayIndex,
      hourOfDay: step.hourOfDay,
      clockLabel: step.clockLabel,
      shortLabel: step.shortLabel,
      irradianceWm2: step.irradianceWm2,
      pvAvailableKw: round2(pvAvailableKw),
      pvUsedDirectKw: round2(pvUsedDirectKw),
      pvToBatteryKw: round2(pvToBatteryKw),
      pvExportedKw: round2(pvExportedKw),
      pvCurtailedKw: round2(pvCurtailedKw),
      batteryChargeKw: round2(batteryChargeKw),
      batteryDischargeKw: round2(batteryDischargeKw),
      batterySocPct: round2(batterySocPct),
      batteryEnergyKwh: round2(batteryEnergyKwh),
      ambientTempC: step.ambientTempC,
      batteryCellTempC,
      thermalStressFactor,
      hourlyWearIndex,
      cumulativeDegradationPct: Number(cumulativeDegradationPct.toFixed(5)),
      gridOnline: step.gridOnline,
      gridImportKw: round2(gridImportKw),
      gridExportKw: round2(gridExportKw),
      gridPeakCapKw: round2(gridPeakCap),
      gridCapBreachKw: round2(gridCapBreachKw),
      unservedLoadKw: round2(unservedLoadKw),
      householdLoadKw: round2(loadKw),
      inverterLoadKw: round2(inverterLoadKw),
      importRate: round2(step.importRate),
      exportRate: round2(step.exportRate),
      hourlyImportCost: round2(hourlyImportCost),
      hourlyExportCredit: round2(hourlyExportCredit),
      hourlyNetCost: round2(hourlyNetCost),
      cumulativeNetCost: round2(cumulativeNetCost),
      activeEvents,
      outageLabel: step.outageLabel,
    });
  }

  const pvConsumedLocally = totalPvDirectKwh + totalPvToBatteryKwh;
  const selfConsumptionPct =
    totalPvYieldKwh > 0.01
      ? clamp((pvConsumedLocally / totalPvYieldKwh) * 100, 0, 100)
      : 0;
  const gridIndependencePct =
    totalLoadKwh > 0.01
      ? clamp(((totalServedLoadKwh - totalGridImportKwh) / totalLoadKwh) * 100, 0, 100)
      : 0;

  // Annualize battery longevity projections (time to reach 80% SoH EOL threshold = 20% fade)
  const daysSimulated = config.horizonHours / 24;
  const equivalentFullCyclesPerDay =
    battCap > 0
      ? (totalBatteryChargedKwh + totalBatteryDischargedKwh) / (2 * battCap * daysSimulated)
      : 0;
  const avgThermalStressFactor =
    steps.length > 0 ? thermalStressSum / steps.length : 1.0;

  const annualizedBaselineFadePct =
    battCap > 0 ? Math.max(0.8, (baselineDegradationPct / daysSimulated) * 365) : 0;
  const annualizedStressedFadePct =
    battCap > 0 ? Math.max(0.8, (cumulativeDegradationPct / daysSimulated) * 365) : 0;

  const baselineLifespanYears =
    battCap > 0 ? clamp(20 / annualizedBaselineFadePct, 1.5, 18) : 0;
  const projectedLifespanYears =
    battCap > 0 ? clamp(20 / annualizedStressedFadePct, 1.0, 18) : 0;
  const lifespanDeltaYears = round2(projectedLifespanYears - baselineLifespanYears);

  const longevityRating: SimulationSummary['longevityRating'] =
    battCap === 0
      ? 'Optimal'
      : projectedLifespanYears >= 10
        ? 'Optimal'
        : projectedLifespanYears >= 7.5
          ? 'Moderate Wear'
          : projectedLifespanYears >= 5
            ? 'Accelerated Wear'
            : 'Severe Stress';

  // 10-Year Projected State of Health Curve (Year 0 to Year 10)
  const longevityCurve: LongevityProjectionPoint[] = [];
  for (let yr = 0; yr <= 10; yr++) {
    // Slightly accelerating tail below 82% SoH for realistic knee behavior
    const baseLoss = annualizedBaselineFadePct * yr;
    const stressLoss =
      annualizedStressedFadePct * yr * (yr > 6 && annualizedStressedFadePct > 2.5 ? 1.06 : 1.0);
    longevityCurve.push({
      year: yr,
      yearLabel: `Yr ${yr}`,
      baselineSohPct: round2(clamp(100 - baseLoss, 50, 100)),
      stressedSohPct: round2(clamp(100 - stressLoss, 45, 100)),
    });
  }

  const summary: SimulationSummary = {
    horizonHours: config.horizonHours,
    totalPvYieldKwh: round2(totalPvYieldKwh),
    totalPvDirectKwh: round2(totalPvDirectKwh),
    totalPvToBatteryKwh: round2(totalPvToBatteryKwh),
    totalPvExportedKwh: round2(totalPvExportedKwh),
    totalCurtailedPvKwh: round2(totalCurtailedPvKwh),

    totalLoadKwh: round2(totalLoadKwh),
    totalServedLoadKwh: round2(totalServedLoadKwh),
    totalUnservedLoadKwh: round2(totalUnservedLoadKwh),

    totalBatteryChargedKwh: round2(totalBatteryChargedKwh),
    totalBatteryDischargedKwh: round2(totalBatteryDischargedKwh),
    minBatterySocPct: round2(minBatterySocPct),
    endBatterySocPct: steps.length > 0 ? steps[steps.length - 1].batterySocPct : 0,

    equivalentFullCyclesPerDay: round2(equivalentFullCyclesPerDay),
    peakBatteryCellTempC: round2(peakBatteryCellTempC),
    avgThermalStressFactor: round2(avgThermalStressFactor),
    annualizedFadePct: round2(annualizedStressedFadePct),
    baselineLifespanYears: round2(baselineLifespanYears),
    projectedLifespanYears: round2(projectedLifespanYears),
    lifespanDeltaYears,
    longevityRating,

    totalGridImportKwh: round2(totalGridImportKwh),
    totalGridExportKwh: round2(totalGridExportKwh),
    peakGridImportKw: round2(peakGridImportKw),
    permittedGridPeakKw: round2(gridPeakCap),
    gridCapBreachHours,
    maxGridCapOvershootKw: round2(maxGridCapOvershootKw),
    worstBreachHour,
    worstUnservedHour,

    selfConsumptionPct: round2(selfConsumptionPct),
    gridIndependencePct: round2(gridIndependencePct),

    outageHoursTotal,
    outageHoursSurvived,

    totalImportCost: round2(totalImportCost),
    totalExportCredit: round2(totalExportCredit),
    netEnergyCost: round2(cumulativeNetCost),
    baselineGridOnlyCost: round2(baselineGridOnlyCost),
    estimatedSavings: round2(baselineGridOnlyCost - cumulativeNetCost),
  };

  return { steps, summary, longevityCurve };
}

export function rowsToCsv(rows: FabricatedRow[], horizon: HorizonHours = 24): string {
  const header = 'timestamp,irradiance_wm2,load_kw,grid_online,import_rate,export_rate';
  const lines = rows.map((r, idx) => {
    const { clockLabel } = formatHourClock(idx, horizon);
    return `${clockLabel},${Math.round(r.irradianceWm2)},${r.loadKw.toFixed(2)},${r.gridOnline ? 1 : 0},${r.importRate.toFixed(2)},${r.exportRate.toFixed(2)}`;
  });
  return [header, ...lines].join('\n');
}

export function parseFabricatedImport(
  rawText: string,
  expectedHorizon: HorizonHours,
  pvCapacityKw: number = 6.0
): { rows: FabricatedRow[]; errors: string[] } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { rows: [], errors: ['Input is empty. Paste CSV/TSV rows or upload a CSV/JSON file.'] };
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.fabricatedRows)
          ? parsed.fabricatedRows
          : Array.isArray(parsed.rows)
            ? parsed.rows
            : null;
      if (!list) {
        return { rows: [], errors: ['JSON must be an array of hourly rows or contain a fabricatedRows array.'] };
      }
      const errors: string[] = [];
      const rows: FabricatedRow[] = [];
      for (let i = 0; i < Math.min(list.length, expectedHorizon); i++) {
        const item = list[i];
        const rawIrr = item.irradianceWm2 ?? item.irradiance_wm2;
        const legacyPv = item.pvKw ?? item.pv_kw;
        const irradianceWm2 =
          rawIrr !== undefined
            ? Number(rawIrr)
            : legacyPv !== undefined && pvCapacityKw > 0.05
              ? Math.round((Number(legacyPv) / (pvCapacityKw * 0.85)) * 1000)
              : 0;
        const loadKw = Number(item.loadKw ?? item.load_kw ?? 0);
        const importRate = Number(item.importRate ?? item.import_rate ?? 7.5);
        const exportRate = Number(item.exportRate ?? item.export_rate ?? 6.2);
        const gridVal = item.gridOnline ?? item.grid_online ?? true;
        if (Number.isNaN(irradianceWm2) || irradianceWm2 < 0 || Number.isNaN(loadKw) || loadKw < 0) {
          errors.push(`Row ${i}: Solar Irradiation and Load must be non-negative numbers.`);
          continue;
        }
        rows.push({
          hour: i,
          irradianceWm2: Math.round(clamp(irradianceWm2, 0, 1400)),
          loadKw: round2(loadKw),
          gridOnline:
            gridVal === true ||
            gridVal === 1 ||
            String(gridVal).toLowerCase() === 'true' ||
            String(gridVal).toLowerCase() === 'on',
          importRate: round2(Math.max(0, importRate)),
          exportRate: round2(Math.max(0, exportRate)),
        });
      }
      if (rows.length < expectedHorizon && errors.length === 0) {
        errors.push(`Imported ${rows.length} rows; remaining hours up to ${expectedHorizon}h were padded from the last row.`);
      }
      while (rows.length > 0 && rows.length < expectedHorizon) {
        const prev = rows[rows.length - 1];
        rows.push({ ...prev, hour: rows.length });
      }
      return { rows, errors };
    } catch {
      return { rows: [], errors: ['Invalid JSON syntax. Verify brackets and quotes.'] };
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const errors: string[] = [];
  const rows: FabricatedRow[] = [];

  let startIdx = 0;
  let isLegacyPvHeader = false;
  if (lines[0] && /[a-zA-Z]/.test(lines[0])) {
    startIdx = 1;
    if (lines[0].toLowerCase().includes('pv_kw') && !lines[0].toLowerCase().includes('irradiance')) {
      isLegacyPvHeader = true;
    }
  }

  for (let i = startIdx; i < lines.length && rows.length < expectedHorizon; i++) {
    const delimiter = lines[i].includes('\t') ? '\t' : ',';
    const cols = lines[i].split(delimiter).map((c) => c.trim());
    if (cols.length < 3) {
      errors.push(`Line ${i + 1}: Expected at least 3 columns (timestamp, irradiance_wm2, load_kw).`);
      continue;
    }

    const col1Val = Number(cols[1]);
    const loadKw = Number(cols[2]);
    const rawGrid = cols[3] !== undefined ? cols[3].toLowerCase() : '1';
    const importRate = cols[4] !== undefined ? Number(cols[4]) : 7.5;
    const exportRate = cols[5] !== undefined ? Number(cols[5]) : 6.2;

    if (Number.isNaN(col1Val) || col1Val < 0 || col1Val > 1400) {
      errors.push(`Line ${i + 1}: Invalid Solar Irradiation "${cols[1]}" (must be 0–1400 W/m²).`);
      continue;
    }
    if (Number.isNaN(loadKw) || loadKw < 0 || loadKw > 250) {
      errors.push(`Line ${i + 1}: Invalid Load kW "${cols[2]}" (must be 0–250).`);
      continue;
    }
    if (Number.isNaN(importRate) || importRate < 0) {
      errors.push(`Line ${i + 1}: Invalid Import Rate "${cols[4]}".`);
      continue;
    }

    const irradianceWm2 = isLegacyPvHeader
      ? Math.round(clamp((col1Val / Math.max(0.5, pvCapacityKw * 0.85)) * 1000, 0, 1400))
      : Math.round(clamp(col1Val, 0, 1400));

    const gridOnline = !(
      rawGrid === '0' ||
      rawGrid === 'false' ||
      rawGrid === 'off' ||
      rawGrid === 'no' ||
      rawGrid === 'outage'
    );

    rows.push({
      hour: rows.length,
      irradianceWm2,
      loadKw: round2(loadKw),
      gridOnline,
      importRate: round2(importRate),
      exportRate: round2(Number.isNaN(exportRate) ? 0 : Math.max(0, exportRate)),
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('No valid data rows found.');
  }

  while (rows.length > 0 && rows.length < expectedHorizon) {
    const prev = rows[rows.length - 1];
    rows.push({ ...prev, hour: rows.length });
  }

  return { rows, errors };
}
