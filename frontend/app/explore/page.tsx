'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Nav from '@/components/Nav';
import PostCard from '@/components/PostCard';
import { Post, User } from '@/types';
import { api } from '@/lib/api';
import Link from 'next/link';

const GENRES = ['Hip-Hop','R&B','Pop','Soul','Gospel','Trap','Afrobeats','Reggae','Country','Rock','Lo-fi','Jazz','Electronic'];

export default function ExplorePage() {
  const params = useSearchParams();
  const [query, setQuery] = useState('');
  const [activeGenre, setActiveGenre] = useState(params.get('genre') || '');
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'trending' | 'genre' | 'search'>('trending');

  useEffect(() => {
    if (activeGenre) { setTab('genre'); loadGenre(activeGenre); }
    else loadTrending();
  }, []);

  const loadTrending = async () => {
    setLoading(true);
    try { const data = await api.getTrending(); setPosts(data); setUsers([]); }
    catch {} finally { setLoading(false); }
  };

  const loadGenre = async (g: string) => {
    setLoading(true);
    setActiveGenre(g);
    try { const data = await api.getByGenre(g); setPosts(data); setUsers([]); }
    catch {} finally { setLoading(false); }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setTab('search');
    try {
      const res = await api.search(query.trim());
      setPosts(res.posts || []);
      setUsers(res.users || []);
    } catch {} finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 md:ml-64 pb-24 md:pb-8">
        <div className="max-w-xl mx-auto px-4 py-6">
          <h1 className="font-display text-2xl font-extrabold text-white mb-5">🔍 Explore</h1>

          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <input
              className="input flex-1"
              placeholder="Search artists, tracks, genres..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn-primary px-4">Search</button>
          </form>

          {/* Genre chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
            <button
              onClick={() => { setTab('trending'); setActiveGenre(''); loadTrending(); }}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === 'trending' && !activeGenre ? 'bg-brand-500 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
            >
              🔥 Trending
            </button>
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => loadGenre(g)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeGenre === g ? 'bg-brand-500 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Users in search */}
          {users.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-white mb-3">Artists</h3>
              <div className="space-y-2">
                {users.map((u) => (
                  <Link key={u.id} href={`/profile/${u.username}`} className="card hover:border-dark-600 transition-colors flex items-center gap-3 p-4">
                    <div className="w-12 h-12 rounded-full bg-brand-500/20 border border-brand-500/30 overflow-hidden flex-shrink-0">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.display_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-brand-400 font-bold">
                          {u.display_name[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white">{u.display_name}</span>
                        {u.is_verified && <span className="text-brand-400 text-xs">✓</span>}
                        {u.is_live && <span className="badge bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]"><span className="live-dot" /> LIVE</span>}
                      </div>
                      <p className="text-sm text-gray-500">@{u.username} · {u.follower_count} followers</p>
                      {u.genre && <p className="text-xs text-brand-400 mt-0.5">{u.genre}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Posts */}
          {loading ? (
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
                  <div className="h-16 bg-dark-700 rounded-xl" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">🎵</p>
              <p className="text-gray-500">No posts found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
