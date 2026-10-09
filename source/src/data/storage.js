/**
 * FuelEx - Central Storage Layer
 *
 * This module is the ONLY place that interacts with localStorage.
 * All UI components must go through service/repository functions.
 *
 * Architecture: UI → Service Layer → Storage Layer → localStorage
 *
 * To replace localStorage with Supabase/Firebase/API:
 * - Replace only the functions in this file.
 * - All service/UI code remains unchanged.
 *
 * VERSIONING:
 * - 1.0.0 : Initial Stage 1 release
 * - 1.1.0 : Added lubricants master; removed 'Lube' product; added data migration
 */

const STORAGE_KEY = 'FuelExData';
const DATA_VERSION = '3.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT / SEED DATA
// ─────────────────────────────────────────────────────────────────────────────

// Sample people / suppliers / lubricants are only for automated tests. A real install starts clean.
const SAMPLE = () => globalThis.__FUELEX_SAMPLE__ === true;

function getDefaultData() {
  const now = new Date().toISOString();

  const products = [
    { id: 'prod-1', name: 'Petrol',       unit: 'Litre', status: 'active', remarks: '', createdAt: now, updatedAt: now },
    { id: 'prod-2', name: 'Diesel',       unit: 'Litre', status: 'active', remarks: '', createdAt: now, updatedAt: now },
    { id: 'prod-3', name: 'Speed Petrol', unit: 'Litre', status: 'active', remarks: '', createdAt: now, updatedAt: now },
  ];

  const machines = [
    { id: 'mach-1', name: 'Machine 1', status: 'active', createdAt: now, updatedAt: now },
    { id: 'mach-2', name: 'Machine 2', status: 'active', createdAt: now, updatedAt: now },
    { id: 'mach-3', name: 'Machine 3', status: 'active', createdAt: now, updatedAt: now },
  ];

  const nozzles = [
    // Machine 1
    { id: 'noz-1',  machineId: 'mach-1', name: 'Speed Petrol 1', productId: 'prod-3', status: 'active', createdAt: now, updatedAt: now },
    { id: 'noz-2',  machineId: 'mach-1', name: 'Speed Petrol 2', productId: 'prod-3', status: 'active', createdAt: now, updatedAt: now },
    { id: 'noz-3',  machineId: 'mach-1', name: 'Diesel 1',        productId: 'prod-2', status: 'active', createdAt: now, updatedAt: now },
    { id: 'noz-4',  machineId: 'mach-1', name: 'Diesel 2',        productId: 'prod-2', status: 'active', createdAt: now, updatedAt: now },
    // Machine 2
    { id: 'noz-5',  machineId: 'mach-2', name: 'Petrol 1',        productId: 'prod-1', status: 'active', createdAt: now, updatedAt: now },
    { id: 'noz-6',  machineId: 'mach-2', name: 'Petrol 2',        productId: 'prod-1', status: 'active', createdAt: now, updatedAt: now },
    { id: 'noz-7',  machineId: 'mach-2', name: 'Diesel 1',        productId: 'prod-2', status: 'active', createdAt: now, updatedAt: now },
    { id: 'noz-8',  machineId: 'mach-2', name: 'Diesel 2',        productId: 'prod-2', status: 'active', createdAt: now, updatedAt: now },
    // Machine 3
    { id: 'noz-9',  machineId: 'mach-3', name: 'Petrol 1',        productId: 'prod-1', status: 'active', createdAt: now, updatedAt: now },
    { id: 'noz-10', machineId: 'mach-3', name: 'Petrol 2',        productId: 'prod-1', status: 'active', createdAt: now, updatedAt: now },
    { id: 'noz-11', machineId: 'mach-3', name: 'Diesel 1',        productId: 'prod-2', status: 'active', createdAt: now, updatedAt: now },
    { id: 'noz-12', machineId: 'mach-3', name: 'Diesel 2',        productId: 'prod-2', status: 'active', createdAt: now, updatedAt: now },
  ];

  const defaultPrices = [
    {
      id: 'price-seed-1',
      productId: 'prod-1', // Petrol
      effectiveDate: '2026-01-01',
      sellingPrice: 101.50,
      purchaseCost: 98.20,
      remarks: 'Default base price',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'price-seed-2',
      productId: 'prod-2', // Diesel
      effectiveDate: '2026-01-01',
      sellingPrice: 89.80,
      purchaseCost: 86.90,
      remarks: 'Default base price',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'price-seed-3',
      productId: 'prod-3', // Speed Petrol
      effectiveDate: '2026-01-01',
      sellingPrice: 105.20,
      purchaseCost: 101.00,
      remarks: 'Default base price',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const expenseCategories = [
    { id: 'exp-1', name: 'Salary',         status: 'active', createdAt: now, updatedAt: now },
    { id: 'exp-2', name: 'Electricity',    status: 'active', createdAt: now, updatedAt: now },
    { id: 'exp-3', name: 'Maintenance',    status: 'active', createdAt: now, updatedAt: now },
    { id: 'exp-4', name: 'Cleaning',       status: 'active', createdAt: now, updatedAt: now },
    { id: 'exp-5', name: 'Tea/Water',      status: 'active', createdAt: now, updatedAt: now },
    { id: 'exp-6', name: 'Vehicle Petrol', status: 'active', createdAt: now, updatedAt: now },
    { id: 'exp-7', name: 'Vehicle Diesel', status: 'active', createdAt: now, updatedAt: now },
    { id: 'exp-8', name: 'Miscellaneous',  status: 'active', createdAt: now, updatedAt: now },
  ];

  const defaultLubricants_SAMPLE = [
    {
      id: 'lube-1',
      name: 'Castrol GTX 15W-40',
      brand: 'Castrol',
      category: 'Engine Oil',
      packSize: '1',
      unit: 'Litre',
      purchasePrice: 380,
      sellingPrice: 460,
      status: 'active',
      remarks: 'Recommended for 4-stroke petrol & diesel cars',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lube-2',
      name: 'Servo Pride 20W-40',
      brand: 'Servo (IOCL)',
      category: 'Engine Oil',
      packSize: '5',
      unit: 'Litre',
      purchasePrice: 1550,
      sellingPrice: 1850,
      status: 'active',
      remarks: 'Heavy duty commercial vehicle engine oil',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lube-3',
      name: 'Shell Coolant Premix',
      brand: 'Shell',
      category: 'Coolant',
      packSize: '1',
      unit: 'Litre',
      purchasePrice: 220,
      sellingPrice: 290,
      status: 'active',
      remarks: 'Ready-to-use radiator coolant',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lube-4',
      name: 'Mak Multi-Purpose Grease AP3',
      brand: 'MAK (BPCL)',
      category: 'Grease',
      packSize: '1',
      unit: 'Kg',
      purchasePrice: 310,
      sellingPrice: 390,
      status: 'active',
      remarks: 'Wheel bearing and chassis grease',
      createdAt: now,
      updatedAt: now,
    },
  ];
  const defaultLubricants = SAMPLE() ? defaultLubricants_SAMPLE : [];

  const defaultEmployees_SAMPLE = [
    { id: 'emp-1', salesmanId: 'sal-1', name: 'Rajesh Kumar', mobile: '9876501234', designation: 'Forecourt Shift Lead', monthlySalary: 22000, joiningDate: '2025-01-10', status: 'active', remarks: 'Morning shift lead', createdAt: now, updatedAt: now },
    { id: 'emp-2', salesmanId: 'sal-2', name: 'Amit Sharma',  mobile: '9876505678', designation: 'Forecourt Attendant', monthlySalary: 20000, joiningDate: '2025-03-15', status: 'active', remarks: 'Evening shift attendant', createdAt: now, updatedAt: now },
    { id: 'emp-3', salesmanId: 'sal-3', name: 'Sunil Verma',  mobile: '9876509988', designation: 'Forecourt Attendant', monthlySalary: 18000, joiningDate: '2025-05-01', status: 'active', remarks: 'Night shift attendant', createdAt: now, updatedAt: now },
  ];
  const defaultEmployees = SAMPLE() ? defaultEmployees_SAMPLE : [];

  const defaultSalesmen_SAMPLE = [
    { id: 'sal-1', employeeId: 'emp-1', name: 'Rajesh Kumar', mobile: '9876501234', joiningDate: '2025-01-10', status: 'active', remarks: 'Morning attendant', createdAt: now, updatedAt: now },
    { id: 'sal-2', employeeId: 'emp-2', name: 'Amit Sharma',  mobile: '9876505678', joiningDate: '2025-03-15', status: 'active', remarks: 'Evening attendant', createdAt: now, updatedAt: now },
    { id: 'sal-3', employeeId: 'emp-3', name: 'Sunil Verma',  mobile: '9876509988', joiningDate: '2025-05-01', status: 'active', remarks: 'Attendant', createdAt: now, updatedAt: now },
  ];
  const defaultSalesmen = SAMPLE() ? defaultSalesmen_SAMPLE : [];

  const defaultCustomers_SAMPLE = [
    { id: 'cust-1', name: 'ABC Transport Ltd', mobile: '9822012345', address: 'Plot 42, Highway Hub', creditLimit: 250000, openingBalance: 0, status: 'active', remarks: 'Fleet of 8 trucks', createdAt: now, updatedAt: now },
  ];
  const defaultCustomers = SAMPLE() ? defaultCustomers_SAMPLE : [];

  const defaultSuppliers_SAMPLE = [
    { id: 'supp-1', name: 'Bharat Petroleum Corporation Ltd (BPCL)', mobile: '1800-22-4344', status: 'active', remarks: 'Primary Oil Marketing Company / Fuel Depot', isDefault: true, createdAt: now, updatedAt: now },
    { id: 'supp-2', name: 'Castrol India Regional Depot', mobile: '0141-2789000', status: 'active', remarks: 'Lubricants & Engine Oils Supplier', isDefault: false, createdAt: now, updatedAt: now },
  ];
  const defaultSuppliers = SAMPLE() ? defaultSuppliers_SAMPLE : [];

  return {
    version: DATA_VERSION,
    createdAt: now,
    settings: {
      theme: 'dark',
      appName: 'FuelEx',
      storageType: 'local',
    },
    masters: {
      products,
      machines,
      nozzles,
      lubricants: defaultLubricants,
      salesmen: defaultSalesmen,
      employees: defaultEmployees,
      customers: defaultCustomers,
      suppliers: defaultSuppliers,
      priceHistory: defaultPrices,
      expenseCategories,
    },
    operations: {
      dailyEntries: [],
      collectionGroups: [],
      meterReadings: [],
      collections: [],
      cashDeposits: [],
      expenses: [],
      moneyMovements: [],
      udhaarSales: [],
      customerPayments: [],
      fuelReceipts: [],
      fuelDips: [],
      tankCapacities: { 'prod-1': 20000, 'prod-2': 30000, 'prod-3': 15000 },
      fuelInitialStock: SAMPLE() ? { 'prod-1': 12500, 'prod-2': 18000, 'prod-3': 7500 } : { 'prod-1': 0, 'prod-2': 0, 'prod-3': 0 },
      openingStockOverrides: [],
      cashCounts: [],
      salaryPayments: [],
      advanceRecoveries: [],
      lubricantPurchases: [],
      lubricantSales: [],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Migrate data from an older version to the current version.
 * Each migration step is idempotent — safe to run multiple times.
 * @param {object} data — existing loaded data
 * @returns {object} — migrated data (mutated in place)
 */
function migrateData(data) {
  const v = data.version ?? '1.0.0';
  const now = new Date().toISOString();

  // Migration: 1.0.0 → 1.1.0
  // - Add lubricants array if missing
  // - Remove any product named 'Lube'
  if (SAMPLE() && (!data.masters.lubricants || data.masters.lubricants.length === 0)) {
    data.masters.lubricants = [
      {
        id: 'lube-1',
        name: 'Castrol GTX 15W-40',
        brand: 'Castrol',
        category: 'Engine Oil',
        packSize: '1',
        unit: 'Litre',
        purchasePrice: 380,
        sellingPrice: 460,
        status: 'active',
        remarks: 'Recommended for 4-stroke petrol & diesel cars',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'lube-2',
        name: 'Servo Pride 20W-40',
        brand: 'Servo (IOCL)',
        category: 'Engine Oil',
        packSize: '5',
        unit: 'Litre',
        purchasePrice: 1550,
        sellingPrice: 1850,
        status: 'active',
        remarks: 'Heavy duty commercial vehicle engine oil',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'lube-3',
        name: 'Shell Coolant Premix',
        brand: 'Shell',
        category: 'Coolant',
        packSize: '1',
        unit: 'Litre',
        purchasePrice: 220,
        sellingPrice: 290,
        status: 'active',
        remarks: 'Ready-to-use radiator coolant',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'lube-4',
        name: 'Mak Multi-Purpose Grease AP3',
        brand: 'MAK (BPCL)',
        category: 'Grease',
        packSize: '1',
        unit: 'Kg',
        purchasePrice: 310,
        sellingPrice: 390,
        status: 'active',
        remarks: 'Wheel bearing and chassis grease',
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // Remove 'Lube' from fuel products if it exists and has no transaction references
  data.masters.products = data.masters.products.filter(p => p.name.trim().toLowerCase() !== 'lube');
  const validProductIds = new Set(data.masters.products.map(p => p.id));
  data.masters.nozzles = data.masters.nozzles.filter(n => validProductIds.has(n.productId));

  // Migration: 1.1.0 → 2.0.0 / 2.1.0 / 2.3.0
  // - Add operations collections
  if (!data.operations) {
    data.operations = {
      dailyEntries: [],
      collectionGroups: [],
      meterReadings: [],
      collections: [],
      cashDeposits: [],
      expenses: [],
      moneyMovements: [],
      udhaarSales: [],
      customerPayments: [],
      fuelReceipts: [],
      fuelDips: [],
      fuelInitialStock: SAMPLE() ? { 'prod-1': 15000, 'prod-2': 25000, 'prod-3': 8000 } : { 'prod-1': 0, 'prod-2': 0, 'prod-3': 0 },
      lubricantPurchases: [],
      lubricantSales: [],
    };
    console.info('FuelEx: Migrated — added operations structure (v2.3.0)');
  } else {
    if (!data.operations.dailyEntries) data.operations.dailyEntries = [];
    if (!data.operations.collectionGroups) data.operations.collectionGroups = [];
    if (!data.operations.meterReadings) data.operations.meterReadings = [];
    if (!data.operations.collections) data.operations.collections = [];
    if (!data.operations.cashDeposits) data.operations.cashDeposits = [];
    if (!data.operations.expenses) data.operations.expenses = [];
    if (!data.operations.moneyMovements) data.operations.moneyMovements = [];
    if (!data.operations.udhaarSales) data.operations.udhaarSales = [];
    if (!data.operations.customerPayments) data.operations.customerPayments = [];
    if (!data.operations.fuelReceipts) data.operations.fuelReceipts = [];
    if (!data.operations.fuelDips) data.operations.fuelDips = [];
    if (!data.operations.fuelInitialStock) data.operations.fuelInitialStock = { 'prod-1': 15000, 'prod-2': 25000, 'prod-3': 8000 };
    if (!data.operations.lubricantPurchases) data.operations.lubricantPurchases = [];
    if (!data.operations.lubricantSales) data.operations.lubricantSales = [];
  }

  // Safe migration for legacy collections with paymentMode === 'Udhaar'
  // Udhaar must NOT be treated as a collection payment mode.
  if (Array.isArray(data.operations.collections)) {
    const legacyUdhaar = data.operations.collections.filter(c => c.paymentMode === 'Udhaar');
    if (legacyUdhaar.length > 0) {
      legacyUdhaar.forEach(c => {
        const alreadyExists = data.operations.udhaarSales.some(u => u.id === c.id || (u.dailyEntryId === c.dailyEntryId && u.customerId === c.customerId && Math.abs(u.amount - c.amount) < 0.01));
        if (!alreadyExists) {
          data.operations.udhaarSales.push({
            id: c.id || generateId('udh'),
            date: c.date || '',
            dailyEntryId: c.dailyEntryId || '',
            customerId: c.customerId || (data.masters.customers?.[0]?.id || 'cust-1'),
            customerName: c.customerName || (data.masters.customers?.[0]?.name || 'Credit Customer'),
            productId: 'prod-2',
            productName: 'Diesel',
            quantity: 0,
            rate: 0,
            amount: Number(c.amount) || 0,
            collectionGroupId: c.collectionGroupId || null,
            remarks: c.remarks || 'Migrated from collections',
            createdAt: c.createdAt || now,
            updatedAt: now,
          });
        }
      });
      // Collections represent actual money received (Cash, UPI, Card, Paytm, Other)
      data.operations.collections = data.operations.collections.filter(c => c.paymentMode !== 'Udhaar');
    }
  }

  // Ensure default price history exists if empty
  if (!data.masters.priceHistory || data.masters.priceHistory.length === 0) {
    data.masters.priceHistory = [
      { id: 'price-seed-1', productId: 'prod-1', effectiveDate: '2026-01-01', sellingPrice: 101.50, purchaseCost: 98.20, remarks: 'Base price', createdAt: now, updatedAt: now },
      { id: 'price-seed-2', productId: 'prod-2', effectiveDate: '2026-01-01', sellingPrice: 89.80,  purchaseCost: 86.90, remarks: 'Base price', createdAt: now, updatedAt: now },
      { id: 'price-seed-3', productId: 'prod-3', effectiveDate: '2026-01-01', sellingPrice: 105.20, purchaseCost: 101.00, remarks: 'Base price', createdAt: now, updatedAt: now },
    ];
  }

  // Ensure default staff exists if empty
  if (!Array.isArray(data.masters.salesmen)) data.masters.salesmen = [];
  if (!SAMPLE()) {
    // real install: no sample staff
  } else if (data.masters.salesmen.length === 0) {
    data.masters.salesmen = [
      { id: 'sal-1', name: 'Rajesh Kumar', mobile: '9876501234', joiningDate: '2025-01-10', status: 'active', remarks: 'Morning attendant', createdAt: now, updatedAt: now },
      { id: 'sal-2', name: 'Amit Sharma',  mobile: '9876505678', joiningDate: '2025-03-15', status: 'active', remarks: 'Evening attendant', createdAt: now, updatedAt: now },
      { id: 'sal-3', name: 'Sunil Verma',  mobile: '9876509988', joiningDate: '2025-05-01', status: 'active', remarks: 'Attendant', createdAt: now, updatedAt: now },
    ];
  } else if (!data.masters.salesmen.some(s => s.id === 'sal-3')) {
    data.masters.salesmen.push({
      id: 'sal-3', name: 'Sunil Verma', mobile: '9876509988', joiningDate: '2025-05-01', status: 'active', remarks: 'Attendant', createdAt: now, updatedAt: now,
    });
  }

  // Ensure default customer exists if empty
  if (!Array.isArray(data.masters.customers)) data.masters.customers = [];
  if (SAMPLE() && data.masters.customers.length === 0) {
    data.masters.customers = [
      { id: 'cust-1', name: 'ABC Transport Ltd', mobile: '9822012345', address: 'Plot 42, Highway Hub', creditLimit: 250000, openingBalance: 0, status: 'active', remarks: 'Fleet of 8 trucks', createdAt: now, updatedAt: now },
    ];
  }

  // Handle migration for legacy collections and cash deposits without collectionGroupId
  if (data.operations && Array.isArray(data.operations.dailyEntries)) {
    data.operations.dailyEntries.forEach(entry => {
      let entryGroups = (data.operations.collectionGroups || []).filter(g => g.dailyEntryId === entry.id);
      if (entryGroups.length === 0) {
        const grpAId = `grp-${entry.id}-A`;
        const grpBId = `grp-${entry.id}-B`;
        const defaultA = {
          id: grpAId,
          dailyEntryId: entry.id,
          name: 'Group A',
          machineIds: ['mach-1', 'mach-2'],
          salesmanIds: ['sal-1', 'sal-2'],
          paymentMethods: ['Cash', 'UPI', 'Card'],
          isDemo: Boolean(entry.isDemo),
        };
        const defaultB = {
          id: grpBId,
          dailyEntryId: entry.id,
          name: 'Group B',
          machineIds: ['mach-3'],
          salesmanIds: ['sal-3'],
          paymentMethods: ['Cash', 'Paytm'],
          isDemo: Boolean(entry.isDemo),
        };
        data.operations.collectionGroups.push(defaultA, defaultB);
        entryGroups = [defaultA, defaultB];
      }

      const fallbackGroupId = entryGroups[0]?.id || `grp-${entry.id}-A`;
      (data.operations.collections || [])
        .filter(c => c.dailyEntryId === entry.id && !c.collectionGroupId)
        .forEach(c => {
          c.collectionGroupId = fallbackGroupId;
        });

      (data.operations.cashDeposits || [])
        .filter(d => d.dailyEntryId === entry.id && !d.collectionGroupId)
        .forEach(d => {
          d.collectionGroupId = fallbackGroupId;
        });
    });

    // Ensure all collectionGroups have valid array properties and exclude 'Udhaar'
    (data.operations.collectionGroups || []).forEach(g => {
      if (!Array.isArray(g.machineIds)) g.machineIds = [];
      if (!Array.isArray(g.salesmanIds)) g.salesmanIds = [];
      if (!Array.isArray(g.paymentMethods)) {
        g.paymentMethods = ['Cash', 'UPI', 'Card', 'Paytm', 'Other'];
      } else {
        g.paymentMethods = g.paymentMethods.filter(m => m !== 'Udhaar');
        if (g.paymentMethods.length === 0) g.paymentMethods = ['Cash', 'UPI', 'Card', 'Paytm', 'Other'];
      }
    });
  }

  // Ensure all expenses have paymentSource
  if (data.operations && data.operations.expenses) {
    data.operations.expenses.forEach(e => {
      if (!e.paymentSource) e.paymentSource = 'Cash';
    });
  }

  // Migration: 2.3.0 → 2.4.0 (Tank Capacity, BPCL Supplier, Employees CRM, Cash Counts, Salary Payments)
  if (!Array.isArray(data.masters.suppliers)) data.masters.suppliers = [];
  if (!SAMPLE()) {
    // real install: no sample suppliers
  } else if (data.masters.suppliers.length === 0) {
    data.masters.suppliers = [
      { id: 'supp-1', name: 'Bharat Petroleum Corporation Ltd (BPCL)', mobile: '1800-22-4344', status: 'active', remarks: 'Primary Oil Marketing Company / Fuel Depot', isDefault: true, createdAt: now, updatedAt: now },
      { id: 'supp-2', name: 'Castrol India Regional Depot', mobile: '0141-2789000', status: 'active', remarks: 'Lubricants & Engine Oils Supplier', isDefault: false, createdAt: now, updatedAt: now },
    ];
  } else if (!data.masters.suppliers.some(s => s.name.toUpperCase().includes('BPCL') || s.name.toUpperCase().includes('BHARAT PETROLEUM'))) {
    data.masters.suppliers.unshift({
      id: 'supp-bpcl',
      name: 'Bharat Petroleum Corporation Ltd (BPCL)',
      mobile: '1800-22-4344',
      status: 'active',
      remarks: 'Primary Oil Marketing Company / Fuel Depot',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!Array.isArray(data.masters.employees)) data.masters.employees = [];
  if (SAMPLE() && data.masters.employees.length === 0) {
    data.masters.employees = [
      { id: 'emp-1', salesmanId: 'sal-1', name: 'Rajesh Kumar', mobile: '9876501234', designation: 'Forecourt Shift Lead', monthlySalary: 22000, joiningDate: '2025-01-10', status: 'active', remarks: 'Morning shift lead', createdAt: now, updatedAt: now },
      { id: 'emp-2', salesmanId: 'sal-2', name: 'Amit Sharma',  mobile: '9876505678', designation: 'Forecourt Attendant', monthlySalary: 20000, joiningDate: '2025-03-15', status: 'active', remarks: 'Evening shift attendant', createdAt: now, updatedAt: now },
      { id: 'emp-3', salesmanId: 'sal-3', name: 'Sunil Verma',  mobile: '9876509988', designation: 'Forecourt Attendant', monthlySalary: 18000, joiningDate: '2025-05-01', status: 'active', remarks: 'Night shift attendant', createdAt: now, updatedAt: now },
    ];
  }

  // Link salesmanId <-> employeeId seamlessly without breaking historical IDs
  if (Array.isArray(data.masters.salesmen)) {
    data.masters.salesmen.forEach((s) => {
      if (!s.employeeId) {
        const matchingEmp = data.masters.employees.find(e => e.salesmanId === s.id || e.name.toLowerCase() === s.name.toLowerCase());
        if (matchingEmp) {
          s.employeeId = matchingEmp.id;
          matchingEmp.salesmanId = s.id;
        } else {
          const newEmpId = `emp-${s.id}`;
          s.employeeId = newEmpId;
          data.masters.employees.push({
            id: newEmpId,
            salesmanId: s.id,
            name: s.name,
            mobile: s.mobile || '',
            designation: 'Pump Attendant',
            monthlySalary: 20000,
            joiningDate: s.joiningDate || '2025-01-01',
            status: s.status || 'active',
            remarks: s.remarks || '',
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    });
  }

  if (!data.operations.tankCapacities) {
    data.operations.tankCapacities = { 'prod-1': 20000, 'prod-2': 30000, 'prod-3': 15000 };
  }
  if (!data.operations.fuelInitialStock) {
    data.operations.fuelInitialStock = { 'prod-1': 12500, 'prod-2': 18000, 'prod-3': 7500 };
  }
  if (!Array.isArray(data.operations.cashCounts)) {
    data.operations.cashCounts = [];
  }
  if (!Array.isArray(data.operations.salaryPayments)) {
    data.operations.salaryPayments = [];
  }
  if (!Array.isArray(data.operations.advanceRecoveries)) {
    data.operations.advanceRecoveries = [];
  }
  if (!Array.isArray(data.operations.openingStockOverrides)) {
    data.operations.openingStockOverrides = [];
  }

  // Migration: 2.5.0 → 3.0.0 (Production Reset)
  // Remove all data that has isDemo: true, effectively cleaning test data.
  if (['1.0.0', '1.1.0', '1.2.0', '1.3.0', '2.0.0', '2.1.0', '2.2.0', '2.3.0', '2.4.0', '2.5.0'].includes(v)) {
    if (data.operations) {
      for (const key of Object.keys(data.operations)) {
        if (Array.isArray(data.operations[key])) {
          data.operations[key] = data.operations[key].filter(item => !item.isDemo);
        }
      }
    }
    if (data.masters) {
      for (const key of Object.keys(data.masters)) {
        if (Array.isArray(data.masters[key])) {
          data.masters[key] = data.masters[key].filter(item => !item.isDemo);
        }
      }
    }
  }

  data.version = DATA_VERSION;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all application data from localStorage.
 * Automatically performs backward-compatible migration if older schema is detected.
 */
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    let data = JSON.parse(raw);
    if (data) {
      const needsMigration = data.version !== DATA_VERSION ||
        !data.operations ||
        !Array.isArray(data.operations.collectionGroups) ||
        !Array.isArray(data.operations.moneyMovements) ||
        !Array.isArray(data.operations.udhaarSales) ||
        !Array.isArray(data.operations.customerPayments) ||
        !Array.isArray(data.operations.fuelReceipts) ||
        !Array.isArray(data.operations.fuelDips) ||
        !Array.isArray(data.operations.lubricantPurchases) ||
        !Array.isArray(data.operations.lubricantSales) ||
        !Array.isArray(data.masters.suppliers) ||
        !Array.isArray(data.masters.employees) ||
        !data.operations.tankCapacities ||
        !Array.isArray(data.operations.cashCounts) ||
        !Array.isArray(data.operations.salaryPayments) ||
        !Array.isArray(data.operations.openingStockOverrides);
      if (needsMigration) {
        data = migrateData(data);
        saveData(data);
      }
    }
    return data;
  } catch (e) {
    console.error('FuelEx: Failed to load data from localStorage', e);
    return null;
  }
}

/**
 * Save all application data to localStorage.
 */
export function saveData(data) {
  try {
    data.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('FuelEx: Failed to save data to localStorage', e);
  }
}

/**
 * Initialize application data.
 * - If no data in localStorage: seed defaults.
 * - If data exists: run migration if version differs.
 * @returns {object} The initialized (and migrated) data object.
 */
export function initializeData() {
  let data = loadData();
  if (!data) {
    data = getDefaultData();
    saveData(data);
    console.info('FuelEx: Initialized with default seed data (v' + DATA_VERSION + ').');
  } else if (data.version !== DATA_VERSION) {
    data = migrateData(data);
    saveData(data);
    console.info('FuelEx: Data migrated to v' + DATA_VERSION);
  }
  return data;
}

/**
 * Generate a unique ID with optional prefix.
 */
export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export complete FuelExData as JSON string.
 */
export function exportFuelExDataJson() {
  const data = loadData() || getDefaultData();
  return JSON.stringify(data, null, 2);
}

/**
 * Validate and restore FuelExData from JSON string.
 * @param {string} jsonString
 * @returns {{ success: boolean, message?: string, data?: object }}
 */
export function importFuelExDataJson(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new Error('Invalid backup file: Content is empty.');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error('Invalid JSON format: Could not parse backup file.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup structure: Root must be a JSON object.');
  }

  // Verify structure has minimum FuelEx signature
  if (!parsed.masters && !parsed.operations && !parsed.version) {
    throw new Error('Unrecognized file: Not a valid FuelEx backup file.');
  }

  // Ensure safe migration
  const migrated = migrateData(parsed);
  saveData(migrated);
  return { success: true, data: migrated };
}
