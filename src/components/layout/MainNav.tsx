'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  Home, Compass, Music2, Video, Radio, User, LogOut,
  PlusCircle, Bell, Settings, Mic2
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import Image from 'next/image'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/explore', icon: Compass, label: 'Explore' },
  { href: '/shows', icon: Radio, label: 'Shows' },
]

const STUDIO_ITEMS = [
  { href: '/studio/record', icon: Mic2, label: 'Record Audio' },
  { href: '/studio/video', icon: Video, label: 'Record Video' },
]

export function MainNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-1 border-r border-white/5 flex flex-col z-40 overflow-y-auto">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center glow-brand-sm">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-lg leading-none">JusChill</div>
            <div className="text-xs text-white/40 mt-0.5">Voice & Vision</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {/* Main nav */}
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
              pathname === href
                ? 'bg-brand-500/15 text-brand-400 font-medium'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}

        {/* Studio section */}
        <div className="pt-4 pb-2">
          <div className="px-3 text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">
            Studio
          </div>
          {STUDIO_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
                pathname === href
                  ? 'bg-brand-500/15 text-brand-400 font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}

          <Link
            href="/studio"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 mt-1',
              'bg-brand-500 text-white font-medium hover:bg-brand-600 glow-brand-sm'
            )}
          >
            <PlusCircle className="w-5 h-5" />
            Create & Publish
          </Link>
        </div>

        {/* User nav */}
        {session?.user && (
          <div className="pt-4">
            <div className="px-3 text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">
              You
            </div>
            <Link
              href={`/profile/${session.user.username}`}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
                pathname === `/profile/${session.user.username}`
                  ? 'bg-brand-500/15 text-brand-400 font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <User className="w-5 h-5" />
              Profile
            </Link>
            <Link
              href="/notifications"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all duration-150"
            >
              <Bell className="w-5 h-5" />
              Notifications
            </Link>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/5 p-3">
        {session?.user ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? ''}
                  width={36}
                  height={36}
                  className="rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-brand-400">
                  {getInitials(session.user.name ?? 'U')}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{session.user.name}</div>
              <div className="text-xs text-white/40 truncate">@{session.user.username}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 text-white/30 hover:text-white/60 transition-colors rounded-lg hover:bg-white/5"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Link href="/login" className="btn-secondary w-full justify-center text-sm py-2">
              Sign In
            </Link>
            <Link href="/register" className="btn-primary w-full justify-center text-sm py-2">
              Join Free
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}
