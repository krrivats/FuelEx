import { useState, useEffect, useCallback } from 'react';
import {
  getExpenseCategories, createExpenseCategory, updateExpenseCategory, setExpenseCategoryStatus,
  canDeleteExpenseCategory, deleteExpenseCategory,
} from '../../data/repository.js';
import {
  Modal, StatusBadge, FormGroup, EmptyState, SearchInput,
  useToast, Breadcrumbs, DeleteConfirmModal, ConfirmDialog,
} from '../../components/ui/UIComponents.jsx';

export default function ExpenseCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState({ open: false, category: null });
  const [deactivateModal, setDeactivateModal] = useState({ open: false, category: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, category: null, check: { canDelete: true } });

  const refresh = useCallback(() => setCategories(getExpenseCategories()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = categories.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  const handleSave = (formData) => {
    if (modal.category) {
      updateExpenseCategory(modal.category.id, formData);
      toast.success('Category updated successfully');
    } else {
      createExpenseCategory(formData);
      toast.success('Expense category added successfully');
    }
    refresh();
    setModal({ open: false, category: null });
  };

  const handleToggle = (category) => {
    const newStatus = category.status === 'active' ? 'inactive' : 'active';
    setExpenseCategoryStatus(category.id, newStatus);
    toast.success(`Category ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    refresh();
  };

  const promptDelete = (category) => {
    const check = canDeleteExpenseCategory(category.id);
    setDeleteModal({ open: true, category, check });
  };

  const confirmDelete = () => {
    if (!deleteModal.category) return;
    try {
      deleteExpenseCategory(deleteModal.category.id);
      toast.success('Expense category deleted successfully');
      refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to delete expense category');
    }
  };

  const active = categories.filter(c => c.status === 'active').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Masters', path: '/masters' },
              { label: 'Expense Categories' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Expense Categories</h1>
          <p>Heads of daily station expenses (Salary, Maintenance, Cleaning, etc.). Inactive categories are hidden from daily voucher entries.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setModal({ open: true, category: null })}>
            + Add Category
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
        {active} active categories · {categories.length - active} inactive
      </div>

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search categories…" />
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="section-block">
        {filtered.length === 0 ? (
          <EmptyState icon="inbox" title="No categories found" description="Add your first expense category or adjust filters." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Category Name</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setModal({ open: true, category: c })}
                        >
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${c.status === 'active' ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => {
                            if (c.status === 'active') {
                              setDeactivateModal({ open: true, category: c });
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
                          title="Delete Category"
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
        Showing {filtered.length} of {categories.length} categories
      </div>

      {modal.open && (
        <CategoryModal
          category={modal.category}
          onClose={() => setModal({ open: false, category: null })}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={deactivateModal.open}
        onClose={() => setDeactivateModal({ open: false, category: null })}
        onConfirm={() => handleToggle(deactivateModal.category)}
        title="Deactivate Expense Category?"
        message={`"${deactivateModal.category?.name}" will be hidden from daily expense voucher entry. Past expenses remain intact.`}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        icon="alert"
      />

      {deleteModal.open && (
        <DeleteConfirmModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, category: null, check: { canDelete: true } })}
          onDelete={confirmDelete}
          onDeactivate={() => {
            if (deleteModal.category) handleToggle(deleteModal.category);
          }}
          title={`Delete ${deleteModal.category?.name}?`}
          recordName={deleteModal.category?.name}
          canDeleteResult={deleteModal.check}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, onClose, onSave }) {
  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required');
      return;
    }
    onSave({ name: name.trim() });
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={category ? 'Edit Expense Category' : 'Add Expense Category'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="cat-form" className="btn btn-primary">
            {category ? 'Update Category' : 'Add Category'}
          </button>
        </>
      }
    >
      <form id="cat-form" onSubmit={handleSubmit}>
        <FormGroup label="Category Name" required error={error} hint="e.g. Salary, Electricity, Tea/Snacks, Generator Fuel">
          <input
            type="text"
            className={`form-input ${error ? 'error' : ''}`}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Category name"
            autoFocus
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
