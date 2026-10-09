import { localDate, localMonth } from '../../utils/dates.js';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  getCustomerOutstanding,
  getCustomerLedger,
  getAllCustomerPayments,
  createCustomerPayment,
  deleteCustomerPayment,
  getEmployees,
  createEmployee,
  updateEmployee,
  setEmployeeStatus,
  getAllSalaryPayments,
  createSalaryPayment,
  deleteSalaryPayment,
  getAllAdvanceRecoveries,
  createAdvanceRecovery,
  deleteAdvanceRecovery,
  getEmployeeFinancialSummary,
  getActiveSalesmen,
  isPastDateLocked, addAuditLog,
} from '../../data/repository.js';
import { useReasonGate } from '../../components/ui/ReasonGate.jsx';
import {
  Modal,
  FormGroup,
  EmptyState,
  SearchInput,
  useToast,
  Breadcrumbs,
  ConfirmDialog,
} from '../../components/ui/UIComponents.jsx';
import Icon from '../../components/ui/Icon.jsx';

const INR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INR_ROUND = (v) => '₹' + Math.round(Number(v || 0)).toLocaleString('en-IN');

export default function CRMPage() {
  const toast = useToast();
  const { requestReason, reasonDialog } = useReasonGate();
  // Section 31: Under CRM add Customers, Employees, Customer Ledger, Customer Payments
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'employees' | 'ledger' | 'payments' | 'emp-ledger'
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [advanceRecoveries, setAdvanceRecoveries] = useState([]);
  const [salesmen, setSalesmen] = useState([]);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterOverLimit, setFilterOverLimit] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Modals state - Customers
  const [customerModal, setCustomerModal] = useState({ open: false, customer: null });
  const [paymentModal, setPaymentModal] = useState({ open: false, defaultCustomerId: '' });
  const [deletePaymentConfirm, setDeletePaymentConfirm] = useState({ open: false, paymentId: null });

  // Modals state - Employees
  const [employeeModal, setEmployeeModal] = useState({ open: false, employee: null });
  const [salaryModal, setSalaryModal] = useState({ open: false, defaultEmployeeId: '' });
  const [recoveryModal, setRecoveryModal] = useState({ open: false, defaultEmployeeId: '' });
  const [deleteSalaryConfirm, setDeleteSalaryConfirm] = useState({ open: false, paymentId: null });

  // Form states - Customer
  const [customerForm, setCustomerForm] = useState({
    name: '',
    mobile: '',
    address: '',
    openingBalance: '',
    creditLimit: '',
    status: 'active',
    remarks: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    customerId: '',
    date: localDate(),
    amount: '',
    paymentMode: 'Cash',
    reference: '',
    remarks: '',
  });

  // Form states - Employee (Section 32)
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    mobile: '',
    designation: 'Forecourt Attendant',
    monthlySalary: '20000',
    joiningDate: localDate(),
    status: 'active',
    salesmanId: '',
    remarks: '',
  });

  // Form states - Salary Payment (Section 36)
  const [salaryForm, setSalaryForm] = useState({
    employeeId: '',
    salaryMonth: localMonth(), // YYYY-MM
    paymentDate: localDate(),
    amount: '',
    paymentSource: 'Cash',
    reference: '',
    remarks: '',
  });

  // Form states - Advance Recovery (Section 35)
  const [recoveryForm, setRecoveryForm] = useState({
    employeeId: '',
    date: localDate(),
    amount: '',
    recoverySource: 'Salary Deduction',
    remarks: '',
  });

  const currentMonthStr = useMemo(() => localMonth(), []);

  const loadData = useCallback(() => {
    const custs = getCustomers();
    const emps = getEmployees();
    setCustomers(custs);
    setPayments(getAllCustomerPayments());
    setEmployees(emps);
    setSalaryPayments(getAllSalaryPayments());
    setAdvanceRecoveries(getAllAdvanceRecoveries());
    setSalesmen(getActiveSalesmen());

    if (custs.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(custs[0].id);
    }
    if (emps.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(emps[0].id);
    }
  }, [selectedCustomerId, selectedEmployeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Enriched customers with real-time balance & credit check
  const customerStats = useMemo(() => {
    return customers.map(c => {
      const out = getCustomerOutstanding(c.id);
      const isOverLimit = out.creditLimit > 0 && out.outstanding > out.creditLimit;
      return {
        ...c,
        ...out,
        isOverLimit,
      };
    });
  }, [customers, payments]);

  // Enriched employees with real-time financial stats
  const employeeStats = useMemo(() => {
    return employees.map(emp => {
      const summary = getEmployeeFinancialSummary(emp.id, currentMonthStr);
      return {
        ...emp,
        ...summary,
      };
    });
  }, [employees, salaryPayments, advanceRecoveries, currentMonthStr]);

  // Overall Customer Totals
  const totalReceivables = useMemo(() => {
    return customerStats.reduce((sum, c) => sum + (c.outstanding > 0 ? c.outstanding : 0), 0);
  }, [customerStats]);

  const overLimitCount = useMemo(() => {
    return customerStats.filter(c => c.isOverLimit).length;
  }, [customerStats]);

  const totalCreditLimit = useMemo(() => {
    return customerStats.reduce((sum, c) => sum + (c.creditLimit || 0), 0);
  }, [customerStats]);

  // Overall Employee Totals (Section 46)
  const totalEmployeesCount = employees.length;
  const activeEmployeesCount = employees.filter(e => e.status === 'active').length;
  const totalMonthlySalaryObligation = useMemo(() => {
    return employees.filter(e => e.status === 'active').reduce((sum, e) => sum + (Number(e.monthlySalary) || 0), 0);
  }, [employees]);
  const totalSalaryDueCurrentMonth = useMemo(() => {
    return employeeStats.reduce((sum, e) => sum + (Number(e.salaryDue) || 0), 0);
  }, [employeeStats]);
  const totalAdvanceOutstanding = useMemo(() => {
    return employeeStats.reduce((sum, e) => sum + (Number(e.advanceOutstanding) || 0), 0);
  }, [employeeStats]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customerStats.filter(c => {
      if (filterOverLimit && !c.isOverLimit) return false;
      if (search) {
        const q = search.toLowerCase();
        const mName = (c.name || '').toLowerCase().includes(q);
        const mMobile = (c.mobile || '').toLowerCase().includes(q);
        const mAddr = (c.address || '').toLowerCase().includes(q);
        if (!mName && !mMobile && !mAddr) return false;
      }
      return true;
    });
  }, [customerStats, filterOverLimit, search]);

  // Filtered employee list
  const filteredEmployees = useMemo(() => {
    return employeeStats.filter(e => {
      if (empStatusFilter !== 'all' && e.status !== empStatusFilter) return false;
      if (empSearch) {
        const q = empSearch.toLowerCase();
        const mName = (e.name || '').toLowerCase().includes(q);
        const mDesig = (e.designation || '').toLowerCase().includes(q);
        const mMobile = (e.mobile || '').toLowerCase().includes(q);
        if (!mName && !mDesig && !mMobile) return false;
      }
      return true;
    });
  }, [employeeStats, empStatusFilter, empSearch]);

  // Active customer ledger data
  const activeCustomerLedger = useMemo(() => {
    if (!selectedCustomerId) return null;
    return getCustomerLedger(selectedCustomerId);
  }, [selectedCustomerId, customers, payments]);

  // Active employee financial summary & statement
  const activeEmployeeSummary = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return getEmployeeFinancialSummary(selectedEmployeeId, currentMonthStr);
  }, [selectedEmployeeId, employees, salaryPayments, advanceRecoveries, currentMonthStr]);

  // Handlers for Customer
  const handleOpenAddCustomer = () => {
    setCustomerForm({
      name: '',
      mobile: '',
      address: '',
      openingBalance: '',
      creditLimit: '',
      status: 'active',
      remarks: '',
    });
    setCustomerModal({ open: true, customer: null });
  };

  const handleOpenEditCustomer = (cust) => {
    setCustomerForm({
      name: cust.name,
      mobile: cust.mobile || '',
      address: cust.address || '',
      openingBalance: cust.openingBalance !== undefined ? String(cust.openingBalance) : '',
      creditLimit: cust.creditLimit !== undefined ? String(cust.creditLimit) : '',
      status: cust.status || 'active',
      remarks: cust.remarks || '',
    });
    setCustomerModal({ open: true, customer: cust });
  };

  const handleSaveCustomer = () => {
    if (!customerForm.name.trim()) {
      toast.error('Customer Name is required.');
      return;
    }
    const openBal = Number(customerForm.openingBalance) || 0;
    const limit = Number(customerForm.creditLimit) || 0;

    if (customerModal.customer) {
      updateCustomer(customerModal.customer.id, {
        name: customerForm.name.trim(),
        mobile: customerForm.mobile.trim(),
        address: customerForm.address.trim(),
        openingBalance: openBal,
        creditLimit: limit,
        status: customerForm.status,
        remarks: customerForm.remarks.trim(),
      });
      toast.success(`Updated customer ${customerForm.name}`);
    } else {
      createCustomer({
        name: customerForm.name.trim(),
        mobile: customerForm.mobile.trim(),
        address: customerForm.address.trim(),
        openingBalance: openBal,
        creditLimit: limit,
        status: customerForm.status,
        remarks: customerForm.remarks.trim(),
      });
      toast.success(`Created customer ${customerForm.name}`);
    }
    setCustomerModal({ open: false, customer: null });
    loadData();
  };

  const handleOpenAddPayment = (custId = '') => {
    setPaymentForm({
      customerId: custId || selectedCustomerId || (customers[0]?.id || ''),
      date: localDate(),
      amount: '',
      paymentMode: 'Cash',
      reference: '',
      remarks: '',
    });
    setPaymentModal({ open: true, defaultCustomerId: custId });
  };

  const handleSavePayment = async () => {
    if (!paymentForm.customerId) {
      toast.error('Please select a customer.');
      return;
    }
    const amt = Number(paymentForm.amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }
    const cust = customers.find(c => c.id === paymentForm.customerId);
    let reasonGiven = '';
    if (isPastDateLocked(paymentForm.date)) {
      reasonGiven = await requestReason({ title: 'Record a payment on a past date', date: paymentForm.date, detail: 'This changes the customer\'s ledger and the cash position of that day.' });
      if (!reasonGiven) return;
    }
    createCustomerPayment({
      customerId: paymentForm.customerId,
      customerName: cust ? cust.name : 'Customer',
      date: paymentForm.date,
      amount: amt,
      paymentMode: paymentForm.paymentMode,
      reference: paymentForm.reference.trim(),
      remarks: paymentForm.remarks.trim(),
    });

    if (reasonGiven) addAuditLog({ date: paymentForm.date, module: 'Customer Payment', action: 'Added late', reason: reasonGiven, summary: `${cust?.name || 'Customer'}: ${INR(amt)}` });
    toast.success(`Customer payment of ${INR(amt)} recorded.`);
    setPaymentModal({ open: false, defaultCustomerId: '' });
    loadData();
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentConfirm.paymentId) return;
    const rec = getAllCustomerPayments().find(p => p.id === deletePaymentConfirm.paymentId);
    if (rec && isPastDateLocked(rec.date)) {
      const why = await requestReason({ title: 'Delete a past payment', date: rec.date, detail: 'This changes the customer\'s ledger and balance.', confirmLabel: 'Delete payment', danger: true });
      if (!why) return;
      addAuditLog({ date: rec.date, module: 'Customer Payment', action: 'Deleted', reason: why, summary: `${rec.customerName}: ${INR(rec.amount)}` });
    }
    deleteCustomerPayment(deletePaymentConfirm.paymentId);
    toast.success('Payment voucher deleted.');
    setDeletePaymentConfirm({ open: false, paymentId: null });
    loadData();
  };

  // Handlers for Employee (Section 32, 33)
  const handleOpenAddEmployee = () => {
    setEmployeeForm({
      name: '',
      mobile: '',
      designation: 'Forecourt Attendant',
      monthlySalary: '20000',
      joiningDate: localDate(),
      status: 'active',
      salesmanId: '',
      remarks: '',
    });
    setEmployeeModal({ open: true, employee: null });
  };

  const handleOpenEditEmployee = (emp) => {
    setEmployeeForm({
      name: emp.name,
      mobile: emp.mobile || '',
      designation: emp.designation || 'Forecourt Attendant',
      monthlySalary: String(emp.monthlySalary || 0),
      joiningDate: emp.joiningDate || '',
      status: emp.status || 'active',
      salesmanId: emp.salesmanId || '',
      remarks: emp.remarks || '',
    });
    setEmployeeModal({ open: true, employee: emp });
  };

  const handleSaveEmployee = () => {
    if (!employeeForm.name.trim()) {
      toast.error('Employee Name is required.');
      return;
    }
    const salary = Number(employeeForm.monthlySalary);
    if (!salary || salary <= 0) {
      toast.error('Monthly Salary is required and must be greater than zero.');
      return;
    }

    if (employeeModal.employee) {
      updateEmployee(employeeModal.employee.id, {
        name: employeeForm.name.trim(),
        mobile: employeeForm.mobile.trim(),
        designation: employeeForm.designation.trim(),
        monthlySalary: salary,
        joiningDate: employeeForm.joiningDate,
        status: employeeForm.status,
        salesmanId: employeeForm.salesmanId || '',
        remarks: employeeForm.remarks.trim(),
      });
      toast.success(`Updated employee ${employeeForm.name}`);
    } else {
      createEmployee({
        name: employeeForm.name.trim(),
        mobile: employeeForm.mobile.trim(),
        designation: employeeForm.designation.trim(),
        monthlySalary: salary,
        joiningDate: employeeForm.joiningDate,
        status: employeeForm.status,
        salesmanId: employeeForm.salesmanId || '',
        remarks: employeeForm.remarks.trim(),
      });
      toast.success(`Registered new employee ${employeeForm.name}`);
    }
    setEmployeeModal({ open: false, employee: null });
    loadData();
  };

  // Handlers for Salary Payment (Section 36)
  const handleOpenAddSalary = (empId = '') => {
    const targetEmpId = empId || selectedEmployeeId || (employees[0]?.id || '');
    const emp = employees.find(e => e.id === targetEmpId);
    const summary = getEmployeeFinancialSummary(targetEmpId, currentMonthStr);
    setSalaryForm({
      employeeId: targetEmpId,
      salaryMonth: currentMonthStr,
      paymentDate: localDate(),
      amount: summary.salaryDue > 0 ? String(summary.salaryDue) : String(emp?.monthlySalary || ''),
      paymentSource: 'Cash',
      reference: '',
      remarks: '',
    });
    setSalaryModal({ open: true, defaultEmployeeId: targetEmpId });
  };

  const handleSaveSalary = async () => {
    if (!salaryForm.employeeId) {
      toast.error('Please select an employee.');
      return;
    }
    const amt = Number(salaryForm.amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid salary payment amount.');
      return;
    }
    const emp = employees.find(e => e.id === salaryForm.employeeId);
    let reasonGiven = '';
    if (isPastDateLocked(salaryForm.paymentDate)) {
      reasonGiven = await requestReason({ title: 'Record a salary payment on a past date', date: salaryForm.paymentDate, detail: 'This changes cash and the employee\'s balance for that period.' });
      if (!reasonGiven) return;
    }
    createSalaryPayment({
      employeeId: salaryForm.employeeId,
      salaryMonth: salaryForm.salaryMonth,
      paymentDate: salaryForm.paymentDate,
      amount: amt,
      paymentSource: salaryForm.paymentSource,
      reference: salaryForm.reference.trim(),
      remarks: salaryForm.remarks.trim(),
    });

    if (reasonGiven) addAuditLog({ date: salaryForm.paymentDate, module: 'Salary Payment', action: 'Added late', reason: reasonGiven, summary: `${emp?.name}: ${INR(amt)}` });
    toast.success(`Salary payment of ${INR(amt)} recorded for ${emp?.name} (${salaryForm.salaryMonth}).`);
    setSalaryModal({ open: false, defaultEmployeeId: '' });
    loadData();
  };

  const handleDeleteSalary = async () => {
    if (!deleteSalaryConfirm.paymentId) return;
    const rec = getAllSalaryPayments().find(p => p.id === deleteSalaryConfirm.paymentId);
    if (rec && isPastDateLocked(rec.paymentDate)) {
      const why = await requestReason({ title: 'Delete a past salary payment', date: rec.paymentDate, detail: 'This changes cash and the employee\'s balance.', confirmLabel: 'Delete payment', danger: true });
      if (!why) return;
      addAuditLog({ date: rec.paymentDate, module: 'Salary Payment', action: 'Deleted', reason: why, summary: `${INR(rec.amount)} for ${rec.salaryMonth}` });
    }
    deleteSalaryPayment(deleteSalaryConfirm.paymentId);
    toast.success('Salary payment voucher deleted.');
    setDeleteSalaryConfirm({ open: false, paymentId: null });
    loadData();
  };

  // Handlers for Advance Recovery (Section 35)
  const handleOpenAddRecovery = (empId = '') => {
    const targetEmpId = empId || selectedEmployeeId || (employees[0]?.id || '');
    const summary = getEmployeeFinancialSummary(targetEmpId, currentMonthStr);
    setRecoveryForm({
      employeeId: targetEmpId,
      date: localDate(),
      amount: summary.advanceOutstanding > 0 ? String(Math.min(summary.advanceOutstanding, 2000)) : '',
      recoverySource: 'Salary Deduction',
      remarks: '',
    });
    setRecoveryModal({ open: true, defaultEmployeeId: targetEmpId });
  };

  const handleSaveRecovery = () => {
    if (!recoveryForm.employeeId) {
      toast.error('Please select an employee.');
      return;
    }
    const amt = Number(recoveryForm.amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid advance recovery amount.');
      return;
    }
    const emp = employees.find(e => e.id === recoveryForm.employeeId);
    createAdvanceRecovery({
      employeeId: recoveryForm.employeeId,
      date: recoveryForm.date,
      amount: amt,
      recoverySource: recoveryForm.recoverySource,
      remarks: recoveryForm.remarks.trim(),
    });

    toast.success(`Advance recovery of ${INR(amt)} recorded for ${emp?.name}.`);
    setRecoveryModal({ open: false, defaultEmployeeId: '' });
    loadData();
  };

  const isCustomerTab = activeTab === 'customers' || activeTab === 'ledger' || activeTab === 'payments';

  return (
    <div>
      {reasonDialog}
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'CRM & Staff' },
            ]}
          />
          <h1 style={{ marginTop: 8 }}>CRM &amp; Commercial Accounts</h1>
          <p>
            Manage credit customers, commercial fleet accounts, udhaar slips, staff profiles, monthly salary disbursements, and employee advances.
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isCustomerTab ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleOpenAddPayment()}
              >
                <Icon name="card" /> Record Customer Payment
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenAddCustomer}
              >
                + Add Customer
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleOpenAddRecovery()}
              >
                <Icon name="cash" /> Advance Recovery
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleOpenAddSalary()}
              >
                <Icon name="cash" /> Pay Salary
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenAddEmployee}
              >
                + Add Employee
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Top Cards (Section 46: CRM DASHBOARD) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 14, marginBottom: 12 }}>
        {isCustomerTab ? (
          <>
            <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', }}>
                Total Customers
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                {customers.length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Commercial &amp; fleet accounts
              </div>
            </div>

            <div className="section-block" style={{ borderLeft: '4px solid var(--color-warning)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', }}>
                Total Outstanding
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-warning)', marginTop: 4 }}>
                {INR(totalReceivables)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Real-time customer receivables
              </div>
            </div>

            <div className="section-block" style={{ borderLeft: `4px solid ${overLimitCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', }}>
                Over Limit Accounts
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: overLimitCount > 0 ? 'var(--color-danger)' : 'var(--color-success)', marginTop: 4 }}>
                {overLimitCount}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Exceeding credit sanctions
              </div>
            </div>

            <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', }}>
                Total Credit Limit
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                {INR_ROUND(totalCreditLimit)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Aggregated credit limits
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', }}>
                Total Employees
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                {totalEmployeesCount}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {activeEmployeesCount} Active staff members
              </div>
            </div>

            <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', }}>
                Monthly Payroll
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                {INR_ROUND(totalMonthlySalaryObligation)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Monthly salary entitlement
              </div>
            </div>

            <div className="section-block" style={{ borderLeft: `4px solid ${totalSalaryDueCurrentMonth > 0 ? 'var(--color-warning)' : 'var(--color-success)'}` }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', }}>
                Salary Due ({currentMonthStr})
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: totalSalaryDueCurrentMonth > 0 ? 'var(--color-warning)' : 'var(--color-success)', marginTop: 4 }}>
                {INR_ROUND(totalSalaryDueCurrentMonth)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Pending salary disbursement
              </div>
            </div>

            <div className="section-block" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', }}>
                Outstanding Advances
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6', marginTop: 4 }}>
                {INR(totalAdvanceOutstanding)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Staff advances awaiting recovery
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs navigation (Section 31) */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', marginBottom: 12, gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <button
          type="button"
          className={`btn ${activeTab === 'customers' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('customers')}
        >
          <Icon name="users" /> Customers ({filteredCustomers.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'employees' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('employees')}
        >
          <Icon name="users" /> Employees ({employees.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('ledger')}
        >
          <Icon name="file" /> Customer Ledger
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('payments')}
        >
          <Icon name="card" /> Customer Payments ({payments.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'emp-ledger' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('emp-ledger')}
        >
          Employee Profile &amp; Payroll
        </button>
      </div>

      {/* TAB 1: CUSTOMERS DIRECTORY */}
      {activeTab === 'customers' && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: '1 1 280px', maxWidth: 400 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search customer, mobile, address..."
              />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={filterOverLimit}
                  onChange={e => setFilterOverLimit(e.target.checked)}
                />
                <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}><Icon name="alert" /> Show Over Limit Only</span>
              </label>
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <EmptyState
              icon="users"
              title="No customers match criteria"
              message="Try adjusting your search or add a new customer to FuelEx CRM."
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Contact &amp; Address</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Credit Limit</th>
                    <th style={{ textAlign: 'right' }}>Opening Bal</th>
                    <th style={{ textAlign: 'right' }}>Udhaar Purchases</th>
                    <th style={{ textAlign: 'right' }}>Payments Made</th>
                    <th style={{ textAlign: 'right' }}>Current Outstanding</th>
                    <th>Credit Condition</th>
                    <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(c => {
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                          {c.remarks && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.remarks}</div>}
                        </td>
                        <td>
                          <div>{c.mobile || '—'}</div>
                          {c.address && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.address}</div>}
                        </td>
                        <td>
                          <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 11 }}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {c.creditLimit > 0 ? INR_ROUND(c.creditLimit) : <span style={{ color: 'var(--text-muted)' }}>No limit</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {INR(c.openingBalance)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-warning)', fontWeight: 600 }}>
                          {INR(c.totalUdhaar)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>
                          {INR(c.totalPayments)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13.5, color: c.outstanding > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                          {INR(c.outstanding)}
                        </td>
                        <td>
                          {c.isOverLimit ? (
                            <span className="badge badge-danger" style={{ fontWeight: 700, fontSize: 11, animation: 'pulse 2s infinite' }}>
                              <Icon name="alert" /> Over limit
                            </span>
                          ) : c.outstanding > 0 ? (
                            <span className="badge badge-warning" style={{ fontSize: 11 }}>
                              Active Credit
                            </span>
                          ) : (
                            <span className="badge badge-success" style={{ fontSize: 11 }}>
                              Clear
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="View Customer Ledger"
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setActiveTab('ledger');
                              }}
                            >
                              <Icon name="file" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Record Payment"
                              onClick={() => handleOpenAddPayment(c.id)}
                            >
                              <Icon name="card" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Edit Customer"
                              onClick={() => handleOpenEditCustomer(c)}
                            >
                              <Icon name="edit" />
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
      )}

      {/* TAB 2: EMPLOYEE MASTER & DIRECTORY (Sections 31-38) */}
      {activeTab === 'employees' && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: '1 1 280px', maxWidth: 400 }}>
              <SearchInput
                value={empSearch}
                onChange={setEmpSearch}
                placeholder="Search employee name, designation, mobile..."
              />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                className="input-field"
                style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}
                value={empStatusFilter}
                onChange={e => setEmpStatusFilter(e.target.value)}
              >
                <option value="all">All Employees ({employees.length})</option>
                <option value="active">Active Only ({activeEmployeesCount})</option>
                <option value="inactive">Inactive</option>
              </select>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleOpenAddEmployee}
              >
                + Add Employee
              </button>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <EmptyState
              icon="users"
              title="No employees found"
              message="Register pump attendants, shift managers, and cashiers to manage salaries and advances."
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Designation &amp; Joining</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Monthly Salary</th>
                    <th style={{ textAlign: 'right' }}>Current Month Paid</th>
                    <th style={{ textAlign: 'right' }}>Salary Due</th>
                    <th style={{ textAlign: 'right' }}>Total Advance</th>
                    <th style={{ textAlign: 'right' }}>Advance Due</th>
                    <th style={{ width: 170, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const isDue = emp.salaryDue > 0;
                    const hasAdvance = emp.advanceOutstanding > 0;

                    return (
                      <tr key={emp.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.mobile || 'No mobile'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{emp.designation}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Joined: {emp.joiningDate || '—'}</div>
                        </td>
                        <td>
                          <span className={`badge ${emp.status === 'active' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 11 }}>
                            {emp.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {INR(emp.monthlySalary)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>
                          {INR(emp.salaryPaid)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: isDue ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                          {INR(emp.salaryDue)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {INR(emp.totalAdvances)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: hasAdvance ? '#8b5cf6' : 'var(--text-muted)' }}>
                          {INR(emp.advanceOutstanding)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="View Employee Profile & Ledger"
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setActiveTab('emp-ledger');
                              }}
                            >
                              <Icon name="users" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Pay Salary"
                              onClick={() => handleOpenAddSalary(emp.id)}
                            >
                              <Icon name="cash" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Recover Advance"
                              onClick={() => handleOpenAddRecovery(emp.id)}
                            >
                              <Icon name="cash" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Edit Employee Profile"
                              onClick={() => handleOpenEditEmployee(emp)}
                            >
                              <Icon name="edit" />
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
      )}

      {/* TAB 3: CUSTOMER STATEMENT / LEDGER */}
      {activeTab === 'ledger' && (
        <div>
          {/* Customer Picker */}
          <div className="section-block" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                Select Customer Account:
              </label>
              <select
                className="input-field"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
              >
                {customers.map(c => {
                  const out = customerStats.find(item => item.id === c.id);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.mobile ? `(${c.mobile})` : ''} — Bal: {INR(out?.outstanding || 0)} {out?.isOverLimit ? 'OVER LIMIT' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedCustomerId && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenAddPayment(selectedCustomerId)}
                >
                  + Record Payment
                </button>
              </div>
            )}
          </div>

          {/* Statement Table */}
          {activeCustomerLedger && (
            <div className="section-block">
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Statement of Account — {activeCustomerLedger.customer?.name || 'Customer'}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Opening Balance: {INR(activeCustomerLedger.customer?.openingBalance || 0)} • Total Transactions: {(activeCustomerLedger.entries || []).length}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.print()}
                >
                  <Icon name="file" /> Print Statement
                </button>
              </div>

              {activeCustomerLedger.entries.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No transactions recorded for this customer yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ margin: 0, fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Transaction Description</th>
                        <th>Product / Quantity</th>
                        <th style={{ textAlign: 'right' }}>Debit (+ Udhaar)</th>
                        <th style={{ textAlign: 'right' }}>Credit (- Payment)</th>
                        <th style={{ textAlign: 'right' }}>Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCustomerLedger.entries.map((ent, idx) => (
                        <tr key={idx} style={{ background: ent.type === 'payment' ? 'rgba(16, 185, 129, 0.03)' : 'transparent' }}>
                          <td style={{ fontWeight: 600 }}>{ent.date}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {ent.type === 'opening' && 'Opening Balance'}
                              {ent.type === 'udhaar_sale' && 'Udhaar Fuel Credit Sale'}
                              {ent.type === 'payment' && `Customer Payment (${ent.paymentMode || 'Payment'})`}
                            </div>
                            {ent.remarks && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ent.remarks}</div>}
                          </td>
                          <td>
                            {ent.productName ? (
                              <span>
                                {ent.productName} {ent.quantity ? `(${ent.quantity} L @ ₹${ent.rate}/L)` : ''}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--color-warning)', fontWeight: ent.debit > 0 ? 700 : 400 }}>
                            {ent.debit > 0 ? INR(ent.debit) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: ent.credit > 0 ? 700 : 400 }}>
                            {ent.credit > 0 ? INR(ent.credit) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: ent.balance > 0 ? 'var(--text-primary)' : 'var(--color-success)' }}>
                            {INR(ent.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--bg-surface)', fontWeight: 700, fontSize: 13.5 }}>
                        <td colSpan={3} style={{ textAlign: 'right' }}>CLOSING OUTSTANDING BALANCE:</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-warning)' }}>
                          {INR(activeCustomerLedger.totalUdhaar)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                          {INR(activeCustomerLedger.totalPayments)}
                        </td>
                        <td style={{ textAlign: 'right', color: activeCustomerLedger.outstanding > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontSize: 14 }}>
                          {INR(activeCustomerLedger.outstanding)}
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

      {/* TAB 4: CUSTOMER PAYMENTS LIST */}
      {activeTab === 'payments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Customer Payment Receipts</h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Payments received against customer credit accounts. These reduce outstanding receivables and do NOT count as new fuel sales.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleOpenAddPayment()}
            >
              + Record Customer Payment
            </button>
          </div>

          {payments.length === 0 ? (
            <EmptyState
              icon="card"
              title="No customer payments recorded"
              message="Click '+ Record Customer Payment' to register cash, cheque, UPI or NEFT settlements from customers."
            />
          ) : (
            <div className="section-block" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer Name</th>
                    <th style={{ textAlign: 'right' }}>Amount Received</th>
                    <th>Payment Mode</th>
                    <th>Ref / Cheque #</th>
                    <th>Remarks</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => {
                    const cust = customers.find(c => c.id === p.customerId);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.date}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {cust ? cust.name : (p.customerName || 'Customer')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)', fontSize: 13.5 }}>
                          {INR(p.amount)}
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ fontSize: 11 }}>
                            {p.paymentMode || 'Cash'}
                          </span>
                        </td>
                        <td>{p.reference || '—'}</td>
                        <td>{p.remarks || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--color-danger)' }}
                            title="Delete Payment Voucher"
                            onClick={() => setDeletePaymentConfirm({ open: true, paymentId: p.id })}
                          >
                            <Icon name="trash" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: EMPLOYEE PROFILE & PAYROLL LEDGER (Sections 34, 37, 38) */}
      {activeTab === 'emp-ledger' && (
        <div>
          {/* Employee Picker */}
          <div className="section-block" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                Select Employee:
              </label>
              <select
                className="input-field"
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.designation}) — Salary: {INR_ROUND(emp.monthlySalary)}/mo
                  </option>
                ))}
              </select>
            </div>

            {selectedEmployeeId && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenAddSalary(selectedEmployeeId)}
                >
                  <Icon name="cash" /> Pay Salary
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenAddRecovery(selectedEmployeeId)}
                >
                  <Icon name="cash" /> Recover Advance
                </button>
              </div>
            )}
          </div>

          {activeEmployeeSummary?.employee && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Profile Card & Financial Position Cards (Section 34, 38) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
                <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', }}>
                    Staff Profile
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                    {activeEmployeeSummary.employee.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {activeEmployeeSummary.employee.designation} • Joined: {activeEmployeeSummary.employee.joiningDate || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Mobile: {activeEmployeeSummary.employee.mobile || '—'}
                  </div>
                </div>

                <div className="section-block" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', }}>
                    Monthly Salary Entitlement
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                    {INR(activeEmployeeSummary.monthlySalary)}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Current Month ({currentMonthStr}) Paid: <strong style={{ color: 'var(--color-success)' }}>{INR(activeEmployeeSummary.salaryPaid)}</strong>
                  </div>
                  <div style={{ fontSize: 12.5, color: activeEmployeeSummary.salaryDue > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 700, marginTop: 2 }}>
                    Salary Due: {INR(activeEmployeeSummary.salaryDue)}
                  </div>
                </div>

                <div className="section-block" style={{ borderLeft: '4px solid #8b5cf6' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', }}>
                    Advances &amp; Recoveries (Section 35)
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6', marginTop: 4 }}>
                    {INR(activeEmployeeSummary.advanceOutstanding)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Total Taken: {INR(activeEmployeeSummary.totalAdvances)} • Recovered: {INR(activeEmployeeSummary.advancesRecovered)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Advance is not operating expense. Recoveries reduce due balance.
                  </div>
                </div>
              </div>

              {/* Salary History Table (Section 37) */}
              <div className="section-block">
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15 }}>Monthly Salary History (Actual Disbursements)</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Supports partial and multi-installment salary payments per calendar month.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenAddSalary(selectedEmployeeId)}
                  >
                    + Pay Salary
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ margin: 0, fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Salary Month</th>
                        <th style={{ textAlign: 'right' }}>Entitlement</th>
                        <th style={{ textAlign: 'right' }}>Amount Paid</th>
                        <th style={{ textAlign: 'right' }}>Amount Due</th>
                        <th>Payment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployeeSummary.salaryHistory.map(sh => (
                        <tr key={sh.month}>
                          <td style={{ fontWeight: 700 }}>{sh.month}</td>
                          <td style={{ textAlign: 'right' }}>{INR(sh.monthlySalary)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                            {INR(sh.paid)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: sh.due > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                            {INR(sh.due)}
                          </td>
                          <td>
                            <span className={`badge ${sh.status === 'Paid' ? 'badge-success' : sh.status === 'Partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                              {sh.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Advance Movements & Recoveries Log (Section 35) */}
              <div className="section-block">
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15 }}>Employee Advances &amp; Recovery Log</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Operational advances recorded in daily entries vs recovery deductions.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenAddRecovery(selectedEmployeeId)}
                  >
                    + Record Recovery
                  </button>
                </div>

                {activeEmployeeSummary.advancesHistory.length === 0 && activeEmployeeSummary.recoveriesHistory.length === 0 ? (
                  <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No advances or recoveries recorded for this employee.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ margin: 0, fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Entry Type</th>
                          <th style={{ textAlign: 'right' }}>Advance Taken (+)</th>
                          <th style={{ textAlign: 'right' }}>Recovered (-)</th>
                          <th>Method / Source</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeEmployeeSummary.advancesHistory.map(adv => (
                          <tr key={adv.id}>
                            <td style={{ fontWeight: 600 }}>{adv.date}</td>
                            <td>
                              <span className="badge badge-warning" style={{ fontSize: 11 }}>
                                <Icon name="cash" /> Advance Taken
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#8b5cf6' }}>
                              {INR(adv.amount)}
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                            <td>{adv.paymentSource || 'Cash'}</td>
                            <td>{adv.remarks || '—'}</td>
                          </tr>
                        ))}
                        {activeEmployeeSummary.recoveriesHistory.map(rec => (
                          <tr key={rec.id} style={{ background: 'rgba(16, 185, 129, 0.03)' }}>
                            <td style={{ fontWeight: 600 }}>{rec.date}</td>
                            <td>
                              <span className="badge badge-success" style={{ fontSize: 11 }}>
                                <Icon name="check" /> Recovery / Deduction
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                              {INR(rec.amount)}
                            </td>
                            <td>{rec.recoverySource || 'Salary Deduction'}</td>
                            <td>{rec.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT CUSTOMER */}
      <Modal
        open={customerModal.open}
        onClose={() => setCustomerModal({ open: false, customer: null })}
        title={customerModal.customer ? 'Edit Customer Account' : 'Add New Credit Customer'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCustomerModal({ open: false, customer: null })}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveCustomer}>
              Save Customer
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormGroup label="Customer / Fleet Name" required>
            <input
              type="text"
              placeholder="e.g. Royal Logistics / Sharma Travels"
              className="input-field"
              value={customerForm.name}
              onChange={e => setCustomerForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Mobile / WhatsApp">
              <input
                type="tel"
                inputMode="tel"
                placeholder="e.g. 9876543210"
                className="input-field"
                value={customerForm.mobile}
                onChange={e => setCustomerForm(prev => ({ ...prev, mobile: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Credit Limit (₹)">
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 50000"
                className="input-field"
                value={customerForm.creditLimit}
                onChange={e => setCustomerForm(prev => ({ ...prev, creditLimit: e.target.value }))}
              />
            </FormGroup>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Opening Balance (₹)">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="input-field"
                value={customerForm.openingBalance}
                onChange={e => setCustomerForm(prev => ({ ...prev, openingBalance: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Account Status">
              <select
                className="input-field"
                value={customerForm.status}
                onChange={e => setCustomerForm(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive / Frozen</option>
              </select>
            </FormGroup>
          </div>

          <FormGroup label="Billing Address">
            <input
              type="text"
              placeholder="e.g. Plot 12, Industrial Area, Highway Bypass"
              className="input-field"
              value={customerForm.address}
              onChange={e => setCustomerForm(prev => ({ ...prev, address: e.target.value }))}
            />
          </FormGroup>

          <FormGroup label="Internal Remarks">
            <input
              type="text"
              placeholder="e.g. Fortnightly billing cycle, 5 trucks"
              className="input-field"
              value={customerForm.remarks}
              onChange={e => setCustomerForm(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </FormGroup>
        </div>
      </Modal>

      {/* MODAL: RECORD CUSTOMER PAYMENT */}
      <Modal
        open={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, defaultCustomerId: '' })}
        title="Record Customer Payment Receipt"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPaymentModal({ open: false, defaultCustomerId: '' })}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSavePayment}>
              Save Payment
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormGroup label="Customer Account" required>
            <select
              className="input-field"
              value={paymentForm.customerId}
              onChange={e => setPaymentForm(prev => ({ ...prev, customerId: e.target.value }))}
            >
              <option value="">-- Select Customer --</option>
              {customers.map(c => {
                const out = getCustomerOutstanding(c.id);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} — Outstanding: {INR(out.outstanding)}
                  </option>
                );
              })}
            </select>
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Receipt Date" required>
              <input
                type="date"
                className="input-field"
                value={paymentForm.date}
                onChange={e => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Amount (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 25000"
                className="input-field"
                style={{ fontWeight: 700, fontSize: 16 }}
                value={paymentForm.amount}
                onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </FormGroup>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Payment Mode" required>
              <select
                className="input-field"
                value={paymentForm.paymentMode}
                onChange={e => setPaymentForm(prev => ({ ...prev, paymentMode: e.target.value }))}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="Bank">Bank Transfer / NEFT</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </FormGroup>

            <FormGroup label="Reference / Cheque #">
              <input
                type="text"
                placeholder="e.g. UTR-4910284 / CHQ-0021"
                className="input-field"
                value={paymentForm.reference}
                onChange={e => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
              />
            </FormGroup>
          </div>

          <FormGroup label="Remarks">
            <input
              type="text"
              placeholder="e.g. Part payment against September invoice"
              className="input-field"
              value={paymentForm.remarks}
              onChange={e => setPaymentForm(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </FormGroup>
        </div>
      </Modal>

      {/* MODAL: ADD / EDIT EMPLOYEE (Sections 32, 33) */}
      <Modal
        open={employeeModal.open}
        onClose={() => setEmployeeModal({ open: false, employee: null })}
        title={employeeModal.employee ? 'Edit Employee Profile' : 'Register New Employee'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEmployeeModal({ open: false, employee: null })}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveEmployee}>
              Save Employee
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormGroup label="Employee Full Name" required>
            <input
              type="text"
              placeholder="e.g. Rajesh Kumar"
              className="input-field"
              value={employeeForm.name}
              onChange={e => setEmployeeForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Designation" required>
              <select
                className="input-field"
                value={employeeForm.designation}
                onChange={e => setEmployeeForm(prev => ({ ...prev, designation: e.target.value }))}
              >
                <option value="Forecourt Attendant">Forecourt Attendant</option>
                <option value="Senior Attendant">Senior Attendant</option>
                <option value="Shift Manager">Shift Manager</option>
                <option value="Cashier">Cashier</option>
                <option value="Security / Maintenance">Security / Maintenance</option>
              </select>
            </FormGroup>

            <FormGroup label="Monthly Salary (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 22000"
                className="input-field"
                style={{ fontWeight: 700, fontSize: 15 }}
                value={employeeForm.monthlySalary}
                onChange={e => setEmployeeForm(prev => ({ ...prev, monthlySalary: e.target.value }))}
              />
            </FormGroup>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Mobile Number">
              <input
                type="tel"
                inputMode="tel"
                placeholder="e.g. 9876543210"
                className="input-field"
                value={employeeForm.mobile}
                onChange={e => setEmployeeForm(prev => ({ ...prev, mobile: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Joining Date">
              <input
                type="date"
                className="input-field"
                value={employeeForm.joiningDate}
                onChange={e => setEmployeeForm(prev => ({ ...prev, joiningDate: e.target.value }))}
              />
            </FormGroup>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Employment Status">
              <select
                className="input-field"
                value={employeeForm.status}
                onChange={e => setEmployeeForm(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive / On Leave</option>
              </select>
            </FormGroup>

            <FormGroup label="Link Salesman Profile (optional)">
              <select
                className="input-field"
                value={employeeForm.salesmanId}
                onChange={e => setEmployeeForm(prev => ({ ...prev, salesmanId: e.target.value }))}
              >
                <option value="">None / Auto Link</option>
                {salesmen.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code || s.id})</option>
                ))}
              </select>
            </FormGroup>
          </div>

          <FormGroup label="Remarks / Notes">
            <input
              type="text"
              placeholder="e.g. Night shift attendant, Aadhaar verified"
              className="input-field"
              value={employeeForm.remarks}
              onChange={e => setEmployeeForm(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </FormGroup>
        </div>
      </Modal>

      {/* MODAL: RECORD SALARY PAYMENT (Section 36) */}
      <Modal
        open={salaryModal.open}
        onClose={() => setSalaryModal({ open: false, defaultEmployeeId: '' })}
        title="Record Salary Payment Disbursement"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setSalaryModal({ open: false, defaultEmployeeId: '' })}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveSalary}>
              Disburse Salary
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormGroup label="Employee" required>
            <select
              className="input-field"
              value={salaryForm.employeeId}
              onChange={e => {
                const targetId = e.target.value;
                const summary = getEmployeeFinancialSummary(targetId, salaryForm.salaryMonth);
                setSalaryForm(prev => ({
                  ...prev,
                  employeeId: targetId,
                  amount: summary.salaryDue > 0 ? String(summary.salaryDue) : prev.amount,
                }));
              }}
            >
              <option value="">-- Select Employee --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.designation}) — Monthly: {INR_ROUND(e.monthlySalary)}
                </option>
              ))}
            </select>
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Salary Month (YYYY-MM)" required>
              <input
                type="month"
                className="input-field"
                value={salaryForm.salaryMonth}
                onChange={e => {
                  const m = e.target.value;
                  const summary = getEmployeeFinancialSummary(salaryForm.employeeId, m);
                  setSalaryForm(prev => ({
                    ...prev,
                    salaryMonth: m,
                    amount: summary.salaryDue > 0 ? String(summary.salaryDue) : prev.amount,
                  }));
                }}
              />
            </FormGroup>

            <FormGroup label="Payment Date" required>
              <input
                type="date"
                className="input-field"
                value={salaryForm.paymentDate}
                onChange={e => setSalaryForm(prev => ({ ...prev, paymentDate: e.target.value }))}
              />
            </FormGroup>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Amount to Disburse (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 22000"
                className="input-field"
                style={{ fontWeight: 700, fontSize: 16 }}
                value={salaryForm.amount}
                onChange={e => setSalaryForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Payment Source" required>
              <select
                className="input-field"
                value={salaryForm.paymentSource}
                onChange={e => setSalaryForm(prev => ({ ...prev, paymentSource: e.target.value }))}
              >
                <option value="Cash">Cash (Forecourt Handover)</option>
                <option value="Bank">Bank Transfer / NEFT</option>
                <option value="UPI">UPI / GPay</option>
              </select>
            </FormGroup>
          </div>

          <FormGroup label="Reference / Bank Transaction ID">
            <input
              type="text"
              placeholder="e.g. Salary Voucher #412 / UTR-0912"
              className="input-field"
              value={salaryForm.reference}
              onChange={e => setSalaryForm(prev => ({ ...prev, reference: e.target.value }))}
            />
          </FormGroup>

          <FormGroup label="Remarks">
            <input
              type="text"
              placeholder="e.g. Monthly salary full settlement"
              className="input-field"
              value={salaryForm.remarks}
              onChange={e => setSalaryForm(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </FormGroup>
        </div>
      </Modal>

      {/* MODAL: RECORD ADVANCE RECOVERY (Section 35) */}
      <Modal
        open={recoveryModal.open}
        onClose={() => setRecoveryModal({ open: false, defaultEmployeeId: '' })}
        title="Record Employee Advance Recovery"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRecoveryModal({ open: false, defaultEmployeeId: '' })}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveRecovery}>
              Save Recovery
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormGroup label="Employee" required>
            <select
              className="input-field"
              value={recoveryForm.employeeId}
              onChange={e => {
                const targetId = e.target.value;
                const summary = getEmployeeFinancialSummary(targetId, currentMonthStr);
                setRecoveryForm(prev => ({
                  ...prev,
                  employeeId: targetId,
                  amount: summary.advanceOutstanding > 0 ? String(Math.min(summary.advanceOutstanding, 2000)) : '',
                }));
              }}
            >
              <option value="">-- Select Employee --</option>
              {employees.map(e => {
                const summary = getEmployeeFinancialSummary(e.id, currentMonthStr);
                return (
                  <option key={e.id} value={e.id}>
                    {e.name} — Outstanding Advance: {INR(summary.advanceOutstanding)}
                  </option>
                );
              })}
            </select>
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormGroup label="Recovery Date" required>
              <input
                type="date"
                className="input-field"
                value={recoveryForm.date}
                onChange={e => setRecoveryForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </FormGroup>

            <FormGroup label="Recovery Amount (₹)" required>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 2000"
                className="input-field"
                style={{ fontWeight: 700, fontSize: 16 }}
                value={recoveryForm.amount}
                onChange={e => setRecoveryForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </FormGroup>
          </div>

          <FormGroup label="Recovery Source / Mode" required>
            <select
              className="input-field"
              value={recoveryForm.recoverySource}
              onChange={e => setRecoveryForm(prev => ({ ...prev, recoverySource: e.target.value }))}
            >
              <option value="Salary Deduction">Salary Deduction</option>
              <option value="Cash Return">Cash Handover / Return</option>
              <option value="Bank">Bank Deposit</option>
            </select>
          </FormGroup>

          <FormGroup label="Remarks">
            <input
              type="text"
              placeholder="e.g. Monthly advance recovery installment"
              className="input-field"
              value={recoveryForm.remarks}
              onChange={e => setRecoveryForm(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </FormGroup>
        </div>
      </Modal>

      {/* DELETE CONFIRM - PAYMENT */}
      <ConfirmDialog
        open={Boolean(deletePaymentConfirm.paymentId)}
        onClose={() => setDeletePaymentConfirm({ open: false, paymentId: null })}
        title="Delete Customer Payment Voucher"
        message="Are you sure you want to delete this payment record? The customer's outstanding balance will be restored automatically."
        onConfirm={handleDeletePayment}
      />

      {/* DELETE CONFIRM - SALARY */}
      <ConfirmDialog
        open={Boolean(deleteSalaryConfirm.paymentId)}
        onClose={() => setDeleteSalaryConfirm({ open: false, paymentId: null })}
        title="Delete Salary Payment Voucher"
        message="Are you sure you want to delete this salary payment record? The employee's salary due will be updated automatically."
        onConfirm={handleDeleteSalary}
      />
    </div>
  );
}
