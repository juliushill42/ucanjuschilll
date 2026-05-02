'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function StudioPage() {
  const router = useRouter();
  const { user, initialized, initialize } = useAuth();
  const [streamKey, setStreamKey] = useState('');
  const [aiJobs, setAiJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useEffect(() => {
    if (initialized && !user) { router.push('/login'); return; }
    if (initialized && user) {
      Promise.all([
        api.getStreamKey().then(setStreamKey).catch(() => {}),
        api.getMyAIJobs().then(setAiJobs).catch(() => {}),
      ]).finally(() => setLoading(false));
    }
  }, [initialized, user]);

  const rotateKey = async () => {
    try { const k = await api.rotateStreamKey(); setStreamKey(k); } catch {}
  };

  if (!initialized || loading) return (
    <div className="flex min-h-screen bg-dark-900"><Nav /><main className="flex-1 md:ml-64 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" /></main></div>
  );

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Nav />
      <main className="flex-1 md:ml-64 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="font-sans font-extrabold text-2xl text-white mb-1">Studio</h1>
          <p className="text-gray-500 text-sm font-body mb-8">Your creative command center</p>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <Link href="/upload" className="card hover:border-brand-500/30 transition-all group p-5 flex flex-col gap-2">
              <span className="text-2xl">➕</span>
              <p className="font-sans font-semibold text-white">Drop a Track</p>
              <p className="text-xs text-gray-500 font-body">Upload audio or video</p>
            </Link>
            <div className="card hover:border-brand-500/30 transition-all group p-5 flex flex-col gap-2 cursor-pointer">
              <span className="text-2xl">🔴</span>
              <p className="font-sans font-semibold text-white">Go Live</p>
              <p className="text-xs text-gray-500 font-body">Stream to your fans</p>
            </div>
          </div>

          {/* Stream key */}
          {streamKey && (
            <div className="card mb-6">
              <h2 className="font-sans font-semibold text-white mb-1">Stream Key</h2>
              <p className="text-xs text-gray-500 font-body mb-3">Use this in OBS or your streaming software</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  className="input flex-1 text-xs font-mono"
                  value={streamKey}
                  readOnly
                  onFocus={(e) => { e.target.type = 'text'; e.target.select(); }}
                  onBlur={(e) => { e.target.type = 'password'; }}
                />
                <button onClick={rotateKey} className="btn-ghost text-sm px-4 py-2">Rotate</button>
              </div>
              <p className="text-xs text-gray-600 font-body mt-2">RTMP URL: <span className="text-gray-400 font-mono">rtmp://ucanjuschill.com/live</span></p>
            </div>
          )}

          {/* AI Jobs */}
          {aiJobs.length > 0 && (
            <div className="card">
              <h2 className="font-sans font-semibold text-white mb-4">AI Processing</h2>
              <div className="space-y-3">
                {aiJobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="flex items-center gap-3 py-2 border-b border-dark-700 last:border-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${job.status === 'done' ? 'bg-green-400' : job.status === 'failed' ? 'bg-red-400' : 'bg-brand-400 animate-pulse'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-sans truncate">{job.job_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-600 font-body capitalize">{job.status}</p>
                    </div>
                    {job.status === 'processing' && (
                      <div className="text-xs text-brand-400 font-body">{job.progress}%</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
