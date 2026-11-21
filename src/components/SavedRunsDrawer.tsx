import React, { useState } from 'react';
import {
  Copy,
  FolderOpen,
  GitCompare,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { formatMoney } from '../engine/currencies';
import { useSimulationStore } from '../store/useSimulationStore';

export const SavedRunsDrawer: React.FC = () => {
  const {
    isSavedDrawerOpen,
    setSavedDrawerOpen,
    savedSimulations,
    isLoadingSaved,
    activeSavedId,
    storageMode,
    loadSavedSimulation,
    duplicateSavedSimulation,
    renameSavedSimulation,
    deleteSavedSimulation,
    compareWithActive,
    openSaveModal,
  } = useSimulationStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (!isSavedDrawerOpen) return null;

  const commitRename = async (id: string) => {
    if (editName.trim()) {
      await renameSavedSimulation(id, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[1px]">
      <div
        className="w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl"
        role="dialog"
        aria-label="Saved Simulations"
      >
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Saved Simulations</h2>
            <p className="text-[11px] text-slate-500">
              {savedSimulations.length} saved ·{' '}
              {storageMode === 'sqlite' ? 'SQLite synced' : 'Local browser fallback'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSavedDrawerOpen(false);
                openSaveModal('save');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
            >
              <Save className="w-3.5 h-3.5" />
              Save Current
            </button>
            <button
              type="button"
              onClick={() => setSavedDrawerOpen(false)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
              aria-label="Close saved simulations drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoadingSaved ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((k) => (
                <div
                  key={k}
                  className="h-24 rounded-lg bg-slate-100 animate-pulse border border-slate-200"
                />
              ))}
            </div>
          ) : savedSimulations.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/70">
              <FolderOpen className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-800">
                No saved simulations yet
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Save your current power-flow configuration or fabricated dataset to reload or compare side by side later.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSavedDrawerOpen(false);
                  openSaveModal('save');
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                <Save className="w-3.5 h-3.5" />
                Save Current Run as Preset
              </button>
            </div>
          ) : (
            savedSimulations.map((sim) => {
              const isCurrent = sim.id === activeSavedId;
              const isEditing = editingId === sim.id;
              return (
                <div
                  key={sim.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isCurrent
                      ? 'border-slate-900 bg-slate-50/90'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editName}
                            autoFocus
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(sim.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => commitRename(sim.id)}
                            className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px]"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {sim.name}
                          {isCurrent && (
                            <span className="ml-1.5 font-normal text-blue-700">· Loaded</span>
                          )}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                        {sim.horizonHours}h ·{' '}
                        {sim.inputMode === 'fabricated' ? 'Fabricated' : 'Parametric'} ·{' '}
                        {sim.config.pvCapacityKw}kWp / {sim.config.batteryCapacityKwh}kWh
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="text-xs font-semibold text-slate-900">
                        {formatMoney(sim.summary.netEnergyCost, sim.currency)}
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        {sim.summary.gridIndependencePct.toFixed(0)}% indep.
                      </div>
                    </div>
                  </div>

                  {sim.description && (
                    <p className="mt-1.5 text-[11px] text-slate-600 line-clamp-2">
                      {sim.description}
                    </p>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
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
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700"
                      >
                        <GitCompare className="w-3 h-3" />
                        Compare
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(sim.id);
                          setEditName(sim.name);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateSavedSimulation(sim.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedSimulation(sim.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
