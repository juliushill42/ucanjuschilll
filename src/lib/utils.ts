import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatTimeAgo(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function generateUsername(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) + Math.floor(Math.random() * 9999).toString()
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64')
}

export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64')
}

// Validates that a file is an accepted audio format
export function isValidAudioFile(type: string): boolean {
  return ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac'].includes(type)
}

// Validates that a file is an accepted video format
export function isValidVideoFile(type: string): boolean {
  return ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/ogg'].includes(type)
}

export const GENRES = [
  'Hip-Hop', 'R&B', 'Pop', 'Soul', 'Gospel', 'Jazz', 'Blues',
  'Rock', 'Country', 'Electronic', 'Reggae', 'Afrobeats', 'Latin',
  'Classical', 'Lo-Fi', 'Trap', 'Drill', 'Spoken Word', 'Podcast', 'Other'
]

export const MAX_AUDIO_SIZE = 50 * 1024 * 1024  // 50MB
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500MB
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10MB
