import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { PriceStatus } from '../calc/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('bg-surface border border-line rounded-2xl shadow-card', className)}>{children}</div>;
}

export function StepHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[28px] sm:text-[32px] leading-tight font-bold tracking-[-0.256px]">{title}</h2>
      {sub && <p className="text-muted mt-1.5">{sub}</p>}
    </div>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold mt-8 mb-3">{children}</h3>;
}

/** Large selectable card (single or multi select). */
export function ChoiceCard({ selected, onClick, icon, title, desc, role = 'radio' }: {
  selected: boolean; onClick: () => void; icon?: ReactNode; title: string; desc?: string; role?: 'radio' | 'checkbox';
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        'text-left w-full min-h-11 rounded-xl border p-3.5 motion-safe:transition focus-visible:outline-2 focus-visible:outline-primary',
        selected ? 'border-primary bg-primary-soft ring-1 ring-primary' : 'border-line bg-surface hover:border-primary/40 hover:shadow-card',
      )}
    >
      <div className="flex items-start gap-3">
        {icon && <span className={cx('mt-0.5 shrink-0', selected ? 'text-primary' : 'text-muted')}>{icon}</span>}
        <span>
          <span className="block font-semibold text-sm">{title}</span>
          {desc && <span className="block text-xs text-muted mt-0.5">{desc}</span>}
        </span>
      </div>
    </button>
  );
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        'min-h-11 px-4 py-2.5 rounded-full border text-sm font-medium motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-primary',
        selected ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:border-primary/40',
      )}
    >
      {children}
    </button>
  );
}

export function NumberField({ label, value, onChange, step = 1, suffix, hint }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string; hint?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-medium text-muted mb-1">
        {label}
        {hint && <Hint text={hint} />}
      </span>
      <span className="flex items-center h-11 rounded-lg border border-line bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        <input
          type="number"
          min={0}
          step={step}
          value={Number.isFinite(value) ? +value.toFixed(4) : 0}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            if (Number.isFinite(v) && v >= 0) onChange(v);
          }}
          className="w-full bg-transparent px-3 text-sm tabular-nums outline-none"
        />
        {suffix && <span className="pr-3 text-xs text-muted whitespace-nowrap">{suffix}</span>}
      </span>
    </label>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className="w-full h-11 rounded-lg border border-line bg-surface px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Hint({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex" tabIndex={0} aria-label={text}>
      <Info size={13} className="text-muted" />
      <span role="tooltip" className="pointer-events-none absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 w-56 rounded-lg bg-brand-dark text-white text-xs shadow-float font-normal p-2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 z-20">
        {text}
      </span>
    </span>
  );
}

const STATUS: Record<PriceStatus, [string, string]> = {
  verified: ['Verified price', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
  estimate: ['Estimate', 'bg-amber-50 text-amber-800 border-amber-200'],
  user: ['Your price', 'bg-primary-soft text-primary border-primary/30'],
  unavailable: ['Price unavailable', 'bg-gray-100 text-gray-700 border-gray-300'],
};
export function StatusBadge({ status }: { status: PriceStatus }) {
  const [label, cls] = STATUS[status];
  return <span className={cx('inline-block text-[11px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap', cls)}>{label}</span>;
}

export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 min-h-11 rounded-full bg-primary text-white px-5 py-2.5 text-sm font-bold tracking-[0.2px] shadow-card hover:bg-primary-deep disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  secondary: 'inline-flex items-center justify-center gap-2 min-h-11 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:border-primary/50 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary',
  ghost: 'inline-flex items-center gap-1.5 min-h-9 rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary',
};
