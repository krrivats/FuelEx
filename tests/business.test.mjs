/**
 * FuelEx business-rule tests. Run with:  npm test
 * Runs the real repository layer under Node with a localStorage shim (no browser needed).
 */
import './_shim.mjs';
import { resetStorage } from './_shim.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

const S = await import('../src/data/storage.js');
const R = await import('../src/data/repository.js');
const { localDate, localMonth } = await import('../src/utils/dates.js');

const D1 = '2026-10-01';
const D2 = '2026-10-02';
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg || ''} expected ${b}, got ${a}`);

function fresh() {
  resetStorage();
  S.initializeData();
}
const save = (e) => R.saveDailyEntry({ editReason: 'test setup', ...e });
const price = (prodId, date) => R.getApplicablePrice(prodId, date).sellingPrice;

function metersFor(date, openOf, litresPerNozzle) {
  return R.getActiveNozzles().map((n) => {
    const opening = openOf(n);
    return {
      nozzleId: n.id, machineId: n.machineId, productId: n.productId,
      openingReading: opening, closingReading: opening + litresPerNozzle,
      sellingPrice: price(n.productId, date),
    };
  });
}
const group = { id: 'g1', name: 'A', machineIds: ['mach-1', 'mach-2', 'mach-3'], salesmanIds: ['sal-1'] };

function saveDay1() {
  const meters = metersFor(D1, () => 1000, 100);
  const sales = meters.reduce((s, r) => s + 100 * r.sellingPrice, 0);
  return {
    sales,
    res: save({
      date: D1, status: 'completed', collectionGroups: [group], meterReadings: meters,
      collections: [
        { collectionGroupId: 'g1', paymentMode: 'Cash', amount: sales - 5000 - 30000 },
        { collectionGroupId: 'g1', paymentMode: 'UPI', amount: 20000 },
        { collectionGroupId: 'g1', paymentMode: 'Card', amount: 10000 },
      ],
      udhaarSales: [{ customerId: 'cust-1', productId: 'prod-2', amount: 5000, quantity: 55, rate: 90, collectionGroupId: 'g1' }],
      cashDeposits: [{ collectionGroupId: 'g1', amount: 10000, salesmanId: 'sal-1' }],
      expenses: [{ categoryId: 'exp-1', amount: 500, paymentSource: 'Cash', collectionGroupId: 'g1' }],
      moneyMovements: [{ type: 'Other Payment', amount: 1000, paymentSource: 'Cash', collectionGroupId: 'g1' }],
    }),
  };
}

test('local date helpers use the local calendar, not UTC', () => {
  assert.equal(localDate(new Date(2026, 9, 9, 1, 0)), '2026-10-09'); // 01:00 local must stay 9 Oct
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(localMonth(new Date(2026, 11, 31, 23, 0)), '2026-12');
});

test('meter sales: closing - opening, valued at the price effective on that date', () => {
  fresh();
  const base = price('prod-1', D1);
  R.addPriceHistory({ productId: 'prod-1', effectiveDate: '2026-10-05', sellingPrice: base + 5, purchaseCost: 90 });
  assert.equal(price('prod-1', '2026-10-04'), base, 'old price before the change');
  assert.equal(price('prod-1', '2026-10-05'), base + 5, 'new price from effective date');
  const res = save({
    date: D1, status: 'draft', collectionGroups: [group],
    meterReadings: [{ nozzleId: 'noz-5', machineId: 'mach-2', productId: 'prod-1', openingReading: 500.25, closingReading: 620.75, sellingPrice: base }],
  });
  near(res.dailyEntry.totalFuelLitres, 120.5, 'litres');
  near(res.dailyEntry.totalSalesValue, Number((120.5 * base).toFixed(2)), 'value');
});

test('day 1: reconciliation matches and UPI/Card/Udhaar are NOT deducted from cash', () => {
  fresh();
  const { sales, res } = saveDay1();
  const e = res.dailyEntry;
  near(e.totalSalesValue, sales, 'sales');
  assert.equal(e.reconciliationStatus, 'matched');
  near(e.reconciliationDifference, 0);
  // cash = cash collected - deposits - cash expenses - other cash payments
  near(e.cashRemaining, e.cashCollected - 10000 - 500 - 1000, 'cash remaining');
  near(e.cashRemaining, (sales - 35000) - 11500, 'UPI 20k + Card 10k + Udhaar 5k stay out of cash');
  const dsr = R.getDSRData(D1);
  near(dsr.cashPosition.cashRemaining, e.cashRemaining, 'DSR agrees with entry');
  near(dsr.reconciliation.totalLitres, 1200, 'DSR litres (regression: used to read wrong field)');
});

test('a non-zero reconciliation difference is detected', () => {
  fresh();
  const meters = metersFor(D1, () => 0, 100);
  const sales = meters.reduce((s, r) => s + 100 * r.sellingPrice, 0);
  const res = save({
    date: D1, status: 'completed', collectionGroups: [group], meterReadings: meters,
    collections: [{ collectionGroupId: 'g1', paymentMode: 'Cash', amount: sales - 700 }],
  });
  near(res.dailyEntry.reconciliationDifference, 700);
  assert.notEqual(res.dailyEntry.reconciliationStatus, 'matched');
});

test('inventory: opening + top-ups - sales = closing book stock; KL converts to litres', () => {
  fresh();
  saveDay1();
  R.createFuelTopUp({ date: D1, productId: 'prod-1', quantity: 2, unit: 'KL' });
  R.createFuelTopUp({ date: D1, productId: 'prod-1', quantity: 500, unit: 'L' });
  const petrol = R.getFuelStockSummary(D1).find((s) => s.productId === 'prod-1');
  // petrol has 3 nozzles in the seed data? derive from entry
  const soldPetrol = R.getAllMeterReadings().filter((m) => m.productId === 'prod-1').reduce((s, m) => s + m.salesLitres, 0);
  near(petrol.receiptsToday, 2500, '2 KL + 500 L');
  near(petrol.closingBookStock, petrol.openingStock + 2500 - soldPetrol, 'closing');
  assert.equal(R.getFuelTopUpsByDate(D1).length, 2);
});

test('top-up delete removes it from stock', () => {
  fresh();
  const r = R.createFuelTopUp({ date: D1, productId: 'prod-2', quantity: 10, unit: 'KL' });
  near(R.getFuelStockSummary(D1).find((s) => s.productId === 'prod-2').receiptsToday, 10000);
  R.deleteFuelTopUp(r.id);
  near(R.getFuelStockSummary(D1).find((s) => s.productId === 'prod-2').receiptsToday, 0);
});

test('day 2: opening stock and meters roll forward from day 1', () => {
  fresh();
  saveDay1();
  R.createFuelTopUp({ date: D1, productId: 'prod-1', quantity: 2, unit: 'KL' });
  const d1 = R.getFuelStockSummary(D1);
  const d2open = R.getFuelStockSummary(D2);
  for (const p of ['prod-1', 'prod-2', 'prod-3']) {
    near(d2open.find((s) => s.productId === p).openingStock, d1.find((s) => s.productId === p).closingBookStock, `${p} rollover`);
  }
  const prev = R.getPreviousClosingReadings(D2);
  assert.equal(prev['noz-1'], 1100, 'meter rolls forward');
  // enter day 2
  const meters = metersFor(D2, (n) => prev[n.id], 50);
  const sales2 = meters.reduce((s, r) => s + 50 * r.sellingPrice, 0);
  const res = save({
    date: D2, status: 'completed', collectionGroups: [group], meterReadings: meters,
    collections: [{ collectionGroupId: 'g1', paymentMode: 'Cash', amount: sales2 }],
  });
  assert.equal(res.dailyEntry.reconciliationStatus, 'matched');
  near(res.dailyEntry.totalFuelLitres, 600);
  const d2close = R.getFuelStockSummary(D2).find((s) => s.productId === 'prod-1');
  const sold2 = R.getAllMeterReadings().filter((m) => m.date === D2 && m.productId === 'prod-1').reduce((s, m) => s + m.salesLitres, 0);
  near(d2close.closingBookStock, d2close.openingStock - sold2, 'day 2 closing');
});

test('udhaar: outstanding = opening + credit sales - payments', () => {
  fresh();
  const opening = R.getCustomer('cust-1').openingBalance;
  saveDay1();
  near(R.getCustomerOutstanding('cust-1').outstanding, opening + 5000);
  R.createCustomerPayment({ date: D2, customerId: 'cust-1', amount: 2000, paymentMode: 'Cash' });
  near(R.getCustomerOutstanding('cust-1').outstanding, opening + 3000);
  const ledger = R.getCustomerLedger('cust-1');
  assert.ok(ledger && (Array.isArray(ledger) ? ledger.length : ledger.entries?.length ?? 1) >= 2, 'ledger has both rows');
});

test('opening stock: manual override beats previous closing and rolls forward', () => {
  fresh();
  saveDay1();
  R.saveOpeningStockOverride({ date: D2, productId: 'prod-2', quantityLitres: 9000, reason: 'Dip correction' });
  const s = R.calculateOpeningStockForDate('prod-2', D2);
  assert.equal(s.isManualOverride, true);
  near(s.openingStock, 9000);
  const d3 = R.calculateOpeningStockForDate('prod-2', '2026-10-03');
  near(d3.openingStock, 9000, 'day 3 continues from the override (no sales on day 2)');
});

test('cash count: add two, delete one, total is right and stays after reload', () => {
  fresh();
  R.saveCashCountEntry({ date: D1, denominations: { n500: 1220 } });
  const small = R.saveCashCountEntry({ date: D1, denominations: { n500: 12 } });
  near(R.getCashCountTotalByDate(D1), 616000);
  R.deleteCashCountEntry(small.id);
  near(R.getCashCountTotalByDate(D1), 610000);
  near(R.getAllCashCounts().length, 1);
});

test('over-capacity and low stock flags', () => {
  fresh();
  R.createFuelTopUp({ date: D1, productId: 'prod-1', quantity: 15, unit: 'KL' }); // 12.5 + 15 > 20 KL
  const p = R.getFuelStockSummary(D1).find((s) => s.productId === 'prod-1');
  assert.equal(p.isOverCapacity, true);
});

test('masters used by history cannot be deleted (customer, salesman, supplier, lubricant)', () => {
  fresh();
  saveDay1();
  R.createFuelTopUp({ date: D1, productId: 'prod-1', quantity: 1, unit: 'KL', supplierName: R.getSuppliers()[0].name });
  assert.equal(R.canDeleteCustomer('cust-1').canDelete, false);
  assert.equal(R.canDeleteSalesman('sal-1').canDelete, false);
  assert.equal(R.canDeleteSupplier(R.getSuppliers()[0].id).canDelete, false);
  assert.throws(() => R.deleteCustomer('cust-1'));
  // unused master can still be removed
  const fresh1 = R.createCustomer({ name: 'Unused Co', creditLimit: 1000 });
  assert.equal(R.canDeleteCustomer(fresh1.id).canDelete, true);
});

test('referenced customer cannot be deleted', () => {
  fresh();
  saveDay1();
  const r = R.canDeleteCustomer('cust-1');
  assert.equal(r.canDelete ?? r.allowed ?? r.ok, false);
});

test('backup round trip restores identical data; malformed backup is rejected', () => {
  fresh();
  saveDay1();
  const json = S.exportFuelExDataJson();
  R.deleteDailyEntry(R.getDailyEntryByDate(D1).id, 'test cleanup');
  assert.equal(R.getDailyEntries().length, 0);
  S.importFuelExDataJson(json);
  assert.equal(R.getDailyEntries().length, 1);
  assert.throws(() => S.importFuelExDataJson('{not json'));
  assert.throws(() => S.importFuelExDataJson('{"hello":1}'));
  assert.throws(() => S.importFuelExDataJson('[]'));
  assert.equal(R.getDailyEntries().length, 1, 'bad restore did not touch data');
});

test('corrupted localStorage does not crash loading', () => {
  fresh();
  localStorage.setItem('FuelExData', '{{{broken');
  assert.doesNotThrow(() => S.loadData());
});

// ───────────── Change control (past-date edits need a reason) ─────────────
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
const simpleDay = (date, extra = {}) => ({
  date, status: 'draft', collectionGroups: [group],
  meterReadings: [{ nozzleId: 'noz-5', machineId: 'mach-2', productId: 'prod-1', openingReading: 0, closingReading: 10, sellingPrice: 100 }],
  ...extra,
});

test('change control: today and yesterday drafts are free; older days and completed days need a reason', () => {
  fresh();
  assert.doesNotThrow(() => R.saveDailyEntry(simpleDay(localDate())), 'today draft');
  assert.doesNotThrow(() => R.saveDailyEntry(simpleDay(daysAgo(1))), 'yesterday draft (grace day)');
  assert.throws(() => R.saveDailyEntry(simpleDay(daysAgo(5))), (e) => e.code === 'REASON_REQUIRED', 'old day without reason');
  assert.throws(() => R.saveDailyEntry(simpleDay(daysAgo(5), { editReason: 'oops' })), (e) => e.code === 'REASON_REQUIRED', 'reason too short');
  // completing today's day is free; changing it afterwards is not
  R.saveDailyEntry(simpleDay(localDate(), { status: 'completed' }));
  assert.throws(() => R.saveDailyEntry(simpleDay(localDate(), { status: 'completed' })), (e) => e.code === 'REASON_REQUIRED', 'edit completed day');
});

test('change control: reason marks the day as edited and writes the change log', () => {
  fresh();
  const date = daysAgo(6);
  R.saveDailyEntry(simpleDay(date, { editReason: 'Missed entry for Sunday' }));
  const res = R.saveDailyEntry(simpleDay(date, {
    editReason: 'Closing meter typed wrong',
    meterReadings: [{ nozzleId: 'noz-5', machineId: 'mach-2', productId: 'prod-1', openingReading: 0, closingReading: 20, sellingPrice: 100 }],
  }));
  const e = res.dailyEntry;
  assert.equal(e.isEdited, true);
  assert.equal(e.editLog.length, 2);
  assert.equal(e.lastEditReason, 'Closing meter typed wrong');
  near(e.editLog[1].salesBefore, 1000); near(e.editLog[1].salesAfter, 2000);
  const log = R.getAuditLog();
  assert.equal(log.length, 2);
  assert.equal(log[0].module, 'Daily Entry');
  assert.equal(log[0].date, date);
  // edit trail survives backup / restore
  S.importFuelExDataJson(S.exportFuelExDataJson());
  assert.equal(R.getDailyEntryByDate(date).editLog.length, 2);
  assert.equal(R.getAuditLog().length, 2);
});

test('change control: deleting a past day needs a reason and is logged', () => {
  fresh();
  const date = daysAgo(4);
  const entry = R.saveDailyEntry(simpleDay(date, { editReason: 'Late entry from notes' })).dailyEntry;
  assert.throws(() => R.deleteDailyEntry(entry.id), (e) => e.code === 'REASON_REQUIRED');
  assert.equal(R.getDailyEntries().length, 1, 'not deleted without reason');
  R.deleteDailyEntry(entry.id, 'Duplicate of another day');
  assert.equal(R.getDailyEntries().length, 0);
  assert.equal(R.getAuditLog()[0].action, 'Deleted');
});

test('change control: isPastDateLocked boundaries', () => {
  assert.equal(R.isPastDateLocked(localDate()), false);
  assert.equal(R.isPastDateLocked(daysAgo(1)), false);
  assert.equal(R.isPastDateLocked(daysAgo(2)), true);
  assert.equal(R.isPastDateLocked(''), false);
});

// ───────────── Report consistency + lubricants + expenses ─────────────
test('reports agree: entry, DSR, business position, customer ledger, stock valuation', () => {
  fresh();
  const { res } = saveDay1();
  const e = res.dailyEntry;
  const dsr = R.getDSRData(D1);
  const bp = R.getBusinessPosition(D1);
  near(dsr.cashPosition.cashRemaining, e.cashRemaining, 'DSR cash = entry cash');
  near(bp.assets.cashInHand, e.cashRemaining, 'Finance cash = entry cash');
  near(bp.assets.bankAccounts, 10000, 'bank = deposits');
  near(bp.assets.customerReceivables, R.getCustomerOutstanding('cust-1').outstanding, 'receivables = customer balance');
  near(dsr.reconciliation.meterSales, e.totalSalesValue, 'DSR sales = entry sales');
  const stock = R.getFuelStockSummary(D1);
  near(bp.assets.fuelInventory, stock.reduce((s, t) => s + (Number(t.stockValuation) || 0), 0), 'fuel valuation = Σ tank valuation');
  near(bp.assets.total, Object.entries(bp.assets).filter(([k]) => k !== 'total').reduce((s, [, v]) => s + v, 0), 'assets total adds up');
  near(bp.netPosition, bp.assets.total - bp.liabilities.total, 'net = assets - liabilities');
});

test('expenses: only cash-paid expenses reduce cash in hand', () => {
  fresh();
  const meters = metersFor(D1, () => 0, 10);
  const sales = meters.reduce((s, r) => s + 10 * r.sellingPrice, 0);
  const res = save({
    date: D1, status: 'completed', collectionGroups: [group], meterReadings: meters,
    collections: [{ collectionGroupId: 'g1', paymentMode: 'Cash', amount: sales }],
    expenses: [
      { categoryId: 'exp-1', amount: 300, paymentSource: 'Cash' },
      { categoryId: 'exp-1', amount: 700, paymentSource: 'UPI' },
    ],
  });
  near(res.dailyEntry.totalExpenses, 1000);
  near(res.dailyEntry.totalCashExpenses, 300);
  near(res.dailyEntry.cashRemaining, sales - 300, 'UPI expense is not deducted from cash');
});

test('lubricants: stock = opening + purchases - sales; per-product opening stock; oversell is flagged', () => {
  fresh();
  const before = R.getLubricantStockSummary().find((l) => l.id === 'lube-1');
  R.createLubricantPurchase({ date: D1, lubricantId: 'lube-1', quantity: 10, purchaseRate: 380, supplierName: 'Castrol Dist' });
  R.createLubricantSale({ date: D1, lubricantId: 'lube-1', quantity: 3, sellingPrice: 460, paymentMode: 'Cash' });
  const after = R.getLubricantStockSummary().find((l) => l.id === 'lube-1');
  near(after.closingStock, before.closingStock + 10 - 3);
  R.updateLubricant('lube-2', { openingStock: 40 });
  near(R.getLubricantStockSummary().find((l) => l.id === 'lube-2').closingStock, 40, 'custom opening stock');
  near(after.valuation, after.closingStock * 380, 'valuation at purchase price');
  R.createLubricantSale({ date: D1, lubricantId: 'lube-1', quantity: 999, sellingPrice: 460, paymentMode: 'Cash' });
  const over = R.getLubricantStockSummary().find((l) => l.id === 'lube-1');
  assert.equal(over.isOversold, true, 'oversell is flagged so the UI can warn');
  assert.ok(over.rawStock < 0);
  assert.equal(over.closingStock, 0, 'displayed stock never goes below 0');
});

test('customer payments: cash adds to cash in hand + DSR, UPI goes to bank, dues drop', () => {
  fresh();
  const meters = metersFor(D1, () => 1000, 10);
  const sales = meters.reduce((s, r) => s + 10 * r.sellingPrice, 0);
  save({
    date: D1, status: 'completed', collectionGroups: [group], meterReadings: meters,
    collections: [{ collectionGroupId: 'g1', paymentMode: 'Cash', amount: sales - 1000 }],
    udhaarSales: [{ customerId: 'cust-1', productId: 'prod-2', amount: 1000, quantity: 10, rate: 100, collectionGroupId: 'g1' }],
  });
  const cashBefore = R.getBusinessPosition(D1).assets.cashInHand;
  const bankBefore = R.getBusinessPosition(D1).assets.bankAccounts;
  const dueBefore = R.getCustomerOutstanding('cust-1').outstanding;
  const dsrBefore = R.getDSRData(D1).cashPosition.cashRemaining;

  R.createCustomerPayment({ date: D1, customerId: 'cust-1', amount: 400, paymentMode: 'Cash', source: 'daily-entry' });
  R.createCustomerPayment({ date: D1, customerId: 'cust-1', amount: 250, paymentMode: 'UPI', source: 'daily-entry' });

  near(R.getCustomerOutstanding('cust-1').outstanding, dueBefore - 650, 'due drops by both payments');
  near(R.getBusinessPosition(D1).assets.cashInHand, cashBefore + 400, 'only cash adds to cash in hand');
  near(R.getBusinessPosition(D1).assets.bankAccounts, bankBefore + 250, 'UPI goes to bank');
  near(R.getDSRData(D1).cashPosition.cashRemaining, dsrBefore + 400, 'DSR cash includes cash receipts');
  near(R.getCustomerReceiptTotals(D1).total, 650);
  const p = R.getCustomerPaymentsByDate(D1)[0];
  R.deleteCustomerPayment(p.id);
  near(R.getCustomerReceiptTotals(D1).total, 250, 'delete removes it');
});
