'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const GENRES = ['Hip-Hop', 'R&B', 'Pop', 'Soul', 'Gospel', 'Trap', 'Afrobeats', 'Reggae', 'Country', 'Rock', 'Lo-fi', 'Jazz', 'Electronic', 'Other'];

export default function UploadPage() {
  const router = useRouter();
  const { user, initialized, initialize } = useAuth();
  const audioRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useEffect(() => {
    if (initialized && !user) router.push('/login');
  }, [initialized, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || (!audioFile && !videoFile)) { setError('Add a title and at least one file'); return; }
    setError('');
    setUploading(true);

    try {
      let audioUrl = '', videoUrl = '';
      const type: 'audio' | 'video' | 'av' = audioFile && videoFile ? 'av' : audioFile ? 'audio' : 'video';

      if (audioFile) {
        const r = await api.uploadAudio(audioFile, setAudioProgress);
        audioUrl = r.url;
      }
      if (videoFile) {
        const r = await api.uploadVideo(videoFile, setVideoProgress);
        videoUrl = r.url;
      }

      await api.createPost({ title, description, post_type: type, audio_url: audioUrl, video_url: videoUrl, genre });
      router.push('/studio');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Nav />
      <main className="flex-1 md:ml-64 pb-24 md:pb-8">
        <div className="max-w-xl mx-auto px-4 py-6">
          <h1 className="font-sans font-extrabold text-2xl text-white mb-1">Drop a Track</h1>
          <p className="text-gray-500 text-sm font-body mb-8">Share your music with the world</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-6 font-body">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="text-xs text-gray-500 font-sans mb-1.5 block tracking-wide uppercase">Title *</label>
              <input type="text" className="input" placeholder="Track name" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div>
              <label className="text-xs text-gray-500 font-sans mb-1.5 block tracking-wide uppercase">Description</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Tell your story..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 font-sans mb-1.5 block tracking-wide uppercase">Genre</label>
              <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">Select genre</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Audio drop zone */}
            <div>
              <label className="text-xs text-gray-500 font-sans mb-1.5 block tracking-wide uppercase">Audio File</label>
              <div
                onClick={() => audioRef.current?.click()}
                className="border-2 border-dashed border-dark-600 hover:border-brand-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                {audioFile ? (
                  <div>
                    <p className="text-brand-400 font-sans font-medium">{audioFile.name}</p>
                    {audioProgress > 0 && audioProgress < 100 && (
                      <div className="mt-3 bg-dark-600 rounded-full h-1"><div className="bg-brand-500 h-1 rounded-full transition-all" style={{ width: `${audioProgress}%` }} /></div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-2">🎵</p>
                    <p className="text-gray-500 text-sm font-body">Click to add audio</p>
                    <p className="text-gray-600 text-xs font-body mt-1">MP3, WAV, FLAC supported</p>
                  </div>
                )}
                <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
              </div>
            </div>

            {/* Video drop zone */}
            <div>
              <label className="text-xs text-gray-500 font-sans mb-1.5 block tracking-wide uppercase">Video File <span className="text-gray-600 normal-case">(optional)</span></label>
              <div
                onClick={() => videoRef.current?.click()}
                className="border-2 border-dashed border-dark-600 hover:border-brand-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                {videoFile ? (
                  <div>
                    <p className="text-brand-400 font-sans font-medium">{videoFile.name}</p>
                    {videoProgress > 0 && videoProgress < 100 && (
                      <div className="mt-3 bg-dark-600 rounded-full h-1"><div className="bg-brand-500 h-1 rounded-full transition-all" style={{ width: `${videoProgress}%` }} /></div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-2">🎬</p>
                    <p className="text-gray-500 text-sm font-body">Click to add video</p>
                    <p className="text-gray-600 text-xs font-body mt-1">MP4, MOV supported</p>
                  </div>
                )}
                <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
              </div>
            </div>

            <button type="submit" disabled={uploading} className="btn-primary w-full py-3.5 text-base rounded-xl mt-2">
              {uploading ? 'Uploading...' : 'Release It 🚀'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
