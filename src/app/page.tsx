import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* THE GIRL STAYS */}
      <div 
        className="absolute inset-0 z-0 opacity-60 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero.jpg')" }} 
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/70 via-transparent to-black" />

      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="max-w-5xl space-y-10">
          <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-white">
            You can <span className="text-cyan-400">jus chill.</span> <span className="text-red-500 italic">100</span>
          </h1>

          <p className="mx-auto max-w-3xl text-lg md:text-2xl leading-relaxed text-white/90 font-medium">
            Whether you're a small-town girl who can sing, a country dude with the gift of drawing, 
            or someone who feels invisible  this space is for you.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-10">
            <Link href="/studio/record" className="px-12 py-5 bg-cyan-500 text-black font-black rounded-2xl hover:bg-white transition-all shadow-lg">
              NEW AUDIO RECORDING
            </Link>
            <Link href="/studio/video" className="px-12 py-5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black rounded-2xl hover:bg-white hover:text-black transition-all">
              NEW VIDEO STUDIO
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
