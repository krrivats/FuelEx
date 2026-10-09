import { localDate } from '../../utils/dates.js';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getActiveNozzles, getMachines, getProducts, getActiveSalesmen,
  getActiveCustomers, getActiveExpenseCategories, getApplicablePrice,
  getDailyEntryByDate, getPreviousClosingReadings, getPreviousCollectionGroups,
  validateMachineGrouping, saveDailyEntry,
  getMeterReadingsByDailyEntryId, getCollectionsByDailyEntryId,
  getCollectionGroupsByDailyEntryId, getCashDepositsByDailyEntryId,
  getExpensesByDailyEntryId, getMoneyMovementsByDailyEntryId,
  getUdhaarSalesByDailyEntryId, getCustomerOutstanding,
  getCashCountTotalByDate, getCashCountsByDate, dailyEntryNeedsReason,
  getCustomerReceiptTotals,
} from '../../data/repository.js';
import { useReasonGate } from '../../components/ui/ReasonGate.jsx';
import {
  Modal, StatusBadge, FormGroup,
  useToast, Breadcrumbs, ConfirmDialog,
} from '../../components/ui/UIComponents.jsx';
import Icon from '../../components/ui/Icon.jsx';
import ReceiptsPanel from './ReceiptsPanel.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FMT_QTY = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';

// Only actual money received is a collection payment mode. Udhaar is a separate credit transaction!
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Paytm', 'Other'];
const PAYMENT_SOURCES = ['Cash', 'UPI', 'Bank', 'Card', 'Other'];
const MOVEMENT_TYPES = [
  'Salary Advance',
  'Employee Advance',
  'Other Advance',
  'Owner Withdrawal',
  'Supplier Payment',
  'Other Payment',
];

export default function DailyEntryPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Date state (default today: YYYY-MM-DD)
  const initialDate = searchParams.get('date') || localDate();
  const [date, setDate] = useState(initialDate);

  // Master Data Cache (lazily initialized for immediate first-render safety)
  const [nozzles, setNozzles] = useState(() => getActiveNozzles() || []);
  const [machines, setMachines] = useState(() => getMachines() || []);
  const [products, setProducts] = useState(() => getProducts() || []);
  const [salesmen, setSalesmen] = useState(() => getActiveSalesmen() || []);
  const [customers, setCustomers] = useState(() => getActiveCustomers() || []);
  const [expenseCategories, setExpenseCategories] = useState(() => getActiveExpenseCategories() || []);

  // Daily Entry state
  const [existingEntryId, setExistingEntryId] = useState(null);
  const [entryMeta, setEntryMeta] = useState(null); // saved day record (status, edit history)
  const { requestReason, reasonDialog } = useReasonGate();
  const [status, setStatus] = useState('draft');
  const [isDemo, setIsDemo] = useState(false);

  // Section 2: Meter Readings state
  const [readings, setReadings] = useState([]);

  // Section 4: Collection Groups state
  const [collectionGroups, setCollectionGroups] = useState([]);
  const [groupCollectionsMap, setGroupCollectionsMap] = useState({});
  const [groupModal, setGroupModal] = useState({ open: false, index: -1, group: null });
  const [previousSetupNotice, setPreviousSetupNotice] = useState(false);

  // Section 5: Udhaar / Credit Sales state
  const [udhaarSales, setUdhaarSales] = useState([]);
  const [udhaarModal, setUdhaarModal] = useState({ open: false, index: -1, udhaar: null });

  // Section 6: Cash Deposits state
  const [cashDeposits, setCashDeposits] = useState([]);
  const [depositModal, setDepositModal] = useState({ open: false, index: -1, deposit: null });

  // Section 7: Daily Expenses state
  const [expenses, setExpenses] = useState([]);
  const [expenseModal, setExpenseModal] = useState({ open: false, index: -1, expense: null });

  // Section 8: Other Payments & Advances (Money Movements) state
  const [moneyMovements, setMoneyMovements] = useState([]);
  const [movementModal, setMovementModal] = useState({ open: false, index: -1, movement: null });

  // Delete confirmations
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: '', index: -1 });

  // UI state
  const [allowManualOpening, setAllowManualOpening] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  // Accordion Workflow state (Sections 15-18: All sections CLOSED initially)
  const [openSections, setOpenSections] = useState({
    meters: false,
    groups: false,
    creditPayments: false,
    deposits: false,
    summary: false,
  });

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExpandAll = () => {
    setOpenSections({
      meters: true,
      groups: true,
      creditPayments: true,
      deposits: true,
      summary: true,
    });
  };

  const handleCollapseAll = () => {
    setOpenSections({
      meters: false,
      groups: false,
      creditPayments: false,
      deposits: false,
      summary: false,
    });
  };

  // Credit & Payments sub-tab (UI grouping only: Section 18)
  const [creditPaymentTab, setCreditPaymentTab] = useState('udhaar');
  const [receiptTick, setReceiptTick] = useState(0);

  // Cash Count integration state (Sections 28-30)
  const [cashCountTotal, setCashCountTotal] = useState(0);
  const [cashCountEntries, setCashCountEntries] = useState([]);

  // Load masters on mount
  useEffect(() => {
    setNozzles(getActiveNozzles());
    setMachines(getMachines());
    setProducts(getProducts());
    setSalesmen(getActiveSalesmen());
    setCustomers(getActiveCustomers());
    setExpenseCategories(getActiveExpenseCategories());
  }, []);

  // Synchronize URL date parameter
  const handleDateChange = (newDate) => {
    setDate(newDate);
    setSearchParams({ date: newDate });
  };

  // Load or initialize day data whenever date changes
  const loadDayData = useCallback((selectedDate) => {
    const activeNozzles = getActiveNozzles();
    const existing = getDailyEntryByDate(selectedDate);

    if (existing) {
      // Reopening existing saved day: load saved transactions
      setExistingEntryId(existing.id);
      setEntryMeta(existing);
      setStatus(existing.status || 'draft');
      setIsDemo(Boolean(existing.isDemo));
      setPreviousSetupNotice(false);

      const savedReadings = getMeterReadingsByDailyEntryId(existing.id);
      const savedGroups = getCollectionGroupsByDailyEntryId(existing.id);
      const savedCollections = getCollectionsByDailyEntryId(existing.id);
      const savedUdhaar = getUdhaarSalesByDailyEntryId(existing.id);
      const savedDeposits = getCashDepositsByDailyEntryId(existing.id);
      const savedExpenses = getExpensesByDailyEntryId(existing.id);
      const savedMovements = getMoneyMovementsByDailyEntryId(existing.id);

      // Map readings to all active nozzles
      const mappedReadings = activeNozzles.map(n => {
        const sr = savedReadings.find(r => r.nozzleId === n.id);
        const priceObj = getApplicablePrice(n.productId, selectedDate);
        return {
          id: sr?.id || null,
          nozzleId: n.id,
          machineId: n.machineId,
          productId: n.productId,
          openingReading: sr ? String(sr.openingReading) : '0',
          closingReading: sr ? String(sr.closingReading) : '',
          sellingPrice: priceObj ? priceObj.sellingPrice : (sr?.sellingPrice ?? null),
        };
      });
      setReadings(mappedReadings);

      // Map groups
      let groupsToUse = savedGroups;
      if (!groupsToUse || groupsToUse.length === 0) {
        // Fallback to previous setup if entry had no groups saved
        groupsToUse = getPreviousCollectionGroups(selectedDate);
      }
      setCollectionGroups(groupsToUse.map(g => ({
        id: g.id,
        name: g.name,
        machineIds: g.machineIds || [],
        salesmanIds: g.salesmanIds || [],
        paymentMethods: Array.isArray(g.paymentMethods)
          ? g.paymentMethods.filter(m => m !== 'Udhaar')
          : ['Cash', 'UPI', 'Card', 'Paytm', 'Other'],
      })));

      // Map collections by group (Only actual money received: Cash, UPI, Card, Paytm, Other)
      const newGroupMap = {};
      groupsToUse.forEach(g => {
        newGroupMap[g.id] = { Cash: '', UPI: '', Card: '', Paytm: '', Other: '', remarks: '' };
      });
      for (const col of savedCollections) {
        if (col.paymentMode === 'Udhaar') continue; // Handled in udhaarSales
        const gId = col.collectionGroupId || groupsToUse[0]?.id;
        if (gId) {
          if (!newGroupMap[gId]) {
            newGroupMap[gId] = { Cash: '', UPI: '', Card: '', Paytm: '', Other: '', remarks: '' };
          }
          if (PAYMENT_MODES.includes(col.paymentMode)) {
            newGroupMap[gId][col.paymentMode] = col.amount ? String(col.amount) : '';
          }
          if (col.remarks) {
            newGroupMap[gId].remarks = col.remarks;
          }
        }
      }
      setGroupCollectionsMap(newGroupMap);

      // Map Udhaar sales
      setUdhaarSales(savedUdhaar.map(u => ({
        id: u.id,
        customerId: u.customerId,
        customerName: u.customerName,
        productId: u.productId,
        productName: u.productName,
        quantity: u.quantity !== undefined ? String(u.quantity) : '',
        rate: u.rate !== undefined ? String(u.rate) : '',
        amount: u.amount !== undefined ? String(u.amount) : '',
        collectionGroupId: u.collectionGroupId || '',
        machineId: u.machineId || '',
        salesmanId: u.salesmanId || '',
        remarks: u.remarks || '',
      })));

      // Map deposits
      setCashDeposits(savedDeposits.map(d => ({
        id: d.id,
        collectionGroupId: d.collectionGroupId || (groupsToUse[0]?.id || ''),
        amount: d.amount,
        salesmanId: d.salesmanId,
        salesmanName: d.salesmanName,
        time: d.time,
        reference: d.reference,
      })));

      // Map expenses
      setExpenses(savedExpenses.map(e => ({
        id: e.id,
        categoryId: e.categoryId,
        categoryName: e.categoryName,
        amount: e.amount,
        paymentSource: e.paymentSource || 'Cash',
        collectionGroupId: e.collectionGroupId || '',
        remarks: e.remarks,
      })));

      // Map money movements
      setMoneyMovements(savedMovements.map(m => ({
        id: m.id,
        type: m.type || 'Other Payment',
        payeeId: m.payeeId,
        payeeName: m.payeeName,
        amount: m.amount,
        paymentSource: m.paymentSource || 'Cash',
        collectionGroupId: m.collectionGroupId || '',
        remarks: m.remarks,
      })));
    } else {
      // Day does NOT exist yet: initialize new day draft
      setExistingEntryId(null);
      setEntryMeta(null);
      setStatus('draft');
      setIsDemo(false);

      // Get previous closing readings for opening
      const prevClosings = getPreviousClosingReadings(selectedDate);
      const initReadings = activeNozzles.map(n => {
        const prevClose = prevClosings[n.id];
        const priceObj = getApplicablePrice(n.productId, selectedDate);
        return {
          id: null,
          nozzleId: n.id,
          machineId: n.machineId,
          productId: n.productId,
          openingReading: prevClose !== undefined ? String(prevClose) : '0',
          closingReading: '',
          sellingPrice: priceObj ? priceObj.sellingPrice : null,
        };
      });
      setReadings(initReadings);

      // Suggest previous collection grouping setup
      const templateGroups = getPreviousCollectionGroups(selectedDate);
      setCollectionGroups(templateGroups.map(g => ({
        ...g,
        paymentMethods: Array.isArray(g.paymentMethods)
          ? g.paymentMethods.filter(m => m !== 'Udhaar')
          : ['Cash', 'UPI', 'Card', 'Paytm', 'Other'],
      })));
      setPreviousSetupNotice(true);

      const initGroupMap = {};
      templateGroups.forEach(g => {
        initGroupMap[g.id] = { Cash: '', UPI: '', Card: '', Paytm: '', Other: '', remarks: '' };
      });
      setGroupCollectionsMap(initGroupMap);

      setUdhaarSales([]);
      setCashDeposits([]);
      setExpenses([]);
      setMoneyMovements([]);
    }

    // Auto-fetch Physical Cash Count for selected date (Section 29)
    const countTotal = getCashCountTotalByDate(selectedDate);
    const countRecords = getCashCountsByDate(selectedDate);
    setCashCountTotal(countTotal);
    setCashCountEntries(countRecords);
  }, []);

  useEffect(() => {
    loadDayData(date);
  }, [date, loadDayData]);

  // Handle closing reading input change
  const handleReadingChange = (nozzleId, field, value) => {
    setReadings(prev => prev.map(r => {
      if (r.nozzleId !== nozzleId) return r;
      return { ...r, [field]: value };
    }));
  };

  // Handle group collection change
  const handleGroupCollectionChange = (groupId, mode, value) => {
    setGroupCollectionsMap(prev => ({
      ...prev,
      [groupId]: {
        ...(prev[groupId] || { Cash: '', UPI: '', Card: '', Paytm: '', Other: '', remarks: '' }),
        [mode]: value,
      },
    }));
  };

  // Section Calculations
  const calculations = useMemo(() => {
    let petrolLitres = 0;
    let dieselLitres = 0;
    let speedLitres = 0;
    let totalLitres = 0;
    let totalSalesValue = 0;
    let hasMeterErrors = false;

    // 1. Nozzle row derived values
    const rowCalculations = readings.map(r => {
      const nozzle = nozzles.find(n => n.id === r.nozzleId);
      const product = products.find(p => p.id === r.productId);
      const machine = machines.find(m => m.id === r.machineId);

      const opening = Number(r.openingReading) || 0;
      const closingStr = (r.closingReading ?? '').toString().trim();
      const hasClosing = closingStr !== '';
      const closing = Number(closingStr);

      let isInvalid = false;
      let errorMsg = '';

      if (hasClosing && closing < opening) {
        isInvalid = true;
        errorMsg = 'Closing reading cannot be lower than opening reading.';
        hasMeterErrors = true;
      }

      const salesLitres = hasClosing && !isInvalid ? Number((closing - opening).toFixed(2)) : 0;
      const price = r.sellingPrice !== null && r.sellingPrice !== undefined ? Number(r.sellingPrice) : null;
      const salesValue = price !== null && !isInvalid ? Number((salesLitres * price).toFixed(2)) : 0;

      if (!isInvalid) {
        totalLitres += salesLitres;
        totalSalesValue += salesValue;
        if (product?.name.toLowerCase().includes('speed')) {
          speedLitres += salesLitres;
        } else if (product?.name.toLowerCase().includes('diesel')) {
          dieselLitres += salesLitres;
        } else if (product?.name.toLowerCase().includes('petrol')) {
          petrolLitres += salesLitres;
        }
      }

      return {
        ...r,
        nozzle,
        product,
        machine,
        opening,
        closing: hasClosing ? closing : null,
        hasClosing,
        salesLitres,
        price,
        salesValue,
        isInvalid,
        errorMsg,
      };
    });

    // 2. Machine-wise derived totals
    const machineTotals = machines.map(m => {
      const machReadings = rowCalculations.filter(r => r.machineId === m.id);
      const litres = Number(machReadings.reduce((sum, r) => sum + r.salesLitres, 0).toFixed(2));
      const salesVal = Number(machReadings.reduce((sum, r) => sum + r.salesValue, 0).toFixed(2));
      return {
        machineId: m.id,
        name: m.name,
        litres,
        salesValue: salesVal,
        nozzles: machReadings,
      };
    });

    // 3. Total Udhaar Sales
    const totalUdhaar = Number(udhaarSales.reduce((sum, u) => sum + (Number(u.amount) || 0), 0).toFixed(2));

    // 4. Collection Group derived totals
    const groupTotals = collectionGroups.map(grp => {
      const assignedMachines = machineTotals.filter(m => (grp.machineIds || []).includes(m.machineId));
      const groupLitres = Number(assignedMachines.reduce((sum, m) => sum + m.litres, 0).toFixed(2));
      const groupSalesValue = Number(assignedMachines.reduce((sum, m) => sum + m.salesValue, 0).toFixed(2));

      const grpCols = groupCollectionsMap[grp.id] || {};
      let groupCollections = 0;
      let groupCashCollected = 0;

      PAYMENT_MODES.forEach(mode => {
        const amt = Number(grpCols[mode]) || 0;
        groupCollections += amt;
        if (mode === 'Cash') groupCashCollected += amt;
      });

      groupCollections = Number(groupCollections.toFixed(2));
      groupCashCollected = Number(groupCashCollected.toFixed(2));

      // Group Udhaar: attributed to this group or if single group, all udhaar
      const grpUdhaar = Number(
        udhaarSales
          .filter(u => u.collectionGroupId === grp.id || (!u.collectionGroupId && collectionGroups.length === 1))
          .reduce((sum, u) => sum + (Number(u.amount) || 0), 0)
          .toFixed(2)
      );

      // Correct Group Reconciliation:
      // Sales Value = Collections (Cash + UPI + Card + Paytm + Other) + Udhaar
      const groupReconciledSales = Number((groupCollections + grpUdhaar).toFixed(2));
      const groupDiff = Number((groupSalesValue - groupReconciledSales).toFixed(2));
      const groupReconciled = Math.abs(groupDiff) < 0.01;

      return {
        groupId: grp.id,
        name: grp.name,
        machineIds: grp.machineIds || [],
        salesmanIds: grp.salesmanIds || [],
        paymentMethods: grp.paymentMethods || [],
        assignedMachines,
        groupLitres,
        groupSalesValue,
        groupCollections,
        groupUdhaar: grpUdhaar,
        groupReconciledSales,
        groupCashCollected,
        groupDiff,
        groupReconciled,
      };
    });

    // 5. Overall Collections rollup (Actual money received only)
    let totalCollections = 0;
    let totalCashCollected = 0;
    const collectionsByMode = { Cash: 0, UPI: 0, Card: 0, Paytm: 0, Other: 0 };

    groupTotals.forEach(gt => {
      const cols = groupCollectionsMap[gt.groupId] || {};
      PAYMENT_MODES.forEach(mode => {
        const amt = Number(cols[mode]) || 0;
        collectionsByMode[mode] += amt;
        totalCollections += amt;
        if (mode === 'Cash') totalCashCollected += amt;
      });
    });

    totalCollections = Number(totalCollections.toFixed(2));
    totalCashCollected = Number(totalCashCollected.toFixed(2));

    // 6. Overall Cash Deposits
    const totalCashDeposited = Number(cashDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0).toFixed(2));

    // 7. Overall Expenses (cash vs non-cash impact)
    let totalExpenses = 0;
    let totalCashExpenses = 0;
    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      totalExpenses += amt;
      if (e.paymentSource === 'Cash' || !e.paymentSource) {
        totalCashExpenses += amt;
      }
    });
    totalExpenses = Number(totalExpenses.toFixed(2));
    totalCashExpenses = Number(totalCashExpenses.toFixed(2));

    // 8. Overall Other Payments / Money Movements (cash vs non-cash impact)
    let totalMoneyMovements = 0;
    let totalOtherCashPayments = 0;
    moneyMovements.forEach(m => {
      const amt = Number(m.amount) || 0;
      totalMoneyMovements += amt;
      if (m.paymentSource === 'Cash') {
        totalOtherCashPayments += amt;
      }
    });
    totalMoneyMovements = Number(totalMoneyMovements.toFixed(2));
    totalOtherCashPayments = Number(totalOtherCashPayments.toFixed(2));

    // 9. Overall Cash Remaining:
    // Cash Collections - Cash Deposits - Cash Expenses - Other Cash Payments
    // (Never subtract UPI, Card, Paytm, or Udhaar from physical cash!)
    // Customer payments received in cash (entered in the Received tab) add to physical cash
    const customerCashReceived = getCustomerReceiptTotals(date).cash;
    const overallCashRemaining = Number((totalCashCollected - totalCashDeposited - totalCashExpenses - totalOtherCashPayments + customerCashReceived).toFixed(2));

    // 10. Core Business Reconciliation:
    // Meter Sales = Total Collected + Total Udhaar
    // Reconciled Sales = Total Collected + Total Udhaar
    // Difference = Total Meter Sales Value - Reconciled Sales
    const reconciledSales = Number((totalCollections + totalUdhaar).toFixed(2));
    const overallDifference = Number((totalSalesValue - reconciledSales).toFixed(2));
    const overallReconciled = Math.abs(overallDifference) < 0.01;

    // 11. Machine grouping validation
    const groupValidation = validateMachineGrouping(collectionGroups, machines);

    // 12. Physical Cash Count vs Forecourt Expected Cash (Sections 28-29)
    const expectedForecourtCash = overallCashRemaining;
    const physicalCashCounted = cashCountTotal;
    const hasCashCount = cashCountEntries.length > 0;
    const cashCountDiff = Number((physicalCashCounted - expectedForecourtCash).toFixed(2));
    const cashCountBalanced = hasCashCount && Math.abs(cashCountDiff) < 0.01;

    return {
      rowCalculations,
      machineTotals,
      groupTotals,
      petrolLitres: Number(petrolLitres.toFixed(2)),
      dieselLitres: Number(dieselLitres.toFixed(2)),
      speedLitres: Number(speedLitres.toFixed(2)),
      totalLitres: Number(totalLitres.toFixed(2)),
      totalSalesValue: Number(totalSalesValue.toFixed(2)),
      collectionsByMode,
      totalCollections,
      totalUdhaar,
      reconciledSales,
      totalCashCollected,
      totalCashDeposited,
      totalExpenses,
      totalCashExpenses,
      totalMoneyMovements,
      totalOtherCashPayments,
      overallCashRemaining,
      overallDifference,
      overallReconciled,
      hasMeterErrors,
      groupValidation,
      expectedForecourtCash,
      physicalCashCounted,
      hasCashCount,
      cashCountDiff,
      cashCountBalanced,
      cashCountEntriesCount: cashCountEntries.length,
    };
  }, [readings, nozzles, products, machines, collectionGroups, groupCollectionsMap, udhaarSales, cashDeposits, expenses, moneyMovements, cashCountTotal, cashCountEntries, date, receiptTick]);

  // Save Day Handler (Draft or Completed)
  const handleSave = async (targetStatus = 'draft') => {
    // Meter reading validations
    if (calculations.hasMeterErrors) {
      toast.error('Cannot save: Some closing readings are lower than opening readings. Please fix highlighted errors.');
      return;
    }

    // Completion validations
    if (targetStatus === 'completed') {
      if (date > localDate()) {
        toast.error('Cannot complete a day that is in the future. Check the date at the top of the page.');
        return;
      }
      if (!calculations.groupValidation.valid) {
        toast.error('Cannot complete day: ' + calculations.groupValidation.errors[0]);
        return;
      }

      // Check that all 12 nozzles have closing readings entered
      const missingReadings = readings.filter(r => r.closingReading === '' || r.closingReading === null || r.closingReading === undefined);
      if (missingReadings.length > 0) {
        toast.error(`Cannot complete day: Please enter closing readings for all ${missingReadings.length} remaining nozzle(s).`);
        return;
      }
    }

    // Change control: completed days and days older than yesterday need a written reason
    let reasonGiven = '';
    if (!isDemo && dailyEntryNeedsReason(date, entryMeta?.status ?? null)) {
      reasonGiven = await requestReason({
        title: entryMeta ? 'Change to a saved day' : 'Adding a past day',
        date,
        detail: entryMeta?.status === 'completed'
          ? 'This day is already completed.'
          : 'This day is older than yesterday.',
        confirmLabel: 'Save change',
      });
      if (!reasonGiven) return;
    }

    try {
      // Build flattened collections list with collectionGroupId
      const flatCollections = [];
      collectionGroups.forEach(grp => {
        const cols = groupCollectionsMap[grp.id] || {};
        PAYMENT_MODES.forEach(mode => {
          const amt = Number(cols[mode]) || 0;
          if (amt > 0) {
            flatCollections.push({
              collectionGroupId: grp.id,
              paymentMode: mode,
              amount: amt,
              remarks: cols.remarks || '',
            });
          }
        });
      });

      const payload = {
        id: existingEntryId,
        date,
        status: targetStatus,
        isDemo,
        editReason: reasonGiven,
        collectionGroups: collectionGroups.map(g => ({
          id: g.id,
          name: g.name,
          machineIds: g.machineIds || [],
          salesmanIds: g.salesmanIds || [],
          paymentMethods: g.paymentMethods || ['Cash', 'UPI', 'Card', 'Paytm', 'Other'],
        })),
        meterReadings: calculations.rowCalculations.map(r => ({
          id: r.id,
          nozzleId: r.nozzleId,
          machineId: r.machineId,
          productId: r.productId,
          nozzleName: r.nozzle?.name || '',
          productName: r.product?.name || '',
          machineName: r.machine?.name || '',
          openingReading: r.opening,
          closingReading: r.closing ?? r.opening,
          sellingPrice: r.price,
        })),
        collections: flatCollections,
        udhaarSales: udhaarSales.map(u => ({
          ...u,
          amount: Number(u.amount) || 0,
          quantity: Number(u.quantity) || 0,
          rate: Number(u.rate) || 0,
        })),
        cashDeposits: cashDeposits.map(d => ({
          id: d.id,
          collectionGroupId: d.collectionGroupId || null,
          amount: Number(d.amount) || 0,
          salesmanId: d.salesmanId || null,
          salesmanName: d.salesmanName || '',
          time: d.time || '',
          reference: d.reference || '',
        })),
        expenses: expenses.map(e => ({
          id: e.id,
          categoryId: e.categoryId,
          categoryName: e.categoryName || '',
          amount: Number(e.amount) || 0,
          paymentSource: e.paymentSource || 'Cash',
          collectionGroupId: e.collectionGroupId || null,
          remarks: e.remarks || '',
        })),
        moneyMovements: moneyMovements.map(m => ({
          id: m.id,
          type: m.type,
          payeeId: m.payeeId || null,
          payeeName: m.payeeName || '',
          amount: Number(m.amount) || 0,
          paymentSource: m.paymentSource || 'Cash',
          collectionGroupId: m.collectionGroupId || null,
          remarks: m.remarks || '',
        })),
      };

      const result = saveDailyEntry(payload);
      setExistingEntryId(result.dailyEntry.id);
      setEntryMeta(result.dailyEntry);
      setStatus(result.dailyEntry.status);
      setPreviousSetupNotice(false);

      if (targetStatus === 'completed' && Math.abs(calculations.overallDifference || 0) >= 0.5) {
        toast.warning(`Day ${date} completed, but sales and collections differ by ${INR(calculations.overallDifference)}. Please review the Summary section.`);
      } else if (targetStatus === 'completed') {
        toast.success(`Day ${date} completed and verified successfully!`);
      } else {
        toast.success(`Day ${date} saved as Draft.`);
      }
    } catch (err) {
      toast.error('Unable to save daily entry: ' + err.message);
    }
  };

  // Group modal handlers
  const handleOpenAddGroup = () => {
    setGroupModal({
      open: true,
      index: -1,
      group: {
        name: `Group ${String.fromCharCode(65 + collectionGroups.length)}`,
        machineIds: [],
        salesmanIds: [],
        paymentMethods: ['Cash', 'UPI', 'Card', 'Paytm', 'Other'],
      },
    });
  };

  const handleOpenEditGroup = (index) => {
    setGroupModal({
      open: true,
      index,
      group: { ...collectionGroups[index] },
    });
  };

  const handleSaveGroup = (groupData) => {
    if (!groupData.name.trim()) {
      toast.error('Please enter a Group Name.');
      return;
    }
    if (groupModal.index === -1) {
      // Add new group
      const newGroupId = `grp-${Date.now()}`;
      setCollectionGroups(prev => [...prev, { ...groupData, id: newGroupId }]);
      setGroupCollectionsMap(prev => ({
        ...prev,
        [newGroupId]: { Cash: '', UPI: '', Card: '', Paytm: '', Other: '', remarks: '' },
      }));
      toast.success(`Added ${groupData.name}`);
    } else {
      // Update existing group
      setCollectionGroups(prev => prev.map((g, idx) => idx === groupModal.index ? { ...g, ...groupData } : g));
      toast.success(`Updated ${groupData.name}`);
    }
    setGroupModal({ open: false, index: -1, group: null });
  };

  const handleDeleteGroup = (index) => {
    const targetGroup = collectionGroups[index];
    if (collectionGroups.length <= 1) {
      toast.error('At least one Collection Group is required.');
      return;
    }
    setCollectionGroups(prev => prev.filter((_, idx) => idx !== index));
    toast.success(`Deleted ${targetGroup.name}`);
  };

  // Udhaar / Credit Sales handlers
  const handleOpenAddUdhaar = (defaultGroupId = '') => {
    const defaultCust = customers[0];
    const defaultProd = products[0];
    const priceObj = defaultProd ? getApplicablePrice(defaultProd.id, date) : null;
    const initialRate = priceObj?.sellingPrice || 0;

    setUdhaarModal({
      open: true,
      index: -1,
      udhaar: {
        customerId: defaultCust?.id || '',
        customerName: defaultCust?.name || '',
        productId: defaultProd?.id || '',
        productName: defaultProd?.name || '',
        quantity: '',
        rate: initialRate ? String(initialRate) : '',
        amount: '',
        collectionGroupId: defaultGroupId || collectionGroups[0]?.id || '',
        machineId: '',
        salesmanId: salesmen[0]?.id || '',
        remarks: '',
      },
    });
  };

  const handleOpenEditUdhaar = (index) => {
    setUdhaarModal({
      open: true,
      index,
      udhaar: { ...udhaarSales[index] },
    });
  };

  const handleSaveUdhaar = (udh) => {
    if (!udh.customerId) {
      toast.error('Please select a customer for Udhaar credit sale.');
      return;
    }
    const amt = Number(udh.amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid Udhaar amount.');
      return;
    }
    const cust = customers.find(c => c.id === udh.customerId);
    const prod = products.find(p => p.id === udh.productId);
    const staff = salesmen.find(s => s.id === udh.salesmanId);

    const enriched = {
      ...udh,
      amount: amt,
      customerName: cust ? cust.name : (udh.customerName || 'Customer'),
      productName: prod ? prod.name : (udh.productName || 'Fuel'),
      salesmanName: staff ? staff.name : '',
    };

    if (udhaarModal.index === -1) {
      setUdhaarSales(prev => [...prev, { ...enriched, id: `udh-${Date.now()}` }]);
      toast.success('Udhaar credit sale added.');
    } else {
      setUdhaarSales(prev => prev.map((u, i) => i === udhaarModal.index ? enriched : u));
      toast.success('Udhaar credit sale updated.');
    }
    setUdhaarModal({ open: false, index: -1, udhaar: null });
  };

  // Cash Deposit handlers
  const handleOpenAddDeposit = (defaultGroupId = '') => {
    const targetGroup = defaultGroupId || collectionGroups[0]?.id || '';
    setDepositModal({
      open: true,
      index: -1,
      deposit: {
        collectionGroupId: targetGroup,
        amount: '',
        salesmanId: salesmen[0]?.id || '',
        time: new Date().toTimeString().slice(0, 5),
        reference: '',
      },
    });
  };

  const handleSaveDeposit = (dep) => {
    const amt = Number(dep.amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid deposit amount greater than ₹0.');
      return;
    }
    const staff = salesmen.find(s => s.id === dep.salesmanId);
    const enriched = {
      ...dep,
      amount: amt,
      salesmanName: staff ? staff.name : '',
    };
    if (depositModal.index === -1) {
      setCashDeposits(prev => [...prev, { ...enriched, id: `dep-${Date.now()}` }]);
      toast.success('Cash deposit added.');
    } else {
      setCashDeposits(prev => prev.map((d, i) => i === depositModal.index ? enriched : d));
      toast.success('Cash deposit updated.');
    }
    setDepositModal({ open: false, index: -1, deposit: null });
  };

  // Expense handlers
  const handleOpenAddExpense = (defaultGroupId = '') => {
    setExpenseModal({
      open: true,
      index: -1,
      expense: {
        categoryId: expenseCategories[0]?.id || '',
        amount: '',
        paymentSource: 'Cash',
        collectionGroupId: defaultGroupId || '',
        remarks: '',
      },
    });
  };

  const handleSaveExpense = (exp) => {
    const amt = Number(exp.amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid expense amount.');
      return;
    }
    const cat = expenseCategories.find(c => c.id === exp.categoryId);
    const enriched = {
      ...exp,
      amount: amt,
      categoryName: cat ? cat.name : 'Expense',
    };
    if (expenseModal.index === -1) {
      setExpenses(prev => [...prev, { ...enriched, id: `exp-${Date.now()}` }]);
      toast.success('Expense recorded.');
    } else {
      setExpenses(prev => prev.map((e, i) => i === expenseModal.index ? enriched : e));
      toast.success('Expense updated.');
    }
    setExpenseModal({ open: false, index: -1, expense: null });
  };

  // Money Movement / Advances handlers
  const handleOpenAddMovement = (defaultGroupId = '') => {
    setMovementModal({
      open: true,
      index: -1,
      movement: {
        type: 'Employee Advance',
        payeeId: salesmen[0]?.id || '',
        payeeName: salesmen[0]?.name || '',
        amount: '',
        paymentSource: 'Cash',
        collectionGroupId: defaultGroupId || '',
        remarks: '',
      },
    });
  };

  const handleSaveMovement = (mov) => {
    const amt = Number(mov.amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid payment/advance amount.');
      return;
    }
    let payeeName = mov.payeeName;
    if (mov.payeeId) {
      const staff = salesmen.find(s => s.id === mov.payeeId);
      if (staff) payeeName = staff.name;
    }
    const enriched = {
      ...mov,
      amount: amt,
      payeeName: payeeName || 'Payee',
    };
    if (movementModal.index === -1) {
      setMoneyMovements(prev => [...prev, { ...enriched, id: `mov-${Date.now()}` }]);
      toast.success('Money movement recorded.');
    } else {
      setMoneyMovements(prev => prev.map((m, i) => i === movementModal.index ? enriched : m));
      toast.success('Money movement updated.');
    }
    setMovementModal({ open: false, index: -1, movement: null });
  };

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Operations', path: '/operations' },
          { label: 'Daily Entry' },
        ]}
      />

      {reasonDialog}

      {/* Change-control banner: past / completed days */}
      {!isDemo && dailyEntryNeedsReason(date, entryMeta?.status ?? null) && (
        <div className="chip warn" style={{ height: 'auto', padding: '8px 10px', whiteSpace: 'normal', marginBottom: 10, alignItems: 'flex-start' }} role="status">
          <Icon name="alert" />
          <span>
            <b>{entryMeta?.status === 'completed' ? 'Completed day.' : 'Past day.'}</b>{' '}
            Changes here need a written reason and will be marked as edited in the change log.
          </span>
        </div>
      )}
      {entryMeta?.isEdited && (
        <details className="panel" style={{ padding: '8px 12px', marginBottom: 10 }}>
          <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none', flexWrap: 'wrap' }}>
            <span className="chip warn"><Icon name="edit" /> Edited {entryMeta.editLog.length}×</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Last: {new Date(entryMeta.lastEditedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} — {entryMeta.lastEditReason}
            </span>
          </summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {[...entryMeta.editLog].reverse().map((e, i) => (
              <li key={i}>
                <b>{new Date(e.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</b> — {e.reason}
                {' '}<span style={{ color: 'var(--text-muted)' }}>(sales {INR(e.salesBefore)} → {INR(e.salesAfter)}, cash {INR(e.cashBefore)} → {INR(e.cashAfter)})</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* SECTION A: DATE / DAY STATUS & HEADER */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>Daily Operations</h1>
            <StatusBadge status={status === 'completed' ? 'active' : 'inactive'} />
            {isDemo && (
              <span className="badge badge-warning" style={{ fontWeight: 700, fontSize: 11, }}>
                <Icon name="droplet" /> Demo data
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Date:</span>
              <input
                id="daily-entry-date-picker"
                type="date"
                className="input-field"
                style={{ width: 'auto', padding: '4px 8px', fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent' }}
                value={date}
                onChange={e => handleDateChange(e.target.value)}
              />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Shift record for {date}
            </div>
          </div>
        </div>

        <div className="page-header-actions" style={{ gap: 12 }}>
          <button
            id="btn-save-draft"
            type="button"
            className="btn btn-secondary"
            onClick={() => handleSave('draft')}
            title="Save changes as Draft"
          >
            Save Draft
          </button>
          <button
            id="btn-save-complete"
            type="button"
            className="btn btn-primary"
            onClick={() => handleSave('completed')}
            title="Verify and Mark Shift Completed"
            style={{ fontWeight: 700 }}
          >
            Save &amp; Complete
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setResetConfirm(true)}
            title="Reset all unsaved inputs for this date"
          >
            Reset
          </button>
        </div>
      </div>

      {/* OPERATIONS OVERVIEW */}
      <div className="section-block">
        <div className="section-header">Operations Overview</div>
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">Meter Sales</div>
            <div className="metric-value">{INR(calculations.totalSalesValue)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Collections</div>
            <div className="metric-value">{INR(calculations.totalCollections)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Udhaar</div>
            <div className="metric-value">{INR(calculations.totalUdhaar)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Cash Deposits</div>
            <div className="metric-value">{INR(calculations.totalCashDeposited)}</div>
          </div>
          <div className="metric-card" style={{ borderLeft: calculations.overallReconciled ? '3px solid var(--color-success)' : '3px solid var(--color-danger)' }}>
            <div className="metric-label">Difference</div>
            <div className="metric-value" style={{ color: calculations.overallReconciled ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {INR(calculations.overallDifference)}
            </div>
          </div>
        </div>
      </div>

      {/* WORKFLOW INDICATOR */}
      <div className="workflow-nav">
        <div className={`workflow-step ${openSections.meters ? 'current' : (calculations.totalLitres > 0 ? 'completed' : '')}`} onClick={() => toggleSection('meters')} style={{ cursor: 'pointer' }}>
          01 Meters
        </div>
        <div className="workflow-divider"></div>
        <div className={`workflow-step ${openSections.groups ? 'current' : (calculations.totalCollections > 0 ? 'completed' : '')}`} onClick={() => toggleSection('groups')} style={{ cursor: 'pointer' }}>
          02 Collections
        </div>
        <div className="workflow-divider"></div>
        <div className={`workflow-step ${openSections.creditPayments ? 'current' : ''}`} onClick={() => toggleSection('creditPayments')} style={{ cursor: 'pointer' }}>
          03 Credit
        </div>
        <div className="workflow-divider"></div>
        <div className={`workflow-step ${openSections.deposits ? 'current' : ''}`} onClick={() => toggleSection('deposits')} style={{ cursor: 'pointer' }}>
          04 Deposits
        </div>
        <div className="workflow-divider"></div>
        <div className={`workflow-step ${openSections.summary ? 'current' : ''}`} onClick={() => toggleSection('summary')} style={{ cursor: 'pointer' }}>
          05 Summary
        </div>
      </div>

      {/* Previous Grouping Setup Detected Banner */}
      {previousSetupNotice && (
        <div style={{
          marginBottom: 14,
          padding: '9px 12px',
          background: 'rgba(34, 211, 238, 0.05)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--color-accent)' }}></span>
            <span>
              <strong>Reusing previous collection setup</strong> ({collectionGroups.map(g => g.name).join(' & ')}). Amounts start clean at zero.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviousSetupNotice(false)}>Keep Setup</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleOpenAddGroup}>Customize</button>
          </div>
        </div>
      )}

      {/* SECTION 2: METER READINGS (12 NOZZLES) - ACCORDION */}
      <div className={`daily-accordion-card ${openSections.meters ? 'is-open' : ''}`}>
        <div
          onClick={() => toggleSection('meters')}
          className="daily-accordion-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="acc-icon"><Icon name="gauge" /></span>
            <span className="acc-title">2. Meter Readings</span>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>12 Active Nozzles</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Volume: <strong style={{ color: 'var(--color-primary)' }}>{FMT_QTY(calculations.totalLitres)}</strong> • Sales: <strong style={{ color: 'var(--color-success)' }}>{INR(calculations.totalSalesValue)}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {calculations.hasMeterErrors && (
              <span className="badge badge-danger" style={{ fontSize: 11 }}><Icon name="alert" /> Errors Detected</span>
            )}
            <span className="daily-accordion-chevron" aria-hidden="true"><Icon name="chevron" className="icon-sm" /></span>
          </div>
        </div>

        {openSections.meters && (
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Enter <strong>Closing Reading</strong> only. Opening readings pull automatically from the previous day. Litres &amp; sales calculate immediately.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={allowManualOpening}
                onChange={e => setAllowManualOpening(e.target.checked)}
              />
              <span>Allow Manual Opening Meter</span>
            </label>
          </div>
        </div>

        {/* Machine-by-Machine Nozzle Entries & Section C Machine Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {calculations.machineTotals.map(mach => (
            <div key={mach.machineId} style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-default)' }}>
              <div style={{
                padding: '0 0 12px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{mach.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                    {mach.nozzles.length} nozzles
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5 }}>
                  <span className="text-muted">Volume: <strong style={{ color: 'var(--color-primary)' }}>{FMT_QTY(mach.litres)}</strong></span>
                  <span className="text-muted">Sales: <strong style={{ color: 'var(--color-success)' }}>{INR(mach.salesValue)}</strong></span>
                </div>
              </div>

              {/* Nozzles Table / Grid */}
              <div style={{ overflowX: 'auto' }}>
                <table className="table meter-table" style={{ margin: 0, fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '18%' }}>Nozzle</th>
                      <th style={{ width: '16%' }}>Product</th>
                      <th style={{ width: '16%', textAlign: 'right' }}>Opening</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>Closing Reading</th>
                      <th style={{ width: '14%', textAlign: 'right' }}>Sales Litres</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>Sales Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mach.nozzles.map(row => {
                      const prodBadgeColor = row.product?.name.includes('Speed')
                        ? 'badge-warning'
                        : row.product?.name.includes('Petrol')
                        ? 'badge-info'
                        : 'badge-success';

                      return (
                        <tr key={row.nozzleId} style={{ background: row.isInvalid ? 'var(--danger-bg)' : 'transparent' }}>
                          <td className="c-noz" style={{ fontWeight: 600 }}>{row.nozzle?.name}</td>
                          <td className={`c-prod ${row.nozzle?.name && row.product?.name && row.nozzle.name.toLowerCase().includes(row.product.name.toLowerCase()) ? 'prod-dup' : ''}`}>
                            <span className={`badge ${prodBadgeColor}`} style={{ fontSize: 11 }}>
                              {row.product?.name || 'Fuel'}
                            </span>
                          </td>
                          <td className="c-open" style={{ textAlign: 'right' }}>
                            {allowManualOpening ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                className="input-field"
                                style={{ width: 100, maxWidth: '100%', textAlign: 'right', padding: '0 8px', fontSize: 12.5, fontFamily: 'var(--font-mono)' }}
                                value={row.openingReading}
                                onChange={e => handleReadingChange(row.nozzleId, 'openingReading', e.target.value)}
                              />
                            ) : (
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {Number(row.opening).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="c-close" style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              placeholder={Number(row.opening).toFixed(2)}
                              className={`input-field ${row.isInvalid ? 'input-error' : ''}`}
                              style={{ width: 120, maxWidth: '100%', textAlign: 'right', padding: '0 8px', fontWeight: 700, fontFamily: 'var(--font-mono)', borderColor: 'color-mix(in srgb, var(--color-primary) 45%, var(--border-default))' }}
                              value={row.closingReading}
                              onChange={e => handleReadingChange(row.nozzleId, 'closingReading', e.target.value)}
                            />
                            {row.isInvalid && (
                              <div style={{ color: 'var(--color-danger)', fontSize: 11, marginTop: 2 }}>
                                {row.errorMsg}
                              </div>
                            )}
                          </td>
                          <td className="c-lit" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                            {FMT_QTY(row.salesLitres)}
                          </td>
                          <td className="c-val" style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {INR(row.salesValue)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {row.price ? `@ ₹${row.price.toFixed(2)}/L` : 'Price not configured'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* SECTION 7: MACHINE-WISE TOTAL ROW */}
                  <tfoot>
                    <tr style={{ background: 'var(--bg-surface)', borderTop: '2px solid var(--border-default)', fontWeight: 700 }}>
                      <td colSpan={4} style={{ textAlign: 'right', fontSize: 12.5, }}>
                        {mach.name} total
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-primary)', fontSize: 13.5 }}>
                        {FMT_QTY(mach.litres)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-success)', fontSize: 14 }}>
                        {INR(mach.salesValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* SECTION 8 & 31: OVERALL FUEL TOTALS SUMMARY RIBBON */}
        <div style={{
          marginTop: 18,
          padding: '14px 18px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Petrol Volume</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginTop: 2 }}>
              {FMT_QTY(calculations.petrolLitres)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Diesel Volume</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-success)', marginTop: 2 }}>
              {FMT_QTY(calculations.dieselLitres)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Speed Petrol</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-warning)', marginTop: 2 }}>
              {FMT_QTY(calculations.speedLitres)}
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border-default)', paddingLeft: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Total Fuel Volume</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', marginTop: 2 }}>
              {FMT_QTY(calculations.totalLitres)}
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border-default)', paddingLeft: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', }}>Total Meter Sales</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-success)', marginTop: 2 }}>
              {INR(calculations.totalSalesValue)}
            </div>
          </div>
        </div>
          </div>
        )}
      </div>

      {/* SECTION 3: COLLECTION GROUPS - ACCORDION */}
      <div className={`daily-accordion-card ${openSections.groups ? 'is-open' : ''}`}>
        <div
          onClick={() => toggleSection('groups')}
          className="daily-accordion-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="acc-icon"><Icon name="users" /></span>
            <span className="acc-title">3. Collection Groups</span>
            <span className="badge badge-info" style={{ fontSize: 11 }}>
              {collectionGroups.length} Groups
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Collected: <strong style={{ color: 'var(--text-primary)' }}>{INR(calculations.totalCollections)}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!calculations.groupValidation.valid && (
              <span className="badge badge-danger" style={{ fontSize: 11 }}><Icon name="alert" /> Assign Issue</span>
            )}
            <span className="daily-accordion-chevron" aria-hidden="true"><Icon name="chevron" className="icon-sm" /></span>
          </div>
        </div>

        {openSections.groups && (
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Machines handled together for shared cash/QR/card collection. Each active machine must belong to exactly one group for completion.
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleOpenAddGroup}
              >
                + Add Collection Group
              </button>
            </div>

        {/* Machine Assignment Validation Banner */}
        {!calculations.groupValidation.valid && (
          <div style={{
            marginBottom: 14,
            padding: '10px 14px',
            background: 'var(--danger-bg)',
            border: '1px solid var(--color-danger)',
            borderRadius: 8,
            fontSize: 12.5,
            color: 'var(--color-danger)',
          }}>
            <strong><Icon name="alert" /> Group Assignment Warning:</strong> {calculations.groupValidation.errors.join(' ')}
          </div>
        )}

        {/* Group Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 10 }}>
          {calculations.groupTotals.map((grp, idx) => {
            const cols = groupCollectionsMap[grp.groupId] || {};
            const staffList = grp.salesmanIds.map(id => salesmen.find(s => s.id === id)?.name).filter(Boolean);

            return (
              <div
                key={grp.groupId}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                {/* Group Card Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                      {grp.name}
                    </div>
                    {/* Machines pills */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {grp.assignedMachines.map(m => (
                        <span key={m.machineId} className="badge badge-neutral" style={{ fontSize: 11 }}>
                          <Icon name="fuel" /> {m.name}
                        </span>
                      ))}
                      {grp.assignedMachines.length === 0 && (
                        <span className="badge badge-danger" style={{ fontSize: 11 }}>No machines assigned</span>
                      )}
                    </div>
                    {/* Operators */}
                    {staffList.length > 0 && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                        Attendants: <strong>{staffList.join(' + ')}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleOpenEditGroup(idx)}
                      title="Edit Group Config"
                    >
                      <Icon name="edit" /> Edit
                    </button>
                    {collectionGroups.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteGroup(idx)}
                        style={{ color: 'var(--color-danger)' }}
                        title="Delete Group"
                      >
                        <Icon name="x" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Group Sales Rollup */}
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--bg-card)',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Assigned Sales Volume: </span>
                    <strong style={{ fontSize: 13, color: 'var(--color-primary)' }}>{FMT_QTY(grp.groupLitres)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Sales Value: </span>
                    <strong style={{ fontSize: 14, color: 'var(--color-success)' }}>{INR(grp.groupSalesValue)}</strong>
                  </div>
                </div>

                {/* Group Collections Inputs (Only actual money received) */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, }}>
                    Payment Collections (Actual Money Received)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: 8 }}>
                    {PAYMENT_MODES.map(mode => (
                      <div key={mode} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {mode}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="₹0.00"
                          className="input-field"
                          style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600 }}
                          value={cols[mode] ?? ''}
                          onChange={e => handleGroupCollectionChange(grp.groupId, mode, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group Operational Reconciliation */}
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--bg-card)',
                  borderRadius: 8,
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: 12.5,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Collected:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{INR(grp.groupCollections)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Udhaar (Credit Sales):</span>
                    <strong style={{ color: 'var(--color-warning)' }}>{INR(grp.groupUdhaar)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Reconciled Sales:</span>
                    <strong style={{ color: 'var(--color-primary)' }}>{INR(grp.groupReconciledSales)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Reconciliation Variance:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, color: grp.groupReconciled ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        {INR(grp.groupDiff)}
                      </span>
                      <span className={`badge ${grp.groupReconciled ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                        {grp.groupReconciled ? 'MATCHED' : 'DIFFERENCE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions for this group */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11.5, padding: '4px 8px' }}
                    onClick={() => handleOpenAddUdhaar(grp.groupId)}
                  >
                    + Udhaar Sale
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11.5, padding: '4px 8px' }}
                    onClick={() => handleOpenAddDeposit(grp.groupId)}
                  >
                    + Cash Deposit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11.5, padding: '4px 8px' }}
                    onClick={() => handleOpenAddExpense(grp.groupId)}
                  >
                    + Expense
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11.5, padding: '4px 8px' }}
                    onClick={() => handleOpenAddMovement(grp.groupId)}
                  >
                    + Advance / Pay
                  </button>
                </div>
              </div>
            );
          })}
        </div>
          </div>
        )}
      </div>

      {/* SECTION 4: CREDIT & PAYMENTS (UI GROUPING: UDHAAR + EXPENSES + ADVANCES) */}
      <div className={`daily-accordion-card ${openSections.creditPayments ? 'is-open' : ''}`}>
        <div
          onClick={() => toggleSection('creditPayments')}
          className="daily-accordion-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="acc-icon"><Icon name="card" /></span>
            <span className="acc-title">4. Credit &amp; Payments</span>
            <span className="badge badge-warning" style={{ fontSize: 11 }}>
              Udhaar: {INR(calculations.totalUdhaar)}
            </span>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>
              Expenses: {INR(calculations.totalExpenses)}
            </span>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>
              Advances: {INR(calculations.totalMoneyMovements)}
            </span>
          </div>
          <span className="daily-accordion-chevron" aria-hidden="true"><Icon name="chevron" className="icon-sm" /></span>
        </div>

        {openSections.creditPayments && (
          <div style={{ padding: 12 }}>
            <div style={{
              marginBottom: 14,
              padding: '10px 14px',
              background: 'var(--info-bg, rgba(59,130,246,0.06))',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              fontSize: 12.5,
              color: 'var(--text-secondary)',
            }}>
              <strong>Operational Grouping (Section 18):</strong> Udhaar credit sales to fleet customers, daily pump operating expenses, and staff advances/owner withdrawals are visually grouped here for rapid daily entry. Their ledger categories remain strictly separated in the accounting database.
            </div>

            {/* Inner view tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${creditPaymentTab === 'udhaar' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCreditPaymentTab('udhaar')}
              >
                <Icon name="users" /> Udhaar / Credit Sales ({udhaarSales.length}) • {INR(calculations.totalUdhaar)}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${creditPaymentTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCreditPaymentTab('expenses')}
              >
                <Icon name="receipt" /> Operating Expenses ({expenses.length}) • {INR(calculations.totalExpenses)}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${creditPaymentTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCreditPaymentTab('movements')}
              >
                Advances &amp; Payments ({moneyMovements.length}) • {INR(calculations.totalMoneyMovements)}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${creditPaymentTab === 'received' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCreditPaymentTab('received')}
              >
                Received from customers
              </button>
            </div>

            {/* TAB 1: UDHAAR / CREDIT SALES */}
            {creditPaymentTab === 'udhaar' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Credit fuel sales to registered fleet &amp; commercial customers. Amount = Litres × Rate. <strong>Does NOT increase physical cash.</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenAddUdhaar()}
                  >
                    + Add Udhaar / Credit Sale
                  </button>
                </div>

                {udhaarSales.length === 0 ? (
                  <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    No credit sales (Udhaar) recorded for this day yet. Click "+ Add Udhaar / Credit Sale" to record credit slips.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ margin: 0, fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Customer / Account</th>
                          <th>Product</th>
                          <th style={{ textAlign: 'right' }}>Quantity</th>
                          <th style={{ textAlign: 'right' }}>Rate</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th>Group Link</th>
                          <th>Attendant</th>
                          <th>Remarks / Slip #</th>
                          <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {udhaarSales.map((u, idx) => {
                          const grp = collectionGroups.find(g => g.id === u.collectionGroupId);
                          const cust = customers.find(c => c.id === u.customerId);
                          const outstanding = cust ? getCustomerOutstanding(cust.id) : 0;
                          const limit = cust?.creditLimit || 0;
                          const isOver = limit > 0 && outstanding > limit;

                          return (
                            <tr key={u.id || idx}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{u.customerName}</div>
                                {cust && (
                                  <div style={{ fontSize: 11, color: isOver ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                                    Outstanding: {INR(outstanding)} {isOver && <strong>(OVER LIMIT)</strong>}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                                  {u.productName || 'Fuel'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                {u.quantity ? `${Number(u.quantity).toFixed(2)} L` : '—'}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                {u.rate ? `₹${Number(u.rate).toFixed(2)}` : '—'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-warning)' }}>
                                {INR(u.amount)}
                              </td>
                              <td>
                                <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                                  {grp ? grp.name : 'General'}
                                </span>
                              </td>
                              <td>{u.salesmanName || '—'}</td>
                              <td>{u.remarks || '—'}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleOpenEditUdhaar(idx)}
                                  title="Edit Udhaar"
                                >
                                  <Icon name="edit" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--color-danger)' }}
                                  onClick={() => setDeleteConfirm({ open: true, type: 'udhaar', index: idx })}
                                  title="Delete Udhaar"
                                >
                                  <Icon name="trash" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--bg-surface)', fontWeight: 700 }}>
                          <td colSpan={4} style={{ textAlign: 'right' }}>TOTAL UDHAAR / CREDIT SALES:</td>
                          <td style={{ textAlign: 'right', color: 'var(--color-warning)', fontSize: 14 }}>
                            {INR(calculations.totalUdhaar)}
                          </td>
                          <td colSpan={4}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: OPERATING EXPENSES */}
            {creditPaymentTab === 'expenses' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Daily operating station expenses. <strong>Only Cash payment source reduces physical cash.</strong> UPI/Bank/Card do not deduct forecourt cash.
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenAddExpense()}
                  >
                    + Add Daily Expense
                  </button>
                </div>

                {expenses.length === 0 ? (
                  <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    No operating expenses recorded for this day yet. Click "+ Add Daily Expense" to add petty cash vouchers.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ margin: 0, fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Amount</th>
                          <th>Payment Source</th>
                          <th>Group Link</th>
                          <th>Remarks</th>
                          <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((exp, idx) => {
                          const grp = collectionGroups.find(g => g.id === exp.collectionGroupId);
                          const isCash = (exp.paymentSource || 'Cash') === 'Cash';
                          return (
                            <tr key={exp.id || idx}>
                              <td style={{ fontWeight: 600 }}>{exp.categoryName}</td>
                              <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                                {INR(exp.amount)}
                              </td>
                              <td>
                                <span className={`badge ${isCash ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 11 }}>
                                  {exp.paymentSource || 'Cash'} {isCash ? '(Deducts Cash)' : '(No Cash Deduct)'}
                                </span>
                              </td>
                              <td>
                                <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                                  {grp ? grp.name : 'General'}
                                </span>
                              </td>
                              <td>{exp.remarks || '—'}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setExpenseModal({ open: true, index: idx, expense: { ...exp } })}
                                  title="Edit Expense"
                                >
                                  <Icon name="edit" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--color-danger)' }}
                                  onClick={() => setDeleteConfirm({ open: true, type: 'expense', index: idx })}
                                  title="Delete Expense"
                                >
                                  <Icon name="trash" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--bg-surface)', fontWeight: 700 }}>
                          <td style={{ textAlign: 'right' }}>TOTAL OPERATING EXPENSES:</td>
                          <td style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: 14 }}>
                            {INR(calculations.totalExpenses)}
                          </td>
                          <td colSpan={4}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              (Cash: {INR(calculations.totalCashExpenses)} • Non-cash: {INR(calculations.totalExpenses - calculations.totalCashExpenses)})
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PAYMENTS RECEIVED FROM CUSTOMERS */}
            {creditPaymentTab === 'received' && (
              <ReceiptsPanel date={date} customers={customers} entryId={existingEntryId} onChange={() => setReceiptTick(t => t + 1)} />
            )}

            {/* TAB 3: ADVANCES & PAYMENTS (MONEY MOVEMENTS) */}
            {creditPaymentTab === 'movements' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Salary advances, employee advances, owner withdrawals, and supplier payouts. <strong>Not operating expenses.</strong> Cash source reduces forecourt physical cash.
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenAddMovement()}
                  >
                    + Add Advance / Payment
                  </button>
                </div>

                {moneyMovements.length === 0 ? (
                  <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    No employee advances or other non-operating money movements recorded for this day.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ margin: 0, fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Payee / Staff</th>
                          <th>Amount</th>
                          <th>Payment Source</th>
                          <th>Group Link</th>
                          <th>Remarks</th>
                          <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {moneyMovements.map((mov, idx) => {
                          const grp = collectionGroups.find(g => g.id === mov.collectionGroupId);
                          const isCash = (mov.paymentSource || 'Cash') === 'Cash';
                          return (
                            <tr key={mov.id || idx}>
                              <td>
                                <span className="badge badge-info" style={{ fontWeight: 600 }}>
                                  {mov.type}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{mov.payeeName || '—'}</td>
                              <td style={{ fontWeight: 700, color: 'var(--color-warning)' }}>
                                {INR(mov.amount)}
                              </td>
                              <td>
                                <span className={`badge ${isCash ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 11 }}>
                                  {mov.paymentSource} {isCash ? '(Deducts Cash)' : ''}
                                </span>
                              </td>
                              <td>
                                <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                                  {grp ? grp.name : 'General'}
                                </span>
                              </td>
                              <td>{mov.remarks || '—'}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setMovementModal({ open: true, index: idx, movement: { ...mov } })}
                                  title="Edit Payment / Advance"
                                >
                                  <Icon name="edit" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--color-danger)' }}
                                  onClick={() => setDeleteConfirm({ open: true, type: 'movement', index: idx })}
                                  title="Delete Movement"
                                >
                                  <Icon name="trash" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--bg-surface)', fontWeight: 700 }}>
                          <td colSpan={2} style={{ textAlign: 'right' }}>TOTAL MONEY MOVEMENTS:</td>
                          <td style={{ fontWeight: 700, color: 'var(--color-warning)', fontSize: 14 }}>
                            {INR(calculations.totalMoneyMovements)}
                          </td>
                          <td colSpan={4}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              (Cash: {INR(calculations.totalOtherCashPayments)} • Non-cash: {INR(calculations.totalMoneyMovements - calculations.totalOtherCashPayments)})
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 5: CASH DEPOSITS - ACCORDION */}
      <div className={`daily-accordion-card ${openSections.deposits ? 'is-open' : ''}`}>
        <div
          onClick={() => toggleSection('deposits')}
          className="daily-accordion-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="acc-icon"><Icon name="bank" /></span>
            <span className="acc-title">5. Cash Deposits</span>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>
              {cashDeposits.length} Drops
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Total: <strong style={{ color: 'var(--color-primary)' }}>{INR(calculations.totalCashDeposited)}</strong>
            </span>
          </div>
          <span className="daily-accordion-chevron" aria-hidden="true"><Icon name="chevron" className="icon-sm" /></span>
        </div>

        {openSections.deposits && (
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Multiple deposits supported (mid-day drops, shift handovers, bank vault deposits). Linked to Collection Groups.
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenAddDeposit()}
              >
                + Add Cash Deposit
              </button>
            </div>

            {cashDeposits.length === 0 ? (
              <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                No cash deposits recorded for this day yet. Click "+ Add Cash Deposit" to record cash movements.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ margin: 0, fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Collection Group</th>
                      <th>Amount</th>
                      <th>Deposited By</th>
                      <th>Time</th>
                      <th>Reference / Remarks</th>
                      <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashDeposits.map((dep, idx) => {
                      const grp = collectionGroups.find(g => g.id === dep.collectionGroupId);
                      return (
                        <tr key={dep.id || idx}>
                          <td>
                            <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                              {grp ? grp.name : 'General'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                            {INR(dep.amount)}
                          </td>
                          <td>{dep.salesmanName || 'Attendant'}</td>
                          <td>{dep.time || '—'}</td>
                          <td>{dep.reference || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setDepositModal({ open: true, index: idx, deposit: { ...dep } })}
                              title="Edit Deposit"
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => setDeleteConfirm({ open: true, type: 'deposit', index: idx })}
                              title="Delete Deposit"
                            >
                              <Icon name="trash" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-surface)', fontWeight: 700 }}>
                      <td style={{ textAlign: 'right' }}>TOTAL CASH DEPOSITS:</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 14 }}>
                        {INR(calculations.totalCashDeposited)}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 6: DAILY SUMMARY & PHYSICAL CASH RECONCILIATION - ACCORDION */}
      <div className={`daily-accordion-card ${openSections.summary ? 'is-open' : ''}`}>
        <div
          onClick={() => toggleSection('summary')}
          className="daily-accordion-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="acc-icon"><Icon name="trending" /></span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>6. Daily Summary &amp; Physical Cash Reconciliation</span>
            <span className={`badge ${calculations.overallReconciled ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11, fontWeight: 700 }}>
              {calculations.overallReconciled ? 'SALES RECONCILED' : 'SALES VARIANCE: ' + INR(calculations.overallDifference)}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Expected Cash: <strong style={{ color: 'var(--color-success)' }}>{INR(calculations.cashRemaining)}</strong> • Physical Count: <strong style={{ color: 'var(--text-primary)' }}>{calculations.hasCashCount ? INR(cashCountTotal) : 'Uncounted'}</strong>
            </span>
            {calculations.hasCashCount && (
              <span className={`badge ${calculations.cashCountBalanced ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 11, fontWeight: 700 }}>
                {calculations.cashCountBalanced ? 'COUNT BALANCED' : `DIFF: ${INR(calculations.cashCountDiff)}`}
              </span>
            )}
          </div>
          <span className="daily-accordion-chevron" aria-hidden="true"><Icon name="chevron" className="icon-sm" /></span>
        </div>

        {openSections.summary && (
          <div style={{ padding: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
              {/* Card 1: SALES */}
              <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10, }}>
                  <Icon name="fuel" /> Fuel sales
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Fuel Litres:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{FMT_QTY(calculations.totalLitres)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Fuel Sales:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{INR(calculations.totalSalesValue)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Udhaar Sales:</span>
                  <strong style={{ color: 'var(--color-warning)' }}>{INR(calculations.totalUdhaar)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, borderTop: '1px solid var(--border-default)', paddingTop: 6, marginTop: 6 }}>
                  <span>Total Meter Sales:</span>
                  <span style={{ color: 'var(--color-success)' }}>{INR(calculations.totalSalesValue)}</span>
                </div>
              </div>

              {/* Card 2: COLLECTIONS */}
              <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10, }}>
                  <Icon name="cash" /> COLLECTIONS (RECEIVED)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cash:</span>
                  <span>{INR(calculations.collectionsByMode.Cash)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>UPI:</span>
                  <span>{INR(calculations.collectionsByMode.UPI)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Card:</span>
                  <span>{INR(calculations.collectionsByMode.Card)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Paytm:</span>
                  <span>{INR(calculations.collectionsByMode.Paytm)}</span>
                </div>
                {calculations.collectionsByMode.Other > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Other:</span>
                    <span>{INR(calculations.collectionsByMode.Other)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, borderTop: '1px solid var(--border-default)', paddingTop: 6, marginTop: 6 }}>
                  <span>Total Collected:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{INR(calculations.totalCollections)}</span>
                </div>
              </div>

              {/* Card 3: RECONCILIATION */}
              <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)', marginBottom: 10, }}>
                  <Icon name="gauge" /> Sales reconciliation
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Meter Sales:</span>
                  <span>{INR(calculations.totalSalesValue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Collected:</span>
                  <span>{INR(calculations.totalCollections)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Udhaar:</span>
                  <span>+ {INR(calculations.totalUdhaar)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Reconciled Sales:</span>
                  <strong>{INR(calculations.reconciledSales)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, borderTop: '1px solid var(--border-default)', paddingTop: 6, marginTop: 6, color: calculations.overallReconciled ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  <span>Difference:</span>
                  <span>{INR(calculations.overallDifference)}</span>
                </div>
                <div style={{ marginTop: 6, textAlign: 'right' }}>
                  <span className={`badge ${calculations.overallReconciled ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                    Status: {calculations.overallReconciled ? 'Reconciled' : 'Difference'}
                  </span>
                </div>
              </div>

              {/* Card 4: CASH POSITION & PHYSICAL CASH COUNT (Sections 28-29) */}
              <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-success)', marginBottom: 4, }}>
                  <Icon name="cash" /> Cash reconciliation
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cash Collected:</span>
                  <span>{INR(calculations.totalCashCollected)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cash Deposited:</span>
                  <span>- {INR(calculations.totalCashDeposited)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cash Expenses:</span>
                  <span>- {INR(calculations.totalCashExpenses)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Other Cash Payments:</span>
                  <span>- {INR(calculations.totalOtherCashPayments)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, borderTop: '1px solid var(--border-default)', paddingTop: 4, color: 'var(--color-primary)' }}>
                  <span>Expected Forecourt Cash:</span>
                  <span>{INR(calculations.expectedForecourtCash)}</span>
                </div>

                {/* PHYSICAL CASH COUNT SECTION */}
                <div style={{ marginTop: 6, padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <Icon name="cash" /> Physical Cash Count:
                    </span>
                    <strong style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                      {calculations.hasCashCount ? INR(calculations.physicalCashCounted) : '₹0.00'}
                    </strong>
                  </div>

                  {calculations.hasCashCount ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cash Difference:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{
                          color: calculations.cashCountBalanced ? 'var(--color-success)' : calculations.cashCountDiff > 0 ? 'var(--color-primary)' : 'var(--color-danger)'
                        }}>
                          {INR(calculations.cashCountDiff)}
                        </strong>
                        <span className={`badge ${calculations.cashCountBalanced ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                          {calculations.cashCountBalanced ? 'BALANCED' : calculations.cashCountDiff > 0 ? 'SURPLUS' : 'SHORTAGE'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      No drawer denomination count saved for {date}.
                    </div>
                  )}

                  {cashCountEntries.length > 0 && (
                    <div className="cc-who" style={{ marginTop: 8, borderTop: '1px dashed var(--border-default)', paddingTop: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Cash submitted by:</div>
                      {[...cashCountEntries].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '2px 0' }}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong>{c.person || '—'}</strong>
                            <span style={{ color: 'var(--text-muted)' }}> · {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </span>
                          <strong>{INR(c.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', fontSize: 11, padding: '4px 8px' }}
                      onClick={() => navigate(`/operations/cash-count?date=${date}`)}
                    >
                      <Icon name="cash" /> {calculations.hasCashCount ? 'Update Denominations in Cash Count →' : 'Count Drawer Cash in Cash Count →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STICKY BOTTOM SAVE ACTION BAR */}
      <div className="daily-entry-sticky-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 13 }}>
            Date: <strong>{date}</strong>
          </div>
          <div style={{ fontSize: 13 }}>
            Meter Sales: <strong style={{ color: 'var(--color-success)' }}>{INR(calculations.totalSalesValue)}</strong>
          </div>
          <div style={{ fontSize: 13 }}>
            Difference: <strong style={{ color: calculations.overallReconciled ? 'var(--color-success)' : 'var(--color-warning)' }}>{INR(calculations.overallDifference)}</strong>
          </div>
          {calculations.hasCashCount && (
            <div style={{ fontSize: 13 }}>
              Cash Count: <strong style={{ color: calculations.cashCountBalanced ? 'var(--color-success)' : 'var(--color-primary)' }}>{INR(calculations.physicalCashCounted)}</strong>
              <span style={{ fontSize: 11, marginLeft: 4, color: calculations.cashCountBalanced ? 'var(--color-success)' : 'var(--color-danger)' }}>
                ({calculations.cashCountBalanced ? 'Matched' : 'Diff ' + INR(calculations.cashCountDiff)})
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleSave('draft')}
          >
            <Icon name="file" /> Save as Draft
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleSave('completed')}
          >
            ✓ Save &amp; Complete
          </button>
        </div>
      </div>

      {/* MODAL: ADD / EDIT COLLECTION GROUP */}
      <Modal
        open={groupModal.open}
        onClose={() => setGroupModal({ open: false, index: -1, group: null })}
        title={groupModal.index === -1 ? 'Add Collection Group' : 'Edit Collection Group'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setGroupModal({ open: false, index: -1, group: null })}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSaveGroup(groupModal.group)}
            >
              Save Group
            </button>
          </>
        }
      >
        {groupModal.group && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormGroup label="Group Name" required>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Group A, Machine 1+2"
                value={groupModal.group.name}
                onChange={e => setGroupModal(prev => ({ ...prev, group: { ...prev.group, name: e.target.value } }))}
              />
            </FormGroup>

            {/* Machines Multi-select Checkboxes */}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                Assigned Machines (Select all machines in this group)
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {machines.map(m => {
                  const isChecked = (groupModal.group.machineIds || []).includes(m.id);
                  return (
                    <label
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: isChecked ? 'var(--brand-primary-bg, rgba(59,130,246,0.1))' : 'var(--bg-surface)',
                        border: `1px solid ${isChecked ? 'var(--color-primary)' : 'var(--border-default)'}`,
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: isChecked ? 700 : 500,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          const checked = e.target.checked;
                          setGroupModal(prev => {
                            const cur = prev.group.machineIds || [];
                            const next = checked ? [...cur, m.id] : cur.filter(id => id !== m.id);
                            return { ...prev, group: { ...prev.group, machineIds: next } };
                          });
                        }}
                      />
                      <span><Icon name="fuel" /> {m.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Operators / Salesmen Multi-select Checkboxes */}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                Assigned Attendants / Salesmen
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {salesmen.map(s => {
                  const isChecked = (groupModal.group.salesmanIds || []).includes(s.id);
                  return (
                    <label
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: isChecked ? 'var(--info-bg)' : 'var(--bg-surface)',
                        border: `1px solid ${isChecked ? 'var(--color-primary)' : 'var(--border-default)'}`,
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          const checked = e.target.checked;
                          setGroupModal(prev => {
                            const cur = prev.group.salesmanIds || [];
                            const next = checked ? [...cur, s.id] : cur.filter(id => id !== s.id);
                            return { ...prev, group: { ...prev.group, salesmanIds: next } };
                          });
                        }}
                      />
                      <span><Icon name="users" /> {s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: ADD / EDIT CASH DEPOSIT */}
      <Modal
        open={depositModal.open}
        onClose={() => setDepositModal({ open: false, index: -1, deposit: null })}
        title={depositModal.index === -1 ? 'Add Cash Deposit' : 'Edit Cash Deposit'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDepositModal({ open: false, index: -1, deposit: null })}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSaveDeposit(depositModal.deposit)}
            >
              Save Deposit
            </button>
          </>
        }
      >
        {depositModal.deposit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormGroup label="Collection Group" required>
              <select
                className="input-field"
                value={depositModal.deposit.collectionGroupId}
                onChange={e => setDepositModal(prev => ({ ...prev, deposit: { ...prev.deposit, collectionGroupId: e.target.value } }))}
              >
                {collectionGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.machineIds.map(id => machines.find(m => m.id === id)?.name).filter(Boolean).join(', ')})</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Amount (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="50000"
                className="input-field"
                value={depositModal.deposit.amount}
                onChange={e => setDepositModal(prev => ({ ...prev, deposit: { ...prev.deposit, amount: e.target.value } }))}
              />
            </FormGroup>

            <FormGroup label="Salesman / Attendant">
              <select
                className="input-field"
                value={depositModal.deposit.salesmanId}
                onChange={e => setDepositModal(prev => ({ ...prev, deposit: { ...prev.deposit, salesmanId: e.target.value } }))}
              >
                {salesmen.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FormGroup>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <FormGroup label="Time (optional)">
                <input
                  type="time"
                  className="input-field"
                  value={depositModal.deposit.time || ''}
                  onChange={e => setDepositModal(prev => ({ ...prev, deposit: { ...prev.deposit, time: e.target.value } }))}
                />
              </FormGroup>
              <FormGroup label="Reference / Bank Slip">
                <input
                  type="text"
                  placeholder="e.g. Bank Cash Drop #101"
                  className="input-field"
                  value={depositModal.deposit.reference || ''}
                  onChange={e => setDepositModal(prev => ({ ...prev, deposit: { ...prev.deposit, reference: e.target.value } }))}
                />
              </FormGroup>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: ADD / EDIT DAILY EXPENSE */}
      <Modal
        open={expenseModal.open}
        onClose={() => setExpenseModal({ open: false, index: -1, expense: null })}
        title={expenseModal.index === -1 ? 'Add Daily Expense' : 'Edit Daily Expense'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setExpenseModal({ open: false, index: -1, expense: null })}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSaveExpense(expenseModal.expense)}
            >
              Save Expense
            </button>
          </>
        }
      >
        {expenseModal.expense && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormGroup label="Expense Category" required>
              <select
                className="input-field"
                value={expenseModal.expense.categoryId}
                onChange={e => setExpenseModal(prev => ({ ...prev, expense: { ...prev.expense, categoryId: e.target.value } }))}
              >
                {expenseCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Amount (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="500"
                className="input-field"
                value={expenseModal.expense.amount}
                onChange={e => setExpenseModal(prev => ({ ...prev, expense: { ...prev.expense, amount: e.target.value } }))}
              />
            </FormGroup>

            <FormGroup label="Payment Source" required>
              <select
                className="input-field"
                value={expenseModal.expense.paymentSource || 'Cash'}
                onChange={e => setExpenseModal(prev => ({ ...prev, expense: { ...prev.expense, paymentSource: e.target.value } }))}
              >
                {PAYMENT_SOURCES.map(s => (
                  <option key={s} value={s}>{s} {s === 'Cash' ? '(Reduces physical cash)' : '(Non-cash)'}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Collection Group (optional)">
              <select
                className="input-field"
                value={expenseModal.expense.collectionGroupId || ''}
                onChange={e => setExpenseModal(prev => ({ ...prev, expense: { ...prev.expense, collectionGroupId: e.target.value } }))}
              >
                <option value="">General (Not linked to specific group)</option>
                {collectionGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Remarks / Voucher Details">
              <input
                type="text"
                placeholder="e.g. Tea & snacks for morning shift"
                className="input-field"
                value={expenseModal.expense.remarks || ''}
                onChange={e => setExpenseModal(prev => ({ ...prev, expense: { ...prev.expense, remarks: e.target.value } }))}
              />
            </FormGroup>
          </div>
        )}
      </Modal>

      {/* MODAL: ADD / EDIT MONEY MOVEMENT / ADVANCE */}
      <Modal
        open={movementModal.open}
        onClose={() => setMovementModal({ open: false, index: -1, movement: null })}
        title={movementModal.index === -1 ? 'Add Other Payment / Advance' : 'Edit Other Payment / Advance'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setMovementModal({ open: false, index: -1, movement: null })}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSaveMovement(movementModal.movement)}
            >
              Save Payment
            </button>
          </>
        }
      >
        {movementModal.movement && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormGroup label="Payment Type" required>
              <select
                className="input-field"
                value={movementModal.movement.type}
                onChange={e => setMovementModal(prev => ({ ...prev, movement: { ...prev.movement, type: e.target.value } }))}
              >
                {MOVEMENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FormGroup>

            {/* Payee Selection: if Salary/Employee advance, pick from Salesmen or enter text */}
            {movementModal.movement.type.includes('Advance') ? (
              <FormGroup label="Employee / Salesman" required>
                <select
                  className="input-field"
                  value={movementModal.movement.payeeId || ''}
                  onChange={e => {
                    const staff = salesmen.find(s => s.id === e.target.value);
                    setMovementModal(prev => ({
                      ...prev,
                      movement: {
                        ...prev.movement,
                        payeeId: e.target.value,
                        payeeName: staff ? staff.name : prev.movement.payeeName,
                      },
                    }));
                  }}
                >
                  <option value="">-- Select Attendant / Staff --</option>
                  {salesmen.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.mobile})</option>
                  ))}
                </select>
              </FormGroup>
            ) : (
              <FormGroup label="Payee Name" required>
                <input
                  type="text"
                  placeholder="e.g. Supplier Name / Owner / Contractor"
                  className="input-field"
                  value={movementModal.movement.payeeName}
                  onChange={e => setMovementModal(prev => ({ ...prev, movement: { ...prev.movement, payeeName: e.target.value } }))}
                />
              </FormGroup>
            )}

            <FormGroup label="Amount (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="2000"
                className="input-field"
                value={movementModal.movement.amount}
                onChange={e => setMovementModal(prev => ({ ...prev, movement: { ...prev.movement, amount: e.target.value } }))}
              />
            </FormGroup>

            <FormGroup label="Payment Source" required>
              <select
                className="input-field"
                value={movementModal.movement.paymentSource}
                onChange={e => setMovementModal(prev => ({ ...prev, movement: { ...prev.movement, paymentSource: e.target.value } }))}
              >
                {PAYMENT_SOURCES.map(s => (
                  <option key={s} value={s}>{s} {s === 'Cash' ? '(Reduces physical cash)' : '(Non-cash)'}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Collection Group (optional)">
              <select
                className="input-field"
                value={movementModal.movement.collectionGroupId || ''}
                onChange={e => setMovementModal(prev => ({ ...prev, movement: { ...prev.movement, collectionGroupId: e.target.value } }))}
              >
                <option value="">General</option>
                {collectionGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Remarks / Reason">
              <input
                type="text"
                placeholder="e.g. Festival advance / Fuel supplier settlement"
                className="input-field"
                value={movementModal.movement.remarks || ''}
                onChange={e => setMovementModal(prev => ({ ...prev, movement: { ...prev.movement, remarks: e.target.value } }))}
              />
            </FormGroup>
          </div>
        )}
      </Modal>

      {/* MODAL: ADD / EDIT UDHAAR / CREDIT SALE */}
      <Modal
        open={udhaarModal.open}
        onClose={() => setUdhaarModal({ open: false, index: -1, udhaar: null })}
        title={udhaarModal.index === -1 ? 'Add Udhaar / Credit Sale' : 'Edit Udhaar / Credit Sale'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setUdhaarModal({ open: false, index: -1, udhaar: null })}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSaveUdhaar(udhaarModal.udhaar)}
            >
              Save Udhaar Sale
            </button>
          </>
        }
      >
        {udhaarModal.udhaar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormGroup label="Customer Account" required>
              <select
                className="input-field"
                value={udhaarModal.udhaar.customerId}
                onChange={e => {
                  const custId = e.target.value;
                  const c = customers.find(item => item.id === custId);
                  setUdhaarModal(prev => ({
                    ...prev,
                    udhaar: {
                      ...prev.udhaar,
                      customerId: custId,
                      customerName: c ? c.name : '',
                    },
                  }));
                }}
              >
                <option value="">-- Select Registered Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.mobile ? `(${c.mobile})` : ''} — Limit: ₹{Number(c.creditLimit || 0).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </FormGroup>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
              <FormGroup label="Fuel Product" required>
                <select
                  className="input-field"
                  value={udhaarModal.udhaar.productId}
                  onChange={e => {
                    const prodId = e.target.value;
                    const prod = products.find(p => p.id === prodId);
                    const pr = getApplicablePrice(prodId, date);
                    const rateVal = pr?.sellingPrice || 0;
                    const qtyVal = Number(udhaarModal.udhaar.quantity) || 0;
                    const amtVal = (qtyVal * rateVal) > 0 ? (qtyVal * rateVal).toFixed(2) : udhaarModal.udhaar.amount;

                    setUdhaarModal(prev => ({
                      ...prev,
                      udhaar: {
                        ...prev.udhaar,
                        productId: prodId,
                        productName: prod ? prod.name : '',
                        rate: rateVal ? String(rateVal) : prev.udhaar.rate,
                        amount: amtVal,
                      },
                    }));
                  }}
                >
                  <option value="">-- Select Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </FormGroup>

              <FormGroup label="Collection Group">
                <select
                  className="input-field"
                  value={udhaarModal.udhaar.collectionGroupId || ''}
                  onChange={e => setUdhaarModal(prev => ({ ...prev, udhaar: { ...prev.udhaar, collectionGroupId: e.target.value } }))}
                >
                  <option value="">General</option>
                  {collectionGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </FormGroup>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
              <FormGroup label="Quantity (Litres)">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 50"
                  className="input-field"
                  value={udhaarModal.udhaar.quantity}
                  onChange={e => {
                    const val = e.target.value;
                    const rateVal = Number(udhaarModal.udhaar.rate) || 0;
                    const amtVal = (Number(val) * rateVal) > 0 ? (Number(val) * rateVal).toFixed(2) : udhaarModal.udhaar.amount;
                    setUdhaarModal(prev => ({
                      ...prev,
                      udhaar: {
                        ...prev.udhaar,
                        quantity: val,
                        amount: amtVal,
                      },
                    }));
                  }}
                />
              </FormGroup>

              <FormGroup label="Rate (₹/L)">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 96.72"
                  className="input-field"
                  value={udhaarModal.udhaar.rate}
                  onChange={e => {
                    const val = e.target.value;
                    const qtyVal = Number(udhaarModal.udhaar.quantity) || 0;
                    const amtVal = (qtyVal * Number(val)) > 0 ? (qtyVal * Number(val)).toFixed(2) : udhaarModal.udhaar.amount;
                    setUdhaarModal(prev => ({
                      ...prev,
                      udhaar: {
                        ...prev.udhaar,
                        rate: val,
                        amount: amtVal,
                      },
                    }));
                  }}
                />
              </FormGroup>

              <FormGroup label="Total Amount (₹)" required>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 4836.00"
                  className="input-field"
                  style={{ fontWeight: 700, color: 'var(--color-warning)' }}
                  value={udhaarModal.udhaar.amount}
                  onChange={e => setUdhaarModal(prev => ({
                    ...prev,
                    udhaar: { ...prev.udhaar, amount: e.target.value },
                  }))}
                />
              </FormGroup>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormGroup label="Dispensing Machine (optional)">
                <select
                  className="input-field"
                  value={udhaarModal.udhaar.machineId || ''}
                  onChange={e => setUdhaarModal(prev => ({ ...prev, udhaar: { ...prev.udhaar, machineId: e.target.value } }))}
                >
                  <option value="">-- Machine --</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </FormGroup>

              <FormGroup label="Salesman / Attendant (optional)">
                <select
                  className="input-field"
                  value={udhaarModal.udhaar.salesmanId || ''}
                  onChange={e => setUdhaarModal(prev => ({ ...prev, udhaar: { ...prev.udhaar, salesmanId: e.target.value } }))}
                >
                  <option value="">-- Salesman --</option>
                  {salesmen.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </FormGroup>
            </div>

            <FormGroup label="Remarks / Vehicle No. / Slip No.">
              <input
                type="text"
                placeholder="e.g. DL-01-AB-1234 / Driver Raj / Slip #482"
                className="input-field"
                value={udhaarModal.udhaar.remarks || ''}
                onChange={e => setUdhaarModal(prev => ({ ...prev, udhaar: { ...prev.udhaar, remarks: e.target.value } }))}
              />
            </FormGroup>
          </div>
        )}
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, type: '', index: -1 })}
        title="Confirm Delete"
        message="Are you sure you want to remove this record? This action cannot be undone."
        onConfirm={() => {
          if (deleteConfirm.type === 'deposit') {
            setCashDeposits(prev => prev.filter((_, i) => i !== deleteConfirm.index));
            toast.success('Deposit removed.');
          } else if (deleteConfirm.type === 'expense') {
            setExpenses(prev => prev.filter((_, i) => i !== deleteConfirm.index));
            toast.success('Expense removed.');
          } else if (deleteConfirm.type === 'movement') {
            setMoneyMovements(prev => prev.filter((_, i) => i !== deleteConfirm.index));
            toast.success('Payment removed.');
          } else if (deleteConfirm.type === 'udhaar') {
            setUdhaarSales(prev => prev.filter((_, i) => i !== deleteConfirm.index));
            toast.success('Udhaar credit sale removed.');
          }
          setDeleteConfirm({ open: false, type: '', index: -1 });
        }}
      />

      {/* RESET CONFIRMATION */}
      <ConfirmDialog
        open={resetConfirm}
        onClose={() => setResetConfirm(false)}
        title="Reset Changes?"
        message="This will discard any unsaved changes on this screen and reload the stored values for this date."
        onConfirm={() => {
          loadDayData(date);
          setResetConfirm(false);
          toast.info('Form reset to saved state.');
        }}
      />
    </div>
  );
}
