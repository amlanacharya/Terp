import { FormEvent, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl bg-slate-900 p-10 text-white shadow-2xl">
          <p className="text-sm uppercase tracking-[0.4em] text-sky-300">TravelERP</p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">
            Local fleet operations, billing, and settlements in one workflow.
          </h1>
          <p className="mt-6 max-w-xl text-base text-slate-300">
            This build runs against a local Express API and PostgreSQL database. Use the seeded admin account to verify the migration.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">Default login</p>
              <p className="mt-2 font-medium">admin@travelerp.com</p>
              <p className="text-sm text-slate-300">Admin@123456</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">Backend</p>
              <p className="mt-2 font-medium">http://localhost:3001/api</p>
              <p className="text-sm text-slate-300">JWT auth + PostgreSQL</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-xl">
          <h2 className="text-3xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-2 text-sm text-slate-600">Access the operations dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-sky-500 focus:outline-none"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 focus:border-sky-500 focus:outline-none"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Contact your administrator if you need another role.
          </p>
        </div>
      </div>
    </div>
  );
}
