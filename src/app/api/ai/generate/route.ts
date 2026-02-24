import { NextResponse } from 'next/server'
import { generatePostDescription, generateSongConcept } from '@/lib/ai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { type, prompt, genre, transcription } = await req.json()
    if (type === 'song') {
      const result = await generateSongConcept(prompt, genre)
      return NextResponse.json(result)
    }
    const result = await generatePostDescription(transcription, genre)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
