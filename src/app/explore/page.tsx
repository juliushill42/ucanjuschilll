import { MainNav } from '@/components/layout/MainNav'
import { Feed } from '@/components/feed/Feed'
import { Compass } from 'lucide-react'
import { GENRES } from '@/lib/utils'
import Link from 'next/link'

export default function ExplorePage({
  searchParams,
}: {
  searchParams: { genre?: string }
}) {
  const genre = searchParams.genre

  return (
    <div className="flex">
      <MainNav />
      <main className="ml-64 flex-1 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Compass className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold text-white">Explore</h1>
          </div>

          {/* Genre filters */}
          <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
            <Link
              href="/explore"
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                !genre
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-2 text-white/50 hover:text-white border border-white/5'
              }`}
            >
              All
            </Link>
            {GENRES.map(g => (
              <Link
                key={g}
                href={`/explore?genre=${encodeURIComponent(g)}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  genre === g
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-2 text-white/50 hover:text-white border border-white/5'
                }`}
              >
                {g}
              </Link>
            ))}
          </div>

          <Feed type="trending" genre={genre} />
        </div>
      </main>
    </div>
  )
}
