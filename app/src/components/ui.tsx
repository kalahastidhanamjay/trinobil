import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

// ---------------------------------------------------------------- buttons

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  busy?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', busy, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-7 px-2.5 text-xs',
        size === 'md' && 'h-8 px-3 text-[13px]',
        size === 'lg' && 'h-11 px-5 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-900',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-800 shadow-xs hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-200/60',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
        className,
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- form

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

/** Full width unless the caller sets a width. */
const width = (className?: string) => !/(^|\s)w-/.test(className ?? '') && 'w-full';

const inputClass =
  'block h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} {...rest} className={clsx(inputClass, width(className), className)} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={clsx(inputClass, width(className), 'pr-7', className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={clsx(inputClass, width(className), 'h-auto min-h-16 py-1.5', className)} />;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start justify-between gap-4 rounded-md px-1 py-1.5 text-left">
      <span>
        <span className="block text-[13px] font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
      <span className={clsx('relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300')}>
        <span className={clsx('absolute top-0.5 size-4 rounded-full bg-white shadow transition', checked ? 'left-4.5' : 'left-0.5')} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- layout bits

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('flex justify-center py-8', className)}>
      <Loader2 className="size-5 animate-spin text-brand-600" />
    </div>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-2 text-slate-300">{icon}</div>}
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-slate-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

const tones = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  indigo: 'bg-brand-50 text-brand-700 ring-brand-200',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset', tones[tone])}>{children}</span>;
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <Card className="relative overflow-hidden px-3.5 py-3">
      <span className="absolute inset-y-0 left-0 w-1 bg-brand-500" />
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-400 [&>svg]:size-4">{icon}</span>}
      </div>
      <p className="num mt-1 text-xl font-bold tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------- table

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="min-w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 [&>tr:hover]:bg-brand-50/50">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return <td className={clsx('px-3 py-1.5 align-middle', right && 'num text-right', className)}>{children}</td>;
}

// ---------------------------------------------------------------- dialogs

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-center justify-between bg-chrome px-4 py-2.5 text-white">
          <h2 className="text-sm font-bold">{title}</h2>
          <button onClick={onClose} className="flex items-center gap-1.5 rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <kbd className="border-white/20 bg-white/10 text-slate-300 shadow-none">Esc</kbd>
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx('rounded px-2.5 py-1 text-xs font-semibold transition', value === o.value ? 'bg-chrome text-white' : 'text-slate-500 hover:text-slate-800')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
