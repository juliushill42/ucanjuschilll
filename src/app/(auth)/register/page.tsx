'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Music2, Loader2, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { GENRES } from '@/lib/utils'

export default function RegisterPage() {
  const router = useRouter()
  const { add: toast } = useToast()
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    username: '',
    genre: '',
  })

  const update = (field: keyof typeof form, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    // Auto-generate username from display name
    if (field === 'displayName' && !form.username) {
      setForm(f => ({
        ...f,
        displayName: value,
        username: value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20),
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1) {
      if (!form.displayName || !form.email || !form.password) return
      if (form.password.length < 8) {
        toast('Password must be at least 8 characters', 'error')
        return
      }
      setStep(2)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) {
        toast(data.error ?? 'Registration failed', 'error')
        setLoading(false)
        return
      }

      // Auto sign in
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      })

      if (result?.error) {
        toast('Account created! Please sign in.', 'success')
        router.push('/login')
        return
      }

      toast('Welcome to JusChill! 💯', 'success')
      router.push('/')
      router.refresh()
    } catch {
      toast('Registration failed. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 animate-slide-up">
        <div className="text-center">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 glow-brand">
            <Music2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Join JusChill</h1>
          <p className="text-white/50 text-sm mt-1">
            {step === 1 ? 'Your stage is waiting.' : 'What kind of artist are you?'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-brand-500' : 'bg-surface-3'}`} />
          <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-brand-500' : 'bg-surface-3'}`} />
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                <div>
                  <label className="label">Your Artist Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="What do they call you?"
                    value={form.displayName}
                    onChange={(e) => update('displayName', e.target.value)}
                    maxLength={50}
                    required
                  />
                </div>

                <div>
                  <label className="label">Username</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">@</span>
                    <input
                      type="text"
                      className="input pl-8"
                      placeholder="yourusername"
                      value={form.username}
                      onChange={(e) => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30))}
                      maxLength={30}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-11"
                      placeholder="At least 8 characters"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <div>
                <label className="label">Primary Genre (optional)</label>
                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                  {GENRES.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => update('genre', form.genre === g ? '' : g)}
                      className={`px-2 py-2 rounded-xl text-xs font-medium transition-all ${
                        form.genre === g
                          ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                          : 'bg-surface-2 text-white/50 border border-white/5 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (step === 1 && (!form.displayName || !form.email || !form.password))}
              className="btn-primary w-full justify-center py-3"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Creating account...' : step === 1 ? 'Continue →' : 'Join JusChill 💯'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-white/40">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
