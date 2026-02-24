'use client';
import { useState, useRef, useEffect } from 'react';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number, thumbnail: Blob | null) => void;
}

type RecordingState = 'idle' | 'preview' | 'recording' | 'done';

export default function VideoRecorder({ onRecordingComplete }: VideoRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startPreview = async (mode = facingMode) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setHasPermission(true);
      setState('preview');
    } catch {
      setHasPermission(false);
    }
  };

  const flipCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    await startPreview(newMode);
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: mimeType });
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);

      // Generate thumbnail from first frame
      let thumbnail: Blob | null = null;
      try {
        const canvas = document.createElement('canvas');
        const video = document.createElement('video');
        video.src = URL.createObjectURL(blob);
        await new Promise<void>((res) => {
          video.onloadeddata = () => res();
          video.load();
        });
        video.currentTime = 0;
        await new Promise<void>((res) => {
          video.onseeked = () => res();
        });
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        thumbnail = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
        URL.revokeObjectURL(video.src);
      } catch {
        thumbnail = null;
      }

      onRecordingComplete(blob, elapsed, thumbnail);
      setState('done');
    };

    recorder.start(100);
    recorderRef.current = recorder;
    startTimeRef.current = Date.now();
    setState('recording');

    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const reset = async () => {
    setState('idle');
    setDuration(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (hasPermission === false) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-2">📹 Camera access denied</p>
        <p className="text-gray-500 text-sm">Allow camera access in your browser settings</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-700 rounded-2xl overflow-hidden">
      {/* Video preview */}
      <div className="relative bg-black" style={{ aspectRatio: '9/16', maxHeight: 480, margin: '0 auto' }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />

        {state === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <button
              onClick={() => startPreview()}
              className="w-20 h-20 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-3xl transition-all active:scale-95 shadow-xl shadow-brand-500/40"
            >
              📹
            </button>
            <p className="text-white text-sm mt-3 opacity-70">Tap to start camera</p>
          </div>
        )}

        {state === 'recording' && (
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="live-dot" />
            <span className="text-white text-sm font-bold tabular-nums bg-black/50 px-2 py-0.5 rounded">
              {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Camera flip button */}
        {(state === 'preview' || state === 'recording') && (
          <button
            onClick={flipCamera}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white text-lg hover:bg-black/70 transition-colors"
          >
            🔄
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="p-5 flex items-center justify-center gap-5">
        {state === 'preview' && (
          <button
            onClick={startRecording}
            className="w-16 h-16 rounded-full border-4 border-brand-500 flex items-center justify-center transition-all active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-brand-500" />
          </button>
        )}

        {state === 'recording' && (
          <button
            onClick={stopRecording}
            className="w-16 h-16 rounded-full border-4 border-brand-500 flex items-center justify-center transition-all active:scale-95"
          >
            <div className="w-6 h-6 rounded-sm bg-brand-500" />
          </button>
        )}

        {state === 'done' && (
          <div className="flex gap-3">
            <button onClick={reset} className="btn-ghost text-sm">Re-record</button>
          </div>
        )}
      </div>
    </div>
  );
}
