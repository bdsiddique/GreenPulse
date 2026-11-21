# Standalone Power Generation & Distribution Simulations

A dedicated **Simulations** bottom-navigation workspace for conducting realistic, deterministic power generation and distribution experiments under custom operating circumstances—completely independent of any quotation, pipeline draft, or portfolio project. Engineers and planners can model solar PV arrays, battery banks, household loads, net-metering exports, and sanctioned utility grid peak limits across 24-hour or 72-hour horizons, or inject their own fabricated time-series datasets and compare saved scenarios side by side.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The four core capability decisions below were confirmed during our discussion and form the foundation of this plan. Please review the proposed engineering defaults and click **Proceed** to begin implementation, or request any revisions before code is written.

- **Confirmed Decision 1 — Power Sources & Distribution Layers**: Models **PV array generation**, **battery energy storage**, **bidirectional utility grid exchange** (export to grid enabled only when **Net-Metering** is installed/active; import from grid when available), **peak power capacity permitted by the grid** (enforced utility connection cap with peak-shaving & breach/shed-load alerts), and **household average power** with configurable daily demand profiles.
- **Confirmed Decision 2 — Operating Circumstances & Stress Tests**: Includes all five stress-test modes:
  1. Weather swings & monsoon cloud drops
  2. Grid outages & scheduled load shedding
  3. Zero-export limits & grid feed-in caps
  4. Time-of-use (ToU) peak tariff shaving
  5. Multi-day **72-hour blackout autonomy** stress test
- **Confirmed Decision 3 — Visualizations**: Combines a **live interactive power-flow schematic**, an **hourly playback scrubber** (24h / 72h play, pause, speed, and manual step inspection), and synchronized **Recharts analytics graphs**.
- **Confirmed Decision 4 — Scenario Management & Custom Data**: Supports **standalone saved presets** with **side-by-side comparison** as well as a **User-Fabricated Data Mode** (inline hourly editor + CSV/JSON import/export) for testing arbitrary custom PV, load, outage, and tariff profiles.
- **Recommended Default — Standalone Persistence**: Presets persist to an isolated backend SQLite table (`standalone_simulations`) with automatic client-side fallback caching, guaranteeing full independence from quotations and portfolio projects while surviving browser reloads and shared workstation use.

---

## 1. Overview & Core Concept

- **What It Does**: Adds a new **Simulations** destination to the bottom navigation bar that opens a self-contained electrical power-flow sandbox. Users define virtual system capacities (PV kWp, Inverter kW, Battery kWh & C-rate, Permitted Grid Peak kW, Net-Metering toggle, and Household Average kW), apply stress circumstances or enter custom fabricated hourly data, and immediately inspect instantaneous kW distribution, energy balances, battery state-of-charge (SOC), curtailment, grid-cap breaches, and electricity costs.
- **Target Audience / Persona**: Solar EPC engineers, energy consultants, and system designers validating edge-case operating scenarios (such as monsoon cloud transients, utility peak penalties, zero-export compliance, or multi-day blackout survival) without creating or altering client quotations.
- **Key Value**: Decouples exploratory engineering physics from commercial quotation workflows—turning "what-if" energy distribution questions into repeatable, comparable, visual stress tests in seconds.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Zero-State & Instant Live Sandbox**: Opening **Simulations** from the bottom bar loads a realistic default residential-hybrid scenario (e.g., 6 kWp PV, 10 kWh LiFePO4 battery, 2.2 kW household average load, 5.0 kW permitted grid peak, Net-Metering enabled) already solved and ready to scrub—no empty screen or project selection gate required.
2. **Applying Operating Circumstances & Stress Tests**: Users select a one-click stress scenario strip (*Normal Clear Day*, *Monsoon Cloud Drop*, *Scheduled Load Shedding*, *Zero-Export / Feed-In Cap*, *ToU Peak Tariff Shaving*, *72-Hour Blackout Stress*) or fine-tune individual parameters (horizon `24h` vs. `72h`, cloud drop window & severity, grid outage intervals, export cap kW, ToU peak window & rates, battery reserve SOC, and grid peak-shaving threshold).
3. **Interactive Power-Flow Schematic & Hourly Scrubber**:
   - The focal top panel displays a live vector power-flow diagram connecting **Solar PV Array**, **Hybrid Inverter / AC Bus**, **Battery Storage Bank**, **Utility Grid** (annotated with **Permitted Peak kW** and **Net-Metering ON/OFF** status), and **Household Load**.
   - Animated directional conduits scale visually by active kW magnitude and shift color cleanly by flow role (solar generation, battery charge/discharge, grid import, net-metering export, curtailed PV, or grid-cap breach / unserved load).
   - Directly beneath sits a transport bar with Play/Pause, playback speed (`1x`, `2x`, `4x`), Day 1–3 jump buttons (in 72h mode), and a continuous hourly scrubber showing exact timestamped telemetry for the selected hour.
4. **Recharts Multi-Chart Analysis Suite**:
   - **Generation & Distribution Stack**: Composed chart comparing PV generation, battery discharge, grid import, net-metering export, household demand curve, shaded outage intervals, and a horizontal dashed reference line marking the **Permitted Grid Peak Capacity (kW)**.
   - **Battery SOC & Curtailment Curve**: Tracks battery percentage against the configured minimum reserve floor alongside curtailed solar energy (when Net-Metering is OFF or export cap is reached) and any unserved load (during blackouts or grid-cap breaches).
   - **ToU Tariff & Net Billing Impact**: Hourly import cost vs. net-metering export credit and cumulative savings over the simulation horizon.
5. **User-Fabricated Data Mode**:
   - Switching the input source from **Parametric Model** to **Fabricated Data** opens an editable hourly grid (`Hour`, `PV Gen (kW)`, `Household Load (kW)`, `Grid Online (On/Off)`, `Tariff Rate (BDT/kWh)`).
   - Includes quick helpers: *Seed from Current Parametric Run* (so users can tweak just a few hours without typing all 24/72 rows), *Paste CSV / TSV*, *Upload CSV / JSON*, *Download Template CSV*, and *Inject Custom Spike / Outage Block*. Every edit recomputes the schematic and charts live.
6. **Standalone Presets & Side-by-Side Comparison**:
   - Users can save the current simulation (including fabricated data if active) as a named standalone preset with optional notes, reload any saved preset, duplicate it, or delete it.
   - Switching to the **Compare** view lets users pick any two scenarios (e.g., *Active Sandbox vs. Saved Preset* or *Preset A vs. Preset B*) to inspect a structured side-by-side KPI delta table (Self-Consumption %, Grid Independence %, Peak Grid Import vs. Permitted Limit, Curtailed PV kWh, Unserved Load kWh, Min Battery SOC %, Blackout Survival Hours, Net Energy Cost) plus synchronized overlay Recharts curves.

### Visual Identity & Theme

- **Aesthetic Direction**: Utilitarian, precision engineering instrumentation—matching the existing enterprise desktop workspace while feeling like an authoritative electrical dispatch console.
- **Color Palette & Mood**: Clean high-contrast light surface (`#FFFFFF` panels on `#F8FAFC` / `#F1F5F9` canvas) paired with a dark slate telemetry stage (`#0F172A` / `#1E293B`) specifically for the live Power-Flow Schematic instrument panel so animated energy conduits read with high clarity. Semantic colors are reserved strictly for engineering state:
  - **Solar / Generation**: Amber (`#D97706` / `#F59E0B`)
  - **Nominal / Battery Healthy / Export**: Emerald Green (`#16A34A`)
  - **Utility Grid Exchange**: Slate / Indigo (`#475569` / `#4F46E5`)
  - **Warning / Curtailment / Near Grid Cap**: Warm Amber (`#D97706`)
  - **Alert / Grid Outage / Cap Breach / Unserved Load**: Crimson (`#DC2626`)
- **Typography & Hierarchy**: Contemporary technical sans (`Plus Jakarta Sans`) for section headings, controls, and navigation paired with strict tabular monospace numerals (`JetBrains Mono` / `tabular-nums`) for every kW, kWh, %, BDT, and hour readout so scrubbed values never jitter horizontally.
- **Component Styling & Layout**:
  - **Single-Elevation Discipline**: Flat bordered panels (`1px` neutral borders) with structured dividers—no nested card sandwiches, no thick left accent borders, no decorative pulsing dots, and no pill-tag clutter.
  - **Compact Data Tables**: `36px–44px` row heights in the Fabricated Data grid and Comparison matrix with left-aligned labels and right-aligned tabular numbers.
  - **Bottom Navigation Balance**: Expanding the bottom bar from 6 to 7 items (*Hub*, *Pipeline*, *Portfolio*, *Analysis*, *Simulations*, *Library*, *Settings*) will refine item sizing (`min-w-0 flex-1` with compact spacing) so all 7 destinations fit comfortably on a single horizontal row without clipping on desktop or mobile viewports.

### Interactive Feedback & Motion

- **Live Telemetry Feedback**: Scrubbing or toggling any switch (e.g., turning Net-Metering OFF or lowering Permitted Grid Peak kW) updates the power-flow arrows, KPI strip, and Recharts curves synchronously on the same frame.
- **Explicit Limit & Fault Callouts**: When grid import exceeds `Permitted Grid Peak kW` or blackout demand exceeds battery capacity, clean inline status banners highlight the exact hour(s), peak kW overshoot, and total unserved kWh.
- **Empty, Loading & Error States**: Saved Presets displays a clear empty state with a primary *"Save Current Run as Preset"* action; CSV/JSON import validates numeric bounds and reports malformed rows inline without crashing or using browser alert dialogs.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Strict Isolation from Quotations & Portfolio**
  - *Chosen Approach*: Create a dedicated standalone simulation state store and dedicated backend preset table completely decoupled from `useProjectStore`, pipeline drafts, and finalized portfolio records.
  - *Why*: Honor the core requirement that Simulations is an independent engineering sandbox, preventing accidental mutation of active client quotes or pricing snapshots.
  - *Alternatives Considered*: Linking to the currently open quotation draft—rejected because it couples sandbox experiments to commercial quote state and forces users to open a project before simulating.

- **Decision 2 — Deterministic Hour-by-Hour Dispatch Engine (24h & 72h)**
  - *Chosen Approach*: Implement a pure, deterministic time-step energy balance engine in TypeScript supporting both 24-hour and 72-hour (1-hour resolution) runs with explicit dispatch priority rules:
    1. Serve Household Load directly from PV first.
    2. Surplus PV charges Battery (bounded by max charge rate, efficiency, and 100% SOC); remaining surplus exports to Grid **only if** Grid is Online AND Net-Metering is Installed AND Zero-Export is OFF (clamped to `min(exportCapKw, permittedGridPeakKw)`); anything left is recorded as **Curtailed PV**.
    3. Load deficit (Load > PV) is served by Battery discharge (subject to inverter rating, discharge C-rate, minimum reserve SOC, and ToU/Peak-Shaving dispatch rules).
    4. Remaining deficit imports from Grid (when Grid is Online) clamped to **Permitted Grid Peak Capacity**; any demand still exceeding `PV + Battery + Permitted Grid Peak` (or during an active Grid Outage after battery hits reserve SOC) is logged as **Grid Overload / Unserved Load**.
  - *Why*: Gives instant `< 5ms` recalculation as sliders move, guarantees transparent auditable engineering physics, and requires zero external API keys or network latency.
  - *Alternatives Considered*: External weather/AI API calls—explicitly avoided due to reliability, determinism, and prior decision to avoid API key dependencies.

- **Decision 3 — Unified Parametric & User-Fabricated Data Pipeline**
  - *Chosen Approach*: Both Parametric Circumstances and User-Fabricated Data normalize into the exact same `HourlyInputStep[]` array (`hourIndex`, `pvKw`, `loadKw`, `gridAvailable`, `tariffImportBdt`, `tariffExportBdt`) before entering the dispatch engine.
  - *Why*: Ensures 100% parity across the live schematic, scrubber, Recharts graphs, KPI summaries, saved presets, and side-by-side comparisons regardless of whether data was generated parametrically or fabricated by the user.
  - *Alternatives Considered*: Separate rendering logic for custom CSV uploads—rejected because it duplicates physics and breaks preset comparison.

- **Decision 4 — Standalone Preset Persistence Strategy**
  - *Chosen Approach*: Store standalone presets in a new `standalone_simulations` SQLite table exposed via dedicated REST endpoints (`/api/simulations`), hydrated into an isolated Zustand store with automatic localStorage mirror for instant startup and offline resilience.
  - *Why*: Matches the application's existing SQLite architecture, persists across sessions/restarts, and keeps saved simulations completely separate from `projects`.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Bottom Navigation Bar (7 Items)                          │
│     Hub · Pipeline · Portfolio · Analysis · [Simulations] · Library · Settings│
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │ Route: /simulations
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Simulations Workspace Shell                              │
│  Top Header: Mode Tabs [Sandbox | Fabricated Data | Compare] + Preset Picker │
├──────────────────────────────────────┬───────────────────────────────────────┤
│   LEFT PANEL: Parameters & Stress    │   RIGHT STAGE: Live Visual & Charts   │
│                                      │                                       │
│  ┌────────────────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │ Quick Circumstance Scenarios   │  │  │ Live Power-Flow Schematic (SVG) │  │
│  │ • Clear Day  • Monsoon Drop    │  │  │  PV ──► Inverter Bus ──► House  │  │
│  │ • Load Shed  • Zero-Export     │  │  │            ▲    ▲               │  │
│  │ • ToU Shave  • 72h Blackout    │  │  │            ▼    ▼               │  │
│  └────────────────────────────────┘  │  │         Battery  Grid (NM/Cap)  │  │
│  ┌────────────────────────────────┐  │  ├─────────────────────────────────┤  │
│  │ System & Grid Constraints      │  │  │ Hourly Playback Scrubber        │  │
│  │ • PV kWp, Inverter kW          │  │  │ [Play/Pause] [Speed] [0h..72h]  │  │
│  │ • Battery kWh / Reserve / Rate │  │  └─────────────────────────────────┘  │
│  │ • Household Avg Power & Shape  │  │  ┌─────────────────────────────────┐  │
│  │ • Net-Metering Installed (Y/N) │  │  │ KPI Summary Strip (Tabular)     │  │
│  │ • Permitted Grid Peak Cap (kW) │  │  │ Yield · Self-Use · Peak Import  │  │
│  │ • Export Cap / ToU / Outages   │  │  │ Curtailed · Unserved · Net Cost │  │
│  └────────────────────────────────┘  │  └─────────────────────────────────┘  │
│                                      │  ┌─────────────────────────────────┐  │
│  (Alternate Mode: Fabricated Data    │  │ Recharts Analytics Suite        │  │
│   Hourly Table + CSV/JSON Importer)  │  │ 1. Power Balance & Grid Peak Cap│  │
│                                      │  │ 2. Battery SOC & Curtailment    │  │
│  (Alternate Mode: Compare View       │  │ 3. ToU Billing & Savings        │  │
│   Preset A vs. Preset B Delta)       │  └─────────────────────────────────┘  │
└──────────────────┬───────────────────┴───────────────────┬───────────────────┘
                   │                                       │
                   ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│               Pure Deterministic Power-Flow Dispatch Engine                  │
│  Input: SimulationConfig + (Parametric Generator OR Fabricated Hourly Rows)  │
│  Output: HourlyStepResult[24 | 72] + Aggregate KPIs + Grid Breach Diagnostics│
└──────────────────┬───────────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            Isolated Standalone Simulation Store & Express API                │
│   Zustand Store (standalone) ◄──► /api/simulations ◄──► SQLite Table         │
│   (Zero read/write coupling to Quotation Pipeline or Portfolio Projects)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`SimulationConfig`**:
  - *Horizon & Source*: `horizonHours` (`24 | 72`), `inputMode` (`'parametric' | 'fabricated'`), `activeScenarioId`.
  - *System Assets*: `pvCapacityKw`, `inverterRatedKw`, `inverterEfficiencyPct`, `batteryCapacityKwh`, `batteryMaxChargeKw`, `batteryMaxDischargeKw`, `batteryInitialSocPct`, `batteryMinReserveSocPct`, `batteryRoundTripEffPct`.
  - *Household Demand*: `householdAvgKw`, `loadArchetype` (`'residential_evening' | 'work_from_home' | 'flat_baseload' | 'commercial_daytime'`), `loadPeakFactor`.
  - *Grid & Net-Metering*: `netMeteringInstalled` (`boolean`), `zeroExportEnabled` (`boolean`), `gridExportCapKw`, `permittedGridPeakKw`, `peakShavingEnabled` (`boolean`).
  - *Circumstances & Stress Parameters*:
    - *Weather / Monsoon*: `weatherProfile` (`'clear' | 'partly_cloudy' | 'monsoon_drop' | 'overcast_multi_day'`), `cloudDropStartHour`, `cloudDropDurationHours`, `cloudDropSeverityPct`.
    - *Outages / Blackout*: `outageWindows` (list of `{ startHour, endHour, label }`, including 72h blackout presets).
    - *ToU Tariff*: `touEnabled`, `offPeakRateBdt`, `peakRateBdt`, `peakStartHour`, `peakEndHour`, `exportCreditRateBdt`, `touBatteryDischargeOnlyOnPeak`.
  - *Fabricated Time-Series*: `fabricatedRows: Array<{ hour: number; pvKw: number; loadKw: number; gridOnline: boolean; importRateBdt: number; exportRateBdt: number }>`.
- **`HourlyStepResult`**:
  - Per-hour solved values: `hour`, `dayIndex`, `clockLabel`, `pvAvailableKw`, `pvUsedDirectKw`, `pvToBatteryKw`, `pvExportedKw`, `pvCurtailedKw`, `batteryChargeKw`, `batteryDischargeKw`, `batterySocPct`, `gridOnline`, `gridImportKw`, `gridExportKw`, `gridPeakCapKw`, `gridCapBreachKw`, `unservedLoadKw`, `householdLoadKw`, `hourlyImportCostBdt`, `hourlyExportCreditBdt`, `hourlyNetCostBdt`, `activeEvents` (e.g., `OUTAGE`, `MONSOON_DROP`, `PEAK_SHAVING`, `EXPORT_CAPPED`, `GRID_CAP_BREACH`).
- **`SimulationPresetRecord`** (persisted in SQLite `standalone_simulations`):
  - `id`, `name`, `description`, `tags`, `horizon_hours`, `input_mode`, `config_json`, `summary_json`, `created_at`, `updated_at`.

### Interactive Component & State Mapping

- **Bottom Nav & Route Shell**: Clicking **Simulations** navigates to `/simulations` and updates the page title without touching project store state.
- **Quick Circumstance Scenario Strip**: Selecting any of the 6 stress-test cards atomically updates the relevant circumstance fields (e.g., *72-Hour Blackout* sets `horizonHours = 72` and configures a multi-day outage schedule; *Zero-Export* enables `zeroExportEnabled` or lowers `gridExportCapKw`; *ToU Shaving* configures peak tariff hours and battery discharge strategy) and resets playback cleanly if horizon changes.
- **System & Grid Constraint Sliders/Toggles**: Every slider and toggle (including **Net-Metering Installed**, **Permitted Grid Peak kW**, and **Household Average kW**) validates min/max ranges and triggers instant deterministic re-simulation via memoized selectors.
- **Live Power-Flow Schematic & Scrubber**: Play/Pause drives a clean `requestAnimationFrame`/interval timer stepping `selectedHour` from `0` to `horizonHours - 1`; dragging the scrubber or clicking any chart data point jumps `selectedHour` immediately and updates every flow conduit label, direction, and warning state.
- **Fabricated Data Studio**: Inline numeric inputs update individual hours directly; *Seed from Parametric* copies the active parametric arrays into editable rows; *Import CSV / JSON* parses and validates pasted or uploaded files with inline error feedback; *Export CSV* downloads the current dataset for offline editing.
- **Presets Drawer & Side-by-Side Comparison**: Saving opens an inline save bar/modal writing via `POST /api/simulations` (with `PUT` for updates and `DELETE` for removal). Comparison selectors bind **Scenario A** and **Scenario B** (either active sandbox or any saved preset), run both through the identical dispatch engine, and render KPI deltas plus dual-series Recharts comparison plots.

### Key Physics & Lifecycle Sequence

1. **Input Assembly**: Resolve 24 or 72 hourly input vectors from either the Parametric weather/load/outage/ToU generator or the user's Fabricated Data table.
2. **Iterative Energy Balance**: Step sequentially from `h = 0` to `N - 1`, propagating battery SOC (`kWh`) across hours while strictly enforcing inverter ratings, battery C-rates, minimum reserve SOC, Net-Metering availability, export caps, and the Permitted Grid Peak Capacity limit.
3. **KPI & Diagnostic Aggregation**: Compute totals (PV Yield, Self-Consumption %, Grid Independence %, Peak Grid Import vs. Permitted Cap, Curtailed PV kWh, Unserved Load kWh, Outage Survival Hours, Minimum SOC %, Net Energy Bill BDT) and emit structured diagnostics whenever limits are hit.
4. **Preset Persistence**: Serialize `SimulationConfig` + summary snapshot to SQLite via `/api/simulations` so saved scenarios reload deterministically at any time.
