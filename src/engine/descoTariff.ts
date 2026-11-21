export type DescoTariffCategory = 'LT-A' | 'LT-E-FLAT' | 'LT-E-TOU';
export type DescoInputMode = 'bill_bdt' | 'units_kwh';

export interface DescoBillConfig {
  tariffCategory: DescoTariffCategory;
  inputMode: DescoInputMode;
  monthlyBillBdt: number;
  monthlyUnitsKwh: number;
  sanctionedLoadKw: number;
  billingDays: number;
  prepaidMeter: boolean;
  touPeakSharePct: number;
  peakFactor: number;
}

export interface DescoSlabLine {
  label: string;
  units: number;
  rateBdt: number;
  amountBdt: number;
}

export interface DescoBillCalculation {
  monthlyKwh: number;
  dailyKwh: number;
  averageLoadKw: number;
  estimatedPeakKw: number;
  slabLines: DescoSlabLine[];
  energyChargeBdt: number;
  demandChargeBdt: number;
  prepaidRebateBdt: number;
  subtotalBeforeVatBdt: number;
  vatBdt: number;
  totalBillBdt: number;
  effectiveBlendedRateBdt: number;
  minimumFixedBillBdt: number;
  belowMinimumNotice: string | null;
}

export interface ApplianceItem {
  id: string;
  name: string;
  category: string;
  watts: number;
  qty: number;
  hoursPerDay: number;
  runsAtPeak: boolean;
}

export interface ApplianceSummary {
  connectedLoadKw: number;
  simultaneousPeakKw: number;
  dailyEnergyKwh: number;
  monthlyEnergyKwh: number;
  averageLoadKw: number;
  derivedPeakFactor: number;
  estimatedDescoBill: DescoBillCalculation;
}

// Official BERC / DESCO Bangladesh LT-A Residential slabs (BDT/kWh)
export const DESCO_LTA_LIFELINE_RATE = 4.63; // Applies only if total <= 50 kWh
export const DESCO_LTA_DEMAND_PER_KW = 42.0;
export const DESCO_LTE_DEMAND_PER_KW = 90.0;
export const DESCO_LTE_FLAT_RATE = 15.36;
export const DESCO_LTE_PEAK_RATE = 18.43;
export const DESCO_LTE_OFFPEAK_RATE = 13.82;
export const DESCO_VAT_RATE = 0.05;
export const DESCO_PREPAID_REBATE_RATE = 0.005;

const LTA_SLABS: Array<{ label: string; cap: number; rate: number }> = [
  { label: '0 – 75 units', cap: 75, rate: 5.26 },
  { label: '76 – 200 units', cap: 125, rate: 8.5 },
  { label: '201 – 300 units', cap: 100, rate: 9.1 },
  { label: '301 – 400 units', cap: 100, rate: 9.62 },
  { label: '401 – 600 units', cap: 200, rate: 15.01 },
  { label: '601+ units', cap: Infinity, rate: 17.35 },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function createDefaultDescoConfig(): DescoBillConfig {
  return {
    tariffCategory: 'LT-A',
    inputMode: 'bill_bdt',
    monthlyBillBdt: 6800,
    monthlyUnitsKwh: 550,
    sanctionedLoadKw: 5.0,
    billingDays: 30,
    prepaidMeter: false,
    touPeakSharePct: 30,
    peakFactor: 1.7,
  };
}

export function calculateDescoFromUnits(
  unitsKwh: number,
  config: DescoBillConfig
): DescoBillCalculation {
  const safeUnits = Math.max(0, unitsKwh);
  const sanctioned = Math.max(1, config.sanctionedLoadKw);
  const days = Math.max(1, config.billingDays);
  const slabLines: DescoSlabLine[] = [];
  let energyChargeBdt = 0;

  if (config.tariffCategory === 'LT-A') {
    if (safeUnits <= 50 && safeUnits > 0) {
      const amt = safeUnits * DESCO_LTA_LIFELINE_RATE;
      energyChargeBdt = amt;
      slabLines.push({
        label: '0 – 50 units (Lifeline)',
        units: round2(safeUnits),
        rateBdt: DESCO_LTA_LIFELINE_RATE,
        amountBdt: round2(amt),
      });
    } else {
      let remaining = safeUnits;
      for (const slab of LTA_SLABS) {
        if (remaining <= 0) break;
        const inSlab = Math.min(remaining, slab.cap);
        const amt = inSlab * slab.rate;
        energyChargeBdt += amt;
        slabLines.push({
          label: slab.label,
          units: round2(inSlab),
          rateBdt: slab.rate,
          amountBdt: round2(amt),
        });
        remaining -= inSlab;
      }
    }
  } else if (config.tariffCategory === 'LT-E-FLAT') {
    energyChargeBdt = safeUnits * DESCO_LTE_FLAT_RATE;
    if (safeUnits > 0) {
      slabLines.push({
        label: 'Commercial LT-E Flat',
        units: round2(safeUnits),
        rateBdt: DESCO_LTE_FLAT_RATE,
        amountBdt: round2(energyChargeBdt),
      });
    }
  } else {
    const peakShare = Math.max(0, Math.min(100, config.touPeakSharePct)) / 100;
    const peakUnits = safeUnits * peakShare;
    const offPeakUnits = safeUnits - peakUnits;
    const peakAmt = peakUnits * DESCO_LTE_PEAK_RATE;
    const offPeakAmt = offPeakUnits * DESCO_LTE_OFFPEAK_RATE;
    energyChargeBdt = peakAmt + offPeakAmt;
    if (safeUnits > 0) {
      slabLines.push({
        label: 'Off-Peak (23:00–17:00)',
        units: round2(offPeakUnits),
        rateBdt: DESCO_LTE_OFFPEAK_RATE,
        amountBdt: round2(offPeakAmt),
      });
      slabLines.push({
        label: 'Peak (17:00–23:00)',
        units: round2(peakUnits),
        rateBdt: DESCO_LTE_PEAK_RATE,
        amountBdt: round2(peakAmt),
      });
    }
  }

  const demandRate =
    config.tariffCategory === 'LT-A' ? DESCO_LTA_DEMAND_PER_KW : DESCO_LTE_DEMAND_PER_KW;
  const demandChargeBdt = sanctioned * demandRate;
  const prepaidRebateBdt = config.prepaidMeter
    ? energyChargeBdt * DESCO_PREPAID_REBATE_RATE
    : 0;
  const subtotalBeforeVatBdt = Math.max(0, energyChargeBdt - prepaidRebateBdt) + demandChargeBdt;
  const vatBdt = subtotalBeforeVatBdt * DESCO_VAT_RATE;
  const totalBillBdt = subtotalBeforeVatBdt + vatBdt;

  const minimumFixedBillBdt = demandChargeBdt * (1 + DESCO_VAT_RATE);
  const dailyKwh = safeUnits / days;
  const averageLoadKw = dailyKwh / 24;
  const estimatedPeakKw = averageLoadKw * Math.max(1.0, config.peakFactor);
  const effectiveBlendedRateBdt = safeUnits > 0.01 ? totalBillBdt / safeUnits : 0;

  return {
    monthlyKwh: round2(safeUnits),
    dailyKwh: round2(dailyKwh),
    averageLoadKw: round2(averageLoadKw),
    estimatedPeakKw: round2(estimatedPeakKw),
    slabLines,
    energyChargeBdt: round2(energyChargeBdt),
    demandChargeBdt: round2(demandChargeBdt),
    prepaidRebateBdt: round2(prepaidRebateBdt),
    subtotalBeforeVatBdt: round2(subtotalBeforeVatBdt),
    vatBdt: round2(vatBdt),
    totalBillBdt: round2(totalBillBdt),
    effectiveBlendedRateBdt: round2(effectiveBlendedRateBdt),
    minimumFixedBillBdt: round2(minimumFixedBillBdt),
    belowMinimumNotice: null,
  };
}

export function solveDescoBill(config: DescoBillConfig): DescoBillCalculation {
  if (config.inputMode === 'units_kwh') {
    return calculateDescoFromUnits(config.monthlyUnitsKwh, config);
  }

  const targetBill = Math.max(0, config.monthlyBillBdt);
  const zeroResult = calculateDescoFromUnits(0, config);

  if (targetBill <= zeroResult.minimumFixedBillBdt) {
    return {
      ...zeroResult,
      belowMinimumNotice: `Entered bill (৳${targetBill.toFixed(0)}) is at or below fixed demand charge + 5% VAT (৳${zeroResult.minimumFixedBillBdt.toFixed(0)} for ${config.sanctionedLoadKw} kW sanctioned load).`,
    };
  }

  // Handle LT-A lifeline discontinuity cleanly around 50 kWh
  if (config.tariffCategory === 'LT-A') {
    const at50 = calculateDescoFromUnits(50, config);
    const at50Plus = calculateDescoFromUnits(50.01, config);
    if (targetBill > at50.totalBillBdt && targetBill < at50Plus.totalBillBdt) {
      return at50;
    }
  }

  // Monotonic binary search over [0, upper]
  let low = 0;
  let high = 50000;
  while (calculateDescoFromUnits(high, config).totalBillBdt < targetBill && high < 500000) {
    high *= 2;
  }

  for (let i = 0; i < 42; i++) {
    const mid = (low + high) / 2;
    const calc = calculateDescoFromUnits(mid, config);
    if (calc.totalBillBdt < targetBill) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return calculateDescoFromUnits((low + high) / 2, config);
}

export interface ApplianceCatalogEntry {
  name: string;
  category: string;
  watts: number;
  defaultHours: number;
  runsAtPeak: boolean;
}

export const BD_APPLIANCE_CATALOG: ApplianceCatalogEntry[] = [
  { name: 'Inverter AC (1.5 Ton)', category: 'Cooling', watts: 1200, defaultHours: 7, runsAtPeak: true },
  { name: 'Non-Inverter AC (1.5T)', category: 'Cooling', watts: 1650, defaultHours: 6, runsAtPeak: true },
  { name: 'Ceiling Fan', category: 'Cooling', watts: 75, defaultHours: 14, runsAtPeak: true },
  { name: 'LED Light / Tube', category: 'Lighting', watts: 15, defaultHours: 8, runsAtPeak: true },
  { name: 'Refrigerator (Frost-Free)', category: 'Kitchen', watts: 160, defaultHours: 16, runsAtPeak: true },
  { name: 'Submersible Water Pump', category: 'Utility', watts: 750, defaultHours: 1.5, runsAtPeak: false },
  { name: 'Microwave Oven', category: 'Kitchen', watts: 1200, defaultHours: 0.5, runsAtPeak: false },
  { name: 'Water Heater / Geyser', category: 'Utility', watts: 1500, defaultHours: 1, runsAtPeak: false },
  { name: 'Smart TV (50")', category: 'Electronics', watts: 110, defaultHours: 5, runsAtPeak: true },
  { name: 'Desktop PC / Workstation', category: 'Electronics', watts: 260, defaultHours: 8, runsAtPeak: false },
  { name: 'Wi-Fi Router & ONT', category: 'Electronics', watts: 25, defaultHours: 24, runsAtPeak: true },
  { name: 'Electric Iron', category: 'Utility', watts: 1000, defaultHours: 0.5, runsAtPeak: false },
];

export function createStarterAppliances(): ApplianceItem[] {
  return [
    { id: 'app_ac', name: 'Inverter AC (1.5 Ton)', category: 'Cooling', watts: 1200, qty: 2, hoursPerDay: 6, runsAtPeak: true },
    { id: 'app_fan', name: 'Ceiling Fan', category: 'Cooling', watts: 75, qty: 4, hoursPerDay: 14, runsAtPeak: true },
    { id: 'app_led', name: 'LED Light / Tube', category: 'Lighting', watts: 15, qty: 10, hoursPerDay: 7, runsAtPeak: true },
    { id: 'app_fridge', name: 'Refrigerator (Frost-Free)', category: 'Kitchen', watts: 160, qty: 1, hoursPerDay: 16, runsAtPeak: true },
    { id: 'app_tv', name: 'Smart TV (50")', category: 'Electronics', watts: 110, qty: 1, hoursPerDay: 5, runsAtPeak: true },
    { id: 'app_pump', name: 'Submersible Water Pump', category: 'Utility', watts: 750, qty: 1, hoursPerDay: 1.5, runsAtPeak: false },
    { id: 'app_wifi', name: 'Wi-Fi Router & ONT', category: 'Electronics', watts: 25, qty: 1, hoursPerDay: 24, runsAtPeak: true },
  ];
}

export function computeApplianceSummary(
  appliances: ApplianceItem[],
  sanctionedLoadKw = 5.0
): ApplianceSummary {
  let connectedWatts = 0;
  let peakWatts = 0;
  let dailyWh = 0;

  for (const item of appliances) {
    const w = Math.max(0, Number(item.watts) || 0);
    const q = Math.max(0, Number(item.qty) || 0);
    const hrs = Math.max(0, Math.min(24, Number(item.hoursPerDay) || 0));
    const itemWatts = w * q;
    connectedWatts += itemWatts;
    if (item.runsAtPeak) {
      peakWatts += itemWatts;
    }
    dailyWh += itemWatts * hrs;
  }

  const connectedLoadKw = round2(connectedWatts / 1000);
  const simultaneousPeakKw = round2(peakWatts / 1000);
  const dailyEnergyKwh = round2(dailyWh / 1000);
  const monthlyEnergyKwh = round2(dailyEnergyKwh * 30);
  const averageLoadKw = round2(dailyEnergyKwh / 24);
  const derivedPeakFactor =
    averageLoadKw > 0.05
      ? round2(Math.max(1.1, Math.min(2.8, simultaneousPeakKw / averageLoadKw)))
      : 1.7;

  const estimatedDescoBill = calculateDescoFromUnits(monthlyEnergyKwh, {
    ...createDefaultDescoConfig(),
    inputMode: 'units_kwh',
    monthlyUnitsKwh: monthlyEnergyKwh,
    sanctionedLoadKw: Math.max(sanctionedLoadKw, Math.ceil(simultaneousPeakKw)),
  });

  return {
    connectedLoadKw,
    simultaneousPeakKw,
    dailyEnergyKwh,
    monthlyEnergyKwh,
    averageLoadKw,
    derivedPeakFactor,
    estimatedDescoBill,
  };
}
