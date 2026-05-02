'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Post } from '@/types';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface Props { post: Post; }

export default function PostCard({ post }: Props) {
  const [liked, setLiked] = useState(post.is_liked ?? false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [playing, setPlaying] = useState(false);

  const toggleLike = async () => {
    try {
      if (liked) { await api.unlikePost(post.id); setLikeCount((n) => n - 1); }
      else { await api.likePost(post.id); setLikeCount((n) => n + 1); }
      setLiked(!liked);
    } catch {}
  };

  const user = post.user;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <div className="card hover:border-dark-500 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/profile/${user?.username}`}>
          <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/30 overflow-hidden flex-shrink-0">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-brand-400 font-bold text-sm">
                {(user?.display_name || 'A')[0].toUpperCase()}
              </div>
            )}
          </div>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/profile/${user?.username}`} className="font-sans font-semibold text-sm text-white hover:text-brand-400 transition-colors">
              {user?.display_name}
            </Link>
            {user?.is_verified && <span className="text-brand-400 text-xs">✓</span>}
          </div>
          <p className="text-xs text-gray-600 font-body">@{user?.username} · {timeAgo}</p>
        </div>
        {post.genre && (
          <span className="badge bg-brand-500/10 text-brand-400 border border-brand-500/20 text-[11px]">{post.genre}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-sans font-semibold text-white mb-2 leading-snug">{post.title}</h3>
      {post.description && (
        <p className="text-sm text-gray-500 font-body mb-3 leading-relaxed line-clamp-2">{post.description}</p>
      )}

      {/* Thumbnail */}
      {post.thumbnail_url && (
        <div className="relative rounded-xl overflow-hidden mb-3 bg-dark-700 aspect-video">
          <img src={post.thumbnail_url} alt={post.title} className="w-full h-full object-cover" />
          {post.post_type !== 'audio' && (
            <button
              onClick={() => setPlaying(!playing)}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">{playing ? '⏸' : '▶'}</span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Audio player */}
      {post.audio_url && (
        <audio
          controls
          className="w-full mb-3 rounded-xl"
          style={{ colorScheme: 'dark' }}
          src={post.audio_url}
        />
      )}

      {/* AI badge */}
      {post.ai_mastered && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <span className="badge bg-brand-500/10 text-brand-300 border border-brand-500/20 text-[10px]">✨ AI Mastered</span>
          {post.has_captions && <span className="badge bg-dark-600 text-gray-400 border border-dark-500 text-[10px]">CC Captions</span>}
          {post.bpm > 0 && <span className="badge bg-dark-600 text-gray-400 border border-dark-500 text-[10px]">{post.bpm} BPM</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t border-dark-700">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-sm transition-colors font-sans ${liked ? 'text-brand-400' : 'text-gray-500 hover:text-white'}`}
        >
          <span>{liked ? '♥' : '♡'}</span>
          <span>{likeCount}</span>
        </button>
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors font-sans">
          <span>💬</span>
          <span>{post.comment_count}</span>
        </button>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-600 font-body">
          <span>▶</span>
          <span>{post.play_count}</span>
        </div>
      </div>
    </div>
  );
}
