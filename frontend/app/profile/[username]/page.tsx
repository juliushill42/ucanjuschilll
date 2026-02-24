'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import PostCard from '@/components/PostCard';
import { User, Post } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: me, initialized, initialize } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [streamKey, setStreamKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { if (!initialized) initialize(); }, [initialized, initialize]);

  useEffect(() => {
    if (!username) return;
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [u, feed] = await Promise.all([
        api.getUser(username as string),
        api.getUserPosts(username as string),
      ]);
      setProfile(u);
      setFollowing(u.is_following ?? false);
      setPosts(feed.posts);
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!me) { router.push('/login'); return; }
    setFollowLoading(true);
    try {
      if (following) {
        await api.unfollow(username as string);
        setFollowing(false);
        setProfile((p) => p ? { ...p, follower_count: p.follower_count - 1 } : p);
      } else {
        await api.follow(username as string);
        setFollowing(true);
        setProfile((p) => p ? { ...p, follower_count: p.follower_count + 1 } : p);
      }
    } catch {} finally {
      setFollowLoading(false); }
  };

  const loadStreamKey = async () => {
    const key = await api.getStreamKey();
    setStreamKey(key);
    setShowKey(true);
  };

  const rotateKey = async () => {
    if (!confirm('Rotate stream key? Your current stream URL will stop working.')) return;
    const key = await api.rotateStreamKey();
    setStreamKey(key);
  };

  const isMe = me?.username === username;

  const formatCount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Nav />
        <main className="flex-1 md:ml-64 pb-24 md:pb-8">
          <div className="max-w-xl mx-auto px-4 py-6">
            <div className="card animate-pulse mb-6">
              <div className="flex gap-4 mb-4">
                <div className="w-20 h-20 rounded-full bg-dark-700" />
                <div className="flex-1 space-y-3 pt-2">
                  <div className="h-5 bg-dark-700 rounded w-1/2" />
                  <div className="h-4 bg-dark-700 rounded w-1/3" />
                </div>
              </div>
              <div className="h-4 bg-dark-700 rounded w-3/4" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!profile) return null;

  const rtmpUrl = process.env.NEXT_PUBLIC_RTMP_URL || 'rtmp://localhost/live';

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 md:ml-64 pb-24 md:pb-8">
        <div className="max-w-xl mx-auto px-4 py-6">

          {/* Profile header */}
          <div className="card mb-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-20 h-20 rounded-full bg-brand-500/20 border-2 border-brand-500/40 overflow-hidden flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-400 font-bold text-2xl">
                    {profile.display_name[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-bold text-xl text-white">{profile.display_name}</h1>
                  {profile.is_verified && <span className="text-brand-400">✓</span>}
                  {profile.is_live && (
                    <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">
                      <span className="live-dot" /> LIVE
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-sm">@{profile.username}</p>
                {profile.genre && <p className="text-brand-400 text-xs mt-1">{profile.genre}</p>}
                {profile.location && <p className="text-gray-600 text-xs mt-0.5">📍 {profile.location}</p>}
              </div>
            </div>

            {profile.bio && <p className="text-gray-300 text-sm mb-4 leading-relaxed">{profile.bio}</p>}

            {/* Stats */}
            <div className="flex gap-6 mb-4">
              <div className="text-center">
                <p className="font-bold text-white text-lg">{formatCount(profile.post_count)}</p>
                <p className="text-xs text-gray-500">Posts</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-white text-lg">{formatCount(profile.follower_count)}</p>
                <p className="text-xs text-gray-500">Followers</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-white text-lg">{formatCount(profile.following_count)}</p>
                <p className="text-xs text-gray-500">Following</p>
              </div>
            </div>

            {/* Actions */}
            {isMe ? (
              <div className="flex gap-2">
                <Link href="/upload" className="btn-primary flex-1 text-center text-sm">+ New Post</Link>
                <Link href="/studio" className="btn-ghost flex-1 text-center text-sm">🎙️ Studio</Link>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={following ? 'btn-ghost flex-1' : 'btn-primary flex-1'}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="btn-ghost px-4">🔗</a>
                )}
              </div>
            )}
          </div>

          {/* Stream info for profile owner */}
          {isMe && (
            <div className="card mb-6 border-brand-500/20">
              <h3 className="font-semibold text-white mb-3">📡 Go Live (RTMP)</h3>
              <p className="text-xs text-gray-500 mb-3">Use OBS, Streamlabs, or stream directly from your phone.</p>
              <div className="space-y-2 text-xs">
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-500 mb-1">RTMP URL</p>
                  <p className="text-white font-mono break-all">{rtmpUrl}/live</p>
                </div>
                {showKey ? (
                  <div className="bg-dark-700 rounded-lg p-3">
                    <p className="text-gray-500 mb-1">Stream Key</p>
                    <p className="text-white font-mono break-all">{streamKey}</p>
                    <button onClick={rotateKey} className="text-red-400 hover:text-red-300 mt-2">Rotate key</button>
                  </div>
                ) : (
                  <button onClick={loadStreamKey} className="btn-ghost w-full text-sm">Reveal Stream Key</button>
                )}
              </div>
            </div>
          )}

          {/* Posts */}
          <h2 className="font-semibold text-white mb-4">{isMe ? 'Your Posts' : `Posts by ${profile.display_name}`}</h2>
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🎵</p>
              <p className="text-gray-500 text-sm">{isMe ? "Drop your first track." : "Nothing posted yet."}</p>
              {isMe && <Link href="/studio" className="btn-primary mt-4 inline-block">Open Studio</Link>}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onDelete={isMe ? async (id) => {
                  if (!confirm('Delete this post?')) return;
                  await api.deletePost(id);
                  setPosts((p) => p.filter((x) => x.id !== id));
                } : undefined} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
