const VARIANTS = {
  pending:        'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected:       'bg-red-500/15 text-red-400 border-red-500/30',
  in_progress:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  inventory_entry:'bg-slate-500/15 text-slate-400 border-slate-500/30',
  qc_incoming:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  production:     'bg-blue-500/15 text-blue-400 border-blue-500/30',
  qc_outgoing:    'bg-purple-500/15 text-purple-400 border-purple-500/30',
  finished_goods: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  draft:          'bg-slate-500/15 text-slate-400 border-slate-500/30',
  issued:         'bg-brand-500/15 text-brand-400 border-brand-500/30',
  paid:           'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled:      'bg-red-500/15 text-red-400 border-red-500/30',
};

const Badge = ({ variant = 'pending', label, className = '' }) => {
  const styles = VARIANTS[variant] || VARIANTS.pending;
  const displayLabel = label || variant.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles} ${className}`}
    >
      {displayLabel}
    </span>
  );
};

export default Badge;
