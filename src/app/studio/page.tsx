import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Mic2, Video, Wand2, Music2, ArrowRight } from 'lucide-react'
import { MainNav } from '@/components/layout/MainNav'

export default async function StudioPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="flex">
      <MainNav />
      <main className="ml-64 flex-1 min-h-screen p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Voice & Vision Studio</h1>
            <p className="text-white/50">Your bedroom is your studio. What are you creating today?</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/studio/record"
              className="card p-8 group hover:border-purple-500/30 transition-all duration-200 hover:bg-surface-2"
            >
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                <Mic2 className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Record Audio</h3>
              <p className="text-white/50 text-sm mb-4">Record vocals, spoken word, or any audio. AI handles mixing, mastering, and transcription automatically.</p>
              <div className="flex items-center gap-1 text-purple-400 text-sm font-medium">
                Start Recording <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            <Link
              href="/studio/video"
              className="card p-8 group hover:border-blue-500/30 transition-all duration-200 hover:bg-surface-2"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
                <Video className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Record Video</h3>
              <p className="text-white/50 text-sm mb-4">Shoot a music video, performance, or vlog straight from your camera. No studio needed.</p>
              <div className="flex items-center gap-1 text-blue-400 text-sm font-medium">
                Open Camera <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>

          {/* What AI does for you */}
          <div className="card p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-brand-400" />
              The AI Studio Engine — what it does for you
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '🎙️', title: 'Noise Reduction', desc: 'Removes AC units, traffic, background sounds' },
                { icon: '🎚️', title: 'Compression & EQ', desc: 'Professional vocal dynamics automatically applied' },
                { icon: '🎵', title: 'Reverb Mix', desc: 'Tasteful room sound without sounding muddy' },
                { icon: '✍️', title: 'Auto Captions', desc: 'Whisper AI transcribes and timestamps your words' },
                { icon: '✂️', title: 'Smart Cut Detection', desc: 'Identifies filler words and silences for removal' },
                { icon: '🌐', title: 'Auto Metadata', desc: 'GPT-4o writes your title, description, and tags' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{icon}</span>
                  <div>
                    <div className="text-sm font-medium text-white">{title}</div>
                    <div className="text-xs text-white/40 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
