import { memo, type ReactNode, type CSSProperties } from 'react';

// ─── Donut ───
interface DonutProps { pct: number; color: string; size?: number; stroke?: number; }
export const Donut = memo(function Donut({ pct, color, size = 56, stroke = 7 }: DonutProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf0" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
    </svg>
  );
});

// ─── Pagination ───
interface PaginationProps { page: number; totalPages: number; onPageChange: (p: number) => void; }
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="pagination__btn" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}>← Anterior</button>
      <span className="pagination__info">Pág {page + 1} / {totalPages}</span>
      <button className="pagination__btn" onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>Siguiente →</button>
    </div>
  );
}

// ─── EmptyState ───
interface EmptyStateProps { icon?: string; title?: string; message?: string; }
export function EmptyState({ icon = '🔍', title = 'Sin resultados', message }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3 className="empty-state__title">{title}</h3>
      {message && <p className="empty-state__message">{message}</p>}
    </div>
  );
}

// ─── Loading ───
interface LoadingProps { message?: string; }
export function Loading({ message = 'Cargando...' }: LoadingProps) {
  return (
    <div className="loading">
      <div className="loading__spinner" />
      <span className="loading__text">{message}</span>
    </div>
  );
}

// ─── KPI ───
interface KPIProps { value: string | number; label: string; color?: string; subtitle?: string; }
export function KPI({ value, label, color, subtitle }: KPIProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__value" style={{ color: color || 'var(--blue-800)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="kpi-card__label">{label}</div>
      {subtitle && <div className="kpi-card__sub">{subtitle}</div>}
    </div>
  );
}

// ─── BarChart ───
interface BarChartProps { value: number; max: number; color?: string; label: string; height?: number; }
export function BarChart({ value, max, color, label, height = 16 }: BarChartProps) {
  const width = max ? (value / max) * 100 : 0;
  return (
    <div className="bar-chart">
      <div className="bar-chart__header">
        <span className="bar-chart__label">{label}</span>
        <span className="bar-chart__value">{value}</span>
      </div>
      <div className="bar-chart__track" style={{ height }}>
        <div className="bar-chart__fill" style={{ width: `${width}%`, background: color || 'var(--blue-500)' }} />
      </div>
    </div>
  );
}

// ─── Badge ───
interface BadgeProps {
  children: ReactNode; color?: string; bg?: string; border?: string;
  small?: boolean; onClick?: () => void;
}
export function Badge({ children, color, bg, border, small = false, onClick }: BadgeProps) {
  const style: CSSProperties = {
    ...(color && { color }), ...(bg && { background: bg }), ...(border && { borderColor: border }),
  };
  return (
    <span className={`badge ${small ? 'badge--sm' : ''} ${onClick ? 'badge--clickable' : ''}`}
      style={style} onClick={onClick}>{children}</span>
  );
}
