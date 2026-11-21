import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { formatMoney } from '../engine/currencies';
import { solveSimulation } from '../engine/dispatchEngine';
import {
  downloadSimulationPdf,
  type PdfPageSize,
} from '../engine/pdfReportGenerator';
import { STRESS_SCENARIOS } from '../engine/presets';
import { useSimulationStore } from '../store/useSimulationStore';

export const ExportPdfModal: React.FC = () => {
  const {
    isPdfModalOpen,
    pdfExportTarget,
    closePdfModal,
    appName,
    userProfile,
    config,
    activeSavedName,
    activeSavedDescription,
    activeProfileId,
    scenarioProfiles,
    showToast,
  } = useSimulationStore();

  const targetConfig = pdfExportTarget?.config ?? config;
  const defaultTitle = pdfExportTarget?.name || activeSavedName || 'Simulation Report';
  const defaultNotes = pdfExportTarget?.description ?? activeSavedDescription ?? '';

  const [reportTitle, setReportTitle] = useState(defaultTitle);
  const [notes, setNotes] = useState(defaultNotes);
  const [pageSize, setPageSize] = useState<PdfPageSize>('a4');
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeHourlyTable, setIncludeHourlyTable] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isPdfModalOpen) {
      setReportTitle(defaultTitle);
      setNotes(defaultNotes);
    }
  }, [isPdfModalOpen, defaultTitle, defaultNotes]);

  const solved = useMemo(() => solveSimulation(targetConfig), [targetConfig]);

  const scenarioLabel = useMemo(() => {
    if (!pdfExportTarget && activeProfileId) {
      const prof = scenarioProfiles.find((p) => p.id === activeProfileId);
      if (prof) return prof.name;
    }
    const builtin = STRESS_SCENARIOS.find((s) => s.id === targetConfig.activeScenarioId);
    return builtin?.title || 'Custom Configuration';
  }, [pdfExportTarget, activeProfileId, scenarioProfiles, targetConfig.activeScenarioId]);

  if (!isPdfModalOpen) return null;

  const estimatedPages =
    (includeSummary ? 1 : 0) +
    (includeCharts ? 1 : 0) +
    (includeHourlyTable ? (targetConfig.horizonHours === 72 ? 2 : 1) : 0);

  const nothingSelected = !includeSummary && !includeCharts && !includeHourlyTable;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (nothingSelected) return;
    setIsGenerating(true);
    try {
      const filename = downloadSimulationPdf({
        appName,
        reportTitle: reportTitle.trim() || defaultTitle,
        scenarioLabel,
        notes: notes.trim(),
        userProfile,
        config: targetConfig,
        result: solved,
        pageSize,
        includeSummary,
        includeCharts,
        includeHourlyTable,
      });
      showToast(`Exported printable PDF report "${filename}".`, 'success');
      closePdfModal();
    } catch {
      showToast('Failed to generate PDF report. Please try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Export Printable PDF Report"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-slate-700 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 truncate">
                Export Printable PDF Report
              </h2>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums truncate">
                {targetConfig.horizonHours}h · {targetConfig.pvCapacityKw} kWp ·{' '}
                {targetConfig.batteryCapacityKwh} kWh · {estimatedPages} page
                {estimatedPages === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePdfModal}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close PDF export dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="p-5 space-y-4">
          {/* Report Metadata Inputs */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-700">
              Report Title
              <input
                type="text"
                required
                maxLength={100}
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="e.g., Summer Peak 6 kWp Hybrid Feasibility"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              Engineering Notes / Remarks (Optional)
              <textarea
                rows={2}
                maxLength={400}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes printed on Page 1 executive summary..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900 resize-none"
              />
            </label>
          </div>

          {/* Paper Size & Report Sections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">Included Sections</div>
              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Executive Summary & System Specs</span>
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCharts}
                  onChange={(e) => setIncludeCharts(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Analytical Vector Charts (4 Figures)</span>
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHourlyTable}
                  onChange={(e) => setIncludeHourlyTable(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Hourly Dispatch Schedule ({targetConfig.horizonHours} rows)</span>
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">Paper Format</div>
              <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                {(
                  [
                    { id: 'a4', label: 'A4 (210 × 297 mm)' },
                    { id: 'letter', label: 'US Letter' },
                  ] as Array<{ id: PdfPageSize; label: string }>
                ).map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setPageSize(fmt.id)}
                    className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                      pageSize === fmt.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                Vector-drawn charts for crisp printing, with {appName} branding and{' '}
                {userProfile.name} attribution.
              </div>
            </div>
          </div>

          {/* Snapshot of Included Summary Metrics */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">PV Yield</span>
              <strong className="font-mono tabular-nums text-slate-900">
                {solved.summary.totalPvYieldKwh.toFixed(1)} kWh
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Saved to Batt</span>
              <strong className="font-mono tabular-nums text-sky-700">
                {solved.summary.totalPvToBatteryKwh.toFixed(1)} kWh
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Grid Indep.</span>
              <strong className="font-mono tabular-nums text-emerald-700">
                {solved.summary.gridIndependencePct.toFixed(1)}%
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Net Cost</span>
              <strong className="font-mono tabular-nums text-slate-900">
                {formatMoney(solved.summary.netEnergyCost, targetConfig.currency)}
              </strong>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={closePdfModal}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || nothingSelected}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {isGenerating ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
