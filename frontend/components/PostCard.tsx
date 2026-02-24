'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Post } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface PostCardProps {
  post: Post;
  onDelete?: (id: string) => void;
}

export default function PostCard({ post, onDelete }: PostCardProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.is_liked ?? false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(post.duration_seconds);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const isOwner = user?.id === post.user_id;

  const audioUrl = post.audio_url
    ? (post.audio_url.startsWith('http') ? post.audio_url : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''}${post.audio_url}`)
    : null;

  const thumbUrl = post.thumbnail_url
    ? (post.thumbnail_url.startsWith('http') ? post.thumbnail_url : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''}${post.thumbnail_url}`)
    : null;

  useEffect(() => {
    if (audioUrl && (post.post_type === 'audio' || post.post_type === 'av')) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.addEventListener('ended', () => setPlaying(false));
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
          setDuration(Math.floor(audio.duration));
        }
      });
      return () => {
        audio.pause();
        audio.src = '';
      };
    }
  }, [audioUrl, post.post_type]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
  };

  const handleLike = async () => {
    if (!user) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => wasLiked ? c - 1 : c + 1);
    try {
      if (wasLiked) await api.unlikePost(post.id);
      else await api.likePost(post.id);
    } catch {
      setLiked(wasLiked);
      setLikeCount(post.like_count);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatCount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <article className="card hover:border-dark-600 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href={`/profile/${post.user?.username}`} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/30 overflow-hidden flex-shrink-0">
            {post.user?.avatar_url ? (
              <img src={post.user.avatar_url} alt={post.user.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-brand-400 font-bold text-sm">
                {post.user?.display_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white text-sm">{post.user?.display_name}</span>
              {post.user?.is_verified && <span className="text-brand-400 text-xs">✓</span>}
              {post.user?.is_live && (
                <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">
                  <span className="live-dot" /> LIVE
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">@{post.user?.username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {post.ai_mastered && (
            <span className="badge bg-purple-500/20 text-purple-400 border border-purple-500/20 text-[10px]">
              ✨ AI Mastered
            </span>
          )}
          {post.genre && (
            <Link href={`/explore?genre=${post.genre}`}>
              <span className="badge bg-dark-700 text-gray-400 border border-dark-600 text-[10px] hover:border-brand-500 transition-colors">
                {post.genre}
              </span>
            </Link>
          )}
          {isOwner && (
            <button
              onClick={() => onDelete?.(post.id)}
              className="text-gray-600 hover:text-red-400 transition-colors text-sm ml-1"
              title="Delete post"
            >
              ···
            </button>
          )}
        </div>
      </div>

      {/* Title & description */}
      <Link href={`/posts/${post.id}`}>
        <h3 className="font-semibold text-white mb-1 hover:text-brand-400 transition-colors">{post.title}</h3>
      </Link>
      {post.description && (
        <p className="text-gray-400 text-sm mb-3 line-clamp-2">{post.description}</p>
      )}

      {/* Thumbnail for video posts */}
      {thumbUrl && (post.post_type === 'video' || post.post_type === 'av') && (
        <Link href={`/posts/${post.id}`} className="block mb-3 rounded-xl overflow-hidden aspect-video bg-dark-700">
          <img src={thumbUrl} alt={post.title} className="w-full h-full object-cover" />
        </Link>
      )}

      {/* Audio player */}
      {audioUrl && (post.post_type === 'audio' || post.post_type === 'av') && (
        <div className="bg-dark-700 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center flex-shrink-0 transition-colors active:scale-95"
            >
              <span className="text-white text-base">{playing ? '⏸' : '▶'}</span>
            </button>

            <div className="flex-1 min-w-0">
              {/* Waveform / progress bar */}
              <div
                ref={progressRef}
                onClick={handleSeek}
                className="h-2 bg-dark-600 rounded-full cursor-pointer relative overflow-hidden"
              >
                <div
                  className="absolute left-0 top-0 h-full bg-brand-500 rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-500">
                  {audioRef.current ? formatDuration(Math.floor(audioRef.current.currentTime)) : '0:00'}
                </span>
                <span className="text-[10px] text-gray-500">{formatDuration(duration)}</span>
              </div>
            </div>

            {post.bpm > 0 && (
              <span className="text-[10px] text-gray-500 flex-shrink-0">{post.bpm} BPM</span>
            )}
          </div>

          {post.has_captions && (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-[10px] text-gray-500">CC</span>
              <span className="text-[10px] text-gray-600">Auto-captions available</span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="text-[11px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-5 pt-2 border-t border-dark-700">
        <button
          onClick={handleLike}
          className={clsx(
            'flex items-center gap-1.5 text-sm transition-colors',
            liked ? 'text-brand-400' : 'text-gray-500 hover:text-brand-400'
          )}
        >
          <span>{liked ? '❤️' : '🤍'}</span>
          <span>{formatCount(likeCount)}</span>
        </button>

        <Link
          href={`/posts/${post.id}#comments`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
        >
          <span>💬</span>
          <span>{formatCount(post.comment_count)}</span>
        </Link>

        <span className="flex items-center gap-1.5 text-sm text-gray-500">
          <span>▶</span>
          <span>{formatCount(post.play_count)}</span>
        </span>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: post.title,
                url: `${window.location.origin}/posts/${post.id}`,
              });
            } else {
              navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
            }
          }}
          className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
        >
          <span>↗</span>
          Share
        </button>
      </div>
    </article>
  );
}
