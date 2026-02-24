'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { register, user, initialized, initialize } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!initialized) initialize(); }, [initialized, initialize]);
  useEffect(() => { if (user && initialized) router.push('/studio'); }, [user, initialized, router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form);
      router.push('/studio');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed. Username or email may be taken.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dark-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-extrabold text-brand-500 mb-1">JusChill 💯</h1>
          <p className="text-gray-500 text-sm">Your stage. Your rules. No algorithm needed.</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Artist Name</label>
            <input className="input" placeholder="How the world knows you" value={form.display_name} onChange={set('display_name')} required maxLength={100} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
              <input className="input pl-8" placeholder="yourhandle" value={form.username} onChange={set('username')} required minLength={3} maxLength={30} pattern="[a-zA-Z0-9]+" autoComplete="username" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required autoComplete="email" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Password</label>
            <input className="input" type="password" placeholder="At least 8 characters" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating account...
              </span>
            ) : "Let's Go 🚀"}
          </button>

          <p className="text-xs text-gray-600 text-center">
            By joining, you agree to let your art speak for itself.
          </p>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already in?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
