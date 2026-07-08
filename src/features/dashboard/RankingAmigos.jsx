import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { fadeUp, stagger } from '../../lib/animations'
import { supabase } from '../../lib/supabase'
import { useRanking, MIN_BETS, SPORT_ICONS } from './Ranking'
import { useProfileNav } from '../../contexts/ProfileNavContext'
import Username from '../../components/ui/Username'
import AppIcon from '../../components/ui/AppIcon'
import './dashboard.css'

const PERIODS = [
  { id: 'trimestral', labelKey: 'ranking.periods.global' },
  { id: 'setmanal',   labelKey: 'ranking.periods.weekly' },
  { id: 'mensual',    labelKey: 'ranking.periods.monthly' },
  { id: 'anual',      labelKey: 'ranking.periods.annual' },
  { id: 'total',      labelKey: 'ranking.periods.total' },
]

export default function RankingAmigos({ user }) {
  const { t } = useTranslation()
  const openProfile = useProfileNav()
  const [period, setPeriod] = useState('trimestral')
  const [friendIds, setFriendIds] = useState(null)
  const [friendsLoading, setFriendsLoading] = useState(true)

  const [hideMe, setHideMe] = useState(false)

  const toggleHideMe = async () => {
    const next = !hideMe
    setHideMe(next)
    await supabase.from('profiles').update({ hide_from_ranking: next }).eq('id', user.id)
  }

  useEffect(() => {
    if (!user?.id) { setFriendsLoading(false); return }
    // Safety timer + .catch: si una query peta, friendsLoading no queda penjat.
    const safetyTimer = setTimeout(() => setFriendsLoading(false), 10000)
    Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
      supabase.from('profiles').select('hide_from_ranking').eq('id', user.id).single(),
    ]).then(([{ data: following }, { data: followers }, { data: profile }]) => {
      const followingSet = new Set((following || []).map(f => f.following_id))
      const mutual = (followers || []).map(f => f.follower_id).filter(id => followingSet.has(id))
      setFriendIds([...mutual, user.id])
      setHideMe(profile?.hide_from_ranking ?? false)
    }).catch(() => {
      setFriendIds([user.id])
    }).finally(() => {
      clearTimeout(safetyTimer)
      setFriendsLoading(false)
    })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveFriendIds = hideMe
    ? (friendIds ?? []).filter(id => id !== user?.id)
    : (friendIds ?? [])

  const { ranking, loading } = useRanking(period, [], 'public', effectiveFriendIds)

  return (
    <motion.div key="ranking-amigos"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header">
        <h2><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><AppIcon name="users" size={20} /> Amigos</span></h2>
        <p>Ranking de tus amigos mutuos. Mínimo {MIN_BETS} picks resueltos para aparecer.</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Period pills */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px', flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', background: period === p.id ? 'var(--color-primary)' : 'transparent', color: period === p.id ? '#010906' : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
              {t(p.labelKey)}
            </button>
          ))}
        </div>

        {/* Ocultar-me toggle */}
        <button onClick={toggleHideMe}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: 'var(--radius-lg)', border: `0.5px solid ${hideMe ? 'var(--color-primary)' : 'var(--color-border)'}`, background: hideMe ? 'var(--color-primary-light)' : 'var(--color-bg)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '18px', borderRadius: '999px', background: hideMe ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: '3px', left: hideMe ? '17px' : '3px', width: '12px', height: '12px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: hideMe ? 'var(--color-primary)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {t('ranking.friends.hideMe')}
          </span>
        </button>
      </div>

      {friendsLoading || loading ? (
        <div className="empty-state">
          <div className="empty-icon"><AppIcon name="loading" size={48} /></div>
          <div>{friendsLoading ? t('ranking.friends.loadingFriends') : t('ranking.loading')}</div>
        </div>
      ) : friendIds !== null && friendIds.length <= 1 ? (
        <div className="empty-state">
          <div className="empty-icon"><AppIcon name="users" size={48} /></div>
          <div className="empty-title">{t('ranking.friends.noFriends')}</div>
          <div className="empty-sub">{t('ranking.friends.noFriendsSub')}</div>
        </div>
      ) : ranking.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><AppIcon name="users" size={48} /></div>
          <div className="empty-title">{t('ranking.friends.noFriendsRanking')}</div>
          <div className="empty-sub">{t('ranking.friends.noFriendsRankingSub', { n: MIN_BETS })}</div>
        </div>
      ) : (
        <AnimatePresence>
          <motion.div className="ranking-list" initial="hidden" animate="visible" variants={stagger}>
            {ranking.map((entry, i) => (
              <motion.div key={entry.userId} className="ranking-item" variants={fadeUp}
                layout whileHover={{ x: 4, transition: { duration: 0.2 } }}>

                <div className={`rank-pos ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}`}>
                  #{i + 1}
                </div>

                <div className="tipster-info-rank">
                  <div className="tipster-name-rank" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span onClick={() => openProfile(entry.userId)} style={{ cursor: 'pointer' }}>
                      <Username username={entry.username} isVerified={entry.isVerified} size="sm" />
                    </span>
                    {user?.id === entry.userId && (
                      <span style={{ fontSize: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-primary-border)', fontWeight: 600 }}>
                        {t('tipsters.you')}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span className="tipster-user-rank" style={{ margin: 0 }}>{entry.bets} {t('ranking.friends.resolvedPicks')}</span>
                    {entry.usedSports?.map(s => (
                      <span key={s} style={{ fontSize: '10px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '1px 7px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        {SPORT_ICONS[s]} {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rank-metrics">
                  <div className="rank-metric">
                    <div className={`rank-metric-val ${entry.yieldVal >= 0 ? '' : 'red'}`}>
                      {entry.yieldVal >= 0 ? '+' : ''}{entry.yieldVal.toFixed(1)}%
                    </div>
                    <div className="rank-metric-label">Yield</div>
                  </div>
                  <div className="rank-metric">
                    <div className="rank-metric-val neutral">{entry.won}/{entry.lost}</div>
                    <div className="rank-metric-label">W/L</div>
                  </div>
                  <div className="rank-metric">
                    <div className="rank-metric-val neutral">{entry.avgOdds}</div>
                    <div className="rank-metric-label">{t('ranking.stats.avgOdds')}</div>
                  </div>
                  <div className="rank-metric">
                    <div className="rank-metric-val neutral">{entry.habitualStake}</div>
                    <div className="rank-metric-label">{t('ranking.stats.usualStake')}</div>
                  </div>
                </div>

              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  )
}
