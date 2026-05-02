'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/explore', label: 'Feed', icon: '⚡' },
  { href: '/explore', label: 'Explore', icon: '🔍' },
  { href: '/studio', label: 'Studio', icon: '🎙️' },
  { href: '/upload', label: 'Drop', icon: '➕' },
];

export default function Nav() {
  const pathname = usePathname();
  const { user, initialize, initialized } = useAuth();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-dark-900 border-r border-dark-700 z-50 hidden md:flex flex-col p-6">
        <Link href="/" className="mb-10 group">
          <h1 className="font-display text-xl tracking-widest text-white group-hover:text-brand-400 transition-colors">UCANJUSCHILL</h1>
          <p className="text-xs text-gray-600 mt-0.5 font-body">Where the culture lives</p>
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl font-sans font-medium transition-all duration-150 text-sm',
                pathname === item.href
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                  : 'text-gray-500 hover:text-white hover:bg-dark-700'
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto">
          {user ? (
            <div className="flex flex-col gap-2">
              <Link
                href={`/profile/${user.username}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-dark-700 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/30 overflow-hidden flex-shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-400 font-bold text-sm">
                      {user.display_name[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-sans font-semibold text-sm text-white truncate">{user.display_name}</p>
                  <p className="text-xs text-gray-500 truncate font-body">@{user.username}</p>
                </div>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href="/login" className="btn-ghost text-center text-sm">Sign in</Link>
              <Link href="/register" className="btn-primary text-center text-sm">Join the movement</Link>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-900/95 backdrop-blur border-t border-dark-700 z-50 flex md:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={clsx(
              'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-sans font-medium transition-colors',
              pathname === item.href ? 'text-brand-400' : 'text-gray-600'
            )}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        {user ? (
          <Link
            href={`/profile/${user.username}`}
            className={clsx(
              'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-sans font-medium transition-colors',
              pathname.startsWith('/profile') ? 'text-brand-400' : 'text-gray-600'
            )}
          >
            <span className="text-lg">👤</span>
            Me
          </Link>
        ) : (
          <Link href="/login" className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-sans font-medium text-gray-600">
            <span className="text-lg">🔑</span>
            Login
          </Link>
        )}
      </nav>
    </>
  );
}
