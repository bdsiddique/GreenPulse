import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { solveSimulation } from './engine/dispatchEngine';
import { useSimulationStore } from './store/useSimulationStore';
import { TopMenuBar } from './components/TopMenuBar';
import { BottomNav } from './components/BottomNav';
import { ControlSidebar } from './components/ControlSidebar';
import { PowerFlowSchematic } from './components/PowerFlowSchematic';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { FabricatedDataStudio } from './components/FabricatedDataStudio';
import { SaveSimulationModal } from './components/SaveSimulationModal';
import { SavedRunsDrawer } from './components/SavedRunsDrawer';
import { LoadEstimatorView } from './components/LoadEstimatorView';
import { LibraryView } from './components/LibraryView';
import { SettingsView } from './components/SettingsView';
import { SimulationMenus } from './components/SimulationMenus';
import { ExportPdfModal } from './components/ExportPdfModal';
import { StressTestDashboard } from './components/StressTestDashboard';

export default function App() {
  const {
    activeTab,
    workspaceMode,
    config,
    appName,
    fetchAdminSettings,
    fetchSavedSimulations,
    fetchSolarPresets,
    fetchScenarioProfiles,
    stepHour,
    setIsPlaying,
    toast,
    clearToast,
  } = useSimulationStore();

  // Hydrate protected identity settings, saved simulations, solar presets, and scenario profiles from SQLite API
  useEffect(() => {
    fetchAdminSettings();
    fetchSavedSimulations();
    fetchSolarPresets();
    fetchScenarioProfiles();
  }, [fetchAdminSettings, fetchSavedSimulations, fetchSolarPresets, fetchScenarioProfiles]);

  // Keep browser tab title synced with the admin-configured App Name
  useEffect(() => {
    document.title = `${appName} — Power Distribution Simulator`;
  }, [appName]);

  // Keyboard arrow scrubbing when on Simulations tab (outside text inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'simulations' || workspaceMode === 'compare') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        stepHour(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        stepHour(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, workspaceMode, stepHour, setIsPlaying]);

  // Deterministic real-time solve (< 5ms)
  const solved = useMemo(() => solveSimulation(config), [config]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pt-8 pb-16">
      {/* Single Thin macOS-Style Top Strip Menubar */}
      <TopMenuBar />

      {/* Main Active Tab Content */}
      <main>
        {activeTab === 'simulations' && (
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3.5 space-y-3.5">
            <SimulationMenus />
            {workspaceMode === 'sandbox' && (
              <div className="flex flex-col xl:flex-row gap-4 items-start">
                <ControlSidebar summary={solved.summary} />
                <div className="flex-1 min-w-0 w-full space-y-4">
                  <PowerFlowSchematic steps={solved.steps} config={config} />
                  <AnalyticsCharts result={solved} config={config} />
                </div>
              </div>
            )}

            {workspaceMode === 'fabricated' && (
              <div className="space-y-4">
                <PowerFlowSchematic steps={solved.steps} config={config} />
                <FabricatedDataStudio />
                <AnalyticsCharts result={solved} config={config} />
              </div>
            )}

            {workspaceMode === 'stress_test' && <StressTestDashboard />}
          </div>
        )}

        {activeTab === 'load_bill' && <LoadEstimatorView />}
        {activeTab === 'library' && <LibraryView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Modals & Drawers */}
      <SaveSimulationModal />
      <SavedRunsDrawer />
      <ExportPdfModal />

      {/* Crisp Toast Feedback */}
      {toast && (
        <div className="fixed bottom-18 right-4 z-50 max-w-sm bg-slate-900 text-white border border-slate-700 rounded-lg shadow-lg px-3.5 py-2.5 flex items-center gap-3 text-xs">
          <span
            className={`font-medium ${
              toast.tone === 'error'
                ? 'text-rose-300'
                : toast.tone === 'success'
                  ? 'text-emerald-300'
                  : 'text-slate-100'
            }`}
          >
            {toast.message}
          </span>
          <button
            type="button"
            onClick={clearToast}
            className="text-slate-400 hover:text-white shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4-Item Bottom Navigation Bar (Simulations, Load & Bill, Library, Settings) */}
      <BottomNav />
    </div>
  );
}
