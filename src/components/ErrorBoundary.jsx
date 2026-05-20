import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[FYB ErrorBoundary]', error, info)
  }

  handleReset = () => {
    Object.keys(localStorage)
      .filter(k => k.includes('supabase') || k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k))
    window.location.href = '/'
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg, #0a0a0a)', padding: '20px' }}>
        <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center', background: 'var(--color-bg-soft, #111)', border: '0.5px solid var(--color-border, #222)', borderRadius: '16px', padding: '32px 24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #fff)', marginBottom: '8px' }}>
            Algo ha ido mal
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted, #888)', lineHeight: 1.5, marginBottom: '24px' }}>
            La aplicación ha encontrado un error inesperado. Puedes recargar la página o restablecer la sesión si el problema persiste.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={this.handleReload}
              style={{ padding: '11px', borderRadius: '8px', border: 'none', background: 'var(--color-primary, #0F6E56)', color: '#010906', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'inherit' }}>
              Recargar página
            </button>
            <button onClick={this.handleReset}
              style={{ padding: '11px', borderRadius: '8px', border: '0.5px solid var(--color-border, #222)', background: 'transparent', color: 'var(--color-text-muted, #888)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit' }}>
              Cerrar sesión y volver al inicio
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <details style={{ marginTop: '20px', textAlign: 'left', fontSize: '11px', color: 'var(--color-text-muted, #888)' }}>
              <summary style={{ cursor: 'pointer' }}>Detalles técnicos</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '8px' }}>{String(this.state.error?.stack || this.state.error)}</pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
