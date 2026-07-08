import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useFeed } from './hooks/useFeed'
import FeedCard from './FeedCard'
import AppIcon from '../../../components/ui/AppIcon'

const TABS = [
  { id: 'siguiendo', icon: 'users', labelKey: 'feed.tabs.following' },
  { id: 'descubre',  icon: 'flame', labelKey: 'feed.tabs.forYou' },
]

// Marks post as seen only after being visible for 800ms (like a view count)
function SeenObserver({ postId, onSeen, children }) {
  const ref = useRef(null)
  const seen = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || seen.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Start timer — only counts if still visible after 800ms
          timer.current = setTimeout(() => {
            if (!seen.current) {
              seen.current = true
              onSeen(postId)
              observer.disconnect()
            }
          }, 800)
        } else {
          // Scrolled away before timer fired — cancel
          clearTimeout(timer.current)
        }
      },
      { threshold: 0.6 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(timer.current)
    }
  }, [postId, onSeen])

  return <div ref={ref}>{children}</div>
}

export default function Feed({ user, onNavigateToChannel }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('siguiendo')
  const {
    followingFeed, discoverFeed, loading, toggleLike,
    markSeen, followingAllSeen, discoverAllSeen,
  } = useFeed(user?.id)

  const stableMarkSeen = useCallback(markSeen, [markSeen])

  const posts = activeTab === 'siguiendo' ? followingFeed : discoverFeed
  const allSeen = activeTab === 'siguiendo' ? followingAllSeen : discoverAllSeen

  return (
    <motion.div key="feed"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header">
        <h2>Feed</h2>
        <p>{t('feed.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px', marginBottom: '20px', width: 'fit-content' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '8px 20px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.15s', background: activeTab === tab.id ? 'var(--color-primary)' : 'transparent', color: activeTab === tab.id ? '#010906' : 'var(--color-text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name={tab.icon} size={13} />{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><div className="empty-icon"><AppIcon name="loading" size={48} /></div><div>{t('feed.loading')}</div></div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><AppIcon name={activeTab === 'siguiendo' ? 'users' : 'flame'} size={48} /></div>
          <div className="empty-title">
            {activeTab === 'siguiendo' ? t('feed.emptyFollowing') : t('feed.emptyForYou')}
          </div>
          <div className="empty-sub">
            {activeTab === 'siguiendo'
              ? t('feed.emptyFollowingSub')
              : t('feed.emptyForYouSub')}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: '600px' }}>
          {/* Banner: recycled posts */}
          {allSeen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
              <AppIcon name="success" size={18} color="var(--color-primary)" />
              <span>{t('feed.allSeen')}</span>
            </div>
          )}
          <AnimatePresence>
            {posts.map(post => (
              <SeenObserver key={post.id} postId={post.id} onSeen={stableMarkSeen}>
                <FeedCard
                  post={post}
                  currentUser={user}
                  onLike={toggleLike}
                  onNavigateToChannel={onNavigateToChannel}
                  onReport={() => {}}
                />
              </SeenObserver>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
