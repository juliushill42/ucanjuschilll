'use client';
import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import PostCard from '@/components/PostCard';
import { Post } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function HomePage() {
  const { user, initialized, initialize } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState<'for-you' | 'following'>('for-you');

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useEffect(() => {
    loadPosts(1, true);
  }, [user, tab]);

  const loadPosts = async (p: number, reset = false) => {
    setLoading(true);
    try {
      let data: Post[];
      if (tab === 'following' && user) {
        const res = await api.getFeed(p);
        data = res.posts;
        setHasMore(res.posts.length === 20);
      } else {
        data = await api.getTrending(p);
        setHasMore(data.length === 20);
      }
      setPosts((prev) => reset ? data : [...prev, ...data]);
      setPage(p);
    } catch {
      // Feed load failed, show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch {}
  };

  return (
    <div className="flex min-h-screen">
      <Nav />

      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <div className="max-w-xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-white">
                {user ? `Hey, ${user.display_name.split(' ')[0]} 👋` : 'JusChill 💯'}
              </h1>
              <p className="text-sm text-gray-500">
                {user ? 'Your feed is ready.' : 'Music from the unseen.'}
              </p>
            </div>
            {!user && (
              <Link href="/register" className="btn-primary text-sm">Join free</Link>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-dark-800 p-1 rounded-xl">
            <button
              onClick={() => setTab('for-you')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'for-you' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              For You
            </button>
            <button
              onClick={() => setTab('following')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'following' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Following
            </button>
          </div>

          {/* Posts */}
          {loading && posts.length === 0 ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="flex gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-dark-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-dark-700 rounded w-1/3" />
                      <div className="h-3 bg-dark-700 rounded w-1/4" />
                    </div>
                  </div>
                  <div className="h-20 bg-dark-700 rounded-xl" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">🎵</p>
              <h3 className="font-semibold text-white mb-2">
                {tab === 'following' ? 'Your feed is empty' : 'No posts yet'}
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                {tab === 'following'
                  ? 'Follow artists to see their posts here'
                  : 'Be the first to drop something'}
              </p>
              <Link href={tab === 'following' ? '/explore' : '/studio'} className="btn-primary">
                {tab === 'following' ? 'Find Artists' : 'Open Studio'}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onDelete={handleDelete} />
              ))}

              {hasMore && (
                <button
                  onClick={() => loadPosts(page + 1)}
                  disabled={loading}
                  className="w-full py-3 text-sm text-gray-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
