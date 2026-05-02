'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import PostCard from '@/components/PostCard';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { User, Post } from '@/types';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: me, initialized, initialize } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useEffect(() => {
    if (!username) return;
    api.getUser(username as string)
      .then((u) => { setProfile(u); setFollowing(u.is_following ?? false); })
      .catch(() => {})
      .finally(() => {});
    api.getUserPosts(username as string)
      .then((r) => setPosts(r.posts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  const toggleFollow = async () => {
    if (!me) return;
    setFollowLoading(true);
    try {
      if (following) { await api.unfollow(username as string); setFollowing(false); setProfile((p) => p ? { ...p, follower_count: p.follower_count - 1 } : p); }
      else { await api.follow(username as string); setFollowing(true); setProfile((p) => p ? { ...p, follower_count: p.follower_count + 1 } : p); }
    } catch {} finally { setFollowLoading(false); }
  };

  const isMe = me?.username === username;

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Nav />
      <main className="flex-1 md:ml-64 pb-24 md:pb-8">
        <div className="max-w-xl mx-auto px-4 py-6">
          {loading && !profile ? (
            <div className="animate-pulse">
              <div className="w-20 h-20 rounded-full bg-dark-700 mb-4" />
              <div className="h-6 bg-dark-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-dark-700 rounded w-1/4" />
            </div>
          ) : profile ? (
            <>
              {/* Profile header */}
              <div className="mb-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-20 h-20 rounded-full bg-brand-500/20 border-2 border-brand-500/30 overflow-hidden flex-shrink-0">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-400 font-bold text-2xl">
                        {profile.display_name[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h1 className="font-sans font-bold text-xl text-white">{profile.display_name}</h1>
                      {profile.is_verified && <span className="text-brand-400 text-sm">✓</span>}
                      {profile.is_live && (
                        <span className="badge bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]">
                          <span className="live-dot" /> LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm font-body mb-3">@{profile.username}</p>
                    {!isMe && me && (
                      <button
                        onClick={toggleFollow}
                        disabled={followLoading}
                        className={following ? 'btn-ghost text-sm py-1.5 px-4' : 'btn-primary text-sm py-1.5 px-4'}
                      >
                        {followLoading ? '...' : following ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>

                {profile.bio && <p className="text-gray-400 text-sm font-body leading-relaxed mb-3">{profile.bio}</p>}
                {profile.genre && <span className="badge bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs mb-3 inline-block">{profile.genre}</span>}

                <div className="flex gap-6">
                  {[
                    { n: profile.post_count, l: 'Posts' },
                    { n: profile.follower_count, l: 'Followers' },
                    { n: profile.following_count, l: 'Following' },
                  ].map((s) => (
                    <div key={s.l} className="text-center">
                      <div className="font-sans font-bold text-white">{s.n}</div>
                      <div className="text-gray-600 text-xs font-body">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Posts */}
              <div className="border-t border-dark-700 pt-4">
                {posts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">🎵</p>
                    <p className="text-gray-600 font-body text-sm">No tracks yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => <PostCard key={post.id} post={post} />)}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500 font-body">User not found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
