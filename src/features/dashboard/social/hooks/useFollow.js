import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { insertNotification } from '../../notifications/useNotifications'

export function useFollow(currentUserId) {
  const [following, setFollowing] = useState([]) // IDs que segueixo
  const [followers, setFollowers] = useState([]) // IDs que em segueixen
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUserId) return
    fetchFollows()
  }, [currentUserId])

  const fetchFollows = async () => {
    setLoading(true)
    try {
      const [{ data: followingData }, { data: followersData }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
        supabase.from('follows').select('follower_id').eq('following_id', currentUserId)
      ])
      setFollowing(followingData?.map(f => f.following_id) || [])
      setFollowers(followersData?.map(f => f.follower_id) || [])
    } catch (e) {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const follow = async (userId, fromUsername) => {
    await supabase.from('follows').insert({ follower_id: currentUserId, following_id: userId })
    setFollowing(prev => [...prev, userId])
    await insertNotification({ userId, type: 'follow', fromUserId: currentUserId, fromUsername: fromUsername || 'alguien' })
  }

  const unfollow = async (userId) => {
    await supabase.from('follows').delete()
      .eq('follower_id', currentUserId).eq('following_id', userId)
    setFollowing(prev => prev.filter(id => id !== userId))
  }

  const isFollowing = (userId) => following.includes(userId)
  const isFollower = (userId) => followers.includes(userId)
  const isMutual = (userId) => isFollowing(userId) && isFollower(userId)

  return { following, followers, loading, follow, unfollow, isFollowing, isFollower, isMutual, refetch: fetchFollows }
}