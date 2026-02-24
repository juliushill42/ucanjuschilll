import { auth } from '@/auth'
import { MainNav } from '@/components/layout/MainNav'
import { Feed } from '@/components/feed/Feed'
import { Flame, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default async function HomePage() {
  const session = await auth()

  return (
    <div className="flex">
      <MainNav />
      <main className="ml-64 flex-1 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Hero for non-logged-in users */}
          {!session && (
            <div className="card p-8 mb-6 bg-gradient-to-br from-brand-500/10 to-surface-1 border-brand-500/20">
              <h1 className="text-3xl font-bold text-white mb-2">You can jus chill. 💯</h1>
              <p className="text-white/60 mb-5 leading-relaxed">
                No algorithm. No gatekeeping. Your bedroom is your studio — record, produce, and share your art with the world.
              </p>
              <div className="flex gap-3">
                <Link href="/register" className="btn-primary">Join Free</Link>
                <Link href="/explore" className="btn-secondary">Explore Music</Link>
              </div>
            </div>
          )}

          {/* Feed tabs */}
          <FeedTabs hasSession={!!session} />
        </div>
      </main>

      {/* Right sidebar */}
      <aside className="w-72 p-6 space-y-5 hidden xl:block">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            <h3 className="font-semibold text-white text-sm">Trending Genres</h3>
          </div>
          <div className="space-y-2">
            {['Hip-Hop', 'R&B', 'Afrobeats', 'Gospel', 'Lo-Fi', 'Drill'].map((genre, i) => (
              <Link
                key={genre}
                href={`/explore?genre=${genre}`}
                className="flex items-center justify-between text-sm py-1 text-white/60 hover:text-white transition-colors"
              >
                <span>#{genre.toLowerCase().replace(/\s/g, '')}</span>
                <span className="text-xs text-white/30">#{i + 1}</span>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

function FeedTabs({ hasSession }: { hasSession: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-4 bg-surface-1 p-1 rounded-xl">
        <a
          href="/?tab=explore"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-surface-3 text-white"
        >
          <Flame className="w-4 h-4 text-brand-400" />
          Explore
        </a>
        {hasSession && (
          <a
            href="/?tab=following"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-white/50 hover:text-white transition-colors"
          >
            <Users className="w-4 h-4" />
            Following
          </a>
        )}
        <a
          href="/?tab=trending"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-white/50 hover:text-white transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          Trending
        </a>
      </div>

      <Feed type="explore" />
    </div>
  )
}
