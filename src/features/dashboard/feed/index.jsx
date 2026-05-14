import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFeed } from './hooks/useFeed'
import FeedCard from './FeedCard'

const TABS = [
  { id: 'siguiendo', label: '👥 Siguiendo' },
  { id: 'descubre', label: '🔥 Para ti' },
]

export default function Feed({ user, onNavigateToChannel }) {
  const [activeTab, setActiveTab] = useState('siguiendo')
  const { followingFeed, discoverFeed, loading, toggleLike, fetchComments, addComment } = useFeed(user?.id)

  const posts = activeTab === 'siguiendo' ? followingFeed : discoverFeed

  return (
    <motion.div key="feed"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header">
        <h2>Feed</h2>
        <p>Picks de los tipsters que sigues y descubre nuevas apuestas.</p>
      </div>

      <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px', marginBottom: '20px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 20px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.15s', background: activeTab === t.id ? 'var(--color-primary)' : 'transparent', color: activeTab === t.id ? '#010906' : 'var(--color-text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><div className="empty-icon">⏳</div><div>Cargando feed...</div></div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ fontSize: '40px' }}>{activeTab === 'siguiendo' ? '👥' : '🔥'}</div>
          <div className="empty-title">
            {activeTab === 'siguiendo' ? 'Sin picks de seguidos' : 'Sin picks para ti aún'}
          </div>
          <div className="empty-sub">
            {activeTab === 'siguiendo'
              ? 'Únete a canales de tipsters para ver sus picks aquí.'
              : 'No hay picks públicos disponibles en este momento.'}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: '600px' }}>
          <AnimatePresence>
            {posts.map(post => (
              <FeedCard
                key={post.id}
                post={post}
                currentUserId={user?.id}
                onLike={toggleLike}
                onComment={{ fetch: fetchComments, add: addComment }}
                onNavigateToChannel={onNavigateToChannel}
                onReport={() => {}}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
