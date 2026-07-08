import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import AppIcon from '../../../components/ui/AppIcon'

export default function PollCard({ messageId, poll, currentUser, timeStr, viewCount = 0, isCreator, onFinalize }) {
  const [votes, setVotes] = useState([])
  const [voting, setVoting] = useState(false)
  const [finalizing, setFinalizing] = useState(false)

  const isClosed = !!poll?.closed

  useEffect(() => {
    if (!messageId) return
    supabase.from('poll_votes').select('user_id, option_index').eq('message_id', messageId)
      .then(({ data }) => setVotes(data || []))
  }, [messageId])

  const myVotes = votes.filter(v => v.user_id === currentUser?.id).map(v => v.option_index)
  const hasVoted = myVotes.length > 0
  const totalVoters = new Set(votes.map(v => v.user_id)).size

  const getCount = (i) => votes.filter(v => v.option_index === i).length
  const getPct = (i) => {
    if (votes.length === 0) return 0
    return Math.round((getCount(i) / votes.length) * 100)
  }

  const handleVote = async (i) => {
    if (!currentUser?.id || voting || isClosed) return
    const alreadyVoted = myVotes.includes(i)
    setVoting(true)

    if (alreadyVoted) {
      await supabase.from('poll_votes')
        .delete().eq('message_id', messageId).eq('user_id', currentUser.id).eq('option_index', i)
      setVotes(prev => prev.filter(v => !(v.user_id === currentUser.id && v.option_index === i)))
    } else {
      if (!poll.allowMultiple) {
        await supabase.from('poll_votes')
          .delete().eq('message_id', messageId).eq('user_id', currentUser.id)
        setVotes(prev => prev.filter(v => v.user_id !== currentUser.id))
      }
      await supabase.from('poll_votes').insert({ message_id: messageId, user_id: currentUser.id, option_index: i })
      setVotes(prev => [...prev, { user_id: currentUser.id, option_index: i }])
    }
    setVoting(false)
  }

  const handleFinalize = async () => {
    if (finalizing || !onFinalize) return
    setFinalizing(true)
    await onFinalize()
    setFinalizing(false)
  }

  return (
    <div style={{
      background: 'var(--color-bg)',
      border: `0.5px solid ${isClosed ? 'var(--color-border)' : 'var(--color-border)'}`,
      borderLeft: `3px solid ${isClosed ? 'var(--color-text-muted)' : 'var(--color-primary)'}`,
      borderRadius: 'var(--radius-lg)',
      minWidth: '240px',
      maxWidth: '320px',
      overflow: 'hidden',
      opacity: isClosed ? 0.85 : 1,
    }}>
      <div style={{ padding: '14px 16px 12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: isClosed ? 'var(--color-text-muted)' : 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AppIcon name={isClosed ? 'lock' : 'vote'} size={10} />{isClosed ? 'Encuesta cerrada' : 'Encuesta'}</span>
          </span>
          {!isClosed && poll.allowMultiple && (
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
              Múltiple
            </span>
          )}
        </div>

        {/* Pregunta */}
        <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.4, marginBottom: '14px', color: 'var(--color-text)' }}>
          {poll.question}
        </div>

        {/* Opcions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {poll.options.map((opt, i) => {
            const count = getCount(i)
            const pct = getPct(i)
            const isMyVote = myVotes.includes(i)
            const clickable = !voting && !isClosed
            return (
              <div key={i} onClick={() => clickable && handleVote(i)}
                style={{ position: 'relative', borderRadius: 'var(--radius-md)', border: `0.5px solid ${isMyVote ? 'var(--color-primary)' : 'var(--color-border)'}`, overflow: 'hidden', cursor: clickable ? 'pointer' : 'default', transition: 'border-color 0.15s' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: isMyVote ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', transition: 'width 0.45s ease', borderRadius: 'var(--radius-md)' }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                    {isMyVote && <AppIcon name="check" size={11} color="var(--color-primary)" />}
                    <span style={{ fontSize: '13px', fontWeight: isMyVote ? 700 : 400, color: isMyVote ? 'var(--color-primary)' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    {(hasVoted || isClosed) && <span style={{ fontSize: '11px', fontWeight: 700, color: isMyVote ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{pct}%</span>}
                    {count > 0 && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>({count})</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {totalVoters === 0 ? t('poll.noVotes') : t('poll.participantCount', { count: totalVoters })}
          </span>
          {isCreator && !isClosed && (
            <button onClick={handleFinalize} disabled={finalizing}
              style={{ background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '3px 9px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', flexShrink: 0, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {finalizing ? '...' : <><AppIcon name="lock" size={11} /> {t('poll.finalize')}</>}
            </button>
          )}
          <span style={{ flex: 1 }} />
          {(timeStr || viewCount > 0) && (
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', opacity: 0.65, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {viewCount > 0 && <><AppIcon name="eye" size={10} /> {viewCount} · </>}{timeStr}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
