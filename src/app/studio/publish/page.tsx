'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2, Wand2, Music2, Tag, Globe, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { GENRES, cn } from '@/lib/utils'
import Link from 'next/link'

export default function PublishPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { add: toast } = useToast()

  const audioUrl = searchParams.get('audioUrl')
  const videoUrl = searchParams.get('videoUrl')
  const thumbnailUrl = searchParams.get('thumbnailUrl')
  const duration = parseFloat(searchParams.get('duration') ?? '0')
  const rawWaveform = searchParams.get('waveform')
  const waveformData = rawWaveform ? JSON.parse(decodeURIComponent(rawWaveform)) : []
  const transcription = decodeURIComponent(searchParams.get('transcription') ?? '')
  const postType = searchParams.get('type') ?? (videoUrl ? 'VIDEO' : 'AUDIO')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [published, setPublished] = useState(false)

  if (!session) {
    router.replace('/login')
    return null
  }

  if (!audioUrl && !videoUrl) {
    router.replace('/studio')
    return null
  }

  const handleAIFill = async () => {
    if (!transcription && !title) {
      toast('Record some audio first so AI can generate metadata', 'info')
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'description',
          transcription: transcription || title,
          genre: genre || 'Hip-Hop',
        }),
      })

      if (!res.ok) throw new Error()
      const data = await res.json()

      if (!title) setTitle(data.result.title)
      if (!description) setDescription(data.result.description)
      if (data.result.tags.length > 0) setTags(data.result.tags)

      toast('AI filled in your post details!', 'success')
    } catch {
      toast('AI generation failed. Fill in manually.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const addTag = () => {
    const cleaned = tagInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (cleaned && !tags.includes(cleaned) && tags.length < 10) {
      setTags([...tags, cleaned])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handlePublish = async () => {
    if (!title.trim()) {
      toast('Add a title for your post', 'info')
      return
    }
    if (!genre) {
      toast('Select a genre', 'info')
      return
    }

    setIsPublishing(true)

    try {
      const captions = transcription
        ? [{ language: 'en', startTime: 0, endTime: duration, text: transcription }]
        : []

      const body = {
        title: title.trim(),
        description: description.trim() || null,
        type: postType,
        genre,
        tags,
        audioUrl: audioUrl || null,
        videoUrl: videoUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        waveformData: waveformData.length > 0 ? waveformData : null,
        duration: duration || null,
        captions,
        aiProcessed: true,
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Publish failed')
      }

      const data = await res.json()
      setPublished(true)

      setTimeout(() => {
        router.push(`/post/${data.post.id}`)
      }, 2000)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Publish failed. Please try again.', 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  if (published) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center space-y-4 animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">You're live! 💯</h2>
          <p className="text-white/50">Taking you to your post...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <div className="glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/studio" className="btn-ghost text-sm">← Back</Link>
          <div className="w-px h-5 bg-white/10" />
          <span className="font-semibold text-white">Publish to JusChill</span>
        </div>
        <button
          onClick={handleAIFill}
          disabled={isGenerating}
          className="btn-secondary text-sm"
        >
          {isGenerating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Wand2 className="w-4 h-4" />
          }
          AI Fill
        </button>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-5">

        {/* Media preview */}
        <div className="card p-4 flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            postType === 'AUDIO' ? 'bg-purple-500/20' : 'bg-blue-500/20'
          )}>
            {postType === 'AUDIO'
              ? <Music2 className="w-6 h-6 text-purple-400" />
              : <Globe className="w-6 h-6 text-blue-400" />
            }
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              {postType === 'AUDIO' ? 'Audio Track' : 'Video'}
            </div>
            <div className="text-xs text-white/40">
              {duration > 0 ? `${Math.round(duration)}s` : 'Ready to publish'}
              {transcription && ' · Transcribed'}
            </div>
          </div>
          <div className="ml-auto text-green-400 text-xs font-medium bg-green-500/10 px-2.5 py-1 rounded-full">
            Uploaded ✓
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="label">Title *</label>
          <input
            type="text"
            className="input"
            placeholder="Give your track a name..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
          <div className="text-xs text-white/20 text-right mt-1">{title.length}/100</div>
        </div>

        {/* Description */}
        <div>
          <label className="label">Description</label>
          <textarea
            className="input h-24 resize-none"
            placeholder="Tell your story... what's this track about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
          <div className="text-xs text-white/20 text-right mt-1">{description.length}/500</div>
        </div>

        {/* Genre */}
        <div>
          <label className="label">Genre *</label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
                  genre === g
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                    : 'text-white/40 hover:text-white/70 border border-white/5 hover:border-white/10'
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="label">Tags (up to 10)</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
              maxLength={30}
            />
            <button onClick={addTag} className="btn-secondary px-4">
              <Tag className="w-4 h-4" />
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="badge bg-surface-3 text-brand-400 cursor-pointer hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  onClick={() => removeTag(tag)}
                >
                  #{tag} ×
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Transcription preview */}
        {transcription && (
          <div className="card p-4 space-y-2">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wide">
              Auto Captions (AI Transcription)
            </div>
            <p className="text-sm text-white/70 line-clamp-3">{transcription}</p>
            <div className="text-xs text-green-400">✓ Will be published as captions</div>
          </div>
        )}

        {/* Publish button */}
        <button
          onClick={handlePublish}
          disabled={isPublishing || !title.trim() || !genre}
          className="btn-primary w-full justify-center py-4 text-base glow-brand"
        >
          {isPublishing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Globe className="w-5 h-5" />
              Publish to JusChill 💯
            </>
          )}
        </button>

        <p className="text-center text-xs text-white/20">
          By publishing you agree to our community guidelines. Keep it real.
        </p>
      </div>
    </div>
  )
}
