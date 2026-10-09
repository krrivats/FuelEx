import { localDate } from '../../utils/dates.js';
import { useState, useEffect, useCallback } from 'react';
import {
  getPriceHistory, getProducts, addPriceHistory, updatePriceHistory, deletePriceHistory,
  getApplicablePrice, canDeletePrice,
} from '../../data/repository.js';
import {
  Modal, FormGroup, EmptyState, SearchInput,
  useToast, Breadcrumbs, DeleteConfirmModal,
} from '../../components/ui/UIComponents.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PricesPage() {
  const toast = useToast();
  const [history, setHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [modal, setModal] = useState({ open: false, entry: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, entry: null, check: { canDelete: true } });

  const refresh = useCallback(() => {
    setHistory(getPriceHistory().sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)));
    setProducts(getProducts());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = history.filter(h => {
    const product = products.find(p => p.id === h.productId);
    if (search) {
      const q = search.toLowerCase();
      if (!product?.name.toLowerCase().includes(q) && !h.effectiveDate.includes(q)) return false;
    }
    if (filterProduct && h.productId !== filterProduct) return false;
    return true;
  });

  const handleSave = (formData) => {
    if (modal.entry) {
      updatePriceHistory(modal.entry.id, formData);
      toast.success('Price entry updated successfully');
    } else {
      addPriceHistory(formData);
      toast.success('Price entry recorded successfully');
    }
    refresh();
    setModal({ open: false, entry: null });
  };

  const promptDelete = (entry) => {
    const check = canDeletePrice(entry.id);
    setDeleteModal({ open: true, entry, check });
  };

  const confirmDelete = () => {
    if (!deleteModal.entry) return;
    try {
      deletePriceHistory(deleteModal.entry.id);
      toast.success('Price entry deleted successfully');
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to delete price entry');
    }
  };

  const today = localDate();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Price History' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Price History</h1>
          <p>
            Historical fuel selling and purchase prices by effective date. Prices are immutable — changes create a new entry.
            The applicable price for any shift or billing is the latest entry where Effective Date ≤ transaction date.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setModal({ open: true, entry: null })}>
            + Add Price Entry
          </button>
        </div>
      </div>

      {/* Current prices summary cards */}
      {products.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, marginBottom: 12 }}>
          {products.map(p => {
            const current = getApplicablePrice(p.id, today);
            const margin = current ? (current.sellingPrice - current.purchaseCost) : 0;
            return (
              <div key={p.id} className="section-block">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{p.name}</div>
                {current ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                      {INR(current.sellingPrice)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Cost: {INR(current.purchaseCost)} · Margin: {INR(margin)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Effective from: {current.effectiveDate}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No price set</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by product or date (YYYY-MM-DD)…" />
        <select className="filter-select" value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
          <option value="">All Products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState icon="cash" title="No price history found" description="Add a price entry for your fuel products." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Effective Date</th>
                  <th>Selling Price / L</th>
                  <th>Purchase Cost / L</th>
                  <th>Margin / L</th>
                  <th>Remarks</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => {
                  const product = products.find(p => p.id === entry.productId);
                  const margin = (entry.sellingPrice || 0) - (entry.purchaseCost || 0);
                  return (
                    <tr key={entry.id}>
                      <td style={{ fontWeight: 600 }}>{product?.name ?? 'Unknown Product'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{entry.effectiveDate}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{INR(entry.sellingPrice)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{INR(entry.purchaseCost)}</td>
                      <td>
                        <span style={{
                          color: margin >= 0 ? 'var(--success)' : 'var(--danger)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                        }}>
                          {INR(margin)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{entry.remarks || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setModal({ open: true, entry })}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => promptDelete(entry)}
                            title="Delete Price Entry"
                          >
                            Delete
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

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Showing {filtered.length} of {history.length} price entries
      </div>

      {modal.open && (
        <PriceModal
          entry={modal.entry}
          products={products}
          onClose={() => setModal({ open: false, entry: null })}
          onSave={handleSave}
        />
      )}

      {deleteModal.open && (
        <DeleteConfirmModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, entry: null, check: { canDelete: true } })}
          onDelete={confirmDelete}
          title="Delete Price Entry?"
          recordName={deleteModal.entry ? `${products.find(p => p.id === deleteModal.entry.productId)?.name || 'Price'} (${deleteModal.entry.effectiveDate})` : 'Price Entry'}
          canDeleteResult={deleteModal.check}
        />
      )}
    </div>
  );
}

function PriceModal({ entry, products, onClose, onSave }) {
  const today = localDate();
  const [productId, setProductId] = useState(entry?.productId ?? (products[0]?.id ?? ''));
  const [effectiveDate, setEffectiveDate] = useState(entry?.effectiveDate ?? today);
  const [sellingPrice, setSellingPrice] = useState(entry?.sellingPrice ?? '');
  const [purchaseCost, setPurchaseCost] = useState(entry?.purchaseCost ?? '');
  const [remarks, setRemarks] = useState(entry?.remarks ?? '');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!productId) errs.productId = 'Product is required';
    if (!effectiveDate) errs.effectiveDate = 'Effective date is required';
    if (!sellingPrice || Number(sellingPrice) <= 0) errs.sellingPrice = 'Enter valid selling price';
    if (!purchaseCost || Number(purchaseCost) <= 0) errs.purchaseCost = 'Enter valid purchase cost';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      productId,
      effectiveDate,
      sellingPrice: Number(sellingPrice),
      purchaseCost: Number(purchaseCost),
      remarks: remarks.trim(),
    });
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={entry ? 'Edit Price Entry' : 'Add Fuel Price Entry'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="price-form" className="btn btn-primary">
            {entry ? 'Update Price' : 'Save Price'}
          </button>
        </>
      }
    >
      <form id="price-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormGroup label="Fuel Product" required error={errors.productId}>
          <select
            className="form-select"
            value={productId}
            onChange={e => setProductId(e.target.value)}
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </FormGroup>

        <FormGroup label="Effective Date" required error={errors.effectiveDate} hint="Date this price becomes active">
          <input
            type="date"
            className={`form-input ${errors.effectiveDate ? 'error' : ''}`}
            value={effectiveDate}
            onChange={e => setEffectiveDate(e.target.value)}
          />
        </FormGroup>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormGroup label="Purchase Cost (₹/L)" required error={errors.purchaseCost}>
            <input
              type="text"
              inputMode="decimal"
              className={`form-input ${errors.purchaseCost ? 'error' : ''}`}
              value={purchaseCost}
              onChange={e => setPurchaseCost(e.target.value)}
              placeholder="0.00"
            />
          </FormGroup>

          <FormGroup label="Selling Price (₹/L)" required error={errors.sellingPrice}>
            <input
              type="text"
              inputMode="decimal"
              className={`form-input ${errors.sellingPrice ? 'error' : ''}`}
              value={sellingPrice}
              onChange={e => setSellingPrice(e.target.value)}
              placeholder="0.00"
            />
          </FormGroup>
        </div>

        <FormGroup label="Remarks / Circular Number">
          <textarea
            className="form-textarea"
            rows={2}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="IOCL / BPCL revision notification, VAT adjustment notes…"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
