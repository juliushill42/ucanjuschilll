import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const commentSchema = z.object({
  text: z.string().min(1).max(500),
  parentId: z.string().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const comments = await prisma.comment.findMany({
      where: { postId: params.id, parentId: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: 10,
        },
      },
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('[COMMENTS GET ERROR]', error)
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid comment' }, { status: 400 })
    }

    const postId = params.id
    const userId = session.user.id

    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          postId,
          userId,
          text: parsed.data.text,
          parentId: parsed.data.parentId ?? null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
    ])

    // Create notification for post owner
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (post && post.userId !== userId) {
      await prisma.notification.create({
        data: {
          recipientId: post.userId,
          triggerId: userId,
          type: 'COMMENT',
          postId,
        },
      })
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('[COMMENTS POST ERROR]', error)
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }
}
