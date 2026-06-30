import { useState, useEffect, useCallback, useRef } from 'react';
import { inventoryAPI, stagesAPI } from '../api/apiService';
import { useAuth } from '../context/AuthContext';
import Table   from '../components/UI/Table';
import Badge   from '../components/UI/Badge';
import Modal   from '../components/UI/Modal';
import toast   from 'react-hot-toast';
import {
  Plus, Search, Package, RefreshCw, Upload, Download,
  FileText, CheckCircle2, XCircle, AlertTriangle, ChevronRight, X,
} from 'lucide-react';
import { format } from 'date-fns';

const STAGES = ['inventory_entry','qc_incoming','production','qc_outgoing','finished_goods'];
const VALID_UNITS = ['pcs','kg','g','m','mm','litre','box','set'];
const CSV_HEADERS = ['item_name','sku','quantity','variant'];

// ── CSV & Excel Import Helpers ─────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  // Read the headers line
  const originalHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  // Normalize headers (Product Name -> item_name, SKU/ID -> sku, Qty/Quantity -> quantity, Variant -> variant)
  const normalizedHeaders = originalHeaders.map(h => {
    const lower = h.toLowerCase();
    if (lower.includes('product') || lower.includes('name')) return 'item_name';
    if (lower.includes('sku') || lower.includes('id')) return 'sku';
    if (lower.includes('qty') || lower.includes('quantity')) return 'quantity';
    if (lower.includes('variant')) return 'variant';
    return lower.replace(/\s+/g, '_');
  });

  const rows = lines.slice(1).map((line, idx) => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = { _row: idx + 2 };
    normalizedHeaders.forEach((h, i) => {
      obj[h] = vals[i] || '';
    });
    return obj;
  });
  return { headers: normalizedHeaders, rows };
}

function parseExcelHTML(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const tableRows = doc.querySelectorAll('tr');
  if (tableRows.length < 2) return { headers: [], rows: [] };

  // Headers normalization
  const headers = Array.from(tableRows[0].querySelectorAll('th, td')).map(cell => {
    const txt = cell.textContent.trim().toLowerCase();
    if (txt.includes('product') || txt.includes('name')) return 'item_name';
    if (txt.includes('sku') || txt.includes('id')) return 'sku';
    if (txt.includes('qty') || txt.includes('quantity')) return 'quantity';
    if (txt.includes('variant')) return 'variant';
    return txt.replace(/\s+/g, '_');
  });

  // Rows parsing
  const rows = [];
  for (let idx = 1; idx < tableRows.length; idx++) {
    const cells = tableRows[idx].querySelectorAll('td');
    if (cells.length === 0) continue;
    const obj = { _row: idx + 1 };
    headers.forEach((h, colIdx) => {
      obj[h] = cells[colIdx] ? cells[colIdx].textContent.trim() : '';
    });
    rows.push(obj);
  }

  return { headers, rows };
}

function validateRow(row) {
  const errs = [];
  if (!row.item_name || !row.item_name.trim()) errs.push('Product Name is required');
  const qty = parseFloat(row.quantity);
  if (row.quantity === '' || row.quantity === undefined) errs.push('Quantity is required');
  else if (isNaN(qty) || qty < 0) errs.push('Quantity must be ≥ 0');
  if (!row.sku || !row.sku.trim()) errs.push('SKU number is required');
  return errs;
}

function downloadTemplate() {
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Template</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>';
  html += '<body><table border="1">';
  html += '<tr style="background-color: #4f46e5; color: #ffffff; font-weight: bold;">';
  html += '<th>product_name</th><th>sku_number</th><th>quantity</th><th>variant</th>';
  html += '</tr>';
  html += '<tr><td>M3 Hex Connector</td><td>SC-HEX-001</td><td>500</td><td>Stainless Steel</td></tr>';
  html += '<tr><td>Cable Assembly</td><td>SC-CA-002</td><td>120</td><td>Black PVC</td></tr>';
  html += '</table></body></html>';

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'inventory_import_template.xls'; a.click();
  URL.revokeObjectURL(url);
}

// ── Step indicator ─────────────────────────────────────────────────────────────
const STEPS = ['Upload', 'Preview', 'Result'];
const StepBar = ({ current }) => (
  <div className="flex items-center gap-0 mb-6">
    {STEPS.map((label, i) => {
      const done    = i < current;
      const active  = i === current;
      return (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
              ${done   ? 'bg-emerald-500 text-white' : ''}
              ${active ? 'bg-brand-600 text-white ring-2 ring-brand-400/50' : ''}
              ${!done && !active ? 'bg-slate-800 text-slate-500 border border-slate-700' : ''}`}>
              {done ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-semibold ${active ? 'text-slate-100' : done ? 'text-emerald-400' : 'text-slate-500'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="flex-1 mx-3 h-px bg-slate-800 relative overflow-hidden">
              <div className={`absolute inset-y-0 left-0 bg-emerald-500/60 transition-all duration-500 ${done ? 'w-full' : 'w-0'}`} />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

// ── BulkImportModal ────────────────────────────────────────────────────────────
const BulkImportModal = ({ isOpen, onClose, onSuccess }) => {
  const [step,     setStep]     = useState(0);
  const [isDrag,   setIsDrag]   = useState(false);
  const [parsed,   setParsed]   = useState([]);   // { ...row, _errors: [] }
  const [fileName, setFileName] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);  // API response
  const fileRef = useRef(null);

  const reset = () => { setStep(0); setParsed([]); setFileName(''); setResult(null); setLoading(false); };
  const handleClose = () => { reset(); onClose(); };

  const processFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'xls') {
      toast.error('Please upload a .csv or .xls file');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const isHTML = text.includes('<html') || text.includes('<table');
      const { rows } = isHTML ? parseExcelHTML(text) : parseCSV(text);
      
      if (rows.length === 0) {
        toast.error('Uploaded file has no data rows');
        return;
      }
      const annotated = rows.map(row => ({ ...row, _errors: validateRow(row) }));
      setParsed(annotated);
      setStep(1);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDrag(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    const validItems = parsed
      .filter(r => r._errors.length === 0)
      .map(({ _row, _errors, ...rest }) => rest);

    setLoading(true);
    try {
      const { data } = await inventoryAPI.bulkImport({ items: validItems });
      setResult(data);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const validCount = parsed.filter(r => r._errors.length === 0).length;
  const errorCount = parsed.filter(r => r._errors.length > 0).length;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Inventory" size="xl">
      <StepBar current={step} />

      {/* ── Step 0: Upload ── */}
      {step === 0 && (
        <div className="space-y-5">
          {/* Drag-drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
            onDragLeave={() => setIsDrag(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
              ${isDrag ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/40'}`}
          >
            <input
              ref={fileRef} type="file" accept=".csv,.xls" className="hidden"
              onChange={(e) => processFile(e.target.files[0])}
            />
            <div className="flex flex-col items-center gap-3 pointer-events-none">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all
                ${isDrag ? 'bg-brand-500/20' : 'bg-slate-800'}`}>
                <Upload size={24} className={isDrag ? 'text-brand-400' : 'text-slate-500'} />
              </div>
              <div>
                <p className="text-slate-200 font-semibold">
                  {isDrag ? 'Drop your CSV/XLS here' : 'Drag & drop CSV/XLS or click to browse'}
                </p>
                <p className="text-slate-500 text-sm mt-1">Accepts .csv or .xls files • Max 500 rows</p>
              </div>
            </div>
          </div>

          {/* Template download */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <FileText size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Need a template?</p>
                <p className="text-xs text-slate-500">Download a pre-filled sample Excel template (.xls)</p>
              </div>
            </div>
            <button onClick={downloadTemplate} className="btn-secondary text-xs gap-1.5">
              <Download size={13} /> Download Template
            </button>
          </div>

          {/* Required columns reference */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Expected Columns</p>
            <div className="flex flex-wrap gap-2">
              {CSV_HEADERS.map(h => (
                <span key={h} className={`text-xs px-2 py-0.5 rounded-md font-mono
                  ${['item_name','quantity','sku'].includes(h)
                    ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                    : 'bg-slate-700/50 text-slate-400'}`}>
                  {h === 'item_name' ? 'product_name' : h === 'sku' ? 'sku_number' : h}{['item_name','quantity','sku'].includes(h) ? ' *' : ''}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">* Required fields</p>
          </div>
        </div>
      )}

      {/* ── Step 1: Preview ── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">{validCount} valid</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <XCircle size={14} className="text-red-400" />
                <span className="text-sm font-semibold text-red-400">{errorCount} errors</span>
              </div>
            )}
            <span className="text-slate-500 text-sm ml-auto truncate max-w-xs">{fileName}</span>
            <button
              onClick={() => { setParsed([]); setStep(0); }}
              className="btn-ghost text-xs gap-1"
            >
              <X size={12} /> Change file
            </button>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800/60 max-h-80">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/80 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wider w-10">#</th>
                  <th className="px-3 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wider">Product Name</th>
                  <th className="px-3 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wider">SKU</th>
                  <th className="px-3 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wider">Qty</th>
                  <th className="px-3 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wider">Variant</th>
                  <th className="px-3 py-2.5 text-left text-slate-400 font-semibold uppercase tracking-wider w-48">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((row, i) => {
                  const hasErr = row._errors.length > 0;
                  return (
                    <tr
                      key={i}
                      className={`border-t border-slate-800/40 transition-colors
                        ${hasErr ? 'bg-red-500/5' : 'hover:bg-slate-800/20'}`}
                    >
                      <td className="px-3 py-2 text-slate-500">{row._row ?? i + 2}</td>
                      <td className={`px-3 py-2 font-medium ${hasErr ? 'text-red-300' : 'text-slate-200'}`}>
                        {row.item_name || <span className="text-red-400 italic">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{row.sku || '—'}</td>
                      <td className="px-3 py-2 text-slate-300">{row.quantity || '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{row.variant || '—'}</td>
                      <td className="px-3 py-2">
                        {hasErr ? (
                          <div className="flex flex-col gap-0.5">
                            {row._errors.map((e, ei) => (
                              <span key={ei} className="flex items-center gap-1 text-red-400 text-xs">
                                <AlertTriangle size={10} className="flex-shrink-0" />{e}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs">
                            <CheckCircle2 size={11} /> Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {errorCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-300 text-xs">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <span>Rows with errors will be <strong>skipped</strong>. Only {validCount} valid row{validCount !== 1 ? 's' : ''} will be imported.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setParsed([]); setStep(0); }} className="btn-secondary">Back</button>
            <button
              onClick={handleSubmit}
              disabled={validCount === 0 || loading}
              className="btn-primary gap-2"
              id="bulk-import-submit-btn"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing…</>
                : <><Upload size={14} /> Import {validCount} Item{validCount !== 1 ? 's' : ''}</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Result ── */}
      {step === 2 && result && (
        <div className="space-y-5">
          {/* Result summary */}
          <div className="flex gap-4">
            <div className="flex-1 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5 text-center">
              <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-3xl font-black text-emerald-400">{result.inserted_count}</p>
              <p className="text-sm text-slate-400 mt-1">Items Imported</p>
            </div>
            {result.error_count > 0 && (
              <div className="flex-1 rounded-2xl bg-red-500/10 border border-red-500/20 p-5 text-center">
                <XCircle size={28} className="text-red-400 mx-auto mb-2" />
                <p className="text-3xl font-black text-red-400">{result.error_count}</p>
                <p className="text-sm text-slate-400 mt-1">Rows Skipped</p>
              </div>
            )}
          </div>

          {/* Error list */}
          {result.errors && result.errors.length > 0 && (
            <div className="rounded-xl border border-slate-800/60 overflow-hidden">
              <div className="bg-slate-800/60 px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Skipped Rows
              </div>
              <div className="divide-y divide-slate-800/40 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-xs text-slate-500 w-12 flex-shrink-0">Row {e.row}</span>
                    <div>
                      <p className="text-xs font-medium text-slate-300">{e.item_name || '—'}</p>
                      <p className="text-xs text-red-400">{e.errors?.join(' · ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {result.error_count > 0 && (
              <button onClick={reset} className="btn-secondary">Import More</button>
            )}
            <button
              onClick={() => { onSuccess(); handleClose(); }}
              className="btn-primary"
            >
              <CheckCircle2 size={14} /> Close & Refresh
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ── Main Inventory Page ────────────────────────────────────────────────────────
const Inventory = () => {
  const { user } = useAuth();
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ stage: '', status: '' });
  const [search,  setSearch]  = useState('');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAdvancing, setBulkAdvancing] = useState(false);

  // Add Item modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    item_name: '', sku: '', quantity: '', unit: 'pcs', variant: '',
    received_date: new Date().toISOString().split('T')[0],
    supplier_name: '', batch_number: '', notes: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  // Bulk import modal
  const [showBulk, setShowBulk] = useState(false);

  // View Item modal
  const [viewItem, setViewItem] = useState(null);

  const fetchItems = useCallback(async () => {
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

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { setSelectedIds(new Set()); }, [page, filters]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      await inventoryAPI.create({ ...form, quantity: parseFloat(form.quantity) });
      toast.success('Item added to inventory');
      setShowAdd(false);
      setForm({ item_name: '', sku: '', quantity: '', unit: 'pcs', variant: '',
        received_date: new Date().toISOString().split('T')[0],
        supplier_name: '', batch_number: '', notes: '' });
      fetchItems();
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
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to advance item');
    }
  };

  const handleBulkAdvance = async () => {
    setBulkAdvancing(true);
    try {
      await stagesAPI.bulkAdvance({ itemIds: Array.from(selectedIds) });
      toast.success(`Successfully pushed ${selectedIds.size} items to QC Incoming`);
      setSelectedIds(new Set());
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk advancement failed');
    } finally {
      setBulkAdvancing(false);
    }
  };

  const filtered = items.filter((i) =>
    !search || i.item_name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku?.toLowerCase().includes(search.toLowerCase()) ||
    i.variant?.toLowerCase().includes(search.toLowerCase())
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

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const entryIds = filtered
        .filter(i => i.current_stage === 'inventory_entry' && i.status !== 'rejected')
        .map(i => i.id);
      setSelectedIds(new Set(entryIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const columns = [];
  if (canCreate) {
    const selectableItems = filtered.filter(i => i.current_stage === 'inventory_entry' && i.status !== 'rejected');
    const isAllSelected = selectableItems.length > 0 && selectableItems.every(i => selectedIds.has(i.id));

    columns.push({
      key: 'checkbox',
      label: (
        <input
          type="checkbox"
          className="rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500"
          checked={isAllSelected}
          onChange={handleSelectAll}
        />
      ),
      render: (_, row) => {
        const isEntry = row.current_stage === 'inventory_entry' && row.status !== 'rejected';
        if (!isEntry) return null;
        return (
          <input
            type="checkbox"
            className="rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500"
            checked={selectedIds.has(row.id)}
            onChange={() => handleSelectRow(row.id)}
          />
        );
      }
    });
  }

  columns.push(
    { key: 'item_name',     label: 'Product Name', render: (v, row) => (
      <button
        onClick={() => setViewItem(row)}
        className="font-medium text-brand-400 hover:text-brand-300 transition-colors text-left font-sans"
      >
        {v}
      </button>
    )},
    { key: 'sku',           label: 'SKU', render: (v) => v || '—' },
    { key: 'variant',       label: 'Variant', render: (v) => v || '—' },
    { key: 'quantity',      label: 'Qty', render: (v, row) => `${v} ${row.unit}` },
    { key: 'current_stage', label: 'Stage', render: (v) => <Badge variant={v} /> },
    { key: 'status',        label: 'Status', render: (v) => <Badge variant={v} /> },
    { key: 'received_date', label: 'Received', render: (v) => format(new Date(v), 'dd MMM yyyy') },
    { key: 'created_by_name', label: 'Added By', render: (v, row) => `${v} (#${row.created_by})` },
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
    )}
  );

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Inventory</h2>
          <p className="page-subtitle">{total} items in the system</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchItems} className="btn-ghost" title="Refresh">
            <RefreshCw size={15} />
          </button>
          {canCreate && (
            <>
              <button
                onClick={() => setShowBulk(true)}
                className="btn-secondary gap-2"
                id="bulk-import-btn"
              >
                <Upload size={14} /> Import CSV
              </button>
              <button onClick={() => setShowAdd(true)} className="btn-primary" id="add-item-btn">
                <Plus size={15} /> Add Item
              </button>
            </>
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

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-6 z-40 animate-slide-in">
          <div className="text-sm text-slate-300">
            <span className="font-bold text-brand-400">{selectedIds.size}</span> items selected
          </div>
          <button
            onClick={handleBulkAdvance}
            disabled={bulkAdvancing}
            className="btn-primary py-2 px-4 text-xs gap-2"
          >
            {bulkAdvancing ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Send Selected to QC Incoming</>
            )}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulk}
        onClose={() => setShowBulk(false)}
        onSuccess={fetchItems}
      />

      {/* Add Item Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Inventory Item" size="md">
        <form onSubmit={handleAdd} className="space-y-4" id="add-item-form">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Product Name *</label>
              <input className="input" placeholder="e.g. M3 Hex Connector" required
                value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">SKU *</label>
              <input className="input" placeholder="SC-HEX-001" required
                value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Variant</label>
              <input className="input" placeholder="Stainless Steel"
                value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} />
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
                {VALID_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
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
              ['Variant', viewItem.variant],
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
