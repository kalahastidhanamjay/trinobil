import { useId } from 'react';
import { Input } from '@/components/ui';
import { useSettings } from '@/lib/queries';

/** "18", "0.25", "40": a GST % from 0 to 100 with up to 2 decimals. */
export const isGstRate = (v: string) => /^\d{1,3}(\.\d{1,2})?$/.test(v.trim()) && Number(v) <= 100;

/**
 * GST % typed by the shop (slabs change with the law, so no rates are built in). Suggests only the rates
 * this shop has set in its GST rates list.
 */
export function GstInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const list = useId();
  const rates = (useSettings().data as { gstRates?: number[] } | undefined)?.gstRates ?? [];
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        list={rates.length ? list : undefined}
        placeholder="e.g. 18"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        className={className ? `pr-7 ${className}` : 'pr-7'}
        aria-invalid={value !== '' && !isGstRate(value)}
      />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-slate-400">%</span>
      {rates.length > 0 && (
        <datalist id={list}>
          {rates.map((r) => <option key={r} value={String(r)} />)}
        </datalist>
      )}
    </div>
  );
}
