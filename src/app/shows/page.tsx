import { MainNav } from '@/components/layout/MainNav'
import { Radio, Mic2, Music2 } from 'lucide-react'
import { Feed } from '@/components/feed/Feed'

export default function ShowsPage() {
  return (
    <div className="flex">
      <MainNav />
      <main className="ml-64 flex-1 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Radio className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold text-white">Shows</h1>
          </div>
          <p className="text-white/50 text-sm mb-6">
            Live sessions, cyphers, showcases, and community events.
          </p>

          {/* Featured shows placeholder */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { icon: '🎤', title: 'Open Mic Wednesdays', desc: 'Drop your verse. No filters.', color: 'from-purple-500/20 to-surface-2' },
              { icon: '🎵', title: 'Producer Showcase', desc: 'Beat makers doing their thing.', color: 'from-blue-500/20 to-surface-2' },
              { icon: '🌍', title: 'Global Cypher', desc: 'Artists from every time zone.', color: 'from-green-500/20 to-surface-2' },
              { icon: '🔥', title: 'New Drops Friday', desc: 'Fresh releases every week.', color: 'from-brand-500/20 to-surface-2' },
            ].map(({ icon, title, desc, color }) => (
              <div
                key={title}
                className={`card p-5 bg-gradient-to-br ${color} cursor-pointer hover:border-white/10 transition-all`}
              >
                <span className="text-3xl mb-3 block">{icon}</span>
                <h3 className="font-semibold text-white mb-1">{title}</h3>
                <p className="text-white/50 text-xs">{desc}</p>
                <div className="mt-3 text-xs text-brand-400 font-medium">Coming Soon</div>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-semibold text-white mb-4">Latest Drops</h2>
          <Feed type="trending" />
        </div>
      </main>
    </div>
  )
}
