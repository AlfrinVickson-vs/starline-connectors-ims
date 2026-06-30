import { useState, useEffect, useCallback } from 'react';
import { inventoryAPI, stagesAPI } from '../api/apiService';
import { useAuth } from '../context/AuthContext';
import Table   from '../components/UI/Table';
import Badge   from '../components/UI/Badge';
import Modal   from '../components/UI/Modal';
import toast   from 'react-hot-toast';
import { Plus, Search, Package, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const STAGES = ['inventory_entry','qc_incoming','production','qc_outgoing','finished_goods'];

const Inventory = () => {
  const { user } = useAuth();
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ stage: '', status: '' });
  const [search,  setSearch]  = useState('');

  // Add Item modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    item_name: '', sku: '', quantity: '', unit: 'pcs',
    received_date: new Date().toISOString().split('T')[0],
    supplier_name: '', batch_number: '', notes: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  // View Item modal
  const [viewItem, setViewItem] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await inventoryAPI.list({
        page, limit: 20,
        stage:  filters.stage  || undefined,
        status: filters.status || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      await inventoryAPI.create({
        ...form,
        quantity: parseFloat(form.quantity),
      });
      toast.success('Item added to inventory');
      setShowAdd(false);
      setForm({ item_name: '', sku: '', quantity: '', unit: 'pcs',
        received_date: new Date().toISOString().split('T')[0],
        supplier_name: '', batch_number: '', notes: '' });
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add item');
    } finally {
      setAddLoading(false);
    }
  };

  const handleAdvance = async (item) => {
    try {
      await stagesAPI.advance(item.id, { comments: '' });
      toast.success(`"${item.item_name}" advanced to next stage`);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to advance item');
    }
  };

  const filtered = items.filter((i) =>
    !search || i.item_name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const canCreate = user?.role === 'inventory_manager' || user?.role === 'admin';
  const canAdvance = (item) => {
    const stageRoles = {
      inventory_entry: ['inventory_manager', 'admin'],
      qc_incoming:     ['qc_inspector', 'admin'],
      production:      ['production_manager', 'admin'],
      qc_outgoing:     ['qc_inspector', 'admin'],
    };
    return (stageRoles[item.current_stage] || []).includes(user?.role);
  };

  const columns = [
    { key: 'item_name',     label: 'Item Name', render: (v, row) => (
      <button
        onClick={() => setViewItem(row)}
        className="font-medium text-brand-400 hover:text-brand-300 transition-colors text-left"
      >
        {v}
      </button>
    )},
    { key: 'sku',           label: 'SKU', render: (v) => v || '—' },
    { key: 'quantity',      label: 'Qty', render: (v, row) => `${v} ${row.unit}` },
    { key: 'current_stage', label: 'Stage', render: (v) => <Badge variant={v} /> },
    { key: 'status',        label: 'Status', render: (v) => <Badge variant={v} /> },
    { key: 'received_date', label: 'Received', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    { key: 'created_by_name', label: 'Added By' },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex items-center gap-2">
        {canAdvance(row) && row.status !== 'rejected' && row.current_stage !== 'finished_goods' && (
          <button
            onClick={() => handleAdvance(row)}
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 px-2.5 py-1 rounded-lg transition-all"
          >
            Advance →
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Inventory</h2>
          <p className="page-subtitle">{total} items in the system</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetch} className="btn-ghost" title="Refresh">
            <RefreshCw size={15} />
          </button>
          {canCreate && (
            <button onClick={() => setShowAdd(true)} className="btn-primary" id="add-item-btn">
              <Plus size={15} /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search items…"
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select w-44"
          value={filters.stage}
          onChange={(e) => { setFilters({ ...filters, stage: e.target.value }); setPage(1); }}
        >
          <option value="">All Stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select
          className="select w-36"
          value={filters.status}
          onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="in_progress">In Progress</option>
        </select>
      </div>

      {/* Table */}
      <Table
        columns={columns} data={filtered} loading={loading}
        total={total} page={page} limit={20} onPage={setPage}
        emptyText="No inventory items found."
      />

      {/* Add Item Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Inventory Item" size="md">
        <form onSubmit={handleAdd} className="space-y-4" id="add-item-form">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Item Name *</label>
              <input className="input" placeholder="e.g. M3 Hex Connector" required
                value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">SKU</label>
              <input className="input" placeholder="SC-HEX-001"
                value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Batch Number</label>
              <input className="input" placeholder="B-2024-001"
                value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Quantity *</label>
              <input className="input" type="number" min="0" step="any" placeholder="0" required
                value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Unit</label>
              <select className="select"
                value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {['pcs','kg','g','m','mm','litre','box','set'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Received Date</label>
              <input className="input" type="date"
                value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Supplier</label>
              <input className="input" placeholder="Supplier name"
                value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Notes</label>
              <textarea className="input resize-none h-20" placeholder="Optional notes…"
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={addLoading} id="add-item-submit-btn">
              {addLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Package size={14} /> Add Item</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Item Modal */}
      {viewItem && (
        <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title={`Item: ${viewItem.item_name}`} size="md">
          <div className="space-y-3">
            {[
              ['SKU', viewItem.sku],
              ['Quantity', `${viewItem.quantity} ${viewItem.unit}`],
              ['Stage', <Badge variant={viewItem.current_stage} />],
              ['Status', <Badge variant={viewItem.status} />],
              ['Batch', viewItem.batch_number],
              ['Supplier', viewItem.supplier_name],
              ['Received', viewItem.received_date && format(new Date(viewItem.received_date), 'dd MMM yyyy')],
              ['Added By', viewItem.created_by_name],
              ['Notes', viewItem.notes],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="flex items-start gap-4 text-sm">
                <span className="text-slate-500 w-20 flex-shrink-0">{label}</span>
                <span className="text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Inventory;
