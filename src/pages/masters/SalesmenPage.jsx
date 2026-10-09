import { useState, useEffect, useCallback } from 'react';
import {
  getSalesmen, createSalesman, updateSalesman, setSalesmanStatus,
  canDeleteSalesman, deleteSalesman,
} from '../../data/repository.js';
import {
  Modal, StatusBadge, FormGroup, EmptyState, SearchInput,
  useToast, Breadcrumbs, DeleteConfirmModal, ConfirmDialog,
} from '../../components/ui/UIComponents.jsx';

export default function SalesmenPage() {
  const toast = useToast();
  const [salesmen, setSalesmen] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState({ open: false, salesman: null });
  const [deactivateModal, setDeactivateModal] = useState({ open: false, salesman: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, salesman: null, check: { canDelete: true } });

  const refresh = useCallback(() => setSalesmen(getSalesmen()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = salesmen.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.mobile?.includes(q)) return false;
    }
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const handleSave = (formData) => {
    if (modal.salesman) {
      updateSalesman(modal.salesman.id, formData);
      toast.success('Salesman updated successfully');
    } else {
      createSalesman(formData);
      toast.success('Salesman added successfully');
    }
    refresh();
    setModal({ open: false, salesman: null });
  };

  const handleToggle = (salesman) => {
    const newStatus = salesman.status === 'active' ? 'inactive' : 'active';
    setSalesmanStatus(salesman.id, newStatus);
    toast.success(`Salesman ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    refresh();
  };

  const promptDelete = (salesman) => {
    const check = canDeleteSalesman(salesman.id);
    setDeleteModal({ open: true, salesman, check });
  };

  const confirmDelete = () => {
    if (!deleteModal.salesman) return;
    try {
      deleteSalesman(deleteModal.salesman.id);
      toast.success('Salesman deleted successfully');
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to delete salesman');
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Salesmen' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Salesmen</h1>
          <p>Manage fuel station staff and pump attendants. Inactive salesmen are excluded from operational shift entries.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setModal({ open: true, salesman: null })}>
            + Add Salesman
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
          <EmptyState icon="users" title="No salesmen found" description="Add your first salesman or adjust filters." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Joining Date</th>
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
                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(s.joiningDate)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.remarks || '—'}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setModal({ open: true, salesman: s })}
                        >
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${s.status === 'active' ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => {
                            if (s.status === 'active') {
                              setDeactivateModal({ open: true, salesman: s });
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
                          title="Delete Salesman"
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
        Showing {filtered.length} of {salesmen.length} salesmen
      </div>

      {modal.open && (
        <SalesmanFormModal
          salesman={modal.salesman}
          onClose={() => setModal({ open: false, salesman: null })}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={deactivateModal.open}
        onClose={() => setDeactivateModal({ open: false, salesman: null })}
        onConfirm={() => handleToggle(deactivateModal.salesman)}
        title="Deactivate Salesman?"
        message={`"${deactivateModal.salesman?.name}" will be hidden from daily shift and collection entries. Historical records remain intact.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        icon="alert"
      />

      {deleteModal.open && (
        <DeleteConfirmModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, salesman: null, check: { canDelete: true } })}
          onDelete={confirmDelete}
          onDeactivate={() => {
            if (deleteModal.salesman) handleToggle(deleteModal.salesman);
          }}
          title={`Delete ${deleteModal.salesman?.name}?`}
          recordName={deleteModal.salesman?.name}
          canDeleteResult={deleteModal.check}
        />
      )}
    </div>
  );
}

function SalesmanFormModal({ salesman, onClose, onSave }) {
  const [name, setName] = useState(salesman?.name ?? '');
  const [mobile, setMobile] = useState(salesman?.mobile ?? '');
  const [joiningDate, setJoiningDate] = useState(salesman?.joiningDate ?? '');
  const [remarks, setRemarks] = useState(salesman?.remarks ?? '');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (mobile && !/^\d{10}$/.test(mobile.replace(/\D/g, ''))) {
      errs.mobile = 'Enter a valid 10-digit mobile number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ name: name.trim(), mobile: mobile.trim(), joiningDate, remarks: remarks.trim() });
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={salesman ? 'Edit Salesman' : 'Add Salesman'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="salesman-form" className="btn btn-primary">
            {salesman ? 'Update Salesman' : 'Add Salesman'}
          </button>
        </>
      }
    >
      <form id="salesman-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormGroup label="Full Name" required error={errors.name}>
          <input
            type="text"
            className={`form-input ${errors.name ? 'error' : ''}`}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Attendant / staff name"
            autoFocus
          />
        </FormGroup>

        <FormGroup label="Mobile Number" error={errors.mobile} hint="10-digit mobile number">
          <input
            type="tel"
            className={`form-input ${errors.mobile ? 'error' : ''}`}
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            placeholder="e.g. 9876543210"
          />
        </FormGroup>

        <FormGroup label="Joining Date">
          <input
            type="date"
            className="form-input"
            value={joiningDate}
            onChange={e => setJoiningDate(e.target.value)}
          />
        </FormGroup>

        <FormGroup label="Remarks">
          <textarea
            className="form-textarea"
            rows={2}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Shift preference, ID proof notes…"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
