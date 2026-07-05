// Llista de suggeriments d'usuaris en escriure @ al xat.
// Es posiciona just damunt de l'input (l'ancestre ha de ser position:relative).
import AppIcon from './AppIcon'

export default function MentionDropdown({ items, active, onPick }) {
  if (!items?.length) return null
  return (
    <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: '280px', maxWidth: '90%', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 60, overflow: 'hidden' }}>
      {items.map((u, i) => (
        // onMouseDown + preventDefault: evita que el textarea perdi el focus abans del clic.
        <div key={u.id} onMouseDown={(e) => { e.preventDefault(); onPick(u) }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', background: i === active ? 'var(--color-bg-soft)' : 'transparent', borderBottom: i < items.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
            {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.username || '?')[0].toUpperCase()}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{u.username}{u._self ? ' (tú)' : ''}
          </span>
          {u.is_verified && <span style={{ color: 'var(--color-primary)', flexShrink: 0, display: 'flex' }}><AppIcon name="check" size={12} /></span>}
        </div>
      ))}
    </div>
  )
}
