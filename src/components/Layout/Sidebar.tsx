import { useEffect, useMemo, useState } from 'react';
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

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

const dashboardItem: NavItem = { key: 'dashboard', label: 'Dashboard' };

const navGroups: NavGroup[] = [
  {
    key: 'admin',
    label: 'Admin',
    items: [
      { key: 'leads', label: 'Leads' },
      { key: 'rate-charts', label: 'Rate Charts' },
      { key: 'tax-config', label: 'Tax Config', roles: ['admin', 'accountant'] },
      { key: 'vehicles', label: 'Vehicles' },
      { key: 'vehicle-categories', label: 'Vehicle Categories' },
    ],
  },
  {
    key: 'personnel-data',
    label: 'Personnel Data',
    items: [
      { key: 'customers', label: 'Customers' },
      { key: 'drivers', label: 'Drivers' },
      { key: 'owners', label: 'Vehicle Owners' },
    ],
  },
  {
    key: 'duty-records',
    label: 'Duty Records',
    items: [
      { key: 'trips', label: 'Duty Slips' },
      { key: 'annexures', label: 'Annexures' },
    ],
  },
  {
    key: 'invoices-payments',
    label: 'Invoices and Payments',
    items: [
      { key: 'invoices', label: 'Customer Invoices', roles: ['admin', 'manager', 'accountant'] },
      { key: 'driver-settlements', label: 'Salary Slips', roles: ['admin', 'manager', 'accountant'] },
      { key: 'collections', label: 'Payment Receipts', roles: ['admin', 'manager', 'accountant'] },
      { key: 'owner-settlements', label: 'Vehicle Owner Invoices', roles: ['admin', 'manager', 'accountant'] },
    ],
  },
  {
    key: 'reports-settings',
    label: 'Reports and Settings',
    items: [
      { key: 'reports', label: 'Reports' },
      { key: 'settings', label: 'Settings', roles: ['admin'] },
    ],
  },
];

function isItemVisible(item: NavItem, role: UserRole | undefined): boolean {
  return !item.roles || (role ? item.roles.includes(role) : false);
}

export function Sidebar({ onNavigate, currentPage }: SidebarProps) {
  const { profile } = useAuth();

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => isItemVisible(item, profile?.role)),
        }))
        .filter((group) => group.items.length > 0),
    [profile?.role]
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((group) => [group.key, false]))
  );

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };

      visibleGroups.forEach((group) => {
        if (next[group.key] === undefined) {
          next[group.key] = true;
        }
        if (group.items.some((item) => item.key === currentPage)) {
          next[group.key] = true;
        }
      });

      return next;
    });
  }, [currentPage, visibleGroups]);

  function toggleGroup(groupKey: string) {
    setOpenGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  return (
    <aside className="w-full rounded-3xl bg-slate-900 p-4 text-white shadow-lg lg:sticky lg:top-6 lg:h-fit lg:w-80">
      <p className="px-3 text-xs uppercase tracking-[0.35em] text-slate-400">Navigation</p>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => onNavigate(dashboardItem.key)}
          className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition ${
            currentPage === dashboardItem.key
              ? 'bg-sky-500 text-white'
              : 'text-slate-200 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span>{dashboardItem.label}</span>
          {currentPage === dashboardItem.key ? <span className="text-xs uppercase tracking-[0.2em]">Live</span> : null}
        </button>
      </div>

      <nav className="mt-4 space-y-3">
        {visibleGroups.map((group) => {
          const isOpen = openGroups[group.key] ?? true;
          const hasActiveItem = group.items.some((item) => item.key === currentPage);

          return (
            <section key={group.key} className="rounded-2xl border border-white/10 bg-white/5">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center justify-between px-3 py-3 text-left"
              >
                <span className="text-xs uppercase tracking-[0.22em] text-slate-300">{group.label}</span>
                <span className={`text-base font-bold leading-none ${hasActiveItem ? 'text-sky-300' : 'text-slate-400'}`}>
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {isOpen ? (
                <div className="space-y-1 px-2 pb-2">
                  {group.items.map((item) => {
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
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
