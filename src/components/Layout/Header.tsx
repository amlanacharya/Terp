import { useAuth } from '../../contexts/AuthContext';
import { PageKey } from '../../lib/types';

interface HeaderProps {
  onNavigate: (page: PageKey) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  const { profile, signOut } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 lg:px-6">
        <button type="button" onClick={() => onNavigate('dashboard')} className="text-left">
          <p className="text-xs uppercase tracking-[0.35em] text-sky-600">TravelERP</p>
          <h1 className="text-2xl font-semibold text-slate-900">Operations Console</h1>
        </button>

        <div className="flex items-center gap-4">
          <div className="hidden rounded-2xl bg-slate-100 px-4 py-2 text-right sm:block">
            <p className="text-sm font-medium text-slate-900">{profile?.full_name ?? 'Guest'}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{profile?.role ?? 'viewer'}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
