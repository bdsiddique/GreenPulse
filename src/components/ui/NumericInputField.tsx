import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumericInputFieldProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: string;
}

export const NumericInputField: React.FC<NumericInputFieldProps> = ({
  label,
  value,
  unit,
  min,
  max,
  step = 0.5,
  onChange,
  disabled = false,
  hint,
}) => {
  const decimals = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
  const formatVal = (n: number) => (decimals > 0 ? n.toFixed(decimals) : String(Math.round(n)));

  const [text, setText] = useState(formatVal(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatVal(value));
    }
  }, [value, focused, decimals]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (Number.isNaN(parsed) || raw.trim() === '') {
      setText(formatVal(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    const rounded = Number(clamped.toFixed(Math.max(decimals, 2)));
    onChange(rounded);
    setText(formatVal(rounded));
  };

  const nudge = (dir: -1 | 1) => {
    if (disabled) return;
    const next = Math.max(min, Math.min(max, Number((value + dir * step).toFixed(2))));
    onChange(next);
    setText(formatVal(next));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-700 truncate">{label}</label>
        <span className="font-mono text-[10px] text-slate-400 shrink-0">
          {min}–{max} {unit}
        </span>
      </div>
      <div
        className={`flex items-center rounded-lg border bg-white transition-colors ${
          disabled
            ? 'border-slate-200 bg-slate-50 opacity-60'
            : focused
              ? 'border-slate-900 ring-1 ring-slate-900/15'
              : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => nudge(-1)}
          aria-label={`Decrease ${label}`}
          className="h-8 w-7 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 rounded-l-lg border-r border-slate-200 shrink-0 transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit(text);
          }}
          onChange={(e) => {
            const nextText = e.target.value;
            setText(nextText);
            const parsed = Number(nextText);
            if (
              nextText.trim() !== '' &&
              !Number.isNaN(parsed) &&
              parsed >= min &&
              parsed <= max
            ) {
              onChange(parsed);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit(text);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              nudge(1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              nudge(-1);
            }
          }}
          className="w-full min-w-0 h-8 px-2.5 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 bg-transparent focus:outline-none"
        />
        <span className="pr-2.5 pl-1 font-mono text-[11px] text-slate-500 select-none shrink-0">
          {unit}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => nudge(1)}
          aria-label={`Increase ${label}`}
          className="h-8 w-7 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 rounded-r-lg border-l border-slate-200 shrink-0 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      {hint && <p className="text-[11px] text-slate-500 leading-snug">{hint}</p>}
    </div>
  );
};

interface SwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const SwitchRow: React.FC<SwitchRowProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => (
  <div className={`flex items-start justify-between gap-3 py-1 ${disabled ? 'opacity-50' : ''}`}>
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-800">{label}</div>
      {description && (
        <div className="text-[11px] text-slate-500 leading-snug">{description}</div>
      )}
    </div>
    <button
      type="button"
      role="switch"
      disabled={disabled}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
        checked ? 'bg-slate-900' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);
