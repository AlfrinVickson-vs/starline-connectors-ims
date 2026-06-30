import { useState, useEffect, useCallback, useRef } from 'react';
import { inventoryAPI, stagesAPI } from '../api/apiService';
import { useAuth } from '../context/AuthContext';
import Table  from '../components/UI/Table';
import Badge  from '../components/UI/Badge';
import Modal  from '../components/UI/Modal';
import toast  from 'react-hot-toast';
import {
  ShieldCheck, CheckCircle, XCircle, RefreshCw, Clock,
  AlertTriangle, SplitSquareHorizontal, Search, Hammer, Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const QualityCheck = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab]   = useState('qc_incoming');
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [actionItem, setActionItem] = useState(null); // { item, action: 'approve'|'reject' }
  const [comment,   setComment]     = useState('');
  const [approvedQty, setApprovedQty] = useState('');
  const [rework, setRework]         = useState(true); // default to rework for qc_outgoing rejections
  const [submitting, setSubmitting] = useState(false);

  // Search autocomplete states
  const [search, setSearch]             = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteRef = useRef(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await inventoryAPI.byStage(activeTab);
      setItems(data.items);
    } catch { toast.error('Failed to load items'); }
    finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { fetch(); }, [fetch]);

  // Reset search when activeTab changes
  useEffect(() => { setSearch(''); setShowAutocomplete(false); }, [activeTab]);

  // Click outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openAction = (item, action) => {
    setActionItem({ item, action });
    setComment('');
    setRework(true);
    setApprovedQty(action === 'approve' ? String(parseFloat(item.quantity)) : '');
    setShowAutocomplete(false);
  };

  const handleSubmit = async () => {
    if (!actionItem) return;

    if (actionItem.action === 'reject' && !comment.trim()) {
      toast.error('A rejection reason is required');
      return;
    }

    const isApprove = actionItem.action === 'approve';

    // Validate approved qty
    if (isApprove) {
      const totalQty    = parseFloat(actionItem.item.quantity);
      const parsedApproved = parseFloat(approvedQty);
      if (isNaN(parsedApproved) || parsedApproved <= 0) {
        toast.error('Approved quantity must be greater than 0');
        return;
      }
      if (parsedApproved > totalQty) {
        toast.error(`Approved quantity cannot exceed total (${totalQty} ${actionItem.item.unit})`);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isApprove) {
        const body = {
          comments: comment || 'QC Passed',
          approved_qty: parseFloat(approvedQty),
        };
        await stagesAPI.advance(actionItem.item.id, body);
        toast.success(`"${actionItem.item.item_name}" approved and advanced`);
      } else {
        const body = {
          comments: comment,
          rework: activeTab === 'qc_outgoing' ? rework : false,
        };
        await stagesAPI.reject(actionItem.item.id, body);
        if (activeTab === 'qc_outgoing' && rework) {
          toast.success(`"${actionItem.item.item_name}" sent back to Production for rework`);
        } else {
          toast.success(`"${actionItem.item.item_name}" completely rejected`);
        }
      }
      setActionItem(null);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items based on search input
  const filteredItems = items.filter((item) => {
    const query = search.toLowerCase();
    return (
      !search ||
      item.item_name.toLowerCase().includes(query) ||
      (item.sku && item.sku.toLowerCase().includes(query)) ||
      (item.variant && item.variant.toLowerCase().includes(query))
    );
  });

  // Autocomplete matches (minimum 3 characters)
  const showMatches = search.trim().length >= 3 && filteredItems.length > 0;

  // Derived values for the approve modal
  const totalQty       = actionItem ? parseFloat(actionItem.item.quantity) : 0;
  const parsedApproved = parseFloat(approvedQty);
  const rejectedQty    = (!isNaN(parsedApproved) && parsedApproved >= 0)
    ? Math.max(0, parseFloat((totalQty - parsedApproved).toFixed(4)))
    : null;
  const isPartial      = rejectedQty !== null && rejectedQty > 0;

  const columns = [
    { key: 'item_name', label: 'Product Name', render: (v, row) => (
      <div>
        <p className="font-medium text-slate-200">{v}</p>
        <div className="flex gap-2 items-center mt-0.5">
          {row.variant && <span className="text-xs text-slate-500 font-mono">Variant: {row.variant}</span>}
          {row.batch_number && (
            <>
              {row.variant && <span className="text-slate-700">·</span>}
              <span className="text-xs text-slate-500 font-mono">Batch: {row.batch_number}</span>
            </>
          )}
        </div>
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

      {/* Autocomplete Search Bar & Tabs Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

        {/* Autocomplete Dropdown Search Input */}
        <div className="relative w-full md:w-80" ref={autocompleteRef}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search product (min 3 chars)…"
            className="input pl-9 w-full"
            value={search}
            onFocus={() => setShowAutocomplete(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowAutocomplete(true);
            }}
          />

          {/* Autocomplete Dropdown suggestions list */}
          {showAutocomplete && showMatches && (
            <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-800/60 animate-slide-in backdrop-blur-md bg-opacity-95">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openAction(item, 'approve')}
                  className="px-4 py-3 hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{item.item_name}</p>
                    <p className="text-slate-500 mt-0.5">
                      SKU: {item.sku || '—'} {item.variant ? `· Var: ${item.variant}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-bold text-brand-400">{item.quantity} {item.unit}</span>
                    <p className="text-[10px] text-slate-600">Click to Approve</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Waiting', value: items.length,                                              color: 'text-slate-300' },
          { label: 'Approved', value: items.filter((i) => i.status === 'approved').length,         color: 'text-emerald-400' },
          { label: 'Rejected', value: items.filter((i) => i.status === 'rejected').length,         color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <Table columns={columns} data={filteredItems} loading={loading} emptyText="No items at this QC stage." />

      {/* Action Modal */}
      <Modal
        isOpen={!!actionItem}
        onClose={() => setActionItem(null)}
        title={
          actionItem?.action === 'approve'
            ? (activeTab === 'qc_outgoing' ? '✅ Approve — QC Outgoing' : '✅ Approve — QC Incoming')
            : '❌ Reject Item'
        }
        size="sm"
      >
        {actionItem && (
          <div className="space-y-4">

            {/* Item info card */}
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
              <p className="text-sm font-semibold text-slate-200">{actionItem.item.item_name}</p>
              <p className="text-xs text-slate-500 mt-1">
                Total: <span className="text-slate-300 font-medium">{actionItem.item.quantity} {actionItem.item.unit}</span>
                {actionItem.item.sku && ` · SKU: ${actionItem.item.sku}`}
                {actionItem.item.variant && ` · Variant: ${actionItem.item.variant}`}
              </p>
            </div>

            {/* ── Partial approval qty (Both QC stages) ── */}
            {actionItem.action === 'approve' && (
              <div className="space-y-3">
                {/* Approved qty input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Approved Quantity *
                  </label>
                  <div className="relative">
                    <input
                      id="approved-qty-input"
                      type="number"
                      min="0.0001"
                      max={totalQty}
                      step="any"
                      className="input pr-16"
                      value={approvedQty}
                      onChange={(e) => setApprovedQty(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                      {actionItem.item.unit}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Max: {totalQty} {actionItem.item.unit}</p>
                </div>

                {/* Live split preview */}
                <div className={`rounded-xl p-3 border transition-all duration-200 ${
                  isPartial
                    ? 'bg-amber-500/8 border-amber-500/25'
                    : 'bg-emerald-500/8 border-emerald-500/20'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {isPartial
                      ? <SplitSquareHorizontal size={14} className="text-amber-400 flex-shrink-0" />
                      : <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                    }
                    <span className="text-xs font-semibold text-slate-300">
                      {isPartial ? 'Partial Approval' : 'Full Approval'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
                      <p className="text-base font-bold text-emerald-400">
                        {!isNaN(parsedApproved) && parsedApproved >= 0 ? parsedApproved : '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {actionItem.item.unit} → {activeTab === 'qc_outgoing' ? 'Finished Goods' : 'Production'}
                      </p>
                    </div>
                    <div className={`rounded-lg border px-3 py-2 text-center ${
                      isPartial
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-slate-800/40 border-slate-700/30'
                    }`}>
                      <p className={`text-base font-bold ${isPartial ? 'text-red-400' : 'text-slate-600'}`}>
                        {rejectedQty !== null ? rejectedQty : '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {actionItem.item.unit} Rejected
                      </p>
                    </div>
                  </div>
                  {isPartial && (
                    <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                      <AlertTriangle size={11} />
                      {rejectedQty} {actionItem.item.unit} will be marked as rejected
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Rejection Option Selection (QC Outgoing reject only) ── */}
            {actionItem.action === 'reject' && activeTab === 'qc_outgoing' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Rejection Option
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRework(true)}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all duration-200
                      ${rework
                        ? 'bg-brand-500/10 border-brand-500/60 text-brand-400 shadow-md'
                        : 'bg-slate-800/40 border-slate-700/30 text-slate-400 hover:bg-slate-800'}`}
                  >
                    <Hammer size={13} />
                    Send for Rework
                  </button>
                  <button
                    type="button"
                    onClick={() => setRework(false)}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all duration-200
                      ${!rework
                        ? 'bg-red-500/10 border-red-500/60 text-red-400 shadow-md'
                        : 'bg-slate-800/40 border-slate-700/30 text-slate-400 hover:bg-slate-800'}`}
                  >
                    <Trash2 size={13} />
                    Reject Completely
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  {rework
                    ? '🔄 Item will be sent back to Production stage for rework.'
                    : '🚫 Item will stay in QC Outgoing as completely rejected (cannot rework).'}
                </p>
              </div>
            )}

            {/* Comments */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Comments {actionItem.action === 'reject' && <span className="text-red-400">*</span>}
              </label>
              <textarea
                className="input resize-none h-20"
                placeholder={
                  actionItem.action === 'reject'
                    ? 'Reason for rejection (required)…'
                    : 'Optional QC notes…'
                }
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
                    ? <><CheckCircle size={14} /> {isPartial ? `Approve ${parsedApproved} ${actionItem.item.unit}` : 'Approve All'}</>
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
