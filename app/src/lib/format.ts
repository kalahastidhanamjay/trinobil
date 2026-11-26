const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

export const money = (v?: number | null) => inr.format(v ?? 0);

/** 2, 2.5, 0.125 - no trailing zeros. */
export const qty = (v?: number | null) => String(Number((v ?? 0).toFixed(3)));

export const date = (iso?: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const dateTime = (iso?: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');
export const time = (iso?: string | null) => (iso ? timeFmt.format(new Date(iso)) : '');

/** yyyy-MM-dd in local time. */
export function isoDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export const paymentLabels: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  CREDIT: 'Credit (pay later)',
  SPLIT: 'Split',
  OTHER: 'Other',
};

export const units: Record<string, string> = {
  PCS: 'Pieces',
  KG: 'Kilogram',
  G: 'Gram',
  L: 'Litre',
  ML: 'Millilitre',
  M: 'Metre',
  BOX: 'Box',
  PACK: 'Pack',
  DOZ: 'Dozen',
};

export const gstSlabs = [0, 5, 12, 18, 28];
