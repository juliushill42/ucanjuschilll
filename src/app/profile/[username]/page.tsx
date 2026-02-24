import { notFound } from 'next/navigation'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { MainNav } from '@/components/layout/MainNav'
import { Feed } from '@/components/feed/Feed'
import { BadgeCheck, MapPin, Globe, Calendar } from 'lucide-react'
import { formatCount, getInitials } from '@/lib/utils'
import { FollowButton } from '@/components/ui/FollowButton'

export default async function ProfilePage({
  params,
}: {
  params: { username: string }
}) {
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

  if (!user) notFound()

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

  const isOwner = session?.user?.id === user.id

  return (
    <div className="flex">
      <MainNav />
      <main className="ml-64 flex-1 min-h-screen">
        {/* Banner */}
        <div className="relative h-44 bg-gradient-to-br from-brand-500/30 to-surface-3">
          {user.bannerUrl && (
            <Image
              src={user.bannerUrl}
              alt="Profile banner"
              fill
              className="object-cover"
            />
          )}
        </div>

        <div className="max-w-2xl mx-auto px-4">
          {/* Profile header */}
          <div className="relative -mt-16 mb-6">
            <div className="flex items-end justify-between">
              {/* Avatar */}
              <div className="w-28 h-28 rounded-full border-4 border-surface-0 bg-surface-2 flex items-center justify-center overflow-hidden">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.displayName}
                    width={112}
                    height={112}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-brand-400">
                    {getInitials(user.displayName)}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-16">
                {isOwner ? (
                  <button className="btn-secondary text-sm">Edit Profile</button>
                ) : (
                  <FollowButton
                    username={user.username}
                    initialFollowing={isFollowing}
                  />
                )}
              </div>
            </div>

            {/* User info */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{user.displayName}</h1>
                {user.isVerified && <BadgeCheck className="w-5 h-5 text-brand-400" />}
                {user.isPro && (
                  <span className="badge bg-yellow-500/15 text-yellow-400 text-xs">PRO</span>
                )}
              </div>
              <div className="text-white/50">@{user.username}</div>

              {user.bio && (
                <p className="text-white/80 text-sm leading-relaxed max-w-lg">{user.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-white/40">
                {user.genre && <span className="text-brand-400">#{user.genre}</span>}
                {user.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {user.location}
                  </span>
                )}
                {user.website && (
                  <a
                    href={user.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-brand-400 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {user.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 pt-2">
                <div>
                  <span className="font-bold text-white">{formatCount(user._count.posts)}</span>
                  <span className="text-white/40 text-sm ml-1">Posts</span>
                </div>
                <div>
                  <span className="font-bold text-white">{formatCount(user._count.followers)}</span>
                  <span className="text-white/40 text-sm ml-1">Followers</span>
                </div>
                <div>
                  <span className="font-bold text-white">{formatCount(user._count.following)}</span>
                  <span className="text-white/40 text-sm ml-1">Following</span>
                </div>
              </div>
            </div>
          </div>

          {/* Posts */}
          <div className="pb-8">
            <Feed type="explore" userId={user.id} />
          </div>
        </div>
      </main>
    </div>
  )
}
