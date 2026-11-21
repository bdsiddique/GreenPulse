import { create } from 'zustand';
import type {
  AppTab,
  CurrencyCode,
  ExtremeWeatherStressConfig,
  FabricatedRow,
  HorizonHours,
  InputMode,
  OutageWindow,
  PlugModulesConfig,
  SavedSimulationRecord,
  ScenarioId,
  ScenarioProfile,
  SimWorkspaceMode,
  SimulationConfig,
  SolarIrradiationPreset,
  SolarPanelSpec,
  UserProfile,
  WeatherSnapshot,
} from '../types/simulation';
import {
  BUILTIN_SOLAR_PRESETS,
  normalizeSolarPreset,
} from '../engine/solarPresets';
import {
  BUILTIN_SOLAR_PANELS,
  DEFAULT_SOLAR_PANEL_ID,
  normalizeSolarPanel,
} from '../engine/solarPanels';
import { CURRENCIES } from '../engine/currencies';
import {
  buildFabricatedRowsFromParametric,
  ensureFabricatedRows,
  solveSimulation,
} from '../engine/dispatchEngine';
import {
  createDefaultConfig,
  normalizeConfig,
  STRESS_SCENARIOS,
} from '../engine/presets';
import {
  type ApplianceItem,
  computeApplianceSummary,
  createDefaultDescoConfig,
  createStarterAppliances,
  type DescoBillConfig,
  DESCO_LTE_OFFPEAK_RATE,
  DESCO_LTE_PEAK_RATE,
  solveDescoBill,
} from '../engine/descoTariff';

const LS_SAVED_KEY = 'gridpulse_saved_simulations_v1';
const LS_PROFILE_KEY = 'gridpulse_user_profile_v1';
const LS_CURRENCY_KEY = 'gridpulse_default_currency_v1';
const LS_DESCO_KEY = 'gridpulse_desco_config_v1';
const LS_APPLIANCES_KEY = 'gridpulse_appliances_v1';
const LS_SOLAR_PRESETS_KEY = 'gridpulse_solar_presets_v1';
const LS_SOLAR_PANELS_KEY = 'gridpulse_solar_panels_v1';
const LS_DEFAULT_PANEL_KEY = 'gridpulse_default_solar_panel_v1';
const LS_SCENARIO_PROFILES_KEY = 'gridpulse_scenario_profiles_v1';

const LS_LOCATION_CITY_KEY = 'gridpulse_weather_city_v1';
const DEFAULT_APP_NAME = 'GridPulse';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Tariq Siddique',
  role: 'Lead Power Systems Engineer',
  organization: 'GridPulse Energy Labs',
  email: 'siddique.unm@gmail.com',
  locationCity: 'Dhaka',
};

function readLocalSaved(): SavedSimulationRecord[] {
  try {
    const raw = localStorage.getItem(LS_SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((item) => ({ ...item, config: normalizeConfig(item.config || {}) }))
      : [];
  } catch {
    return [];
  }
}

function writeLocalSaved(items: SavedSimulationRecord[]) {
  try {
    localStorage.setItem(LS_SAVED_KEY, JSON.stringify(items));
  } catch {
    // Ignore quota errors
  }
}

function readLocalLocationCity(): string {
  try {
    const city = localStorage.getItem(LS_LOCATION_CITY_KEY);
    if (city && city.trim()) return city.trim();
    const legacy = localStorage.getItem(LS_PROFILE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (typeof parsed?.locationCity === 'string' && parsed.locationCity.trim()) {
        return parsed.locationCity.trim();
      }
    }
    return DEFAULT_PROFILE.locationCity;
  } catch {
    return DEFAULT_PROFILE.locationCity;
  }
}

function readInitialProfile(): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    locationCity: readLocalLocationCity(),
  };
}

function readLocalDefaultCurrency(): CurrencyCode {
  try {
    const raw = localStorage.getItem(LS_CURRENCY_KEY) as CurrencyCode | null;
    if (raw && CURRENCIES[raw]) return raw;
    return 'BDT';
  } catch {
    return 'BDT';
  }
}

function readLocalDesco(): DescoBillConfig {
  try {
    const raw = localStorage.getItem(LS_DESCO_KEY);
    if (!raw) return createDefaultDescoConfig();
    return { ...createDefaultDescoConfig(), ...JSON.parse(raw) };
  } catch {
    return createDefaultDescoConfig();
  }
}

function readLocalAppliances(): ApplianceItem[] {
  try {
    const raw = localStorage.getItem(LS_APPLIANCES_KEY);
    if (!raw) return createStarterAppliances();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : createStarterAppliances();
  } catch {
    return createStarterAppliances();
  }
}

function readLocalSolarPresets(): SolarIrradiationPreset[] {
  try {
    const raw = localStorage.getItem(LS_SOLAR_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((p) => normalizeSolarPreset({ ...p, isBuiltIn: false }))
      : [];
  } catch {
    return [];
  }
}

function writeLocalSolarPresets(items: SolarIrradiationPreset[]) {
  try {
    localStorage.setItem(LS_SOLAR_PRESETS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function readLocalSolarPanels(): SolarPanelSpec[] {
  try {
    const raw = localStorage.getItem(LS_SOLAR_PANELS_KEY);
    if (!raw) return BUILTIN_SOLAR_PANELS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return BUILTIN_SOLAR_PANELS;
    return parsed.map((p) => normalizeSolarPanel(p));
  } catch {
    return BUILTIN_SOLAR_PANELS;
  }
}

function writeLocalSolarPanels(items: SolarPanelSpec[]) {
  try {
    localStorage.setItem(LS_SOLAR_PANELS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function readLocalDefaultPanelId(panels: SolarPanelSpec[]): string {
  try {
    const raw = localStorage.getItem(LS_DEFAULT_PANEL_KEY);
    if (raw && panels.some((p) => p.id === raw)) return raw;
    return panels[0]?.id || DEFAULT_SOLAR_PANEL_ID;
  } catch {
    return panels[0]?.id || DEFAULT_SOLAR_PANEL_ID;
  }
}

function readLocalScenarioProfiles(): ScenarioProfile[] {
  try {
    const raw = localStorage.getItem(LS_SCENARIO_PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((item) => ({ ...item, config: normalizeConfig(item.config || {}) }))
      : [];
  } catch {
    return [];
  }
}

function writeLocalScenarioProfiles(items: ScenarioProfile[]) {
  try {
    localStorage.setItem(LS_SCENARIO_PROFILES_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export interface ToastNotice {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'error';
}

export interface AdminStatus {
  loaded: boolean;
  adminConfigured: boolean;
  envPasscodeActive: boolean;
  smtpConfigured: boolean;
  adminEmailMasked: string;
  authenticated: boolean;
}

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  maskedEmail?: string;
  expiresInMinutes?: number;
}

export type SandboxPanelId = 'stressTests' | 'assets' | 'load' | 'grid';
export type LibraryTabId = 'simulations' | 'solar' | 'compare' | 'hardware';

interface SimulationStoreState {
  activeTab: AppTab;
  workspaceMode: SimWorkspaceMode;
  libraryTab: LibraryTabId;

  activeSidebarTab: SandboxPanelId;

  config: SimulationConfig;
  activeSavedId: string | null;
  activeSavedName: string;
  activeSavedDescription: string;
  hasUnsavedChanges: boolean;

  selectedHour: number;
  isPlaying: boolean;
  playbackSpeed: 1 | 2 | 4;

  savedSimulations: SavedSimulationRecord[];
  isLoadingSaved: boolean;
  storageMode: 'sqlite' | 'local';

  scenarioProfiles: ScenarioProfile[];
  activeProfileId: string | null;
  isLoadingScenarioProfiles: boolean;

  customSolarPresets: SolarIrradiationPreset[];
  isLoadingSolarPresets: boolean;

  solarPanels: SolarPanelSpec[];
  defaultSolarPanelId: string;

  compareAId: string;
  compareBId: string;

  isSaveModalOpen: boolean;
  saveModalMode: 'save' | 'save_as';
  isSavedDrawerOpen: boolean;
  isPdfModalOpen: boolean;
  pdfExportTarget: {
    name: string;
    description: string;
    config: SimulationConfig;
  } | null;

  // DESCO Bill & Appliance Load Estimator state
  descoConfig: DescoBillConfig;
  appliances: ApplianceItem[];

  appName: string;
  userProfile: UserProfile;
  adminStatus: AdminStatus;
  adminToken: string | null; // Held strictly in JS/React memory (never persisted to browser storage)
  defaultCurrency: CurrencyCode;
  toast: ToastNotice | null;

  // Navigation & UI
  setActiveTab: (tab: AppTab) => void;
  setWorkspaceMode: (mode: SimWorkspaceMode) => void;
  setLibraryTab: (tab: LibraryTabId) => void;
  setActiveSidebarTab: (panel: SandboxPanelId) => void;
  openSaveModal: (mode?: 'save' | 'save_as') => void;
  closeSaveModal: () => void;
  setSavedDrawerOpen: (open: boolean) => void;
  openPdfModal: (target?: {
    name: string;
    description: string;
    config: SimulationConfig;
  } | null) => void;
  closePdfModal: () => void;
  showToast: (message: string, tone?: 'success' | 'info' | 'error') => void;
  clearToast: () => void;

  // Playback
  setSelectedHour: (hour: number) => void;
  stepHour: (delta: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: 1 | 2 | 4) => void;

  // Config, Plug-and-Play Modules & Stress Tests
  updateConfig: (patch: Partial<SimulationConfig>, markCustom?: boolean) => void;
  togglePlugModule: (key: keyof PlugModulesConfig) => void;
  setOperatingMode: (mode: 'hybrid' | 'off_grid') => void;
  updateStressTest: <K extends keyof ExtremeWeatherStressConfig>(
    key: K,
    patch: Partial<ExtremeWeatherStressConfig[K]>
  ) => void;
  applyScenario: (scenarioId: Exclude<ScenarioId, 'custom'>) => void;
  setHorizonHours: (horizon: HorizonHours) => void;
  setCurrency: (currency: CurrencyCode, resetTariffDefaults?: boolean) => void;
  setInputMode: (mode: InputMode) => void;
  resetSandbox: () => void;

  // Solar Irradiation Presets CRUD & Simulation Link
  fetchSolarPresets: () => Promise<void>;
  saveSolarPreset: (preset: SolarIrradiationPreset) => Promise<SolarIrradiationPreset>;
  duplicateSolarPreset: (preset: SolarIrradiationPreset) => Promise<SolarIrradiationPreset>;
  deleteSolarPreset: (id: string) => Promise<void>;
  applySolarPresetToSimulation: (
    preset: SolarIrradiationPreset,
    jumpToSimulations?: boolean
  ) => void;
  clearSolarPreset: () => void;

  // Solar Panel Specs Catalog (configured in Settings)
  selectSolarPanel: (panelId: string, setAsDefault?: boolean) => void;
  upsertSolarPanel: (panel: SolarPanelSpec) => void;
  deleteSolarPanel: (panelId: string) => void;
  resetSolarPanelsToDefaults: () => void;

  // Outage window helpers
  addOutageWindow: (window: Omit<OutageWindow, 'id'>) => void;
  removeOutageWindow: (id: string) => void;

  // Fabricated data helpers
  seedFabricatedFromParametric: () => void;
  updateFabricatedRow: (hour: number, patch: Partial<FabricatedRow>) => void;
  setFabricatedRows: (rows: FabricatedRow[]) => void;

  // Weather integration
  applyWeatherToSimulation: (snapshot: WeatherSnapshot) => void;
  clearAppliedWeatherForecast: () => void;

  // DESCO BD Bill & Appliance Load Estimator actions
  updateDescoConfig: (patch: Partial<DescoBillConfig>) => void;
  syncDescoToSimulation: () => void;
  addAppliance: (item: Omit<ApplianceItem, 'id'>) => void;
  updateAppliance: (id: string, patch: Partial<ApplianceItem>) => void;
  removeAppliance: (id: string) => void;
  resetAppliancesToStarter: () => void;
  clearAppliances: () => void;
  syncAppliancesToSimulation: () => void;

  // Saved simulations CRUD
  fetchSavedSimulations: () => Promise<void>;
  saveSimulation: (params: {
    name: string;
    description: string;
    overwriteId?: string | null;
  }) => Promise<SavedSimulationRecord>;
  loadSavedSimulation: (id: string) => void;
  duplicateSavedSimulation: (id: string) => Promise<void>;
  renameSavedSimulation: (id: string, name: string, description?: string) => Promise<void>;
  deleteSavedSimulation: (id: string) => Promise<void>;
  importSavedSimulations: (records: SavedSimulationRecord[]) => Promise<void>;
  clearAllSavedSimulations: () => Promise<void>;

  // Scenario Manager configuration profiles CRUD
  fetchScenarioProfiles: () => Promise<void>;
  saveScenarioProfile: (params: {
    name: string;
    description?: string;
    overwriteId?: string | null;
  }) => Promise<ScenarioProfile>;
  applyScenarioProfile: (id: string) => void;
  duplicateScenarioProfile: (id: string) => Promise<void>;
  deleteScenarioProfile: (id: string) => Promise<void>;

  // Compare
  setCompareAId: (id: string) => void;
  setCompareBId: (id: string) => void;
  compareWithActive: (savedId: string) => void;
  compareTwoRuns: (idA: string, idB: string) => void;
  loadConfigToSandbox: (cfg: SimulationConfig, label?: string) => void;

  // Admin-protected App Name, User Profile & SMTP Password Reset
  fetchAdminSettings: () => Promise<void>;
  setupAdminPassword: (password: string, recoveryEmail?: string) => Promise<AdminActionResult>;
  loginAdmin: (password: string) => Promise<AdminActionResult>;
  logoutAdmin: () => Promise<void>;
  saveProtectedIdentity: (payload: {
    appName: string;
    userProfile: Omit<UserProfile, 'locationCity'>;
  }) => Promise<AdminActionResult>;
  changeAdminPassword: (currentPassword: string, newPassword: string) => Promise<AdminActionResult>;
  requestPasswordReset: () => Promise<AdminActionResult>;
  confirmPasswordReset: (code: string, newPassword: string) => Promise<AdminActionResult>;

  // Non-sensitive workspace preferences
  updateLocationCity: (city: string) => void;
  setDefaultCurrency: (currency: CurrencyCode) => void;
}

const initialCurrency = readLocalDefaultCurrency();
const initialSolarPanels = readLocalSolarPanels();
const initialDefaultPanelId = readLocalDefaultPanelId(initialSolarPanels);
const initialDefaultPanel =
  initialSolarPanels.find((p) => p.id === initialDefaultPanelId) || BUILTIN_SOLAR_PANELS[0];
const initialConfig: SimulationConfig = {
  ...createDefaultConfig(initialCurrency),
  solarPanelId: initialDefaultPanel.id,
  solarPanelSnapshot: initialDefaultPanel,
};
const initialSaved = readLocalSaved();
const initialCustomSolar = readLocalSolarPresets();
const initialScenarioProfiles = readLocalScenarioProfiles();

export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  activeTab: 'simulations',
  workspaceMode: 'sandbox',
  libraryTab: 'solar',
  activeSidebarTab: 'stressTests',

  config: initialConfig,
  activeSavedId: null,
  activeSavedName: 'Untitled Simulation',
  activeSavedDescription: '',
  hasUnsavedChanges: false,

  selectedHour: 12,
  isPlaying: false,
  playbackSpeed: 1,

  savedSimulations: initialSaved,
  isLoadingSaved: false,
  storageMode: 'sqlite',

  scenarioProfiles: initialScenarioProfiles,
  activeProfileId: null,
  isLoadingScenarioProfiles: false,

  customSolarPresets: initialCustomSolar,
  isLoadingSolarPresets: false,

  solarPanels: initialSolarPanels,
  defaultSolarPanelId: initialDefaultPanelId,

  compareAId: '__active__',
  compareBId: initialSaved[0]?.id ?? '__baseline_summer_peak__',

  isSaveModalOpen: false,
  saveModalMode: 'save',
  isSavedDrawerOpen: false,
  isPdfModalOpen: false,
  pdfExportTarget: null,

  descoConfig: readLocalDesco(),
  appliances: readLocalAppliances(),

  appName: DEFAULT_APP_NAME,
  userProfile: readInitialProfile(),
  adminStatus: {
    loaded: false,
    adminConfigured: false,
    envPasscodeActive: false,
    smtpConfigured: false,
    adminEmailMasked: '',
    authenticated: false,
  },
  adminToken: null,
  defaultCurrency: initialCurrency,
  toast: null,

  setActiveTab: (tab) => set({ activeTab: tab, isPlaying: false }),
  setLibraryTab: (libraryTab) => set({ libraryTab }),
  setWorkspaceMode: (mode) => {
    const state = get();
    if (mode === 'fabricated') {
      const rows = ensureFabricatedRows(state.config);
      set({
        workspaceMode: mode,
        config: { ...state.config, fabricatedRows: rows },
      });
      return;
    }
    set({ workspaceMode: mode });
  },
  setActiveSidebarTab: (panel) => set({ activeSidebarTab: panel }),

  openSaveModal: (mode = 'save') => set({ isSaveModalOpen: true, saveModalMode: mode }),
  closeSaveModal: () => set({ isSaveModalOpen: false }),
  setSavedDrawerOpen: (open) => set({ isSavedDrawerOpen: open }),
  openPdfModal: (target = null) => set({ isPdfModalOpen: true, pdfExportTarget: target }),
  closePdfModal: () => set({ isPdfModalOpen: false, pdfExportTarget: null }),

  showToast: (message, tone = 'success') => {
    const id = Date.now();
    set({ toast: { id, message, tone } });
    setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null });
      }
    }, 3400);
  },
  clearToast: () => set({ toast: null }),

  setSelectedHour: (hour) => {
    const max = get().config.horizonHours - 1;
    const clamped = Math.max(0, Math.min(max, Math.round(hour)));
    set({ selectedHour: clamped });
  },

  stepHour: (delta) => {
    const { selectedHour, config } = get();
    const total = config.horizonHours;
    const next = (selectedHour + delta + total) % total;
    set({ selectedHour: next });
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  updateConfig: (patch, markCustom = true) => {
    set((state) => {
      const nextHorizon = patch.horizonHours ?? state.config.horizonHours;
      const nextConfig: SimulationConfig = normalizeConfig({
        ...state.config,
        ...patch,
        activeScenarioId:
          patch.activeScenarioId ?? (markCustom ? 'custom' : state.config.activeScenarioId),
      });
      return {
        config: nextConfig,
        selectedHour: Math.min(state.selectedHour, nextHorizon - 1),
        hasUnsavedChanges: true,
      };
    });
  },

  togglePlugModule: (key) => {
    set((state) => {
      const nextVal = !state.config.plugModules[key];
      return {
        config: {
          ...state.config,
          activeScenarioId: 'custom',
          plugModules: {
            ...state.config.plugModules,
            [key]: nextVal,
          },
        },
        hasUnsavedChanges: true,
      };
    });
  },

  setOperatingMode: (mode) => {
    const gridEnabled = mode === 'hybrid';
    set((state) => ({
      config: {
        ...state.config,
        activeScenarioId: 'custom',
        plugModules: {
          ...state.config.plugModules,
          gridEnabled,
        },
      },
      hasUnsavedChanges: true,
    }));
    get().showToast(
      gridEnabled
        ? 'Switched to Hybrid (Grid-Tied) operating mode.'
        : 'Switched to Off-Grid (Islanded Battery) operating mode.',
      'info'
    );
  },

  fetchSolarPresets: async () => {
    set({ isLoadingSolarPresets: true });
    try {
      const res = await fetch('/api/solar-presets');
      if (!res.ok) throw new Error('Solar presets API unavailable');
      const data = await res.json();
      const list: SolarIrradiationPreset[] = Array.isArray(data.presets)
        ? data.presets.map((p: SolarIrradiationPreset) =>
            normalizeSolarPreset({ ...p, isBuiltIn: false })
          )
        : [];
      writeLocalSolarPresets(list);
      set({ customSolarPresets: list, isLoadingSolarPresets: false });
    } catch {
      const localList = readLocalSolarPresets();
      set({ customSolarPresets: localList, isLoadingSolarPresets: false });
    }
  },

  saveSolarPreset: async (preset) => {
    const normalized = normalizeSolarPreset({
      ...preset,
      isBuiltIn: false,
      updatedAt: new Date().toISOString(),
    });
    const isUpdate =
      Boolean(normalized.id) &&
      !BUILTIN_SOLAR_PRESETS.some((b) => b.id === normalized.id) &&
      get().customSolarPresets.some((p) => p.id === normalized.id);
    const targetId = isUpdate
      ? normalized.id
      : `solar_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const toPersist: SolarIrradiationPreset = {
      ...normalized,
      id: targetId,
      isBuiltIn: false,
    };

    try {
      const url = isUpdate
        ? `/api/solar-presets/${encodeURIComponent(targetId)}`
        : '/api/solar-presets';
      const res = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: toPersist }),
      });
      if (!res.ok) throw new Error('Solar preset write failed');
      const data = await res.json();
      const saved = normalizeSolarPreset({ ...(data.preset || toPersist), isBuiltIn: false });
      set((state) => {
        const nextList = isUpdate
          ? state.customSolarPresets.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...state.customSolarPresets];
        writeLocalSolarPresets(nextList);
        const shouldRefreshActive = state.config.solarPresetId === saved.id;
        return {
          customSolarPresets: nextList,
          ...(shouldRefreshActive
            ? {
                config: {
                  ...state.config,
                  solarPresetSnapshot: saved,
                },
              }
            : {}),
        };
      });
      get().showToast(
        isUpdate ? `Updated solar preset "${saved.name}"` : `Saved solar preset "${saved.name}"`,
        'success'
      );
      return saved;
    } catch {
      set((state) => {
        const nextList = isUpdate
          ? state.customSolarPresets.map((p) => (p.id === toPersist.id ? toPersist : p))
          : [toPersist, ...state.customSolarPresets];
        writeLocalSolarPresets(nextList);
        const shouldRefreshActive = state.config.solarPresetId === toPersist.id;
        return {
          customSolarPresets: nextList,
          ...(shouldRefreshActive
            ? {
                config: {
                  ...state.config,
                  solarPresetSnapshot: toPersist,
                },
              }
            : {}),
        };
      });
      get().showToast(`Saved solar preset "${toPersist.name}" locally.`, 'info');
      return toPersist;
    }
  },

  duplicateSolarPreset: async (preset) => {
    const copy: SolarIrradiationPreset = {
      ...preset,
      id: '',
      name: `${preset.name} (Copy)`,
      isBuiltIn: false,
    };
    return get().saveSolarPreset(copy);
  },

  deleteSolarPreset: async (id) => {
    const found = get().customSolarPresets.find((p) => p.id === id);
    try {
      await fetch(`/api/solar-presets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      // continue locally
    }
    set((state) => {
      const nextList = state.customSolarPresets.filter((p) => p.id !== id);
      writeLocalSolarPresets(nextList);
      return { customSolarPresets: nextList };
    });
    if (found) {
      get().showToast(`Deleted solar preset "${found.name}"`, 'info');
    }
  },

  applySolarPresetToSimulation: (preset, jumpToSimulations = false) => {
    const clean = normalizeSolarPreset(preset);
    set((state) => ({
      ...(jumpToSimulations ? { activeTab: 'simulations', workspaceMode: 'sandbox' } : {}),
      hasUnsavedChanges: true,
      config: {
        ...state.config,
        inputMode: 'parametric',
        activeScenarioId: 'custom',
        solarPresetId: clean.id,
        solarPresetSnapshot: clean,
        appliedWeatherForecast: null,
        plugModules: {
          ...state.config.plugModules,
          pvEnabled: true,
        },
      },
    }));
    get().showToast(
      `Applied "${clean.name}" (${clean.peakIrradianceWm2} W/m² · ${clean.peakSunHours.toFixed(1)} PSH) to simulation.`,
      'success'
    );
  },

  clearSolarPreset: () => {
    set((state) => ({
      hasUnsavedChanges: true,
      config: {
        ...state.config,
        solarPresetId: null,
        solarPresetSnapshot: null,
        appliedWeatherForecast: null,
      },
    }));
  },

  selectSolarPanel: (panelId, setAsDefault = false) => {
    const state = get();
    const found = state.solarPanels.find((p) => p.id === panelId);
    if (!found) return;
    if (setAsDefault) {
      try {
        localStorage.setItem(LS_DEFAULT_PANEL_KEY, found.id);
      } catch {
        // ignore
      }
    }
    set((prev) => ({
      ...(setAsDefault ? { defaultSolarPanelId: found.id } : {}),
      hasUnsavedChanges: true,
      config: {
        ...prev.config,
        solarPanelId: found.id,
        solarPanelSnapshot: found,
      },
    }));
    get().showToast(
      `Selected solar panel: ${found.name} (${found.wattageWp}Wp · ${found.efficiencyPct}% eff)`,
      'info'
    );
  },

  upsertSolarPanel: (panel) => {
    const clean = normalizeSolarPanel(panel);
    set((state) => {
      const exists = state.solarPanels.some((p) => p.id === clean.id);
      const nextList = exists
        ? state.solarPanels.map((p) => (p.id === clean.id ? clean : p))
        : [...state.solarPanels, clean];
      writeLocalSolarPanels(nextList);
      const isActive = state.config.solarPanelId === clean.id;
      return {
        solarPanels: nextList,
        ...(isActive
          ? {
              config: {
                ...state.config,
                solarPanelSnapshot: clean,
              },
              hasUnsavedChanges: true,
            }
          : {}),
      };
    });
    get().showToast(`Saved solar panel specification "${clean.name}".`, 'success');
  },

  deleteSolarPanel: (panelId) => {
    const state = get();
    if (state.solarPanels.length <= 1) {
      get().showToast('At least one solar panel model must remain configured.', 'error');
      return;
    }
    const target = state.solarPanels.find((p) => p.id === panelId);
    const nextList = state.solarPanels.filter((p) => p.id !== panelId);
    writeLocalSolarPanels(nextList);
    const fallback = nextList[0];
    const nextDefaultId =
      state.defaultSolarPanelId === panelId ? fallback.id : state.defaultSolarPanelId;
    try {
      localStorage.setItem(LS_DEFAULT_PANEL_KEY, nextDefaultId);
    } catch {
      // ignore
    }
    set((prev) => ({
      solarPanels: nextList,
      defaultSolarPanelId: nextDefaultId,
      ...(prev.config.solarPanelId === panelId
        ? {
            config: {
              ...prev.config,
              solarPanelId: fallback.id,
              solarPanelSnapshot: fallback,
            },
            hasUnsavedChanges: true,
          }
        : {}),
    }));
    if (target) {
      get().showToast(`Removed solar panel "${target.name}".`, 'info');
    }
  },

  resetSolarPanelsToDefaults: () => {
    writeLocalSolarPanels(BUILTIN_SOLAR_PANELS);
    const def = BUILTIN_SOLAR_PANELS[0];
    try {
      localStorage.setItem(LS_DEFAULT_PANEL_KEY, def.id);
    } catch {
      // ignore
    }
    set((prev) => ({
      solarPanels: BUILTIN_SOLAR_PANELS,
      defaultSolarPanelId: def.id,
      config: {
        ...prev.config,
        solarPanelId: def.id,
        solarPanelSnapshot: def,
      },
      hasUnsavedChanges: true,
    }));
    get().showToast('Restored default calibrated solar panel catalog.', 'info');
  },

  updateStressTest: (key, patch) => {
    set((state) => ({
      config: {
        ...state.config,
        inputMode: 'parametric',
        activeScenarioId: 'custom',
        stressTests: {
          ...state.config.stressTests,
          [key]: {
            ...state.config.stressTests[key],
            ...patch,
          },
        },
      },
      hasUnsavedChanges: true,
    }));
  },

  applyScenario: (scenarioId) => {
    const def = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
    if (!def) return;
    set((state) => {
      const nextConfig = normalizeConfig(def.apply(state.config));
      const nextSelected = Math.min(state.selectedHour, nextConfig.horizonHours - 1);
      return {
        config: nextConfig,
        activeProfileId: null,
        selectedHour: nextSelected,
        workspaceMode: state.workspaceMode === 'compare' ? 'sandbox' : state.workspaceMode,
        hasUnsavedChanges: true,
      };
    });
    get().showToast(`Applied scenario: ${def.title}`, 'info');
  },

  setHorizonHours: (horizon) => {
    set((state) => {
      const updatedOutages = state.config.outageWindows
        .map((w) => ({
          ...w,
          startHour: Math.min(w.startHour, horizon - 1),
          endHour: Math.min(w.endHour, horizon),
        }))
        .filter((w) => w.endHour > w.startHour);

      const nextBase: SimulationConfig = {
        ...state.config,
        horizonHours: horizon,
        outageWindows: updatedOutages,
      };
      const nextRows =
        nextBase.inputMode === 'fabricated' || nextBase.fabricatedRows.length > 0
          ? ensureFabricatedRows(nextBase)
          : [];

      return {
        config: { ...nextBase, fabricatedRows: nextRows },
        selectedHour: Math.min(state.selectedHour, horizon - 1),
        hasUnsavedChanges: true,
      };
    });
  },

  setCurrency: (currency, resetTariffDefaults = true) => {
    const meta = CURRENCIES[currency];
    set((state) => {
      const nextConfig: SimulationConfig = {
        ...state.config,
        currency,
        ...(resetTariffDefaults
          ? {
              offPeakRate: meta.defaultOffPeakRate,
              peakRate: meta.defaultPeakRate,
              exportCreditRate: meta.defaultExportCreditRate,
            }
          : {}),
      };
      return {
        config: nextConfig,
        hasUnsavedChanges: true,
      };
    });
  },

  setInputMode: (mode) => {
    set((state) => {
      const rows =
        mode === 'fabricated'
          ? ensureFabricatedRows(state.config)
          : state.config.fabricatedRows;
      return {
        config: {
          ...state.config,
          inputMode: mode,
          fabricatedRows: rows,
        },
        hasUnsavedChanges: true,
      };
    });
  },

  resetSandbox: () => {
    const state = get();
    const defCurrency = state.defaultCurrency;
    const defPanel =
      state.solarPanels.find((p) => p.id === state.defaultSolarPanelId) ||
      state.solarPanels[0] ||
      BUILTIN_SOLAR_PANELS[0];
    set({
      config: {
        ...createDefaultConfig(defCurrency),
        solarPanelId: defPanel.id,
        solarPanelSnapshot: defPanel,
      },
      activeSavedId: null,
      activeSavedName: 'Untitled Simulation',
      activeSavedDescription: '',
      hasUnsavedChanges: false,
      selectedHour: 12,
      isPlaying: false,
      workspaceMode: 'sandbox',
    });
    get().showToast('Reset sandbox to default residential hybrid model.', 'info');
  },

  addOutageWindow: (window) => {
    set((state) => {
      const id = `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        config: {
          ...state.config,
          activeScenarioId: 'custom',
          outageWindows: [...state.config.outageWindows, { ...window, id }],
        },
        hasUnsavedChanges: true,
      };
    });
  },

  removeOutageWindow: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        activeScenarioId: 'custom',
        outageWindows: state.config.outageWindows.filter((w) => w.id !== id),
      },
      hasUnsavedChanges: true,
    }));
  },

  seedFabricatedFromParametric: () => {
    set((state) => {
      const rows = buildFabricatedRowsFromParametric(state.config);
      return {
        config: {
          ...state.config,
          inputMode: 'fabricated',
          fabricatedRows: rows,
        },
        hasUnsavedChanges: true,
      };
    });
    get().showToast('Seeded hourly table from current parametric model.', 'info');
  },

  updateFabricatedRow: (hour, patch) => {
    set((state) => {
      const rows = ensureFabricatedRows(state.config).map((row) =>
        row.hour === hour ? { ...row, ...patch } : row
      );
      return {
        config: {
          ...state.config,
          inputMode: 'fabricated',
          activeScenarioId: 'custom',
          fabricatedRows: rows,
        },
        hasUnsavedChanges: true,
      };
    });
  },

  setFabricatedRows: (rows) => {
    set((state) => ({
      config: {
        ...state.config,
        inputMode: 'fabricated',
        activeScenarioId: 'custom',
        fabricatedRows: rows,
      },
      hasUnsavedChanges: true,
    }));
  },

  applyWeatherToSimulation: (snapshot) => {
    set((state) => {
      const horizon = state.config.horizonHours;
      const forecast = snapshot.forecast;
      const slicedForecast = {
        ...forecast,
        hourlyIrradianceWm2: forecast.hourlyIrradianceWm2.slice(0, horizon),
        hourlyTempC: forecast.hourlyTempC.slice(0, horizon),
        hourlyCloudPct: forecast.hourlyCloudPct.slice(0, horizon),
      };

      const peakTemp = Math.max(...slicedForecast.hourlyTempC, snapshot.temperatureC);
      const avgCloud =
        slicedForecast.hourlyCloudPct.length > 0
          ? slicedForecast.hourlyCloudPct.reduce((a, b) => a + b, 0) /
            slicedForecast.hourlyCloudPct.length
          : snapshot.cloudCoverPct;

      let weatherProfile = state.config.weatherProfile;
      let cloudDropSeverityPct = state.config.cloudDropSeverityPct;
      if (avgCloud >= 70) {
        weatherProfile = 'monsoon_drop';
        cloudDropSeverityPct = Math.min(90, Math.max(55, Math.round(avgCloud)));
      } else if (avgCloud >= 30) {
        weatherProfile = 'partly_cloudy';
      } else {
        weatherProfile = 'clear';
      }

      const nextBaseConfig: SimulationConfig = {
        ...state.config,
        weatherProfile,
        cloudDropSeverityPct,
        appliedWeatherForecast: slicedForecast,
        activeScenarioId: 'custom',
        plugModules: {
          ...state.config.plugModules,
          pvEnabled: true,
        },
        stressTests: {
          ...state.config.stressTests,
          heatwaveSpike: {
            ...state.config.stressTests.heatwaveSpike,
            peakTempC:
              peakTemp >= 38
                ? Math.round(peakTemp)
                : state.config.stressTests.heatwaveSpike.peakTempC,
          },
        },
      };

      // If user is working in Fabricated Hourly Dataset mode (or has rows), sync the 24h/72h coordinate irradiance & temp directly into rows
      const updatedFabricatedRows =
        state.config.inputMode === 'fabricated' || state.config.fabricatedRows.length > 0
          ? ensureFabricatedRows(nextBaseConfig).map((row, idx) => ({
              ...row,
              irradianceWm2: Math.round(
                slicedForecast.hourlyIrradianceWm2[
                  Math.min(idx, slicedForecast.hourlyIrradianceWm2.length - 1)
                ] ?? row.irradianceWm2
              ),
              ambientTempC:
                slicedForecast.hourlyTempC[
                  Math.min(idx, slicedForecast.hourlyTempC.length - 1)
                ] ?? row.ambientTempC,
            }))
          : [];

      return {
        config: {
          ...nextBaseConfig,
          fabricatedRows: updatedFabricatedRows,
        },
        hasUnsavedChanges: true,
      };
    });

    const horizon = get().config.horizonHours;
    get().showToast(
      `Applied ${horizon}h sky forecast for ${snapshot.city} (${snapshot.lat.toFixed(2)}°, ${snapshot.lon.toFixed(2)}°) to simulation.`,
      'success'
    );
  },

  clearAppliedWeatherForecast: () => {
    set((state) => ({
      config: {
        ...state.config,
        appliedWeatherForecast: null,
      },
      hasUnsavedChanges: true,
    }));
    get().showToast('Cleared coordinate weather override; reverted to Solar Preset.', 'info');
  },

  // DESCO Bill & Appliance Load Estimator
  updateDescoConfig: (patch) => {
    set((state) => {
      const next = { ...state.descoConfig, ...patch };
      try {
        localStorage.setItem(LS_DESCO_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return { descoConfig: next };
    });
  },

  syncDescoToSimulation: () => {
    const state = get();
    const calc = solveDescoBill(state.descoConfig);
    const avgKw = Math.max(0.2, calc.averageLoadKw);
    const isCommercial = state.descoConfig.tariffCategory !== 'LT-A';
    const isTou = state.descoConfig.tariffCategory === 'LT-E-TOU';
    const blended = Math.max(4.63, calc.effectiveBlendedRateBdt || 9.5);

    set((prev) => ({
      activeTab: 'simulations',
      workspaceMode: 'sandbox',
      activeSidebarTab: 'load',
      hasUnsavedChanges: true,
      config: {
        ...prev.config,
        inputMode: 'parametric',
        activeScenarioId: 'custom',
        currency: 'BDT',
        householdAvgKw: avgKw,
        loadPeakFactor: Math.max(1.1, Math.min(2.8, state.descoConfig.peakFactor)),
        loadArchetype: isCommercial ? 'commercial_daytime' : 'residential_evening',
        permittedGridPeakKw: Math.max(1.0, state.descoConfig.sanctionedLoadKw),
        touEnabled: isTou,
        offPeakRate: isTou ? DESCO_LTE_OFFPEAK_RATE : Number(blended.toFixed(2)),
        peakRate: isTou ? DESCO_LTE_PEAK_RATE : Number((blended * 1.15).toFixed(2)),
      },
    }));
    get().showToast(
      `Synced DESCO ${state.descoConfig.tariffCategory} load (${avgKw.toFixed(2)} kW avg, ${state.descoConfig.sanctionedLoadKw.toFixed(1)} kW cap) to Simulations.`,
      'success'
    );
  },

  addAppliance: (item) => {
    set((state) => {
      const id = `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const next = [...state.appliances, { ...item, id }];
      try {
        localStorage.setItem(LS_APPLIANCES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return { appliances: next };
    });
  },

  updateAppliance: (id, patch) => {
    set((state) => {
      const next = state.appliances.map((a) => (a.id === id ? { ...a, ...patch } : a));
      try {
        localStorage.setItem(LS_APPLIANCES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return { appliances: next };
    });
  },

  removeAppliance: (id) => {
    set((state) => {
      const next = state.appliances.filter((a) => a.id !== id);
      try {
        localStorage.setItem(LS_APPLIANCES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return { appliances: next };
    });
  },

  resetAppliancesToStarter: () => {
    const starter = createStarterAppliances();
    try {
      localStorage.setItem(LS_APPLIANCES_KEY, JSON.stringify(starter));
    } catch {
      // ignore
    }
    set({ appliances: starter });
    get().showToast('Loaded typical Dhaka household appliance kit.', 'info');
  },

  clearAppliances: () => {
    try {
      localStorage.setItem(LS_APPLIANCES_KEY, JSON.stringify([]));
    } catch {
      // ignore
    }
    set({ appliances: [] });
  },

  syncAppliancesToSimulation: () => {
    const state = get();
    const summary = computeApplianceSummary(
      state.appliances,
      state.config.permittedGridPeakKw
    );
    const avgKw = Math.max(0.2, summary.averageLoadKw);
    const suggestedCap = Math.max(
      state.config.permittedGridPeakKw,
      Math.ceil(summary.simultaneousPeakKw * 2) / 2
    );

    set((prev) => ({
      activeTab: 'simulations',
      workspaceMode: 'sandbox',
      activeSidebarTab: 'load',
      hasUnsavedChanges: true,
      config: {
        ...prev.config,
        inputMode: 'parametric',
        activeScenarioId: 'custom',
        householdAvgKw: avgKw,
        loadPeakFactor: summary.derivedPeakFactor,
        permittedGridPeakKw: suggestedCap,
      },
    }));
    get().showToast(
      `Synced Appliance Load (${avgKw.toFixed(2)} kW avg, ${summary.simultaneousPeakKw.toFixed(2)} kW peak) to Simulations.`,
      'success'
    );
  },

  fetchSavedSimulations: async () => {
    set({ isLoadingSaved: true });
    try {
      const res = await fetch('/api/simulations');
      if (!res.ok) throw new Error('API unavailable');
      const data = await res.json();
      const serverItems: SavedSimulationRecord[] = Array.isArray(data.simulations)
        ? data.simulations.map((item: SavedSimulationRecord) => ({
            ...item,
            config: normalizeConfig(item.config || {}),
          }))
        : [];
      writeLocalSaved(serverItems);
      set((state) => ({
        savedSimulations: serverItems,
        isLoadingSaved: false,
        storageMode: 'sqlite',
        compareBId:
          state.compareBId === '__baseline_summer_peak__' && serverItems.length > 0
            ? serverItems[0].id
            : state.compareBId,
      }));
    } catch {
      const localItems = readLocalSaved();
      set({
        savedSimulations: localItems,
        isLoadingSaved: false,
        storageMode: 'local',
      });
    }
  },

  saveSimulation: async ({ name, description, overwriteId }) => {
    const state = get();
    const trimmedName = name.trim() || 'Untitled Simulation';
    const trimmedDesc = description.trim();
    const solved = solveSimulation(state.config);
    const now = new Date().toISOString();

    const payload = {
      name: trimmedName,
      description: trimmedDesc,
      config: state.config,
      summary: solved.summary,
    };

    try {
      const url = overwriteId
        ? `/api/simulations/${encodeURIComponent(overwriteId)}`
        : '/api/simulations';
      const method = overwriteId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('API write failed');
      const data = await res.json();
      const saved: SavedSimulationRecord = {
        ...data.simulation,
        config: normalizeConfig(data.simulation.config || {}),
      };

      set((prev) => {
        const nextList = overwriteId
          ? prev.savedSimulations.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...prev.savedSimulations];
        writeLocalSaved(nextList);
        return {
          savedSimulations: nextList,
          activeSavedId: saved.id,
          activeSavedName: saved.name,
          activeSavedDescription: saved.description,
          hasUnsavedChanges: false,
          isSaveModalOpen: false,
          storageMode: 'sqlite',
          compareBId:
            prev.compareBId === '__baseline_summer_peak__' ? saved.id : prev.compareBId,
        };
      });
      get().showToast(
        overwriteId ? `Updated "${saved.name}"` : `Saved simulation "${saved.name}"`,
        'success'
      );
      return saved;
    } catch {
      const localRecord: SavedSimulationRecord = {
        id: overwriteId || `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: trimmedName,
        description: trimmedDesc,
        horizonHours: state.config.horizonHours,
        inputMode: state.config.inputMode,
        currency: state.config.currency,
        config: state.config,
        summary: solved.summary,
        createdAt: now,
        updatedAt: now,
      };
      set((prev) => {
        const nextList = overwriteId
          ? prev.savedSimulations.map((item) =>
              item.id === localRecord.id
                ? { ...localRecord, createdAt: item.createdAt }
                : item
            )
          : [localRecord, ...prev.savedSimulations];
        writeLocalSaved(nextList);
        return {
          savedSimulations: nextList,
          activeSavedId: localRecord.id,
          activeSavedName: localRecord.name,
          activeSavedDescription: localRecord.description,
          hasUnsavedChanges: false,
          isSaveModalOpen: false,
          storageMode: 'local',
        };
      });
      get().showToast(`Saved "${localRecord.name}" to local storage.`, 'info');
      return localRecord;
    }
  },

  loadSavedSimulation: (id) => {
    const found = get().savedSimulations.find((item) => item.id === id);
    if (!found) return;
    const normalized = normalizeConfig(JSON.parse(JSON.stringify(found.config)));
    set({
      config: normalized,
      activeSavedId: found.id,
      activeSavedName: found.name,
      activeSavedDescription: found.description,
      hasUnsavedChanges: false,
      selectedHour: Math.min(12, normalized.horizonHours - 1),
      isPlaying: false,
      activeTab: 'simulations',
      workspaceMode: normalized.inputMode === 'fabricated' ? 'fabricated' : 'sandbox',
      isSavedDrawerOpen: false,
    });
    get().showToast(`Loaded "${found.name}"`, 'info');
  },

  duplicateSavedSimulation: async (id) => {
    const found = get().savedSimulations.find((item) => item.id === id);
    if (!found) return;
    const copyName = `${found.name} (Copy)`;
    const payload = {
      name: copyName,
      description: found.description,
      config: found.config,
      summary: found.summary,
    };

    try {
      const res = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('API duplicate failed');
      const data = await res.json();
      const saved: SavedSimulationRecord = {
        ...data.simulation,
        config: normalizeConfig(data.simulation.config || {}),
      };
      set((prev) => {
        const nextList = [saved, ...prev.savedSimulations];
        writeLocalSaved(nextList);
        return { savedSimulations: nextList, storageMode: 'sqlite' };
      });
      get().showToast(`Duplicated as "${saved.name}"`, 'success');
    } catch {
      const now = new Date().toISOString();
      const localCopy: SavedSimulationRecord = {
        ...found,
        id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: copyName,
        createdAt: now,
        updatedAt: now,
      };
      set((prev) => {
        const nextList = [localCopy, ...prev.savedSimulations];
        writeLocalSaved(nextList);
        return { savedSimulations: nextList, storageMode: 'local' };
      });
      get().showToast(`Duplicated as "${localCopy.name}"`, 'info');
    }
  },

  renameSavedSimulation: async (id, name, description) => {
    const found = get().savedSimulations.find((item) => item.id === id);
    if (!found || !name.trim()) return;
    const nextName = name.trim();
    const nextDesc = description !== undefined ? description.trim() : found.description;

    try {
      const res = await fetch(`/api/simulations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nextName,
          description: nextDesc,
          config: found.config,
          summary: found.summary,
        }),
      });
      if (!res.ok) throw new Error('Rename failed');
      const data = await res.json();
      const updated: SavedSimulationRecord = {
        ...data.simulation,
        config: normalizeConfig(data.simulation.config || {}),
      };
      set((prev) => {
        const nextList = prev.savedSimulations.map((item) =>
          item.id === id ? updated : item
        );
        writeLocalSaved(nextList);
        return {
          savedSimulations: nextList,
          activeSavedName: prev.activeSavedId === id ? updated.name : prev.activeSavedName,
          activeSavedDescription:
            prev.activeSavedId === id ? updated.description : prev.activeSavedDescription,
        };
      });
      get().showToast(`Renamed to "${updated.name}"`, 'success');
    } catch {
      const now = new Date().toISOString();
      set((prev) => {
        const nextList = prev.savedSimulations.map((item) =>
          item.id === id
            ? { ...item, name: nextName, description: nextDesc, updatedAt: now }
            : item
        );
        writeLocalSaved(nextList);
        return {
          savedSimulations: nextList,
          activeSavedName: prev.activeSavedId === id ? nextName : prev.activeSavedName,
        };
      });
      get().showToast(`Renamed to "${nextName}"`, 'info');
    }
  },

  deleteSavedSimulation: async (id) => {
    const found = get().savedSimulations.find((item) => item.id === id);
    try {
      await fetch(`/api/simulations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      // Continue with local deletion
    }
    set((prev) => {
      const nextList = prev.savedSimulations.filter((item) => item.id !== id);
      writeLocalSaved(nextList);
      return {
        savedSimulations: nextList,
        activeSavedId: prev.activeSavedId === id ? null : prev.activeSavedId,
        activeSavedName:
          prev.activeSavedId === id ? 'Untitled Simulation' : prev.activeSavedName,
        compareAId: prev.compareAId === id ? '__active__' : prev.compareAId,
        compareBId:
          prev.compareBId === id
            ? nextList[0]?.id ?? '__baseline_summer_peak__'
            : prev.compareBId,
      };
    });
    if (found) {
      get().showToast(`Deleted "${found.name}"`, 'info');
    }
  },

  importSavedSimulations: async (records) => {
    const normalized = records.map((r) => ({
      ...r,
      config: normalizeConfig(r.config || {}),
    }));
    try {
      const res = await fetch('/api/simulations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulations: normalized }),
      });
      if (!res.ok) throw new Error('Import failed');
      const data = await res.json();
      const serverItems: SavedSimulationRecord[] = Array.isArray(data.simulations)
        ? data.simulations.map((item: SavedSimulationRecord) => ({
            ...item,
            config: normalizeConfig(item.config || {}),
          }))
        : [];
      writeLocalSaved(serverItems);
      set({ savedSimulations: serverItems, storageMode: 'sqlite' });
      get().showToast(`Imported ${records.length} simulation(s).`, 'success');
    } catch {
      set((prev) => {
        const map = new Map(prev.savedSimulations.map((s) => [s.id, s]));
        for (const r of normalized) {
          map.set(r.id, r);
        }
        const merged = Array.from(map.values());
        writeLocalSaved(merged);
        return { savedSimulations: merged, storageMode: 'local' };
      });
      get().showToast(`Imported ${records.length} simulation(s) locally.`, 'info');
    }
  },

  clearAllSavedSimulations: async () => {
    try {
      await fetch('/api/simulations', { method: 'DELETE' });
    } catch {
      // Fallback local clear
    }
    writeLocalSaved([]);
    set({
      savedSimulations: [],
      activeSavedId: null,
      activeSavedName: 'Untitled Simulation',
      compareAId: '__active__',
      compareBId: '__baseline_summer_peak__',
    });
    get().showToast('Cleared all saved simulations.', 'info');
  },

  fetchScenarioProfiles: async () => {
    set({ isLoadingScenarioProfiles: true });
    try {
      const res = await fetch('/api/scenario-profiles');
      if (!res.ok) throw new Error('Scenario profiles API unavailable');
      const data = await res.json();
      const list: ScenarioProfile[] = Array.isArray(data.profiles)
        ? data.profiles.map((item: ScenarioProfile) => ({
            ...item,
            config: normalizeConfig(item.config || {}),
          }))
        : [];
      writeLocalScenarioProfiles(list);
      set({ scenarioProfiles: list, isLoadingScenarioProfiles: false });
    } catch {
      const localList = readLocalScenarioProfiles();
      set({ scenarioProfiles: localList, isLoadingScenarioProfiles: false });
    }
  },

  saveScenarioProfile: async ({ name, description = '', overwriteId }) => {
    const state = get();
    const cleanName = name.trim() || 'Custom Profile';
    const cleanDesc = description.trim();
    const snapshotConfig = normalizeConfig(JSON.parse(JSON.stringify(state.config)));
    const now = new Date().toISOString();

    try {
      const url = overwriteId
        ? `/api/scenario-profiles/${encodeURIComponent(overwriteId)}`
        : '/api/scenario-profiles';
      const method = overwriteId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          description: cleanDesc,
          config: snapshotConfig,
        }),
      });
      if (!res.ok) throw new Error('Profile save failed');
      const data = await res.json();
      const saved: ScenarioProfile = {
        ...data.profile,
        config: normalizeConfig(data.profile.config || snapshotConfig),
      };
      set((prev) => {
        const nextList = overwriteId
          ? prev.scenarioProfiles.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev.scenarioProfiles];
        writeLocalScenarioProfiles(nextList);
        return {
          scenarioProfiles: nextList,
          activeProfileId: saved.id,
        };
      });
      get().showToast(
        overwriteId
          ? `Updated profile "${saved.name}"`
          : `Saved configuration profile "${saved.name}"`,
        'success'
      );
      return saved;
    } catch {
      const fallback: ScenarioProfile = {
        id: overwriteId || `prof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        description: cleanDesc,
        config: snapshotConfig,
        createdAt: now,
        updatedAt: now,
      };
      set((prev) => {
        const nextList = overwriteId
          ? prev.scenarioProfiles.map((p) =>
              p.id === fallback.id ? { ...fallback, createdAt: p.createdAt } : p
            )
          : [fallback, ...prev.scenarioProfiles];
        writeLocalScenarioProfiles(nextList);
        return {
          scenarioProfiles: nextList,
          activeProfileId: fallback.id,
        };
      });
      get().showToast(`Saved profile "${fallback.name}" locally.`, 'info');
      return fallback;
    }
  },

  applyScenarioProfile: (id) => {
    const found = get().scenarioProfiles.find((p) => p.id === id);
    if (!found) return;
    const normalized = normalizeConfig(JSON.parse(JSON.stringify(found.config)));
    set((state) => ({
      config: normalized,
      activeProfileId: found.id,
      selectedHour: Math.min(state.selectedHour, normalized.horizonHours - 1),
      activeTab: 'simulations',
      workspaceMode: normalized.inputMode === 'fabricated' ? 'fabricated' : 'sandbox',
      hasUnsavedChanges: true,
    }));
    get().showToast(`Loaded configuration profile "${found.name}".`, 'info');
  },

  duplicateScenarioProfile: async (id) => {
    const found = get().scenarioProfiles.find((p) => p.id === id);
    if (!found) return;
    const prevConfig = get().config;
    set({ config: normalizeConfig(JSON.parse(JSON.stringify(found.config))) });
    await get().saveScenarioProfile({
      name: `${found.name} (Copy)`,
      description: found.description,
    });
    set({ config: prevConfig });
  },

  deleteScenarioProfile: async (id) => {
    const found = get().scenarioProfiles.find((p) => p.id === id);
    try {
      await fetch(`/api/scenario-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      // continue locally
    }
    set((prev) => {
      const nextList = prev.scenarioProfiles.filter((p) => p.id !== id);
      writeLocalScenarioProfiles(nextList);
      const profileCompareKey = `profile:${id}`;
      return {
        scenarioProfiles: nextList,
        activeProfileId: prev.activeProfileId === id ? null : prev.activeProfileId,
        compareAId: prev.compareAId === profileCompareKey ? '__active__' : prev.compareAId,
        compareBId:
          prev.compareBId === profileCompareKey ? '__baseline_summer_peak__' : prev.compareBId,
      };
    });
    if (found) {
      get().showToast(`Deleted profile "${found.name}".`, 'info');
    }
  },

  setCompareAId: (id) => set({ compareAId: id }),
  setCompareBId: (id) => set({ compareBId: id }),
  compareWithActive: (savedId) => {
    set({
      activeTab: 'library',
      libraryTab: 'compare',
      compareAId: '__active__',
      compareBId: savedId,
      isSavedDrawerOpen: false,
    });
  },
  compareTwoRuns: (idA, idB) => {
    set({
      activeTab: 'library',
      libraryTab: 'compare',
      compareAId: idA,
      compareBId: idB,
      isSavedDrawerOpen: false,
    });
  },
  loadConfigToSandbox: (cfg, label) => {
    const normalized = normalizeConfig(JSON.parse(JSON.stringify(cfg)));
    set({
      config: normalized,
      selectedHour: Math.min(12, normalized.horizonHours - 1),
      isPlaying: false,
      activeTab: 'simulations',
      workspaceMode: normalized.inputMode === 'fabricated' ? 'fabricated' : 'sandbox',
      hasUnsavedChanges: true,
    });
    if (label) {
      get().showToast(`Loaded "${label}" into Simulations sandbox.`, 'info');
    }
  },

  fetchAdminSettings: async () => {
    try {
      const token = get().adminToken;
      const res = await fetch('/api/admin/settings', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Failed to load workspace identity');
      const data = await res.json();
      const localCity = readLocalLocationCity();
      const serverProfile: UserProfile = {
        ...DEFAULT_PROFILE,
        ...(data.userProfile || {}),
        locationCity: localCity || data.userProfile?.locationCity || DEFAULT_PROFILE.locationCity,
      };
      const authenticated = Boolean(data.status?.authenticated);
      set({
        appName:
          typeof data.appName === 'string' && data.appName.trim()
            ? data.appName.trim()
            : DEFAULT_APP_NAME,
        userProfile: serverProfile,
        adminToken: authenticated ? token : null,
        adminStatus: {
          loaded: true,
          adminConfigured: Boolean(data.status?.adminConfigured),
          envPasscodeActive: Boolean(data.status?.envPasscodeActive),
          smtpConfigured: Boolean(data.status?.smtpConfigured),
          adminEmailMasked:
            typeof data.status?.adminEmailMasked === 'string'
              ? data.status.adminEmailMasked
              : '',
          authenticated,
        },
      });
    } catch {
      set((state) => ({
        adminStatus: {
          ...state.adminStatus,
          loaded: true,
          authenticated: false,
        },
      }));
    }
  },

  setupAdminPassword: async (password, recoveryEmail) => {
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, recoveryEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to set admin password.' };
      }
      const localCity = get().userProfile.locationCity;
      set((state) => ({
        adminToken: typeof data.token === 'string' ? data.token : null,
        appName:
          typeof data.appName === 'string' && data.appName.trim()
            ? data.appName.trim()
            : state.appName,
        userProfile: data.userProfile
          ? { ...state.userProfile, ...data.userProfile, locationCity: localCity }
          : state.userProfile,
        adminStatus: {
          loaded: true,
          adminConfigured: true,
          envPasscodeActive: Boolean(data.status?.envPasscodeActive),
          smtpConfigured: Boolean(data.status?.smtpConfigured),
          adminEmailMasked:
            typeof data.status?.adminEmailMasked === 'string'
              ? data.status.adminEmailMasked
              : state.adminStatus.adminEmailMasked,
          authenticated: Boolean(data.token),
        },
      }));
      get().showToast('Admin password configured. Protected settings unlocked.', 'success');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach server to configure admin password.' };
    }
  },

  loginAdmin: async (password) => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || 'Incorrect admin password.' };
      }
      set((state) => ({
        adminToken: typeof data.token === 'string' ? data.token : null,
        adminStatus: {
          ...state.adminStatus,
          loaded: true,
          adminConfigured: true,
          envPasscodeActive: Boolean(data.status?.envPasscodeActive),
          smtpConfigured: Boolean(data.status?.smtpConfigured),
          adminEmailMasked:
            typeof data.status?.adminEmailMasked === 'string'
              ? data.status.adminEmailMasked
              : state.adminStatus.adminEmailMasked,
          authenticated: Boolean(data.token),
        },
      }));
      get().showToast('Admin session unlocked.', 'success');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach server to verify admin password.' };
    }
  },

  logoutAdmin: async () => {
    const token = get().adminToken;
    set((state) => ({
      adminToken: null,
      adminStatus: { ...state.adminStatus, authenticated: false },
    }));
    if (token) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Session already cleared in memory
      }
    }
    get().showToast('Admin session locked.', 'info');
  },

  saveProtectedIdentity: async ({ appName, userProfile }) => {
    const token = get().adminToken;
    if (!token) {
      return { ok: false, error: 'Unlock admin access with your password first.' };
    }
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          appName,
          userProfile: {
            ...userProfile,
            locationCity: get().userProfile.locationCity,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        set((state) => ({
          adminToken: null,
          adminStatus: { ...state.adminStatus, authenticated: false },
        }));
        return { ok: false, error: 'Admin session expired. Please unlock again.' };
      }
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to save protected settings.' };
      }
      const localCity = get().userProfile.locationCity;
      set((state) => ({
        appName: typeof data.appName === 'string' ? data.appName : state.appName,
        userProfile: data.userProfile
          ? { ...state.userProfile, ...data.userProfile, locationCity: localCity }
          : state.userProfile,
        adminStatus: {
          ...state.adminStatus,
          adminEmailMasked:
            typeof data.status?.adminEmailMasked === 'string'
              ? data.status.adminEmailMasked
              : state.adminStatus.adminEmailMasked,
        },
      }));
      get().showToast('Saved App Name and engineer profile.', 'success');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach server to save settings.' };
    }
  },

  changeAdminPassword: async (currentPassword, newPassword) => {
    const token = get().adminToken;
    if (!token) {
      return { ok: false, error: 'Unlock admin access first.' };
    }
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data.error === 'Admin authentication required.') {
        set((state) => ({
          adminToken: null,
          adminStatus: { ...state.adminStatus, authenticated: false },
        }));
      }
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to update admin password.' };
      }
      if (typeof data.token === 'string') {
        set({ adminToken: data.token });
      }
      get().showToast('Admin password updated.', 'success');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach server to update password.' };
    }
  },

  requestPasswordReset: async () => {
    try {
      const res = await fetch('/api/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to send reset email.' };
      }
      get().showToast(
        `Password reset code sent to ${data.maskedEmail || 'recovery email'}.`,
        'success'
      );
      return {
        ok: true,
        maskedEmail: data.maskedEmail,
        expiresInMinutes: data.expiresInMinutes ?? 15,
      };
    } catch {
      return { ok: false, error: 'Unable to reach server to send reset email.' };
    }
  },

  confirmPasswordReset: async (code, newPassword) => {
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || 'Password reset failed.' };
      }
      set((state) => ({
        adminToken: null,
        adminStatus: {
          ...state.adminStatus,
          adminConfigured: true,
          authenticated: false,
        },
      }));
      get().showToast('Admin password reset. Sign in with your new password.', 'success');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach server to reset password.' };
    }
  },

  updateLocationCity: (city) => {
    const clean = city.trim();
    if (!clean) return;
    try {
      localStorage.setItem(LS_LOCATION_CITY_KEY, clean);
    } catch {
      // ignore
    }
    set((state) => ({
      userProfile: {
        ...state.userProfile,
        locationCity: clean,
      },
    }));
  },

  setDefaultCurrency: (currency) => {
    try {
      localStorage.setItem(LS_CURRENCY_KEY, currency);
    } catch {
      // ignore
    }
    set({ defaultCurrency: currency });
  },
}));
