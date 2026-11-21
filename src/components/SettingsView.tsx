import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Database,
  Download,
  KeyRound,
  Lock,
  Mail,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import type {
  CurrencyCode,
  SavedSimulationRecord,
  SolarPanelSpec,
  SolarPanelTechnology,
} from '../types/simulation';
import { CURRENCIES, CURRENCY_LIST, formatRate } from '../engine/currencies';
import { useSimulationStore } from '../store/useSimulationStore';

const PANEL_TECHNOLOGIES: SolarPanelTechnology[] = [
  'N-Type TOPCon',
  'Mono PERC',
  'Bifacial HJT',
  'Polycrystalline',
  'Custom',
];

export const SettingsView: React.FC = () => {
  const {
    config,
    appName,
    userProfile,
    adminStatus,
    fetchAdminSettings,
    setupAdminPassword,
    loginAdmin,
    logoutAdmin,
    saveProtectedIdentity,
    changeAdminPassword,
    requestPasswordReset,
    confirmPasswordReset,
    defaultCurrency,
    setDefaultCurrency,
    setCurrency,
    solarPanels,
    defaultSolarPanelId,
    selectSolarPanel,
    upsertSolarPanel,
    deleteSolarPanel,
    resetSolarPanelsToDefaults,
    savedSimulations,
    storageMode,
    importSavedSimulations,
    clearAllSavedSimulations,
    showToast,
  } = useSimulationStore();

  // Protected App Name & Engineer Profile draft state
  const [appNameDraft, setAppNameDraft] = useState(appName);
  const [name, setName] = useState(userProfile.name);
  const [role, setRole] = useState(userProfile.role);
  const [organization, setOrganization] = useState(userProfile.organization);
  const [email, setEmail] = useState(userProfile.email);

  // Admin setup / unlock / password reset UI state
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupEmail, setSetupEmail] = useState(userProfile.email);

  const [unlockPassword, setUnlockPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  const [showForgotFlow, setShowForgotFlow] = useState(false);
  const [resetCodeSentTo, setResetCodeSentTo] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmNewAdminPassword, setConfirmNewAdminPassword] = useState('');

  const [confirmClear, setConfirmClear] = useState(false);
  const [importError, setImportError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAdminSettings();
  }, [fetchAdminSettings]);

  useEffect(() => {
    setAppNameDraft(appName);
    setName(userProfile.name);
    setRole(userProfile.role);
    setOrganization(userProfile.organization);
    setEmail(userProfile.email);
    setSetupEmail(userProfile.email);
  }, [appName, userProfile.name, userProfile.role, userProfile.organization, userProfile.email]);

  // Solar panel editor state
  const [editingPanelId, setEditingPanelId] = useState<string>(config.solarPanelId);
  const selectedForEdit =
    solarPanels.find((p) => p.id === editingPanelId) || solarPanels[0];
  const [panelDraft, setPanelDraft] = useState<SolarPanelSpec>(() => ({
    ...selectedForEdit,
  }));

  const loadPanelIntoEditor = (panel: SolarPanelSpec) => {
    setEditingPanelId(panel.id);
    setPanelDraft({ ...panel });
  };

  const handleStartNewPanel = () => {
    const newDraft: SolarPanelSpec = {
      id: `panel_custom_${Date.now()}`,
      name: 'Custom 540W Mono Module',
      manufacturer: 'Custom OEM',
      technology: 'Custom',
      wattageWp: 540,
      efficiencyPct: 21.0,
      areaM2: 2.57,
      tempCoeffPctPerC: -0.34,
      noctC: 45,
      systemLossPct: 13,
      isBuiltIn: false,
    };
    setEditingPanelId(newDraft.id);
    setPanelDraft(newDraft);
  };

  const handleSavePanelDraft = (e: React.FormEvent) => {
    e.preventDefault();
    upsertSolarPanel(panelDraft);
    setEditingPanelId(panelDraft.id);
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    if (setupPassword.length < 8) {
      setAuthError('Admin password must be at least 8 characters.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setAuthError('Passwords do not match.');
      return;
    }
    setIsAuthBusy(true);
    const result = await setupAdminPassword(setupPassword, setupEmail.trim());
    setIsAuthBusy(false);
    if (!result.ok) {
      setAuthError(result.error || 'Could not configure admin password.');
      return;
    }
    setSetupPassword('');
    setSetupConfirm('');
  };

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    if (!unlockPassword) {
      setAuthError('Enter your admin password to unlock editing.');
      return;
    }
    setIsAuthBusy(true);
    const result = await loginAdmin(unlockPassword);
    setIsAuthBusy(false);
    if (!result.ok) {
      setAuthError(result.error || 'Incorrect admin password.');
      return;
    }
    setUnlockPassword('');
    setShowForgotFlow(false);
  };

  const handleSaveProtectedIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setIsAuthBusy(true);
    const result = await saveProtectedIdentity({
      appName: appNameDraft.trim() || appName,
      userProfile: {
        name: name.trim() || userProfile.name,
        role: role.trim() || userProfile.role,
        organization: organization.trim() || userProfile.organization,
        email: email.trim() || userProfile.email,
      },
    });
    setIsAuthBusy(false);
    if (!result.ok) {
      setAuthError(result.error || 'Failed to save protected settings.');
      return;
    }
    setAuthNotice('App Name and engineer details saved.');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    if (newAdminPassword.length < 8) {
      setAuthError('New admin password must be at least 8 characters.');
      return;
    }
    if (newAdminPassword !== confirmNewAdminPassword) {
      setAuthError('New passwords do not match.');
      return;
    }
    setIsAuthBusy(true);
    const result = await changeAdminPassword(currentPassword, newAdminPassword);
    setIsAuthBusy(false);
    if (!result.ok) {
      setAuthError(result.error || 'Could not update admin password.');
      return;
    }
    setCurrentPassword('');
    setNewAdminPassword('');
    setConfirmNewAdminPassword('');
    setShowChangePassword(false);
    setAuthNotice('Admin password updated successfully.');
  };

  const handleRequestResetCode = async () => {
    setAuthError('');
    setAuthNotice('');
    setIsAuthBusy(true);
    const result = await requestPasswordReset();
    setIsAuthBusy(false);
    if (!result.ok) {
      setAuthError(result.error || 'Could not send reset email.');
      return;
    }
    setResetCodeSentTo(result.maskedEmail || adminStatus.adminEmailMasked || 'recovery email');
    setAuthNotice(
      `A one-time reset code was sent to ${result.maskedEmail || 'your recovery email'}. It expires in ${result.expiresInMinutes ?? 15} minutes.`
    );
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    if (!resetCode.trim()) {
      setAuthError('Enter the reset code from your email.');
      return;
    }
    if (resetNewPassword.length < 8) {
      setAuthError('New admin password must be at least 8 characters.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setAuthError('New passwords do not match.');
      return;
    }
    setIsAuthBusy(true);
    const result = await confirmPasswordReset(resetCode.trim(), resetNewPassword);
    setIsAuthBusy(false);
    if (!result.ok) {
      setAuthError(result.error || 'Reset code verification failed.');
      return;
    }
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetCodeSentTo('');
    setShowForgotFlow(false);
    setAuthNotice('Admin password has been reset. Enter your new password to unlock editing.');
  };

  const handleExportAllBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      application: `${appName} Power Distribution Simulator`,
      simulations: savedSimulations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_saved_simulations_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported all saved simulations to JSON.', 'info');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const list: SavedSimulationRecord[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.simulations)
            ? parsed.simulations
            : parsed.config && parsed.summary
              ? [parsed]
              : [];
        if (list.length === 0) {
          setImportError('No valid saved simulations found in the selected JSON file.');
          return;
        }
        await importSavedSimulations(list);
      } catch {
        setImportError(`Invalid JSON file. Please choose a ${appName} backup export.`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeCurrency: CurrencyCode = config.currency || defaultCurrency;
  const activeCurrencyMeta = CURRENCIES[activeCurrency];

  const handleSelectCurrency = (code: CurrencyCode) => {
    const meta = CURRENCIES[code];
    setDefaultCurrency(code);
    setCurrency(code, true);
    showToast(`Switched billing currency to ${meta.code} (${meta.symbol})`, 'info');
  };

  const isDraftSavedInCatalog = solarPanels.some((p) => p.id === panelDraft.id);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Workspace Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure billing currency, solar panel physics catalog, engineer profile, and database backup controls.
        </p>
      </div>

      {/* Currency & Regional Tariff Defaults */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Billing Currency & Regional Tariff Baselines
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sets the active simulation and default billing currency, and applies regional ToU tariff defaults.
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 shrink-0">
            <span>Currency</span>
            <select
              aria-label="Billing currency"
              value={activeCurrency}
              onChange={(e) => handleSelectCurrency(e.target.value as CurrencyCode)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer"
            >
              {CURRENCY_LIST.map((code: CurrencyCode) => {
                const meta = CURRENCIES[code];
                return (
                  <option key={code} value={code}>
                    {meta.code} ({meta.symbol}) — {meta.name}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {CURRENCY_LIST.map((code: CurrencyCode) => {
            const meta = CURRENCIES[code];
            const selected = activeCurrency === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => handleSelectCurrency(code)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50/70 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-sm font-bold">{meta.code}</span>
                  <span className="font-mono text-base font-semibold">{meta.symbol}</span>
                </div>
                <div
                  className={`text-[11px] mt-1 truncate ${
                    selected ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {meta.name}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-slate-600">
            Baseline tariffs for <strong>{activeCurrencyMeta.code}</strong>:{' '}
            <span className="font-mono text-slate-900">
              Off-Peak {formatRate(activeCurrencyMeta.defaultOffPeakRate, activeCurrency)} · Peak{' '}
              {formatRate(activeCurrencyMeta.defaultPeakRate, activeCurrency)} · Export{' '}
              {formatRate(activeCurrencyMeta.defaultExportCreditRate, activeCurrency)}
            </span>
          </div>
        </div>
      </section>

      {/* Solar Panel Specifications & Preselected Catalog */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Sun className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Solar Panel Catalog & Physics Specifications
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure module wattage, conversion efficiency, area, thermal coefficient, NOCT, and BOS losses used to calculate hourly PV generation from solar irradiation (W/m²).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleStartNewPanel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Panel
            </button>
            <button
              type="button"
              onClick={() => {
                resetSolarPanelsToDefaults();
                setEditingPanelId(solarPanels[0]?.id || 'panel_topcon_580');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
              title="Restore built-in calibrated solar panels"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Defaults
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Panel Selector List */}
          <div className="lg:col-span-5 space-y-2">
            {solarPanels.map((panel) => {
              const isActiveSim = config.solarPanelId === panel.id;
              const isDefault = defaultSolarPanelId === panel.id;
              const isEditing = panelDraft.id === panel.id;
              return (
                <div
                  key={panel.id}
                  onClick={() => loadPanelIntoEditor(panel)}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                    isEditing
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                        <span>{panel.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {panel.technology} · {panel.manufacturer}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectSolarPanel(panel.id, true);
                          loadPanelIntoEditor(panel);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                          isActiveSim
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        {isActiveSim && <Check className="w-3 h-3" />}
                        {isActiveSim ? (isDefault ? 'Active · Default' : 'Active') : 'Use Panel'}
                      </button>

                      {solarPanels.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSolarPanel(panel.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete panel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-4 gap-1 font-mono tabular-nums text-[10px] text-slate-600">
                    <div>
                      <span className="text-slate-400 block">Rated</span>
                      <strong className="text-slate-900">{panel.wattageWp} Wp</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Eff.</span>
                      <strong className="text-slate-900">{panel.efficiencyPct}%</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Temp Coeff</span>
                      <strong className="text-slate-900">{panel.tempCoeffPctPerC}%/°C</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">NOCT / BOS</span>
                      <strong className="text-slate-900">
                        {panel.noctC}°C / -{panel.systemLossPct}%
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Panel Parameter Editor Form */}
          <form
            onSubmit={handleSavePanelDraft}
            className="lg:col-span-7 rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="text-xs font-semibold text-slate-900">
                {isDraftSavedInCatalog ? 'Edit Panel Specification' : 'New Custom Solar Panel'}
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                STC 1000 W/m² · 25°C
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-[11px] font-medium text-slate-700">
                Model Name
                <input
                  type="text"
                  required
                  value={panelDraft.name}
                  onChange={(e) => setPanelDraft({ ...panelDraft, name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <label className="block text-[11px] font-medium text-slate-700">
                Cell Technology
                <select
                  value={panelDraft.technology}
                  onChange={(e) =>
                    setPanelDraft({
                      ...panelDraft,
                      technology: e.target.value as SolarPanelTechnology,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  {PANEL_TECHNOLOGIES.map((tech) => (
                    <option key={tech} value={tech}>
                      {tech}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="block text-[11px] font-medium text-slate-700">
                Rated Power (Wp)
                <input
                  type="number"
                  min={50}
                  max={1200}
                  step={5}
                  value={panelDraft.wattageWp}
                  onChange={(e) =>
                    setPanelDraft({
                      ...panelDraft,
                      wattageWp: Math.max(50, Number(e.target.value) || 0),
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <label className="block text-[11px] font-medium text-slate-700">
                Efficiency (%)
                <input
                  type="number"
                  min={8}
                  max={35}
                  step={0.1}
                  value={panelDraft.efficiencyPct}
                  onChange={(e) =>
                    setPanelDraft({
                      ...panelDraft,
                      efficiencyPct: Number(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <label className="block text-[11px] font-medium text-slate-700">
                Module Area (m²)
                <input
                  type="number"
                  min={0.3}
                  max={6}
                  step={0.01}
                  value={panelDraft.areaM2}
                  onChange={(e) =>
                    setPanelDraft({
                      ...panelDraft,
                      areaM2: Number(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <label className="block text-[11px] font-medium text-slate-700">
                Temp Coeff (%/°C)
                <input
                  type="number"
                  min={-0.7}
                  max={-0.05}
                  step={0.01}
                  value={panelDraft.tempCoeffPctPerC}
                  onChange={(e) =>
                    setPanelDraft({
                      ...panelDraft,
                      tempCoeffPctPerC: Number(e.target.value) || -0.35,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <label className="block text-[11px] font-medium text-slate-700">
                NOCT (°C)
                <input
                  type="number"
                  min={30}
                  max={60}
                  step={1}
                  value={panelDraft.noctC}
                  onChange={(e) =>
                    setPanelDraft({
                      ...panelDraft,
                      noctC: Number(e.target.value) || 45,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <label className="block text-[11px] font-medium text-slate-700">
                BOS / Soiling Loss (%)
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={0.5}
                  value={panelDraft.systemLossPct}
                  onChange={(e) =>
                    setPanelDraft({
                      ...panelDraft,
                      systemLossPct: Number(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono tabular-nums text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <span className="font-mono text-[10px] text-slate-500">
                STC Check: {(panelDraft.areaM2 * (panelDraft.efficiencyPct / 100) * 1000).toFixed(0)} W @ 1000 W/m²
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
                >
                  Save Panel Specs
                </button>
                <button
                  type="button"
                  onClick={() => {
                    upsertSolarPanel(panelDraft);
                    selectSolarPanel(panelDraft.id, true);
                  }}
                  className="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors"
                >
                  Save & Set Default
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Admin-Protected App Name & Engineer Profile */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <img
              src="/assets/aistudio/bdtpower-logo_21164a7b.png"
              alt={`${appName} logo`}
              referrerPolicy="no-referrer"
              className="w-9 h-9 object-contain shrink-0 rounded-md border border-slate-200 bg-white p-0.5"
            />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                {adminStatus.authenticated ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                <span>App Identity & Engineer Profile</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Changing the application name or engineer details requires an admin password.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`font-mono text-[11px] font-semibold px-2 py-1 rounded border ${
                adminStatus.authenticated
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : !adminStatus.adminConfigured && adminStatus.loaded
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {adminStatus.authenticated
                ? 'Admin Unlocked'
                : !adminStatus.adminConfigured && adminStatus.loaded
                  ? 'Admin Setup Required'
                  : 'Locked'}
            </span>

            {adminStatus.authenticated && (
              <button
                type="button"
                onClick={() => {
                  logoutAdmin();
                  setShowChangePassword(false);
                  setAuthError('');
                  setAuthNotice('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
              >
                <Lock className="w-3 h-3" />
                Lock
              </button>
            )}
          </div>
        </div>

        {/* Read-only identity summary when locked */}
        {!adminStatus.authenticated && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                App Name
              </span>
              <strong className="text-slate-900 font-semibold">{appName}</strong>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                Engineer
              </span>
              <strong className="text-slate-900 font-medium">{userProfile.name}</strong>
              <span className="block text-[11px] text-slate-500 truncate">{userProfile.role}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                Organization
              </span>
              <strong className="text-slate-800 font-medium">{userProfile.organization}</strong>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                Email / Recovery
              </span>
              <strong className="text-slate-800 font-mono text-[11px] break-all">
                {userProfile.email}
              </strong>
            </div>
          </div>
        )}

        {authError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-medium">
            {authError}
          </div>
        )}

        {authNotice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 font-medium">
            {authNotice}
          </div>
        )}

        {/* First-Run Admin Password Setup (when no env password or DB hash exists yet) */}
        {adminStatus.loaded && !adminStatus.adminConfigured && !adminStatus.envPasscodeActive && (
          <form
            onSubmit={handleSetupAdmin}
            className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <KeyRound className="w-3.5 h-3.5 text-slate-700" />
              Set Initial Admin Password
            </div>
            <p className="text-xs text-slate-600">
              Create an admin password (minimum 8 characters) to lock changes to the App Name and Engineer Profile. Your recovery email receives password reset codes when SMTP is configured.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-xs text-slate-700 font-medium">
                Admin Password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>
              <label className="block text-xs text-slate-700 font-medium">
                Confirm Password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>
              <label className="block text-xs text-slate-700 font-medium">
                Recovery Email
                <input
                  type="email"
                  required
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAuthBusy}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                {isAuthBusy ? 'Saving...' : 'Set Admin Password & Unlock'}
              </button>
            </div>
          </form>
        )}

        {/* Locked State: Admin Password Unlock + SMTP Forgot Password Reset Flow */}
        {adminStatus.loaded && adminStatus.adminConfigured && !adminStatus.authenticated && (
          <div className="space-y-3">
            <form
              onSubmit={handleUnlockAdmin}
              className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5"
            >
              <label className="flex-1 block text-xs text-slate-700 font-medium">
                Admin Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Enter admin password to edit App Name & Profile"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>
              <button
                type="submit"
                disabled={isAuthBusy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0"
              >
                <Unlock className="w-3.5 h-3.5" />
                {isAuthBusy ? 'Verifying...' : 'Unlock Editing'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgotFlow((prev) => !prev);
                  setAuthError('');
                  setAuthNotice('');
                }}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shrink-0"
              >
                {showForgotFlow ? 'Hide Reset' : 'Forgot Password?'}
              </button>
            </form>

            {showForgotFlow && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Mail className="w-3.5 h-3.5 text-slate-700" />
                    Reset Admin Password via SMTP Email
                  </div>
                  <span
                    className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      adminStatus.smtpConfigured
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {adminStatus.smtpConfigured ? 'SMTP Ready' : 'SMTP Not Configured'}
                  </span>
                </div>

                {adminStatus.envPasscodeActive ? (
                  <p className="text-xs text-slate-600">
                    The admin password is currently controlled by the server{' '}
                    <code className="font-mono text-slate-900">ADMIN_PASSWORD</code> environment secret. Update or clear that secret in{' '}
                    <strong>Settings → Secrets</strong> to change it.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <span>
                        Recovery destination:{' '}
                        <strong className="font-mono text-slate-900">
                          {adminStatus.adminEmailMasked || 'Not set'}
                        </strong>
                      </span>
                      <button
                        type="button"
                        disabled={isAuthBusy || !adminStatus.smtpConfigured}
                        onClick={handleRequestResetCode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white text-xs font-semibold transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {isAuthBusy
                          ? 'Sending...'
                          : resetCodeSentTo
                            ? 'Resend Reset Code'
                            : 'Send Reset Code'}
                      </button>
                    </div>

                    {!adminStatus.smtpConfigured && (
                      <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-[11px] text-amber-900 space-y-1">
                        <div className="font-semibold">Server SMTP Secrets Required</div>
                        <p>
                          Configure your SMTP credentials in server environment secrets (never stored in the browser):{' '}
                          <code className="font-mono">
                            SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
                          </code>{' '}
                          (and optional <code className="font-mono">ADMIN_RESET_EMAIL</code>).
                        </p>
                      </div>
                    )}

                    <form
                      onSubmit={handleConfirmPasswordReset}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200"
                    >
                      <label className="block text-xs text-slate-700 font-medium">
                        Reset Code
                        <input
                          type="text"
                          required
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                          placeholder="8-character code"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono uppercase text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                      </label>
                      <label className="block text-xs text-slate-700 font-medium">
                        New Admin Password
                        <input
                          type="password"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                      </label>
                      <label className="block text-xs text-slate-700 font-medium">
                        Confirm New Password
                        <input
                          type="password"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                      </label>
                      <div className="sm:col-span-3 flex justify-end">
                        <button
                          type="submit"
                          disabled={isAuthBusy}
                          className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                        >
                          {isAuthBusy ? 'Verifying Code...' : 'Verify Code & Reset Password'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Unlocked State: Edit App Name, Engineer Profile, and Change Admin Password */}
        {adminStatus.authenticated && (
          <div className="space-y-4">
            <form
              onSubmit={handleSaveProtectedIdentity}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
            >
              <label className="sm:col-span-2 block text-xs text-slate-700 font-medium">
                Application Name (Top Menu Bar & Browser Title)
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={appNameDraft}
                  onChange={(e) => setAppNameDraft(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <label className="block text-xs text-slate-700 font-medium">
                Full Name
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>
              <label className="block text-xs text-slate-700 font-medium">
                Role / Title
                <input
                  type="text"
                  maxLength={80}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>
              <label className="block text-xs text-slate-700 font-medium">
                Organization
                <input
                  type="text"
                  maxLength={100}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>
              <label className="block text-xs text-slate-700 font-medium">
                Email Address (Password Reset Recovery)
                <input
                  type="email"
                  required
                  maxLength={160}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </label>

              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1">
                {!adminStatus.envPasscodeActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassword((prev) => !prev);
                      setAuthError('');
                      setAuthNotice('');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {showChangePassword ? 'Cancel Password Change' : 'Change Admin Password'}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Password managed via server <code className="font-mono">ADMIN_PASSWORD</code> secret.
                  </span>
                )}

                <button
                  type="submit"
                  disabled={isAuthBusy}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                >
                  {isAuthBusy ? 'Saving...' : 'Save App Name & Profile'}
                </button>
              </div>
            </form>

            {showChangePassword && !adminStatus.envPasscodeActive && (
              <form
                onSubmit={handleChangePassword}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3"
              >
                <div className="text-xs font-semibold text-slate-900">Update Admin Password</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block text-xs text-slate-700 font-medium">
                    Current Password
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </label>
                  <label className="block text-xs text-slate-700 font-medium">
                    New Password
                    <input
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </label>
                  <label className="block text-xs text-slate-700 font-medium">
                    Confirm New Password
                    <input
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={confirmNewAdminPassword}
                      onChange={(e) => setConfirmNewAdminPassword(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isAuthBusy}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                  >
                    {isAuthBusy ? 'Updating...' : 'Update Admin Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {/* Standalone Persistence & Backup */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Standalone Simulation Database
              </h2>
              <p className="text-xs text-slate-500">
                {savedSimulations.length} saved simulation(s) · Active backend:{' '}
                <strong className="text-slate-700">
                  {storageMode === 'sqlite'
                    ? 'Express SQLite (standalone_simulations)'
                    : 'Local Browser Fallback'}
                </strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportAllBackup}
            disabled={savedSimulations.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            Export All Saved JSON
          </button>

          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Backup JSON
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            onChange={handleImportBackup}
            className="hidden"
          />

          {savedSimulations.length > 0 && !confirmClear && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-medium text-rose-700 ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Saved
            </button>
          )}

          {confirmClear && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-rose-700 font-medium">Delete all saved runs?</span>
              <button
                type="button"
                onClick={async () => {
                  await clearAllSavedSimulations();
                  setConfirmClear(false);
                }}
                className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2.5 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {importError && <p className="text-xs text-rose-600 font-medium">{importError}</p>}
      </section>
    </div>
  );
};
