import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            isPro: true,
            bio: true,
            genre: true,
            _count: { select: { followers: true, following: true, posts: true } },
          },
        },
        captions: { orderBy: { startTime: 'asc' } },
      },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    let liked = false
    if (session?.user?.id) {
      const like = await prisma.like.findUnique({
        where: { userId_postId: { userId: session.user.id, postId: post.id } },
      })
      liked = !!like
    }

    return NextResponse.json({ post: { ...post, _liked: liked } })
  } catch (error) {
    console.error('[POST GET ERROR]', error)
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: { userId: true },
    })

    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (post.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.post.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST DELETE ERROR]', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}

// PATCH /api/posts/[id] — increment play count
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    if (body.action === 'play') {
      await prisma.post.update({
        where: { id: params.id },
        data: { playCount: { increment: 1 } },
      })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[POST PATCH ERROR]', error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}
