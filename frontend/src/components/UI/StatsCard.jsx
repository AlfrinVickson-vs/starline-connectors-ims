import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * KPI card for dashboards and reports.
 *
 * @param {string}    title
 * @param {string|number} value
 * @param {string}    [subtitle]
 * @param {ReactNode} [icon]
 * @param {string}    [trend]   - 'up' | 'down' | 'neutral'
 * @param {string}    [trendLabel]
 * @param {string}    [color]   - 'brand' | 'emerald' | 'amber' | 'red' | 'violet'
 * @param {boolean}   [loading]
 */
const COLOR_MAP = {
  brand:   { bg: 'bg-brand-500/10',   icon: 'bg-brand-500/20 text-brand-400',   ring: 'ring-brand-500/20' },
  emerald: { bg: 'bg-emerald-500/10', icon: 'bg-emerald-500/20 text-emerald-400',ring: 'ring-emerald-500/20' },
  amber:   { bg: 'bg-amber-500/10',   icon: 'bg-amber-500/20 text-amber-400',   ring: 'ring-amber-500/20' },
  red:     { bg: 'bg-red-500/10',     icon: 'bg-red-500/20 text-red-400',       ring: 'ring-red-500/20' },
  violet:  { bg: 'bg-violet-500/10',  icon: 'bg-violet-500/20 text-violet-400', ring: 'ring-violet-500/20' },
  slate:   { bg: 'bg-slate-500/10',   icon: 'bg-slate-500/20 text-slate-400',   ring: 'ring-slate-500/20' },
};

const TrendIcon = ({ trend }) => {
  if (trend === 'up')      return <TrendingUp  size={12} className="text-emerald-400" />;
  if (trend === 'down')    return <TrendingDown size={12} className="text-red-400" />;
  return <Minus size={12} className="text-slate-500" />;
};

const StatsCard = ({ title, value, subtitle, icon, trend, trendLabel, color = 'brand', loading }) => {
  const colors = COLOR_MAP[color] || COLOR_MAP.brand;

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="h-3 w-24 bg-slate-800 rounded animate-pulse" />
            <div className="h-8 w-16 bg-slate-800 rounded animate-pulse" />
            <div className="h-3 w-32 bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="w-10 h-10 bg-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-5 hover:border-slate-700/60 transition-all duration-300 group`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
          <p className="text-3xl font-bold text-slate-100 leading-none mb-2">{value ?? '—'}</p>
          {(subtitle || trendLabel) && (
            <div className="flex items-center gap-1.5 mt-1">
              {trend && <TrendIcon trend={trend} />}
              <p className="text-xs text-slate-500 truncate">{trendLabel || subtitle}</p>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon} ring-1 ${colors.ring} group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
