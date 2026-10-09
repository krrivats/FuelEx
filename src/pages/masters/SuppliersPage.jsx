import { useState, useEffect, useCallback } from 'react';
import {
  getSuppliers, createSupplier, updateSupplier, setSupplierStatus,
  canDeleteSupplier, deleteSupplier,
} from '../../data/repository.js';
import {
  Modal, StatusBadge, FormGroup, EmptyState, SearchInput,
  useToast, Breadcrumbs, DeleteConfirmModal, ConfirmDialog,
} from '../../components/ui/UIComponents.jsx';

export default function SuppliersPage() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState({ open: false, supplier: null });
  const [deactivateModal, setDeactivateModal] = useState({ open: false, supplier: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, supplier: null, check: { canDelete: true } });

  const refresh = useCallback(() => setSuppliers(getSuppliers()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = suppliers.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.mobile?.includes(q)) return false;
    }
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const handleSave = (formData) => {
    if (modal.supplier) {
      updateSupplier(modal.supplier.id, formData);
      toast.success('Supplier updated successfully');
    } else {
      createSupplier(formData);
      toast.success('Supplier added successfully');
    }
    refresh();
    setModal({ open: false, supplier: null });
  };

  const handleToggle = (supplier) => {
    const newStatus = supplier.status === 'active' ? 'inactive' : 'active';
    setSupplierStatus(supplier.id, newStatus);
    toast.success(`Supplier ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    refresh();
  };

  const promptDelete = (supplier) => {
    const check = canDeleteSupplier(supplier.id);
    setDeleteModal({ open: true, supplier, check });
  };

  const confirmDelete = () => {
    if (!deleteModal.supplier) return;
    try {
      deleteSupplier(deleteModal.supplier.id);
      toast.success('Supplier deleted successfully');
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to delete supplier');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Suppliers' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Suppliers</h1>
          <p>Oil marketing companies, fuel vendors, and lubricant suppliers. Inactive suppliers are hidden from purchase bills.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setModal({ open: true, supplier: null })}>
            + Add Supplier
          </button>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or mobile…" />
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState icon="fuel" title="No suppliers found" description="Add your first supplier or adjust filters." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Mobile</th>
                  <th>Remarks</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{s.mobile || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.remarks || '—'}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setModal({ open: true, supplier: s })}
                        >
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${s.status === 'active' ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => {
                            if (s.status === 'active') {
                              setDeactivateModal({ open: true, supplier: s });
                            } else {
                              handleToggle(s);
                            }
                          }}
                        >
                          {s.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => promptDelete(s)}
                          title="Delete Supplier"
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
        Showing {filtered.length} of {suppliers.length} suppliers
      </div>

      {modal.open && (
        <SupplierFormModal
          supplier={modal.supplier}
          onClose={() => setModal({ open: false, supplier: null })}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={deactivateModal.open}
        onClose={() => setDeactivateModal({ open: false, supplier: null })}
        onConfirm={() => handleToggle(deactivateModal.supplier)}
        title="Deactivate Supplier?"
        message={`"${deactivateModal.supplier?.name}" will be hidden from new purchase entries. Historical records remain intact.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        icon="alert"
      />

      {deleteModal.open && (
        <DeleteConfirmModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, supplier: null, check: { canDelete: true } })}
          onDelete={confirmDelete}
          onDeactivate={() => {
            if (deleteModal.supplier) handleToggle(deleteModal.supplier);
          }}
          title={`Delete ${deleteModal.supplier?.name}?`}
          recordName={deleteModal.supplier?.name}
          canDeleteResult={deleteModal.check}
        />
      )}
    </div>
  );
}

function SupplierFormModal({ supplier, onClose, onSave }) {
  const [name, setName] = useState(supplier?.name ?? '');
  const [mobile, setMobile] = useState(supplier?.mobile ?? '');
  const [remarks, setRemarks] = useState(supplier?.remarks ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Supplier name is required');
      return;
    }
    onSave({ name: name.trim(), mobile: mobile.trim(), remarks: remarks.trim() });
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={supplier ? 'Edit Supplier' : 'Add Supplier'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="supplier-form" className="btn btn-primary">
            {supplier ? 'Update Supplier' : 'Add Supplier'}
          </button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormGroup label="Supplier Name" required error={error}>
          <input
            type="text"
            className={`form-input ${error ? 'error' : ''}`}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Indian Oil Corporation, BPCL Terminal, Servo Lubricants"
            autoFocus
          />
        </FormGroup>

        <FormGroup label="Contact / Mobile Number" hint="Representative or office contact">
          <input
            type="tel"
            className="form-input"
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            placeholder="e.g. 9876543210"
          />
        </FormGroup>

        <FormGroup label="Remarks / Supply Details">
          <textarea
            className="form-textarea"
            rows={2}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Depot code, sales officer name, supply terms…"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
