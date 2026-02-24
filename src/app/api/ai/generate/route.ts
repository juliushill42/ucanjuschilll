import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateSongConcept, generatePostDescription, textToSpeech, getVoices } from '@/lib/ai'
import { z } from 'zod'

const conceptSchema = z.object({
  action: z.enum(['concept', 'description', 'tts', 'voices']),
  prompt: z.string().max(500).optional(),
  genre: z.string().optional(),
  transcription: z.string().max(3000).optional(),
  text: z.string().max(1000).optional(),
  voiceId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = conceptSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { action, prompt, genre, transcription, text, voiceId } = parsed.data

    if (action === 'concept') {
      if (!prompt || !genre) {
        return NextResponse.json({ error: 'Prompt and genre required' }, { status: 400 })
      }
      const concept = await generateSongConcept(prompt, genre)
      return NextResponse.json({ concept })
    }

    if (action === 'description') {
      if (!transcription || !genre) {
        return NextResponse.json({ error: 'Transcription and genre required' }, { status: 400 })
      }
      const result = await generatePostDescription(transcription, genre)
      return NextResponse.json({ result })
    }

    if (action === 'tts') {
      if (!text) {
        return NextResponse.json({ error: 'Text required for TTS' }, { status: 400 })
      }
      const audioBuffer = await textToSpeech(text, voiceId)
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'attachment; filename="voiceover.mp3"',
        },
      })
    }

    if (action === 'voices') {
      const voices = await getVoices()
      return NextResponse.json({ voices })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[AI GENERATE ERROR]', error)
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 500 })
  }
}
