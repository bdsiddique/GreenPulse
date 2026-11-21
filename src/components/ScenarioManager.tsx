import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  GitCompare,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { STRESS_SCENARIOS } from '../engine/presets';
import { useSimulationStore } from '../store/useSimulationStore';

interface ScenarioManagerProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const ScenarioManager: React.FC<ScenarioManagerProps> = ({
  isOpen,
  onToggle,
  onClose,
}) => {
  const {
    config,
    scenarioProfiles,
    activeProfileId,
    applyScenario,
    saveScenarioProfile,
    applyScenarioProfile,
    duplicateScenarioProfile,
    deleteScenarioProfile,
    compareTwoRuns,
    setActiveTab,
    setLibraryTab,
  } = useSimulationStore();

  const [isCreating, setIsCreating] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileDesc, setProfileDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const activeProfile = useMemo(
    () => scenarioProfiles.find((p) => p.id === activeProfileId) || null,
    [scenarioProfiles, activeProfileId]
  );

  const activeBuiltin = useMemo(
    () => (!activeProfile ? STRESS_SCENARIOS.find((s) => s.id === config.activeScenarioId) || null : null),
    [activeProfile, config.activeScenarioId]
  );

  const activeLabel = activeProfile?.name || activeBuiltin?.title || null;

  const filteredSavedProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return scenarioProfiles;
    return scenarioProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [scenarioProfiles, searchQuery]);

  const filteredBuiltins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return STRESS_SCENARIOS;
    return STRESS_SCENARIOS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSaveNewProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = profileName.trim();
    if (!clean) return;
    setIsSaving(true);
    await saveScenarioProfile({
      name: clean,
      description: profileDesc.trim(),
    });
    setIsSaving(false);
    setProfileName('');
    setProfileDesc('');
    setIsCreating(false);
  };

  const handleOverwriteActive = async () => {
    if (!activeProfile) return;
    setIsSaving(true);
    await saveScenarioProfile({
      name: activeProfile.name,
      description: activeProfile.description,
      overwriteId: activeProfile.id,
    });
    setIsSaving(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border font-medium transition-colors whitespace-nowrap shrink-0 ${
          isOpen
            ? 'bg-slate-900 border-slate-900 text-white'
            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
        }`}
      >
        <Layers className="w-3.5 h-3.5 opacity-75" />
        <span>Scenario Manager</span>
        {activeLabel && (
          <span
            className={`hidden sm:inline font-normal max-w-[148px] truncate ${
              isOpen ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            · {activeLabel}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Scenario Manager"
          className="absolute right-0 top-full mt-1.5 w-[368px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl z-40 text-slate-800 overflow-hidden select-text"
        >
          {/* Header & Quick Save Actions */}
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900">Scenario Manager</div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums truncate">
                {config.pvCapacityKw} kWp · {config.batteryCapacityKwh} kWh · {config.horizonHours}h ·{' '}
                {config.plugModules.gridEnabled ? 'Hybrid' : 'Off-Grid'}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {activeProfile && !isCreating && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleOverwriteActive}
                  title={`Update "${activeProfile.name}" with current configuration`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 whitespace-nowrap"
                >
                  <RefreshCw className="w-3 h-3" />
                  Update
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCreating((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold whitespace-nowrap transition-colors"
              >
                <Plus className="w-3 h-3" />
                {isCreating ? 'Close' : 'Save Profile'}
              </button>
            </div>
          </div>

          {/* Inline Save Current Configuration Profile Form */}
          {isCreating && (
            <form
              onSubmit={handleSaveNewProfile}
              className="px-3.5 py-3 border-b border-slate-200 bg-slate-50/70 space-y-2.5"
            >
              <label className="block text-[11px] font-medium text-slate-700">
                Profile Name
                <input
                  type="text"
                  required
                  maxLength={80}
                  autoFocus
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., Summer Peak or Winter Low Irradiation"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <label className="block text-[11px] font-medium text-slate-700">
                Configuration Note (optional)
                <input
                  type="text"
                  maxLength={200}
                  value={profileDesc}
                  onChange={(e) => setProfileDesc(e.target.value)}
                  placeholder="e.g., 8 kWp TOPCon + 15 kWh battery + evening ToU cap"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                  Captures full asset, solar & tariff setup
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setProfileName('');
                      setProfileDesc('');
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !profileName.trim()}
                    className="px-3 py-1 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[11px] font-semibold"
                  >
                    {isSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Filter Input */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter saved & seasonal profiles..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-400"
              />
            </div>
          </div>

          {/* Scrollable Profile Lists */}
          <div className="overflow-y-auto divide-y divide-slate-100">
            {/* Saved Configuration Profiles */}
            <div className="py-2">
              <div className="px-3.5 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>Saved Configuration Profiles</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {scenarioProfiles.length}
                </span>
              </div>

              {filteredSavedProfiles.length === 0 ? (
                <div className="px-3.5 py-2 text-[11px] text-slate-500">
                  {scenarioProfiles.length === 0
                    ? 'No custom profiles saved yet. Click Save Profile above to store your current configuration.'
                    : 'No saved profiles match your filter.'}
                </div>
              ) : (
                <div>
                  {filteredSavedProfiles.map((prof) => {
                    const isActive = activeProfileId === prof.id;
                    return (
                      <div
                        key={prof.id}
                        className={`group px-3.5 py-2 flex items-start justify-between gap-2 transition-colors ${
                          isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            applyScenarioProfile(prof.id);
                            onClose();
                          }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                            <span
                              className={`text-xs truncate ${
                                isActive
                                  ? 'font-semibold text-blue-700'
                                  : 'font-medium text-slate-900'
                              }`}
                            >
                              {prof.name}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5 truncate">
                            {prof.config.pvCapacityKw} kWp · {prof.config.batteryCapacityKwh} kWh ·{' '}
                            {prof.config.horizonHours}h ·{' '}
                            {prof.config.plugModules?.gridEnabled === false ? 'Off-Grid' : 'Hybrid'}
                          </div>
                          {prof.description && (
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {prof.description}
                            </div>
                          )}
                        </button>

                        <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              compareTwoRuns('__active__', `profile:${prof.id}`);
                              onClose();
                            }}
                            title="Compare this profile against active sandbox"
                            className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <GitCompare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateScenarioProfile(prof.id)}
                            title="Duplicate profile"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteScenarioProfile(prof.id)}
                            title="Delete profile"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Built-in Seasonal & Stress Presets */}
            <div className="py-2">
              <div className="px-3.5 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>Built-In Seasonal & Stress Profiles</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {filteredBuiltins.length}
                </span>
              </div>

              {filteredBuiltins.length === 0 ? (
                <div className="px-3.5 py-2 text-[11px] text-slate-500">
                  No built-in profiles match your filter.
                </div>
              ) : (
                <div>
                  {filteredBuiltins.map((sc) => {
                    const isActive = !activeProfileId && config.activeScenarioId === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => {
                          setActiveTab('simulations');
                          applyScenario(sc.id);
                          onClose();
                        }}
                        className={`w-full px-3.5 py-2 text-left transition-colors flex items-start justify-between gap-2 ${
                          isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                            <span
                              className={`text-xs truncate ${
                                isActive
                                  ? 'font-semibold text-blue-700'
                                  : 'font-medium text-slate-800'
                              }`}
                            >
                              {sc.title}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {sc.description}
                          </div>
                        </div>
                        <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0 pt-0.5">
                          {sc.horizonTag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer Shortcut to Comparison Mode */}
          <div className="px-3.5 py-2 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              Overlay any two profiles side-by-side
            </span>
            <button
              type="button"
              onClick={() => {
                setLibraryTab('compare');
                setActiveTab('library');
                onClose();
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap"
            >
              <GitCompare className="w-3 h-3" />
              Comparison Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
