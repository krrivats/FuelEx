import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getMachines, getNozzles, getProducts, getLubricants,
  getSalesmen, getCustomers, getSuppliers,
  getPriceHistory, getExpenseCategories,
} from '../../data/repository.js';
import Icon from '../../components/ui/Icon.jsx';
import { Breadcrumbs } from '../../components/ui/UIComponents.jsx';

const MASTER_ITEMS = [
  {
    id: 'machines',
    path: '/masters/machines',
    icon: 'tool',
    title: 'Machines & Nozzles',
    description: 'Configure fuel dispensing machines and assign fuel nozzles to pumps.',
    countFn: (data) => `${data.machines} machines · ${data.nozzles} nozzles`,
  },
  {
    id: 'products',
    path: '/masters/products',
    icon: 'fuel',
    title: 'Fuel Products',
    description: 'Petrol, Diesel, and Speed Petrol fuel products.',
    countFn: (data) => `${data.products} fuel products`,
  },
  {
    id: 'lubricants',
    path: '/masters/lubricants',
    icon: 'fuel',
    title: 'Lubricants',
    description: 'Engine oils, gear oils, coolants, greases, and fluids with pack sizes & prices.',
    countFn: (data) => `${data.lubricants} lubricant items`,
  },
  {
    id: 'salesmen',
    path: '/masters/salesmen',
    icon: 'users',
    title: 'Salesmen',
    description: 'Attendants, pump operators, and station staff.',
    countFn: (data) => `${data.salesmen} salesmen`,
  },
  {
    id: 'customers',
    path: '/masters/customers',
    icon: 'bank',
    title: 'Customers',
    description: 'Credit customers, transport companies, and udhaar accounts.',
    countFn: (data) => `${data.customers} customers`,
  },
  {
    id: 'suppliers',
    path: '/masters/suppliers',
    icon: 'fuel',
    title: 'Suppliers',
    description: 'Oil marketing companies, fuel vendors, and lubricant suppliers.',
    countFn: (data) => `${data.suppliers} suppliers`,
  },
  {
    id: 'prices',
    path: '/masters/prices',
    icon: 'cash',
    title: 'Price History',
    description: 'Historical fuel selling and purchase price logs by effective date.',
    countFn: (data) => `${data.prices} price entries`,
  },
  {
    id: 'expenses',
    path: '/masters/expense-categories',
    icon: 'inbox',
    title: 'Expense Categories',
    description: 'Expense heads for daily operational expenditure tracking.',
    countFn: (data) => `${data.expenses} categories`,
  },
];

export default function MastersLandingPage() {
  const [counts, setCounts] = useState({
    machines: 0, nozzles: 0, products: 0, lubricants: 0, salesmen: 0,
    customers: 0, suppliers: 0, prices: 0, expenses: 0,
  });

  useEffect(() => {
    setCounts({
      machines:   getMachines().length,
      nozzles:    getNozzles().length,
      products:   getProducts().length,
      lubricants: getLubricants().length,
      salesmen:   getSalesmen().length,
      customers:  getCustomers().length,
      suppliers:  getSuppliers().length,
      prices:     getPriceHistory().length,
      expenses:   getExpenseCategories().length,
    });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Masters' },
            ]}
          />
          <h1>Master data</h1>
          <p>
            Configure the foundation of your fuel station — dispensing machines, nozzles, fuel products,
            lubricants, people, and accounts.
          </p>
        </div>
      </div>

      <div className="master-grid">
        {MASTER_ITEMS.map(item => (
          <Link
            key={item.id}
            to={item.path}
            className="master-card"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="master-card-icon"><Icon name={item.icon} /></div>
            <div className="master-card-body">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="master-card-count">{item.countFn(counts)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
