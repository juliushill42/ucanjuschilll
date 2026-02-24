'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { PostCard } from './PostCard'
import type { PostWithUser } from '@/types'
import { Loader2, Music2 } from 'lucide-react'

type FeedProps = {
  type?: 'following' | 'explore' | 'trending'
  genre?: string
  userId?: string
}

export function Feed({ type = 'explore', genre, userId }: FeedProps) {
  const [posts, setPosts] = useState<PostWithUser[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fetchPosts = useCallback(async (cursorParam?: string) => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ type })
      if (cursorParam) params.set('cursor', cursorParam)
      if (genre) params.set('genre', genre)

      const res = await fetch(`/api/posts?${params}`)
      if (!res.ok) throw new Error('Failed to load posts')

      const data = await res.json()

      setPosts(prev => cursorParam ? [...prev, ...data.posts] : data.posts)
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    } catch (err) {
      setError('Failed to load posts. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [type, genre, loading])

  // Initial load
  useEffect(() => {
    setPosts([])
    setCursor(null)
    setHasMore(true)
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, genre])

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && cursor) {
          fetchPosts(cursor)
        }
      },
      { rootMargin: '200px' }
    )

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [hasMore, loading, cursor, fetchPosts])

  const handleLike = (postId: string, liked: boolean) => {
    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? { ...p, _liked: liked, likeCount: p.likeCount + (liked ? 1 : -1) }
          : p
      )
    )
  }

  if (error) {
    return (
      <div className="text-center py-16 text-white/40">
        <p className="mb-3">{error}</p>
        <button
          onClick={() => fetchPosts()}
          className="btn-secondary text-sm"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!loading && posts.length === 0) {
    return (
      <div className="text-center py-20 text-white/30">
        <Music2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium text-white/50 mb-2">Nothing here yet</p>
        <p className="text-sm">
          {type === 'following'
            ? 'Follow some artists to see their posts here'
            : 'Be the first to post something'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {posts.map(post => (
        <PostCard key={post.id} post={post} onLike={handleLike} />
      ))}

      {/* Loading skeleton */}
      {loading && posts.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full skeleton" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 skeleton rounded w-1/3" />
                  <div className="h-2.5 skeleton rounded w-1/4" />
                </div>
              </div>
              <div className="h-4 skeleton rounded w-3/4" />
              <div className="h-3 skeleton rounded w-1/2" />
              <div className="h-12 skeleton rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Loading more spinner */}
      {loading && posts.length > 0 && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      )}

      {/* End message */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-8 text-white/20 text-sm">
          You've seen it all — for now 💯
        </div>
      )}

      {/* Intersection sentinel */}
      <div ref={sentinelRef} className="h-1" />
    </div>
  )
}
