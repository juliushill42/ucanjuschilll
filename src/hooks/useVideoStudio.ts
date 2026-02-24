'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export type VideoRecordingState = 'idle' | 'preview' | 'recording' | 'paused' | 'done' | 'error'

export type VideoTrack = {
  blob: Blob
  url: string
  duration: number
  thumbnailBlob: Blob | null
  thumbnailUrl: string | null
}

export type VideoSettings = {
  facingMode: 'user' | 'environment'
  quality: '720p' | '1080p' | '480p'
  withAudio: boolean
  flipHorizontal: boolean
}

const QUALITY_MAP = {
  '480p':  { width: 854,  height: 480  },
  '720p':  { width: 1280, height: 720  },
  '1080p': { width: 1920, height: 1080 },
}

export function useVideoStudio() {
  const [state, setState] = useState<VideoRecordingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [track, setTrack] = useState<VideoTrack | null>(null)
  const [settings, setSettings] = useState<VideoSettings>({
    facingMode: 'user',
    quality: '720p',
    withAudio: true,
    flipHorizontal: true,
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      stopStream()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const startPreview = useCallback(async (videoEl: HTMLVideoElement) => {
    videoRef.current = videoEl
    stopStream()

    const { width, height } = QUALITY_MAP[settings.quality]

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: settings.facingMode,
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: 30 },
        },
        audio: settings.withAudio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100,
            }
          : false,
      })

      streamRef.current = stream
      videoEl.srcObject = stream
      await videoEl.play()
      setState('preview')
      setError(null)
    } catch (err) {
      const msg = err instanceof DOMException
        ? err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera access in your browser settings.'
          : err.name === 'NotFoundError'
            ? 'No camera found. Please connect a camera and try again.'
            : 'Could not access camera.'
        : 'Failed to start camera'
      setError(msg)
      setState('error')
    }
  }, [settings, stopStream])

  const startRecording = useCallback(() => {
    if (!streamRef.current || state !== 'preview') return

    chunksRef.current = []

    const mimeType = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ].find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: settings.quality === '1080p' ? 8000000 : settings.quality === '720p' ? 4000000 : 2000000,
      audioBitsPerSecond: 128000,
    })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const dur = (Date.now() - startTimeRef.current) / 1000

      const { thumbnailBlob, thumbnailUrl } = await captureThumbnail(videoRef.current)

      setTrack({ blob, url, duration: dur, thumbnailBlob, thumbnailUrl })
      setState('done')
    }

    recorderRef.current = recorder
    recorder.start(200)
    startTimeRef.current = Date.now()
    setState('recording')

    timerRef.current = setInterval(() => {
      setDuration((Date.now() - startTimeRef.current) / 1000)
    }, 100)
  }, [state, settings])

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause()
      if (timerRef.current) clearInterval(timerRef.current)
      setState('paused')
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume()
      setState('recording')
      timerRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000)
      }, 100)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    stopStream()
  }, [stopStream])

  const switchCamera = useCallback(async () => {
    const newFacing = settings.facingMode === 'user' ? 'environment' : 'user'
    setSettings(s => ({ ...s, facingMode: newFacing }))
    if (videoRef.current && state === 'preview') {
      stopStream()
      await startPreview(videoRef.current)
    }
  }, [settings.facingMode, state, stopStream, startPreview])

  const reset = useCallback(() => {
    stopStream()
    if (timerRef.current) clearInterval(timerRef.current)
    setState('idle')
    setDuration(0)
    setTrack(null)
    setError(null)
    chunksRef.current = []
    recorderRef.current = null
  }, [stopStream])

  const updateSettings = useCallback((updates: Partial<VideoSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  return {
    state,
    error,
    duration,
    track,
    settings,
    startPreview,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    switchCamera,
    reset,
    updateSettings,
  }
}

async function captureThumbnail(
  video: HTMLVideoElement | null
): Promise<{ thumbnailBlob: Blob | null; thumbnailUrl: string | null }> {
  if (!video) return { thumbnailBlob: null, thumbnailUrl: null }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return { thumbnailBlob: null, thumbnailUrl: null }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    return new Promise<{ thumbnailBlob: Blob | null; thumbnailUrl: string | null }>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve({ thumbnailBlob: null, thumbnailUrl: null })
          resolve({ thumbnailBlob: blob, thumbnailUrl: URL.createObjectURL(blob) })
        },
        'image/jpeg',
        0.85
      )
    })
  } catch {
    return { thumbnailBlob: null, thumbnailUrl: null }
  }
}
