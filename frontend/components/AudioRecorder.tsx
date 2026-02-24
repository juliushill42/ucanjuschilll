'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'done';

export default function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(0);

  const drawWaveform = useCallback(() => {
    if (!analyzerRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzerRef.current.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff1a57';
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Volume level
    const rms = Math.sqrt(dataArray.reduce((sum, v) => sum + Math.pow((v - 128) / 128, 2), 0) / bufferLength);
    setVolume(Math.min(100, rms * 500));

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      setHasPermission(true);

      // Set up analyzer
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 2048;
      source.connect(analyzer);
      analyzerRef.current = analyzer;
    } catch (e) {
      setHasPermission(false);
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) await requestPermission();
    if (!streamRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    const recordedChunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      onRecordingComplete(blob, Math.floor(elapsed));
      setState('done');
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    startTimeRef.current = Date.now();
    setState('recording');

    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    drawWaveform();
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    } else if (state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      drawWaveform();
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const reset = () => {
    setState('idle');
    setDuration(0);
    setVolume(0);
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
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
        <p className="text-red-400 mb-2">🎙️ Microphone access denied</p>
        <p className="text-gray-500 text-sm">Allow microphone access in your browser to record</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-700 rounded-2xl p-6">
      <h3 className="font-semibold mb-4 text-center">🎙️ Voice & Vision Studio</h3>

      {/* Waveform canvas */}
      <div className="bg-dark-900 rounded-xl mb-4 overflow-hidden" style={{ height: 80 }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={80}
          className="w-full h-full"
        />
      </div>

      {/* Volume meter */}
      <div className="mb-4">
        <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${volume}%`,
              background: volume > 80 ? '#ef4444' : volume > 50 ? '#f59e0b' : '#22c55e',
            }}
          />
        </div>
      </div>

      {/* Timer */}
      <div className="text-center mb-6">
        <span className="font-display text-4xl font-bold text-white tabular-nums">
          {formatTime(duration)}
        </span>
        {state === 'recording' && (
          <span className="ml-3 badge bg-red-500/20 text-red-400 border border-red-500/30">
            <span className="live-dot" /> REC
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="w-16 h-16 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-2xl transition-all active:scale-95 shadow-lg shadow-brand-500/30"
          >
            🎙️
          </button>
        )}

        {(state === 'recording' || state === 'paused') && (
          <>
            <button
              onClick={pauseRecording}
              className="w-12 h-12 rounded-full bg-dark-600 hover:bg-dark-500 flex items-center justify-center text-xl transition-all active:scale-95"
            >
              {state === 'recording' ? '⏸' : '▶'}
            </button>
            <button
              onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-2xl transition-all active:scale-95 shadow-lg shadow-brand-500/30"
            >
              ⏹
            </button>
          </>
        )}

        {state === 'done' && (
          <button
            onClick={reset}
            className="btn-ghost"
          >
            Record again
          </button>
        )}
      </div>

      {state === 'idle' && (
        <p className="text-center text-xs text-gray-500 mt-4">
          Tap to start recording. AI will clean your audio automatically.
        </p>
      )}
    </div>
  );
}
