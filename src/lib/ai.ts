import { GoogleGenerativeAI } from '@google/generative-ai'
import { ElevenLabsClient } from 'elevenlabs'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '')
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })

export type TranscriptionSegment = {
  id: number
  start: number
  end: number
  text: string
}

export type TranscriptionResult = {
  text: string
  segments: TranscriptionSegment[]
  language: string
  duration: number
}

export type SmartCutResult = {
  keepSegments: TranscriptionSegment[]
  removedSegments: { reason: string; text: string; start: number; end: number }[]
  fillerWordsRemoved: number
  silenceRemoved: number
}

const FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'like', 'you know', 'i mean',
  'basically', 'literally', 'actually', 'sort of', 'kind of',
  'right', 'so', 'well', 'hmm', 'mhm'
])

export function analyzeSmartCuts(
  segments: TranscriptionSegment[],
  options: { removeFillers?: boolean; removeSilence?: boolean; silenceThreshold?: number } = {}
): SmartCutResult {
  const { removeFillers = true, removeSilence = true, silenceThreshold = 0.5 } = options
  const keepSegments: TranscriptionSegment[] = []
  const removedSegments: SmartCutResult['removedSegments'] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const text = seg.text.trim().toLowerCase()
    const duration = seg.end - seg.start

    if (removeSilence && (text === '' || (duration < silenceThreshold && text.length < 3))) {
      removedSegments.push({ reason: 'silence', text: seg.text, start: seg.start, end: seg.end })
      continue
    }

    if (removeFillers && FILLER_WORDS.has(text)) {
      removedSegments.push({ reason: 'filler', text: seg.text, start: seg.start, end: seg.end })
      continue
    }

    keepSegments.push(seg)
  }

  return {
    keepSegments,
    removedSegments,
    fillerWordsRemoved: removedSegments.filter(r => r.reason === 'filler').length,
    silenceRemoved: removedSegments.filter(r => r.reason === 'silence').length,
  }
}

export async function generatePostDescription(
  transcription: string,
  genre: string
): Promise<{ description: string; tags: string[]; title: string }> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
  const prompt = `You are an assistant helping independent artists on JusChill.
Generate an engaging post title, description, and relevant tags.
Return valid JSON only with: title (string), description (string max 200 chars), tags (array of 5 strings without #).
Genre: ${genre}
Transcription: ${transcription.slice(0, 1000)}`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const cleaned = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned)
  return {
    title: parsed.title ?? 'Untitled',
    description: parsed.description ?? '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
  }
}

export async function generateSongConcept(prompt: string, genre: string): Promise<{
  title: string
  concept: string
  lyricsOutline: string
  vibe: string
  suggestedBPM: number
  suggestedKey: string
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
  const fullPrompt = `You are a music producer for independent artists on JusChill.
Generate a detailed song concept. Return valid JSON only with: title, concept, lyricsOutline, vibe, suggestedBPM (number), suggestedKey (string like "C minor").
Genre: ${genre}
Prompt: ${prompt}`

  const result = await model.generateContent(fullPrompt)
  const text = result.response.text()
  const cleaned = text.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned)
}

export async function textToSpeech(
  text: string,
  voiceId: string = 'pNInz6obpgDQGcFmaJgB'
): Promise<Buffer> {
  const audio = await elevenlabs.generate({
    voice: voiceId,
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    },
  })

  const chunks: Buffer[] = []
  for await (const chunk of audio) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export async function getVoices() {
  const response = await elevenlabs.voices.getAll()
  return response.voices.map(v => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    previewUrl: v.preview_url,
  }))
}
