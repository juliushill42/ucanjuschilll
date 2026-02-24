import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { uploadAudio, uploadVideo, uploadImage } from '@/lib/cloudinary'
import { isValidAudioFile, isValidVideoFile, MAX_AUDIO_SIZE, MAX_VIDEO_SIZE, MAX_IMAGE_SIZE } from '@/lib/utils'

export const config = {
  api: { bodyParser: false },
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const uploadType = formData.get('type') as string | null // 'audio' | 'video' | 'image'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!uploadType || !['audio', 'video', 'image'].includes(uploadType)) {
      return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate file type and size
    if (uploadType === 'audio') {
      if (!isValidAudioFile(file.type)) {
        return NextResponse.json(
          { error: 'Invalid audio format. Accepted: MP3, WAV, OGG, WebM, AAC, FLAC' },
          { status: 400 }
        )
      }
      if (buffer.length > MAX_AUDIO_SIZE) {
        return NextResponse.json({ error: 'Audio file too large. Maximum 50MB.' }, { status: 400 })
      }

      const result = await uploadAudio(buffer, file.name, session.user.id)
      return NextResponse.json({ url: result.url, publicId: result.publicId, duration: result.duration })
    }

    if (uploadType === 'video') {
      if (!isValidVideoFile(file.type)) {
        return NextResponse.json(
          { error: 'Invalid video format. Accepted: MP4, WebM, MOV, AVI' },
          { status: 400 }
        )
      }
      if (buffer.length > MAX_VIDEO_SIZE) {
        return NextResponse.json({ error: 'Video file too large. Maximum 500MB.' }, { status: 400 })
      }

      const result = await uploadVideo(buffer, file.name, session.user.id)
      return NextResponse.json({ url: result.url, publicId: result.publicId, duration: result.duration })
    }

    if (uploadType === 'image') {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
      }
      if (buffer.length > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: 'Image too large. Maximum 10MB.' }, { status: 400 })
      }

      const result = await uploadImage(buffer, session.user.id)
      return NextResponse.json({ url: result.url, publicId: result.publicId })
    }

    return NextResponse.json({ error: 'Unknown upload type' }, { status: 400 })
  } catch (error) {
    console.error('[UPLOAD ERROR]', error)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
