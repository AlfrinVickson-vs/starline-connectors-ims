import { useState, useEffect } from 'react';
import { reportsAPI } from '../api/apiService';
import StatsCard from '../components/UI/StatsCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const STAGE_LABELS = {
  inventory_entry: 'Inventory',
  qc_incoming:     'QC In',
  production:      'Production',
  qc_outgoing:     'QC Out',
  finished_goods:  'Finished',
};

const COLORS = ['#6366f1','#f59e0b','#3b82f6','#8b5cf6','#22c55e'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-xl p-3 text-xs shadow-xl">
      <p className="font-semibold text-slate-200 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const Reports = () => {
  const [summary,    setSummary]    = useState(null);
  const [avgTime,    setAvgTime]    = useState([]);
  const [rejection,  setRejection]  = useState([]);
  const [invoiceSumm,setInvoiceSumm]= useState([]);
  const [throughput, setThroughput] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [days,       setDays]       = useState(30);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, a, r, i, t] = await Promise.all([
        reportsAPI.summary(),
        reportsAPI.avgTime(),
        reportsAPI.rejectionRate(),
        reportsAPI.invoicesSummary(),
        reportsAPI.throughput(days),
      ]);
      setSummary(s.data.summary);
      setAvgTime(a.data.data);
      setRejection(r.data.data);
      setInvoiceSumm(i.data.data);
      setThroughput(t.data.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [days]);

  const stageBarData = summary
    ? Object.entries(summary).map(([stage, counts]) => ({
        stage: STAGE_LABELS[stage] || stage,
        Total:    counts.total    || 0,
        Approved: counts.approved || 0,
        Rejected: counts.rejected || 0,
        Pending:  counts.pending  || 0,
      }))
    : [];

  const avgTimeData = avgTime.map((row) => ({
    stage: STAGE_LABELS[row.stage] || row.stage,
    'Avg Hours': parseFloat(row.avg_hours || 0).toFixed(1),
  }));

  const rejectionData = rejection.map((row) => ({
    stage: STAGE_LABELS[row.stage] || row.stage,
    'Rejection %': parseFloat(row.rejection_rate_pct || 0),
    Total: parseInt(row.total, 10),
    Rejections: parseInt(row.rejections, 10),
  }));

  const invoicePieData = invoiceSumm.map((row) => ({
    name:  row.status.charAt(0).toUpperCase() + row.status.slice(1),
    value: parseInt(row.count, 10),
    total: parseFloat(row.total_value),
  }));

  const totalInvoiceValue = invoicePieData.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Reports & Analytics</h2>
          <p className="page-subtitle">Pipeline performance and invoice metrics</p>
        </div>
        <button onClick={fetchAll} className="btn-ghost">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            title: 'Total Items',
            value: summary ? Object.values(summary).reduce((s, v) => s + (v.total || 0), 0) : '—',
            color: 'brand', icon: <BarChart3 size={20} />,
          },
          {
            title: 'Finished Goods',
            value: summary?.finished_goods?.total || '—',
            color: 'emerald', icon: <BarChart3 size={20} />,
          },
          {
            title: 'Total Rejection',
            value: rejection.reduce((s, r) => s + parseInt(r.rejections || 0, 10), 0),
            color: 'red', icon: <AlertTriangle size={20} />,
          },
          {
            title: 'Invoice Value',
            value: `₹${totalInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            color: 'violet', icon: <BarChart3 size={20} />,
          },
        ].map((card) => (
          <StatsCard key={card.title} {...card} loading={loading} />
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Distribution */}
        <div className="card p-5">
          <h3 className="section-title flex items-center gap-2">
            <BarChart3 size={16} className="text-brand-400" /> Items Per Stage
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stageBarData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Approved" fill="#22c55e" radius={[4,4,0,0]} />
              <Bar dataKey="Pending"  fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="Rejected" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Invoice Status Pie */}
        <div className="card p-5">
          <h3 className="section-title flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-400" /> Invoice Status
          </h3>
          {invoicePieData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-slate-500 text-sm">No invoice data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={invoicePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  dataKey="value" nameKey="name" paddingAngle={4} label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}>
                  {invoicePieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val, name, props) => [`${val} invoices`, name]} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avg Time per Stage */}
        <div className="card p-5">
          <h3 className="section-title flex items-center gap-2">
            <Clock size={16} className="text-amber-400" /> Avg Time Per Stage (Hours)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={avgTimeData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Avg Hours" fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rejection Rate */}
        <div className="card p-5">
          <h3 className="section-title flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" /> Rejection Rate per Stage (%)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rejectionData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Rejection %" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Throughput Line Chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title mb-0 flex items-center gap-2">
            <BarChart3 size={16} className="text-brand-400" /> Daily Throughput
          </h3>
          <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700/40">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${days === d ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {throughput.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No throughput data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={throughput} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="approved" stroke="#22c55e" strokeWidth={2} dot={false} name="Approved" />
              <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} dot={false} name="Rejected" />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default Reports;
