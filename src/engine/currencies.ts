import type { CurrencyCode } from '../types/simulation';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number;
  defaultOffPeakRate: number;
  defaultPeakRate: number;
  defaultExportCreditRate: number;
}

export interface TariffBaseline {
  offPeakRate: number;
  peakRate: number;
  exportCreditRate: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  BDT: {
    code: 'BDT',
    symbol: '৳',
    name: 'Bangladeshi Taka',
    decimals: 0,
    defaultOffPeakRate: 7.5,
    defaultPeakRate: 14.2,
    defaultExportCreditRate: 6.2,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    decimals: 2,
    defaultOffPeakRate: 0.14,
    defaultPeakRate: 0.34,
    defaultExportCreditRate: 0.08,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    decimals: 2,
    defaultOffPeakRate: 0.22,
    defaultPeakRate: 0.42,
    defaultExportCreditRate: 0.11,
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    decimals: 0,
    defaultOffPeakRate: 6.5,
    defaultPeakRate: 11.8,
    defaultExportCreditRate: 4.5,
  },
};

export const CURRENCY_LIST: CurrencyCode[] = ['BDT', 'USD', 'EUR', 'INR'];

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  options?: { signed?: boolean; exactDecimals?: number }
): string {
  const meta = CURRENCIES[currency] || CURRENCIES.BDT;
  const decimals = options?.exactDecimals ?? meta.decimals;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = amount < -0.0001 ? '-' : options?.signed && amount > 0.0001 ? '+' : '';
  return `${sign}${meta.symbol}${formatted}`;
}

export function formatRate(rate: number, currency: CurrencyCode): string {
  const meta = CURRENCIES[currency] || CURRENCIES.BDT;
  return `${meta.symbol}${rate.toFixed(2)}/kWh`;
}
