import { localDate } from '../utils/dates.js';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getProducts,
  getSuppliers,
  getFuelStockSummary,
  getAllFuelTopUps,
  createFuelTopUp,
  deleteFuelTopUp,
  getAllFuelDips,
  saveFuelDip,
  getTankCapacities,
  updateTankCapacity,
  getFuelInitialStock,
  updateFuelInitialStock,
  saveOpeningStockOverride,
  deleteOpeningStockOverride,
  isPastDateLocked, addAuditLog,
  getOpeningStockHistory,
} from '../data/repository.js';
import {
  Breadcrumbs,
  Modal,
  FormGroup,
  EmptyState,
  useToast,
  ConfirmDialog,
} from '../components/ui/UIComponents.jsx';
import Icon from '../components/ui/Icon.jsx';
import { useReasonGate } from '../components/ui/ReasonGate.jsx';

const FMT_QTY = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';
const FMT_KL = (v) => (Number(v || 0) / 1000).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' KL';
const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InventoryPage() {
  const toast = useToast();
  const { requestReason, reasonDialog } = useReasonGate();
  const [activeTab, setActiveTab] = useState('tanks'); // 'tanks' | 'topups' | 'dips'
  const [selectedDate, setSelectedDate] = useState(() => localDate());
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [topUps, setTopUps] = useState([]);
  const [dips, setDips] = useState([]);
  const [capacities, setCapacities] = useState({});
  const [initialStocks, setInitialStocks] = useState({});

  // Opening stock management states (Phases 21-30)
  const [manualOverrideActive, setManualOverrideActive] = useState(false);
  const [manualStockInputs, setManualStockInputs] = useState({});
  const [manualReason, setManualReason] = useState('');
  const [confirmManualModal, setConfirmManualModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [capacityWarningModal, setCapacityWarningModal] = useState({ open: false, warnings: [], pendingAction: null });

  // Modals
  const [topUpModal, setTopUpModal] = useState(false);
  const [topUpForm, setTopUpForm] = useState({
    date: localDate(),
    productId: 'prod-1',
    unit: 'KL', // 'KL' | 'L'
    quantity: '',
    supplier: 'Bharat Petroleum Corporation Ltd (BPCL)',
    reference: '',
    time: '',
    remarks: '',
  });

  const [dipModal, setDipModal] = useState(false);
  const [dipForm, setDipForm] = useState({
    date: localDate(),
    productId: 'prod-1',
    dipReading: '',
    remarks: '',
  });

  const [capacityModal, setCapacityModal] = useState({
    open: false,
    productId: '',
    productName: '',
    currentCapacityL: 20000,
    newCapacityKL: '20',
  });

  const [initialStockModal, setInitialStockModal] = useState({
    open: false,
    stockValues: {},
  });

  const [deleteTopUpId, setDeleteTopUpId] = useState(null);

  const loadData = useCallback(() => {
    const prods = getProducts();
    const supps = getSuppliers();
    setProducts(prods);
    setSuppliers(supps);
    setTopUps(getAllFuelTopUps());
    setDips(getAllFuelDips());
    setCapacities(getTankCapacities());
    setInitialStocks(getFuelInitialStock());
    setHistoryList(getOpeningStockHistory());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tank summaries (date-aware)
  const tankSummaries = useMemo(() => {
    return products.map(p => {
      const summary = getFuelStockSummary(p.id, selectedDate);
      return {
        ...p,
        ...summary,
      };
    });
  }, [products, selectedDate, topUps, dips, capacities, initialStocks]);

  // Sync manual override mode with active state of selected date
  useEffect(() => {
    const hasOverride = tankSummaries.some(t => t.isManualOverride);
    if (hasOverride) {
      setManualOverrideActive(true);
      const inputs = {};
      let rsn = '';
      tankSummaries.forEach(t => {
        inputs[t.id] = String(t.openingStock);
        if (t.openingStockReason) rsn = t.openingStockReason;
      });
      setManualStockInputs(inputs);
      setManualReason(rsn);
    } else {
      setManualOverrideActive(false);
    }
  }, [selectedDate, tankSummaries]);

  // Handlers for Opening Stock Mode selection (Phases 21-27)
  const handleSelectAutoMode = async () => {
    if (!manualOverrideActive) return;
    const hasOverrides = tankSummaries.some(t => t.isManualOverride);
    if (hasOverrides) {
      if (isPastDateLocked(selectedDate)) {
        const why = await requestReason({ title: 'Revert opening stock of a past day', date: selectedDate, detail: 'Opening stock drives every later day\'s book stock.' });
        if (!why) return;
        addAuditLog({ date: selectedDate, module: 'Opening Stock', action: 'Override removed', reason: why, summary: 'Reverted to automatic opening stock' });
      }
      products.forEach(p => {
        deleteOpeningStockOverride(selectedDate, p.id);
      });
      toast.success(`Reverted to calculated automatic opening stock for ${selectedDate}.`);
      loadData();
    }
    setManualOverrideActive(false);
  };

  const handleSelectManualMode = () => {
    if (manualOverrideActive) return;
    setConfirmManualModal(true);
  };

  const handleConfirmEnableManual = () => {
    const initialInputs = {};
    tankSummaries.forEach(t => {
      initialInputs[t.id] = String(t.openingStock || 0);
    });
    setManualStockInputs(initialInputs);
    setManualReason('');
    setManualOverrideActive(true);
    setConfirmManualModal(false);
  };

  const handleSaveManualOverride = () => {
    const warnings = [];
    for (const p of products) {
      const rawVal = manualStockInputs[p.id];
      if (rawVal !== undefined && rawVal !== '') {
        const val = Number(rawVal);
        if (isNaN(val) || val < 0) {
          toast.error(`Please enter a valid non-negative opening stock for ${p.name}.`);
          return;
        }
        const cap = capacities[p.id] || 20000;
        if (val > cap) {
          warnings.push(`${p.name}: ${val.toLocaleString('en-IN')} L exceeds capacity of ${cap.toLocaleString('en-IN')} L (${cap / 1000} KL).`);
        }
      }
    }

    if (warnings.length > 0) {
      setCapacityWarningModal({
        open: true,
        warnings,
        pendingAction: () => executeSaveManualOverride(),
      });
      return;
    }

    executeSaveManualOverride();
  };

  const executeSaveManualOverride = async () => {
    try {
      let reasonGiven = '';
      if (isPastDateLocked(selectedDate)) {
        reasonGiven = await requestReason({ title: 'Change opening stock of a past day', date: selectedDate, detail: 'Opening stock drives every later day\'s book stock.' });
        if (!reasonGiven) return;
      }
      products.forEach(p => {
        const rawVal = manualStockInputs[p.id];
        if (rawVal !== undefined && rawVal !== '') {
          saveOpeningStockOverride({
            date: selectedDate,
            productId: p.id,
            quantityLitres: Number(rawVal),
            reason: manualReason,
          });
        }
      });
      if (reasonGiven) addAuditLog({ date: selectedDate, module: 'Opening Stock', action: 'Manual override set', reason: reasonGiven, summary: 'Manual opening stock saved' });
      toast.success(`Manual opening stock saved for ${selectedDate}.`);
      setCapacityWarningModal({ open: false, warnings: [], pendingAction: null });
      loadData();
    } catch (err) {
      toast.error('Failed to save opening stock: ' + err.message);
    }
  };

  const handleRevertToAuto = async () => {
    if (isPastDateLocked(selectedDate)) {
      const why = await requestReason({ title: 'Revert opening stock of a past day', date: selectedDate, detail: 'Opening stock drives every later day\'s book stock.' });
      if (!why) return;
      addAuditLog({ date: selectedDate, module: 'Opening Stock', action: 'Override removed', reason: why, summary: 'Reverted to automatic opening stock' });
    }
    products.forEach(p => {
      deleteOpeningStockOverride(selectedDate, p.id);
    });
    setManualOverrideActive(false);
    toast.success(`Reverted to calculated automatic opening stock for ${selectedDate}.`);
    loadData();
  };

  // Handlers for Fuel Top-Up
  const handleOpenAddTopUp = (prodId = '') => {
    const defaultProdId = prodId || products[0]?.id || 'prod-1';
    const bpclSupplier = suppliers.find(s => s.name.toUpperCase().includes('BPCL'))?.name || 'Bharat Petroleum Corporation Ltd (BPCL)';
    setTopUpForm({
      date: localDate(),
      productId: defaultProdId,
      unit: 'KL',
      quantity: '',
      supplier: bpclSupplier,
      reference: '',
      time: '',
      remarks: '',
    });
    setTopUpModal(true);
  };

  const handleSaveTopUp = async () => {
    const rawQty = Number(topUpForm.quantity);
    if (!rawQty || rawQty <= 0 || !Number.isFinite(rawQty)) {
      toast.error('Please enter a valid fuel delivery quantity.');
      return;
    }
    if (!topUpForm.date) {
      toast.error('Please choose the delivery date.');
      return;
    }
    if ((topUpForm.unit === 'KL' ? rawQty * 1000 : rawQty) > 100000) {
      toast.error('That quantity looks too large (over 100 KL). Check the unit (L or KL).');
      return;
    }
    const litres = topUpForm.unit === 'KL' ? rawQty * 1000 : rawQty;
    const prod = products.find(p => p.id === topUpForm.productId);

    let reasonGiven = '';
    if (isPastDateLocked(topUpForm.date)) {
      reasonGiven = await requestReason({ title: 'Add a top-up to a past day', date: topUpForm.date, detail: 'This changes that day\'s closing stock and every day after it.' });
      if (!reasonGiven) return;
    }

    createFuelTopUp({
      date: topUpForm.date,
      productId: topUpForm.productId,
      quantity: rawQty,
      unit: topUpForm.unit,
      supplierName: topUpForm.supplier.trim() || 'Bharat Petroleum Corporation Ltd (BPCL)',
      reference: topUpForm.reference.trim(),
      remarks: topUpForm.remarks.trim() + (topUpForm.time.trim() ? ` (Time: ${topUpForm.time.trim()})` : ''),
    });

    if (reasonGiven) addAuditLog({ date: topUpForm.date, module: 'Fuel Top-Up', action: 'Added late', reason: reasonGiven, summary: `${prod?.name}: ${FMT_QTY(litres)}` });
    toast.success(`Fuel Top-Up: ${FMT_KL(litres)} (${FMT_QTY(litres)}) added to ${prod?.name} tank.`);
    const after = getFuelStockSummary(topUpForm.date).find(t => t.productId === topUpForm.productId);
    if (after?.isOverCapacity) {
      toast.warning(`${prod?.name} book stock is now above the tank capacity. Check the quantity or the tank capacity setting.`);
    }
    if (topUpForm.date > localDate()) {
      toast.warning('This top-up is dated in the future.');
    }
    setTopUpModal(false);
    loadData();
  };

  const handleDeleteTopUp = async () => {
    if (!deleteTopUpId) return;
    const rec = getAllFuelTopUps().find(r => r.id === deleteTopUpId);
    if (rec && isPastDateLocked(rec.date)) {
      const why = await requestReason({ title: 'Delete a past top-up', date: rec.date, detail: 'This changes that day\'s closing stock and every day after it.', confirmLabel: 'Delete top-up', danger: true });
      if (!why) return;
      addAuditLog({ date: rec.date, module: 'Fuel Top-Up', action: 'Deleted', reason: why, summary: `${rec.productName}: ${Number(rec.quantity).toLocaleString('en-IN')} L` });
    }
    deleteFuelTopUp(deleteTopUpId);
    toast.success('Fuel top-up delivery record deleted.');
    setDeleteTopUpId(null);
    loadData();
  };

  // Handlers for Physical Dip
  const handleOpenAddDip = (prodId = '') => {
    const defaultProdId = prodId || products[0]?.id || 'prod-1';
    setDipForm({
      date: localDate(),
      productId: defaultProdId,
      dipReading: '',
      remarks: '',
    });
    setDipModal(true);
  };

  const handleSaveDip = () => {
    const reading = Number(dipForm.dipReading);
    if (reading < 0 || isNaN(reading)) {
      toast.error('Please enter a valid dip reading in litres.');
      return;
    }
    const prod = products.find(p => p.id === dipForm.productId);
    saveFuelDip({
      date: dipForm.date,
      productId: dipForm.productId,
      productName: prod ? prod.name : 'Fuel',
      dipReading: reading,
      remarks: dipForm.remarks.trim(),
    });

    toast.success(`Physical dip for ${prod?.name} recorded (${FMT_QTY(reading)}).`);
    setDipModal(false);
    loadData();
  };

  // Handlers for Edit Capacity
  const handleOpenEditCapacity = (tank) => {
    const capL = capacities[tank.id] || tank.capacityLitres || 20000;
    setCapacityModal({
      open: true,
      productId: tank.id,
      productName: tank.name,
      currentCapacityL: capL,
      newCapacityKL: String(capL / 1000),
    });
  };

  const handleSaveCapacity = () => {
    const kl = Number(capacityModal.newCapacityKL);
    if (!kl || kl <= 0) {
      toast.error('Please enter a valid tank capacity in KL.');
      return;
    }
    const newLitres = kl * 1000;
    updateTankCapacity(capacityModal.productId, newLitres);
    toast.success(`Updated ${capacityModal.productName} tank capacity to ${kl} KL (${FMT_QTY(newLitres)}). Actual fuel stock was preserved.`);
    setCapacityModal(prev => ({ ...prev, open: false }));
    loadData();
  };

  // Handlers for Initial Stock Setup
  const handleOpenInitialStock = () => {
    setInitialStockModal({
      open: true,
      stockValues: { ...initialStocks },
    });
  };

  const handleSaveInitialStock = () => {
    Object.entries(initialStockModal.stockValues).forEach(([prodId, val]) => {
      const litres = Number(val) || 0;
      updateFuelInitialStock(prodId, litres);
    });
    toast.success('Initial Physical Tank Stock saved successfully.');
    setInitialStockModal(prev => ({ ...prev, open: false }));
    loadData();
  };

  return (
    <div>
      {reasonDialog}
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Fuel / Inventory' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>Underground Tank Fuel Inventory</h1>
          <p>
            Track bulk fuel storage for Petrol, Diesel, and Speed Petrol. Minimum data entry with automated depletion from nozzle meter sales, tanker Top-Ups, and physical dips.
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleOpenInitialStock}
            title="Configure Opening Stock physically available when FuelEx started"
          >
            <Icon name="settings" /> Initial Stock Setup
          </button>
          <Link to="/masters/lubricants" className="btn btn-ghost">
            <Icon name="fuel" /> Packaged Lubricants →
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleOpenAddDip()}
          >
            <Icon name="gauge" /> Record Physical Dip
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenAddTopUp()}
          >
            + Fuel Top-Up (BPCL)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', overflowX: 'auto', overflowY: 'hidden', marginBottom: 12, gap: 10 }}>
        <button
          type="button"
          className={`btn ${activeTab === 'tanks' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('tanks')}
        >
          <Icon name="fuel" /> Storage Tanks ({tankSummaries.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'topups' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('topups')}
        >
          <Icon name="fuel" /> Fuel Top-Ups ({topUps.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'dips' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('dips')}
        >
          <Icon name="gauge" /> Physical Dip Variations ({dips.length})
        </button>
      </div>

      {/* TAB 1: STORAGE TANKS STOCK CARDS (Section 14 & Phases 21-30) */}
      {activeTab === 'tanks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* OPENING STOCK CONTROL & INVENTORY DATE PANEL (Phases 21-30) */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              {/* Left: Operational Date & Mode selection */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Inventory Date:</span>
                  <input
                    type="date"
                    className="input-field"
                    style={{ padding: '5px 10px', fontSize: 13, width: 145 }}
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>

                <div style={{ height: 20, width: 1, background: 'var(--border-default)' }} />

                {/* Opening Stock Mode Toggle (Phases 21-22) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Opening Stock Mode:</span>
                  <div className="seg" role="group" aria-label="Opening stock mode">
                    <button type="button" className={`seg-btn ${!manualOverrideActive ? 'on' : ''}`} aria-pressed={!manualOverrideActive} onClick={handleSelectAutoMode}>
                      Automatic
                    </button>
                    <button type="button" className={`seg-btn warn ${manualOverrideActive ? 'on' : ''}`} aria-pressed={manualOverrideActive} onClick={handleSelectManualMode}>
                      Manual override
                    </button>
                  </div>
                </div>

                {/* Mode Badge Indicator (Phase 28) */}
                {manualOverrideActive ? (
                  <span className="badge badge-warning" style={{ fontSize: 11, fontWeight: 700 }}>
                    <Icon name="alert" /> Manual override active
                  </span>
                ) : (
                  <span className="badge badge-success" style={{ fontSize: 11, fontWeight: 600 }}>
                    <Icon name="check" /> Auto · previous day closing
                  </span>
                )}
              </div>

              {/* Right: History Action (Phase 29) */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    setHistoryList(getOpeningStockHistory());
                    setHistoryModal(true);
                  }}
                >
                  <Icon name="file" /> Opening Stock History ({historyList.length})
                </button>
              </div>
            </div>

            {/* Manual Override Input Drawer (Phase 23) */}
            {manualOverrideActive && (
              <div style={{
                marginTop: 6,
                padding: '10px 12px',
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-warning)' }}>
                    <Icon name="settings" /> Manual Opening Stock for {selectedDate}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Enter opening litres for this day. Historical transactions remain untouched.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
                  {products.map(p => {
                    const cap = capacities[p.id] || 20000;
                    return (
                      <div key={p.id}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                          {p.name} Opening (Litres)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="10000"
                          className="input-field"
                          style={{ width: '100%', padding: '6px 10px', fontSize: 13, fontWeight: 700 }}
                          value={manualStockInputs[p.id] ?? ''}
                          onChange={e => setManualStockInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                          Cap: {cap / 1000} KL ({cap.toLocaleString('en-IN')} L)
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Reason for manual override (e.g. Physical calibration, tank gauge re-zero)..."
                      style={{ width: '100%', padding: '6px 10px', fontSize: 12.5 }}
                      value={manualReason}
                      onChange={e => setManualReason(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveManualOverride}
                    >
                      <Icon name="file" /> Save Override
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleRevertToAuto}
                    >
                      <Icon name="x" /> Revert to Automatic
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 12 }}>
            {tankSummaries.map(tank => {
              const capacityKL = tank.capacityKL || (tank.capacityLitres / 1000);
              const stockKL = Number((tank.closingBookStock / 1000).toFixed(2));
              const utilization = tank.utilizationPercent || Math.round((tank.closingBookStock / tank.capacityLitres) * 100);

              return (
                <div
                  key={tank.id}
                  className="panel"
                  style={{
                    borderTop: `3px solid ${tank.color || 'var(--color-primary)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    marginBottom: 0,
                    minWidth: 0,
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        <Icon name="fuel" /> {tank.name}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        Capacity: <strong>{capacityKL} KL</strong> ({FMT_QTY(tank.capacityLitres)})
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {tank.isOverCapacity && (
                        <span className="badge badge-warning" style={{ fontWeight: 700, fontSize: 11, background: 'rgba(234,88,12,0.15)', color: '#ea580c', border: '1px solid #ea580c' }}>
                          <Icon name="alert" /> {tank.overCapacityPercent}% Over capacity
                        </span>
                      )}
                      {tank.isLowStock && !tank.isOverCapacity && (
                        <span className="badge badge-danger" style={{ fontWeight: 700 }}>
                          <Icon name="alert" /> Low stock
                        </span>
                      )}
                      {!tank.isLowStock && !tank.isOverCapacity && (
                        <span className="badge badge-success" style={{ fontWeight: 600 }}>
                          Optimal Level
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Over Capacity Alert Banner if Applicable */}
                  {tank.isOverCapacity && (
                    <div style={{
                      padding: '8px 12px',
                      background: 'rgba(234, 88, 12, 0.1)',
                      border: '1px solid #ea580c',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#c2410c',
                    }}>
                      <strong>Notice (Section 12):</strong> Book stock exceeds configured capacity ({stockKL} KL &gt; {capacityKL} KL). FuelEx retains actual physical deliveries without altering records.
                    </div>
                  )}

                  {/* Book Stock & Utilization Meter */}
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 14, border: '1px solid var(--border-default)' }}>
                    {/* Opening Stock Source Row (Phase 28) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--border-default)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Opening Stock: <strong style={{ color: 'var(--text-primary)' }}>{FMT_QTY(tank.openingStock)}</strong> ({FMT_KL(tank.openingStock)})
                      </div>
                      {tank.isManualOverride ? (
                        <span className="badge badge-warning" style={{ fontSize: 10, fontWeight: 700 }} title={tank.openingStockReason ? `Reason: ${tank.openingStockReason}` : 'Manual override'}>
                          <Icon name="alert" /> Manual override
                        </span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                          AUTO
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                        Closing Book Stock
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: tank.isOverCapacity ? '#ea580c' : 'var(--color-primary)' }}>
                        Utilization: {utilization}%
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: tank.isOverCapacity ? '#ea580c' : 'var(--color-primary)' }}>
                        {stockKL} KL
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        ({FMT_QTY(tank.closingBookStock)})
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 8, background: 'var(--border-default)', borderRadius: 4, overflow: 'hidden', marginTop: 10 }}>
                      <div
                        style={{
                          width: `${Math.min(utilization, 100)}%`,
                          height: '100%',
                          background: tank.isOverCapacity ? '#ea580c' : tank.isLowStock ? 'var(--color-danger)' : 'var(--color-primary)',
                          borderRadius: 4,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      Formula: Opening ({FMT_QTY(tank.openingStock)}) + Top-Ups ({FMT_QTY(tank.receipts)}) - Sales ({FMT_QTY(tank.sales)})
                    </div>
                  </div>

                  {/* Operational Daily Movement Cards (Section 14) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Today's Top-Up (+)</div>
                      <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginTop: 3, fontSize: 15 }}>
                        {FMT_KL(tank.receipts)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {FMT_QTY(tank.receipts)}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Today's Sales (-)</div>
                      <div style={{ fontWeight: 700, color: 'var(--color-success)', marginTop: 3, fontSize: 15 }}>
                        {FMT_KL(tank.sales)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {FMT_QTY(tank.sales)}
                      </div>
                    </div>
                  </div>

                  {/* Physical Dip (Optional) (Section 13) */}
                  <div style={{ padding: 12, borderRadius: 8, background: tank.physicalDip !== null ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Physical Dip:</span>
                      <strong style={{ fontSize: 13 }}>
                        {tank.physicalDip !== null ? `${FMT_QTY(tank.physicalDip)} (${FMT_KL(tank.physicalDip)})` : <span style={{ color: 'var(--text-muted)' }}>Optional (Not entered)</span>}
                      </strong>
                    </div>
                    {tank.physicalDip !== null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-default)' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Dip Variation:</span>
                        <strong style={{ fontSize: 13, color: tank.variation >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {tank.variation >= 0 ? `+ ${FMT_QTY(tank.variation)}` : `- ${FMT_QTY(Math.abs(tank.variation))}`}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Actions (Section 14: [+ Top-Up] [Record Dip] [Edit Capacity]) */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1.2, justifyContent: 'center' }}
                      onClick={() => handleOpenAddTopUp(tank.id)}
                    >
                      + Top-Up
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => handleOpenAddDip(tank.id)}
                    >
                      <Icon name="gauge" /> Dip
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => handleOpenEditCapacity(tank)}
                      title="Configure tank capacity in KL"
                    >
                      <Icon name="settings" /> Capacity
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: FUEL TOP-UPS (Section 11) */}
      {activeTab === 'topups' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Fuel Top-Up Deliveries (BPCL)</h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Fuel top-ups delivered by Bharat Petroleum Corporation Ltd (BPCL) tanker decanting. Adds to underground tank book stock.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleOpenAddTopUp()}
            >
              + Fuel Top-Up
            </button>
          </div>

          {topUps.length === 0 ? (
            <EmptyState
              icon="fuel"
              title="No fuel top-ups recorded"
              message="Click '+ Fuel Top-Up' to record BPCL tanker deliveries into underground tanks."
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Quantity (KL)</th>
                    <th style={{ textAlign: 'right' }}>Litres</th>
                    <th>Supplier</th>
                    <th>Invoice / Delivery #</th>
                    <th>Time</th>
                    <th>Remarks</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {topUps.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.date}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontWeight: 700 }}>
                          <Icon name="fuel" /> {r.productName || r.productId}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', fontSize: 14 }}>
                        + {FMT_KL(r.quantityLitres || r.quantity)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {FMT_QTY(r.quantityLitres || r.quantity)}
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.supplier || 'BPCL'}</td>
                      <td>{r.invoiceNo || r.reference || '—'}</td>
                      <td>{r.time || '—'}</td>
                      <td>{r.remarks || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          title="Delete Top-Up"
                          onClick={() => setDeleteTopUpId(r.id)}
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

      {/* TAB 3: PHYSICAL DIP VARIATIONS */}
      {activeTab === 'dips' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Physical Dip Calibration Log</h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Daily dip rod measurements converted to litres. Variation = Physical Dip - Book Stock.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenAddDip()}
            >
              <Icon name="gauge" /> Record Physical Dip
            </button>
          </div>

          {dips.length === 0 ? (
            <EmptyState
              icon="gauge"
              title="No physical dips entered yet"
              message="Physical dip measurement is optional. Click 'Record Physical Dip' when dip rod readings are taken."
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product Tank</th>
                    <th style={{ textAlign: 'right' }}>Physical Dip Reading</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {dips.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.date}</td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                          {d.productName || d.productId}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', fontSize: 13.5 }}>
                        {FMT_QTY(d.dipReading)}
                      </td>
                      <td>{d.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: FUEL TOP-UP (BPCL Tanker Delivery) (Section 11) */}
      <Modal
        open={topUpModal}
        onClose={() => setTopUpModal(false)}
        title="Fuel Top-Up (Tanker Delivery)"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setTopUpModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveTopUp}>
              Save Fuel Top-Up
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Delivery Date" required>
              <input
                type="date"
                className="input-field"
                value={topUpForm.date}
                onChange={e => setTopUpForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Fuel Product" required>
              <select
                className="input-field"
                value={topUpForm.productId}
                onChange={e => setTopUpForm(prev => ({ ...prev, productId: e.target.value }))}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FormGroup>
          </div>

          {/* Unit & Quantity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
            <FormGroup label="Quantity Unit">
              <select
                className="input-field"
                value={topUpForm.unit}
                onChange={e => setTopUpForm(prev => ({ ...prev, unit: e.target.value }))}
              >
                <option value="KL">KL (Kilo Litres)</option>
                <option value="L">L (Litres)</option>
              </select>
            </FormGroup>

            <FormGroup label={`Top-Up Quantity (${topUpForm.unit})`} required>
              <input
                type="text"
                inputMode="decimal"
                placeholder={topUpForm.unit === 'KL' ? 'e.g. 10' : 'e.g. 10000'}
                className="input-field"
                style={{ fontWeight: 700, fontSize: 15 }}
                value={topUpForm.quantity}
                onChange={e => setTopUpForm(prev => ({ ...prev, quantity: e.target.value }))}
              />
            </FormGroup>
          </div>

          {topUpForm.quantity && Number(topUpForm.quantity) > 0 && (
            <div className="convert-strip" aria-live="polite">
              <span>{Number(topUpForm.quantity).toLocaleString('en-IN')} {topUpForm.unit}</span>
              <span className="convert-eq">=</span>
              <strong>
                {topUpForm.unit === 'KL'
                  ? `${(Number(topUpForm.quantity) * 1000).toLocaleString('en-IN')} L`
                  : `${(Number(topUpForm.quantity) / 1000).toLocaleString('en-IN', { maximumFractionDigits: 3 })} KL`}
              </strong>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
            <FormGroup label="Supplier (Default BPCL)">
              <input
                type="text"
                placeholder="Bharat Petroleum Corporation Ltd (BPCL)"
                className="input-field"
                value={topUpForm.supplier}
                onChange={e => setTopUpForm(prev => ({ ...prev, supplier: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Invoice / Delivery No. (optional)">
              <input
                type="text"
                placeholder="e.g. BPCL-INV-49210"
                className="input-field"
                value={topUpForm.reference}
                onChange={e => setTopUpForm(prev => ({ ...prev, reference: e.target.value }))}
              />
            </FormGroup>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
            <FormGroup label="Time (optional)">
              <input
                type="time"
                className="input-field"
                value={topUpForm.time}
                onChange={e => setTopUpForm(prev => ({ ...prev, time: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Remarks (optional)">
              <input
                type="text"
                placeholder="e.g. Tanker seal checked, density 745.2"
                className="input-field"
                value={topUpForm.remarks}
                onChange={e => setTopUpForm(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </FormGroup>
          </div>
        </div>
      </Modal>

      {/* MODAL: EDIT TANK CAPACITY (Section 10) */}
      <Modal
        open={capacityModal.open}
        onClose={() => setCapacityModal(prev => ({ ...prev, open: false }))}
        title={`Configure ${capacityModal.productName} Tank Capacity`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCapacityModal(prev => ({ ...prev, open: false }))}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveCapacity}>
              Update Capacity
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Configuring tank capacity is used for utilization percentages, visualizations, and over-capacity warnings. <strong>Changing capacity does NOT modify actual book stock.</strong>
          </div>

          <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current Configured Capacity:</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              {capacityModal.currentCapacityL / 1000} KL ({FMT_QTY(capacityModal.currentCapacityL)})
            </div>
          </div>

          <FormGroup label="New Tank Capacity (in KL)" required>
            <input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 20"
              className="input-field"
              style={{ fontSize: 16, fontWeight: 700 }}
              value={capacityModal.newCapacityKL}
              onChange={e => setCapacityModal(prev => ({ ...prev, newCapacityKL: e.target.value }))}
            />
          </FormGroup>

          {capacityModal.newCapacityKL && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Equivalent Litres: <strong>{Number(capacityModal.newCapacityKL) * 1000} L</strong>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: INITIAL PHYSICAL STOCK SETUP (Section 9) */}
      <Modal
        open={initialStockModal.open}
        onClose={() => setInitialStockModal(prev => ({ ...prev, open: false }))}
        title="Initial Underground Tank Physical Stock Setup"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setInitialStockModal(prev => ({ ...prev, open: false }))}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveInitialStock}>
              Save Initial Stock
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Specify the physical fuel stock available when FuelEx was first initialized. Subsequent day opening stock automatically calculates from previous day's closing book stock.
          </div>

          {products.map(p => (
            <FormGroup key={p.id} label={`${p.name} Initial Stock (Litres)`}>
              <input
                type="text"
                inputMode="decimal"
                className="input-field"
                placeholder="e.g. 12500"
                style={{ fontWeight: 700 }}
                value={initialStockModal.stockValues[p.id] ?? ''}
                onChange={e => {
                  const val = e.target.value;
                  setInitialStockModal(prev => ({
                    ...prev,
                    stockValues: { ...prev.stockValues, [p.id]: val },
                  }));
                }}
              />
            </FormGroup>
          ))}
        </div>
      </Modal>

      {/* MODAL: RECORD PHYSICAL DIP */}
      <Modal
        open={dipModal}
        onClose={() => setDipModal(false)}
        title="Record Physical Dip Measurement"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDipModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveDip}>
              Save Dip Measurement
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Dip Measurement Date" required>
              <input
                type="date"
                className="input-field"
                value={dipForm.date}
                onChange={e => setDipForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Product Tank" required>
              <select
                className="input-field"
                value={dipForm.productId}
                onChange={e => setDipForm(prev => ({ ...prev, productId: e.target.value }))}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FormGroup>
          </div>

          <FormGroup label="Physical Dip Volume (Litres)" required>
            <input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 14250"
              className="input-field"
              style={{ fontWeight: 700, fontSize: 15 }}
              value={dipForm.dipReading}
              onChange={e => setDipForm(prev => ({ ...prev, dipReading: e.target.value }))}
            />
          </FormGroup>

          <FormGroup label="Remarks / Dip Stick Level (cm)">
            <input
              type="text"
              placeholder="e.g. Dip rod 148.5 cm, morning calibration"
              className="input-field"
              value={dipForm.remarks}
              onChange={e => setDipForm(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </FormGroup>
        </div>
      </Modal>

      {/* MODAL: CONFIRM MANUAL OPENING OVERRIDE (Phase 27) */}
      <Modal
        open={confirmManualModal}
        onClose={() => setConfirmManualModal(false)}
        title="Enable Manual Opening Stock Override"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmManualModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmEnableManual}>
              Use Manual Opening Stock
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: '12px 14px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid var(--color-warning)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--text-primary)',
            lineHeight: 1.5,
          }}>
            <Icon name="alert" /> <strong>Warning (Section 27):</strong> Manual opening stock overrides the automatically calculated opening balance for <strong>{selectedDate}</strong>. Historical transactions and previous day records are not changed.
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Do you want to switch to Manual Override mode and specify opening stock for this date?
          </p>
        </div>
      </Modal>

      {/* MODAL: CAPACITY WARNING CONFIRMATION (Phase 30) */}
      <Modal
        open={capacityWarningModal.open}
        onClose={() => setCapacityWarningModal({ open: false, warnings: [], pendingAction: null })}
        title="Opening Stock Exceeds Tank Capacity"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCapacityWarningModal({ open: false, warnings: [], pendingAction: null })}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (capacityWarningModal.pendingAction) capacityWarningModal.pendingAction();
              }}
            >
              Proceed Anyway
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: '12px 14px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid var(--color-warning)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--text-primary)',
          }}>
            <Icon name="alert" /> <strong>Opening stock exceeds tank capacity:</strong>
            <ul style={{ marginTop: 6, paddingLeft: 20 }}>
              {capacityWarningModal.warnings.map((w, idx) => (
                <li key={idx} style={{ marginTop: 2 }}>{w}</li>
              ))}
            </ul>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            FuelEx will record this opening stock without silent reduction. The tank will reflect an OVER CAPACITY warning until depleted.
          </p>
        </div>
      </Modal>

      {/* MODAL: OPENING STOCK HISTORY (Phase 29) */}
      <Modal
        open={historyModal}
        onClose={() => setHistoryModal(false)}
        title="Opening Stock Override Audit History"
        footer={
          <button className="btn btn-secondary" onClick={() => setHistoryModal(false)}>
            Close
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Complete log of all manual opening stock overrides applied across stations and dates.
          </div>

          {historyList.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              No manual opening stock overrides recorded. All dates are using automatic calculated opening stock.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 360 }}>
              <table className="table" style={{ margin: 0, fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Fuel Tank</th>
                    <th style={{ textAlign: 'right' }}>Manual Opening</th>
                    <th>Reason</th>
                    <th>Timestamp</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600 }}>{h.date}</td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                          {h.productName}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-warning)' }}>
                        {FMT_QTY(h.quantityLitres)}
                      </td>
                      <td>{h.reason || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(h.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-danger)', fontSize: 11, padding: '2px 6px' }}
                          title="Revert override"
                          onClick={() => {
                            deleteOpeningStockOverride(h.date, h.productId);
                            toast.success(`Removed override for ${h.productName} on ${h.date}.`);
                            loadData();
                            setHistoryList(getOpeningStockHistory());
                          }}
                        >
                          <Icon name="trash" /> Revert
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        open={Boolean(deleteTopUpId)}
        onClose={() => setDeleteTopUpId(null)}
        title="Delete Fuel Top-Up Record"
        message="Are you sure you want to delete this fuel top-up delivery? Tank closing stock will be recalculated automatically."
        onConfirm={handleDeleteTopUp}
      />
    </div>
  );
}
