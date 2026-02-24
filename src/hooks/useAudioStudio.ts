'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export type RecordingState = 'idle' | 'ready' | 'recording' | 'paused' | 'processing' | 'done' | 'error'

export type AudioTrack = {
  blob: Blob
  url: string
  duration: number
  waveformData: number[]
}

export type StudioSettings = {
  noiseReduction: boolean
  echoCancellation: boolean
  autoGainControl: boolean
  pitchCorrection: boolean
  reverb: number       // 0-1
  compression: number  // 0-1 (ratio)
}

const DEFAULT_SETTINGS: StudioSettings = {
  noiseReduction: true,
  echoCancellation: true,
  autoGainControl: true,
  pitchCorrection: false,
  reverb: 0.1,
  compression: 0.6,
}

export function useAudioStudio() {
  const [state, setState] = useState<RecordingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0)
  const [track, setTrack] = useState<AudioTrack | null>(null)
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const volumeRafRef = useRef<number | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (volumeRafRef.current) cancelAnimationFrame(volumeRafRef.current)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => null)
    }
    chunksRef.current = []
  }, [])

  const buildDSPChain = useCallback((ctx: AudioContext, source: MediaStreamAudioSourceNode) => {
    // Dynamics compressor
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.setValueAtTime(-24, ctx.currentTime)
    compressor.knee.setValueAtTime(30, ctx.currentTime)
    compressor.ratio.setValueAtTime(settings.compression * 12 + 1, ctx.currentTime)
    compressor.attack.setValueAtTime(0.003, ctx.currentTime)
    compressor.release.setValueAtTime(0.25, ctx.currentTime)

    // High-pass filter (removes rumble below 80Hz)
    const highPass = ctx.createBiquadFilter()
    highPass.type = 'highpass'
    highPass.frequency.setValueAtTime(80, ctx.currentTime)
    highPass.Q.setValueAtTime(0.7, ctx.currentTime)

    // Low-pass filter (removes harshness above 16kHz)
    const lowPass = ctx.createBiquadFilter()
    lowPass.type = 'lowpass'
    lowPass.frequency.setValueAtTime(16000, ctx.currentTime)
    lowPass.Q.setValueAtTime(0.7, ctx.currentTime)

    // Presence boost (3kHz - adds clarity to vocals)
    const presence = ctx.createBiquadFilter()
    presence.type = 'peaking'
    presence.frequency.setValueAtTime(3000, ctx.currentTime)
    presence.gain.setValueAtTime(2, ctx.currentTime)
    presence.Q.setValueAtTime(1, ctx.currentTime)

    // Reverb (convolver) - simple synthetic reverb
    const convolver = ctx.createConvolver()
    const reverbGain = ctx.createGain()
    reverbGain.gain.setValueAtTime(settings.reverb, ctx.currentTime)
    const dryGain = ctx.createGain()
    dryGain.gain.setValueAtTime(1 - settings.reverb * 0.5, ctx.currentTime)

    // Create impulse response for reverb
    const rate = ctx.sampleRate
    const reverbLength = rate * 1.5
    const impulse = ctx.createBuffer(2, reverbLength, rate)
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < reverbLength; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLength, 2)
      }
    }
    convolver.buffer = impulse

    // Analyser for visualization
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    analyserRef.current = analyser

    // Destination for recording
    const dest = ctx.createMediaStreamDestination()

    // Wire up the DSP chain
    source.connect(highPass)
    highPass.connect(lowPass)
    lowPass.connect(presence)
    presence.connect(compressor)

    // Wet/dry reverb mix
    compressor.connect(dryGain)
    compressor.connect(convolver)
    convolver.connect(reverbGain)
    dryGain.connect(analyser)
    reverbGain.connect(analyser)

    analyser.connect(dest)

    return dest.stream
  }, [settings])

  const startVolumeMonitor = useCallback(() => {
    if (!analyserRef.current) return
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

    const tick = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      setVolume(avg / 255)
      volumeRafRef.current = requestAnimationFrame(tick)
    }

    volumeRafRef.current = requestAnimationFrame(tick)
  }, [])

  const requestMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseReduction,
          autoGainControl: settings.autoGainControl,
          sampleRate: 44100,
          channelCount: 1,
        },
      })

      mediaStreamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 44100 })
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamAudioSourceNode(stream)
      const processedStream = buildDSPChain(ctx, source)

      mediaStreamRef.current = processedStream

      setState('ready')
      setError(null)
    } catch (err) {
      const message = err instanceof DOMException
        ? err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone in your browser settings.'
          : 'Could not access microphone. Make sure it\'s connected.'
        : 'Failed to initialize audio'
      setError(message)
      setState('error')
    }
  }, [settings, buildDSPChain])

  const startRecording = useCallback(() => {
    if (!mediaStreamRef.current || state !== 'ready') return

    chunksRef.current = []

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm'

    const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      setState('processing')
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const dur = (Date.now() - startTimeRef.current) / 1000

      // Generate waveform data from the recorded audio
      const waveformData = await extractWaveform(blob)

      setTrack({ blob, url, duration: dur, waveformData })
      setState('done')
    }

    recorder.start(100) // collect data every 100ms
    startTimeRef.current = Date.now()
    setState('recording')

    // Duration timer
    timerRef.current = setInterval(() => {
      setDuration((Date.now() - startTimeRef.current) / 1000)
    }, 100)

    // Start volume monitor
    startVolumeMonitor()
  }, [state, startVolumeMonitor])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      if (timerRef.current) clearInterval(timerRef.current)
      if (volumeRafRef.current) cancelAnimationFrame(volumeRafRef.current)
      setVolume(0)
      setState('paused')
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      setState('recording')

      timerRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000)
      }, 100)

      startVolumeMonitor()
    }
  }, [startVolumeMonitor])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (volumeRafRef.current) cancelAnimationFrame(volumeRafRef.current)
    setVolume(0)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const reset = useCallback(() => {
    cleanup()
    setState('idle')
    setDuration(0)
    setVolume(0)
    setTrack(null)
    setError(null)
    audioCtxRef.current = null
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
    analyserRef.current = null
    chunksRef.current = []
  }, [cleanup])

  const updateSettings = useCallback((updates: Partial<StudioSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  return {
    state,
    error,
    duration,
    volume,
    track,
    settings,
    requestMic,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    reset,
    updateSettings,
  }
}

async function extractWaveform(blob: Blob): Promise<number[]> {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const ctx = new OfflineAudioContext(1, 1, 44100)
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const channelData = audioBuffer.getChannelData(0)

    const samples = 100
    const blockSize = Math.floor(channelData.length / samples)
    const waveform: number[] = []

    for (let i = 0; i < samples; i++) {
      let sum = 0
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[i * blockSize + j] ?? 0)
      }
      waveform.push(sum / blockSize)
    }

    // Normalize to 0-1
    const max = Math.max(...waveform, 0.001)
    return waveform.map(v => v / max)
  } catch {
    return Array.from({ length: 100 }, () => Math.random() * 0.5 + 0.1)
  }
}
