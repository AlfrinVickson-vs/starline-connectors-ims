import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { inventoryAPI, reportsAPI } from '../api/apiService';
import StatsCard from '../components/UI/StatsCard';
import Badge from '../components/UI/Badge';
import { PackageOpen, ShieldCheck, Factory, Archive, Clock, CheckCircle, XCircle, AlertCircle, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STAGE_CONFIG = {
  inventory_manager:  { stage: 'inventory_entry', label: 'Awaiting QC Submission', icon: <PackageOpen size={20} /> },
  qc_inspector:       { stage: 'qc_incoming',     label: 'Awaiting QC Review',     icon: <ShieldCheck size={20} /> },
  production_manager: { stage: 'production',      label: 'In Production',           icon: <Factory size={20} /> },
  admin:              { stage: 'qc_outgoing',     label: 'Awaiting Final QC',       icon: <Archive size={20} /> },
};

const Dashboard = () => {
  const { user } = useAuth();
  const [summary,       setSummary]       = useState(null);
  const [pendingItems,  setPendingItems]  = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingItems,   setLoadingItems]   = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const { data } = await reportsAPI.summary();
        setSummary(data.summary);
      } catch { /* silent */ }
      finally { setLoadingSummary(false); }
    };

    const fetchPending = async () => {
      const config = STAGE_CONFIG[user?.role] || STAGE_CONFIG.admin;
      try {
        const { data } = await inventoryAPI.byStage(config.stage);
        setPendingItems(data.items.slice(0, 8));
      } catch { /* silent */ }
      finally { setLoadingItems(false); }
    };

    fetchSummary();
    fetchPending();
  }, [user?.role]);

  const stageTotal = (stage) => summary?.[stage]?.total || 0;
  const config = STAGE_CONFIG[user?.role] || STAGE_CONFIG.admin;

  const kpiCards = [
    { title: 'Inventory Entry',    value: stageTotal('inventory_entry'), color: 'slate',   icon: <PackageOpen size={20} />,  subtitle: 'Items received' },
    { title: 'In QC (Incoming)',   value: stageTotal('qc_incoming'),     color: 'amber',   icon: <ShieldCheck size={20} />,  subtitle: 'Awaiting QC review' },
    { title: 'In Production',      value: stageTotal('production'),      color: 'brand',   icon: <Factory size={20} />,      subtitle: 'Being manufactured' },
    { title: 'QC (Outgoing)',      value: stageTotal('qc_outgoing'),     color: 'violet',  icon: <ShieldCheck size={20} />,  subtitle: 'Final quality check' },
    { title: 'Finished Goods',     value: stageTotal('finished_goods'),  color: 'emerald', icon: <Archive size={20} />,      subtitle: 'Ready for invoicing' },
    {
      title: 'Rejected Today',
      value: Object.values(summary || {}).reduce((sum, s) => sum + (s.rejected || 0), 0),
      color: 'red',
      icon: <XCircle size={20} />,
      subtitle: 'Total rejections',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="page-title">
          Good morning, <span className="text-gradient">{user?.name?.split(' ')[0]}</span>
        </h2>
        <p className="page-subtitle">Here's what needs your attention today.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <StatsCard key={card.title} {...card} loading={loadingSummary} />
        ))}
      </div>

      {/* Super Admin Quick Actions */}
      {user?.role === 'super_admin' && (
        <div className="card p-5 border-brand-500/30 shadow-lg shadow-brand-500/10">
          <h3 className="section-title flex items-center gap-2 mb-4">
            <Settings size={18} className="text-brand-400" /> Super Admin Access
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link to="/settings" className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
                <Settings size={24} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Company Settings</h4>
                <p className="text-xs text-slate-500 mt-1">Configure company GSTIN, name, and details.</p>
              </div>
            </Link>
            
            <Link to="/settings" className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">User Management</h4>
                <p className="text-xs text-slate-500 mt-1">Add users, manage privileges, and reset passwords.</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Pending Items for this role */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500/15 text-brand-400 flex items-center justify-center">
            {config.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">{config.label}</h3>
            <p className="text-xs text-slate-500">Items pending your action</p>
          </div>
          <span className="ml-auto text-xs font-semibold bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full">
            {pendingItems.length}
          </span>
        </div>

        {loadingItems ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle size={36} className="mx-auto text-emerald-500 mb-3 opacity-60" />
            <p className="text-slate-400 text-sm font-medium">All caught up!</p>
            <p className="text-slate-600 text-xs mt-1">No items require your action right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {pendingItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/20 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <PackageOpen size={16} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{item.item_name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Clock size={11} />
                    Added {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    {item.batch_number && ` · Batch: ${item.batch_number}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={item.status} />
                  <span className="text-xs text-slate-500">{item.quantity} {item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stage pipeline visual */}
      <div className="card p-5">
        <h3 className="section-title flex items-center gap-2">
          <AlertCircle size={16} className="text-brand-400" /> Pipeline Overview
        </h3>
        <div className="flex items-stretch gap-2 mt-4 overflow-x-auto pb-2">
          {[
            { label: 'Inventory Entry',  stage: 'inventory_entry', color: 'slate' },
            { label: 'QC Incoming',      stage: 'qc_incoming',     color: 'amber' },
            { label: 'Production',       stage: 'production',      color: 'blue' },
            { label: 'QC Outgoing',      stage: 'qc_outgoing',     color: 'violet' },
            { label: 'Finished Goods',   stage: 'finished_goods',  color: 'emerald' },
          ].map((s, idx, arr) => {
            const count = stageTotal(s.stage);
            return (
              <div key={s.stage} className="flex items-stretch gap-2 flex-1 min-w-[120px]">
                <div className="flex-1 bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/30">
                  <p className="text-2xl font-bold text-slate-100">{loadingSummary ? '—' : count}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-tight">{s.label}</p>
                </div>
                {idx < arr.length - 1 && (
                  <div className="flex items-center text-slate-700 text-lg self-center flex-shrink-0">›</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
