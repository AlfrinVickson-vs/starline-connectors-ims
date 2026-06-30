import { useState, useEffect, useCallback } from 'react';
import { reportsAPI } from '../api/apiService';
import StatsCard from '../components/UI/StatsCard';
import Table from '../components/UI/Table';
import Badge from '../components/UI/Badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  BarChart3, Clock, AlertTriangle, RefreshCw, FileSpreadsheet,
  Download, Search, Filter, Calendar, Layers, Activity, CheckCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

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

// ── Styled Excel Export Helper (HTML XML format) ──────────────────────────────
const downloadExcel = (data, headers, filename) => {
  const escapeHtml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>';
  html += '<body><table border="1">';
  
  // Headers row with styled color (#4f46e5 / Indigo)
  html += '<tr style="background-color: #4f46e5; color: #ffffff; font-weight: bold;">';
  headers.forEach(h => {
    html += `<th>${escapeHtml(h.label)}</th>`;
  });
  html += '</tr>';
  
  // Data rows
  data.forEach(row => {
    html += '<tr>';
    headers.forEach(h => {
      const val = typeof h.extract === 'function' ? h.extract(row) : row[h.key];
      html += `<td>${val === undefined || val === null ? '—' : escapeHtml(val)}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</table></body></html>';
  
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_export_${new Date().toISOString().split('T')[0]}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const Reports = () => {
  // Tab control
  const [activeTab, setActiveTab] = useState('overview'); // overview, inventory, production, quality, finished
  
  // Overview states
  const [summary,    setSummary]    = useState(null);
  const [avgTime,    setAvgTime]    = useState([]);
  const [rejection,  setRejection]  = useState([]);
  const [invoiceSumm,setInvoiceSumm]= useState([]);
  const [throughput, setThroughput] = useState([]);
  const [days,       setDays]       = useState(30);

  // Detailed report states
  const [detailData, setDetailData] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [varFilter, setVarFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');

  // Fetch Overview Data
  const fetchOverview = async () => {
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
    } catch { 
      toast.error('Failed to load summary reports'); 
    } finally { 
      setLoading(false); 
    }
  };

  // Fetch Detailed Report Data based on active tab
  const fetchDetailedReport = useCallback(async (tab) => {
    setLoading(true);
    setSearch('');
    setStatusFilter('');
    setVarFilter('');
    try {
      let res;
      if (tab === 'inventory') res = await reportsAPI.inventoryDetail();
      else if (tab === 'production') res = await reportsAPI.productionDetail();
      else if (tab === 'quality') res = await reportsAPI.qualityDetail();
      else if (tab === 'finished') res = await reportsAPI.finishedGoodsDetail();
      
      if (res) setDetailData(res.data.data);
    } catch {
      toast.error(`Failed to load detailed ${tab} report`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect to manage tab loading
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverview();
    } else {
      fetchDetailedReport(activeTab);
    }
  }, [activeTab, days, fetchDetailedReport]);

  const handleRefresh = () => {
    if (activeTab === 'overview') fetchOverview();
    else fetchDetailedReport(activeTab);
  };

  // ── Overview calculations ──────────────────────────────────────────────────
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

  // ── Detailed Table Filters & Configs ───────────────────────────────────────
  
  // 1. Filtered Data logic
  const filteredDetail = detailData.filter((item) => {
    const query = search.toLowerCase();
    
    // Text search matching
    const matchesSearch = !search ||
      (item.item_name && item.item_name.toLowerCase().includes(query)) ||
      (item.sku && item.sku.toLowerCase().includes(query)) ||
      (item.variant && item.variant.toLowerCase().includes(query)) ||
      (item.operator_name && item.operator_name.toLowerCase().includes(query));

    // Status filter matching
    const matchesStatus = !statusFilter || item.status === statusFilter;
    
    // Variant / Category filter matching
    const matchesVariant = !varFilter || item.variant === varFilter;

    // Date range filter matching
    const matchesDate = (() => {
      if (!startDate && !endDate) return true;
      let itemDateStr = '';
      if (activeTab === 'inventory') itemDateStr = item.received_date;
      else if (activeTab === 'production') itemDateStr = item.started_at;
      else if (activeTab === 'quality') itemDateStr = item.changed_at;
      else if (activeTab === 'finished') itemDateStr = item.approved_date;
      
      if (!itemDateStr) return false;
      
      const itemDate = new Date(itemDateStr);
      itemDate.setHours(0,0,0,0);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        if (itemDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(0,0,0,0);
        if (itemDate > end) return false;
      }
      return true;
    })();

    return matchesSearch && matchesStatus && matchesVariant && matchesDate;
  });

  // Extract unique variants/categories in the current dataset for filtering dropdowns
  const uniqueVariants = Array.from(new Set(detailData.map(i => i.variant).filter(Boolean)));

  // Excel download trigger
  const handleExport = () => {
    if (filteredDetail.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    let csvHeaders = [];
    let filename = '';

    if (activeTab === 'inventory') {
      filename = 'inventory_report';
      csvHeaders = [
        { label: 'Product Name', key: 'item_name' },
        { label: 'SKU', key: 'sku' },
        { label: 'Variant', key: 'variant' },
        { label: 'Quantity', extract: (r) => `${r.quantity} ${r.unit}` },
        { label: 'Stage', extract: (r) => r.current_stage.replace(/_/g, ' ') },
        { label: 'Status', key: 'status' },
        { label: 'Received Date', extract: (r) => r.received_date ? format(new Date(r.received_date), 'yyyy-MM-dd') : '—' },
        { label: 'Added By', key: 'created_by_name' }
      ];
    } else if (activeTab === 'production') {
      filename = 'production_report';
      csvHeaders = [
        { label: 'Product Name', key: 'item_name' },
        { label: 'SKU', key: 'sku' },
        { label: 'Variant', key: 'variant' },
        { label: 'Quantity', extract: (r) => `${r.quantity} ${r.unit}` },
        { label: 'Status', key: 'status' },
        { label: 'Started Production', extract: (r) => format(new Date(r.started_at), 'yyyy-MM-dd HH:mm') },
        { label: 'Added By', key: 'created_by_name' }
      ];
    } else if (activeTab === 'quality') {
      filename = 'quality_report';
      csvHeaders = [
        { label: 'Product Name', key: 'item_name' },
        { label: 'SKU', key: 'sku' },
        { label: 'Variant', key: 'variant' },
        { label: 'Qty Transitioned', extract: (r) => `${r.quantity} ${r.unit}` },
        { label: 'Action Result', key: 'status' },
        { label: 'Operator Name', key: 'operator_name' },
        { label: 'Operator Role', key: 'operator_role' },
        { label: 'Date Time', extract: (r) => format(new Date(r.changed_at), 'yyyy-MM-dd HH:mm') },
        { label: 'Comments / Notes', key: 'comments' }
      ];
    } else if (activeTab === 'finished') {
      filename = 'finished_goods_report';
      csvHeaders = [
        { label: 'Product Name', key: 'item_name' },
        { label: 'SKU', key: 'sku' },
        { label: 'Variant', key: 'variant' },
        { label: 'Quantity', extract: (r) => `${r.quantity} ${r.unit}` },
        { label: 'Approved Date', extract: (r) => format(new Date(r.approved_date), 'yyyy-MM-dd') },
        { label: 'Batch Reference', key: 'batch_reference' },
        { label: 'Status', extract: (r) => r.ready_for_invoice ? 'Ready for Invoice' : 'Invoiced' }
      ];
    }

    downloadExcel(filteredDetail, csvHeaders, filename);
    toast.success('Report downloaded successfully');
  };

  // Define Table Column configurations dynamically
  const getTableColumns = () => {
    if (activeTab === 'inventory') {
      return [
        { key: 'item_name', label: 'Product Name', render: (v, r) => (
          <div>
            <p className="font-semibold text-slate-200">{v}</p>
            {r.variant && <p className="text-[10px] text-slate-500 font-mono mt-0.5">{r.variant}</p>}
          </div>
        )},
        { key: 'sku', label: 'SKU', render: (v) => v || '—' },
        { key: 'quantity', label: 'Quantity', render: (v, r) => `${v} ${r.unit}` },
        { key: 'current_stage', label: 'Stage', render: (v) => <Badge variant={v} /> },
        { key: 'status', label: 'Status', render: (v) => <Badge variant={v} /> },
        { key: 'received_date', label: 'Received', render: (v) => v ? format(new Date(v), 'dd MMM yyyy') : '—' },
        { key: 'created_by_name', label: 'Added By', render: (v, r) => `${v} (#${r.created_by})` }
      ];
    }
    
    if (activeTab === 'production') {
      return [
        { key: 'item_name', label: 'Product Name', render: (v, r) => (
          <div>
            <p className="font-semibold text-slate-200">{v}</p>
            {r.variant && <p className="text-[10px] text-slate-500 font-mono mt-0.5">{r.variant}</p>}
          </div>
        )},
        { key: 'sku', label: 'SKU', render: (v) => v || '—' },
        { key: 'quantity', label: 'Quantity', render: (v, r) => `${v} ${r.unit}` },
        { key: 'status', label: 'Status', render: (v) => <Badge variant={v} /> },
        { key: 'started_at', label: 'Started Production', render: (v) => format(new Date(v), 'dd MMM yyyy, HH:mm') },
        { key: 'created_by_name', label: 'Added By', render: (v, r) => `${v} (#${r.created_by})` }
      ];
    }
    
    if (activeTab === 'quality') {
      return [
        { key: 'item_name', label: 'Product Name', render: (v, r) => (
          <div>
            <p className="font-semibold text-slate-200">{v}</p>
            {r.variant && <p className="text-[10px] text-slate-500 font-mono mt-0.5">{r.variant}</p>}
          </div>
        )},
        { key: 'sku', label: 'SKU', render: (v) => v || '—' },
        { key: 'quantity', label: 'Qty Actioned', render: (v, r) => `${v} ${r.unit}` },
        { key: 'status', label: 'Action Result', render: (v) => <Badge variant={v} /> },
        { key: 'operator_name', label: 'Actioned By', render: (v, r) => (
          <div>
            <p className="text-slate-300 font-medium">{v} (#{r.changed_by})</p>
            <p className="text-[10px] text-slate-500 capitalize">{r.operator_role?.replace(/_/g, ' ')}</p>
          </div>
        )},
        { key: 'changed_at', label: 'Date Time', render: (v) => format(new Date(v), 'dd MMM yyyy, HH:mm') },
        { key: 'comments', label: 'Comments / Notes', render: (v) => (
          <p className="max-w-xs truncate text-slate-400" title={v}>{v || '—'}</p>
        )}
      ];
    }
    
    if (activeTab === 'finished') {
      return [
        { key: 'item_name', label: 'Product Name', render: (v, r) => (
          <div>
            <p className="font-semibold text-slate-200">{v}</p>
            {r.variant && <p className="text-[10px] text-slate-500 font-mono mt-0.5">{r.variant}</p>}
          </div>
        )},
        { key: 'sku', label: 'SKU', render: (v) => v || '—' },
        { key: 'quantity', label: 'Quantity Approved', render: (v, r) => `${v} ${r.unit}` },
        { key: 'approved_date', label: 'Approved Date', render: (v) => format(new Date(v), 'dd MMM yyyy') },
        { key: 'batch_reference', label: 'Batch Ref', render: (v) => v || '—' },
        { key: 'ready_for_invoice', label: 'Status', render: (v) => (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            v ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-400'
          }`}>
            {v ? 'Ready for Invoice' : 'Invoiced'}
          </span>
        )}
      ];
    }
    return [];
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Reports & Analytics</h2>
          <p className="page-subtitle">Production pipeline audit logs and metric sheets</p>
        </div>
        <button onClick={handleRefresh} className="btn-ghost" title="Refresh Current Report">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl w-fit border border-slate-800/60 flex-wrap">
        {[
          { key: 'overview', label: 'Overview Metrics' },
          { key: 'inventory', label: 'Inventory Sheet' },
          { key: 'production', label: 'Production Log' },
          { key: 'quality', label: 'QC Quality Log' },
          { key: 'finished', label: 'Finished Goods Sheet' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW METRICS TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                title: 'Total Items',
                value: summary ? Object.values(summary).reduce((s, v) => s + (v.total || 0), 0) : '—',
                color: 'brand', icon: <Layers size={20} />,
              },
              {
                title: 'Finished Goods',
                value: summary?.finished_goods?.total || '—',
                color: 'emerald', icon: <CheckCircle size={20} />,
              },
              {
                title: 'Total Rejections',
                value: rejection.reduce((s, r) => s + parseInt(r.rejections || 0, 10), 0),
                color: 'red', icon: <AlertTriangle size={20} />,
              },
              {
                title: 'Invoice Value',
                value: `₹${totalInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                color: 'violet', icon: <FileSpreadsheet size={20} />,
              },
            ].map((card) => (
              <StatsCard key={card.title} {...card} loading={loading} />
            ))}
          </div>

          {/* Charts block 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Items distribution */}
            <div className="card p-5">
              <h3 className="section-title flex items-center gap-2">
                <Activity size={16} className="text-brand-400" /> Pipeline Stage Distribution
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

            {/* Invoices Pie */}
            <div className="card p-5">
              <h3 className="section-title flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-violet-400" /> Invoice Breakdown
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
                    <Tooltip formatter={(val, name) => [`${val} invoices`, name]} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Charts block 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Avg stage timings */}
            <div className="card p-5">
              <h3 className="section-title flex items-center gap-2">
                <Clock size={16} className="text-amber-400" /> Avg processing duration (Hours)
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

            {/* Rejection rate stage stats */}
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

          {/* Throughput chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title mb-0 flex items-center gap-2">
                <Activity size={16} className="text-brand-400" /> Daily QC Performance
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
      )}

      {/* ── DETAILED TABLE REPORTS TABS (INVENTORY, PRODUCTION, QUALITY, FINISHED) ── */}
      {activeTab !== 'overview' && (
        <div className="space-y-4 animate-in">
          {/* Controls row */}
          <div className="card p-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1 min-w-80">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search table rows…"
                  className="input pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Dynamic Status Dropdown Filter */}
              {['inventory', 'production', 'quality'].includes(activeTab) && (
                <select
                  className="select w-36"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  {activeTab === 'production' && <option value="in_progress">In Progress</option>}
                </select>
              )}

              {/* Dynamic Variant Filter */}
              {uniqueVariants.length > 0 && (
                <select
                  className="select w-44"
                  value={varFilter}
                  onChange={(e) => setVarFilter(e.target.value)}
                >
                  <option value="">All Variants</option>
                  {uniqueVariants.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}

              {/* Date Range Calendar Filters */}
              <div className="flex items-center gap-1.5 bg-slate-800/40 border border-slate-700/50 rounded-xl px-2.5 py-1.5">
                <Calendar size={13} className="text-slate-500" />
                <input
                  type="date"
                  className="bg-transparent border-0 text-xs text-slate-300 focus:ring-0 p-0 w-28 cursor-pointer"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="From Date"
                  title="From Date"
                />
                <span className="text-xs text-slate-600">—</span>
                <input
                  type="date"
                  className="bg-transparent border-0 text-xs text-slate-300 focus:ring-0 p-0 w-28 cursor-pointer"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="To Date"
                  title="To Date"
                />
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-slate-500 hover:text-slate-300 transition-colors ml-1 p-0.5 hover:bg-slate-800 rounded"
                    title="Clear Date Filter"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Export trigger */}
            <button
              onClick={handleExport}
              className="btn-success text-xs font-semibold gap-2 py-2.5 shadow-lg shadow-emerald-600/10"
              id="export-csv-btn"
            >
              <Download size={14} /> Export to Excel / CSV
            </button>
          </div>

          {/* Table list */}
          <Table
            columns={getTableColumns()}
            data={filteredDetail}
            loading={loading}
            emptyText={`No entries matched the criteria for ${activeTab.replace(/_/g, ' ')} report.`}
          />
        </div>
      )}
    </div>
  );
};

export default Reports;
