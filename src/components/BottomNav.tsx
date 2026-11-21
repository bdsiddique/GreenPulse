import React from 'react';
import { Activity, BookOpen, Calculator, SlidersHorizontal } from 'lucide-react';
import type { AppTab } from '../types/simulation';
import { useSimulationStore } from '../store/useSimulationStore';

interface NavItem {
  id: AppTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'simulations', label: 'Simulations', icon: Activity },
  { id: 'load_bill', label: 'Load & Bill', icon: Calculator },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, savedSimulations } = useSimulationStore();

  return (
    <nav
      aria-label="Primary workspace navigation"
      className="fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3"
    >
      <div className="max-w-2xl mx-auto h-full grid grid-cols-4 gap-1.5 items-center">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative h-10 rounded-lg flex items-center justify-center gap-1.5 px-2 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.id === 'library' && savedSimulations.length > 0 && (
                <span
                  className={`font-mono tabular-nums text-[11px] hidden sm:inline ${
                    isActive ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {savedSimulations.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
