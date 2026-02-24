import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const postId = params.id
    const userId = session.user.id

    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    })

    if (existing) {
      // Unlike
      await prisma.$transaction([
        prisma.like.delete({ where: { userId_postId: { userId, postId } } }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        }),
      ])
      return NextResponse.json({ liked: false })
    } else {
      // Like + create notification
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { userId: true },
      })

      await prisma.$transaction([
        prisma.like.create({ data: { userId, postId } }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        }),
        ...(post && post.userId !== userId
          ? [prisma.notification.create({
              data: {
                recipientId: post.userId,
                triggerId: userId,
                type: 'LIKE',
                postId,
              },
            })]
          : []),
      ])
      return NextResponse.json({ liked: true })
    }
  } catch (error) {
    console.error('[LIKE ERROR]', error)
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 })
  }
}
