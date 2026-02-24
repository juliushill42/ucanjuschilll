import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['AUDIO', 'VIDEO', 'AUDIO_VIDEO']),
  genre: z.string().optional(),
  tags: z.array(z.string()).max(10).optional(),
  audioUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  waveformData: z.array(z.number()).optional(),
  duration: z.number().optional(),
  bpm: z.number().int().optional(),
  key: z.string().optional(),
  captions: z.array(z.object({
    language: z.string().default('en'),
    startTime: z.number(),
    endTime: z.number(),
    text: z.string(),
  })).optional(),
  aiProcessed: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor')
    const type = searchParams.get('type') // 'following' | 'explore' | 'trending'
    const genre = searchParams.get('genre')
    const limit = 20

    let whereClause: Record<string, unknown> = { isPublished: true, isDraft: false }

    if (type === 'following' && session?.user?.id) {
      const following = await prisma.follow.findMany({
        where: { followerId: session.user.id },
        select: { followingId: true },
      })
      const followingIds = following.map(f => f.followingId)
      whereClause = { ...whereClause, userId: { in: [session.user.id, ...followingIds] } }
    }

    if (genre) {
      whereClause = { ...whereClause, genre }
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: type === 'trending'
        ? [{ likeCount: 'desc' }, { createdAt: 'desc' }]
        : { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            isPro: true,
          },
        },
      },
    })

    let likedIds = new Set<string>()
    if (session?.user?.id) {
      const likes = await prisma.like.findMany({
        where: {
          userId: session.user.id,
          postId: { in: posts.map(p => p.id) },
        },
        select: { postId: true },
      })
      likedIds = new Set(likes.map(l => l.postId))
    }

    const hasMore = posts.length > limit
    const items = posts.slice(0, limit).map(p => ({
      ...p,
      waveformData: p.waveformData as number[] | null,
      _liked: likedIds.has(p.id),
    }))

    return NextResponse.json({
      posts: items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    })
  } catch (error) {
    console.error('[POSTS GET ERROR]', error)
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid data' },
        { status: 400 }
      )
    }

    const { captions, ...postData } = parsed.data

    const post = await prisma.post.create({
      data: {
        ...postData,
        userId: session.user.id,
        tags: postData.tags ?? [],
        waveformData: postData.waveformData ? postData.waveformData : undefined,
        captions: captions && captions.length > 0
          ? { createMany: { data: captions } }
          : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            isPro: true,
          },
        },
        captions: true,
      },
    })

    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    console.error('[POSTS POST ERROR]', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
