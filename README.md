# FindYourBet (FYB)

Red social de apuestas deportivas. Los tipsters crean canales y venden picks o suscripciones VIP a sus seguidores.

## ¿Qué es?

FYB conecta tres tipos de usuarios:

- **Apostadores** — registran sus picks y hacen seguimiento de su rendimiento
- **Tipsters** — crean canales (públicos o VIP de pago) y monetizan su contenido
- **Comunidad** — sigue tipsters, interactúa con picks, usa DMs y el feed social

Actualmente en **beta privada** (código de acceso requerido).

## Stack

- React 18 + Vite (JavaScript)
- Supabase (auth + PostgreSQL)
- Stripe Connect (pagos tipster → seguidor, con comisión FYB)
- Framer Motion (animaciones)
- Vercel (deploy) + Cloudflare (DNS) → [fyourbet.com](https://fyourbet.com)

## Desarrollo local

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Build de producción
npm run lint      # ESLint
```

## Ramas

| Rama | Contenido |
|------|-----------|
| `master` | Todo el código fuente de la aplicación |
| `main` | Documentación del repositorio |

El trabajo de desarrollo se hace en `master`.

## Funcionalidades principales

- Registro y login (email + Google OAuth)
- Tracking de apuestas con estadísticas de yield y ROI
- Canales de tipsters con chat, picks y contenido VIP
- Sistema de pagos con Stripe Connect
- Feed social, follows, DMs, notificaciones
- Panel de administración
- Ranking global de tipsters
