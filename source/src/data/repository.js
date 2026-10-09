/**
 * FuelEx - Repository / Service Layer
 * 
 * All business logic and data access functions live here.
 * UI components call these functions — they never access localStorage directly.
 * 
 * Architecture: UI → Service Layer (repository.js) → Storage Layer (storage.js) → localStorage
 * 
 * To swap to Supabase/Firebase/REST API later:
 * Replace only the implementations in this file (and storage.js).
 * The UI remains unchanged.
 */

import { localDate, localMonth } from '../utils/dates.js';
import { loadData, saveData, generateId } from './storage.js';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getData() {
  return loadData();
}

function setData(data) {
  saveData(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export function getSettings() {
  const data = getData();
  return data?.settings ?? { theme: 'dark', appName: 'FuelEx', storageType: 'local' };
}

export function updateSettings(partial) {
  const data = getData();
  data.settings = { ...data.settings, ...partial };
  setData(data);
  return data.settings;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS (Fuel Products: Petrol, Diesel, Speed Petrol)
// ─────────────────────────────────────────────────────────────────────────────

export function getProducts() {
  return getData()?.masters?.products ?? [];
}

export function getActiveProducts() {
  return getProducts().filter(p => p.status === 'active');
}

export function getProduct(id) {
  return getProducts().find(p => p.id === id) ?? null;
}

export function createProduct({ name, unit = 'Litre', remarks = '' }) {
  const data = getData();
  const now = new Date().toISOString();
  const product = {
    id: generateId('prod'),
    name: name.trim(),
    unit,
    status: 'active',
    remarks,
    createdAt: now,
    updatedAt: now,
  };
  data.masters.products.push(product);
  setData(data);
  return product;
}

export function updateProduct(id, updates) {
  const data = getData();
  const idx = data.masters.products.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Product not found');
  data.masters.products[idx] = {
    ...data.masters.products[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setData(data);
  return data.masters.products[idx];
}

export function setProductStatus(id, status) {
  return updateProduct(id, { status });
}

export function canDeleteProduct(id) {
  const nozzles = getNozzles().filter(n => n.productId === id);
  if (nozzles.length > 0) {
    return {
      canDelete: false,
      reason: `This fuel product is configured on ${nozzles.length} nozzle(s). Please delete or reassign those nozzles first, or deactivate this product instead.`,
    };
  }
  const prices = getPriceHistory().filter(p => p.productId === id);
  if (prices.length > 0) {
    return {
      canDelete: false,
      reason: 'This product has price history entries associated with it and cannot be deleted. You can deactivate it instead.',
    };
  }
  const readings = getAllMeterReadings().filter(r => r.productId === id);
  if (readings.length > 0) {
    return {
      canDelete: false,
      reason: `This product is recorded in ${readings.length} historical meter reading(s) and cannot be permanently deleted. You can deactivate it instead.`,
    };
  }
  return { canDelete: true };
}

export function deleteProduct(id) {
  const check = canDeleteProduct(id);
  if (!check.canDelete) throw new Error(check.reason);
  const data = getData();
  data.masters.products = data.masters.products.filter(p => p.id !== id);
  setData(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// MACHINES
// ─────────────────────────────────────────────────────────────────────────────

export function getMachines() {
  return getData()?.masters?.machines ?? [];
}

export function getActiveMachines() {
  return getMachines().filter(m => m.status === 'active');
}

export function getMachine(id) {
  return getMachines().find(m => m.id === id) ?? null;
}

export function createMachine({ name }) {
  const data = getData();
  const now = new Date().toISOString();
  const machine = {
    id: generateId('mach'),
    name: name.trim(),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  data.masters.machines.push(machine);
  setData(data);
  return machine;
}

export function updateMachine(id, updates) {
  const data = getData();
  const idx = data.masters.machines.findIndex(m => m.id === id);
  if (idx === -1) throw new Error('Machine not found');
  data.masters.machines[idx] = {
    ...data.masters.machines[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setData(data);
  return data.masters.machines[idx];
}

export function setMachineStatus(id, status) {
  return updateMachine(id, { status });
}

export function canDeleteMachine(id) {
  const nozzles = getNozzles().filter(n => n.machineId === id);
  if (nozzles.length > 0) {
    return {
      canDelete: false,
      reason: `This machine has ${nozzles.length} nozzle(s) assigned to it. Please delete or reassign its nozzles first, or deactivate the machine instead.`,
    };
  }
  const readings = getAllMeterReadings().filter(r => r.machineId === id);
  if (readings.length > 0) {
    return {
      canDelete: false,
      reason: `This machine is referenced in historical meter readings and cannot be permanently deleted. You can deactivate it instead.`,
    };
  }
  return { canDelete: true };
}

export function deleteMachine(id) {
  const check = canDeleteMachine(id);
  if (!check.canDelete) throw new Error(check.reason);
  const data = getData();
  data.masters.machines = data.masters.machines.filter(m => m.id !== id);
  setData(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// NOZZLES
// ─────────────────────────────────────────────────────────────────────────────

export function getNozzles() {
  return getData()?.masters?.nozzles ?? [];
}

export function getActiveNozzles() {
  return getNozzles().filter(n => n.status === 'active');
}

export function getNozzle(id) {
  return getNozzles().find(n => n.id === id) ?? null;
}

export function createNozzle({ machineId, name, productId }) {
  const data = getData();
  const now = new Date().toISOString();
  const nozzle = {
    id: generateId('noz'),
    machineId,
    name: name.trim(),
    productId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  data.masters.nozzles.push(nozzle);
  setData(data);
  return nozzle;
}

export function updateNozzle(id, updates) {
  const data = getData();
  const idx = data.masters.nozzles.findIndex(n => n.id === id);
  if (idx === -1) throw new Error('Nozzle not found');
  data.masters.nozzles[idx] = {
    ...data.masters.nozzles[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setData(data);
  return data.masters.nozzles[idx];
}

export function setNozzleStatus(id, status) {
  return updateNozzle(id, { status });
}

export function canDeleteNozzle(id) {
  const readings = getAllMeterReadings().filter(r => r.nozzleId === id);
  if (readings.length > 0) {
    return {
      canDelete: false,
      reason: `This nozzle has ${readings.length} historical meter reading(s) recorded and cannot be permanently deleted. You can deactivate it instead.`,
    };
  }
  return { canDelete: true };
}

export function deleteNozzle(id) {
  const check = canDeleteNozzle(id);
  if (!check.canDelete) throw new Error(check.reason);
  const data = getData();
  data.masters.nozzles = data.masters.nozzles.filter(n => n.id !== id);
  setData(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// LUBRICANTS
// ─────────────────────────────────────────────────────────────────────────────

export function getLubricants() {
  return getData()?.masters?.lubricants ?? [];
}

export function getActiveLubricants() {
  return getLubricants().filter(l => l.status === 'active');
}

export function getLubricant(id) {
  return getLubricants().find(l => l.id === id) ?? null;
}

export function createLubricant({
  name,
  brand = '',
  category = 'Engine Oil',
  packSize = '1',
  unit = 'Litre',
  purchasePrice = 0,
  sellingPrice = 0,
  status = 'active',
  remarks = '',
}) {
  const data = getData();
  const now = new Date().toISOString();
  const lubricant = {
    id: generateId('lube'),
    name: name.trim(),
    brand: brand.trim(),
    category: category.trim(),
    packSize: String(packSize).trim() || '1',
    unit: unit.trim() || 'Litre',
    purchasePrice: Number(purchasePrice) || 0,
    sellingPrice: Number(sellingPrice) || 0,
    status: status === 'inactive' ? 'inactive' : 'active',
    remarks: remarks.trim(),
    createdAt: now,
    updatedAt: now,
  };
  if (!data.masters.lubricants) data.masters.lubricants = [];
  data.masters.lubricants.push(lubricant);
  setData(data);
  return lubricant;
}

export function updateLubricant(id, updates) {
  const data = getData();
  if (!data.masters.lubricants) data.masters.lubricants = [];
  const idx = data.masters.lubricants.findIndex(l => l.id === id);
  if (idx === -1) throw new Error('Lubricant not found');
  data.masters.lubricants[idx] = {
    ...data.masters.lubricants[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setData(data);
  return data.masters.lubricants[idx];
}

export function setLubricantStatus(id, status) {
  return updateLubricant(id, { status });
}

export function canDeleteLubricant(id) {
  const data = getData();
  const purchases = (data?.operations?.lubricantPurchases ?? []).filter(r => r.lubricantId === id);
  const sales = (data?.operations?.lubricantSales ?? []).filter(r => r.lubricantId === id);
  const total = purchases.length + sales.length;
  if (total > 0) {
    return {
      canDelete: false,
      reason: `This lubricant has ${total} purchase/sale record(s) and cannot be permanently deleted. You can deactivate it instead.`,
    };
  }
  return { canDelete: true };
}

export function deleteLubricant(id) {
  const check = canDeleteLubricant(id);
  if (!check.canDelete) throw new Error(check.reason);
  const data = getData();
  if (!data.masters.lubricants) return;
  data.masters.lubricants = data.masters.lubricants.filter(l => l.id !== id);
  setData(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// SALESMEN
// ─────────────────────────────────────────────────────────────────────────────

export function getSalesmen() {
  return getData()?.masters?.salesmen ?? [];
}

export function getActiveSalesmen() {
  return getSalesmen().filter(s => s.status === 'active');
}

export function getSalesman(id) {
  return getSalesmen().find(s => s.id === id) ?? null;
}

export function createSalesman({ name, mobile = '', joiningDate = '', remarks = '', isDemo = false }) {
  const data = getData();
  const now = new Date().toISOString();
  const salesman = {
    id: generateId('sal'),
    name: name.trim(),
    mobile: mobile.trim(),
    joiningDate,
    status: 'active',
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };
  data.masters.salesmen.push(salesman);
  setData(data);
  return salesman;
}

export function updateSalesman(id, updates) {
  const data = getData();
  const idx = data.masters.salesmen.findIndex(s => s.id === id);
  if (idx === -1) throw new Error('Salesman not found');
  data.masters.salesmen[idx] = {
    ...data.masters.salesmen[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setData(data);
  return data.masters.salesmen[idx];
}

export function setSalesmanStatus(id, status) {
  return updateSalesman(id, { status });
}

export function canDeleteSalesman(id) {
  const data = getData();
  const deposits = getAllCashDeposits().filter(d => d.salesmanId === id);
  const udhaar = (data?.operations?.udhaarSales ?? []).filter(u => u.salesmanId === id);
  const groups = (data?.operations?.collectionGroups ?? []).filter(g => Array.isArray(g.salesmanIds) && g.salesmanIds.includes(id));
  const total = deposits.length + udhaar.length + groups.length;
  if (total > 0) {
    return {
      canDelete: false,
      reason: `This salesman is recorded in ${total} historical record(s) (cash deposits, credit sales or collection groups) and cannot be permanently deleted. You can deactivate the salesman instead.`,
    };
  }
  return { canDelete: true };
}

export function deleteSalesman(id) {
  const check = canDeleteSalesman(id);
  if (!check.canDelete) throw new Error(check.reason);
  const data = getData();
  data.masters.salesmen = data.masters.salesmen.filter(s => s.id !== id);
  setData(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────

export function getCustomers() {
  return getData()?.masters?.customers ?? [];
}

export function getActiveCustomers() {
  return getCustomers().filter(c => c.status === 'active');
}

export function getCustomer(id) {
  return getCustomers().find(c => c.id === id) ?? null;
}

export function getCustomerCreditStatus(customer, outstandingBalance = 0) {
  const limit = customer.creditLimit ?? 0;
  if (limit <= 0) return { status: 'no-limit', label: 'No Limit Set', outstanding: outstandingBalance };
  const ratio = outstandingBalance / limit;
  if (ratio >= 1) return { status: 'over', label: 'Over Limit', outstanding: outstandingBalance };
  if (ratio >= 0.8) return { status: 'near', label: 'Near Limit', outstanding: outstandingBalance };
  return { status: 'ok', label: 'Within Limit', outstanding: outstandingBalance };
}

export function createCustomer({ name, mobile = '', address = '', openingBalance = 0, creditLimit = 0, remarks = '', isDemo = false }) {
  const data = getData();
  const now = new Date().toISOString();
  const customer = {
    id: generateId('cust'),
    name: name.trim(),
    mobile: mobile.trim(),
    address: address.trim(),
    openingBalance: Number(openingBalance) || 0,
    creditLimit: Number(creditLimit) || 0,
    status: 'active',
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };
  data.masters.customers.push(customer);
  setData(data);
  return customer;
}

export function updateCustomer(id, updates) {
  const data = getData();
  const idx = data.masters.customers.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Customer not found');
  data.masters.customers[idx] = {
    ...data.masters.customers[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setData(data);
  return data.masters.customers[idx];
}

export function setCustomerStatus(id, status) {
  return updateCustomer(id, { status });
}

export function canDeleteCustomer(id) {
  const data = getData();
  const collections = getAllCollections().filter(c => c.customerId === id);
  const udhaar = (data?.operations?.udhaarSales ?? []).filter(u => u.customerId === id);
  const payments = (data?.operations?.customerPayments ?? []).filter(p => p.customerId === id);
  const total = collections.length + udhaar.length + payments.length;
  if (total > 0) {
    return {
      canDelete: false,
      reason: `This customer has ${total} transaction(s) (credit sales, payments or collections) and cannot be permanently deleted, because the ledger and Udhaar balances depend on it. You can deactivate the customer instead.`,
    };
  }
  return { canDelete: true };
}

export function deleteCustomer(id) {
  const check = canDeleteCustomer(id);
  if (!check.canDelete) throw new Error(check.reason);
  const data = getData();
  data.masters.customers = data.masters.customers.filter(c => c.id !== id);
  setData(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIERS
// ─────────────────────────────────────────────────────────────────────────────

export function getSuppliers() {
  return getData()?.masters?.suppliers ?? [];
}

export function getActiveSuppliers() {
  return getSuppliers().filter(s => s.status === 'active');
}

export function getSupplier(id) {
  return getSuppliers().find(s => s.id === id) ?? null;
}

export function createSupplier({ name, mobile = '', remarks = '', isDemo = false }) {
  const data = getData();
  const now = new Date().toISOString();
  const supplier = {
    id: generateId('supp'),
    name: name.trim(),
    mobile: mobile.trim(),
    status: 'active',
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };
  if (!data.masters.suppliers) data.masters.suppliers = [];
  data.masters.suppliers.push(supplier);
  setData(data);
  return supplier;
}

export function updateSupplier(id, updates) {
  const data = getData();
  const idx = data.masters.suppliers.findIndex(s => s.id === id);
  if (idx === -1) throw new Error('Supplier not found');
  data.masters.suppliers[idx] = {
    ...data.masters.suppliers[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setData(data);
  return data.masters.suppliers[idx];
}

export function setSupplierStatus(id, status) {
  return updateSupplier(id, { status });
}

export function canDeleteSupplier(id) {
  const data = getData();
  const sup = (data?.masters?.suppliers ?? []).find(s => s.id === id);
  const byRef = r => r.supplierId === id || (sup && r.supplierName && r.supplierName === sup.name);
  const receipts = (data?.operations?.fuelReceipts ?? []).filter(byRef);
  const purchases = (data?.operations?.lubricantPurchases ?? []).filter(byRef);
  const total = receipts.length + purchases.length;
  if (total > 0) {
    return {
      canDelete: false,
      reason: `This supplier is used in ${total} fuel top-up / lubricant purchase record(s) and cannot be permanently deleted. You can deactivate the supplier instead.`,
    };
  }
  return { canDelete: true };
}

export function deleteSupplier(id) {
  const check = canDeleteSupplier(id);
  if (!check.canDelete) throw new Error(check.reason);
  const data = getData();
  data.masters.suppliers = data.masters.suppliers.filter(s => s.id !== id);
  setData(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEES MASTER & CRM
// ─────────────────────────────────────────────────────────────────────────────

export function getEmployees() {
  return getData()?.masters?.employees ?? [];
}

export function getActiveEmployees() {
  return getEmployees().filter(e => e.status === 'active');
}

export function getEmployee(id) {
  return getEmployees().find(e => e.id === id) ?? null;
}

export function createEmployee({
  name,
  mobile = '',
  designation = 'Forecourt Attendant',
  monthlySalary = 20000,
  joiningDate = '',
  status = 'active',
  remarks = '',
  salesmanId = '',
  isDemo = false,
}) {
  const data = getData();
  const now = new Date().toISOString();
  const employee = {
    id: generateId('emp'),
    salesmanId: salesmanId || '',
    name: name.trim(),
    mobile: mobile.trim(),
    designation: designation.trim(),
    monthlySalary: Number(monthlySalary) || 0,
    joiningDate: joiningDate || now.split('T')[0],
    status,
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };

  if (!data.masters.employees) data.masters.employees = [];
  data.masters.employees.push(employee);

  // Link salesman if specified
  if (salesmanId && Array.isArray(data.masters.salesmen)) {
    const sIdx = data.masters.salesmen.findIndex(s => s.id === salesmanId);
    if (sIdx !== -1) {
      data.masters.salesmen[sIdx].employeeId = employee.id;
    }
  }

  setData(data);
  return employee;
}

export function updateEmployee(id, updates) {
  const data = getData();
  const idx = data.masters.employees.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Employee not found');

  data.masters.employees[idx] = {
    ...data.masters.employees[idx],
    ...updates,
    monthlySalary: updates.monthlySalary !== undefined ? Number(updates.monthlySalary) || 0 : data.masters.employees[idx].monthlySalary,
    updatedAt: new Date().toISOString(),
  };

  setData(data);
  return data.masters.employees[idx];
}

export function setEmployeeStatus(id, status) {
  return updateEmployee(id, { status });
}

export function getAllSalaryPayments() {
  return getData()?.operations?.salaryPayments ?? [];
}

export function getSalaryPaymentsByEmployee(employeeId) {
  return getAllSalaryPayments().filter(p => p.employeeId === employeeId);
}

export function createSalaryPayment({
  employeeId,
  salaryMonth,
  paymentDate,
  amount,
  paymentSource = 'Cash',
  reference = '',
  remarks = '',
  isDemo = false,
}) {
  const data = getData();
  const now = new Date().toISOString();
  const emp = getEmployee(employeeId);
  const paymentRecord = {
    id: generateId('sal-pay'),
    employeeId,
    employeeName: emp?.name || '',
    salaryMonth: salaryMonth || localMonth(),
    paymentDate: paymentDate || localDate(),
    amount: Number(amount) || 0,
    paymentSource,
    reference: reference.trim(),
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };

  if (!data.operations.salaryPayments) data.operations.salaryPayments = [];
  data.operations.salaryPayments.push(paymentRecord);
  setData(data);
  return paymentRecord;
}

export function deleteSalaryPayment(id) {
  const data = getData();
  if (!data?.operations?.salaryPayments) return;
  data.operations.salaryPayments = data.operations.salaryPayments.filter(p => p.id !== id);
  setData(data);
}

export function getAllAdvanceRecoveries() {
  return getData()?.operations?.advanceRecoveries ?? [];
}

export function getAdvanceRecoveriesByEmployee(employeeId) {
  return getAllAdvanceRecoveries().filter(r => r.employeeId === employeeId);
}

export function createAdvanceRecovery({
  employeeId,
  date,
  amount,
  recoverySource = 'Salary Deduction',
  remarks = '',
  isDemo = false,
}) {
  const data = getData();
  const now = new Date().toISOString();
  const emp = getEmployee(employeeId);
  const recoveryRecord = {
    id: generateId('adv-rec'),
    employeeId,
    employeeName: emp?.name || '',
    date: date || localDate(),
    amount: Number(amount) || 0,
    recoverySource,
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };

  if (!data.operations.advanceRecoveries) data.operations.advanceRecoveries = [];
  data.operations.advanceRecoveries.push(recoveryRecord);
  setData(data);
  return recoveryRecord;
}

export function deleteAdvanceRecovery(id) {
  const data = getData();
  if (!data?.operations?.advanceRecoveries) return;
  data.operations.advanceRecoveries = data.operations.advanceRecoveries.filter(r => r.id !== id);
  setData(data);
}

export function getEmployeeFinancialSummary(employeeId, targetMonth) {
  const emp = getEmployee(employeeId);
  if (!emp) {
    return {
      employee: null,
      monthlySalary: 0,
      salaryPaid: 0,
      salaryDue: 0,
      totalAdvances: 0,
      advancesRecovered: 0,
      advanceOutstanding: 0,
      salaryHistory: [],
      advancesHistory: [],
      recoveriesHistory: [],
      paymentsHistory: [],
    };
  }

  const currentMonth = targetMonth || localMonth();
  const salaryPayments = getSalaryPaymentsByEmployee(employeeId);
  const advanceRecoveries = getAdvanceRecoveriesByEmployee(employeeId);

  // Sourced from dailyEntry moneyMovements (type === 'Employee Advance' or 'Salary Advance')
  const allMovements = getData()?.operations?.moneyMovements ?? [];
  const advances = allMovements.filter(m =>
    (m.type === 'Employee Advance' || m.type === 'Salary Advance') &&
    (m.payeeId === employeeId || m.payeeId === emp.salesmanId || (m.payeeName && m.payeeName.toLowerCase() === emp.name.toLowerCase()))
  );

  const totalAdvances = Number(advances.reduce((sum, m) => sum + (Number(m.amount) || 0), 0).toFixed(2));
  const advancesRecovered = Number(advanceRecoveries.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toFixed(2));
  const advanceOutstanding = Math.max(0, Number((totalAdvances - advancesRecovered).toFixed(2)));

  const monthPayments = salaryPayments.filter(p => p.salaryMonth === currentMonth);
  const salaryPaid = Number(monthPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toFixed(2));
  const monthlySalary = Number(emp.monthlySalary) || 0;
  const salaryDue = Math.max(0, Number((monthlySalary - salaryPaid).toFixed(2)));

  // Monthly salary history
  const monthsMap = new Map();
  monthsMap.set(currentMonth, 0);
  salaryPayments.forEach(p => {
    monthsMap.set(p.salaryMonth, (monthsMap.get(p.salaryMonth) || 0) + Number(p.amount));
  });

  const salaryHistory = Array.from(monthsMap.entries())
    .map(([m, paid]) => {
      const due = Math.max(0, Number((monthlySalary - paid).toFixed(2)));
      let status = 'Due';
      if (paid >= monthlySalary) status = 'Paid';
      else if (paid > 0) status = 'Partial';
      return {
        month: m,
        monthlySalary,
        paid,
        due,
        status,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    employee: emp,
    monthlySalary,
    salaryPaid,
    salaryDue,
    totalAdvances,
    advancesRecovered,
    advanceOutstanding,
    salaryHistory,
    advancesHistory: advances,
    recoveriesHistory: advanceRecoveries,
    paymentsHistory: salaryPayments,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE HISTORY
// ─────────────────────────────────────────────────────────────────────────────

export function getPriceHistory() {
  return getData()?.masters?.priceHistory ?? [];
}

export function getApplicablePrice(productId, date) {
  const history = getPriceHistory()
    .filter(p => p.productId === productId && p.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  return history[0] ?? null;
}

export function addPriceHistory({ productId, effectiveDate, sellingPrice, purchaseCost, remarks = '', isDemo = false }) {
  const data = getData();
  const now = new Date().toISOString();
  const entry = {
    id: generateId('price'),
    productId,
    effectiveDate,
    sellingPrice: Number(sellingPrice) || 0,
    purchaseCost: Number(purchaseCost) || 0,
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };
  data.masters.priceHistory.push(entry);
  setData(data);
  return entry;
}

export function updatePriceHistory(id, updates) {
  const data = getData();
  const idx = data.masters.priceHistory.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Price entry not found');
  data.masters.priceHistory[idx] = {
    ...data.masters.priceHistory[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setData(data);
  return data.masters.priceHistory[idx];
}

export function canDeletePrice(id) {
  const readings = getAllMeterReadings().filter(r => r.priceId === id);
  if (readings.length > 0) {
    return {
      canDelete: false,
      reason: 'This price record is already referenced by historical transactions and cannot be deleted.',
    };
  }
  return { canDelete: true };
}

export function deletePriceHistory(id) {
  const check = canDeletePrice(id);
  if (!check.canDelete) throw new Error(check.reason);
  const data = getData();
  data.masters.priceHistory = data.masters.priceHistory.filter(p => p.id !== id);
  setData(data);
}

export function deletePrice(id) {
  return deletePriceHistory(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

export function getExpenseCategories() {
  return getData()?.masters?.expenseCategories ?? [];
}

export function getActiveExpenseCategories() {
  return getExpenseCategories().filter(c => c.status === 'active');
}

export function getExpenseCategory(id) {
  return getExpenseCategories().find(c => c.id === id) ?? null;
}

export function createExpenseCategory({ name }) {
  const data = getData();
  const now = new Date().toISOString();
  const category = {
    id: generateId('exp'),
    name: name.trim(),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  data.masters.expenseCategories.push(category);
  setData(data);
  return category;
}

export function updateExpenseCategory(id, updates) {
  const data = getData();
  const idx = data.masters.expenseCategories.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Expense category not found');
  data.masters.expenseCategories[idx] = {
    ...data.masters.expenseCategories[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setData(data);
  return data.masters.expenseCategories[idx];
}

export function setExpenseCategoryStatus(id, status) {
  return updateExpenseCategory(id, { status });
}

export function canDeleteExpenseCategory(id) {
  const expenses = getAllExpenses().filter(e => e.categoryId === id);
  if (expenses.length > 0) {
    return {
      canDelete: false,
      reason: `This category is used in ${expenses.length} expense voucher(s) and cannot be permanently deleted. You can deactivate it instead.`,
    };
  }
  return { canDelete: true };
}

export function deleteExpenseCategory(id) {
  const check = canDeleteExpenseCategory(id);
  if (!check.canDelete) throw new Error(check.reason);
  const data = getData();
  data.masters.expenseCategories = data.masters.expenseCategories.filter(c => c.id !== id);
  setData(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2: OPERATIONS & DAILY ENTRY
// ─────────────────────────────────────────────────────────────────────────────

export function getDailyEntries() {
  const entries = getData()?.operations?.dailyEntries ?? [];
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export function getDailyEntry(id) {
  return getDailyEntries().find(e => e.id === id) ?? null;
}

export function getDailyEntryByDate(date) {
  return getDailyEntries().find(e => e.date === date) ?? null;
}

export function getAllMeterReadings() {
  return getData()?.operations?.meterReadings ?? [];
}

export function getMeterReadingsByDailyEntryId(dailyEntryId) {
  return getAllMeterReadings().filter(r => r.dailyEntryId === dailyEntryId);
}

export function getAllCollections() {
  return getData()?.operations?.collections ?? [];
}

export function getCollectionsByDailyEntryId(dailyEntryId) {
  return getAllCollections().filter(c => c.dailyEntryId === dailyEntryId);
}

export function getAllCollectionGroups() {
  return getData()?.operations?.collectionGroups ?? [];
}

export function getCollectionGroupsByDailyEntryId(dailyEntryId) {
  return getAllCollectionGroups().filter(g => g.dailyEntryId === dailyEntryId);
}

export function getAllCashDeposits() {
  return getData()?.operations?.cashDeposits ?? [];
}

export function getCashDepositsByDailyEntryId(dailyEntryId) {
  return getAllCashDeposits().filter(d => d.dailyEntryId === dailyEntryId);
}

export function getAllExpenses() {
  return getData()?.operations?.expenses ?? [];
}

export function getExpensesByDailyEntryId(dailyEntryId) {
  return getAllExpenses().filter(e => e.dailyEntryId === dailyEntryId);
}

export function getAllMoneyMovements() {
  return getData()?.operations?.moneyMovements ?? [];
}

export function getMoneyMovementsByDailyEntryId(dailyEntryId) {
  return getAllMoneyMovements().filter(m => m.dailyEntryId === dailyEntryId);
}

/**
 * Get the previous day's closing readings for all nozzles.
 * Finds the latest saved DailyEntry with date strictly before targetDate.
 * @param {string} targetDate - 'YYYY-MM-DD'
 * @returns {Record<string, number>} - Map of nozzleId -> closingReading
 */
export function getPreviousClosingReadings(targetDate) {
  const previousEntries = getDailyEntries().filter(e => e.date < targetDate);
  if (previousEntries.length === 0) return {};

  const latestPrev = previousEntries[0]; // already sorted desc
  const readings = getMeterReadingsByDailyEntryId(latestPrev.id);
  const map = {};
  for (const r of readings) {
    if (r.closingReading !== undefined && r.closingReading !== null && r.closingReading !== '') {
      map[r.nozzleId] = Number(r.closingReading) || 0;
    }
  }
  return map;
}

/**
 * Get the previous day's collection grouping setup (without money amounts).
 * Returns template groups for minimum data entry.
 * @param {string} targetDate - 'YYYY-MM-DD'
 * @returns {Array<object>} - Array of CollectionGroup templates
 */
export function getPreviousCollectionGroups(targetDate) {
  const previousEntries = getDailyEntries().filter(e => e.date < targetDate);
  const data = getData();
  const allGroups = data?.operations?.collectionGroups || [];

  for (const entry of previousEntries) {
    const groups = allGroups.filter(g => g.dailyEntryId === entry.id);
    if (groups && groups.length > 0) {
      return groups.map(g => ({
        id: generateId('grp'),
        name: g.name,
        machineIds: Array.isArray(g.machineIds) ? [...g.machineIds] : [],
        salesmanIds: Array.isArray(g.salesmanIds) ? [...g.salesmanIds] : [],
        paymentMethods: Array.isArray(g.paymentMethods) ? [...g.paymentMethods] : ['Cash', 'UPI', 'Card', 'Paytm', 'Other'],
      }));
    }
  }

  // Real-world operational default template if no prior day exists:
  // Group A: Machine 1 + Machine 2
  // Group B: Machine 3
  return [
    {
      id: generateId('grp'),
      name: 'Group A',
      machineIds: ['mach-1', 'mach-2'],
      salesmanIds: ['sal-1', 'sal-2'],
      paymentMethods: ['Cash', 'UPI', 'Card', 'Paytm', 'Other'],
    },
    {
      id: generateId('grp'),
      name: 'Group B',
      machineIds: ['mach-3'],
      salesmanIds: ['sal-3'],
      paymentMethods: ['Cash', 'UPI', 'Card', 'Paytm', 'Other'],
    },
  ];
}

/**
 * Validate that each active machine belongs to exactly one Collection Group.
 * Required before completing a day.
 */
export function validateMachineGrouping(collectionGroups = [], activeMachines = []) {
  const errors = [];
  const assignedCounts = {};
  for (const m of activeMachines) {
    assignedCounts[m.id] = 0;
  }

  for (const grp of collectionGroups) {
    for (const mId of (grp.machineIds || [])) {
      if (assignedCounts[mId] !== undefined) {
        assignedCounts[mId] = (assignedCounts[mId] || 0) + 1;
      }
    }
  }

  for (const m of activeMachines) {
    const count = assignedCounts[m.id] || 0;
    if (count === 0) {
      errors.push(`${m.name} is not assigned to a collection group.`);
    } else if (count > 1) {
      errors.push(`${m.name} is assigned to more than one collection group.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UDHAAR / CREDIT SALES
// ─────────────────────────────────────────────────────────────────────────────

export function getAllUdhaarSales() {
  return getData()?.operations?.udhaarSales ?? [];
}

export function getUdhaarSalesByDailyEntryId(dailyEntryId) {
  const data = getData();
  return (data?.operations?.udhaarSales ?? []).filter(u => u.dailyEntryId === dailyEntryId);
}

export function getUdhaarSalesByCustomerId(customerId) {
  const data = getData();
  return (data?.operations?.udhaarSales ?? []).filter(u => u.customerId === customerId);
}

export function createUdhaarSale({
  date,
  dailyEntryId = '',
  customerId,
  customerName = '',
  machineId = '',
  salesmanId = '',
  productId,
  quantity,
  rate,
  amount,
  collectionGroupId = '',
  remarks = '',
  isDemo = false,
}) {
  const data = getData();
  const now = new Date().toISOString();
  const cust = getCustomer(customerId);
  const prod = getProduct(productId);
  const qty = Number(quantity) || 0;
  const applicableRate = rate !== undefined && rate !== null && rate !== '' ? Number(rate) : (getApplicablePrice(productId, date)?.sellingPrice || 0);
  const finalAmount = amount !== undefined && amount !== null && amount !== '' ? Number(amount) : Number((qty * applicableRate).toFixed(2));

  const udhaarRecord = {
    id: generateId('udh'),
    date,
    dailyEntryId,
    customerId,
    customerName: customerName || cust?.name || 'Customer',
    machineId: machineId || '',
    salesmanId: salesmanId || '',
    productId: productId || '',
    productName: prod?.name || '',
    quantity: qty,
    rate: applicableRate,
    amount: finalAmount,
    collectionGroupId: collectionGroupId || null,
    remarks: (remarks || '').trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };

  if (!data.operations.udhaarSales) data.operations.udhaarSales = [];
  data.operations.udhaarSales.push(udhaarRecord);
  setData(data);
  return udhaarRecord;
}

export function deleteUdhaarSale(id) {
  const data = getData();
  if (!data?.operations?.udhaarSales) return;
  data.operations.udhaarSales = data.operations.udhaarSales.filter(u => u.id !== id);
  setData(data);
}

/**
 * Save or update a DailyEntry with its normalized child transaction records.
 * Ensures duplicate protection: re-saving a date updates existing records using stable IDs.
 */
// ─────────────────────────────────────────────────────────────────────────────
// CHANGE CONTROL — past-date edits need a reason and are logged
// ─────────────────────────────────────────────────────────────────────────────

/** Records older than this many days need a reason to be added, changed or deleted. */
export const PAST_EDIT_GRACE_DAYS = 1;

function dateMinusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDate(d);
}

/** True when changing a record dated `date` must be justified (older than yesterday). */
export function isPastDateLocked(date) {
  if (!date) return false;
  return date < dateMinusDays(PAST_EDIT_GRACE_DAYS);
}

/** Daily Entry rule: completed days and days older than yesterday need a reason. */
export function dailyEntryNeedsReason(date, existingStatus = null) {
  return existingStatus === 'completed' || isPastDateLocked(date);
}

export function getAuditLog() {
  const list = getData()?.operations?.auditLog ?? [];
  // newest first; insertion order breaks ties
  return list
    .map((rec, i) => ({ rec, i }))
    .sort((a, b) => String(b.rec.at).localeCompare(String(a.rec.at)) || b.i - a.i)
    .map(x => x.rec);
}

export function addAuditLog({ date = '', module = '', action = '', reason = '', summary = '' }) {
  const data = getData();
  if (!data.operations) return null;
  if (!Array.isArray(data.operations.auditLog)) data.operations.auditLog = [];
  const record = {
    id: generateId('audit'),
    at: new Date().toISOString(),
    date,
    module,
    action,
    reason: String(reason || '').trim(),
    summary,
  };
  data.operations.auditLog.push(record);
  setData(data);
  return record;
}

export function saveDailyEntry({
  id,
  date,
  status = 'draft',
  isDemo = false,
  collectionGroups = [],
  meterReadings = [],
  collections = [],
  cashDeposits = [],
  expenses = [],
  moneyMovements = [],
  udhaarSales = [],
  editReason = '',
}) {
  const data = getData();
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
      lubricantPurchases: [],
      lubricantSales: [],
    };
  } else {
    if (!data.operations.collectionGroups) data.operations.collectionGroups = [];
    if (!data.operations.moneyMovements) data.operations.moneyMovements = [];
    if (!data.operations.udhaarSales) data.operations.udhaarSales = [];
  }

  const now = new Date().toISOString();

  // Find if an entry already exists for this date or by ID
  let existingIndex = data.operations.dailyEntries.findIndex(e => e.date === date);
  if (existingIndex === -1 && id) {
    existingIndex = data.operations.dailyEntries.findIndex(e => e.id === id);
  }

  const dailyEntryId = existingIndex !== -1 ? data.operations.dailyEntries[existingIndex].id : (id || generateId('day'));
  const existingRecord = existingIndex !== -1 ? data.operations.dailyEntries[existingIndex] : null;

  // Change control: completed days and days older than yesterday need a written reason
  const reasonText = String(editReason || '').trim();
  const needsReason = !isDemo && dailyEntryNeedsReason(date, existingRecord?.status ?? null);
  if (needsReason && reasonText.length < 5) {
    const err = new Error('A reason (at least 5 characters) is required to change a past or completed day.');
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  // 1. Process Collection Groups (Ensure 'Udhaar' is NOT a collection payment method)
  const processedGroups = collectionGroups.map(g => ({
    id: g.id || generateId('grp'),
    dailyEntryId,
    name: (g.name || 'Group').trim(),
    machineIds: Array.isArray(g.machineIds) ? g.machineIds : [],
    salesmanIds: Array.isArray(g.salesmanIds) ? g.salesmanIds : [],
    paymentMethods: Array.isArray(g.paymentMethods)
      ? g.paymentMethods.filter(m => m !== 'Udhaar')
      : ['Cash', 'UPI', 'Card', 'Paytm', 'Other'],
    isDemo: Boolean(isDemo),
    updatedAt: now,
  }));

  // 2. Process Meter Readings & calculate fuel totals
  let totalFuelLitres = 0;
  let totalSalesValue = 0;
  const processedReadings = meterReadings.map(r => {
    const opening = Number(r.openingReading) || 0;
    const closing = Number(r.closingReading) || 0;
    const salesLitres = Math.max(0, Number((closing - opening).toFixed(2)));
    const price = r.sellingPrice !== undefined && r.sellingPrice !== null ? Number(r.sellingPrice) : null;
    const salesValue = price !== null ? Number((salesLitres * price).toFixed(2)) : 0;

    totalFuelLitres += salesLitres;
    totalSalesValue += salesValue;

    return {
      id: r.id || generateId('read'),
      dailyEntryId,
      date,
      nozzleId: r.nozzleId,
      machineId: r.machineId,
      productId: r.productId,
      nozzleName: r.nozzleName || '',
      productName: r.productName || '',
      machineName: r.machineName || '',
      openingReading: opening,
      closingReading: closing,
      salesLitres,
      sellingPrice: price,
      salesValue,
      isDemo: Boolean(isDemo),
      updatedAt: now,
    };
  });

  totalFuelLitres = Number(totalFuelLitres.toFixed(2));
  totalSalesValue = Number(totalSalesValue.toFixed(2));

  // 3. Process Collections (linked to collection groups - Cash, UPI, Card, Paytm, Other ONLY. Udhaar is NOT a collection mode)
  let totalCollections = 0;
  let cashCollected = 0;
  const processedCollections = collections
    .filter(c => c.paymentMode !== 'Udhaar')
    .map(c => {
      const amt = Number(c.amount) || 0;
      totalCollections += amt;
      if (c.paymentMode === 'Cash') cashCollected += amt;

      return {
        id: c.id || generateId('col'),
        dailyEntryId,
        collectionGroupId: c.collectionGroupId || null,
        date,
        paymentMode: c.paymentMode,
        amount: amt,
        customerId: c.customerId || null,
        customerName: c.customerName || '',
        remarks: c.remarks ? c.remarks.trim() : '',
        isDemo: Boolean(isDemo),
        updatedAt: now,
      };
    });

  totalCollections = Number(totalCollections.toFixed(2));
  cashCollected = Number(cashCollected.toFixed(2));

  // 4. Process Udhaar / Credit Sales (Separate transaction entity)
  let totalUdhaar = 0;
  const processedUdhaarSales = udhaarSales.map(u => {
    const qty = Number(u.quantity) || 0;
    const applicableRate = (u.rate !== undefined && u.rate !== null && u.rate !== '')
      ? Number(u.rate)
      : (getApplicablePrice(u.productId, date)?.sellingPrice || 0);
    const amt = (u.amount !== undefined && u.amount !== null && u.amount !== '')
      ? Number(u.amount)
      : Number((qty * applicableRate).toFixed(2));

    totalUdhaar += amt;
    const cust = getCustomer(u.customerId);
    const prod = getProduct(u.productId);

    return {
      id: u.id || generateId('udh'),
      dailyEntryId,
      date,
      customerId: u.customerId,
      customerName: u.customerName || cust?.name || 'Customer',
      machineId: u.machineId || '',
      salesmanId: u.salesmanId || '',
      productId: u.productId || '',
      productName: u.productName || prod?.name || '',
      quantity: qty,
      rate: applicableRate,
      amount: amt,
      collectionGroupId: u.collectionGroupId || null,
      remarks: u.remarks ? u.remarks.trim() : '',
      isDemo: Boolean(isDemo),
      updatedAt: now,
      createdAt: u.createdAt || now,
    };
  });

  totalUdhaar = Number(totalUdhaar.toFixed(2));

  // 5. Process Cash Deposits (linked to collection groups)
  let totalCashDeposited = 0;
  const processedDeposits = cashDeposits.map(d => {
    const amt = Number(d.amount) || 0;
    totalCashDeposited += amt;

    return {
      id: d.id || generateId('dep'),
      dailyEntryId,
      collectionGroupId: d.collectionGroupId || null,
      date,
      amount: amt,
      salesmanId: d.salesmanId || null,
      salesmanName: d.salesmanName || '',
      time: d.time || '',
      reference: d.reference ? d.reference.trim() : '',
      isDemo: Boolean(isDemo),
      updatedAt: now,
    };
  });

  totalCashDeposited = Number(totalCashDeposited.toFixed(2));

  // 6. Process Expenses (operating expenses with paymentSource)
  let totalExpenses = 0;
  let totalCashExpenses = 0;
  const processedExpenses = expenses.map(e => {
    const amt = Number(e.amount) || 0;
    const paymentSource = e.paymentSource || 'Cash';
    totalExpenses += amt;
    if (paymentSource === 'Cash') {
      totalCashExpenses += amt;
    }

    return {
      id: e.id || generateId('exp-txn'),
      dailyEntryId,
      date,
      categoryId: e.categoryId,
      categoryName: e.categoryName || '',
      amount: amt,
      paymentSource,
      collectionGroupId: e.collectionGroupId || null,
      remarks: e.remarks ? e.remarks.trim() : '',
      isDemo: Boolean(isDemo),
      updatedAt: now,
    };
  });

  totalExpenses = Number(totalExpenses.toFixed(2));
  totalCashExpenses = Number(totalCashExpenses.toFixed(2));

  // 7. Process Other Payments & Advances (Money Movements: not operating expenses!)
  let totalMoneyMovements = 0;
  let totalOtherCashPayments = 0;
  const processedMovements = moneyMovements.map(m => {
    const amt = Number(m.amount) || 0;
    const paymentSource = m.paymentSource || 'Cash';
    totalMoneyMovements += amt;
    if (paymentSource === 'Cash') {
      totalOtherCashPayments += amt;
    }

    return {
      id: m.id || generateId('mov'),
      dailyEntryId,
      date,
      type: m.type || 'Other Payment',
      payeeId: m.payeeId || null,
      payeeName: m.payeeName ? m.payeeName.trim() : '',
      amount: amt,
      paymentSource,
      collectionGroupId: m.collectionGroupId || null,
      remarks: m.remarks ? m.remarks.trim() : '',
      isDemo: Boolean(isDemo),
      updatedAt: now,
    };
  });

  totalMoneyMovements = Number(totalMoneyMovements.toFixed(2));
  totalOtherCashPayments = Number(totalOtherCashPayments.toFixed(2));

  // Cash Remaining Formula:
  // Cash Collected - Cash Deposited - Cash Expenses (paid by cash) - Other Cash Payments (paid by cash)
  // Never subtract UPI, Card, Paytm, or Udhaar from physical cash.
  const cashRemaining = Number((cashCollected - totalCashDeposited - totalCashExpenses - totalOtherCashPayments).toFixed(2));

  // Core Reconciliation Formula:
  // Meter Sales = Total Collected + Total Udhaar
  // Reconciled Sales = Total Collected + Total Udhaar
  // Difference = Meter Sales Value - Reconciled Sales
  const reconciledSales = Number((totalCollections + totalUdhaar).toFixed(2));
  const reconciliationDifference = Number((totalSalesValue - reconciledSales).toFixed(2));
  const reconciliationStatus = Math.abs(reconciliationDifference) < 0.01 ? 'matched' : 'difference';

  const entryRecord = {
    id: dailyEntryId,
    date,
    status: status === 'completed' ? 'completed' : 'draft',
    isDemo: Boolean(isDemo),
    totalFuelLitres,
    totalSalesValue,
    totalCollections,
    totalUdhaar,
    reconciledSales,
    cashCollected,
    totalCashDeposited,
    totalExpenses,
    totalCashExpenses,
    totalMoneyMovements,
    totalOtherCashPayments,
    cashRemaining,
    reconciliationDifference,
    reconciliationStatus,
    updatedAt: now,
    createdAt: existingIndex !== -1 ? data.operations.dailyEntries[existingIndex].createdAt : now,
  };

  // Edit trail kept on the day itself (survives backup / restore)
  const priorLog = Array.isArray(existingRecord?.editLog) ? existingRecord.editLog : [];
  if (needsReason) {
    priorLog.push({
      at: now,
      reason: reasonText,
      previousStatus: existingRecord?.status ?? 'new',
      salesBefore: existingRecord ? Number(existingRecord.totalSalesValue) || 0 : 0,
      salesAfter: totalSalesValue,
      cashBefore: existingRecord ? Number(existingRecord.cashRemaining) || 0 : 0,
      cashAfter: cashRemaining,
    });
  }
  if (priorLog.length > 0) {
    entryRecord.editLog = priorLog;
    entryRecord.isEdited = true;
    entryRecord.lastEditedAt = priorLog[priorLog.length - 1].at;
    entryRecord.lastEditReason = priorLog[priorLog.length - 1].reason;
  }

  if (existingIndex !== -1) {
    data.operations.dailyEntries[existingIndex] = entryRecord;
  } else {
    data.operations.dailyEntries.push(entryRecord);
  }

  // Atomically replace child transactions for this dailyEntryId
  data.operations.collectionGroups = [
    ...data.operations.collectionGroups.filter(g => g.dailyEntryId !== dailyEntryId),
    ...processedGroups,
  ];

  data.operations.meterReadings = [
    ...data.operations.meterReadings.filter(r => r.dailyEntryId !== dailyEntryId),
    ...processedReadings,
  ];

  data.operations.collections = [
    ...data.operations.collections.filter(c => c.dailyEntryId !== dailyEntryId),
    ...processedCollections,
  ];

  data.operations.udhaarSales = [
    ...(data.operations.udhaarSales || []).filter(u => u.dailyEntryId !== dailyEntryId),
    ...processedUdhaarSales,
  ];

  data.operations.cashDeposits = [
    ...data.operations.cashDeposits.filter(d => d.dailyEntryId !== dailyEntryId),
    ...processedDeposits,
  ];

  data.operations.expenses = [
    ...data.operations.expenses.filter(e => e.dailyEntryId !== dailyEntryId),
    ...processedExpenses,
  ];

  data.operations.moneyMovements = [
    ...data.operations.moneyMovements.filter(m => m.dailyEntryId !== dailyEntryId),
    ...processedMovements,
  ];

  setData(data);

  if (needsReason) {
    const last = priorLog[priorLog.length - 1];
    addAuditLog({
      date,
      module: 'Daily Entry',
      action: existingRecord ? 'Edited' : 'Added late',
      reason: reasonText,
      summary: `Sales ₹${last.salesBefore.toLocaleString('en-IN')} → ₹${last.salesAfter.toLocaleString('en-IN')}; cash ₹${last.cashBefore.toLocaleString('en-IN')} → ₹${last.cashAfter.toLocaleString('en-IN')}`,
    });
  }

  return {
    dailyEntry: entryRecord,
    collectionGroups: processedGroups,
    meterReadings: processedReadings,
    collections: processedCollections,
    udhaarSales: processedUdhaarSales,
    cashDeposits: processedDeposits,
    expenses: processedExpenses,
    moneyMovements: processedMovements,
  };
}

export function deleteDailyEntry(id, reason = '') {
  const data = getData();
  if (!data.operations) return;

  const target = (data.operations.dailyEntries || []).find(e => e.id === id);
  if (target && !target.isDemo && dailyEntryNeedsReason(target.date, target.status) && String(reason).trim().length < 5) {
    const err = new Error('A reason (at least 5 characters) is required to delete a past or completed day.');
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  data.operations.dailyEntries = data.operations.dailyEntries.filter(e => e.id !== id);
  data.operations.collectionGroups = (data.operations.collectionGroups || []).filter(g => g.dailyEntryId !== id);
  data.operations.meterReadings = data.operations.meterReadings.filter(r => r.dailyEntryId !== id);
  data.operations.collections = data.operations.collections.filter(c => c.dailyEntryId !== id);
  data.operations.udhaarSales = (data.operations.udhaarSales || []).filter(u => u.dailyEntryId !== id);
  data.operations.cashDeposits = data.operations.cashDeposits.filter(d => d.dailyEntryId !== id);
  data.operations.expenses = data.operations.expenses.filter(e => e.dailyEntryId !== id);
  data.operations.moneyMovements = (data.operations.moneyMovements || []).filter(m => m.dailyEntryId !== id);

  setData(data);
  if (target) {
    addAuditLog({
      date: target.date,
      module: 'Daily Entry',
      action: 'Deleted',
      reason,
      summary: `Deleted ${target.status} day with sales ₹${(Number(target.totalSalesValue) || 0).toLocaleString('en-IN')}`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO / TEST DATA MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export function hasDemoData() {
  const data = getData();
  if (!data) return false;
  const hasOps = data.operations?.dailyEntries?.some(e => e.isDemo);
  const hasCust = data.masters?.customers?.some(c => c.isDemo);
  const hasSal = data.masters?.salesmen?.some(s => s.isDemo);
  return Boolean(hasOps || hasCust || hasSal);
}

export function loadDemoData() {
  // Check if demo data already loaded
  if (hasDemoData()) {
    removeDemoData();
  }

  const curData = getData();
  if (curData?.settings) {
    curData.settings.demoDataCleared = false;
    setData(curData);
  }

  const now = new Date();
  const d1 = new Date(now); d1.setDate(now.getDate() - 2); const date1 = localDate(d1);
  const d2 = new Date(now); d2.setDate(now.getDate() - 1); const date2 = localDate(d2);
  const d3 = new Date(now); const date3 = localDate(d3);

  const machines = getMachines();
  const nozzles = getActiveNozzles();
  const products = getProducts();
  const expCategories = getActiveExpenseCategories();

  // ── DEMO MASTERS ──────────────────────────────────────────────────────────
  // 1. Customers
  let demoCustomer1 = createCustomer({
    name: 'Demo Customer - Jaipur Golden Transport',
    mobile: '9829099881',
    address: 'Industrial Area Phase 2, Jaipur',
    creditLimit: 500000,
    openingBalance: 12500,
    remarks: 'Fleet of 15 heavy commercial trucks',
    isDemo: true,
  });

  let demoCustomer2 = createCustomer({
    name: 'Demo Customer - Marwar Freight Carriers',
    mobile: '9829088776',
    address: 'Plot 44, Transport Nagar, Jodhpur',
    creditLimit: 300000,
    openingBalance: 8000,
    remarks: 'Container trailers fleet',
    isDemo: true,
  });

  let demoCustomer3 = createCustomer({
    name: 'Demo Customer - Shree Ram Highway Bus Service',
    mobile: '9829044332',
    address: 'NH-8 Bypass Stop, Ajmer',
    creditLimit: 250000,
    openingBalance: 0,
    remarks: 'Interstate passenger coach operator',
    isDemo: true,
  });

  // 2. Suppliers
  let demoSupplier1 = createSupplier({
    name: 'Indian Oil Corporation Ltd (Sanganer Terminal)',
    mobile: '0141-2789000',
    remarks: 'Primary oil terminal depot',
    isDemo: true,
  });

  let demoSupplier2 = createSupplier({
    name: 'Castrol India Regional Distributors',
    mobile: '9829055443',
    remarks: 'Authorized lubricant depot Jaipur',
    isDemo: true,
  });

  // 3. Attendants / Salesmen
  let demoSalesman1 = createSalesman({
    name: 'Demo Attendant Suresh',
    mobile: '9876543299',
    joiningDate: '2026-01-01',
    remarks: 'Forecourt attendant',
    isDemo: true,
  });

  let demoSalesman2 = createSalesman({
    name: 'Demo Attendant Vikram Singh',
    mobile: '9876508811',
    joiningDate: '2025-08-01',
    remarks: 'Senior pump operator',
    isDemo: true,
  });

  const getPrice = (prodId, dt) => getApplicablePrice(prodId, dt)?.sellingPrice || (prodId === 'prod-1' ? 101.50 : prodId === 'prod-2' ? 89.80 : 105.20);

  // ── DAY 1 (2 Days Ago): PERFECT ZERO VARIANCE RECONCILIATION ──────────────
  // Forecourt Setup:
  // Group A: Machine 1 + Machine 2 (Staff: Rajesh Kumar & Suresh)
  // Group B: Machine 3 (Staff: Sunil Verma)
  const grpA1Id = 'grp-demo-d1-a';
  const grpB1Id = 'grp-demo-d1-b';

  // Underground Tank Inward Delivery (Decanting)
  createFuelReceipt({
    date: date1,
    productId: 'prod-2', // Diesel
    quantity: 12000,
    supplierName: demoSupplier1.name,
    reference: 'TT-TANKER-9041',
    remarks: 'Decanted into Tank 2 (Diesel) - Density 832.0 @ 15°C',
    isDemo: true,
  });

  createFuelReceipt({
    date: date1,
    productId: 'prod-1', // Petrol
    quantity: 8000,
    supplierName: demoSupplier1.name,
    reference: 'TT-TANKER-9042',
    remarks: 'Decanted into Tank 1 (Petrol) - Density 742.5 @ 15°C',
    isDemo: true,
  });

  // Inward Lubricant Stock
  createLubricantPurchase({
    date: date1,
    lubricantId: 'lube-1', // Castrol GTX
    quantity: 24,
    purchaseRate: 380,
    supplierId: demoSupplier2.id,
    supplierName: demoSupplier2.name,
    reference: 'INV-CAS-8821',
    remarks: 'Case of 24x1L received',
    isDemo: true,
  });

  createLubricantPurchase({
    date: date1,
    lubricantId: 'lube-2', // Servo Pride
    quantity: 12,
    purchaseRate: 1550,
    supplierId: demoSupplier1.id,
    supplierName: demoSupplier1.name,
    reference: 'INV-SRV-4011',
    remarks: '12x5L buckets received',
    isDemo: true,
  });

  // Nozzle Meter Readings
  const day1NozzleReadings = nozzles.map((n, i) => {
    const prod = products.find(p => p.id === n.productId);
    const mach = machines.find(m => m.id === n.machineId);
    const price = getPrice(n.productId, date1);

    const baseOpening = 10000 + (i * 2500);
    const salesLitres = prod?.name.includes('Speed') ? 85.50 : prod?.name.includes('Petrol') ? 165.25 : 240.75;
    const closing = Number((baseOpening + salesLitres).toFixed(2));

    return {
      nozzleId: n.id,
      machineId: n.machineId,
      productId: n.productId,
      nozzleName: n.name,
      productName: prod?.name || '',
      machineName: mach?.name || '',
      openingReading: baseOpening,
      closingReading: closing,
      salesLitres,
      sellingPrice: price,
      salesValue: Number((salesLitres * price).toFixed(2)),
    };
  });

  const m1Readings1 = day1NozzleReadings.filter(r => r.machineId === 'mach-1');
  const m2Readings1 = day1NozzleReadings.filter(r => r.machineId === 'mach-2');
  const m3Readings1 = day1NozzleReadings.filter(r => r.machineId === 'mach-3');

  const grpA1Sales = Number((
    m1Readings1.reduce((sum, r) => sum + r.salesValue, 0) +
    m2Readings1.reduce((sum, r) => sum + r.salesValue, 0)
  ).toFixed(2));

  const grpB1Sales = Number(m3Readings1.reduce((sum, r) => sum + r.salesValue, 0).toFixed(2));

  // Udhaar on Day 1 in Group A
  const day1Udhaar = 17960; // 200 L Diesel @ 89.80
  const grpA1Rem = Number((grpA1Sales - day1Udhaar).toFixed(2));
  const grpA1Cash = Math.round(grpA1Rem * 0.55);
  const grpA1Card = 20000;
  const grpA1UPI = Number((grpA1Rem - grpA1Cash - grpA1Card).toFixed(2));

  // Group B (All collections, zero Udhaar)
  const grpB1Cash = Math.round(grpB1Sales * 0.45);
  const grpB1UPI = Number((grpB1Sales - grpB1Cash).toFixed(2));

  saveDailyEntry({
    date: date1,
    status: 'completed',
    isDemo: true,
    collectionGroups: [
      { id: grpA1Id, name: 'Group A', machineIds: ['mach-1', 'mach-2'], salesmanIds: ['sal-1', demoSalesman1.id], paymentMethods: ['Cash', 'UPI', 'Card'] },
      { id: grpB1Id, name: 'Group B', machineIds: ['mach-3'], salesmanIds: ['sal-3'], paymentMethods: ['Cash', 'UPI'] },
    ],
    meterReadings: day1NozzleReadings,
    collections: [
      { collectionGroupId: grpA1Id, paymentMode: 'Cash', amount: grpA1Cash, remarks: 'Cash collected at Forecourt A' },
      { collectionGroupId: grpA1Id, paymentMode: 'UPI', amount: grpA1UPI, remarks: 'PhonePe/GPay QR payments' },
      { collectionGroupId: grpA1Id, paymentMode: 'Card', amount: grpA1Card, remarks: 'POS machine card settlements' },
      { collectionGroupId: grpB1Id, paymentMode: 'Cash', amount: grpB1Cash, remarks: 'Cash collected at Machine 3' },
      { collectionGroupId: grpB1Id, paymentMode: 'UPI', amount: grpB1UPI, remarks: 'QR payments at Machine 3' },
    ],
    udhaarSales: [
      {
        collectionGroupId: grpA1Id,
        customerId: demoCustomer1.id,
        customerName: demoCustomer1.name,
        productId: 'prod-2',
        productName: 'Diesel',
        quantity: 200,
        rate: 89.80,
        amount: day1Udhaar,
        remarks: 'Slip #401 - RJ-14-GH-1020 (Freight truck diesel credit)',
      },
    ],
    cashDeposits: [
      { collectionGroupId: grpA1Id, amount: grpA1Cash - 8000, salesmanId: 'sal-1', salesmanName: 'Rajesh Kumar', time: '14:30', reference: 'Mid-Day SBI Bank CDM Drop #101' },
      { collectionGroupId: grpB1Id, amount: grpB1Cash, salesmanId: 'sal-3', salesmanName: 'Sunil Verma', time: '21:00', reference: 'Night Locker Deposit #102' },
    ],
    expenses: [
      { categoryId: expCategories[4]?.id || 'exp-5', categoryName: 'Tea/Water', amount: 350, paymentSource: 'Cash', collectionGroupId: grpA1Id, remarks: 'Forecourt attendant tea' },
      { categoryId: expCategories[3]?.id || 'exp-4', categoryName: 'Cleaning', amount: 250, paymentSource: 'Cash', collectionGroupId: grpA1Id, remarks: 'Floor cleaner & wipers' },
      { categoryId: expCategories[7]?.id || 'exp-8', categoryName: 'Miscellaneous', amount: 450, paymentSource: 'Cash', collectionGroupId: grpA1Id, remarks: 'Thermal receipt paper rolls' },
    ],
    moneyMovements: [],
  });

  // Physical Dip for Day 1
  saveFuelDip({
    date: date1,
    productId: 'prod-1',
    physicalDipLitres: 18200,
    remarks: 'Daily closing physical dip - Tank 1 (Petrol)',
    isDemo: true,
  });

  saveFuelDip({
    date: date1,
    productId: 'prod-2',
    physicalDipLitres: 28450,
    remarks: 'Daily closing physical dip - Tank 2 (Diesel)',
    isDemo: true,
  });

  // Lubricant Sale on Day 1
  createLubricantSale({
    date: date1,
    lubricantId: 'lube-1',
    quantity: 2,
    sellingPrice: 460,
    amount: 920,
    paymentMode: 'Cash',
    remarks: 'Engine oil 2x1L sold to Maruti Swift customer',
    isDemo: true,
  });

  // ── DAY 2 (Yesterday): RECONCILIATION WITH REALISTIC SHIFT SHORTAGE ───────
  // Operational Setup:
  // Group A: Machine 1 (Staff: Rajesh Kumar)
  // Group B: Machine 2 + Machine 3 (Staff: Amit Sharma & Sunil Verma)
  const grpA2Id = 'grp-demo-d2-a';
  const grpB2Id = 'grp-demo-d2-b';

  // Customer Payment received
  createCustomerPayment({
    date: date2,
    customerId: demoCustomer1.id,
    amount: 25000,
    paymentMode: 'UPI',
    reference: 'UPI/HDFC/992014',
    remarks: 'Account clearance against pending bills',
    isDemo: true,
  });

  // Nozzle Readings (Opening = Day 1 Closing)
  const day2NozzleReadings = nozzles.map((n, i) => {
    const prod = products.find(p => p.id === n.productId);
    const mach = machines.find(m => m.id === n.machineId);
    const price = getPrice(n.productId, date2);

    const day1Closing = day1NozzleReadings[i].closingReading;
    const salesLitres = prod?.name.includes('Speed') ? 92.00 : prod?.name.includes('Petrol') ? 178.50 : 255.00;
    const closing = Number((day1Closing + salesLitres).toFixed(2));

    return {
      nozzleId: n.id,
      machineId: n.machineId,
      productId: n.productId,
      nozzleName: n.name,
      productName: prod?.name || '',
      machineName: mach?.name || '',
      openingReading: day1Closing,
      closingReading: closing,
      salesLitres,
      sellingPrice: price,
      salesValue: Number((salesLitres * price).toFixed(2)),
    };
  });

  const m1Readings2 = day2NozzleReadings.filter(r => r.machineId === 'mach-1');
  const m2Readings2 = day2NozzleReadings.filter(r => r.machineId === 'mach-2');
  const m3Readings2 = day2NozzleReadings.filter(r => r.machineId === 'mach-3');

  const grpA2Sales = Number(m1Readings2.reduce((sum, r) => sum + r.salesValue, 0).toFixed(2));
  const grpB2Sales = Number((
    m2Readings2.reduce((sum, r) => sum + r.salesValue, 0) +
    m3Readings2.reduce((sum, r) => sum + r.salesValue, 0)
  ).toFixed(2));

  // Udhaar on Day 2 in Group B:
  const day2Udhaar1 = 22450; // 250 L Diesel @ 89.80 to Marwar Freight
  const day2Udhaar2 = 16164; // 180 L Diesel @ 89.80 to Shree Ram Bus
  const totalDay2Udhaar = Number((day2Udhaar1 + day2Udhaar2).toFixed(2));

  // Group A (Machine 1): exact match
  const grpA2Cash = Math.round(grpA2Sales * 0.50);
  const grpA2UPI = Number((grpA2Sales - grpA2Cash).toFixed(2));

  // Group B (Machine 2 & 3): slight realistic -₹200 attendant coin shortage
  const grpB2Target = Number((grpB2Sales - totalDay2Udhaar - 200).toFixed(2));
  const grpB2Cash = Math.round(grpB2Target * 0.55);
  const grpB2Card = 20000;
  const grpB2UPI = Number((grpB2Target - grpB2Cash - grpB2Card).toFixed(2));

  saveDailyEntry({
    date: date2,
    status: 'completed',
    isDemo: true,
    collectionGroups: [
      { id: grpA2Id, name: 'Group A', machineIds: ['mach-1'], salesmanIds: ['sal-1'], paymentMethods: ['Cash', 'UPI'] },
      { id: grpB2Id, name: 'Group B', machineIds: ['mach-2', 'mach-3'], salesmanIds: ['sal-2', 'sal-3'], paymentMethods: ['Cash', 'Card', 'UPI'] },
    ],
    meterReadings: day2NozzleReadings,
    collections: [
      { collectionGroupId: grpA2Id, paymentMode: 'Cash', amount: grpA2Cash, remarks: 'Cash at Machine 1' },
      { collectionGroupId: grpA2Id, paymentMode: 'UPI', amount: grpA2UPI, remarks: 'QR payments at Machine 1' },
      { collectionGroupId: grpB2Id, paymentMode: 'Cash', amount: grpB2Cash, remarks: 'Cash at Machine 2 & 3 (-₹200 shift coin shortage)' },
      { collectionGroupId: grpB2Id, paymentMode: 'Card', amount: grpB2Card, remarks: 'Card POS swipe settlements' },
      { collectionGroupId: grpB2Id, paymentMode: 'UPI', amount: grpB2UPI, remarks: 'QR collections' },
    ],
    udhaarSales: [
      {
        collectionGroupId: grpB2Id,
        customerId: demoCustomer2.id,
        customerName: demoCustomer2.name,
        productId: 'prod-2',
        productName: 'Diesel',
        quantity: 250,
        rate: 89.80,
        amount: day2Udhaar1,
        remarks: 'Slip #402 - RJ-19-EA-5544 (Container trailer diesel credit)',
      },
      {
        collectionGroupId: grpB2Id,
        customerId: demoCustomer3.id,
        customerName: demoCustomer3.name,
        productId: 'prod-2',
        productName: 'Diesel',
        quantity: 180,
        rate: 89.80,
        amount: day2Udhaar2,
        remarks: 'Slip #403 - RJ-14-PB-3311 (Interstate bus diesel credit)',
      },
    ],
    cashDeposits: [
      { collectionGroupId: grpA2Id, amount: grpA2Cash, salesmanId: 'sal-1', salesmanName: 'Rajesh Kumar', time: '20:30', reference: 'Bank Deposit Slip #103' },
      { collectionGroupId: grpB2Id, amount: grpB2Cash - 4000, salesmanId: 'sal-2', salesmanName: 'Amit Sharma', time: '21:00', reference: 'Night Locker Deposit #104' },
    ],
    expenses: [
      { categoryId: expCategories[4]?.id || 'exp-5', categoryName: 'Tea/Water', amount: 380, paymentSource: 'Cash', collectionGroupId: grpB2Id, remarks: 'Attendant refreshments' },
      { categoryId: expCategories[2]?.id || 'exp-3', categoryName: 'Maintenance', amount: 850, paymentSource: 'Cash', collectionGroupId: grpB2Id, remarks: 'Air compressor valve washer replacement' },
      { categoryId: expCategories[1]?.id || 'exp-2', categoryName: 'Electricity', amount: 3200, paymentSource: 'UPI', collectionGroupId: grpA2Id, remarks: 'Electricity bill paid via station bank QR' },
    ],
    moneyMovements: [],
  });

  // Physical Dip for Day 2
  saveFuelDip({
    date: date2,
    productId: 'prod-1',
    physicalDipLitres: 17400,
    remarks: 'Physical dip measurement - Tank 1 (Petrol)',
    isDemo: true,
  });

  saveFuelDip({
    date: date2,
    productId: 'prod-2',
    physicalDipLitres: 26100,
    remarks: 'Physical dip measurement - Tank 2 (Diesel)',
    isDemo: true,
  });

  // Lubricant Sale on Day 2
  createLubricantSale({
    date: date2,
    lubricantId: 'lube-2',
    quantity: 1,
    sellingPrice: 1850,
    amount: 1850,
    paymentMode: 'UPI',
    remarks: '5L bucket sold to Tata 407 driver',
    isDemo: true,
  });

  // ── DAY 3 (Today): FULL OPERATIONS WITH UDHAAR, ADVANCE & LIVE STATUS ─────
  // Forecourt Setup:
  // Group A: Machine 1 + Machine 2 (Staff: Rajesh Kumar & Suresh)
  // Group B: Machine 3 (Staff: Sunil Verma)
  const grpA3Id = 'grp-demo-d3-a';
  const grpB3Id = 'grp-demo-d3-b';

  // Tanker Decanting on Day 3 (Speed Petrol into Tank 3)
  createFuelReceipt({
    date: date3,
    productId: 'prod-3', // Speed Petrol
    quantity: 5000,
    supplierName: demoSupplier1.name,
    reference: 'TT-TANKER-9105',
    remarks: 'Decanted into Tank 3 (Speed Petrol) - Density 745.0',
    isDemo: true,
  });

  // Customer Payment on Day 3
  createCustomerPayment({
    date: date3,
    customerId: demoCustomer2.id,
    amount: 15000,
    paymentMode: 'Card',
    reference: 'CHQ-SBI-440192',
    remarks: 'Cheque clearance against diesel billing',
    isDemo: true,
  });

  // Nozzle Readings (Opening = Day 2 Closing)
  const day3NozzleReadings = nozzles.map((n, i) => {
    const prod = products.find(p => p.id === n.productId);
    const mach = machines.find(m => m.id === n.machineId);
    const price = getPrice(n.productId, date3);

    const day2Closing = day2NozzleReadings[i].closingReading;
    const salesLitres = prod?.name.includes('Speed') ? 110.20 : prod?.name.includes('Petrol') ? 195.40 : 280.80;
    const closing = Number((day2Closing + salesLitres).toFixed(2));

    return {
      nozzleId: n.id,
      machineId: n.machineId,
      productId: n.productId,
      nozzleName: n.name,
      productName: prod?.name || '',
      machineName: mach?.name || '',
      openingReading: day2Closing,
      closingReading: closing,
      salesLitres,
      sellingPrice: price,
      salesValue: Number((salesLitres * price).toFixed(2)),
    };
  });

  const m1Readings3 = day3NozzleReadings.filter(r => r.machineId === 'mach-1');
  const m2Readings3 = day3NozzleReadings.filter(r => r.machineId === 'mach-2');
  const m3Readings3 = day3NozzleReadings.filter(r => r.machineId === 'mach-3');

  const grpA3Sales = Number((
    m1Readings3.reduce((sum, r) => sum + r.salesValue, 0) +
    m2Readings3.reduce((sum, r) => sum + r.salesValue, 0)
  ).toFixed(2));

  const grpB3Sales = Number(m3Readings3.reduce((sum, r) => sum + r.salesValue, 0).toFixed(2));

  // Udhaar on Day 3 (Group A):
  const day3Udhaar1 = 26940; // 300 L Diesel @ 89.80 to Jaipur Golden Transport
  const day3Udhaar2 = 5075;  // 50 L Petrol @ 101.50 to ABC Transport Ltd
  const totalDay3Udhaar = Number((day3Udhaar1 + day3Udhaar2).toFixed(2));

  // Group A collections:
  const grpA3Rem = Number((grpA3Sales - totalDay3Udhaar).toFixed(2));
  const grpA3Cash = Math.round(grpA3Rem * 0.52);
  const grpA3Card = 20000;
  const grpA3UPI = Number((grpA3Rem - grpA3Cash - grpA3Card).toFixed(2));

  // Group B collections:
  const grpB3Cash = Math.round(grpB3Sales * 0.55);
  const grpB3Paytm = Number((grpB3Sales - grpB3Cash).toFixed(2));

  saveDailyEntry({
    date: date3,
    status: 'completed',
    isDemo: true,
    collectionGroups: [
      { id: grpA3Id, name: 'Group A', machineIds: ['mach-1', 'mach-2'], salesmanIds: ['sal-1', demoSalesman1.id], paymentMethods: ['Cash', 'UPI', 'Card'] },
      { id: grpB3Id, name: 'Group B', machineIds: ['mach-3'], salesmanIds: ['sal-3'], paymentMethods: ['Cash', 'Paytm'] },
    ],
    meterReadings: day3NozzleReadings,
    collections: [
      { collectionGroupId: grpA3Id, paymentMode: 'Cash', amount: grpA3Cash, remarks: 'Cash collected at Forecourt A' },
      { collectionGroupId: grpA3Id, paymentMode: 'UPI', amount: grpA3UPI, remarks: 'QR collections' },
      { collectionGroupId: grpA3Id, paymentMode: 'Card', amount: grpA3Card, remarks: 'POS card swipes' },
      { collectionGroupId: grpB3Id, paymentMode: 'Cash', amount: grpB3Cash, remarks: 'Cash collected at Machine 3' },
      { collectionGroupId: grpB3Id, paymentMode: 'Paytm', amount: grpB3Paytm, remarks: 'Paytm soundbox QR collections' },
    ],
    udhaarSales: [
      {
        collectionGroupId: grpA3Id,
        customerId: demoCustomer1.id,
        customerName: demoCustomer1.name,
        productId: 'prod-2',
        productName: 'Diesel',
        quantity: 300,
        rate: 89.80,
        amount: day3Udhaar1,
        remarks: 'Slip #404 - RJ-14-GA-9002 (Freight truck diesel credit)',
      },
      {
        collectionGroupId: grpA3Id,
        customerId: 'cust-1',
        customerName: 'ABC Transport Ltd',
        productId: 'prod-1',
        productName: 'Petrol',
        quantity: 50,
        rate: 101.50,
        amount: day3Udhaar2,
        remarks: 'Slip #405 - RJ-14-CY-7788 (Manager car fueling)',
      },
    ],
    cashDeposits: [
      { collectionGroupId: grpA3Id, amount: 80000, salesmanId: demoSalesman1.id, salesmanName: demoSalesman1.name, time: '14:00', reference: 'Mid-Day Cash Van Drop #105' },
      { collectionGroupId: grpB3Id, amount: 40000, salesmanId: 'sal-3', salesmanName: 'Sunil Verma', time: '21:30', reference: 'Night Locker Deposit #106' },
    ],
    expenses: [
      { categoryId: expCategories[2]?.id || 'exp-3', categoryName: 'Maintenance', amount: 600, paymentSource: 'Cash', collectionGroupId: grpA3Id, remarks: 'Nozzle pipe washer repair' },
      { categoryId: expCategories[4]?.id || 'exp-5', categoryName: 'Tea/Water', amount: 520, paymentSource: 'Cash', collectionGroupId: grpB3Id, remarks: 'Attendant lunch & refreshments' },
      { categoryId: expCategories[7]?.id || 'exp-8', categoryName: 'Miscellaneous', amount: 300, paymentSource: 'Card', collectionGroupId: grpA3Id, remarks: 'Paper rolls swipe' },
    ],
    moneyMovements: [
      {
        type: 'Employee Advance',
        payeeId: demoSalesman1.id,
        payeeName: demoSalesman1.name,
        amount: 2000,
        paymentSource: 'Cash',
        collectionGroupId: grpA3Id,
        remarks: 'Emergency family advance approved by manager',
      },
    ],
  });

  // Physical Dips on Day 3
  saveFuelDip({
    date: date3,
    productId: 'prod-1',
    physicalDipLitres: 16650,
    remarks: 'Evening dip tape test by shift manager - Tank 1',
    isDemo: true,
  });

  saveFuelDip({
    date: date3,
    productId: 'prod-2',
    physicalDipLitres: 23800,
    remarks: 'Evening dip tape test by shift manager - Tank 2',
    isDemo: true,
  });

  saveFuelDip({
    date: date3,
    productId: 'prod-3',
    physicalDipLitres: 11200,
    remarks: 'Evening dip tape test by shift manager - Tank 3',
    isDemo: true,
  });

  // Lubricant Sales on Day 3
  createLubricantSale({
    date: date3,
    lubricantId: 'lube-1',
    quantity: 1,
    sellingPrice: 460,
    amount: 460,
    paymentMode: 'Cash',
    remarks: 'Car engine oil top-up during fueling',
    isDemo: true,
  });

  createLubricantSale({
    date: date3,
    lubricantId: 'lube-3',
    quantity: 2,
    sellingPrice: 290,
    amount: 580,
    paymentMode: 'UPI',
    remarks: 'Coolant 1L bottle sale',
    isDemo: true,
  });

  console.info('FuelEx: Loaded 3-day realistic demo operations dataset with Collection Groups, Udhaar, Inventory, and CRM.');
  return true;
}

export function removeDemoData() {
  const data = getData();
  if (!data) return;

  if (data.operations) {
    data.operations.dailyEntries = (data.operations.dailyEntries || []).filter(e => !e.isDemo);
    data.operations.collectionGroups = (data.operations.collectionGroups || []).filter(g => !g.isDemo);
    data.operations.meterReadings = (data.operations.meterReadings || []).filter(r => !r.isDemo);
    data.operations.collections = (data.operations.collections || []).filter(c => !c.isDemo);
    data.operations.cashDeposits = (data.operations.cashDeposits || []).filter(d => !d.isDemo);
    data.operations.expenses = (data.operations.expenses || []).filter(e => !e.isDemo);
    data.operations.moneyMovements = (data.operations.moneyMovements || []).filter(m => !m.isDemo);
    data.operations.udhaarSales = (data.operations.udhaarSales || []).filter(u => !u.isDemo);
    data.operations.customerPayments = (data.operations.customerPayments || []).filter(p => !p.isDemo);
    data.operations.fuelReceipts = (data.operations.fuelReceipts || []).filter(r => !r.isDemo);
    data.operations.fuelDips = (data.operations.fuelDips || []).filter(d => !d.isDemo);
    data.operations.lubricantPurchases = (data.operations.lubricantPurchases || []).filter(p => !p.isDemo);
    data.operations.lubricantSales = (data.operations.lubricantSales || []).filter(s => !s.isDemo);
    data.operations.cashCounts = (data.operations.cashCounts || []).filter(c => !c.isDemo);
    data.operations.salaryPayments = (data.operations.salaryPayments || []).filter(p => !p.isDemo);
    data.operations.advanceRecoveries = (data.operations.advanceRecoveries || []).filter(r => !r.isDemo);
  }

  if (data.masters) {
    if (data.masters.customers) {
      data.masters.customers = data.masters.customers.filter(c => !c.isDemo);
    }
    if (data.masters.salesmen) {
      data.masters.salesmen = data.masters.salesmen.filter(s => !s.isDemo);
    }
    if (data.masters.employees) {
      data.masters.employees = data.masters.employees.filter(e => !e.isDemo);
    }
    if (data.masters.suppliers) {
      data.masters.suppliers = data.masters.suppliers.filter(s => !s.isDemo);
    }
    if (data.masters.priceHistory) {
      data.masters.priceHistory = data.masters.priceHistory.filter(p => !p.isDemo);
    }
  }

  if (!data.settings) data.settings = {};
  data.settings.demoDataCleared = true;

  setData(data);
  console.info('FuelEx: Surgically removed all demo dataset records.');
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER PAYMENTS & CRM LEDGER
// ─────────────────────────────────────────────────────────────────────────────

export function getAllCustomerPayments() {
  return getData()?.operations?.customerPayments ?? [];
}

export function getCustomerPaymentsByCustomerId(customerId) {
  return getAllCustomerPayments().filter(p => p.customerId === customerId);
}

export function createCustomerPayment({
  date,
  customerId,
  amount,
  paymentMode = 'Cash',
  reference = '',
  remarks = '',
  isDemo = false,
  source = 'crm',
  dailyEntryId = null,
}) {
  const data = getData();
  const now = new Date().toISOString();
  const cust = getCustomer(customerId);
  const paymentRecord = {
    id: generateId('pay'),
    source,
    dailyEntryId,
    date,
    customerId,
    customerName: cust?.name || '',
    amount: Number(amount) || 0,
    paymentMode,
    reference: reference.trim(),
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };
  if (!data.operations.customerPayments) data.operations.customerPayments = [];
  data.operations.customerPayments.push(paymentRecord);
  setData(data);
  return paymentRecord;
}

export function getCustomerPaymentsByDate(date) {
  return getAllCustomerPayments().filter(p => p.date === date);
}

/** Money received from customers on a date. Cash goes to cash in hand, other modes go to bank. */
export function getCustomerReceiptTotals(date) {
  let cash = 0;
  let nonCash = 0;
  getCustomerPaymentsByDate(date).forEach(p => {
    const a = Number(p.amount) || 0;
    if ((p.paymentMode || 'Cash') === 'Cash') cash += a; else nonCash += a;
  });
  return { cash: Number(cash.toFixed(2)), nonCash: Number(nonCash.toFixed(2)), total: Number((cash + nonCash).toFixed(2)) };
}

export function deleteCustomerPayment(id) {
  const data = getData();
  if (!data?.operations?.customerPayments) return;
  data.operations.customerPayments = data.operations.customerPayments.filter(p => p.id !== id);
  setData(data);
}

/**
 * Outstanding = Opening Balance + Udhaar Sales - Customer Payments
 */
export function getCustomerOutstanding(customerId) {
  const cust = getCustomer(customerId);
  if (!cust) {
    return {
      outstanding: 0,
      creditLimit: 0,
      openingBalance: 0,
      totalUdhaar: 0,
      totalPayments: 0,
      valueOf() { return 0; },
      toString() { return '0'; },
    };
  }
  const opening = Number(cust.openingBalance) || 0;
  const udhaarSales = (getData()?.operations?.udhaarSales ?? [])
    .filter(u => u.customerId === customerId)
    .reduce((sum, u) => sum + (Number(u.amount) || 0), 0);
  const payments = (getData()?.operations?.customerPayments ?? [])
    .filter(p => p.customerId === customerId)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const outstanding = Number((opening + udhaarSales - payments).toFixed(2));
  const creditLimit = Number(cust.creditLimit) || 0;

  return {
    outstanding,
    creditLimit,
    openingBalance: opening,
    totalUdhaar: Number(udhaarSales.toFixed(2)),
    totalPayments: Number(payments.toFixed(2)),
    valueOf() { return this.outstanding; },
    toString() { return String(this.outstanding); },
  };
}

export function getCustomerLedger(customerId) {
  const cust = getCustomer(customerId);
  if (!cust) return { customer: { name: 'Customer', openingBalance: 0 }, entries: [], totalUdhaar: 0, totalPayments: 0, outstanding: 0 };
  const entries = [];
  const opening = Number(cust.openingBalance) || 0;
  if (opening > 0 || cust.createdAt) {
    entries.push({
      id: 'open-' + customerId,
      date: cust.createdAt ? cust.createdAt.split('T')[0] : '2026-01-01',
      type: 'opening',
      reference: 'Initial Balance',
      debit: opening,
      credit: 0,
      remarks: 'Account Opening Balance',
      timestamp: cust.createdAt || '2026-01-01T00:00:00Z',
    });
  }

  const udhaar = (getData()?.operations?.udhaarSales ?? []).filter(u => u.customerId === customerId);
  let totalUdhaar = 0;
  for (const u of udhaar) {
    const amt = Number(u.amount) || 0;
    totalUdhaar += amt;
    entries.push({
      id: u.id,
      date: u.date,
      type: 'udhaar_sale',
      productName: u.productName,
      quantity: u.quantity,
      rate: u.rate,
      reference: `${u.productName || 'Fuel'} ${u.quantity ? '(' + u.quantity + ' L)' : ''}`,
      debit: amt,
      credit: 0,
      remarks: u.remarks || '',
      timestamp: u.createdAt || u.date,
    });
  }

  const payments = (getData()?.operations?.customerPayments ?? []).filter(p => p.customerId === customerId);
  let totalPayments = 0;
  for (const p of payments) {
    const amt = Number(p.amount) || 0;
    totalPayments += amt;
    entries.push({
      id: p.id,
      date: p.date,
      type: 'payment',
      paymentMode: p.paymentMode,
      reference: `${p.paymentMode} ${p.reference ? '(' + p.reference + ')' : ''}`,
      debit: 0,
      credit: amt,
      remarks: p.remarks || '',
      timestamp: p.createdAt || p.date,
    });
  }

  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.timestamp || '').localeCompare(b.timestamp || '');
  });

  // Calculate running balance
  let running = 0;
  const runningEntries = entries.map(item => {
    running += (item.debit - item.credit);
    return {
      ...item,
      balance: Number(running.toFixed(2)),
    };
  });

  return {
    customer: cust,
    entries: runningEntries,
    totalUdhaar: Number(totalUdhaar.toFixed(2)),
    totalPayments: Number(totalPayments.toFixed(2)),
    outstanding: Number((opening + totalUdhaar - totalPayments).toFixed(2)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUEL INVENTORY & RECEIPTS & DIPS
// ─────────────────────────────────────────────────────────────────────────────

export function getAllFuelReceipts() {
  return getData()?.operations?.fuelReceipts ?? [];
}

export function createFuelReceipt({
  date,
  productId,
  quantity,
  supplierId = '',
  supplierName = '',
  reference = '',
  remarks = '',
  isDemo = false,
}) {
  const data = getData();
  const now = new Date().toISOString();
  const prod = getProduct(productId);
  const supp = supplierId ? getSupplier(supplierId) : null;
  const receipt = {
    id: generateId('rcpt'),
    date,
    productId,
    productName: prod?.name || '',
    quantity: Number(quantity) || 0,
    supplierId: supplierId || '',
    supplierName: supplierName || supp?.name || '',
    reference: reference.trim(),
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };
  if (!data.operations.fuelReceipts) data.operations.fuelReceipts = [];
  data.operations.fuelReceipts.push(receipt);
  setData(data);
  return receipt;
}

export function deleteFuelReceipt(id) {
  const data = getData();
  if (!data?.operations?.fuelReceipts) return;
  data.operations.fuelReceipts = data.operations.fuelReceipts.filter(r => r.id !== id);
  setData(data);
}

export function getAllFuelDips() {
  return getData()?.operations?.fuelDips ?? [];
}

export function saveFuelDip({
  date,
  productId,
  physicalDipLitres,
  remarks = '',
  isDemo = false,
}) {
  const data = getData();
  const now = new Date().toISOString();
  if (!data.operations.fuelDips) data.operations.fuelDips = [];
  const existingIdx = data.operations.fuelDips.findIndex(d => d.date === date && d.productId === productId);
  const dipRecord = {
    id: existingIdx !== -1 ? data.operations.fuelDips[existingIdx].id : generateId('dip'),
    date,
    productId,
    physicalDipLitres: Number(physicalDipLitres) || 0,
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    updatedAt: now,
    createdAt: existingIdx !== -1 ? data.operations.fuelDips[existingIdx].createdAt : now,
  };
  if (existingIdx !== -1) {
    data.operations.fuelDips[existingIdx] = dipRecord;
  } else {
    data.operations.fuelDips.push(dipRecord);
  }
  setData(data);
  return dipRecord;
}

// ─────────────────────────────────────────────────────────────────────────────
// TANK CAPACITIES & FUEL INITIAL STOCK
// ─────────────────────────────────────────────────────────────────────────────

export function getTankCapacities() {
  const data = getData();
  return data?.operations?.tankCapacities || { 'prod-1': 20000, 'prod-2': 30000, 'prod-3': 15000 };
}

export function updateTankCapacity(productId, capacityLitres) {
  const data = getData();
  if (!data.operations.tankCapacities) data.operations.tankCapacities = {};
  data.operations.tankCapacities[productId] = Math.max(1000, Number(capacityLitres) || 0);
  setData(data);
  return data.operations.tankCapacities;
}

export function getFuelInitialStock() {
  const data = getData();
  return data?.operations?.fuelInitialStock || { 'prod-1': 12500, 'prod-2': 18000, 'prod-3': 7500 };
}

export function updateFuelInitialStock(productId, stockLitres) {
  const data = getData();
  if (!data.operations.fuelInitialStock) data.operations.fuelInitialStock = {};
  data.operations.fuelInitialStock[productId] = Math.max(0, Number(stockLitres) || 0);
  setData(data);
  return data.operations.fuelInitialStock;
}

// User-friendly Fuel Top-Up wrappers (BPCL default)
export function getAllFuelTopUps() {
  return getAllFuelReceipts();
}

export function getFuelReceiptsByDate(date) {
  return getAllFuelReceipts().filter(r => r.date === date);
}

export function getFuelTopUpsByDate(date) {
  return getFuelReceiptsByDate(date);
}

export function createFuelTopUp({
  date,
  productId,
  quantity,
  unit = 'KL',
  supplierId = '',
  supplierName = '',
  reference = '',
  remarks = '',
  isDemo = false,
}) {
  const numQty = Number(quantity) || 0;
  const litres = unit.toUpperCase() === 'KL' ? numQty * 1000 : numQty;
  return createFuelReceipt({
    date,
    productId,
    quantity: litres,
    supplierId,
    supplierName: supplierName || 'Bharat Petroleum Corporation Ltd (BPCL)',
    reference,
    remarks,
    isDemo,
  });
}

export function deleteFuelTopUp(id) {
  return deleteFuelReceipt(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE OPENING STOCK MANAGEMENT & OVERRIDES (Phases 21 - 30)
// ─────────────────────────────────────────────────────────────────────────────

export function getOpeningStockOverrides(date = null, productId = null) {
  const data = getData();
  const list = data?.operations?.openingStockOverrides || [];
  return list.filter(o => {
    if (date && o.date !== date) return false;
    if (productId && o.productId !== productId) return false;
    return true;
  });
}

export function getOpeningStockOverride(date, productId) {
  const list = getOpeningStockOverrides(date, productId);
  return list.length > 0 ? list[0] : null;
}

export function saveOpeningStockOverride({ date, productId, quantityLitres, reason = '' }) {
  const rawQty = Number(quantityLitres);
  if (isNaN(rawQty) || rawQty < 0) {
    throw new Error('Opening stock quantity must be a non-negative number.');
  }
  if (!date || !productId) {
    throw new Error('Date and Product ID are required for opening stock override.');
  }

  const data = getData();
  if (!Array.isArray(data.operations.openingStockOverrides)) {
    data.operations.openingStockOverrides = [];
  }

  const now = new Date().toISOString();
  const existingIdx = data.operations.openingStockOverrides.findIndex(
    o => o.date === date && o.productId === productId
  );

  const record = {
    id: existingIdx >= 0 ? data.operations.openingStockOverrides[existingIdx].id : `oso-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    productId,
    quantityLitres: Number(rawQty.toFixed(2)),
    reason: (reason || '').trim(),
    createdAt: existingIdx >= 0 ? data.operations.openingStockOverrides[existingIdx].createdAt : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    data.operations.openingStockOverrides[existingIdx] = record;
  } else {
    data.operations.openingStockOverrides.push(record);
  }

  saveData(data);
  return record;
}

export function deleteOpeningStockOverride(date, productId) {
  const data = getData();
  if (!Array.isArray(data.operations.openingStockOverrides)) return false;
  const initialLen = data.operations.openingStockOverrides.length;
  data.operations.openingStockOverrides = data.operations.openingStockOverrides.filter(
    o => !(o.date === date && o.productId === productId)
  );
  if (data.operations.openingStockOverrides.length !== initialLen) {
    saveData(data);
    return true;
  }
  return false;
}

export function deleteOpeningStockOverrideById(id) {
  const data = getData();
  if (!Array.isArray(data.operations.openingStockOverrides)) return false;
  const initialLen = data.operations.openingStockOverrides.length;
  data.operations.openingStockOverrides = data.operations.openingStockOverrides.filter(
    o => o.id !== id
  );
  if (data.operations.openingStockOverrides.length !== initialLen) {
    saveData(data);
    return true;
  }
  return false;
}

export function getOpeningStockHistory(productId = null) {
  const data = getData();
  const overrides = data?.operations?.openingStockOverrides || [];
  const products = data?.masters?.products || [];

  return overrides
    .filter(o => !productId || o.productId === productId)
    .map(o => {
      const prod = products.find(p => p.id === o.productId);
      return {
        ...o,
        productName: prod ? prod.name : o.productId,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/**
 * Calculate opening stock for a product on a target date.
 * Priority:
 * 1. Manual override for (prodId, targetDate)
 * 2. Previous operational day closing book stock
 * 3. Initial stock (from settings / initialStock)
 */
export function calculateOpeningStockForDate(prodId, targetDate, customData = null) {
  const data = customData || getData();
  const overrides = data?.operations?.openingStockOverrides || [];
  const initialStockMap = data?.operations?.fuelInitialStock || { 'prod-1': 12500, 'prod-2': 18000, 'prod-3': 7500 };
  const initialStock = initialStockMap[prodId] !== undefined ? initialStockMap[prodId] : 10000;

  // 1. Direct manual override on this date
  const directOverride = overrides.find(o => o.date === targetDate && o.productId === prodId);
  if (directOverride) {
    return {
      openingStock: Number(directOverride.quantityLitres),
      source: 'manual',
      reason: directOverride.reason,
      overrideId: directOverride.id,
      isManualOverride: true,
    };
  }

  // 2. Identify all prior dates with activity (< targetDate)
  const allReceipts = data?.operations?.fuelReceipts || [];
  const allMeterReadings = data?.operations?.meterReadings || [];
  const allDailyEntries = data?.operations?.dailyEntries || [];

  const priorDateSet = new Set();
  overrides.forEach(o => {
    if (o.productId === prodId && o.date < targetDate) priorDateSet.add(o.date);
  });
  allReceipts.forEach(r => {
    if ((r.productId === prodId || (r.productName && r.productName.toLowerCase().includes(prodId))) && r.date < targetDate) {
      priorDateSet.add(r.date);
    }
  });
  allMeterReadings.forEach(m => {
    if (m.productId === prodId && m.date < targetDate) priorDateSet.add(m.date);
  });
  allDailyEntries.forEach(e => {
    if (e.date < targetDate) priorDateSet.add(e.date);
  });

  const priorDates = Array.from(priorDateSet).sort();
  if (priorDates.length === 0) {
    return {
      openingStock: Number(initialStock),
      source: 'initial',
      reason: null,
      overrideId: null,
      isManualOverride: false,
    };
  }

  // Find the latest override before targetDate (if any) to use as anchor
  let anchorIdx = -1;
  for (let i = priorDates.length - 1; i >= 0; i--) {
    const d = priorDates[i];
    if (overrides.some(o => o.date === d && o.productId === prodId)) {
      anchorIdx = i;
      break;
    }
  }

  let currentStock = Number(initialStock);
  const startIdx = anchorIdx >= 0 ? anchorIdx : 0;

  for (let i = startIdx; i < priorDates.length; i++) {
    const curDate = priorDates[i];
    const dayOverride = overrides.find(o => o.date === curDate && o.productId === prodId);
    let dayOpening = currentStock;
    if (dayOverride) {
      dayOpening = Number(dayOverride.quantityLitres);
    }

    const dayReceipts = allReceipts
      .filter(r => (r.productId === prodId || (r.productName && r.productName.toLowerCase() === prodId || (r.productName && r.productName.toLowerCase().includes(prodId)))) && r.date === curDate)
      .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

    const daySales = allMeterReadings
      .filter(m => m.productId === prodId && m.date === curDate)
      .reduce((sum, m) => sum + (Number(m.salesLitres) || 0), 0);

    currentStock = Number((dayOpening + dayReceipts - daySales).toFixed(2));
  }

  return {
    openingStock: currentStock,
    source: 'auto',
    reason: null,
    overrideId: null,
    isManualOverride: false,
  };
}

/**
 * Fuel Stock Summary:
 * Book Stock = Opening + Receipts/Top-Ups - Meter Sales
 * Variation = Physical Dip - Book Stock (if physical dip exists)
 * Over-Capacity Warning if Book Stock > Tank Capacity
 */
export function getFuelStockSummary(productIdOrDate, optionalDate) {
  let targetProductId = null;
  let date = localDate();

  if (optionalDate) {
    targetProductId = productIdOrDate;
    date = optionalDate;
  } else if (productIdOrDate) {
    if (typeof productIdOrDate === 'string' && productIdOrDate.includes('-') && productIdOrDate.length === 10) {
      date = productIdOrDate;
    } else {
      targetProductId = productIdOrDate;
    }
  }

  const data = getData();
  const products = getActiveProducts();
  const tankCapacities = data?.operations?.tankCapacities || { 'prod-1': 20000, 'prod-2': 30000, 'prod-3': 15000 };
  const allReceipts = data?.operations?.fuelReceipts || [];
  const allMeterReadings = data?.operations?.meterReadings || [];
  const allDips = data?.operations?.fuelDips || [];

  const computeForProd = (prod) => {
    const capacityLitres = tankCapacities[prod.id] || (prod.id === 'prod-2' ? 30000 : prod.id === 'prod-3' ? 15000 : 20000);
    const capacityKL = Number((capacityLitres / 1000).toFixed(2));

    // Date-sensitive opening stock resolution
    const openingInfo = calculateOpeningStockForDate(prod.id, date, data);
    const openingStock = openingInfo.openingStock;

    // Shift movements for target date
    const receiptsToday = Number(allReceipts
      .filter(r => (r.productId === prod.id || (r.productName && r.productName.toLowerCase() === prod.name.toLowerCase())) && r.date === date)
      .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0).toFixed(2));
    const topUpsTodayKL = Number((receiptsToday / 1000).toFixed(2));

    const salesToday = Number(allMeterReadings
      .filter(r => r.productId === prod.id && r.date === date)
      .reduce((sum, r) => sum + (Number(r.salesLitres) || 0), 0).toFixed(2));
    const salesTodayKL = Number((salesToday / 1000).toFixed(2));

    // Important Inventory Formula: Closing = Opening + TopUps - Sales
    const closingBookStock = Number((openingStock + receiptsToday - salesToday).toFixed(2));
    const closingBookStockKL = Number((closingBookStock / 1000).toFixed(2));

    // Total lifetime receipts & sales for historical statistics
    const totalReceipts = Number(allReceipts
      .filter(r => r.productId === prod.id || (r.productName && r.productName.toLowerCase() === prod.name.toLowerCase()))
      .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0).toFixed(2));
    const totalSales = Number(allMeterReadings
      .filter(r => r.productId === prod.id)
      .reduce((sum, r) => sum + (Number(r.salesLitres) || 0), 0).toFixed(2));

    // Check physical dip on this date
    const dip = allDips.find(d => (d.productId === prod.id || (d.productName && d.productName.toLowerCase() === prod.name.toLowerCase())) && d.date === date);
    const physicalDip = dip !== undefined && dip.physicalDipLitres !== '' && dip.physicalDipLitres !== null
      ? Number(dip.physicalDipLitres)
      : null;
    const variation = physicalDip !== null ? Number((physicalDip - closingBookStock).toFixed(2)) : null;

    // Capacity & warning metrics
    const utilizationPercent = capacityLitres > 0 ? Number(((closingBookStock / capacityLitres) * 100).toFixed(1)) : 0;
    const isOverCapacity = closingBookStock > capacityLitres;
    const overCapacityPercent = isOverCapacity ? Number(((closingBookStock / capacityLitres) * 100).toFixed(1)) : null;
    const isLowStock = capacityLitres > 0 ? closingBookStock < (capacityLitres * 0.15) : false;

    // Price & Valuation
    const applicable = getApplicablePrice(prod.id, date);
    const purchaseCost = applicable?.purchaseCost || 0;
    const sellingPrice = applicable?.sellingPrice || 0;
    const stockValuation = Number((closingBookStock * purchaseCost).toFixed(2));

    return {
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit || 'Litre',
      date,
      capacityLitres,
      capacityKL,
      openingStock,
      openingStockSource: openingInfo.source,
      openingStockReason: openingInfo.reason,
      isManualOverride: openingInfo.isManualOverride,
      overrideId: openingInfo.overrideId,
      receipts: receiptsToday,
      sales: salesToday,
      receiptsToday,
      salesToday,
      topUpsTodayKL,
      salesTodayKL,
      totalReceiptsAllTime: totalReceipts,
      totalSalesAllTime: totalSales,
      closingBookStock,
      closingBookStockKL,
      utilizationPercent,
      isOverCapacity,
      overCapacityPercent,
      isLowStock,
      physicalDip,
      variation,
      purchaseCost,
      sellingPrice,
      stockValuation,
      hasDip: physicalDip !== null,
    };
  };

  if (targetProductId) {
    const found = products.find(p => p.id === targetProductId || p.name.toLowerCase().includes(String(targetProductId).toLowerCase())) || products[0];
    return computeForProd(found);
  }

  return products.map(prod => computeForProd(prod));
}

// ─────────────────────────────────────────────────────────────────────────────
// CASH COUNT RECONCILIATION & STANDALONE SYNC
// ─────────────────────────────────────────────────────────────────────────────

const CASH_COUNT_STORAGE_KEY = 'cash-count-entries';

export function getAllCashCounts() {
  const data = getData();
  const repoCounts = data?.operations?.cashCounts || [];

  let externalCounts = [];
  try {
    const raw = localStorage.getItem(CASH_COUNT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) externalCounts = parsed;
    }
  } catch (e) {}

  const map = new Map();
  repoCounts.forEach(c => map.set(c.id, c));
  externalCounts.forEach(c => {
    if (!map.has(c.id)) {
      map.set(c.id, {
        ...c,
        date: c.date || (c.timestamp ? localDate(new Date(c.timestamp)) : localDate()),
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export function getCashCountsByDate(date) {
  return getAllCashCounts().filter(c => c.date === date);
}

export function getCashCountTotalByDate(date) {
  const counts = getCashCountsByDate(date);
  return Number(counts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0).toFixed(2));
}

export function saveCashCountEntry({
  id,
  date,
  timestamp,
  person = 'Forecourt Attendant',
  note = '',
  denominations = {},
  looseChange = 0,
  amount,
  isDemo = false,
}) {
  const data = getData();
  const now = new Date();
  const ts = timestamp || now.getTime();
  const entryDate = date || localDate(now);

  const NOTES = [['n500', 500], ['n200', 200], ['n100', 100], ['n50', 50], ['n20', 20], ['n10', 10]];
  const COINS = [['c5', 5], ['c2', 2], ['c1', 1]];
  const ALL = [...NOTES, ...COINS];

  const calculatedAmount = ALL.reduce((s, [k, v]) => s + (Number(denominations[k]) || 0) * v, 0) + (Number(looseChange) || 0);
  const finalAmount = amount !== undefined && amount !== null && amount !== '' ? Number(amount) : calculatedAmount;

  const entry = {
    id: id || ('cc-' + ts + '-' + Math.random().toString(36).substr(2, 4)),
    timestamp: ts,
    date: entryDate,
    person: person.trim(),
    note: note.trim(),
    denominations: { ...denominations },
    looseChange: Number(looseChange) || 0,
    amount: finalAmount,
    isDemo: Boolean(isDemo),
    updatedAt: now.toISOString(),
    createdAt: timestamp ? new Date(timestamp).toISOString() : now.toISOString(),
  };

  if (!data.operations.cashCounts) data.operations.cashCounts = [];
  const idx = data.operations.cashCounts.findIndex(c => c.id === entry.id);
  if (idx !== -1) {
    data.operations.cashCounts[idx] = entry;
  } else {
    data.operations.cashCounts.push(entry);
  }
  setData(data);

  // Sync back to standalone Cash-Count localStorage key
  try {
    const raw = localStorage.getItem(CASH_COUNT_STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    const extIdx = list.findIndex(c => c.id === entry.id);
    if (extIdx !== -1) list[extIdx] = entry;
    else list.push(entry);
    localStorage.setItem(CASH_COUNT_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}

  return entry;
}

export function deleteCashCountEntry(id) {
  const data = getData();
  const targetId = String(id);
  if (data?.operations?.cashCounts) {
    data.operations.cashCounts = data.operations.cashCounts.filter(c => String(c.id) !== targetId);
    setData(data);
  }

  try {
    const raw = localStorage.getItem(CASH_COUNT_STORAGE_KEY);
    if (raw) {
      let list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list = list.filter(c => String(c.id) !== targetId);
        localStorage.setItem(CASH_COUNT_STORAGE_KEY, JSON.stringify(list));
      }
    }
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// LUBRICANTS TRANSACTIONS & STOCK
// ─────────────────────────────────────────────────────────────────────────────

export function getAllLubricantPurchases() {
  return getData()?.operations?.lubricantPurchases ?? [];
}

export function createLubricantPurchase({
  date,
  supplierId = '',
  supplierName = '',
  lubricantId,
  quantity,
  purchaseRate,
  amount,
  reference = '',
  remarks = '',
  isDemo = false,
}) {
  const data = getData();
  const now = new Date().toISOString();
  const lube = getLubricant(lubricantId);
  const supp = supplierId ? getSupplier(supplierId) : null;
  const qty = Number(quantity) || 0;
  const rate = purchaseRate !== undefined && purchaseRate !== null && purchaseRate !== ''
    ? Number(purchaseRate)
    : (Number(lube?.purchasePrice) || 0);
  const amt = amount !== undefined && amount !== null && amount !== ''
    ? Number(amount)
    : Number((qty * rate).toFixed(2));

  const record = {
    id: generateId('lube-p'),
    date,
    supplierId: supplierId || '',
    supplierName: supplierName || supp?.name || '',
    lubricantId,
    lubricantName: lube?.name || '',
    quantity: qty,
    purchaseRate: rate,
    amount: amt,
    reference: reference.trim(),
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };
  if (!data.operations.lubricantPurchases) data.operations.lubricantPurchases = [];
  data.operations.lubricantPurchases.push(record);
  setData(data);
  return record;
}

export function deleteLubricantPurchase(id) {
  const data = getData();
  if (!data?.operations?.lubricantPurchases) return;
  data.operations.lubricantPurchases = data.operations.lubricantPurchases.filter(p => p.id !== id);
  setData(data);
}

export function getAllLubricantSales() {
  return getData()?.operations?.lubricantSales ?? [];
}

export function createLubricantSale({
  date,
  lubricantId,
  quantity,
  sellingPrice,
  amount,
  paymentMode = 'Cash',
  customerId = '',
  customerName = '',
  remarks = '',
  isDemo = false,
}) {
  const data = getData();
  const now = new Date().toISOString();
  const lube = getLubricant(lubricantId);
  const cust = customerId ? getCustomer(customerId) : null;
  const qty = Number(quantity) || 0;
  const rate = sellingPrice !== undefined && sellingPrice !== null && sellingPrice !== ''
    ? Number(sellingPrice)
    : (Number(lube?.sellingPrice) || 0);
  const amt = amount !== undefined && amount !== null && amount !== ''
    ? Number(amount)
    : Number((qty * rate).toFixed(2));

  const record = {
    id: generateId('lube-s'),
    date,
    lubricantId,
    lubricantName: lube?.name || '',
    quantity: qty,
    sellingPrice: rate,
    amount: amt,
    paymentMode,
    customerId: customerId || '',
    customerName: customerName || cust?.name || '',
    remarks: remarks.trim(),
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  };
  if (!data.operations.lubricantSales) data.operations.lubricantSales = [];
  data.operations.lubricantSales.push(record);
  setData(data);
  return record;
}

export function deleteLubricantSale(id) {
  const data = getData();
  if (!data?.operations?.lubricantSales) return;
  data.operations.lubricantSales = data.operations.lubricantSales.filter(s => s.id !== id);
  setData(data);
}

export function getLubricantStockSummary() {
  const lubes = getActiveLubricants();
  const purchases = getAllLubricantPurchases();
  const sales = getAllLubricantSales();

  return lubes.map(lube => {
    const totalPurchased = purchases
      .filter(p => p.lubricantId === lube.id)
      .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const totalSold = sales
      .filter(s => s.lubricantId === lube.id)
      .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    // Per-product opening stock (packs). Older data without the field keeps the original baseline of 12.
    const openingStock = lube.openingStock !== undefined && lube.openingStock !== null && lube.openingStock !== ''
      ? Number(lube.openingStock) || 0
      : 12;
    const rawStock = Number((openingStock + totalPurchased - totalSold).toFixed(2));
    const closingStock = Math.max(0, rawStock);
    const valuation = Number((closingStock * (Number(lube.purchasePrice) || 0)).toFixed(2));

    return {
      ...lube,
      openingStock,
      totalPurchased,
      totalSold,
      closingStock,
      rawStock,
      isOversold: rawStock < 0,
      valuation,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE & BUSINESS POSITION
// ─────────────────────────────────────────────────────────────────────────────

export function getBusinessPosition(date = localDate()) {
  const data = getData();
  const entries = (data?.operations?.dailyEntries || []).filter(e => e.date <= date);

  let cumulativeCashInHand = 0;
  let cumulativeBankDeposits = 0;
  let cumulativeUPI = 0;
  let cumulativeCard = 0;
  let cumulativePaytm = 0;

  for (const entry of entries) {
    const cashCol = Number(entry.cashCollected) || 0;
    const cashDep = Number(entry.totalCashDeposited) || 0;
    const cashExp = Number(entry.totalCashExpenses) || 0;
    const otherCash = Number(entry.totalOtherCashPayments) || 0;
    cumulativeCashInHand += (cashCol - cashDep - cashExp - otherCash);
    cumulativeBankDeposits += cashDep;
  }

  // Customer payments received (cash -> cash in hand, other modes -> bank)
  for (const p of (data?.operations?.customerPayments || []).filter(x => x.date <= date)) {
    const a = Number(p.amount) || 0;
    if ((p.paymentMode || 'Cash') === 'Cash') cumulativeCashInHand += a;
    else cumulativeBankDeposits += a;
  }

  // Collections by digital mode
  const allCols = (data?.operations?.collections || []).filter(c => c.date <= date);
  for (const c of allCols) {
    const amt = Number(c.amount) || 0;
    if (c.paymentMode === 'UPI') cumulativeUPI += amt;
    else if (c.paymentMode === 'Card') cumulativeCard += amt;
    else if (c.paymentMode === 'Paytm') cumulativePaytm += amt;
  }

  // Customer Receivables (Total outstanding of all active customers)
  const customers = getCustomers().filter(c => c.status === 'active');
  let customerReceivables = 0;
  for (const cust of customers) {
    customerReceivables += Math.max(0, getCustomerOutstanding(cust.id));
  }

  // Fuel Inventory Value
  const fuelStocks = getFuelStockSummary(date);
  const fuelInventoryValue = fuelStocks.reduce((sum, f) => sum + f.stockValuation, 0);

  // Lubricant Inventory Value
  const lubeStocks = getLubricantStockSummary();
  const lubricantInventoryValue = lubeStocks.reduce((sum, l) => sum + l.valuation, 0);

  // Total Assets
  const totalAssets = Number((
    Math.max(0, cumulativeCashInHand) +
    cumulativeBankDeposits +
    cumulativeUPI +
    cumulativeCard +
    cumulativePaytm +
    customerReceivables +
    fuelInventoryValue +
    lubricantInventoryValue
  ).toFixed(2));

  // Liabilities
  const totalLiabilities = 0;
  const netPosition = Number((totalAssets - totalLiabilities).toFixed(2));

  return {
    assets: {
      cashInHand: Number(Math.max(0, cumulativeCashInHand).toFixed(2)),
      bankAccounts: Number(cumulativeBankDeposits.toFixed(2)),
      upiReceivable: Number(cumulativeUPI.toFixed(2)),
      cardReceivable: Number(cumulativeCard.toFixed(2)),
      paytmReceivable: Number(cumulativePaytm.toFixed(2)),
      customerReceivables: Number(customerReceivables.toFixed(2)),
      fuelInventory: Number(fuelInventoryValue.toFixed(2)),
      lubricantInventory: Number(lubricantInventoryValue.toFixed(2)),
      total: totalAssets,
    },
    liabilities: {
      supplierPayables: totalLiabilities,
      otherLiabilities: 0,
      total: totalLiabilities,
    },
    netPosition,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY SALES REPORT (DSR) & REPORT DATA
// ─────────────────────────────────────────────────────────────────────────────

export function getDSRData(date = localDate()) {
  const entry = getDailyEntryByDate(date);
  const meterReadings = entry ? getMeterReadingsByDailyEntryId(entry.id) : [];
  const collectionGroups = entry ? getCollectionGroupsByDailyEntryId(entry.id) : [];
  const collections = entry ? getCollectionsByDailyEntryId(entry.id) : [];
  const udhaarSales = entry ? getUdhaarSalesByDailyEntryId(entry.id) : [];
  const cashDeposits = entry ? getCashDepositsByDailyEntryId(entry.id) : [];
  const expenses = entry ? getExpensesByDailyEntryId(entry.id) : [];
  const moneyMovements = entry ? getMoneyMovementsByDailyEntryId(entry.id) : [];

  // Machine breakdown
  const machines = getActiveMachines();
  const machineBreakdown = machines.map(m => {
    const mReadings = meterReadings.filter(r => r.machineId === m.id);
    const litres = mReadings.reduce((sum, r) => sum + (Number(r.salesLitres) || 0), 0);
    const sales = mReadings.reduce((sum, r) => sum + (Number(r.salesValue) || 0), 0);
    return {
      machineId: m.id,
      machineName: m.name,
      litres: Number(litres.toFixed(2)),
      sales: Number(sales.toFixed(2)),
      readings: mReadings,
    };
  });

  // Group reconciliation
  const groupReconciliations = collectionGroups.map(grp => {
    const grpMachines = grp.machineIds || [];
    const grpReadings = meterReadings.filter(r => grpMachines.includes(r.machineId));
    const grpSales = Number(grpReadings.reduce((sum, r) => sum + (Number(r.salesValue) || 0), 0).toFixed(2));
    const grpCollections = collections.filter(c => c.collectionGroupId === grp.id);
    const grpCollected = Number(grpCollections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0).toFixed(2));
    const grpUdhaar = Number(udhaarSales.filter(u => u.collectionGroupId === grp.id).reduce((sum, u) => sum + (Number(u.amount) || 0), 0).toFixed(2));
    const grpReconciled = Number((grpCollected + grpUdhaar).toFixed(2));
    const grpDiff = Number((grpSales - grpReconciled).toFixed(2));

    return {
      groupId: grp.id,
      groupName: grp.name,
      sales: grpSales,
      collected: grpCollected,
      udhaar: grpUdhaar,
      reconciled: grpReconciled,
      difference: grpDiff,
      status: Math.abs(grpDiff) < 0.01 ? 'matched' : 'difference',
    };
  });

  // Aggregated totals
  const totalSalesValue = Number(entry?.totalSalesValue || 0);
  const totalLitres = Number(entry?.totalFuelLitres ?? entry?.totalLitres ?? 0);
  const totalCollections = Number(entry?.totalCollections || 0);
  const totalUdhaar = Number(entry?.totalUdhaar || 0);
  const reconciledSales = Number(entry?.reconciledSales || (totalCollections + totalUdhaar));
  const diff = Number(entry?.reconciliationDifference || (totalSalesValue - reconciledSales));
  const isReconciled = Math.abs(diff) < 0.01;

  // Breakdown of collections by mode
  const collectionsByMode = { Cash: 0, UPI: 0, Card: 0, Paytm: 0, Other: 0 };
  collections.forEach(c => {
    const amt = Number(c.amount) || 0;
    if (collectionsByMode[c.paymentMode] !== undefined) {
      collectionsByMode[c.paymentMode] += amt;
    } else {
      collectionsByMode.Other += amt;
    }
  });

  const totalCashDeposited = Number(cashDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0).toFixed(2));
  const totalExpenses = Number(expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toFixed(2));
  const totalCashExpenses = Number(expenses.filter(e => (e.paymentSource || 'Cash') === 'Cash').reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toFixed(2));
  const totalMoneyMovements = Number(moneyMovements.reduce((sum, m) => sum + (Number(m.amount) || 0), 0).toFixed(2));
  const totalOtherCashPayments = Number(moneyMovements.filter(m => (m.paymentSource || 'Cash') === 'Cash').reduce((sum, m) => sum + (Number(m.amount) || 0), 0).toFixed(2));
  const customerReceipts = getCustomerPaymentsByDate(date);
  const receiptTotals = getCustomerReceiptTotals(date);
  const baseCashRemaining = Number(entry?.cashRemaining ?? (collectionsByMode.Cash - totalCashDeposited - totalCashExpenses - totalOtherCashPayments).toFixed(2));
  const cashRemaining = Number((baseCashRemaining + receiptTotals.cash).toFixed(2));

  // Tank fuel stock summary (date-sensitive)
  const fuelStockSummaries = getFuelStockSummary(date);

  return {
    date,
    entry,
    entryStatus: entry?.status || 'draft',
    fuelStock: fuelStockSummaries,
    meterReadings,
    machineSales: machineBreakdown,
    collectionGroups,
    groupReconciliations,
    collections: {
      ...collectionsByMode,
      totalCollected: totalCollections,
      rawList: collections,
    },
    udhaarSales,
    cashDeposits,
    expenses,
    moneyMovements,
    customerReceipts,
    reconciliation: {
      meterSales: totalSalesValue,
      totalLitres,
      totalCollected: totalCollections,
      totalUdhaar,
      reconciledSales,
      difference: diff,
      reconciled: isReconciled,
      status: isReconciled ? '✓ RECONCILED' : `⚠️ VARIANCE (₹${diff.toFixed(2)})`,
    },
    cashPosition: {
      cashCollected: collectionsByMode.Cash,
      cashDeposited: totalCashDeposited,
      cashExpenses: totalCashExpenses,
      otherCashPayments: totalOtherCashPayments,
      customerCashReceived: receiptTotals.cash,
      customerOtherReceived: receiptTotals.nonCash,
      cashRemaining,
    },
  };
}

export { exportFuelExDataJson, importFuelExDataJson } from './storage.js';

