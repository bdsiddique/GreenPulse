import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Copy,
  Cpu,
  Download,
  FileText,
  FolderOpen,
  GitCompare,
  Save,
  Search,
  Sun,
  Trash2,
} from 'lucide-react';
import { formatMoney } from '../engine/currencies';
import { HARDWARE_TEMPLATES } from '../engine/presets';
import { BUILTIN_SOLAR_PRESETS } from '../engine/solarPresets';
import { type LibraryTabId, useSimulationStore } from '../store/useSimulationStore';
import { SolarIrradiationStudio } from './SolarIrradiationStudio';
import { CompareView } from './CompareView';

export const LibraryView: React.FC = () => {
  const {
    libraryTab,
    setLibraryTab,
    savedSimulations,
    customSolarPresets,
    isLoadingSaved,
    loadSavedSimulation,
    duplicateSavedSimulation,
    deleteSavedSimulation,
    compareWithActive,
    compareTwoRuns,
    updateConfig,
    setActiveTab,
    openSaveModal,
    openPdfModal,
    showToast,
  } = useSimulationStore();

  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'parametric' | 'fabricated'>('all');
  const [horizonFilter, setHorizonFilter] = useState<'all' | '24' | '72'>('all');
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);

  const toggleSelectForCompare = (id: string) => {
    setSelectedCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const filteredSaved = useMemo(() => {
    const q = query.trim().toLowerCase();
    return savedSimulations.filter((item) => {
      if (modeFilter !== 'all' && item.inputMode !== modeFilter) return false;
      if (horizonFilter !== 'all' && String(item.horizonHours) !== horizonFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [savedSimulations, query, modeFilter, horizonFilter]);

  const handleExportSingleJson = (id: string) => {
    const found = savedSimulations.find((s) => s.id === id);
    if (!found) return;
    const blob = new Blob([JSON.stringify(found, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${found.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tabs: Array<{
    id: LibraryTabId;
    label: string;
    count?: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'solar',
      label: 'Solar Irradiation',
      count: customSolarPresets.length + BUILTIN_SOLAR_PRESETS.length,
      icon: Sun,
    },
    {
      id: 'simulations',
      label: 'Saved Simulations',
      count: savedSimulations.length,
      icon: FolderOpen,
    },
    {
      id: 'compare',
      label: 'Comparison Mode',
      icon: GitCompare,
    },
    {
      id: 'hardware',
      label: 'Hardware Templates',
      count: HARDWARE_TEMPLATES.length,
      icon: Cpu,
    },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Compact Inline Header + Underline Sub-Tabs (No Second Top Bar) */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-0">
        <div className="flex flex-wrap items-center gap-6">
          <div className="pb-2.5">
            <h1 className="text-base font-bold tracking-tight text-slate-900">
              Engineering Library
            </h1>
          </div>

          <nav className="flex items-center gap-5" aria-label="Library sections">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = libraryTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLibraryTab(tab.id)}
                  className={`relative pb-2.5 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span className="font-mono tabular-nums text-[11px] text-slate-400">
                      ({tab.count})
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pb-2">
          <button
            type="button"
            onClick={() => openSaveModal('save')}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Save className="w-3 h-3" />
            Save Active Simulation
          </button>
        </div>
      </div>

      {/* Tab 1: Solar Irradiation Presets Studio */}
      {libraryTab === 'solar' && <SolarIrradiationStudio />}

      {/* Tab 2: Saved Simulations Archive */}
      {libraryTab === 'simulations' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Saved Simulations Archive
              </h2>
              <p className="text-xs text-slate-500">
                {savedSimulations.length} stored run{savedSimulations.length === 1 ? '' : 's'} · persisted in SQLite
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search saved runs..."
                  className="pl-8 pr-3 py-1.5 w-48 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-400"
                />
              </div>

              <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                {(['all', 'parametric', 'fabricated'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModeFilter(m)}
                    className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
                      modeFilter === m
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-mono">
                {(['all', '24', '72'] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorizonFilter(h)}
                    className={`px-2 py-1 rounded-md font-medium transition-colors ${
                      horizonFilter === h
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {h === 'all' ? 'All' : `${h}h`}
                  </button>
                ))}
              </div>

              {selectedCompareIds.length === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    compareTwoRuns(selectedCompareIds[0], selectedCompareIds[1]);
                    setSelectedCompareIds([]);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  Overlay 2 Selected Runs
                </button>
              )}
            </div>
          </div>

          {isLoadingSaved ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-11 rounded bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filteredSaved.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <FolderOpen className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-800">
                {savedSimulations.length === 0
                  ? 'No saved simulations yet'
                  : 'No saved simulations match your filter'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {savedSimulations.length === 0
                  ? 'Run any solar or hybrid/off-grid setup in Simulations and click Save in the top menubar.'
                  : 'Try clearing your search or switching horizon filters.'}
              </p>
              {savedSimulations.length === 0 && (
                <button
                  type="button"
                  onClick={() => openSaveModal('save')}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Current Simulation
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="py-2.5 pl-4 pr-1 w-8" aria-label="Select for comparison">
                      <span className="sr-only">Compare</span>
                    </th>
                    <th className="py-2.5 px-3">Simulation</th>
                    <th className="py-2.5 px-3">Mode / Horizon</th>
                    <th className="py-2.5 px-3 text-right">System Sizing</th>
                    <th className="py-2.5 px-3 text-right">Saved to Batt</th>
                    <th className="py-2.5 px-3 text-right">Grid Indep.</th>
                    <th className="py-2.5 px-3 text-right">Net Cost</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredSaved.map((sim) => {
                    const isChecked = selectedCompareIds.includes(sim.id);
                    return (
                    <tr
                      key={sim.id}
                      className={`h-12 transition-colors ${
                        isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="pl-4 pr-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectForCompare(sim.id)}
                          aria-label={`Select ${sim.name} for Comparison Mode`}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-3">
                        <div className="font-semibold text-slate-900">{sim.name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[260px]">
                          {sim.description || `Updated ${new Date(sim.updatedAt).toLocaleDateString()}`}
                        </div>
                      </td>
                      <td className="px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {sim.config.plugModules?.gridEnabled === false ? 'Off-Grid' : 'Hybrid'} · {sim.horizonHours}h
                      </td>
                      <td className="px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {sim.config.pvCapacityKw}kWp · {sim.config.batteryCapacityKwh}kWh
                      </td>
                      <td className="px-3 text-right font-mono tabular-nums text-sky-700 whitespace-nowrap">
                        {sim.summary.totalPvToBatteryKwh.toFixed(1)} kWh
                      </td>
                      <td className="px-3 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        {sim.summary.gridIndependencePct.toFixed(1)}%
                      </td>
                      <td className="px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatMoney(sim.summary.netEnergyCost, sim.currency)}
                      </td>
                      <td className="px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => loadSavedSimulation(sim.id)}
                            className="px-2.5 py-1 rounded bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => compareWithActive(sim.id)}
                            className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
                            title="Compare against active sandbox"
                          >
                            <GitCompare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateSavedSimulation(sim.id)}
                            className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openPdfModal({
                                name: sim.name,
                                description: sim.description,
                                config: sim.config,
                              })
                            }
                            className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
                            title="Export Printable PDF Report"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportSingleJson(sim.id)}
                            className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600"
                            title="Export JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedSimulation(sim.id)}
                            className="p-1.5 rounded border border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Side-by-Side Compare */}
      {libraryTab === 'compare' && <CompareView />}

      {/* Tab 4: Hardware Reference Templates */}
      {libraryTab === 'hardware' && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HARDWARE_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="text-[11px] font-medium text-slate-500">{tpl.category}</div>
                <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{tpl.name}</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{tpl.summary}</p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500 truncate">
                  {tpl.specs}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateConfig(tpl.patch);
                    setActiveTab('simulations');
                    showToast(`Applied hardware template: ${tpl.name}`, 'info');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shrink-0 transition-colors"
                >
                  Apply
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
