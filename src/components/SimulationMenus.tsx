import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Eye, FileText } from 'lucide-react';
import { STRESS_SCENARIOS } from '../engine/presets';
import { useSimulationStore } from '../store/useSimulationStore';
import { ScenarioManager } from './ScenarioManager';

type OpenSimMenu = 'scenario' | 'view' | null;

export const SimulationMenus: React.FC = () => {
  const {
    config,
    workspaceMode,
    activeSavedName,
    activeProfileId,
    scenarioProfiles,
    hasUnsavedChanges,
    setActiveTab,
    setLibraryTab,
    setWorkspaceMode,
    setHorizonHours,
    openPdfModal,
  } = useSimulationStore();

  const [openMenu, setOpenMenu] = useState<OpenSimMenu>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const activeProfile = scenarioProfiles.find((p) => p.id === activeProfileId);
  const activeScenario = !activeProfile
    ? STRESS_SCENARIOS.find((s) => s.id === config.activeScenarioId)
    : null;
  const contextLabel = activeProfile?.name || activeScenario?.title || null;

  const toggleMenu = (menu: OpenSimMenu) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center justify-between gap-2"
    >
      {/* Quiet Active Run & Profile Context */}
      <div className="flex items-center gap-2 min-w-0 text-xs">
        <span className="font-semibold text-slate-900 truncate max-w-[260px] sm:max-w-xs">
          {activeSavedName}
        </span>
        {hasUnsavedChanges && (
          <span className="text-[11px] font-medium text-amber-600 whitespace-nowrap">
            · Unsaved edits
          </span>
        )}
        {contextLabel && (
          <span className="hidden md:inline text-[11px] text-slate-500 truncate">
            · {contextLabel}
          </span>
        )}
      </div>

      {/* Simulation Secondary Dropdown Controls: Scenario Manager, Export PDF & View */}
      <div className="flex items-center gap-2 shrink-0 text-xs select-none">
        <ScenarioManager
          isOpen={openMenu === 'scenario'}
          onToggle={() => toggleMenu('scenario')}
          onClose={() => setOpenMenu(null)}
        />

        <button
          type="button"
          onClick={() => {
            setOpenMenu(null);
            openPdfModal(null);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 font-medium transition-colors whitespace-nowrap shrink-0"
          title="Export current simulation results as a printable PDF report"
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          <span>Export PDF</span>
        </button>

        {/* View Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('view')}
            aria-expanded={openMenu === 'view'}
            aria-haspopup="menu"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border font-medium transition-colors whitespace-nowrap shrink-0 ${
              openMenu === 'view'
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5 opacity-75" />
            <span>View</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                openMenu === 'view' ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openMenu === 'view' && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 w-60 bg-white/98 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg py-1.5 z-40"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActiveTab('simulations');
                  setWorkspaceMode('sandbox');
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center justify-between"
              >
                <span>Parametric Sandbox</span>
                {workspaceMode === 'sandbox' && (
                  <span className="text-blue-600 font-semibold">✓</span>
                )}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActiveTab('simulations');
                  setWorkspaceMode('fabricated');
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center justify-between"
              >
                <span>Fabricated Data Studio</span>
                {workspaceMode === 'fabricated' && (
                  <span className="text-blue-600 font-semibold">✓</span>
                )}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setLibraryTab('compare');
                  setActiveTab('library');
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center justify-between"
              >
                <span>Comparison Mode (Library)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActiveTab('load_bill');
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
              >
                DESCO Bill & Load Estimator
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setLibraryTab('solar');
                  setActiveTab('library');
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
              >
                Solar Irradiation Presets
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setHorizonHours(24);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center justify-between"
              >
                <span>24-Hour Horizon</span>
                {config.horizonHours === 24 && (
                  <span className="text-blue-600 font-semibold">✓</span>
                )}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setHorizonHours(72);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center justify-between"
              >
                <span>72-Hour Autonomy Horizon</span>
                {config.horizonHours === 72 && (
                  <span className="text-blue-600 font-semibold">✓</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
