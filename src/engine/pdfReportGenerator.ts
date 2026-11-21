import { jsPDF } from 'jspdf';
import type {
  CurrencyCode,
  SimulationConfig,
  SimulationResult,
  UserProfile,
} from '../types/simulation';

export type PdfPageSize = 'a4' | 'letter';

export interface PdfReportOptions {
  appName: string;
  reportTitle: string;
  scenarioLabel: string;
  notes?: string;
  userProfile: UserProfile;
  config: SimulationConfig;
  result: SimulationResult;
  pageSize: PdfPageSize;
  includeSummary: boolean;
  includeCharts: boolean;
  includeHourlyTable: boolean;
}

type RgbTuple = [number, number, number];

const C_INK: RgbTuple = [15, 23, 42]; // #0F172A
const C_SLATE_700: RgbTuple = [51, 65, 85];
const C_SLATE_500: RgbTuple = [100, 116, 139];
const C_BORDER: RgbTuple = [226, 232, 240];
const C_SURFACE: RgbTuple = [248, 250, 252];
const C_WHITE: RgbTuple = [255, 255, 255];

const C_AMBER: RgbTuple = [217, 119, 6]; // Solar PV
const C_SKY: RgbTuple = [2, 132, 199]; // Saved to Battery
const C_VIOLET: RgbTuple = [124, 58, 237]; // Grid Import
const C_BLUE: RgbTuple = [37, 99, 235]; // SOC & Stressed SoH
const C_ORANGE: RgbTuple = [234, 88, 12]; // Cell Temp
const C_EMERALD: RgbTuple = [5, 150, 105]; // Healthy / Export
const C_ROSE: RgbTuple = [220, 38, 38]; // Breach / EoL / Outage

// Standard PDF Helvetica lacks Unicode Taka/Rupee glyphs, so render clean ASCII currency prefixes.
function formatPdfMoney(
  amount: number,
  currency: CurrencyCode,
  opts?: { signed?: boolean; decimals?: number }
): string {
  const decimals = opts?.decimals ?? 2;
  const absVal = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = amount < -0.0001 ? '-' : opts?.signed && amount > 0.0001 ? '+' : '';
  const prefix =
    currency === 'USD' ? '$' : currency === 'EUR' ? 'EUR ' : `${currency} `;
  return `${sign}${prefix}${absVal}`;
}

function safeAscii(text: string): string {
  return text
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00B2/g, '2')
    .replace(/\u00B0/g, ' deg ')
    .replace(/\u00B7/g, ' | ')
    .replace(/[^\x20-\x7E]/g, '');
}

function niceCeil(maxVal: number, fallback = 5): number {
  if (!Number.isFinite(maxVal) || maxVal <= 0) return fallback;
  const exp = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const frac = maxVal / exp;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * exp;
}

interface SeriesDef {
  label: string;
  color: RgbTuple;
  values: number[];
  dashed?: boolean;
  lineWidth?: number;
}

interface VectorChartOpts {
  doc: jsPDF;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  xLabels: string[];
  yUnit: string;
  yMin?: number;
  yMax?: number;
  series: SeriesDef[];
  referenceLine?: { value: number; label: string; color: RgbTuple };
  outageIndices?: boolean[];
}

function drawVectorLineChart(opts: VectorChartOpts) {
  const {
    doc,
    x,
    y,
    w,
    h,
    title,
    subtitle,
    xLabels,
    yUnit,
    series,
    referenceLine,
    outageIndices,
  } = opts;

  // Card Frame
  doc.setFillColor(...C_WHITE);
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_INK);
  doc.text(safeAscii(title), x + 4, y + 5.5);

  if (subtitle) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C_SLATE_500);
    doc.text(safeAscii(subtitle), x + w - 4, y + 5.5, { align: 'right' });
  }

  // Legend row
  let legX = x + 4;
  const legY = y + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  for (const s of series) {
    doc.setDrawColor(...s.color);
    doc.setLineWidth(0.9);
    if (s.dashed) {
      doc.setLineDashPattern([1.2, 1], 0);
    } else {
      doc.setLineDashPattern([], 0);
    }
    doc.line(legX, legY - 0.8, legX + 4.5, legY - 0.8);
    doc.setLineDashPattern([], 0);

    doc.setTextColor(...C_SLATE_700);
    const lbl = safeAscii(s.label);
    doc.text(lbl, legX + 5.8, legY);
    legX += doc.getTextWidth(lbl) + 9.5;
  }

  // Plot area bounds
  const padL = 13.5;
  const padR = 4;
  const padT = 13.5;
  const padB = 7.5;
  const px = x + padL;
  const py = y + padT;
  const pw = w - padL - padR;
  const ph = h - padT - padB;

  const allVals = series.flatMap((s) => s.values);
  if (referenceLine) allVals.push(referenceLine.value);
  const rawMin = allVals.length ? Math.min(...allVals) : 0;
  const rawMax = allVals.length ? Math.max(...allVals) : 10;

  const yMin = opts.yMin !== undefined ? opts.yMin : Math.min(0, Math.floor(rawMin));
  let yMax = opts.yMax !== undefined ? opts.yMax : niceCeil(Math.max(rawMax * 1.12, 1));
  if (yMax <= yMin) yMax = yMin + 10;

  const n = Math.max(1, xLabels.length);
  const xFor = (idx: number) => (n === 1 ? px : px + (idx / (n - 1)) * pw);
  const yFor = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    return py + ph - ((clamped - yMin) / (yMax - yMin)) * ph;
  };

  // Outage shading bands
  if (outageIndices && outageIndices.length === n) {
    const stepW = n > 1 ? pw / (n - 1) : pw;
    doc.setFillColor(254, 226, 226);
    for (let i = 0; i < n; i++) {
      if (outageIndices[i]) {
        const bx = Math.max(px, xFor(i) - stepW * 0.5);
        const bw = Math.min(px + pw - bx, stepW);
        doc.rect(bx, py, bw, ph, 'F');
      }
    }
  }

  // Horizontal grid lines & Y ticks
  const ticks = 4;
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.2);
  for (let t = 0; t <= ticks; t++) {
    const frac = t / ticks;
    const val = yMin + frac * (yMax - yMin);
    const ty = py + ph - frac * ph;

    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(t === 0 ? 0.3 : 0.2);
    if (t > 0) doc.setLineDashPattern([1, 1], 0);
    doc.line(px, ty, px + pw, ty);
    doc.setLineDashPattern([], 0);

    doc.setTextColor(...C_SLATE_500);
    const formatted =
      Math.abs(val) >= 100
        ? Math.round(val).toString()
        : Math.abs(val) < 10 && !Number.isInteger(val)
          ? val.toFixed(1)
          : Math.round(val).toString();
    doc.text(`${formatted}${yUnit}`, px - 1.5, ty + 1, { align: 'right' });
  }

  // X-axis ticks
  const maxXLabels = Math.min(n, 9);
  const xStep = Math.max(1, Math.floor((n - 1) / Math.max(1, maxXLabels - 1)));
  doc.setTextColor(...C_SLATE_500);
  for (let i = 0; i < n; i += xStep) {
    const lx = xFor(i);
    doc.text(safeAscii(xLabels[i] || ''), lx, py + ph + 4.2, { align: 'center' });
  }
  if ((n - 1) % xStep !== 0 && n > 2) {
    doc.text(safeAscii(xLabels[n - 1] || ''), xFor(n - 1), py + ph + 4.2, {
      align: 'right',
    });
  }

  // Reference threshold line
  if (referenceLine && referenceLine.value >= yMin && referenceLine.value <= yMax) {
    const ry = yFor(referenceLine.value);
    doc.setDrawColor(...referenceLine.color);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(px, ry, px + pw, ry);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...referenceLine.color);
    doc.text(safeAscii(referenceLine.label), px + pw - 1, ry - 1.2, { align: 'right' });
  }

  // Draw data series polylines
  for (const s of series) {
    if (s.values.length < 2) continue;
    doc.setDrawColor(...s.color);
    doc.setLineWidth(s.lineWidth ?? 0.65);
    if (s.dashed) {
      doc.setLineDashPattern([1.8, 1.2], 0);
    } else {
      doc.setLineDashPattern([], 0);
    }
    for (let i = 1; i < s.values.length; i++) {
      doc.line(xFor(i - 1), yFor(s.values[i - 1]), xFor(i), yFor(s.values[i]));
    }
    doc.setLineDashPattern([], 0);
  }
}

function addRunningHeadersAndFooters(
  doc: jsPDF,
  appName: string,
  reportTitle: string,
  generatedLabel: string
) {
  const totalPages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Subtle running header on pages 2+
    if (p > 1) {
      doc.setDrawColor(...C_BORDER);
      doc.setLineWidth(0.25);
      doc.line(margin, 10.5, pageW - margin, 10.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C_INK);
      doc.text(safeAscii(`${appName} - ${reportTitle}`), margin, 8.2);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C_SLATE_500);
      doc.text(safeAscii(generatedLabel), pageW - margin, 8.2, { align: 'right' });
    }

    // Running footer on every page
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.25);
    doc.line(margin, pageH - 11.5, pageW - margin, pageH - 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C_SLATE_500);
    doc.text(
      safeAscii(`${appName} Power Distribution Simulator Report`),
      margin,
      pageH - 7.5
    );
    doc.setFont('courier', 'normal');
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 7.5, {
      align: 'right',
    });
  }
}

export function buildSimulationPdfDocument(options: PdfReportOptions): jsPDF {
  const {
    appName,
    reportTitle,
    scenarioLabel,
    notes,
    userProfile,
    config,
    result,
    pageSize,
    includeSummary,
    includeCharts,
    includeHourlyTable,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageSize,
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const { summary, steps, longevityCurve } = result;
  const generatedLabel = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  let hasStartedContent = false;

  // =========================================================================
  // SECTION 1: Executive Summary & System Configuration Specifications
  // =========================================================================
  if (includeSummary) {
    hasStartedContent = true;
    let y = 13;

    // Top dark masthead bar
    doc.setFillColor(...C_INK);
    doc.roundedRect(margin, y, contentW, 24, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(...C_WHITE);
    doc.text(safeAscii(appName), margin + 5, y + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(
      safeAscii(`Power Distribution Simulation Report  |  ${reportTitle}`),
      margin + 5,
      y + 14.5
    );

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(148, 163, 184);
    doc.text(
      safeAscii(
        `Profile: ${scenarioLabel}  |  Horizon: ${config.horizonHours}h  |  Mode: ${
          config.plugModules.gridEnabled ? 'Hybrid (Grid-Tied)' : 'Off-Grid (Islanded)'
        }`
      ),
      margin + 5,
      y + 20.2
    );

    // Right side engineer attribution inside masthead
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C_WHITE);
    doc.text(safeAscii(userProfile.name), pageW - margin - 5, y + 8.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text(
      safeAscii(`${userProfile.role} | ${userProfile.organization}`),
      pageW - margin - 5,
      y + 14.2,
      { align: 'right' }
    );
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text(safeAscii(`Generated ${generatedLabel}`), pageW - margin - 5, y + 20.2, {
      align: 'right',
    });

    y += 28.5;

    // Diagnostic Status Banner
    const hasFaults = summary.gridCapBreachHours > 0 || summary.totalUnservedLoadKwh > 0.05;
    doc.setFillColor(hasFaults ? 254 : 236, hasFaults ? 242 : 253, hasFaults ? 242 : 245);
    doc.setDrawColor(hasFaults ? 252 : 167, hasFaults ? 165 : 243, hasFaults ? 165 : 208);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 10.5, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...(hasFaults ? C_ROSE : C_EMERALD));
    const statusTitle = hasFaults
      ? 'Grid Cap Breach or Unserved Load Detected'
      : 'All Dispatch, Autonomy & Grid Peak Constraints Satisfied';
    doc.text(statusTitle, margin + 4, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...C_SLATE_700);
    const statusDetail = hasFaults
      ? `Peak import ${summary.peakGridImportKw.toFixed(2)} kW vs ${summary.permittedGridPeakKw.toFixed(
          1
        )} kW cap (${summary.gridCapBreachHours}h breach) | Unserved load: ${summary.totalUnservedLoadKwh.toFixed(
          2
        )} kWh`
      : `Peak grid import stayed at ${summary.peakGridImportKw.toFixed(
          2
        )} kW (within ${summary.permittedGridPeakKw.toFixed(
          1
        )} kW cap) | 100% household demand served (${summary.totalServedLoadKwh.toFixed(1)} kWh).`;
    doc.text(safeAscii(statusDetail), margin + 4, y + 8.7);

    y += 15;

    // Executive Summary KPIs (4 x 2 grid)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_INK);
    doc.text('1. Executive Summary Statistics', margin, y);
    y += 3.5;

    const kpiCards = [
      {
        label: 'PV Generation Yield',
        value: `${summary.totalPvYieldKwh.toFixed(1)} kWh`,
        sub: `Direct: ${summary.totalPvDirectKwh.toFixed(1)} kWh`,
      },
      {
        label: 'Saved to Battery',
        value: `${summary.totalPvToBatteryKwh.toFixed(1)} kWh`,
        sub: `Discharged: ${summary.totalBatteryDischargedKwh.toFixed(1)} kWh`,
      },
      {
        label: 'Grid Independence',
        value: `${summary.gridIndependencePct.toFixed(1)}%`,
        sub: `Self-Consump: ${summary.selfConsumptionPct.toFixed(1)}%`,
      },
      {
        label: 'Net Energy Cost',
        value: formatPdfMoney(summary.netEnergyCost, config.currency),
        sub: `Savings: ${formatPdfMoney(summary.estimatedSavings, config.currency)}`,
      },
      {
        label: 'Peak Grid Import',
        value: `${summary.peakGridImportKw.toFixed(2)} kW`,
        sub: `Cap: ${summary.permittedGridPeakKw.toFixed(1)} kW (${summary.gridCapBreachHours}h breach)`,
      },
      {
        label: 'Battery SOC Range',
        value: `Min ${summary.minBatterySocPct.toFixed(1)}%`,
        sub: `End: ${summary.endBatterySocPct.toFixed(1)}% | Res: ${config.batteryMinReserveSocPct}%`,
      },
      {
        label: 'Battery Lifespan (80% SoH)',
        value: `${summary.projectedLifespanYears.toFixed(1)} yrs`,
        sub: `${summary.longevityRating} | Peak ${summary.peakBatteryCellTempC.toFixed(1)} C`,
      },
      {
        label: 'Curtailment & Outages',
        value: `${summary.totalCurtailedPvKwh.toFixed(2)} kWh`,
        sub:
          summary.outageHoursTotal > 0
            ? `Outage: ${summary.outageHoursSurvived}/${summary.outageHoursTotal}h survived`
            : 'No utility outages',
      },
    ];

    const colGap = 3;
    const cardW = (contentW - colGap * 3) / 4;
    const cardH = 18;
    for (let i = 0; i < kpiCards.length; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cx = margin + col * (cardW + colGap);
      const cy = y + row * (cardH + 3);
      const item = kpiCards[i];

      doc.setFillColor(...C_SURFACE);
      doc.setDrawColor(...C_BORDER);
      doc.setLineWidth(0.25);
      doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...C_SLATE_500);
      doc.text(safeAscii(item.label), cx + 3, cy + 5);

      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C_INK);
      doc.text(safeAscii(item.value), cx + 3, cy + 11);

      doc.setFont('courier', 'normal');
      doc.setFontSize(6.3);
      doc.setTextColor(...C_SLATE_700);
      doc.text(safeAscii(item.sub), cx + 3, cy + 15.5);
    }

    y += cardH * 2 + 10.5;

    // Section 2: System & Configuration Specifications Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_INK);
    doc.text('2. System Architecture & Simulation Parameters', margin, y);
    y += 3.5;

    const panel = config.solarPanelSnapshot;
    const solarSource = config.appliedWeatherForecast
      ? `Live Weather: ${config.appliedWeatherForecast.locationLabel} (${config.appliedWeatherForecast.lat.toFixed(
          2
        )}, ${config.appliedWeatherForecast.lon.toFixed(2)})`
      : config.solarPresetSnapshot
        ? `${config.solarPresetSnapshot.name} (${config.solarPresetSnapshot.peakIrradianceWm2} W/m2 peak)`
        : config.weatherProfile;

    const activeStressList = [
      config.stressTests.cloudyStreak.enabled &&
        `Cloudy Streak (-${config.stressTests.cloudyStreak.irradianceDropPct}%)`,
      config.stressTests.heatwaveSpike.enabled &&
        `Heatwave (${config.stressTests.heatwaveSpike.peakTempC} C)`,
      config.stressTests.monsoonSquall.enabled && 'Monsoon Squall',
      config.stressTests.coldSnap.enabled &&
        `Cold Snap (${config.stressTests.coldSnap.minTempC} C)`,
    ]
      .filter(Boolean)
      .join(', ');

    const specPairs: Array<[string, string]> = [
      [
        'Operating Mode & Horizon',
        `${config.plugModules.gridEnabled ? 'Hybrid Grid-Tied' : 'Off-Grid Islanded'} | ${
          config.horizonHours
        }h (${config.inputMode})`,
      ],
      [
        'Solar Array & Panel Spec',
        `${config.pvCapacityKw} kWp | ${panel.name} (${panel.wattageWp}Wp, ${panel.efficiencyPct}% eff)`,
      ],
      ['Irradiation / Sky Source', solarSource],
      [
        'Inverter Rating & Eff.',
        `${config.inverterRatedKw} kW rated | ${config.inverterEfficiencyPct}% conversion efficiency`,
      ],
      [
        'Battery Storage Pack',
        `${config.batteryCapacityKwh} kWh (${config.batteryInitialSocPct}% init / ${config.batteryMinReserveSocPct}% min reserve, ${config.batteryRoundTripEffPct}% RTE)`,
      ],
      [
        'Battery Charge / Discharge',
        `Max Charge ${config.batteryMaxChargeKw} kW | Max Discharge ${config.batteryMaxDischargeKw} kW`,
      ],
      [
        'Household Load Profile',
        `${config.householdAvgKw.toFixed(2)} kW avg (${config.loadArchetype.replace(
          /_/g,
          ' '
        )}, ${config.loadPeakFactor.toFixed(2)}x peak)`,
      ],
      [
        'Grid Cap & Export Policy',
        `Peak Cap ${config.permittedGridPeakKw} kW | ${
          config.zeroExportEnabled
            ? 'Zero-Export Enforced'
            : config.netMeteringInstalled
              ? `Net-Metering (Export Cap ${config.gridExportCapKw} kW)`
              : 'No Net-Metering'
        }`,
      ],
      [
        'Tariff & Billing Rates',
        `${config.currency} | Off-Peak ${config.offPeakRate.toFixed(2)} | Peak ${config.peakRate.toFixed(
          2
        )} (${config.peakStartHour}:00-${config.peakEndHour}:00) | Export ${config.exportCreditRate.toFixed(2)}`,
      ],
      [
        'Extreme Stress & Outages',
        `${activeStressList || 'None'} | Outage windows: ${config.outageWindows.length}`,
      ],
    ];

    const rowH = 6.8;
    const tableH = specPairs.length * rowH;
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentW, tableH, 1.5, 1.5, 'S');

    for (let i = 0; i < specPairs.length; i++) {
      const ry = y + i * rowH;
      if (i % 2 === 0) {
        doc.setFillColor(...C_SURFACE);
        doc.rect(margin + 0.15, ry + 0.15, contentW - 0.3, rowH - 0.3, 'F');
      }
      if (i > 0) {
        doc.setDrawColor(...C_BORDER);
        doc.setLineWidth(0.18);
        doc.line(margin, ry, margin + contentW, ry);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(...C_SLATE_700);
      doc.text(safeAscii(specPairs[i][0]), margin + 3, ry + 4.6);

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...C_INK);
      doc.text(safeAscii(specPairs[i][1]), margin + 52, ry + 4.6);
    }

    y += tableH + 6.5;

    // Section 3: Financial & Energy Ledger Breakdown
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_INK);
    doc.text('3. Energy Balance & Cost Breakdown', margin, y);
    y += 3.5;

    const ledgerRows: Array<[string, string, string, string]> = [
      [
        'Total Household Demand',
        `${summary.totalLoadKwh.toFixed(2)} kWh`,
        'Grid Import Energy & Cost',
        `${summary.totalGridImportKwh.toFixed(2)} kWh (${formatPdfMoney(
          summary.totalImportCost,
          config.currency
        )})`,
      ],
      [
        'Total PV Generation',
        `${summary.totalPvYieldKwh.toFixed(2)} kWh`,
        'Grid Export Energy & Credit',
        `${summary.totalGridExportKwh.toFixed(2)} kWh (-${formatPdfMoney(
          summary.totalExportCredit,
          config.currency
        )})`,
      ],
      [
        'Direct PV + Battery Served',
        `${(summary.totalPvDirectKwh + summary.totalBatteryDischargedKwh).toFixed(2)} kWh`,
        'Baseline Grid-Only Cost',
        formatPdfMoney(summary.baselineGridOnlyCost, config.currency),
      ],
      [
        'Battery Equivalent Cycles/Day',
        `${summary.equivalentFullCyclesPerDay.toFixed(2)} cyc/day`,
        'Net Cost & Estimated Savings',
        `${formatPdfMoney(summary.netEnergyCost, config.currency)} (Saves ${formatPdfMoney(
          summary.estimatedSavings,
          config.currency
        )})`,
      ],
    ];

    const ledgerH = ledgerRows.length * rowH;
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentW, ledgerH, 1.5, 1.5, 'S');
    const midX = margin + contentW / 2;

    for (let i = 0; i < ledgerRows.length; i++) {
      const ry = y + i * rowH;
      if (i % 2 === 0) {
        doc.setFillColor(...C_SURFACE);
        doc.rect(margin + 0.15, ry + 0.15, contentW - 0.3, rowH - 0.3, 'F');
      }
      if (i > 0) {
        doc.setDrawColor(...C_BORDER);
        doc.setLineWidth(0.18);
        doc.line(margin, ry, margin + contentW, ry);
      }
      doc.setDrawColor(...C_BORDER);
      doc.line(midX, ry, midX, ry + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C_SLATE_700);
      doc.text(safeAscii(ledgerRows[i][0]), margin + 3, ry + 4.6);
      doc.text(safeAscii(ledgerRows[i][2]), midX + 3, ry + 4.6);

      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C_INK);
      doc.text(safeAscii(ledgerRows[i][1]), midX - 3, ry + 4.6, { align: 'right' });
      doc.text(safeAscii(ledgerRows[i][3]), margin + contentW - 3, ry + 4.6, { align: 'right' });
    }

    y += ledgerH + 6;

    // Optional Engineer Notes
    if (notes && notes.trim()) {
      const maxNotesH = Math.max(16, pageH - 16 - y);
      if (maxNotesH >= 14) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...C_INK);
        doc.text('Engineering Remarks', margin, y);
        y += 3;

        const wrapped = doc.splitTextToSize(safeAscii(notes.trim()), contentW - 6) as string[];
        const boxH = Math.min(maxNotesH - 4, Math.max(10, wrapped.length * 4 + 4));
        doc.setFillColor(...C_SURFACE);
        doc.setDrawColor(...C_BORDER);
        doc.roundedRect(margin, y, contentW, boxH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C_SLATE_700);
        doc.text(wrapped.slice(0, Math.floor((boxH - 3) / 4)), margin + 3, y + 5);
      }
    }
  }

  // =========================================================================
  // SECTION 2: Analytical Vector Charts Page
  // =========================================================================
  if (includeCharts) {
    if (hasStartedContent) {
      doc.addPage();
    }
    hasStartedContent = true;

    let y = 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...C_INK);
    doc.text('Analytical Performance Charts', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_SLATE_500);
    doc.text(
      safeAscii(
        `Deterministic ${config.horizonHours}-hour dispatch, storage SOC, cost trajectory, and 10-year SoH projection`
      ),
      margin,
      y + 4.5
    );
    y += 9;

    const xLabels = steps.map((s) => s.shortLabel);
    const outageFlags = steps.map((s) => !s.gridOnline);

    // Chart 1: Power Generation, Consumption & Saved to Battery (full width)
    const chart1H = 74;
    drawVectorLineChart({
      doc,
      x: margin,
      y,
      w: contentW,
      h: chart1H,
      title: `Hourly Power Generation, Load & Battery Storage (${config.horizonHours}h)`,
      subtitle: `Peak PV ${Math.max(...steps.map((s) => s.pvAvailableKw), 0).toFixed(
        2
      )} kW | Peak Import ${summary.peakGridImportKw.toFixed(2)} kW`,
      xLabels,
      yUnit: ' kW',
      yMin: 0,
      series: [
        { label: 'Solar PV Gen', color: C_AMBER, values: steps.map((s) => s.pvAvailableKw), lineWidth: 0.8 },
        { label: 'Household Load', color: C_INK, values: steps.map((s) => s.householdLoadKw), lineWidth: 0.7 },
        { label: 'Saved to Battery', color: C_SKY, values: steps.map((s) => s.pvToBatteryKw), lineWidth: 0.7 },
        { label: 'Grid Import', color: C_VIOLET, values: steps.map((s) => s.gridImportKw), dashed: true, lineWidth: 0.65 },
      ],
      referenceLine: config.plugModules.gridEnabled
        ? {
            value: config.permittedGridPeakKw,
            label: `Grid Cap ${config.permittedGridPeakKw.toFixed(1)} kW`,
            color: C_ROSE,
          }
        : undefined,
      outageIndices: outageFlags,
    });

    y += chart1H + 5;

    // Chart 2: Battery SOC Trajectory & Cell Temp (full width)
    const chart2H = 68;
    drawVectorLineChart({
      doc,
      x: margin,
      y,
      w: contentW,
      h: chart2H,
      title: 'Battery State of Charge (SOC %) & Cell Temperature (C)',
      subtitle: `Min SOC ${summary.minBatterySocPct.toFixed(1)}% | Peak Cell Temp ${summary.peakBatteryCellTempC.toFixed(1)} C`,
      xLabels,
      yUnit: '%',
      yMin: 0,
      yMax: 100,
      series: [
        { label: 'Battery SOC (%)', color: C_BLUE, values: steps.map((s) => s.batterySocPct), lineWidth: 0.85 },
        {
          label: 'Cell Temp (C, scaled 0-100)',
          color: C_ORANGE,
          values: steps.map((s) => s.batteryCellTempC),
          dashed: true,
          lineWidth: 0.65,
        },
      ],
      referenceLine: {
        value: config.batteryMinReserveSocPct,
        label: `Min Reserve ${config.batteryMinReserveSocPct}%`,
        color: C_ROSE,
      },
      outageIndices: outageFlags,
    });

    y += chart2H + 5;

    // Bottom 2-column row: Chart 3 (Cumulative Cost) & Chart 4 (10-Year Longevity)
    const halfGap = 4;
    const halfW = (contentW - halfGap) / 2;
    const bottomH = Math.min(72, pageH - 16 - y);

    drawVectorLineChart({
      doc,
      x: margin,
      y,
      w: halfW,
      h: bottomH,
      title: `Cumulative Net Cost (${config.currency})`,
      subtitle: formatPdfMoney(summary.netEnergyCost, config.currency),
      xLabels,
      yUnit: '',
      series: [
        {
          label: `Cumulative Cost (${config.currency})`,
          color: C_INK,
          values: steps.map((s) => s.cumulativeNetCost),
          lineWidth: 0.8,
        },
      ],
      referenceLine: { value: 0, label: 'Breakeven 0', color: C_SLATE_500 },
    });

    drawVectorLineChart({
      doc,
      x: margin + halfW + halfGap,
      y,
      w: halfW,
      h: bottomH,
      title: '10-Year Battery SoH Longevity (%)',
      subtitle: `${summary.projectedLifespanYears.toFixed(1)} yrs to 80% EoL`,
      xLabels: longevityCurve.map((pt) => pt.yearLabel),
      yUnit: '%',
      yMin: 65,
      yMax: 100,
      series: [
        {
          label: 'Stressed SoH',
          color: C_BLUE,
          values: longevityCurve.map((pt) => pt.stressedSohPct),
          lineWidth: 0.85,
        },
        {
          label: 'Nominal Baseline',
          color: C_SLATE_500,
          values: longevityCurve.map((pt) => pt.baselineSohPct),
          dashed: true,
          lineWidth: 0.6,
        },
      ],
      referenceLine: { value: 80, label: '80% EoL', color: C_ROSE },
    });
  }

  // =========================================================================
  // SECTION 3: Paginated Hourly Dispatch & Telemetry Schedule
  // =========================================================================
  if (includeHourlyTable) {
    if (hasStartedContent) {
      doc.addPage();
    }
    hasStartedContent = true;

    const cols: Array<{ label: string; w: number; align: 'left' | 'right' }> = [
      { label: 'Time', w: 16, align: 'left' },
      { label: 'Irrad', w: 15, align: 'right' },
      { label: 'PV kW', w: 15, align: 'right' },
      { label: 'Load', w: 15, align: 'right' },
      { label: 'To Batt', w: 16, align: 'right' },
      { label: 'Disch', w: 15, align: 'right' },
      { label: 'SOC %', w: 15, align: 'right' },
      { label: 'Import', w: 16, align: 'right' },
      { label: 'Export', w: 15, align: 'right' },
      { label: 'Net Cost', w: 20, align: 'right' },
      { label: 'Flags', w: contentW - 158, align: 'left' },
    ];

    const drawTableHeader = (startY: number) => {
      doc.setFillColor(...C_INK);
      doc.rect(margin, startY, contentW, 6.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setTextColor(...C_WHITE);

      let cx = margin;
      for (const col of cols) {
        const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
        doc.text(col.label, tx, startY + 4.6, { align: col.align });
        cx += col.w;
      }
      return startY + 6.8;
    };

    let y = 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...C_INK);
    doc.text(`Hourly Dispatch & Telemetry Schedule (${config.horizonHours}h)`, margin, y);
    y += 5;

    y = drawTableHeader(y);
    const rowH = 5.4;

    for (let i = 0; i < steps.length; i++) {
      if (y + rowH > pageH - 15) {
        doc.addPage();
        y = 15;
        y = drawTableHeader(y);
      }

      const s = steps[i];
      if (!s.gridOnline) {
        doc.setFillColor(254, 242, 242);
        doc.rect(margin, y, contentW, rowH, 'F');
      } else if (i % 2 === 1) {
        doc.setFillColor(...C_SURFACE);
        doc.rect(margin, y, contentW, rowH, 'F');
      }

      doc.setDrawColor(...C_BORDER);
      doc.setLineWidth(0.12);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);

      const flagsText = s.activeEvents
        .slice(0, 2)
        .map((ev) => ev.replace(/_/g, ' '))
        .join(', ');

      const rowVals = [
        s.shortLabel,
        `${Math.round(s.irradianceWm2)}`,
        s.pvAvailableKw.toFixed(2),
        s.householdLoadKw.toFixed(2),
        s.pvToBatteryKw.toFixed(2),
        s.batteryDischargeKw.toFixed(2),
        `${s.batterySocPct.toFixed(1)}%`,
        s.gridImportKw.toFixed(2),
        s.gridExportKw.toFixed(2),
        s.hourlyNetCost.toFixed(2),
        flagsText || (s.gridOnline ? '-' : 'OUTAGE'),
      ];

      doc.setFont('courier', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C_INK);

      let cx = margin;
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
        const cellText = safeAscii(rowVals[c]).slice(0, c === cols.length - 1 ? 18 : 12);
        if (c === cols.length - 1 && !s.gridOnline) {
          doc.setTextColor(...C_ROSE);
        } else {
          doc.setTextColor(...C_INK);
        }
        doc.text(cellText, tx, y + 3.8, { align: col.align });
        cx += col.w;
      }

      y += rowH;
    }
  }

  addRunningHeadersAndFooters(doc, appName, reportTitle, generatedLabel);
  return doc;
}

export function downloadSimulationPdf(options: PdfReportOptions): string {
  const doc = buildSimulationPdfDocument(options);
  const slug = options.reportTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'simulation_report';
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${slug}_${options.config.horizonHours}h_${dateStamp}.pdf`;
  doc.save(filename);
  return filename;
}
