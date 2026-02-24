export type PostWithUser = {
  id: string
  userId: string
  title: string
  description: string | null
  type: 'AUDIO' | 'VIDEO' | 'AUDIO_VIDEO'
  genre: string | null
  tags: string[]
  audioUrl: string | null
  videoUrl: string | null
  thumbnailUrl: string | null
  waveformData: number[] | null
  duration: number | null
  bpm: number | null
  key: string | null
  aiProcessed: boolean
  playCount: number
  likeCount: number
  commentCount: number
  repostCount: number
  createdAt: Date
  user: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    isVerified: boolean
    isPro: boolean
  }
  _liked?: boolean
  _reposted?: boolean
}

export type CommentWithUser = {
  id: string
  postId: string
  userId: string
  parentId: string | null
  text: string
  createdAt: Date
  user: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  replies?: CommentWithUser[]
}

export type UserProfile = {
  id: string
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  genre: string | null
  location: string | null
  website: string | null
  isVerified: boolean
  isPro: boolean
  createdAt: Date
  _followerCount: number
  _followingCount: number
  _postCount: number
  _isFollowing?: boolean
}
