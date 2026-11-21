import React, { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { formatMoney } from '../engine/currencies';
import { solveSimulation } from '../engine/dispatchEngine';
import { useSimulationStore } from '../store/useSimulationStore';

export const SaveSimulationModal: React.FC = () => {
  const {
    isSaveModalOpen,
    saveModalMode,
    closeSaveModal,
    config,
    activeSavedId,
    activeSavedName,
    activeSavedDescription,
    saveSimulation,
  } = useSimulationStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAction, setTargetAction] = useState<'update' | 'new'>('new');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSaveModalOpen) return;
    setError('');
    if (activeSavedId && saveModalMode === 'save') {
      setTargetAction('update');
      setName(activeSavedName);
      setDescription(activeSavedDescription);
    } else {
      setTargetAction('new');
      const suggested =
        activeSavedId && saveModalMode === 'save_as'
          ? `${activeSavedName} (v2)`
          : `${config.pvCapacityKw}kWp ${config.batteryCapacityKwh}kWh · ${config.horizonHours}h Run`;
      setName(suggested);
      setDescription(activeSavedDescription || '');
    }
  }, [
    isSaveModalOpen,
    saveModalMode,
    activeSavedId,
    activeSavedName,
    activeSavedDescription,
    config.pvCapacityKw,
    config.batteryCapacityKwh,
    config.horizonHours,
  ]);

  if (!isSaveModalOpen) return null;

  const solved = solveSimulation(config);
  const { summary } = solved;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name for this simulation.');
      return;
    }
    setIsSaving(true);
    try {
      await saveSimulation({
        name: name.trim(),
        description: description.trim(),
        overwriteId: targetAction === 'update' && activeSavedId ? activeSavedId : null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-sim-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4 text-slate-800" />
            <h2 id="save-sim-title" className="text-sm font-semibold text-slate-900">
              {targetAction === 'update' ? 'Update Saved Simulation' : 'Save Simulation'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeSaveModal}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800"
            aria-label="Close save modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {activeSavedId && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setTargetAction('update')}
                className={`py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  targetAction === 'update'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Update Existing
              </button>
              <button
                type="button"
                onClick={() => setTargetAction('new')}
                className={`py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  targetAction === 'new'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Save As New Copy
              </button>
            </div>
          )}

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Simulation Name</span>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g., Monsoon 6kWp Zero-Export Test"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">
                Engineering Notes <span className="text-slate-400 font-normal">(optional)</span>
              </span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Summarize weather assumptions, grid cap constraints, or fabricated spike notes..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </label>
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          {/* Captured Snapshot Summary */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Snapshot Preview</span>
              <span className="font-mono">
                {config.horizonHours}h · {config.inputMode === 'fabricated' ? 'Fabricated Data' : 'Parametric'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/80 text-xs font-mono tabular-nums">
              <div>
                <div className="text-[10px] font-sans text-slate-500">Assets</div>
                <div className="font-semibold text-slate-900">
                  {config.pvCapacityKw}kWp / {config.batteryCapacityKwh}kWh
                </div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-slate-500">Grid Indep.</div>
                <div className="font-semibold text-emerald-700">
                  {summary.gridIndependencePct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-slate-500">Net Cost</div>
                <div className="font-semibold text-slate-900">
                  {formatMoney(summary.netEnergyCost, config.currency)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeSaveModal}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving
                ? 'Saving...'
                : targetAction === 'update'
                  ? 'Update Simulation'
                  : 'Save Simulation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
