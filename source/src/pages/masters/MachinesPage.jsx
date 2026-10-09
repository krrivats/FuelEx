import { useState, useEffect, useCallback } from 'react';
import {
  getMachines, getNozzles, getProducts,
  createNozzle, updateNozzle, setNozzleStatus, deleteNozzle, canDeleteNozzle,
  createMachine, updateMachine, setMachineStatus, deleteMachine, canDeleteMachine,
} from '../../data/repository.js';
import {
  Modal, StatusBadge, FormGroup, EmptyState, SearchInput,
  useToast, Breadcrumbs, DeleteConfirmModal, ConfirmDialog,
} from '../../components/ui/UIComponents.jsx';

export default function MachinesPage() {
  const toast = useToast();
  const [machines, setMachines] = useState([]);
  const [nozzles, setNozzles] = useState([]);
  const [products, setProducts] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [nozzleModal, setNozzleModal] = useState({ open: false, nozzle: null });
  const [machineModal, setMachineModal] = useState({ open: false, machine: null });
  const [deleteNozzleModal, setDeleteNozzleModal] = useState({ open: false, nozzle: null, check: { canDelete: true } });
  const [deleteMachineModal, setDeleteMachineModal] = useState({ open: false, machine: null, check: { canDelete: true } });
  const [deactivateModal, setDeactivateModal] = useState({ open: false, nozzle: null });

  const refresh = useCallback(() => {
    setMachines(getMachines());
    setNozzles(getNozzles());
    setProducts(getProducts());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredNozzles = nozzles.filter(n => {
    const machine = machines.find(m => m.id === n.machineId);
    const product = products.find(p => p.id === n.productId);
    const searchLower = search.toLowerCase();
    if (search && !n.name.toLowerCase().includes(searchLower) &&
        !machine?.name.toLowerCase().includes(searchLower) &&
        !product?.name.toLowerCase().includes(searchLower)) return false;
    if (filterMachine && n.machineId !== filterMachine) return false;
    if (filterProduct && n.productId !== filterProduct) return false;
    if (filterStatus && n.status !== filterStatus) return false;
    return true;
  });

  const handleSaveNozzle = (formData) => {
    if (nozzleModal.nozzle) {
      updateNozzle(nozzleModal.nozzle.id, formData);
      toast.success('Nozzle updated successfully');
    } else {
      createNozzle(formData);
      toast.success('Nozzle added successfully');
    }
    refresh();
    setNozzleModal({ open: false, nozzle: null });
  };

  const handleSaveMachine = (name) => {
    if (machineModal.machine) {
      updateMachine(machineModal.machine.id, { name });
      toast.success('Machine updated successfully');
    } else {
      createMachine({ name });
      toast.success('Machine added successfully');
    }
    refresh();
    setMachineModal({ open: false, machine: null });
  };

  const handleToggleNozzleStatus = (nozzle) => {
    const newStatus = nozzle.status === 'active' ? 'inactive' : 'active';
    setNozzleStatus(nozzle.id, newStatus);
    toast.success(`Nozzle ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    refresh();
  };

  const promptDeleteNozzle = (nozzle) => {
    const check = canDeleteNozzle(nozzle.id);
    setDeleteNozzleModal({ open: true, nozzle, check });
  };

  const confirmDeleteNozzle = () => {
    if (!deleteNozzleModal.nozzle) return;
    try {
      deleteNozzle(deleteNozzleModal.nozzle.id);
      toast.success('Nozzle deleted successfully');
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to delete nozzle');
    }
  };

  const promptDeleteMachine = (machine) => {
    const check = canDeleteMachine(machine.id);
    setDeleteMachineModal({ open: true, machine, check });
  };

  const confirmDeleteMachine = () => {
    if (!deleteMachineModal.machine) return;
    try {
      deleteMachine(deleteMachineModal.machine.id);
      toast.success('Machine deleted successfully');
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to delete machine');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Machines & Nozzles' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Machines &amp; Nozzles</h1>
          <p>Manage fuel dispensing machines and nozzle configuration. Inactive nozzles are hidden from daily transactions.</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setMachineModal({ open: true, machine: null })}>
            + Add Machine
          </button>
          <button className="btn btn-primary" onClick={() => setNozzleModal({ open: true, nozzle: null })}>
            + Add Nozzle
          </button>
        </div>
      </div>

      {/* Summary cards for Machines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 12, marginBottom: 12 }}>
        {machines.map(m => {
          const mNozzles = nozzles.filter(n => n.machineId === m.id);
          const active = mNozzles.filter(n => n.status === 'active').length;
          return (
            <div key={m.id} className="section-block" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: 11 }}
                    onClick={() => setMachineModal({ open: true, machine: m })}
                    title="Edit machine name"
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: 11, color: 'var(--danger)' }}
                    onClick={() => promptDeleteMachine(m)}
                    title="Delete machine"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {mNozzles.length} nozzle{mNozzles.length === 1 ? '' : 's'} · {active} active
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search nozzles, machines, products…" />
        <select className="filter-select" value={filterMachine} onChange={e => setFilterMachine(e.target.value)}>
          <option value="">All Machines</option>
          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="filter-select" value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
          <option value="">All Products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="section-block">
        {filteredNozzles.length === 0 ? (
          <EmptyState icon="tool" title="No nozzles found" description="Add nozzles or adjust your search filters." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Nozzle Name</th>
                  <th>Fuel Product</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNozzles.map(nozzle => {
                  const machine = machines.find(m => m.id === nozzle.machineId);
                  const product = products.find(p => p.id === nozzle.productId);
                  return (
                    <tr key={nozzle.id}>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
                        {machine?.name ?? '—'}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{nozzle.name}</span>
                      </td>
                      <td>
                        <span className="badge badge-default" style={{ fontSize: 11 }}>
                          {product?.name ?? '—'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={nozzle.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setNozzleModal({ open: true, nozzle })}
                          >
                            Edit
                          </button>
                          <button
                            className={`btn btn-sm ${nozzle.status === 'active' ? 'btn-ghost' : 'btn-success'}`}
                            onClick={() => {
                              if (nozzle.status === 'active') {
                                setDeactivateModal({ open: true, nozzle });
                              } else {
                                handleToggleNozzleStatus(nozzle);
                              }
                            }}
                          >
                            {nozzle.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => promptDeleteNozzle(nozzle)}
                            title="Delete Nozzle"
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
        Showing {filteredNozzles.length} of {nozzles.length} nozzles
      </div>

      {/* Add/Edit Nozzle Modal */}
      <NozzleModal
        open={nozzleModal.open}
        nozzle={nozzleModal.nozzle}
        machines={machines}
        products={products}
        onClose={() => setNozzleModal({ open: false, nozzle: null })}
        onSave={handleSaveNozzle}
      />

      {/* Add/Edit Machine Modal */}
      <MachineModal
        open={machineModal.open}
        machine={machineModal.machine}
        onClose={() => setMachineModal({ open: false, machine: null })}
        onSave={handleSaveMachine}
      />

      {/* Confirm Deactivate Nozzle */}
      <ConfirmDialog
        open={deactivateModal.open}
        onClose={() => setDeactivateModal({ open: false, nozzle: null })}
        onConfirm={() => handleToggleNozzleStatus(deactivateModal.nozzle)}
        title="Deactivate Nozzle?"
        message={`"${deactivateModal.nozzle?.name}" will be hidden from future transaction entry. Historical records are preserved.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        icon="alert"
      />

      {/* Safe Delete Nozzle Modal */}
      {deleteNozzleModal.open && (
        <DeleteConfirmModal
          open={deleteNozzleModal.open}
          onClose={() => setDeleteNozzleModal({ open: false, nozzle: null, check: { canDelete: true } })}
          onDelete={confirmDeleteNozzle}
          onDeactivate={() => {
            if (deleteNozzleModal.nozzle) handleToggleNozzleStatus(deleteNozzleModal.nozzle);
          }}
          title={`Delete ${deleteNozzleModal.nozzle?.name}?`}
          recordName={deleteNozzleModal.nozzle?.name}
          canDeleteResult={deleteNozzleModal.check}
        />
      )}

      {/* Safe Delete Machine Modal */}
      {deleteMachineModal.open && (
        <DeleteConfirmModal
          open={deleteMachineModal.open}
          onClose={() => setDeleteMachineModal({ open: false, machine: null, check: { canDelete: true } })}
          onDelete={confirmDeleteMachine}
          title={`Delete ${deleteMachineModal.machine?.name}?`}
          recordName={deleteMachineModal.machine?.name}
          canDeleteResult={deleteMachineModal.check}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOZZLE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function NozzleModal({ open, nozzle, machines, products, onClose, onSave }) {
  const [machineId, setMachineId] = useState('');
  const [name, setName] = useState('');
  const [productId, setProductId] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (nozzle) {
      setMachineId(nozzle.machineId);
      setName(nozzle.name);
      setProductId(nozzle.productId);
    } else {
      setMachineId(machines[0]?.id ?? '');
      setName('');
      setProductId(products[0]?.id ?? '');
    }
    setErrors({});
  }, [nozzle, machines, products, open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = 'Nozzle name is required';
    if (!machineId) errs.machineId = 'Machine is required';
    if (!productId) errs.productId = 'Product is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    onSave({ machineId, name: name.trim(), productId });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={nozzle ? 'Edit Nozzle' : 'Add Nozzle'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="nozzle-form" className="btn btn-primary">
            {nozzle ? 'Update Nozzle' : 'Add Nozzle'}
          </button>
        </>
      }
    >
      <form id="nozzle-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormGroup label="Dispensing Machine" required error={errors.machineId}>
          <select
            className="form-select"
            value={machineId}
            onChange={e => setMachineId(e.target.value)}
          >
            {machines.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </FormGroup>

        <FormGroup label="Nozzle Name" required error={errors.name} hint="e.g. Petrol 1, Diesel 2, Speed 1">
          <input
            type="text"
            className={`form-input ${errors.name ? 'error' : ''}`}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nozzle name"
            autoFocus
          />
        </FormGroup>

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
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MACHINE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function MachineModal({ open, machine, onClose, onSave }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(machine?.name ?? '');
    setError('');
  }, [machine, open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Machine name is required');
      return;
    }
    onSave(name.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={machine ? 'Edit Machine' : 'Add Dispensing Machine'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="machine-form" className="btn btn-primary">
            {machine ? 'Update Machine' : 'Add Machine'}
          </button>
        </>
      }
    >
      <form id="machine-form" onSubmit={handleSubmit}>
        <FormGroup label="Machine Name" required error={error} hint="e.g. Machine 1, MPD 2, Island 1">
          <input
            type="text"
            className={`form-input ${error ? 'error' : ''}`}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Machine 4"
            autoFocus
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
