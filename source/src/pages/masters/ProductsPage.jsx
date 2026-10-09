import { useState, useEffect, useCallback } from 'react';
import {
  getProducts, createProduct, updateProduct, setProductStatus,
  canDeleteProduct, deleteProduct,
} from '../../data/repository.js';
import {
  Modal, StatusBadge, FormGroup, EmptyState, SearchInput,
  useToast, Breadcrumbs, DeleteConfirmModal, ConfirmDialog,
} from '../../components/ui/UIComponents.jsx';

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState({ open: false, product: null });
  const [deactivateModal, setDeactivateModal] = useState({ open: false, product: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, product: null, check: { canDelete: true } });

  const refresh = useCallback(() => setProducts(getProducts()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  const handleSave = (formData) => {
    if (modal.product) {
      updateProduct(modal.product.id, formData);
      toast.success('Product updated successfully');
    } else {
      createProduct(formData);
      toast.success('Product added successfully');
    }
    refresh();
    setModal({ open: false, product: null });
  };

  const handleToggle = (product) => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    setProductStatus(product.id, newStatus);
    toast.success(`Product ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    refresh();
  };

  const promptDelete = (product) => {
    const check = canDeleteProduct(product.id);
    setDeleteModal({ open: true, product, check });
  };

  const confirmDelete = () => {
    if (!deleteModal.product) return;
    try {
      deleteProduct(deleteModal.product.id);
      toast.success('Product deleted successfully');
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to delete product');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Fuel Products' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Fuel Products</h1>
          <p>
            Manage dispensed fuel products (Petrol, Diesel, Speed Petrol).
            Lubricant oils and packaged goods are managed in the separate Lubricants master.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setModal({ open: true, product: null })}>
            + Add Product
          </button>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search fuel products…" />
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState icon="fuel" title="No products found" description="Add fuel products or adjust filters." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Unit</th>
                  <th>Remarks</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.unit}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.remarks || '—'}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setModal({ open: true, product: p })}
                        >
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${p.status === 'active' ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => {
                            if (p.status === 'active') {
                              setDeactivateModal({ open: true, product: p });
                            } else {
                              handleToggle(p);
                            }
                          }}
                        >
                          {p.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => promptDelete(p)}
                          title="Delete Product"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Showing {filtered.length} of {products.length} fuel products
      </div>

      {modal.open && (
        <ProductFormModal
          product={modal.product}
          onClose={() => setModal({ open: false, product: null })}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={deactivateModal.open}
        onClose={() => setDeactivateModal({ open: false, product: null })}
        onConfirm={() => handleToggle(deactivateModal.product)}
        title="Deactivate Fuel Product?"
        message={`"${deactivateModal.product?.name}" will be hidden from new transaction entries. Historical records remain intact.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        icon="alert"
      />

      {deleteModal.open && (
        <DeleteConfirmModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, product: null, check: { canDelete: true } })}
          onDelete={confirmDelete}
          onDeactivate={() => {
            if (deleteModal.product) handleToggle(deleteModal.product);
          }}
          title={`Delete ${deleteModal.product?.name}?`}
          recordName={deleteModal.product?.name}
          canDeleteResult={deleteModal.check}
        />
      )}
    </div>
  );
}

function ProductFormModal({ product, onClose, onSave }) {
  const [name, setName] = useState(product?.name ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'Litre');
  const [remarks, setRemarks] = useState(product?.remarks ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    onSave({ name: name.trim(), unit: unit.trim(), remarks: remarks.trim() });
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={product ? 'Edit Fuel Product' : 'Add Fuel Product'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="product-form" className="btn btn-primary">
            {product ? 'Update Product' : 'Add Product'}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormGroup label="Product Name" required error={error} hint="e.g. Petrol, Diesel, Speed Petrol, CNG">
          <input
            type="text"
            className={`form-input ${error ? 'error' : ''}`}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Product name"
            autoFocus
          />
        </FormGroup>

        <FormGroup label="Measurement Unit" required>
          <select className="form-select" value={unit} onChange={e => setUnit(e.target.value)}>
            <option value="Litre">Litre</option>
            <option value="Kg">Kg</option>
            <option value="Gallon">Gallon</option>
          </select>
        </FormGroup>

        <FormGroup label="Remarks / Specifications">
          <textarea
            className="form-textarea"
            rows={2}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Density specifications or storage notes…"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
