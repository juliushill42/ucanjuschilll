import OpenAI from 'openai'
import { ElevenLabsClient } from 'elevenlabs'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createReadStream } from 'fs'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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

/**
 * Transcribe audio using OpenAI Whisper with word-level timestamps
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  language?: string
): Promise<TranscriptionResult> {
  const tmpPath = join(tmpdir(), `juschill-${Date.now()}.mp3`)

  try {
    await writeFile(tmpPath, audioBuffer)

    const response = await openai.audio.transcriptions.create({
      file: createReadStream(tmpPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      language: language,
    })

    const segments: TranscriptionSegment[] = (response.segments ?? []).map((seg, idx) => ({
      id: idx,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }))

    return {
      text: response.text,
      segments,
      language: response.language ?? 'en',
      duration: response.duration ?? 0,
    }
  } finally {
    await unlink(tmpPath).catch(() => null)
  }
}

/**
 * Detect and remove silence/filler words from segments
 */
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

    // Check for silence (very short or empty segments)
    if (removeSilence && (text === '' || (duration < silenceThreshold && text.length < 3))) {
      removedSegments.push({ reason: 'silence', text: seg.text, start: seg.start, end: seg.end })
      continue
    }

    // Check for filler words
    if (removeFillers && FILLER_WORDS.has(text)) {
      removedSegments.push({ reason: 'filler', text: seg.text, start: seg.start, end: seg.end })
      continue
    }

    keepSegments.push(seg)
  }

  const fillerWordsRemoved = removedSegments.filter(r => r.reason === 'filler').length
  const silenceRemoved = removedSegments.filter(r => r.reason === 'silence').length

  return { keepSegments, removedSegments, fillerWordsRemoved, silenceRemoved }
}

/**
 * Generate AI-enhanced script/description for a post
 */
export async function generatePostDescription(
  transcription: string,
  genre: string
): Promise<{ description: string; tags: string[]; title: string }> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an assistant helping independent artists on JusChill — a platform for artists who can't afford a studio. 
        Generate an engaging post title, description, and relevant tags for their content.
        Return JSON with: title (string), description (string, max 200 chars), tags (array of 5 strings without #).`,
      },
      {
        role: 'user',
        content: `Genre: ${genre}\nTranscription: ${transcription.slice(0, 1000)}`,
      },
    ],
    max_tokens: 300,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response from AI')

  const parsed = JSON.parse(content)
  return {
    title: parsed.title ?? 'Untitled',
    description: parsed.description ?? '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
  }
}

/**
 * Text-to-speech using ElevenLabs
 */
export async function textToSpeech(
  text: string,
  voiceId: string = 'pNInz6obpgDQGcFmaJgB' // Default: Adam voice
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

/**
 * Get available ElevenLabs voices
 */
export async function getVoices() {
  const response = await elevenlabs.voices.getAll()
  return response.voices.map(v => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    previewUrl: v.preview_url,
  }))
}

/**
 * Use GPT-4o to generate a beat/song concept from a prompt
 */
export async function generateSongConcept(prompt: string, genre: string): Promise<{
  title: string
  concept: string
  lyricsOutline: string
  vibe: string
  suggestedBPM: number
  suggestedKey: string
}> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a music producer and creative director for independent artists. 
        Generate a detailed song concept. Return JSON: title, concept, lyricsOutline, vibe, suggestedBPM (number), suggestedKey (string like "C minor").`,
      },
      { role: 'user', content: `Genre: ${genre}\nPrompt: ${prompt}` },
    ],
    max_tokens: 600,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response from AI')
  return JSON.parse(content)
}
