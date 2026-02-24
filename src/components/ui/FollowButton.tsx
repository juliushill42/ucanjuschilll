'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from './Toaster'
import { cn } from '@/lib/utils'
import { UserPlus, UserCheck } from 'lucide-react'

type FollowButtonProps = {
  username: string
  initialFollowing: boolean
}

export function FollowButton({ username, initialFollowing }: FollowButtonProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { add: toast } = useToast()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  const handleFollow = async () => {
    if (!session?.user) {
      router.push('/login')
      return
    }

    if (loading) return
    setLoading(true)

    const prev = following
    setFollowing(!following)

    try {
      const res = await fetch(`/api/users/${username}/follow`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setFollowing(data.following)
      toast(data.following ? `Following @${username}` : `Unfollowed @${username}`, 'success')
    } catch {
      setFollowing(prev)
      toast('Failed to update follow', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      className={cn(
        'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-70',
        following
          ? 'bg-surface-3 border border-white/10 text-white/70 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/10'
          : 'bg-brand-500 text-white hover:bg-brand-600 glow-brand-sm'
      )}
    >
      {following
        ? <><UserCheck className="w-4 h-4" /> Following</>
        : <><UserPlus className="w-4 h-4" /> Follow</>
      }
    </button>
  )
}
