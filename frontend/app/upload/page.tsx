'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function UploadPage() {
  const { user, initialized, initialize } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'audio' | 'video' | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [tags, setTags] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!initialized) initialize(); }, [initialized, initialize]);
  useEffect(() => { if (!user && initialized) router.push('/login'); }, [user, initialized, router]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('audio/')) setFileType('audio');
    else if (f.type.startsWith('video/')) setFileType('video');
    else { setError('Only audio or video files allowed'); setFile(null); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('audio/')) setFileType('audio');
    else if (f.type.startsWith('video/')) setFileType('video');
    else setError('Only audio or video files allowed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError('');
    setLoading(true);
    setProgress(0);
    try {
      let mediaUrl = '';
      if (fileType === 'audio') {
        const res = await api.uploadAudio(file, setProgress);
        mediaUrl = res.url;
      } else {
        const res = await api.uploadVideo(file, setProgress);
        mediaUrl = res.url;
      }

      const post = await api.createPost({
        title: title.trim(),
        description: description.trim(),
        post_type: fileType as 'audio' | 'video',
        audio_url: fileType === 'audio' ? mediaUrl : '',
        video_url: fileType === 'video' ? mediaUrl : '',
        genre: genre.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });

      // Auto-trigger AI processing
      if (fileType === 'audio') {
        await api.triggerAIProcess(post.id, 'noise_reduction');
        await api.triggerAIProcess(post.id, 'master');
        await api.triggerAIProcess(post.id, 'captions');
      } else {
        await api.triggerAIProcess(post.id, 'thumbnail');
      }

      router.push(`/posts/${post.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 md:ml-64 pb-24 md:pb-8">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-extrabold text-white">➕ Drop a File</h1>
            <p className="text-sm text-gray-500 mt-0.5">Upload existing audio or video. AI processes it automatically.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${file ? 'border-green-500/50 bg-green-500/5' : 'border-dark-600 hover:border-brand-500 bg-dark-800'}`}
            >
              <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleFile} />
              {file ? (
                <div>
                  <p className="text-3xl mb-2">{fileType === 'audio' ? '🎵' : '🎬'}</p>
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-gray-500 text-sm mt-1">{formatSize(file.size)}</p>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setFileType(''); }} className="text-xs text-gray-600 hover:text-red-400 mt-2">Remove</button>
                </div>
              ) : (
                <div>
                  <p className="text-4xl mb-3">📁</p>
                  <p className="text-white font-medium mb-1">Drag & drop or tap to browse</p>
                  <p className="text-gray-500 text-sm">MP3, WAV, FLAC, MP4, MOV · Max 500MB</p>
                </div>
              )}
            </div>

            {file && (
              <>
                <input className="input" placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
                <textarea className="input resize-none" rows={3} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
                <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
                  <option value="">Select genre (optional)</option>
                  {['Hip-Hop','R&B','Pop','Soul','Gospel','Trap','Afrobeats','Reggae','Country','Rock','Lo-fi','Jazz','Electronic','Other'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <input className="input" placeholder="Tags: trap, melodic (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
              </>
            )}

            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

            {loading && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Uploading...</span><span>{progress}%</span></div>
                <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {file && (
              <button type="submit" disabled={loading || !title.trim()} className="btn-primary w-full py-4 text-base">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading...
                  </span>
                ) : '🚀 Publish'}
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
