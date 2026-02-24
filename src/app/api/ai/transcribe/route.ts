import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { transcribeAudio, analyzeSmartCuts } from '@/lib/ai'
import { isValidAudioFile } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const language = formData.get('language') as string | undefined
    const smartCut = formData.get('smartCut') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    if (!isValidAudioFile(file.type)) {
      return NextResponse.json({ error: 'Invalid audio format' }, { status: 400 })
    }

    // 25MB limit for Whisper API
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio file too large for transcription. Maximum 25MB.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const transcription = await transcribeAudio(buffer, language)

    let smartCutResult = null
    if (smartCut && transcription.segments.length > 0) {
      smartCutResult = analyzeSmartCuts(transcription.segments, {
        removeFillers: true,
        removeSilence: true,
        silenceThreshold: 0.4,
      })
    }

    return NextResponse.json({
      transcription,
      smartCut: smartCutResult,
    })
  } catch (error) {
    console.error('[TRANSCRIBE ERROR]', error)
    return NextResponse.json({ error: 'Transcription failed. Please try again.' }, { status: 500 })
  }
}
