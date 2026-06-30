import { useState, useEffect, useCallback } from 'react';
import { inventoryAPI, stagesAPI } from '../api/apiService';
import Table  from '../components/UI/Table';
import Badge  from '../components/UI/Badge';
import Modal  from '../components/UI/Modal';
import toast  from 'react-hot-toast';
import { Factory, ArrowRight, RefreshCw, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const Production = () => {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [actionItem, setActionItem] = useState(null);
  const [comment,  setComment]  = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await inventoryAPI.byStage('production');
      setItems(data.items);
    } catch { toast.error('Failed to load production items'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAdvance = async () => {
    if (!actionItem) return;
    setSubmitting(true);
    try {
      await stagesAPI.advance(actionItem.id, { comments: comment || 'Production complete. Moving to QC Outgoing.' });
      toast.success(`"${actionItem.item_name}" moved to QC Outgoing`);
      setActionItem(null);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to advance item');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'item_name', label: 'Item Name', render: (v, row) => (
      <div>
        <p className="font-medium text-slate-200">{v}</p>
        {row.sku && <p className="text-xs text-slate-500 mt-0.5">SKU: {row.sku}</p>}
      </div>
    )},
    { key: 'quantity',      label: 'Qty', render: (v, row) => `${v} ${row.unit}` },
    { key: 'batch_number',  label: 'Batch', render: (v) => v || '—' },
    { key: 'supplier_name', label: 'Supplier', render: (v) => v || '—' },
    { key: 'status',        label: 'Status', render: (v) => <Badge variant={v} /> },
    { key: 'updated_at',    label: 'In Production', render: (v) => (
      <span className="text-xs text-slate-400 flex items-center gap-1">
        <Clock size={11} />{formatDistanceToNow(new Date(v), { addSuffix: true })}
      </span>
    )},
    { key: 'actions', label: '', render: (_, row) => (
      <button
        onClick={() => { setActionItem(row); setComment(''); }}
        className="btn-primary py-1.5 px-3 text-xs"
        id={`complete-production-btn-${row.id}`}
      >
        <ArrowRight size={13} /> Mark Complete
      </button>
    )},
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Production</h2>
          <p className="page-subtitle">{items.length} items currently in production</p>
        </div>
        <button onClick={fetch} className="btn-ghost">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Summary */}
      <div className="card p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/15 text-brand-400 flex items-center justify-center">
          <Factory size={24} />
        </div>
        <div>
          <p className="text-xl font-bold text-slate-100">{items.length}</p>
          <p className="text-xs text-slate-500">Items in active production</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-semibold text-slate-200">Next Stage</p>
          <p className="text-xs text-slate-500">QC Outgoing → Finished Goods</p>
        </div>
      </div>

      <Table
        columns={columns} data={items} loading={loading}
        emptyText="No items currently in production."
      />

      {/* Complete Modal */}
      <Modal
        isOpen={!!actionItem}
        onClose={() => setActionItem(null)}
        title="Mark Production Complete"
        size="sm"
      >
        {actionItem && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-sm font-semibold text-slate-200">{actionItem.item_name}</p>
              <p className="text-xs text-slate-500 mt-1">{actionItem.quantity} {actionItem.unit}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-brand-500/10 rounded-xl p-3">
              <ArrowRight size={14} className="text-brand-400" />
              This will move the item to <strong className="text-brand-400 ml-1">QC Outgoing</strong>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Production Notes</label>
              <textarea
                className="input resize-none h-20"
                placeholder="Optional production notes…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                id="production-notes-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionItem(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleAdvance} disabled={submitting} className="btn-primary" id="production-confirm-btn">
                {submitting
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><ArrowRight size={14} /> Send to QC</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Production;
