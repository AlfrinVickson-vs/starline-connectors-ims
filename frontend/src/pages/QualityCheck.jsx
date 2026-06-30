import { useState, useEffect, useCallback } from 'react';
import { inventoryAPI, stagesAPI } from '../api/apiService';
import { useAuth } from '../context/AuthContext';
import Table  from '../components/UI/Table';
import Badge  from '../components/UI/Badge';
import Modal  from '../components/UI/Modal';
import toast  from 'react-hot-toast';
import { ShieldCheck, CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const QualityCheck = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab]   = useState('qc_incoming');
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [actionItem, setActionItem] = useState(null); // { item, action: 'approve'|'reject' }
  const [comment, setComment]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await inventoryAPI.byStage(activeTab);
      setItems(data.items);
    } catch { toast.error('Failed to load items'); }
    finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { fetch(); }, [fetch]);

  const openAction = (item, action) => {
    setActionItem({ item, action });
    setComment('');
  };

  const handleSubmit = async () => {
    if (!actionItem) return;
    if (actionItem.action === 'reject' && !comment.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    setSubmitting(true);
    try {
      if (actionItem.action === 'approve') {
        await stagesAPI.advance(actionItem.item.id, { comments: comment || 'QC Passed' });
        toast.success(`"${actionItem.item.item_name}" approved and advanced`);
      } else {
        await stagesAPI.reject(actionItem.item.id, { comments: comment });
        toast.success(`"${actionItem.item.item_name}" rejected`);
      }
      setActionItem(null);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'item_name', label: 'Item Name', render: (v, row) => (
      <div>
        <p className="font-medium text-slate-200">{v}</p>
        {row.batch_number && <p className="text-xs text-slate-500 mt-0.5">Batch: {row.batch_number}</p>}
      </div>
    )},
    { key: 'sku',           label: 'SKU', render: (v) => v || '—' },
    { key: 'quantity',      label: 'Qty', render: (v, row) => `${v} ${row.unit}` },
    { key: 'status',        label: 'Status', render: (v) => <Badge variant={v} /> },
    { key: 'supplier_name', label: 'Supplier', render: (v) => v || '—' },
    { key: 'created_at',    label: 'Waiting', render: (v) => (
      <span className="text-slate-400 text-xs flex items-center gap-1">
        <Clock size={11} />{formatDistanceToNow(new Date(v), { addSuffix: true })}
      </span>
    )},
    { key: 'actions', label: '', render: (_, row) => (
      row.status !== 'rejected' ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAction(row, 'approve')}
            className="btn-success py-1.5 px-3 text-xs"
            id={`approve-btn-${row.id}`}
          >
            <CheckCircle size={13} /> Approve
          </button>
          <button
            onClick={() => openAction(row, 'reject')}
            className="btn-danger py-1.5 px-3 text-xs"
            id={`reject-btn-${row.id}`}
          >
            <XCircle size={13} /> Reject
          </button>
        </div>
      ) : (
        <Badge variant="rejected" label="Rejected" />
      )
    )},
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Quality Control</h2>
          <p className="page-subtitle">Review and approve or reject items at QC stages</p>
        </div>
        <button onClick={fetch} className="btn-ghost" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl w-fit border border-slate-800/60">
        {[
          { key: 'qc_incoming', label: 'QC Incoming' },
          { key: 'qc_outgoing', label: 'QC Outgoing' },
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: items.length,                                                   color: 'text-slate-300' },
          { label: 'Approved', value: items.filter((i) => i.status === 'approved').length,         color: 'text-emerald-400' },
          { label: 'Rejected', value: items.filter((i) => i.status === 'rejected').length,         color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <Table columns={columns} data={items} loading={loading} emptyText="No items at this QC stage." />

      {/* Action Modal */}
      <Modal
        isOpen={!!actionItem}
        onClose={() => setActionItem(null)}
        title={actionItem?.action === 'approve' ? '✅ Approve Item' : '❌ Reject Item'}
        size="sm"
      >
        {actionItem && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-sm font-semibold text-slate-200">{actionItem.item.item_name}</p>
              <p className="text-xs text-slate-500 mt-1">
                {actionItem.item.quantity} {actionItem.item.unit}
                {actionItem.item.batch_number && ` · Batch: ${actionItem.item.batch_number}`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Comments {actionItem.action === 'reject' && <span className="text-red-400">*</span>}
              </label>
              <textarea
                className="input resize-none h-24"
                placeholder={actionItem.action === 'reject' ? 'Reason for rejection (required)…' : 'Optional QC notes…'}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                id="qc-comment-input"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setActionItem(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={actionItem.action === 'approve' ? 'btn-success' : 'btn-danger'}
                id="qc-confirm-btn"
              >
                {submitting
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : actionItem.action === 'approve'
                    ? <><CheckCircle size={14} /> Approve</>
                    : <><XCircle size={14} /> Reject</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QualityCheck;
