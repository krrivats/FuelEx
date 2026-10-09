import { useState, useEffect, useCallback } from 'react';
import {
  getCustomers, createCustomer, updateCustomer, setCustomerStatus,
  getCustomerCreditStatus, canDeleteCustomer, deleteCustomer,
} from '../../data/repository.js';
import {
  Modal, StatusBadge, CreditStatusBadge, FormGroup, EmptyState, SearchInput,
  useToast, Breadcrumbs, DeleteConfirmModal, ConfirmDialog,
} from '../../components/ui/UIComponents.jsx';
import Icon from '../../components/ui/Icon.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

export default function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState({ open: false, customer: null });
  const [detailView, setDetailView] = useState(null);
  const [deactivateModal, setDeactivateModal] = useState({ open: false, customer: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, customer: null, check: { canDelete: true } });

  const refresh = useCallback(() => setCustomers(getCustomers()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = customers.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.mobile?.includes(q) && !c.address?.toLowerCase().includes(q)) return false;
    }
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  const handleSave = (formData) => {
    if (modal.customer) {
      updateCustomer(modal.customer.id, formData);
      toast.success('Customer updated successfully');
    } else {
      createCustomer(formData);
      toast.success('Customer added successfully');
    }
    refresh();
    setModal({ open: false, customer: null });
  };

  const handleToggle = (customer) => {
    const newStatus = customer.status === 'active' ? 'inactive' : 'active';
    setCustomerStatus(customer.id, newStatus);
    toast.success(`Customer ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    refresh();
  };

  const promptDelete = (customer) => {
    const check = canDeleteCustomer(customer.id);
    setDeleteModal({ open: true, customer, check });
  };

  const confirmDelete = () => {
    if (!deleteModal.customer) return;
    try {
      deleteCustomer(deleteModal.customer.id);
      toast.success('Customer deleted successfully');
      if (detailView === deleteModal.customer.id) setDetailView(null);
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to delete customer');
    }
  };

  if (detailView) {
    const customer = customers.find(c => c.id === detailView);
    if (!customer) { setDetailView(null); return null; }
    return (
      <CustomerDetail
        customer={customer}
        onBack={() => setDetailView(null)}
        onEdit={() => { setModal({ open: true, customer }); setDetailView(null); }}
        onToggle={() => handleToggle(customer)}
        onDelete={() => promptDelete(customer)}
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Customers' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Customers</h1>
          <p>Credit customers, commercial fleets, and udhaar accounts. Credit limits and billing will link to the ledger in future stages.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setModal({ open: true, customer: null })}>
            + Add Customer
          </button>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, mobile, or address…" />
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState icon="bank" title="No customers found" description="Add your first customer account or adjust filters." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Mobile</th>
                  <th>Credit Limit</th>
                  <th>Outstanding</th>
                  <th>Credit Status</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const cs = getCustomerCreditStatus(c, 0);
                  return (
                    <tr key={c.id}>
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => setDetailView(c.id)}
                          style={{
                            fontWeight: 600,
                            color: 'var(--color-primary)',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          {c.name}
                        </button>
                        {c.address && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.address}</div>}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{c.mobile || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{INR(c.creditLimit)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{INR(0)}</td>
                      <td><CreditStatusBadge creditStatus={cs.status} /></td>
                      <td><StatusBadge status={c.status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDetailView(c.id)}>View</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ open: true, customer: c })}>Edit</button>
                          <button
                            className={`btn btn-sm ${c.status === 'active' ? 'btn-ghost' : 'btn-success'}`}
                            onClick={() => {
                              if (c.status === 'active') {
                                setDeactivateModal({ open: true, customer: c });
                              } else {
                                handleToggle(c);
                              }
                            }}
                          >
                            {c.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => promptDelete(c)}
                            title="Delete Customer"
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
        Showing {filtered.length} of {customers.length} customers
      </div>

      {modal.open && (
        <CustomerFormModal
          customer={modal.customer}
          onClose={() => setModal({ open: false, customer: null })}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={deactivateModal.open}
        onClose={() => setDeactivateModal({ open: false, customer: null })}
        onConfirm={() => handleToggle(deactivateModal.customer)}
        title="Deactivate Customer?"
        message={`"${deactivateModal.customer?.name}" will be hidden from new credit billing. Account history and past udhaar records remain intact.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        icon="alert"
      />

      {deleteModal.open && (
        <DeleteConfirmModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, customer: null, check: { canDelete: true } })}
          onDelete={confirmDelete}
          onDeactivate={() => {
            if (deleteModal.customer) handleToggle(deleteModal.customer);
          }}
          title={`Delete ${deleteModal.customer?.name}?`}
          recordName={deleteModal.customer?.name}
          canDeleteResult={deleteModal.check}
        />
      )}
    </div>
  );
}

function CustomerDetail({ customer, onBack, onEdit, onToggle, onDelete }) {
  const cs = getCustomerCreditStatus(customer, 0);
  const outstanding = 0;
  const available = customer.creditLimit > 0 ? Math.max(0, customer.creditLimit - outstanding) : null;
  const usedRatio = customer.creditLimit > 0 ? Math.min(1, outstanding / customer.creditLimit) : 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Customers', onClick: onBack },
              { label: customer.name },
            ]}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <h1 style={{ margin: 0 }}>{customer.name}</h1>
            <StatusBadge status={customer.status} />
          </div>
          <p>{customer.mobile ? `${customer.mobile} • ` : ''}{customer.address || 'Customer Profile'}</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back to List</button>
          <button className="btn btn-ghost" onClick={onToggle}>
            {customer.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button className="btn btn-primary" onClick={onEdit}>Edit</button>
          <button className="btn btn-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div className="section-block" style={{ marginBottom: 16 }}>
        <div className="detail-header">
          <div className="detail-avatar">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="detail-info">
            <h2>{customer.name}</h2>
            <p>{customer.mobile || 'No mobile'} · {customer.address || 'No address'}</p>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <StatusBadge status={customer.status} />
              <CreditStatusBadge creditStatus={cs.status} />
            </div>
          </div>
        </div>

        {/* Credit summary */}
        <div className="detail-grid" style={{ marginTop: 16 }}>
          <div className="detail-field">
            <div className="detail-field-label">Credit Limit</div>
            <div className="detail-field-value">{INR(customer.creditLimit)}</div>
          </div>
          <div className="detail-field">
            <div className="detail-field-label">Outstanding Balance</div>
            <div className="detail-field-value" style={{ color: outstanding > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {INR(outstanding)}
            </div>
          </div>
          {available !== null && (
            <div className="detail-field">
              <div className="detail-field-label">Available Credit</div>
              <div className="detail-field-value" style={{ color: 'var(--success)' }}>
                {INR(available)}
              </div>
            </div>
          )}
          <div className="detail-field">
            <div className="detail-field-label">Opening Balance</div>
            <div className="detail-field-value">{INR(customer.openingBalance)}</div>
          </div>
        </div>

        {/* Credit bar */}
        {customer.creditLimit > 0 && (
          <div className="credit-bar-wrapper">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Credit Utilization</span>
              <span>{Math.round(usedRatio * 100)}%</span>
            </div>
            <div className="credit-bar-track">
              <div
                className={`credit-bar-fill ${cs.status}`}
                style={{ width: `${usedRatio * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="section-block">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Transaction History</div>
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <div className="empty-state-icon" style={{ width: 48, height: 48, fontSize: 22 }}><Icon name="list" /></div>
          <h3 style={{ fontSize: 14 }}>No transactions yet</h3>
          <p style={{ fontSize: 12 }}>Customer ledger will be populated once credit sales and payments are recorded in upcoming stages.</p>
        </div>
      </div>
    </div>
  );
}

function CustomerFormModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    mobile: customer?.mobile ?? '',
    address: customer?.address ?? '',
    openingBalance: customer?.openingBalance ?? '',
    creditLimit: customer?.creditLimit ?? '',
    remarks: customer?.remarks ?? '',
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Customer name is required';
    if (form.mobile && !/^\d{10}$/.test(form.mobile.replace(/\D/g, ''))) {
      errs.mobile = 'Enter a valid 10-digit mobile number';
    }
    if (form.creditLimit && Number(form.creditLimit) < 0) {
      errs.creditLimit = 'Credit limit cannot be negative';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={customer ? 'Edit Customer' : 'Add Customer'}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="customer-form" className="btn btn-primary">
            {customer ? 'Update Customer' : 'Add Customer'}
          </button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormGroup label="Customer / Company Name" required error={errors.name}>
          <input
            type="text"
            className={`form-input ${errors.name ? 'error' : ''}`}
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. ABC Transport, Sharma Travels"
            autoFocus
          />
        </FormGroup>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormGroup label="Mobile Number" error={errors.mobile} hint="10-digit number">
            <input
              type="tel"
              className={`form-input ${errors.mobile ? 'error' : ''}`}
              value={form.mobile}
              onChange={e => setForm(prev => ({ ...prev, mobile: e.target.value }))}
              placeholder="e.g. 9876543210"
            />
          </FormGroup>

          <FormGroup label="Credit Limit (₹)" error={errors.creditLimit} hint="0 = No credit limit">
            <input
              type="text"
              inputMode="decimal"
              className={`form-input ${errors.creditLimit ? 'error' : ''}`}
              value={form.creditLimit}
              onChange={e => setForm(prev => ({ ...prev, creditLimit: e.target.value }))}
              placeholder="0"
            />
          </FormGroup>
        </div>

        <FormGroup label="Opening Balance (₹)" hint="Existing balance before system start (positive = customer owes station)">
          <input
            type="text"
            inputMode="decimal"
            className="form-input"
            value={form.openingBalance}
            onChange={e => setForm(prev => ({ ...prev, openingBalance: e.target.value }))}
            placeholder="0"
          />
        </FormGroup>

        <FormGroup label="Address / Location">
          <input
            type="text"
            className="form-input"
            value={form.address}
            onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
            placeholder="City, Highway mile marker, or office address"
          />
        </FormGroup>

        <FormGroup label="Remarks">
          <textarea
            className="form-textarea"
            rows={2}
            value={form.remarks}
            onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
            placeholder="Vehicle numbers, contact person notes…"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
