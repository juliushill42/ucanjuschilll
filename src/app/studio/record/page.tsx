'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Mic, MicOff, Play, Pause, Square, RotateCcw,
  Upload, Wand2, Loader2, Volume2, Settings2,
  ChevronRight, Music2
} from 'lucide-react'
import { useAudioStudio } from '@/hooks/useAudioStudio'
import { formatDuration, GENRES } from '@/lib/utils'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function AudioRecordPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { add: toast } = useToast()
  const {
    state, error, duration, volume, track, settings,
    requestMic, startRecording, pauseRecording, resumeRecording, stopRecording, reset, updateSettings
  } = useAudioStudio()

  const [showSettings, setShowSettings] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcription, setTranscription] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)

  if (!session) {
    router.replace('/login')
    return null
  }

  const handleTranscribe = async () => {
    if (!track) return
    setIsTranscribing(true)

    try {
      const formData = new FormData()
      formData.append('file', track.blob, 'recording.webm')
      formData.append('smartCut', 'true')

      const res = await fetch('/api/ai/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Transcription failed')

      const data = await res.json()
      setTranscription(data.transcription.text)

      const removed = data.smartCut?.fillerWordsRemoved ?? 0
      if (removed > 0) {
        toast(`Removed ${removed} filler word${removed !== 1 ? 's' : ''}`, 'success')
      }
    } catch {
      toast('Transcription failed. Please try again.', 'error')
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleUpload = async () => {
    if (!track) return
    setIsUploading(true)
    setUploadProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', track.blob, 'recording.webm')
      formData.append('type', 'audio')

      setUploadProgress(30)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      setUploadProgress(80)

      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()

      setUploadedUrl(data.url)
      setUploadProgress(100)
      toast('Audio uploaded! Now publish it.', 'success')
    } catch {
      toast('Upload failed. Please try again.', 'error')
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  const togglePreview = () => {
    if (!track) return
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(track.url)
      previewAudioRef.current.onended = () => setIsPreviewPlaying(false)
    }
    if (isPreviewPlaying) {
      previewAudioRef.current.pause()
      setIsPreviewPlaying(false)
    } else {
      previewAudioRef.current.play()
      setIsPreviewPlaying(true)
    }
  }

  const handlePublish = () => {
    if (!uploadedUrl) {
      toast('Upload your recording first', 'info')
      return
    }
    router.push(`/studio/publish?audioUrl=${encodeURIComponent(uploadedUrl)}&duration=${track?.duration ?? 0}&waveform=${encodeURIComponent(JSON.stringify(track?.waveformData ?? []))}&transcription=${encodeURIComponent(transcription ?? '')}`)
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Header */}
      <div className="glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/studio" className="btn-ghost text-sm">
            ← Studio
          </Link>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-brand-400" />
            <span className="font-semibold text-white">Audio Recording</span>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn('btn-ghost text-sm', showSettings && 'text-brand-400')}
        >
          <Settings2 className="w-4 h-4" />
          Settings
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">

          {/* Settings panel */}
          {showSettings && (
            <div className="card p-5 space-y-4 animate-slide-up">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-brand-400" />
                Audio Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'noiseReduction', label: 'Noise Reduction', desc: 'Remove background noise' },
                  { key: 'echoCancellation', label: 'Echo Cancellation', desc: 'Remove room echo' },
                  { key: 'autoGainControl', label: 'Auto Gain', desc: 'Balance input levels' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[key as keyof typeof settings] as boolean}
                      onChange={(e) => updateSettings({ [key]: e.target.checked })}
                      className="mt-0.5 w-4 h-4 accent-brand-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">{label}</div>
                      <div className="text-xs text-white/40">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <label className="label">Reverb ({Math.round(settings.reverb * 100)}%)</label>
                <input
                  type="range"
                  min="0" max="100" value={Math.round(settings.reverb * 100)}
                  onChange={(e) => updateSettings({ reverb: parseInt(e.target.value) / 100 })}
                  className="w-full accent-brand-500"
                />
              </div>
              <div className="space-y-2">
                <label className="label">Compression ({Math.round(settings.compression * 100)}%)</label>
                <input
                  type="range"
                  min="0" max="100" value={Math.round(settings.compression * 100)}
                  onChange={(e) => updateSettings({ compression: parseInt(e.target.value) / 100 })}
                  className="w-full accent-brand-500"
                />
              </div>
            </div>
          )}

          {/* Main recording UI */}
          <div className="card p-8 text-center space-y-8">

            {/* State-based display */}
            {state === 'idle' && (
              <div className="space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface-2 flex items-center justify-center mx-auto">
                  <Mic className="w-10 h-10 text-white/30" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">Ready to record?</h2>
                  <p className="text-white/50 text-sm">Your mic will be processed through the AI audio engine — noise reduction, compression, and vocal enhancement applied automatically.</p>
                </div>
                <button onClick={requestMic} className="btn-primary mx-auto">
                  <Mic className="w-4 h-4" />
                  Set Up Microphone
                </button>
              </div>
            )}

            {state === 'error' && (
              <div className="space-y-4">
                <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                  <MicOff className="w-10 h-10 text-red-400" />
                </div>
                <p className="text-red-400 text-sm">{error}</p>
                <button onClick={requestMic} className="btn-secondary mx-auto">
                  Try Again
                </button>
              </div>
            )}

            {(state === 'ready' || state === 'recording' || state === 'paused') && (
              <div className="space-y-6">
                {/* Timer */}
                <div className="text-5xl font-mono font-bold tracking-widest text-white">
                  {formatDuration(duration)}
                </div>

                {/* Volume meter */}
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-white/30 flex-shrink-0" />
                  <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-75',
                        volume > 0.8 ? 'bg-red-500' : volume > 0.5 ? 'bg-yellow-500' : 'bg-brand-500'
                      )}
                      style={{ width: `${volume * 100}%` }}
                    />
                  </div>
                  <Volume2 className="w-5 h-5 text-white/30 flex-shrink-0" />
                </div>

                {/* Waveform bars when recording */}
                {state === 'recording' && (
                  <div className="flex items-center justify-center gap-0.5 h-12">
                    {Array.from({ length: 48 }).map((_, i) => (
                      <div
                        key={i}
                        className="waveform-bar"
                        style={{
                          height: `${Math.random() * 80 + 10}%`,
                          animationDelay: `${(i * 25) % 1200}ms`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {state === 'ready' && (
                  <p className="text-white/40 text-sm">Microphone ready — tap record when you are</p>
                )}
                {state === 'paused' && (
                  <p className="text-yellow-400 text-sm">Recording paused</p>
                )}

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  {state === 'ready' && (
                    <button
                      onClick={startRecording}
                      className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center recording-pulse hover:bg-brand-600 transition-colors"
                    >
                      <Mic className="w-7 h-7 text-white" />
                    </button>
                  )}

                  {state === 'recording' && (
                    <>
                      <button onClick={pauseRecording} className="btn-secondary">
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                      <button
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors recording-pulse"
                      >
                        <Square className="w-6 h-6 text-white" />
                      </button>
                    </>
                  )}

                  {state === 'paused' && (
                    <>
                      <button onClick={resumeRecording} className="btn-primary">
                        <Mic className="w-4 h-4" />
                        Resume
                      </button>
                      <button onClick={stopRecording} className="btn-secondary">
                        <Square className="w-4 h-4" />
                        Finish
                      </button>
                    </>
                  )}

                  {state !== 'idle' && (
                    <button onClick={reset} className="btn-ghost text-sm">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {state === 'processing' && (
              <div className="space-y-4">
                <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto" />
                <p className="text-white/60">Processing your recording...</p>
              </div>
            )}

            {state === 'done' && track && (
              <div className="space-y-6">
                <div className="text-4xl font-mono font-bold text-white">
                  {formatDuration(track.duration)}
                </div>

                {/* Waveform visualization */}
                <div className="flex items-center gap-px h-16">
                  {track.waveformData.map((val, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full bg-brand-500/70"
                      style={{ height: `${Math.max(val * 100, 4)}%` }}
                    />
                  ))}
                </div>

                {/* AI Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={togglePreview}
                    className="btn-secondary"
                  >
                    {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPreviewPlaying ? 'Pause' : 'Preview'}
                  </button>

                  <button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    className="btn-secondary"
                  >
                    {isTranscribing
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Wand2 className="w-4 h-4" />
                    }
                    {isTranscribing ? 'Transcribing...' : 'AI Transcribe'}
                  </button>
                </div>

                {transcription && (
                  <div className="bg-surface-2 rounded-xl p-4 text-left">
                    <div className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wide">Transcription</div>
                    <p className="text-sm text-white/80 leading-relaxed">{transcription}</p>
                  </div>
                )}

                {/* Upload & Publish */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  {!uploadedUrl ? (
                    <button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="btn-primary w-full justify-center"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading {uploadProgress}%...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload to Cloud
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handlePublish}
                      className="btn-primary w-full justify-center glow-brand"
                    >
                      <Music2 className="w-4 h-4" />
                      Publish to JusChill
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  <button onClick={reset} className="btn-ghost w-full justify-center text-sm text-white/40">
                    <RotateCcw className="w-4 h-4" />
                    Record Again
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tips */}
          {state === 'idle' && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🎙️', title: 'Bedroom Quality', desc: 'AI removes noise, echo, and background sounds' },
                { icon: '🎚️', title: 'Auto Mixed', desc: 'Compression and EQ applied automatically' },
                { icon: '✍️', title: 'Auto Captions', desc: 'Whisper AI transcribes your vocals' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="card p-4 text-center">
                  <div className="text-2xl mb-2">{icon}</div>
                  <div className="text-sm font-semibold text-white mb-1">{title}</div>
                  <div className="text-xs text-white/40">{desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
