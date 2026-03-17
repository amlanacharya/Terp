import { useAuth } from '../../contexts/AuthContext';
import { PageKey, UserRole } from '../../lib/types';

interface SidebarProps {
  onNavigate: (page: PageKey) => void;
  currentPage: PageKey;
}

interface NavItem {
  key: PageKey;
  label: string;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'leads', label: 'Leads' },
  { key: 'trips', label: 'Trips' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'vehicle-categories', label: 'Vehicle Categories' },
  { key: 'rate-charts', label: 'Rate Charts' },
  { key: 'customers', label: 'Customers' },
  { key: 'owners', label: 'Vehicle Owners' },
  { key: 'invoices', label: 'Customer Invoices', roles: ['admin', 'manager', 'accountant'] },
  { key: 'collections', label: 'Payment Receipts', roles: ['admin', 'manager', 'accountant'] },
  { key: 'driver-settlements', label: 'Salary Slips', roles: ['admin', 'manager', 'accountant'] },
  { key: 'owner-settlements', label: 'Owner Invoices', roles: ['admin', 'manager', 'accountant'] },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings', roles: ['admin'] },
];

export function Sidebar({ onNavigate, currentPage }: SidebarProps) {
  const { profile } = useAuth();

  const visibleItems = navItems.filter(
    (item) => !item.roles || (profile ? item.roles.includes(profile.role) : false)
  );

  return (
    <aside className="w-full rounded-3xl bg-slate-900 p-4 text-white shadow-lg lg:sticky lg:top-6 lg:h-fit lg:w-72">
      <p className="px-3 text-xs uppercase tracking-[0.35em] text-slate-400">Navigation</p>
      <nav className="mt-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = item.key === currentPage;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition ${
                isActive
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
              {isActive ? <span className="text-xs uppercase tracking-[0.2em]">Live</span> : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

