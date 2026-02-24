'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import AudioRecorder from '@/components/AudioRecorder';
import VideoRecorder from '@/components/VideoRecorder';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AIJob } from '@/types';
import clsx from 'clsx';

type StudioMode = 'choose' | 'audio' | 'video' | 'av';
type StudioStep = 'record' | 'process' | 'done';

interface RecordedMedia {
  audioBlob?: Blob;
  videoBlob?: Blob;
  thumbnailBlob?: Blob | null;
  audioDuration?: number;
  videoDuration?: number;
}

interface AIOptions {
  noiseReduction: boolean;
  pitchCorrect: boolean;
  master: boolean;
  captions: boolean;
  stabilize: boolean;
}

export default function StudioPage() {
  const { user, initialized, initialize } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<StudioMode>('choose');
  const [step, setStep] = useState<StudioStep>('record');
  const [media, setMedia] = useState<RecordedMedia>({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [tags, setTags] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [activeJobs, setActiveJobs] = useState<AIJob[]>([]);
  const [publishedPostId, setPublishedPostId] = useState('');
  const [error, setError] = useState('');
  const [aiOptions, setAiOptions] = useState<AIOptions>({
    noiseReduction: true,
    pitchCorrect: false,
    master: true,
    captions: true,
    stabilize: true,
  });

  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!initialized) initialize(); }, [initialized, initialize]);
  useEffect(() => { if (!user && initialized) router.push('/login'); }, [user, initialized, router]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>, type: 'audio' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const blob = new Blob([buf], { type: file.type });
    if (type === 'audio') setMedia((m) => ({ ...m, audioBlob: blob, audioDuration: 0 }));
    else setMedia((m) => ({ ...m, videoBlob: blob, videoDuration: 0 }));
    setStep('process');
  };

  const pollUntilDone = (jobId: string): Promise<AIJob> =>
    new Promise((resolve, reject) => {
      const iv = setInterval(async () => {
        try {
          const job = await api.getAIJob(jobId);
          setActiveJobs((prev) => prev.map((j) => (j.id === jobId ? job : j)));
          if (job.status === 'done') { clearInterval(iv); resolve(job); }
          if (job.status === 'failed') { clearInterval(iv); reject(new Error(job.error_message)); }
        } catch (e) { clearInterval(iv); reject(e); }
      }, 2000);
    });

  const handlePublish = async () => {
    if (!title.trim()) { setError('Give your track a title'); return; }
    setError('');
    setProcessing(true);
    setUploadProgress(0);
    try {
      let audioUrl = '';
      let videoUrl = '';
      let thumbnailUrl = '';

      if (media.audioBlob) {
        const f = new File([media.audioBlob], 'recording.webm', { type: media.audioBlob.type });
        const res = await api.uploadAudio(f, setUploadProgress);
        audioUrl = res.url;
      }
      if (media.videoBlob) {
        const f = new File([media.videoBlob], 'recording.webm', { type: media.videoBlob.type });
        const res = await api.uploadVideo(f, setUploadProgress);
        videoUrl = res.url;
      }
      if (media.thumbnailBlob) {
        const f = new File([media.thumbnailBlob], 'thumb.jpg', { type: 'image/jpeg' });
        const res = await api.uploadImage(f);
        thumbnailUrl = res.url;
      }

      const postType = audioUrl && videoUrl ? 'av' : audioUrl ? 'audio' : 'video';
      const post = await api.createPost({
        title: title.trim(), description: description.trim(),
        post_type: postType, audio_url: audioUrl, video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        duration_seconds: media.audioDuration || media.videoDuration || 0,
        genre: genre.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });

      const jobs: AIJob[] = [];
      if (audioUrl) {
        if (aiOptions.noiseReduction) jobs.push(await api.triggerAIProcess(post.id, 'noise_reduction'));
        if (aiOptions.pitchCorrect) jobs.push(await api.triggerAIProcess(post.id, 'pitch_correct'));
        if (aiOptions.master) jobs.push(await api.triggerAIProcess(post.id, 'master'));
        if (aiOptions.captions) jobs.push(await api.triggerAIProcess(post.id, 'captions'));
      }
      if (videoUrl && aiOptions.stabilize) jobs.push(await api.triggerAIProcess(post.id, 'stabilize'));
      if (videoUrl && !thumbnailUrl) jobs.push(await api.triggerAIProcess(post.id, 'thumbnail'));

      setActiveJobs(jobs);
      await Promise.allSettled(jobs.map((j) => pollUntilDone(j.id)));
      setPublishedPostId(post.id);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Something went wrong');
    } finally {
      setProcessing(false);
    }
  };

  const toggleOpt = (key: keyof AIOptions) => setAiOptions((o) => ({ ...o, [key]: !o[key] }));

  const Toggle = ({ k, label, desc }: { k: keyof AIOptions; label: string; desc: string }) => (
    <label className="flex items-center justify-between cursor-pointer gap-4">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <div onClick={() => toggleOpt(k)} className={clsx('w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer', aiOptions[k] ? 'bg-brand-500' : 'bg-dark-600')}>
        <div className={clsx('absolute top-1 w-4 h-4 rounded-full bg-white transition-transform', aiOptions[k] ? 'translate-x-6' : 'translate-x-1')} />
      </div>
    </label>
  );

  if (!initialized) return null;

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 md:ml-64 pb-24 md:pb-8">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-extrabold text-white">🎙️ Voice & Vision</h1>
            <p className="text-sm text-gray-500 mt-0.5">Record. Produce. Publish. AI does the rest.</p>
          </div>

          {/* DONE */}
          {step === 'done' && (
            <div className="card text-center py-12">
              <p className="text-6xl mb-4">🎉</p>
              <h2 className="font-bold text-xl text-white mb-2">You're live!</h2>
              <p className="text-gray-400 text-sm mb-8">AI is polishing your track in the background.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => router.push(`/posts/${publishedPostId}`)} className="btn-primary">View Post</button>
                <button onClick={() => { setStep('record'); setMode('choose'); setMedia({}); setTitle(''); }} className="btn-ghost">Drop Another</button>
              </div>
            </div>
          )}

          {/* CHOOSE MODE */}
          {step === 'record' && mode === 'choose' && (
            <div className="grid gap-4">
              {[
                { m: 'audio' as StudioMode, icon: '🎙️', title: 'Audio Track', desc: 'Record vocals or upload a track. AI cleans, masters, and captions it.' },
                { m: 'video' as StudioMode, icon: '📹', title: 'Video Clip', desc: 'Shoot a performance. AI stabilizes and auto-captions.' },
                { m: 'av' as StudioMode, icon: '🎬', title: 'Full Production', desc: 'Audio + Video. AI syncs, masters, and produces the full package.', badge: 'Recommended' },
              ].map(({ m, icon, title: t, desc, badge }) => (
                <button key={m} onClick={() => setMode(m)} className="card hover:border-brand-500 transition-all text-left">
                  <div className="text-4xl mb-2">{icon}</div>
                  <h3 className="font-bold text-white mb-1">{t}</h3>
                  <p className="text-sm text-gray-500">{desc}</p>
                  {badge && <span className="badge bg-brand-500/20 text-brand-400 border border-brand-500/30 mt-2 text-[10px]">{badge}</span>}
                </button>
              ))}
            </div>
          )}

          {/* RECORD */}
          {step === 'record' && mode !== 'choose' && (
            <div>
              <button onClick={() => setMode('choose')} className="text-gray-500 hover:text-white text-sm mb-4 flex items-center gap-1">← Back</button>

              {(mode === 'audio' || mode === 'av') && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">Record Vocals</h3>
                    <button onClick={() => audioInputRef.current?.click()} className="text-sm text-brand-400 hover:text-brand-300">Upload file ↑</button>
                  </div>
                  <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileInput(e, 'audio')} />
                  {media.audioBlob ? (
                    <div className="card border-green-500/30 text-center py-4">
                      <p className="text-green-400">✓ Audio ready</p>
                      <button onClick={() => setMedia((m) => ({ ...m, audioBlob: undefined }))} className="text-xs text-gray-500 mt-1 hover:text-white">Re-record</button>
                    </div>
                  ) : (
                    <AudioRecorder onRecordingComplete={(blob, dur) => { setMedia((m) => ({ ...m, audioBlob: blob, audioDuration: dur })); }} />
                  )}
                </div>
              )}

              {(mode === 'video' || mode === 'av') && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">Shoot Video</h3>
                    <button onClick={() => videoInputRef.current?.click()} className="text-sm text-brand-400 hover:text-brand-300">Upload file ↑</button>
                  </div>
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileInput(e, 'video')} />
                  {media.videoBlob ? (
                    <div className="card border-green-500/30 text-center py-4">
                      <p className="text-green-400">✓ Video ready</p>
                      <button onClick={() => setMedia((m) => ({ ...m, videoBlob: undefined }))} className="text-xs text-gray-500 mt-1 hover:text-white">Re-shoot</button>
                    </div>
                  ) : (
                    <VideoRecorder onRecordingComplete={(blob, dur, thumb) => setMedia((m) => ({ ...m, videoBlob: blob, videoDuration: dur, thumbnailBlob: thumb }))} />
                  )}
                </div>
              )}

              {((mode === 'audio' && media.audioBlob) || (mode === 'video' && media.videoBlob) || (mode === 'av' && (media.audioBlob || media.videoBlob))) && (
                <button onClick={() => setStep('process')} className="btn-primary w-full">Continue to AI Processing →</button>
              )}
            </div>
          )}

          {/* PROCESS */}
          {step === 'process' && (
            <div>
              <button onClick={() => setStep('record')} className="text-gray-500 hover:text-white text-sm mb-4 flex items-center gap-1">← Back</button>

              <div className="card mb-5 space-y-4">
                <h3 className="font-semibold text-white">✨ AI Production</h3>
                {media.audioBlob && (
                  <>
                    <Toggle k="noiseReduction" label="🎛️ Noise Reduction" desc="Remove background noise & hiss" />
                    <Toggle k="pitchCorrect" label="🎵 Pitch Correction" desc="Auto-tune to nearest note" />
                    <Toggle k="master" label="🔊 AI Mastering" desc="EQ, compression, limiting" />
                    <Toggle k="captions" label="📝 Auto Captions" desc="AI transcribes & generates subtitles" />
                  </>
                )}
                {media.videoBlob && (
                  <Toggle k="stabilize" label="📷 Stabilization" desc="Smooth out shaky footage" />
                )}
              </div>

              <div className="card mb-5 space-y-4">
                <h3 className="font-semibold text-white">Post Details</h3>
                <input className="input" placeholder="Track title *" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                <textarea className="input resize-none" rows={3} placeholder="Tell your story... (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
                <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
                  <option value="">Select genre (optional)</option>
                  {['Hip-Hop','R&B','Pop','Soul','Gospel','Trap','Afrobeats','Reggae','Country','Rock','Lo-fi','Jazz','Electronic','Other'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <input className="input" placeholder="Tags: trap, melodic, freestyle (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm">{error}</div>}

              {processing && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Uploading...</span><span>{uploadProgress}%</span></div>
                  <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {processing && activeJobs.length > 0 && (
                <div className="card mb-4 space-y-2">
                  <p className="text-sm font-medium text-white">AI is cooking...</p>
                  {activeJobs.map((job) => (
                    <div key={job.id} className="flex items-center gap-2 text-xs">
                      <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', job.status === 'done' ? 'bg-green-400' : job.status === 'failed' ? 'bg-red-400' : 'bg-brand-400 animate-pulse')} />
                      <span className="text-gray-400 capitalize">{job.job_type.replace(/_/g, ' ')}</span>
                      <span className={clsx('ml-auto', job.status === 'done' ? 'text-green-400' : job.status === 'failed' ? 'text-red-400' : 'text-gray-500')}>{job.status}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handlePublish} disabled={processing || !title.trim()} className="btn-primary w-full text-base py-4">
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {uploadProgress < 100 ? 'Uploading...' : 'AI Processing...'}
                  </span>
                ) : '🚀 Drop It'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
