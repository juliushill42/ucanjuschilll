'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ display_name: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(form);
      router.push('/explore');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not create account. Try a different username or email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/5 blur-3xl" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        <Link href="/" className="font-display text-2xl tracking-widest text-white mb-12 hover:text-brand-400 transition-colors">
          UCANJUSCHILL
        </Link>

        <div className="w-full max-w-sm">
          <h1 className="font-sans font-bold text-2xl text-white mb-1">Join the movement</h1>
          <p className="text-gray-500 text-sm font-body mb-8">Create your free account and start sharing</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-6 font-body">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-500 font-sans mb-1.5 block tracking-wide uppercase">Artist Name</label>
              <input type="text" className="input" placeholder="How the world knows you" value={form.display_name} onChange={set('display_name')} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-sans mb-1.5 block tracking-wide uppercase">Username</label>
              <input type="text" className="input" placeholder="@yourhandle" value={form.username} onChange={set('username')} required pattern="[a-zA-Z0-9_]+" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-sans mb-1.5 block tracking-wide uppercase">Email</label>
              <input type="email" className="input" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-sans mb-1.5 block tracking-wide uppercase">Password</label>
              <input type="password" className="input" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} required minLength={6} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 mt-2 text-base rounded-xl">
              {loading ? 'Creating account...' : 'Create Account — Free'}
            </button>
          </form>

          <p className="text-center text-gray-600 text-sm font-body mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
