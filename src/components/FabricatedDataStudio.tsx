import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ClipboardPaste,
  Download,
  RefreshCw,
  Settings,
  Sun,
  Upload,
  Zap,
  ZapOff,
} from 'lucide-react';
import { CURRENCIES } from '../engine/currencies';
import {
  ensureFabricatedRows,
  formatHourClock,
  parseFabricatedImport,
  rowsToCsv,
} from '../engine/dispatchEngine';
import { calculatePvOutputKw } from '../engine/solarPanels';
import { useSimulationStore } from '../store/useSimulationStore';

export const FabricatedDataStudio: React.FC = () => {
  const {
    config,
    selectedHour,
    setSelectedHour,
    setInputMode,
    seedFabricatedFromParametric,
    updateFabricatedRow,
    setFabricatedRows,
    setActiveTab,
    showToast,
  } = useSimulationStore();

  const rows = ensureFabricatedRows(config);
  const currencySymbol = CURRENCIES[config.currency]?.symbol ?? '৳';
  const panel = config.solarPanelSnapshot;

  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApplyPaste = () => {
    const { rows: parsed, errors } = parseFabricatedImport(
      pasteText,
      config.horizonHours,
      config.pvCapacityKw
    );
    setImportErrors(errors);
    if (parsed.length > 0) {
      setFabricatedRows(parsed);
      setShowPasteBox(false);
      setPasteText('');
      showToast(`Imported ${parsed.length} hourly irradiation & load rows.`, 'success');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const { rows: parsed, errors } = parseFabricatedImport(
        text,
        config.horizonHours,
        config.pvCapacityKw
      );
      setImportErrors(errors);
      if (parsed.length > 0) {
        setFabricatedRows(parsed);
        showToast(`Loaded "${file.name}" (${parsed.length} rows).`, 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadCsv = (templateOnly = false) => {
    const targetRows = templateOnly
      ? Array.from({ length: config.horizonHours }, (_, h) => {
          const hrOfDay = h % 24;
          const irr =
            hrOfDay >= 6 && hrOfDay <= 18
              ? Math.round(Math.sin(((hrOfDay - 6) / 12) * Math.PI) * 920)
              : 0;
          return {
            hour: h,
            irradianceWm2: irr,
            loadKw: 2.0,
            gridOnline: true,
            importRate: config.offPeakRate,
            exportRate: config.exportCreditRate,
          };
        })
      : rows;
    const blob = new Blob([rowsToCsv(targetRows, config.horizonHours)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateOnly
      ? `gridpulse_irradiation_template_${config.horizonHours}h.csv`
      : `gridpulse_hourly_dataset_${config.horizonHours}h.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleInjectLoadSpike = () => {
    const spikeStart = Math.min(config.horizonHours - 2, Math.max(0, selectedHour));
    const next = rows.map((r) =>
      r.hour >= spikeStart && r.hour < spikeStart + 2
        ? { ...r, loadKw: Number((r.loadKw + 4.5).toFixed(2)) }
        : r
    );
    setFabricatedRows(next);
    showToast(`Injected +4.5 kW load spike at Hr ${spikeStart}–${spikeStart + 1}.`, 'info');
  };

  const handleInjectOutageBlock = () => {
    const start = Math.min(config.horizonHours - 3, Math.max(0, selectedHour));
    const next = rows.map((r) =>
      r.hour >= start && r.hour < start + 3 ? { ...r, gridOnline: false } : r
    );
    setFabricatedRows(next);
    showToast(`Injected 3-hour grid outage at Hr ${start}–${start + 2}.`, 'info');
  };

  const samplePanelStats = calculatePvOutputKw({
    irradianceWm2: 1000,
    pvCapacityKw: config.pvCapacityKw,
    ambientTempC: 25,
    panel,
    pvEnabled: config.plugModules.pvEnabled,
  });

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Studio Header & Utility Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              User-Fabricated Hourly Dataset ({config.horizonHours}h)
            </h3>
            <span className="text-xs text-slate-500">
              · {config.inputMode === 'fabricated' ? 'Active Input Source' : 'Preview (Edit any row to activate)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter hourly solar irradiation (W/m²), household load, grid status, and tariff rates. PV generation is computed automatically from installed capacity and selected panel physics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {config.inputMode !== 'fabricated' ? (
            <button
              type="button"
              onClick={() => setInputMode('fabricated')}
              className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 whitespace-nowrap"
            >
              Activate Fabricated Mode
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setInputMode('parametric')}
              className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium whitespace-nowrap"
            >
              Switch Back to Parametric
            </button>
          )}

          <button
            type="button"
            onClick={seedFabricatedFromParametric}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Seed from Parametric
          </button>

          <button
            type="button"
            onClick={handleInjectLoadSpike}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            +Spike ({formatHourClock(selectedHour, config.horizonHours).shortLabel})
          </button>

          <button
            type="button"
            onClick={handleInjectOutageBlock}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            <ZapOff className="w-3.5 h-3.5 text-rose-600" />
            +3h Outage
          </button>

          <button
            type="button"
            onClick={() => setShowPasteBox((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste CSV / JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.json,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => handleDownloadCsv(false)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => handleDownloadCsv(true)}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap"
          >
            Template
          </button>
        </div>
      </div>

      {/* Active Solar Array & Panel Physics Strip */}
      <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-700">
          <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-semibold text-slate-900">{panel.name}</span>
          <span className="font-mono tabular-nums text-[11px] text-slate-600">
            {config.pvCapacityKw.toFixed(1)} kWp (~{samplePanelStats.effectivePanelCount} panels · {samplePanelStats.arrayAreaM2} m²) · Eff {panel.efficiencyPct}% · {panel.tempCoeffPctPerC}%/°C · NOCT {panel.noctC}°C · BOS -{panel.systemLossPct}%
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
        >
          <Settings className="w-3 h-3" />
          Configure Panels in Settings
        </button>
      </div>

      {/* Inline Paste CSV/JSON Drawer */}
      {showPasteBox && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">
              Paste CSV, TSV, or JSON (columns: timestamp, irradiance_wm2, load_kw, grid_online, import_rate, export_rate)
            </span>
            <button
              type="button"
              onClick={() => setShowPasteBox(false)}
              className="text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
          <textarea
            rows={5}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'timestamp,irradiance_wm2,load_kw,grid_online,import_rate,export_rate\n00:00,0,1.20,1,7.50,6.20\n12:00,920,2.10,1,7.50,6.20'}
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs text-slate-800 focus:outline-none focus:border-slate-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPasteText(rowsToCsv(rows, config.horizonHours))}
              className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Fill Current Rows
            </button>
            <button
              type="button"
              onClick={handleApplyPaste}
              className="px-3.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
            >
              Parse & Apply Dataset
            </button>
          </div>
        </div>
      )}

      {/* Inline Validation Errors */}
      {importErrors.length > 0 && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-semibold text-rose-900">
              <AlertCircle className="w-3.5 h-3.5" />
              Import Validation Notice
            </span>
            <button
              type="button"
              onClick={() => setImportErrors([])}
              className="text-rose-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 font-mono text-[11px]">
            {importErrors.slice(0, 5).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Compact High-Density Hourly Spreadsheet (Timestamp Only + Solar Irradiation W/m² -> Computed PV kW) */}
      <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
            <tr>
              <th className="py-2.5 px-3.5 w-32">Timestamp</th>
              <th className="py-2.5 px-3 text-right">Solar Irradiation (W/m²)</th>
              <th className="py-2.5 px-3 text-right">Calc PV (kW)</th>
              <th className="py-2.5 px-3 text-right">Household Load (kW)</th>
              <th className="py-2.5 px-3 text-center">Utility Grid</th>
              <th className="py-2.5 px-3 text-right">Import ({currencySymbol}/kWh)</th>
              <th className="py-2.5 px-3 text-right">Export ({currencySymbol}/kWh)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {rows.map((row) => {
              const { clockLabel, hourOfDay } = formatHourClock(row.hour, config.horizonHours);
              const isSelected = row.hour === selectedHour;
              const diurnalAmb = 26 + Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) * 4.5;
              const ambTempC = row.ambientTempC ?? diurnalAmb;
              const computed = calculatePvOutputKw({
                irradianceWm2: row.irradianceWm2,
                pvCapacityKw: config.pvCapacityKw,
                ambientTempC: ambTempC,
                panel,
                pvEnabled: config.plugModules.pvEnabled,
              });

              return (
                <tr
                  key={row.hour}
                  onClick={() => setSelectedHour(row.hour)}
                  className={`h-10 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/70'
                      : !row.gridOnline
                        ? 'bg-rose-50/40 hover:bg-rose-50/70'
                        : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-3.5 font-mono tabular-nums font-medium text-slate-800 whitespace-nowrap">
                    {clockLabel}
                  </td>
                  <td className="px-3 text-right">
                    <input
                      type="number"
                      min={0}
                      max={1400}
                      step={10}
                      value={row.irradianceWm2}
                      onChange={(e) =>
                        updateFabricatedRow(row.hour, {
                          irradianceWm2: Math.max(0, Math.min(1400, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-24 text-right font-mono tabular-nums rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                    />
                  </td>
                  <td
                    className="px-3 text-right font-mono tabular-nums text-amber-700 font-semibold whitespace-nowrap"
                    title={`Cell Temp ${computed.cellTempC}°C · Thermal ${(computed.thermalFactor * 100).toFixed(0)}% · BOS ${(computed.bosFactor * 100).toFixed(0)}%`}
                  >
                    {computed.pvKw.toFixed(2)}
                  </td>
                  <td className="px-3 text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={row.loadKw}
                      onChange={(e) =>
                        updateFabricatedRow(row.hour, {
                          loadKw: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-24 text-right font-mono tabular-nums rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                    />
                  </td>
                  <td className="px-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFabricatedRow(row.hour, { gridOnline: !row.gridOnline });
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        row.gridOnline
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {row.gridOnline ? 'Online' : 'Outage'}
                    </button>
                  </td>
                  <td className="px-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={row.importRate}
                      onChange={(e) =>
                        updateFabricatedRow(row.hour, {
                          importRate: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-20 text-right font-mono tabular-nums rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                    />
                  </td>
                  <td className="px-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={row.exportRate}
                      onChange={(e) =>
                        updateFabricatedRow(row.hour, {
                          exportRate: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-20 text-right font-mono tabular-nums rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
