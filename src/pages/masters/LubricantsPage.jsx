import { localDate } from '../../utils/dates.js';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getLubricants,
  createLubricant,
  updateLubricant,
  setLubricantStatus,
  canDeleteLubricant,
  deleteLubricant,
  getSuppliers,
  getCustomers,
  getAllLubricantPurchases,
  createLubricantPurchase,
  deleteLubricantPurchase,
  getAllLubricantSales,
  createLubricantSale,
  deleteLubricantSale,
  getLubricantStockSummary,
  isPastDateLocked, addAuditLog,
} from '../../data/repository.js';
import { useReasonGate } from '../../components/ui/ReasonGate.jsx';
import {
  Modal,
  StatusBadge,
  FormGroup,
  EmptyState,
  SearchInput,
  useToast,
  Breadcrumbs,
  DeleteConfirmModal,
  ConfirmDialog,
} from '../../components/ui/UIComponents.jsx';
import Icon from '../../components/ui/Icon.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIES = [
  'Engine Oil',
  'Gear Oil',
  'Coolant',
  'Brake Fluid',
  'Grease',
  'Transmission Fluid',
  'Hydraulic Oil',
  'Other Lubricant',
];

const UNITS = [
  'Litre',
  'Piece',
  'Pack',
  'Kg',
  'Can',
  'Barrel',
  'Other',
];

export default function LubricantsPage() {
  const toast = useToast();
  const { requestReason, reasonDialog } = useReasonGate();
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'purchases' | 'sales'
  const [lubricants, setLubricants] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState({ open: false, lubricant: null });
  const [detailView, setDetailView] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, lubricant: null, check: { canDelete: true } });

  // Purchase Modal
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    date: localDate(),
    supplier: '',
    lubricantId: '',
    quantity: '',
    purchaseRate: '',
    amount: '',
    reference: '',
    remarks: '',
  });

  // Sale Modal
  const [saleModal, setSaleModal] = useState(false);
  const [saleForm, setSaleForm] = useState({
    date: localDate(),
    lubricantId: '',
    quantity: '',
    sellingPrice: '',
    amount: '',
    paymentMode: 'Cash',
    customerId: '',
    remarks: '',
  });

  const [deleteVoucherConfirm, setDeleteVoucherConfirm] = useState({ open: false, type: '', id: null });

  const refresh = useCallback(() => {
    setLubricants(getLubricants());
    setSuppliers(getSuppliers());
    setCustomers(getCustomers());
    setPurchases(getAllLubricantPurchases());
    setSales(getAllLubricantSales());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Enriched lubricants with real-time stock
  const enrichedLubricants = useMemo(() => {
    return lubricants.map(l => {
      const summary = getLubricantStockSummary(l.id);
      return {
        ...l,
        ...summary,
      };
    });
  }, [lubricants, purchases, sales]);

  const filtered = enrichedLubricants.filter(l => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = l.name.toLowerCase().includes(q);
      const matchBrand = l.brand?.toLowerCase().includes(q);
      const matchCategory = l.category?.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchCategory) return false;
    }
    if (filterCategory && l.category !== filterCategory) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  const handleSave = (formData) => {
    if (modal.lubricant) {
      updateLubricant(modal.lubricant.id, formData);
      toast.success('Lubricant updated successfully');
    } else {
      createLubricant(formData);
      toast.success('Lubricant added successfully');
    }
    refresh();
    setModal({ open: false, lubricant: null });
  };

  const handleToggle = (lubricant) => {
    const newStatus = lubricant.status === 'active' ? 'inactive' : 'active';
    setLubricantStatus(lubricant.id, newStatus);
    toast.success(`Lubricant ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    refresh();
  };

  const promptDelete = (lubricant) => {
    const check = canDeleteLubricant(lubricant.id);
    setDeleteModal({ open: true, lubricant, check });
  };

  const confirmDelete = () => {
    if (!deleteModal.lubricant) return;
    try {
      deleteLubricant(deleteModal.lubricant.id);
      toast.success('Lubricant deleted successfully');
      if (detailView === deleteModal.lubricant.id) setDetailView(null);
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to delete lubricant');
    }
  };

  // Purchase Handlers
  const handleOpenAddPurchase = (lubeId = '') => {
    const targetLube = lubricants.find(l => l.id === lubeId) || lubricants[0];
    const initialRate = targetLube?.purchasePrice || 0;
    setPurchaseForm({
      date: localDate(),
      supplier: suppliers[0]?.name || 'IOCL Lubricants Division',
      lubricantId: targetLube?.id || '',
      quantity: '',
      purchaseRate: initialRate ? String(initialRate) : '',
      amount: '',
      reference: '',
      remarks: '',
    });
    setPurchaseModal(true);
  };

  const handleSavePurchase = async () => {
    if (!purchaseForm.lubricantId) {
      toast.error('Please select a lubricant product.');
      return;
    }
    const qty = Number(purchaseForm.quantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity.');
      return;
    }
    const rate = Number(purchaseForm.purchaseRate) || 0;
    const amt = Number(purchaseForm.amount) || (qty * rate);

    const lube = lubricants.find(l => l.id === purchaseForm.lubricantId);
    let reasonGiven = '';
    if (isPastDateLocked(purchaseForm.date)) {
      reasonGiven = await requestReason({ title: 'Record a purchase on a past date', date: purchaseForm.date, detail: 'This changes lubricant stock and payables for that day.' });
      if (!reasonGiven) return;
    }
    createLubricantPurchase({
      date: purchaseForm.date,
      supplier: purchaseForm.supplier.trim(),
      lubricantId: purchaseForm.lubricantId,
      lubricantName: lube ? lube.name : 'Lubricant',
      quantity: qty,
      purchaseRate: rate,
      amount: amt,
      reference: purchaseForm.reference.trim(),
      remarks: purchaseForm.remarks.trim(),
    });

    if (reasonGiven) addAuditLog({ date: purchaseForm.date, module: 'Lubricant Purchase', action: 'Added late', reason: reasonGiven, summary: `${lube?.name}: ${qty} packs` });
    toast.success(`Recorded purchase of ${qty} packs of ${lube?.name}.`);
    setPurchaseModal(false);
    refresh();
  };

  // Sale Handlers
  const handleOpenAddSale = (lubeId = '') => {
    const targetLube = lubricants.find(l => l.id === lubeId) || lubricants[0];
    const initialPrice = targetLube?.sellingPrice || 0;
    setSaleForm({
      date: localDate(),
      lubricantId: targetLube?.id || '',
      quantity: '',
      sellingPrice: initialPrice ? String(initialPrice) : '',
      amount: '',
      paymentMode: 'Cash',
      customerId: '',
      remarks: '',
    });
    setSaleModal(true);
  };

  const handleSaveSale = async () => {
    if (!saleForm.lubricantId) {
      toast.error('Please select a lubricant product.');
      return;
    }
    const qty = Number(saleForm.quantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity sold.');
      return;
    }
    const price = Number(saleForm.sellingPrice) || 0;
    const amt = Number(saleForm.amount) || (qty * price);

    const lube = lubricants.find(l => l.id === saleForm.lubricantId);
    const cust = customers.find(c => c.id === saleForm.customerId);
    const inStock = getLubricantStockSummary().find(l => l.id === saleForm.lubricantId)?.closingStock ?? 0;
    if (qty > inStock) {
      toast.error(`Only ${inStock} pack(s) of ${lube?.name} in stock. Record the purchase first, or reduce the quantity.`);
      return;
    }
    let reasonGiven = '';
    if (isPastDateLocked(saleForm.date)) {
      reasonGiven = await requestReason({ title: 'Record a sale on a past date', date: saleForm.date, detail: 'This changes lubricant stock and that day\'s sales.' });
      if (!reasonGiven) return;
    }

    createLubricantSale({
      date: saleForm.date,
      lubricantId: saleForm.lubricantId,
      lubricantName: lube ? lube.name : 'Lubricant',
      quantity: qty,
      sellingPrice: price,
      amount: amt,
      paymentMode: saleForm.paymentMode,
      customerId: saleForm.customerId || null,
      customerName: cust ? cust.name : '',
      remarks: saleForm.remarks.trim(),
    });

    if (reasonGiven) addAuditLog({ date: saleForm.date, module: 'Lubricant Sale', action: 'Added late', reason: reasonGiven, summary: `${lube?.name}: ${qty} units` });
    toast.success(`Recorded sale of ${qty} units of ${lube?.name}.`);
    setSaleModal(false);
    refresh();
  };

  const handleDeleteVoucher = async () => {
    if (!deleteVoucherConfirm.id) return;
    const rec = (deleteVoucherConfirm.type === 'purchase' ? getAllLubricantPurchases() : getAllLubricantSales()).find(r => r.id === deleteVoucherConfirm.id);
    if (rec && isPastDateLocked(rec.date)) {
      const why = await requestReason({ title: 'Delete a past record', date: rec.date, detail: 'This changes lubricant stock for that day.', confirmLabel: 'Delete record', danger: true });
      if (!why) return;
      addAuditLog({ date: rec.date, module: deleteVoucherConfirm.type === 'purchase' ? 'Lubricant Purchase' : 'Lubricant Sale', action: 'Deleted', reason: why, summary: `${rec.lubricantName || ''} ${Number(rec.amount || 0).toLocaleString('en-IN')}` });
    }
    if (deleteVoucherConfirm.type === 'purchase') {
      deleteLubricantPurchase(deleteVoucherConfirm.id);
      toast.success('Purchase voucher deleted.');
    } else if (deleteVoucherConfirm.type === 'sale') {
      deleteLubricantSale(deleteVoucherConfirm.id);
      toast.success('Sale record deleted.');
    }
    setDeleteVoucherConfirm({ open: false, type: '', id: null });
    refresh();
  };

  if (detailView) {
    const selected = enrichedLubricants.find(l => l.id === detailView);
    if (!selected) {
      setDetailView(null);
      return null;
    }
    return (
      <LubricantDetail
        lubricant={selected}
        onBack={() => setDetailView(null)}
        onEdit={() => {
          setModal({ open: true, lubricant: selected });
          setDetailView(null);
        }}
        onDelete={() => promptDelete(selected)}
        onToggle={() => handleToggle(selected)}
        onPurchase={() => handleOpenAddPurchase(selected.id)}
        onSale={() => handleOpenAddSale(selected.id)}
      />
    );
  }

  return (
    <div>
      {reasonDialog}
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Lubricants & Stock' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Lubricants &amp; Packaged Stock</h1>
          <p>
            Separate from fuel. SKU-level stock tracking (Opening + Purchases - Sales = Closing Stock), retail sales, and vendor purchases.
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => handleOpenAddSale()}>
            <Icon name="list" /> Record Lube Sale
          </button>
          <button className="btn btn-secondary" onClick={() => handleOpenAddPurchase()}>
            <Icon name="inbox" /> Record Purchase
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ open: true, lubricant: null })}>
            + Add Lubricant
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', overflowX: 'auto', overflowY: 'hidden', marginBottom: 12, gap: 10 }}>
        <button
          type="button"
          className={`btn ${activeTab === 'catalog' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('catalog')}
        >
          🛢️ Products &amp; Stock Balance ({filtered.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'purchases' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('purchases')}
        >
          <Icon name="inbox" /> Purchase Bills ({purchases.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('sales')}
        >
          <Icon name="list" /> Sales Log ({sales.length})
        </button>
      </div>

      {/* TAB 1: CATALOG & REAL-TIME STOCK */}
      {activeTab === 'catalog' && (
        <div>
          <div className="toolbar" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search lubricants by name, brand, or category…"
              />
            </div>
            <select
              className="form-select"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="fuel"
              title="No lubricants found"
              message={search || filterCategory || filterStatus ? 'Try adjusting your search or filters.' : 'Add your first packaged lubricant product to track inventory.'}
              actionLabel="Add Lubricant"
              onAction={() => setModal({ open: true, lubricant: null })}
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Product Name &amp; Brand</th>
                    <th>Category</th>
                    <th>Pack Size</th>
                    <th style={{ textAlign: 'right' }}>Cost Price</th>
                    <th style={{ textAlign: 'right' }}>Retail Price</th>
                    <th style={{ textAlign: 'right' }}>Current Stock</th>
                    <th style={{ textAlign: 'right' }}>Stock Value</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lube => {
                    return (
                      <tr key={lube.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => setDetailView(lube.id)}
                            style={{
                              fontWeight: 700,
                              color: 'var(--color-primary)',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {lube.name}
                          </button>
                          {lube.brand && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lube.brand}</div>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-default" style={{ fontSize: 11 }}>
                            {lube.category || 'Lubricant'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{lube.packSize}</span> {lube.unit}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {INR(lube.purchasePrice)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {INR(lube.sellingPrice)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: lube.closingStock <= 5 ? 'var(--color-danger)' : 'var(--color-success)', fontSize: 13.5 }}>
                          {lube.closingStock} {lube.unit}s
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {INR(lube.stockValue)}
                        </td>
                        <td>
                          <StatusBadge status={lube.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Record Sale"
                              onClick={() => handleOpenAddSale(lube.id)}
                            >
                              <Icon name="list" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Record Purchase"
                              onClick={() => handleOpenAddPurchase(lube.id)}
                            >
                              <Icon name="inbox" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setModal({ open: true, lubricant: lube })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => promptDelete(lube)}
                              title="Delete Lubricant"
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PURCHASES */}
      {activeTab === 'purchases' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Lubricant Purchase Bills</h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Incoming vendor shipments. Purchases increase inventory count.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleOpenAddPurchase()}
            >
              + Record Purchase Bill
            </button>
          </div>

          {purchases.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No purchases recorded"
              message="Click '+ Record Purchase Bill' to log vendor lubricant deliveries."
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Lubricant Product</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Purchase Rate</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                    <th>Invoice / Ref</th>
                    <th>Remarks</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.date}</td>
                      <td>{p.supplier || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{p.lubricantName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                        + {p.quantity}
                      </td>
                      <td style={{ textAlign: 'right' }}>{INR(p.purchaseRate)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{INR(p.amount)}</td>
                      <td>{p.reference || '—'}</td>
                      <td>{p.remarks || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          onClick={() => setDeleteVoucherConfirm({ open: true, type: 'purchase', id: p.id })}
                        >
                          <Icon name="trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SALES */}
      {activeTab === 'sales' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Lubricant Sales Log</h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Counter and attendant sales. Sales deplete inventory count.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleOpenAddSale()}
            >
              + Record Lube Sale
            </button>
          </div>

          {sales.length === 0 ? (
            <EmptyState
              icon="list"
              title="No lubricant sales recorded"
              message="Click '+ Record Lube Sale' to log counter or shift lube sales."
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Quantity Sold</th>
                    <th style={{ textAlign: 'right' }}>Selling Price</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                    <th>Payment Mode</th>
                    <th>Customer (optional)</th>
                    <th>Remarks</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.date}</td>
                      <td style={{ fontWeight: 700 }}>{s.lubricantName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                        - {s.quantity}
                      </td>
                      <td style={{ textAlign: 'right' }}>{INR(s.sellingPrice)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{INR(s.amount)}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: 11 }}>
                          {s.paymentMode || 'Cash'}
                        </span>
                      </td>
                      <td>{s.customerName || 'Counter Cash'}</td>
                      <td>{s.remarks || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          onClick={() => setDeleteVoucherConfirm({ open: true, type: 'sale', id: s.id })}
                        >
                          <Icon name="trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT LUBRICANT MASTER */}
      {modal.open && (
        <LubricantFormModal
          lubricant={modal.lubricant}
          onClose={() => setModal({ open: false, lubricant: null })}
          onSave={handleSave}
        />
      )}

      {/* MODAL: RECORD LUBE PURCHASE */}
      <Modal
        open={purchaseModal}
        onClose={() => setPurchaseModal(false)}
        title="Record Lubricant Purchase Bill"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPurchaseModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSavePurchase}>
              Save Purchase Bill
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Purchase Date" required>
              <input
                type="date"
                className="form-input"
                value={purchaseForm.date}
                onChange={e => setPurchaseForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Supplier" required>
              <input
                type="text"
                placeholder="e.g. Servo Distributor / IOCL Depot"
                className="form-input"
                value={purchaseForm.supplier}
                onChange={e => setPurchaseForm(prev => ({ ...prev, supplier: e.target.value }))}
              />
            </FormGroup>
          </div>

          <FormGroup label="Lubricant Product" required>
            <select
              className="form-select"
              value={purchaseForm.lubricantId}
              onChange={e => {
                const lubeId = e.target.value;
                const lube = lubricants.find(l => l.id === lubeId);
                const cost = lube?.purchasePrice || 0;
                const qty = Number(purchaseForm.quantity) || 0;
                setPurchaseForm(prev => ({
                  ...prev,
                  lubricantId: lubeId,
                  purchaseRate: cost ? String(cost) : prev.purchaseRate,
                  amount: (qty * cost) > 0 ? (qty * cost).toFixed(2) : prev.amount,
                }));
              }}
            >
              <option value="">-- Select Product --</option>
              {lubricants.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.packSize} {l.unit})</option>
              ))}
            </select>
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
            <FormGroup label="Quantity (Packs)" required>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 20"
                className="form-input"
                value={purchaseForm.quantity}
                onChange={e => {
                  const val = e.target.value;
                  const rate = Number(purchaseForm.purchaseRate) || 0;
                  setPurchaseForm(prev => ({
                    ...prev,
                    quantity: val,
                    amount: (Number(val) * rate) > 0 ? (Number(val) * rate).toFixed(2) : prev.amount,
                  }));
                }}
              />
            </FormGroup>

            <FormGroup label="Cost Rate (₹/Pack)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 350"
                className="form-input"
                value={purchaseForm.purchaseRate}
                onChange={e => {
                  const rate = e.target.value;
                  const qty = Number(purchaseForm.quantity) || 0;
                  setPurchaseForm(prev => ({
                    ...prev,
                    purchaseRate: rate,
                    amount: (qty * Number(rate)) > 0 ? (qty * Number(rate)).toFixed(2) : prev.amount,
                  }));
                }}
              />
            </FormGroup>

            <FormGroup label="Total Amount (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 7000"
                className="form-input"
                style={{ fontWeight: 700, color: 'var(--color-primary)' }}
                value={purchaseForm.amount}
                onChange={e => setPurchaseForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </FormGroup>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Invoice / Bill #">
              <input
                type="text"
                placeholder="e.g. INV-92810"
                className="form-input"
                value={purchaseForm.reference}
                onChange={e => setPurchaseForm(prev => ({ ...prev, reference: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Remarks / Storage Bin">
              <input
                type="text"
                placeholder="e.g. Received in Store Room Rack B"
                className="form-input"
                value={purchaseForm.remarks}
                onChange={e => setPurchaseForm(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </FormGroup>
          </div>
        </div>
      </Modal>

      {/* MODAL: RECORD LUBE SALE */}
      <Modal
        open={saleModal}
        onClose={() => setSaleModal(false)}
        title="Record Lubricant Retail Sale"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setSaleModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveSale}>
              Save Sale Record
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10 }}>
            <FormGroup label="Sale Date" required>
              <input
                type="date"
                className="form-input"
                value={saleForm.date}
                onChange={e => setSaleForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Payment Mode" required>
              <select
                className="form-select"
                value={saleForm.paymentMode}
                onChange={e => setSaleForm(prev => ({ ...prev, paymentMode: e.target.value }))}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / QR</option>
                <option value="Card">Card Swipe</option>
                <option value="Paytm">Paytm</option>
                <option value="Udhaar">Udhaar / Credit</option>
              </select>
            </FormGroup>
          </div>

          <FormGroup label="Lubricant Product" required>
            <select
              className="form-select"
              value={saleForm.lubricantId}
              onChange={e => {
                const lubeId = e.target.value;
                const lube = lubricants.find(l => l.id === lubeId);
                const retailPrice = lube?.sellingPrice || 0;
                const qty = Number(saleForm.quantity) || 0;
                setSaleForm(prev => ({
                  ...prev,
                  lubricantId: lubeId,
                  sellingPrice: retailPrice ? String(retailPrice) : prev.sellingPrice,
                  amount: (qty * retailPrice) > 0 ? (qty * retailPrice).toFixed(2) : prev.amount,
                }));
              }}
            >
              <option value="">-- Select Product --</option>
              {enrichedLubricants.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name} — In Stock: {l.closingStock} {l.unit}s @ ₹{l.sellingPrice}
                </option>
              ))}
            </select>
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
            <FormGroup label="Quantity (Packs)" required>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 1"
                className="form-input"
                value={saleForm.quantity}
                onChange={e => {
                  const val = e.target.value;
                  const price = Number(saleForm.sellingPrice) || 0;
                  setSaleForm(prev => ({
                    ...prev,
                    quantity: val,
                    amount: (Number(val) * price) > 0 ? (Number(val) * price).toFixed(2) : prev.amount,
                  }));
                }}
              />
            </FormGroup>

            <FormGroup label="Selling Rate (₹/Pack)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 420"
                className="form-input"
                value={saleForm.sellingPrice}
                onChange={e => {
                  const price = e.target.value;
                  const qty = Number(saleForm.quantity) || 0;
                  setSaleForm(prev => ({
                    ...prev,
                    sellingPrice: price,
                    amount: (qty * Number(price)) > 0 ? (qty * Number(price)).toFixed(2) : prev.amount,
                  }));
                }}
              />
            </FormGroup>

            <FormGroup label="Total Amount (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 420"
                className="form-input"
                style={{ fontWeight: 700, color: 'var(--color-success)' }}
                value={saleForm.amount}
                onChange={e => setSaleForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </FormGroup>
          </div>

          <FormGroup label="Customer (optional / for Udhaar billing)">
            <select
              className="form-select"
              value={saleForm.customerId}
              onChange={e => setSaleForm(prev => ({ ...prev, customerId: e.target.value }))}
            >
              <option value="">Counter Customer (Cash / Walk-in)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.mobile})</option>
              ))}
            </select>
          </FormGroup>

          <FormGroup label="Remarks / Vehicle No">
            <input
              type="text"
              placeholder="e.g. Swift Dzire oil top-up, Bay 2"
              className="form-input"
              value={saleForm.remarks}
              onChange={e => setSaleForm(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </FormGroup>
        </div>
      </Modal>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        open={deleteVoucherConfirm.open}
        onClose={() => setDeleteVoucherConfirm({ open: false, type: '', id: null })}
        title="Delete Voucher"
        message="Are you sure you want to delete this lubricant voucher? Stock balance will be updated automatically."
        onConfirm={handleDeleteVoucher}
      />

      {deleteModal.open && (
        <DeleteConfirmModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, lubricant: null, check: { canDelete: true } })}
          onDelete={confirmDelete}
          onDeactivate={() => {
            if (deleteModal.lubricant) handleToggle(deleteModal.lubricant);
          }}
          title={`Delete ${deleteModal.lubricant?.name}?`}
          recordName={deleteModal.lubricant?.name}
          canDeleteResult={deleteModal.check}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────

function LubricantDetail({ lubricant, onBack, onEdit, onDelete, onToggle, onPurchase, onSale }) {
  const margin = (lubricant.sellingPrice || 0) - (lubricant.purchasePrice || 0);
  const marginPct = lubricant.purchasePrice > 0 ? ((margin / lubricant.purchasePrice) * 100).toFixed(1) : 0;

  return (
    <div>
      {reasonDialog}
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Lubricants', onClick: onBack },
              { label: lubricant.name },
            ]}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <h1 style={{ margin: 0 }}>{lubricant.name}</h1>
            <StatusBadge status={lubricant.status} />
          </div>
          <p>{lubricant.brand ? `${lubricant.brand} • ` : ''}{lubricant.category || 'Lubricant Product'}</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back to List</button>
          <button className="btn btn-secondary" onClick={onPurchase}>+ Record Purchase</button>
          <button className="btn btn-secondary" onClick={onSale}>+ Record Sale</button>
          <button className="btn btn-ghost" onClick={onToggle}>
            {lubricant.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button className="btn btn-primary" onClick={onEdit}>Edit</button>
          <button className="btn btn-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 10, marginBottom: 14 }}>
        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Packaging &amp; Unit</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {lubricant.packSize} <span style={{ fontSize: 15, fontWeight: 500 }}>{lubricant.unit}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Sold as individual {lubricant.unit.toLowerCase()} packs
          </div>
        </div>

        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Current Available Stock</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: lubricant.closingStock <= 5 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {lubricant.closingStock} {lubricant.unit}s
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Opening ({lubricant.openingStock}) + Purchases ({lubricant.purchases}) - Sales ({lubricant.sales})
          </div>
        </div>

        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Purchase Price (Cost)</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {INR(lubricant.purchasePrice)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Per pack</div>
        </div>

        <div className="section-block">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Retail Price &amp; Margin</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {INR(lubricant.sellingPrice)}
          </div>
          <div style={{ fontSize: 12, color: margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)', marginTop: 4 }}>
            Margin: {INR(margin)} ({marginPct}%)
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LUBRICANT FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────

function LubricantFormModal({ lubricant, onClose, onSave }) {
  const [form, setForm] = useState({
    name: lubricant?.name || '',
    brand: lubricant?.brand || '',
    category: lubricant?.category || CATEGORIES[0],
    packSize: lubricant?.packSize || '1',
    unit: lubricant?.unit || UNITS[0],
    purchasePrice: lubricant?.purchasePrice !== undefined ? String(lubricant.purchasePrice) : '',
    sellingPrice: lubricant?.sellingPrice !== undefined ? String(lubricant.sellingPrice) : '',
    openingStock: lubricant?.openingStock !== undefined && lubricant?.openingStock !== null ? String(lubricant.openingStock) : '12',
    status: lubricant?.status || 'active',
    remarks: lubricant?.remarks || '',
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Lubricant name is required';
    if (!form.packSize || Number(form.packSize) <= 0) errs.packSize = 'Valid pack size required';
    if (form.openingStock !== '' && (!Number.isFinite(Number(form.openingStock)) || Number(form.openingStock) < 0)) errs.openingStock = 'Opening stock cannot be negative';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      packSize: Number(form.packSize) || 1,
      unit: form.unit,
      purchasePrice: Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      openingStock: Number(form.openingStock) || 0,
      status: form.status,
      remarks: form.remarks.trim(),
    });
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={lubricant ? 'Edit Lubricant' : 'Add Lubricant Product'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="lube-form" className="btn btn-primary">
            {lubricant ? 'Update Lubricant' : 'Save Lubricant'}
          </button>
        </>
      }
    >
      <form id="lube-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormGroup label="Lubricant Name" required error={errors.name}>
          <input
            type="text"
            className={`form-input ${errors.name ? 'error' : ''}`}
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Castrol GTX 15W-40, Servo Pride 20W-40"
            autoFocus
          />
        </FormGroup>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormGroup label="Brand / Manufacturer">
            <input
              type="text"
              className="form-input"
              value={form.brand}
              onChange={e => setForm(prev => ({ ...prev, brand: e.target.value }))}
              placeholder="e.g. Castrol, Servo, Shell, Mak, HP"
            />
          </FormGroup>

          <FormGroup label="Category / Type">
            <select
              className="form-select"
              value={form.category}
              onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </FormGroup>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormGroup label="Pack Size" required error={errors.packSize} hint="e.g. 1, 5, 20">
            <input
              type="text"
              inputMode="decimal"
              className={`form-input ${errors.packSize ? 'error' : ''}`}
              value={form.packSize}
              onChange={e => setForm(prev => ({ ...prev, packSize: e.target.value }))}
              placeholder="1"
            />
          </FormGroup>

          <FormGroup label="Unit" required hint="Measurement unit">
            <select
              className="form-select"
              value={form.unit}
              onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
            >
              {UNITS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </FormGroup>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormGroup label="Purchase Cost Price (₹)" hint="Cost price per pack">
            <input
              type="text"
              inputMode="decimal"
              className="form-input"
              value={form.purchasePrice}
              onChange={e => setForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
              placeholder="0.00"
            />
          </FormGroup>

          <FormGroup label="Retail Selling Price (₹)" hint="Retail price per pack">
            <input
              type="text"
              inputMode="decimal"
              className="form-input"
              value={form.sellingPrice}
              onChange={e => setForm(prev => ({ ...prev, sellingPrice: e.target.value }))}
              placeholder="0.00"
            />
          </FormGroup>
        </div>

        <FormGroup label="Opening stock (packs)" hint="Packs on the shelf when you start tracking. Purchases and sales are added to this." error={errors.openingStock}>
          <input
            type="text"
            inputMode="decimal"
            className="form-input"
            value={form.openingStock}
            onChange={e => setForm(prev => ({ ...prev, openingStock: e.target.value }))}
            placeholder="0"
          />
        </FormGroup>

        <FormGroup label="Status">
          <select
            className="form-select"
            value={form.status}
            onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormGroup>

        <FormGroup label="Remarks / Specs">
          <textarea
            className="form-textarea"
            rows={2}
            value={form.remarks}
            onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
            placeholder="Viscosity grade, application notes, or storage bin location…"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
