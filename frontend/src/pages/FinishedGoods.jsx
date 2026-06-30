import { useState, useEffect, useCallback } from 'react';
import { finishedGoodsAPI } from '../api/apiService';
import Table  from '../components/UI/Table';
import Modal  from '../components/UI/Modal';
import toast  from 'react-hot-toast';
import { Archive, FileText, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const FinishedGoods = () => {
  const navigate = useNavigate();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('true'); // 'true' = ready, 'false' = invoiced, '' = all

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== '' ? { ready_for_invoice: filter } : {};
      const { data } = await finishedGoodsAPI.list(params);
      setItems(data.items);
    } catch { toast.error('Failed to load finished goods'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { key: 'item_name', label: 'Item Name', render: (v, row) => (
      <div>
        <p className="font-medium text-slate-200">{v}</p>
        {row.sku && <p className="text-xs text-slate-500 mt-0.5">SKU: {row.sku}</p>}
      </div>
    )},
    { key: 'quantity', label: 'Qty', render: (v, row) => `${v} ${row.unit}` },
    { key: 'batch_reference', label: 'Batch', render: (v) => v || '—' },
    { key: 'approved_date', label: 'Approved', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    { key: 'ready_for_invoice', label: 'Status', render: (v) => (
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${v ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
        {v ? 'Ready for Invoice' : 'Invoiced'}
      </span>
    )},
    { key: 'actions', label: '', render: (_, row) => (
      row.ready_for_invoice ? (
        <button
          onClick={() => navigate('/invoices', { state: { prefill_item_id: row.item_id, prefill_fg_id: row.id, prefill_item_name: row.item_name, prefill_quantity: row.quantity, prefill_unit: row.unit } })}
          className="btn-primary py-1.5 px-3 text-xs"
          id={`create-invoice-btn-${row.id}`}
        >
          <FileText size={13} /> Create Invoice
        </button>
      ) : (
        <span className="text-xs text-slate-600">—</span>
      )
    )},
  ];

  const readyCount    = items.filter((i) => i.ready_for_invoice).length;
  const invoicedCount = items.filter((i) => !i.ready_for_invoice).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Finished Goods</h2>
          <p className="page-subtitle">Items that have passed all QC stages</p>
        </div>
        <button onClick={fetch} className="btn-ghost">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Archive size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{readyCount}</p>
            <p className="text-xs text-slate-500">Ready for Invoice</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-700/50 text-slate-400 flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{invoicedCount}</p>
            <p className="text-xs text-slate-500">Already Invoiced</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl w-fit border border-slate-800/60">
        {[
          { value: 'true',  label: 'Ready' },
          { value: 'false', label: 'Invoiced' },
          { value: '',      label: 'All' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f.value ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Table columns={columns} data={items} loading={loading} emptyText="No finished goods found." />
    </div>
  );
};

export default FinishedGoods;
