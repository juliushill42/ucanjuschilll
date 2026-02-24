'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Heart, MessageCircle, Repeat2, Share2, Play, Pause,
  MoreHorizontal, BadgeCheck, Music2, Video
} from 'lucide-react'
import { cn, formatCount, formatDuration, formatTimeAgo, getInitials } from '@/lib/utils'
import type { PostWithUser } from '@/types'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui/Toaster'

type PostCardProps = {
  post: PostWithUser
  onLike?: (postId: string, liked: boolean) => void
}

export function PostCard({ post, onLike }: PostCardProps) {
  const { data: session } = useSession()
  const { add: toast } = useToast()
  const [liked, setLiked] = useState(post._liked ?? false)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLiking, setIsLiking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = useCallback(async () => {
    if (!post.audioUrl) return

    if (!audioRef.current) {
      audioRef.current = new Audio(post.audioUrl)
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime ?? 0)
      })
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
      })

      // Track play count (fire and forget)
      fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'play' }),
      }).catch(() => null)
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (err) {
        toast('Failed to play audio', 'error')
      }
    }
  }, [isPlaying, post.audioUrl, post.id, toast])

  const handleLike = async () => {
    if (!session?.user) {
      toast('Sign in to like posts', 'info')
      return
    }
    if (isLiking) return

    setIsLiking(true)
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount(c => c + (newLiked ? 1 : -1))

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLiked(data.liked)
      setLikeCount(c => {
        const diff = data.liked !== liked ? (data.liked ? 1 : -1) : 0
        return post.likeCount + diff
      })
      onLike?.(post.id, data.liked)
    } catch {
      // Revert on failure
      setLiked(!newLiked)
      setLikeCount(c => c + (newLiked ? -1 : 1))
      toast('Failed to like post', 'error')
    } finally {
      setIsLiking(false)
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`
    if (navigator.share) {
      await navigator.share({ title: post.title, url }).catch(() => null)
    } else {
      await navigator.clipboard.writeText(url)
      toast('Link copied!', 'success')
    }
  }

  const progress = post.duration && currentTime ? (currentTime / post.duration) * 100 : 0

  return (
    <article className="post-card p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <Link href={`/profile/${post.user.username}`} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
            {post.user.avatarUrl ? (
              <Image
                src={post.user.avatarUrl}
                alt={post.user.displayName}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-brand-400">
                {getInitials(post.user.displayName)}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors">
                {post.user.displayName}
              </span>
              {post.user.isVerified && (
                <BadgeCheck className="w-3.5 h-3.5 text-brand-400" />
              )}
              {post.user.isPro && (
                <span className="badge bg-yellow-500/15 text-yellow-400 text-[10px]">PRO</span>
              )}
            </div>
            <div className="text-xs text-white/40">
              @{post.user.username} · {formatTimeAgo(post.createdAt)}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {/* Post type badge */}
          <span className={cn(
            'badge text-xs',
            post.type === 'AUDIO' && 'bg-purple-500/15 text-purple-400',
            post.type === 'VIDEO' && 'bg-blue-500/15 text-blue-400',
            post.type === 'AUDIO_VIDEO' && 'bg-brand-500/15 text-brand-400',
          )}>
            {post.type === 'AUDIO' && <Music2 className="w-3 h-3" />}
            {(post.type === 'VIDEO' || post.type === 'AUDIO_VIDEO') && <Video className="w-3 h-3" />}
            {post.genre ?? post.type}
          </span>
          <button className="text-white/30 hover:text-white/60 transition-colors p-1">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <Link href={`/post/${post.id}`} className="block mb-3">
        <h3 className="font-semibold text-white mb-1 hover:text-brand-400 transition-colors">
          {post.title}
        </h3>
        {post.description && (
          <p className="text-sm text-white/60 line-clamp-2">{post.description}</p>
        )}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {post.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs text-brand-400/80">#{tag}</span>
            ))}
          </div>
        )}
      </Link>

      {/* Video thumbnail */}
      {post.videoUrl && post.thumbnailUrl && (
        <div className="relative mb-3 rounded-xl overflow-hidden aspect-video bg-surface-2">
          <Image
            src={post.thumbnailUrl}
            alt={post.title}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              href={`/post/${post.id}`}
              className="w-14 h-14 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20 hover:bg-brand-500/80 transition-all"
            >
              <Play className="w-6 h-6 text-white ml-1" />
            </Link>
          </div>
        </div>
      )}

      {/* Audio player */}
      {post.audioUrl && !post.videoUrl && (
        <div className="mb-3 bg-surface-2 rounded-xl p-3 flex items-center gap-3">
          <button
            onClick={togglePlay}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
              isPlaying ? 'bg-brand-500 glow-brand-sm' : 'bg-surface-3 hover:bg-surface-4'
            )}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {/* Waveform / progress bar */}
            <div className="relative h-8 flex items-center gap-px">
              {isPlaying ? (
                <div className="flex items-center gap-px h-full">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div
                      key={i}
                      className="waveform-bar"
                      style={{
                        height: `${Math.random() * 60 + 20}%`,
                        animationDelay: `${(i * 30) % 400}ms`,
                        opacity: (i / 40) * 100 < progress ? 1 : 0.3,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full h-1 bg-white/10 rounded-full relative cursor-pointer">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-between text-xs text-white/30 mt-1">
              <span>{formatDuration(currentTime)}</span>
              {post.duration && <span>{formatDuration(post.duration)}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-white/5">
        <button
          onClick={handleLike}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all duration-150',
            liked
              ? 'text-brand-400 bg-brand-500/10'
              : 'text-white/50 hover:text-brand-400 hover:bg-brand-500/10'
          )}
        >
          <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
          <span>{formatCount(likeCount)}</span>
        </button>

        <Link
          href={`/post/${post.id}#comments`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-150"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{formatCount(post.commentCount)}</span>
        </Link>

        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-green-400 hover:bg-green-500/10 transition-all duration-150">
          <Repeat2 className="w-4 h-4" />
          <span>{formatCount(post.repostCount)}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all duration-150 ml-auto"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </article>
  )
}
