'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const GENRES = ['Hip-Hop', 'R&B', 'Trap', 'Afrobeats', 'Gospel', 'Soul', 'Lo-fi', 'Reggae', 'Jazz', 'Electronic', 'Pop', 'Country'];

export default function LandingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-dark-900 overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass">
        <span className="font-display text-2xl tracking-widest text-white">UCANJUSCHILL</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">Sign in</Link>
          <Link href="/register" className="btn-primary text-sm py-2 px-5">Join Free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Video background */}
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="/hero.mp4" type="video/mp4" />
          </video>
          {/* Overlays */}
          <div className="absolute inset-0 bg-dark-900/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-dark-900/60 via-transparent to-dark-900" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div
            className="transition-all duration-700"
            style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'translateY(0)' : 'translateY(30px)' }}
          >
            <p className="text-brand-400 text-xs tracking-[4px] uppercase font-body mb-6 font-medium">
              The Creator Platform Built Different
            </p>
          </div>

          <div
            className="transition-all duration-700 delay-100"
            style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'translateY(0)' : 'translateY(30px)' }}
          >
            <h1 className="font-display text-[clamp(64px,14vw,140px)] leading-none tracking-wide text-white mb-2">
              WHERE THE
            </h1>
            <h1 className="font-display text-[clamp(64px,14vw,140px)] leading-none tracking-wide glow-text text-brand-300 mb-2">
              CULTURE
            </h1>
            <h1 className="font-display text-[clamp(64px,14vw,140px)] leading-none tracking-wide text-white mb-8">
              LIVES
            </h1>
          </div>

          <div
            className="transition-all duration-700 delay-200"
            style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'translateY(0)' : 'translateY(30px)' }}
          >
            <p className="text-gray-300 text-lg font-body font-light max-w-xl mx-auto mb-10 leading-relaxed">
              Upload. Stream. Connect. Built for independent artists who refuse to wait on anyone's permission.
            </p>
          </div>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center transition-all duration-700 delay-300"
            style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'translateY(0)' : 'translateY(30px)' }}
          >
            <Link href="/register" className="btn-primary text-base py-3.5 px-10 rounded-2xl font-semibold animate-glow">
              Start Creating — It's Free
            </Link>
            <Link href="/explore" className="btn-ghost text-base py-3.5 px-10 rounded-2xl font-medium">
              Explore the Feed
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-white to-transparent animate-pulse" />
        </div>
      </section>

      {/* LIVE NOW BAR */}
      <section className="relative z-10 px-6 py-4">
        <div className="max-w-4xl mx-auto glass rounded-2xl px-6 py-4 flex items-center gap-4">
          <span className="flex items-center gap-2 text-red-400 text-xs font-semibold font-body tracking-wider shrink-0">
            <span className="live-dot" />
            LIVE NOW
          </span>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm text-white font-body truncate">Artists are streaming right now — <span className="text-brand-400">join the session</span></p>
          </div>
          <Link href="/explore" className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-semibold shrink-0">
            Watch →
          </Link>
        </div>
      </section>

      {/* GENRES */}
      <section className="relative z-10 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 text-xs tracking-[3px] uppercase font-body mb-6 text-center">Explore by Genre</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {GENRES.map((g) => (
              <Link
                key={g}
                href={`/explore?genre=${encodeURIComponent(g)}`}
                className="px-5 py-2 rounded-full text-sm font-body font-medium text-gray-400 border border-dark-600 hover:border-brand-500/50 hover:text-brand-300 hover:bg-brand-500/10 transition-all duration-200"
              >
                {g}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative z-10 px-6 py-12 border-t border-dark-700">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { n: '12K+', l: 'Independent Artists' },
            { n: '89K+', l: 'Tracks Uploaded' },
            { n: '340K+', l: 'Plays Today' },
            { n: '24/7', l: 'Live Streams' },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="font-display text-4xl text-brand-400 tracking-wider">{s.n}</div>
              <div className="text-gray-500 text-xs font-body mt-1 tracking-wide">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 px-6 py-20 border-t border-dark-700">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500 text-xs tracking-[3px] uppercase font-body mb-4 text-center">Built for Creators</p>
          <h2 className="font-display text-5xl md:text-6xl text-center text-white mb-16 tracking-wide">
            YOUR PLATFORM.<br /><span className="text-brand-400">YOUR RULES.</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: 'AI-Powered Studio', desc: 'Auto-master your tracks, remove noise, detect BPM, generate captions. Pro-quality output from your bedroom.' },
              { title: 'Live Streaming', desc: 'Go live to your fans in one click. RTMP-powered, low latency, real-time chat.' },
              { title: 'Your Revenue', desc: 'No middleman. No label. No permission needed. Monetize directly.' },
            ].map((f) => (
              <div key={f.title} className="card hover:border-brand-500/30 transition-all duration-200 group">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 mb-4 group-hover:bg-brand-500/20 transition-colors" />
                <h3 className="font-sans font-bold text-white mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm font-body leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center border-t border-dark-700">
        <h2 className="font-display text-[clamp(48px,10vw,100px)] leading-none text-white mb-6 tracking-wide">
          READY TO<br /><span className="text-brand-400 glow-text">CHILL?</span>
        </h2>
        <p className="text-gray-400 text-lg font-body mb-10 max-w-md mx-auto">
          Join thousands of independent artists already building their legacy.
        </p>
        <Link href="/register" className="btn-primary text-lg py-4 px-14 rounded-2xl inline-block animate-glow">
          Create Your Free Account
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-dark-700 px-6 py-8 text-center">
        <p className="font-display text-lg tracking-widest text-gray-600 mb-2">UCANJUSCHILL</p>
        <p className="text-gray-600 text-xs font-body">© 2026 UCanJusChill. Built by TitanU AI.</p>
      </footer>
    </div>
  );
}
