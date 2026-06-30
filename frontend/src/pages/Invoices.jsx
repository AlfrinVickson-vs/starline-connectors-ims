import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { invoicesAPI, finishedGoodsAPI } from '../api/apiService';
import { useAuth } from '../context/AuthContext';
import Table  from '../components/UI/Table';
import Badge  from '../components/UI/Badge';
import Modal  from '../components/UI/Modal';
import toast  from 'react-hot-toast';
import { FileText, Plus, Download, Search, RefreshCw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Chandigarh','Puducherry','Jammu and Kashmir','Ladakh',
];

const emptyForm = () => ({
  customer_name: '', customer_address: '', customer_gstin: '',
  customer_state: '', invoice_date: new Date().toISOString().split('T')[0],
  send_email_to: '',
  line_items: [{ item_id: '', description: '', hsn_code: '', quantity: 1, unit_price: 0, gst_rate: 18 }],
});

const Invoices = () => {
  const { user }     = useAuth();
  const location     = useLocation();
  const prefill      = location.state;

  const [invoices,  setInvoices]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [filters,   setFilters]   = useState({ customer: '', status: '', from_date: '', to_date: '' });
  const [showCreate, setShowCreate] = useState(!!prefill);
  const [form,      setForm]      = useState(() => {
    const f = emptyForm();
    if (prefill) {
      f.line_items[0].item_id      = prefill.prefill_item_id || '';
      f.line_items[0].description  = prefill.prefill_item_name || '';
      f.line_items[0].quantity     = prefill.prefill_quantity || 1;
    }
    return f;
  });
  const [creating, setCreating]   = useState(false);
  const [fgItems,  setFgItems]    = useState([]);
  const [downloading, setDownloading] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await invoicesAPI.list({ page, limit: 20, ...filters });
      setInvoices(data.invoices);
      setTotal(data.total);
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    finishedGoodsAPI.list({ ready_for_invoice: true })
      .then(({ data }) => setFgItems(data.items))
      .catch(() => {});
  }, []);

  const handleDownload = async (invoice) => {
    setDownloading(invoice.id);
    try {
      const { data } = await invoicesAPI.download(invoice.id);
      window.open(data.signed_url, '_blank');
    } catch { toast.error('Failed to get download link'); }
    finally { setDownloading(null); }
  };

  const updateLineItem = (idx, field, value) => {
    const lines = [...form.line_items];
    lines[idx] = { ...lines[idx], [field]: value };
    setForm({ ...form, line_items: lines });
  };

  const addLineItem = () => setForm({
    ...form,
    line_items: [...form.line_items, { item_id: '', description: '', hsn_code: '', quantity: 1, unit_price: 0, gst_rate: 18 }],
  });

  const removeLineItem = (idx) => setForm({
    ...form,
    line_items: form.line_items.filter((_, i) => i !== idx),
  });

  const subtotal = form.line_items.reduce((s, li) => s + (parseFloat(li.quantity) || 0) * (parseFloat(li.unit_price) || 0), 0);
  const isIntra  = form.customer_state === 'Maharashtra';
  const gstRate  = parseFloat(form.line_items[0]?.gst_rate || 18);
  const gstAmt   = (subtotal * gstRate) / 100;
  const total2   = subtotal + gstAmt;

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...form,
        send_email_to: form.send_email_to ? form.send_email_to.split(',').map((s) => s.trim()) : [],
        line_items: form.line_items.map((li) => ({
          ...li,
          item_id:    li.item_id   ? parseInt(li.item_id, 10) : null,
          quantity:   parseFloat(li.quantity),
          unit_price: parseFloat(li.unit_price),
          gst_rate:   parseFloat(li.gst_rate),
        })),
      };
      const { data } = await invoicesAPI.create(payload);
      toast.success(`Invoice ${data.invoice.invoice_number} created!`);
      setShowCreate(false);
      setForm(emptyForm());
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  const columns = [
    { key: 'invoice_number', label: 'Invoice #', render: (v) => <span className="font-mono font-semibold text-brand-400">{v}</span> },
    { key: 'customer_name',  label: 'Customer' },
    { key: 'customer_state', label: 'State' },
    { key: 'invoice_date',   label: 'Date', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    { key: 'total_amount',   label: 'Total', render: (v) => `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    { key: 'status', label: 'Status', render: (v) => <Badge variant={v} /> },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex items-center gap-2">
        {row.pdf_gcs_path && (
          <button
            onClick={() => handleDownload(row)}
            disabled={downloading === row.id}
            className="btn-ghost py-1.5 px-2.5 text-xs"
            id={`download-invoice-btn-${row.id}`}
          >
            {downloading === row.id
              ? <span className="w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
              : <Download size={13} />
            }
            Download
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Invoices</h2>
          <p className="page-subtitle">{total} invoices total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchInvoices} className="btn-ghost"><RefreshCw size={15} /></button>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)} className="btn-primary" id="create-invoice-btn">
              <Plus size={15} /> New Invoice
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Customer name…" className="input pl-9"
            value={filters.customer} onChange={(e) => setFilters({ ...filters, customer: e.target.value })} />
        </div>
        <select className="select w-36" value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Status</option>
          {['draft','issued','paid','cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className="input w-40" value={filters.from_date}
          onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} placeholder="From" />
        <input type="date" className="input w-40" value={filters.to_date}
          onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} placeholder="To" />
      </div>

      <Table columns={columns} data={invoices} loading={loading}
        total={total} page={page} limit={20} onPage={setPage}
        emptyText="No invoices found." />

      {/* Create Invoice Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Invoice" size="xl">
        <form onSubmit={handleCreate} className="space-y-6" id="create-invoice-form">
          {/* Customer */}
          <div>
            <h3 className="section-title">Customer Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Customer Name *</label>
                <input className="input" placeholder="ABC Industries Pvt Ltd" required
                  value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Address *</label>
                <textarea className="input resize-none h-16" placeholder="Full billing address…" required
                  value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">GSTIN</label>
                <input className="input" placeholder="27AAAAA0000A1Z5"
                  value={form.customer_gstin} onChange={(e) => setForm({ ...form, customer_gstin: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">State *</label>
                <select className="select" required value={form.customer_state}
                  onChange={(e) => setForm({ ...form, customer_state: e.target.value })}>
                  <option value="">Select state</option>
                  {INDIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Invoice Date</label>
                <input type="date" className="input" value={form.invoice_date}
                  onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Send Email To</label>
                <input className="input" placeholder="email1@example.com, email2@example.com"
                  value={form.send_email_to} onChange={(e) => setForm({ ...form, send_email_to: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title mb-0">Line Items</h3>
              <button type="button" onClick={addLineItem} className="btn-ghost text-xs py-1.5">
                <Plus size={13} /> Add Line
              </button>
            </div>
            <div className="space-y-3">
              {form.line_items.map((li, idx) => (
                <div key={idx} className="bg-slate-800/40 rounded-xl p-3">
                  <div className="grid grid-cols-6 gap-2 items-end">
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Description *</label>
                      <input className="input text-sm py-2" placeholder="Item description" required
                        value={li.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">HSN Code</label>
                      <input className="input text-sm py-2" placeholder="8536"
                        value={li.hsn_code} onChange={(e) => updateLineItem(idx, 'hsn_code', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Qty</label>
                      <input type="number" className="input text-sm py-2" min="0" step="any"
                        value={li.quantity} onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Unit Price (₹)</label>
                      <input type="number" className="input text-sm py-2" min="0" step="0.01"
                        value={li.unit_price} onChange={(e) => updateLineItem(idx, 'unit_price', e.target.value)} />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">GST%</label>
                        <select className="select text-sm py-2"
                          value={li.gst_rate} onChange={(e) => updateLineItem(idx, 'gst_rate', e.target.value)}>
                          {[0,5,12,18,28].map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>
                      {form.line_items.length > 1 && (
                        <button type="button" onClick={() => removeLineItem(idx)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1.5 mb-0.5">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400 mt-1.5">
                    Line Total: ₹{((parseFloat(li.quantity) || 0) * (parseFloat(li.unit_price) || 0)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax Summary */}
          {form.customer_state && (
            <div className="bg-slate-800/40 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tax Summary</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span className="text-slate-200">₹{subtotal.toFixed(2)}</span></div>
                {isIntra ? (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">CGST ({gstRate/2}%)</span><span className="text-slate-200">₹{(gstAmt/2).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">SGST ({gstRate/2}%)</span><span className="text-slate-200">₹{(gstAmt/2).toFixed(2)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between"><span className="text-slate-400">IGST ({gstRate}%)</span><span className="text-slate-200">₹{gstAmt.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-700/60">
                  <span className="text-slate-200">Total</span>
                  <span className="text-brand-400">₹{total2.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={creating} id="create-invoice-submit-btn">
              {creating
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
                : <><FileText size={14} /> Generate Invoice</>
              }
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Invoices;
