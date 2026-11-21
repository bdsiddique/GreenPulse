import type { SolarPanelSpec } from '../types/simulation';

export const BUILTIN_SOLAR_PANELS: SolarPanelSpec[] = [
  {
    id: 'panel_topcon_580',
    name: 'N-Type TOPCon 580W',
    manufacturer: 'Tier-1 Monocrystalline',
    technology: 'N-Type TOPCon',
    wattageWp: 580,
    efficiencyPct: 22.5,
    areaM2: 2.58,
    tempCoeffPctPerC: -0.3,
    noctC: 43,
    systemLossPct: 12,
    isBuiltIn: true,
  },
  {
    id: 'panel_perc_550',
    name: 'Mono PERC 550W',
    manufacturer: 'Standard Utility-Grade',
    technology: 'Mono PERC',
    wattageWp: 550,
    efficiencyPct: 21.3,
    areaM2: 2.58,
    tempCoeffPctPerC: -0.35,
    noctC: 45,
    systemLossPct: 14,
    isBuiltIn: true,
  },
  {
    id: 'panel_hjt_600',
    name: 'Bifacial HJT 600W',
    manufacturer: 'High-Yield Heterojunction',
    technology: 'Bifacial HJT',
    wattageWp: 600,
    efficiencyPct: 23.0,
    areaM2: 2.61,
    tempCoeffPctPerC: -0.26,
    noctC: 42,
    systemLossPct: 11,
    isBuiltIn: true,
  },
  {
    id: 'panel_poly_330',
    name: 'Polycrystalline 330W',
    manufacturer: 'Legacy Economy Series',
    technology: 'Polycrystalline',
    wattageWp: 330,
    efficiencyPct: 17.1,
    areaM2: 1.93,
    tempCoeffPctPerC: -0.41,
    noctC: 46,
    systemLossPct: 16,
    isBuiltIn: true,
  },
];

export const DEFAULT_SOLAR_PANEL_ID = BUILTIN_SOLAR_PANELS[0].id;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalizeSolarPanel(raw: Partial<SolarPanelSpec>): SolarPanelSpec {
  const base = BUILTIN_SOLAR_PANELS[0];
  const wattageWp = Math.round(clamp(Number(raw.wattageWp) || base.wattageWp, 50, 1200));
  const efficiencyPct = Number(clamp(Number(raw.efficiencyPct) || base.efficiencyPct, 8, 35).toFixed(2));
  const areaM2 = Number(
    clamp(
      Number(raw.areaM2) || Number((wattageWp / (1000 * (efficiencyPct / 100))).toFixed(2)),
      0.3,
      6.0
    ).toFixed(2)
  );
  const tempCoeffPctPerC = Number(
    clamp(
      raw.tempCoeffPctPerC !== undefined ? Number(raw.tempCoeffPctPerC) : base.tempCoeffPctPerC,
      -0.7,
      -0.05
    ).toFixed(2)
  );
  const noctC = Math.round(clamp(Number(raw.noctC) || base.noctC, 30, 60));
  const systemLossPct = Number(
    clamp(
      raw.systemLossPct !== undefined ? Number(raw.systemLossPct) : base.systemLossPct,
      0,
      40
    ).toFixed(1)
  );

  return {
    id: raw.id || `panel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: (raw.name || 'Custom Solar Panel').trim() || 'Custom Solar Panel',
    manufacturer: (raw.manufacturer || 'Custom Profile').trim(),
    technology: raw.technology || 'Custom',
    wattageWp,
    efficiencyPct,
    areaM2,
    tempCoeffPctPerC,
    noctC,
    systemLossPct,
    isBuiltIn: Boolean(raw.isBuiltIn),
  };
}

export interface PvPhysicsResult {
  pvKw: number;
  cellTempC: number;
  thermalFactor: number;
  bosFactor: number;
  effectivePanelCount: number;
  arrayAreaM2: number;
}

/**
 * Computes physical DC/array PV generation (kW) from solar irradiance (W/m²),
 * installed solar capacity (kWp), ambient temperature (°C), and the selected
 * solar panel specifications (wattage, efficiency, module area, temp coeff, NOCT, BOS losses).
 */
export function calculatePvOutputKw(params: {
  irradianceWm2: number;
  pvCapacityKw: number;
  ambientTempC: number;
  panel: SolarPanelSpec;
  pvEnabled?: boolean;
}): PvPhysicsResult {
  const { irradianceWm2, pvCapacityKw, ambientTempC, panel, pvEnabled = true } = params;
  const safePanel = normalizeSolarPanel(panel);
  const effectivePanelCount =
    pvCapacityKw > 0 ? (pvCapacityKw * 1000) / Math.max(50, safePanel.wattageWp) : 0;
  const arrayAreaM2 = effectivePanelCount * safePanel.areaM2;

  if (!pvEnabled || irradianceWm2 <= 0 || pvCapacityKw <= 0) {
    return {
      pvKw: 0,
      cellTempC: Number(ambientTempC.toFixed(1)),
      thermalFactor: 1,
      bosFactor: (100 - safePanel.systemLossPct) / 100,
      effectivePanelCount: Number(effectivePanelCount.toFixed(1)),
      arrayAreaM2: Number(arrayAreaM2.toFixed(1)),
    };
  }

  const clampedG = clamp(irradianceWm2, 0, 1400);
  // Ross / NOCT cell temperature model: T_cell = T_amb + ((NOCT - 20) / 800) * G
  const cellTempC = ambientTempC + ((safePanel.noctC - 20) / 800) * clampedG;
  const thermalFactor = clamp(
    1 + (safePanel.tempCoeffPctPerC / 100) * (cellTempC - 25),
    0.55,
    1.15
  );
  const bosFactor = clamp((100 - safePanel.systemLossPct) / 100, 0.5, 1.0);

  // Physical output: Array Area (m²) * Panel Efficiency * Irradiance (kW/m²) * Thermal * BOS
  const rawKw =
    arrayAreaM2 * (safePanel.efficiencyPct / 100) * (clampedG / 1000) * thermalFactor * bosFactor;

  return {
    pvKw: Math.round(Math.max(0, rawKw) * 100) / 100,
    cellTempC: Number(cellTempC.toFixed(1)),
    thermalFactor: Number(thermalFactor.toFixed(3)),
    bosFactor: Number(bosFactor.toFixed(3)),
    effectivePanelCount: Number(effectivePanelCount.toFixed(1)),
    arrayAreaM2: Number(arrayAreaM2.toFixed(1)),
  };
}
