import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const session = await auth()

    const user = await prisma.user.findUnique({
      where: { username: params.username },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        genre: true,
        location: true,
        website: true,
        isVerified: true,
        isPro: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: { where: { isPublished: true, isDraft: false } },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let isFollowing = false
    if (session?.user?.id && session.user.id !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: user.id,
          },
        },
      })
      isFollowing = !!follow
    }

    return NextResponse.json({
      user: {
        ...user,
        _followerCount: user._count.followers,
        _followingCount: user._count.following,
        _postCount: user._count.posts,
        _isFollowing: isFollowing,
      },
    })
  } catch (error) {
    console.error('[USER GET ERROR]', error)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

const updateSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(300).optional(),
  genre: z.string().optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  avatarUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.username !== params.username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { username: params.username },
      data: parsed.data,
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        genre: true,
        location: true,
        website: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('[USER PATCH ERROR]', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
