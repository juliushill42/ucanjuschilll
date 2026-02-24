'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Video, VideoOff, Square, RotateCcw, Upload, Loader2,
  FlipHorizontal, SwitchCamera, ChevronRight, Play, Pause
} from 'lucide-react'
import { useVideoStudio } from '@/hooks/useVideoStudio'
import { formatDuration } from '@/lib/utils'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'

export default function VideoRecordPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { add: toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedUrls, setUploadedUrls] = useState<{ videoUrl: string; thumbnailUrl: string } | null>(null)

  const {
    state, error, duration, track, settings,
    startPreview, startRecording, pauseRecording, resumeRecording, stopRecording, switchCamera, reset, updateSettings
  } = useVideoStudio()

  useEffect(() => {
    if (videoRef.current && state === 'idle') {
      startPreview(videoRef.current)
    }
  }, [state, startPreview])

  if (!session) {
    router.replace('/login')
    return null
  }

  const handleUpload = async () => {
    if (!track) return
    setIsUploading(true)

    try {
      // Upload video
      const videoForm = new FormData()
      videoForm.append('file', track.blob, 'recording.webm')
      videoForm.append('type', 'video')

      const videoRes = await fetch('/api/upload', { method: 'POST', body: videoForm })
      if (!videoRes.ok) throw new Error('Video upload failed')
      const videoData = await videoRes.json()

      let thumbUrl = videoData.url
      // Upload thumbnail if available
      if (track.thumbnailBlob) {
        const thumbForm = new FormData()
        thumbForm.append('file', track.thumbnailBlob, 'thumbnail.jpg')
        thumbForm.append('type', 'image')
        const thumbRes = await fetch('/api/upload', { method: 'POST', body: thumbForm })
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json()
          thumbUrl = thumbData.url
        }
      }

      setUploadedUrls({ videoUrl: videoData.url, thumbnailUrl: thumbUrl })
      toast('Video uploaded! Ready to publish.', 'success')
    } catch {
      toast('Upload failed. Please try again.', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const handlePublish = () => {
    if (!uploadedUrls) return
    router.push(
      `/studio/publish?videoUrl=${encodeURIComponent(uploadedUrls.videoUrl)}&thumbnailUrl=${encodeURIComponent(uploadedUrls.thumbnailUrl)}&duration=${track?.duration ?? 0}&type=VIDEO`
    )
  }

  const isRecordingActive = state === 'recording' || state === 'paused'

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Header */}
      <div className="glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/studio" className="btn-ghost text-sm">← Studio</Link>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white">Video Recording</span>
          </div>
        </div>
        {(state === 'preview' || isRecordingActive) && (
          <div className="flex items-center gap-2">
            <button
              onClick={switchCamera}
              className="btn-ghost text-sm"
              title="Switch camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateSettings({ flipHorizontal: !settings.flipHorizontal })}
              className={cn('btn-ghost text-sm', settings.flipHorizontal && 'text-brand-400')}
              title="Flip horizontal"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-4">

          {/* Camera viewfinder */}
          {(state === 'preview' || isRecordingActive) && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  'w-full h-full object-cover',
                  settings.flipHorizontal && 'scale-x-[-1]'
                )}
              />

              {/* Recording indicator */}
              {state === 'recording' && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5 backdrop-blur-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white text-sm font-mono font-bold">
                    {formatDuration(duration)}
                  </span>
                </div>
              )}

              {state === 'paused' && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5 backdrop-blur-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <span className="text-yellow-400 text-sm font-bold">PAUSED</span>
                </div>
              )}

              {/* Controls overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                {state === 'preview' && (
                  <button
                    onClick={startRecording}
                    className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors recording-pulse"
                  />
                )}

                {state === 'recording' && (
                  <>
                    <button
                      onClick={pauseRecording}
                      className="w-12 h-12 rounded-full bg-black/60 border border-white/30 flex items-center justify-center backdrop-blur-sm hover:bg-black/80 transition-colors"
                    >
                      <Pause className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={stopRecording}
                      className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors"
                    >
                      <Square className="w-6 h-6 text-white" />
                    </button>
                  </>
                )}

                {state === 'paused' && (
                  <>
                    <button
                      onClick={resumeRecording}
                      className="w-12 h-12 rounded-full bg-black/60 border border-white/30 flex items-center justify-center backdrop-blur-sm"
                    >
                      <Video className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={stopRecording}
                      className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors"
                    >
                      <Square className="w-6 h-6 text-white" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error state */}
          {state === 'error' && (
            <div className="card p-8 text-center space-y-4">
              <VideoOff className="w-12 h-12 text-red-400 mx-auto" />
              <p className="text-red-400">{error}</p>
              <button onClick={reset} className="btn-secondary mx-auto">Try Again</button>
            </div>
          )}

          {/* Idle state */}
          {state === 'idle' && (
            <div className="card p-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto" />
              <p className="text-white/60">Starting camera...</p>
            </div>
          )}

          {/* Done state — review */}
          {state === 'done' && track && (
            <div className="card p-6 space-y-5">
              <div className="text-center">
                <div className="text-3xl font-mono font-bold text-white mb-1">
                  {formatDuration(track.duration)}
                </div>
                <p className="text-white/40 text-sm">Recording complete</p>
              </div>

              {/* Thumbnail preview */}
              {track.thumbnailUrl && (
                <div className="relative rounded-xl overflow-hidden aspect-video">
                  <Image
                    src={track.thumbnailUrl}
                    alt="Recording thumbnail"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <a
                      href={track.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-14 h-14 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-brand-500/80 transition-colors border border-white/20"
                    >
                      <Play className="w-6 h-6 text-white ml-1" />
                    </a>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button onClick={reset} className="btn-secondary">
                  <RotateCcw className="w-4 h-4" />
                  Record Again
                </button>

                {!uploadedUrls ? (
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="btn-primary"
                  >
                    {isUploading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Upload className="w-4 h-4" />
                    }
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </button>
                ) : (
                  <button onClick={handlePublish} className="btn-primary glow-brand">
                    <ChevronRight className="w-4 h-4" />
                    Publish
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quality selector */}
          {(state === 'preview' || state === 'idle') && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">Quality:</span>
              {(['480p', '720p', '1080p'] as const).map(q => (
                <button
                  key={q}
                  onClick={() => updateSettings({ quality: q })}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                    settings.quality === q
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                      : 'text-white/30 hover:text-white/60 border border-white/5'
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
