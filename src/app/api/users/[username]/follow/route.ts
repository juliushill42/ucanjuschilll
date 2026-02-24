import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { username: params.username },
      select: { id: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const followerId = session.user.id
    const followingId = targetUser.id

    if (followerId === followingId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    })

    if (existing) {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      })
      return NextResponse.json({ following: false })
    } else {
      await prisma.$transaction([
        prisma.follow.create({ data: { followerId, followingId } }),
        prisma.notification.create({
          data: {
            recipientId: followingId,
            triggerId: followerId,
            type: 'FOLLOW',
          },
        }),
      ])
      return NextResponse.json({ following: true })
    }
  } catch (error) {
    console.error('[FOLLOW ERROR]', error)
    return NextResponse.json({ error: 'Failed to update follow' }, { status: 500 })
  }
}
