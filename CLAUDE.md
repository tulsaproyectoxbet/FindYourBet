# CLAUDE.md

Guia per a Claude Code (claude.ai/code) quan treballa en aquest repositori.

---

## Què és FindYourBet (FYB)

**Xarxa social d'apostes esportives**, no només un tracker. Tres tipus d'usuaris convergeixen:

- **Apostadors** que registren els seus picks i fan seguiment del seu rendiment
- **Tipsters** que creen canals (públics o VIP de pagament) i venen accés a contingut premium
- **Comunitat** que segueix tipsters, fa likes/comentaris als picks, comparteix DMs i ressòn social

Producte en beta privada (gate code `FYBM67`). Idioma de la UI: castellà. Conversa amb l'usuari: català.

Deploy: `master` → push a `upstream` (`tulsaproyectoxbet/FindYourBet`) → sync fork `FYBet/FindYourBet` → Vercel desplega automàticament a `fyourbet.com` (DNS via Cloudflare).

**Branques:** Tot el codi viu a `master`. La branca `main` només conté documentació (README, LICENSE). Quan l'usuari demani fer push o pull, sempre és sobre `master`, mai sobre `main`.

---

## Comandes

```bash
npm run dev       # Dev server a http://localhost:5173
npm run build     # Build a dist/
npm run lint      # ESLint (flat config + React hooks rules)
npm run preview   # Preview del build
```

Cap framework de tests configurat.

---

## Stack

- **React 18 + Vite** amb **JavaScript** (no TypeScript)
- **React Router DOM** per a routing
- **Framer Motion** per a animacions (transicions, scroll stagger, hover)
- **Supabase** per a auth + Postgres (**RLS actiu en totes les taules**)
- **Stripe Connect** per a pagaments (tipsters reben directament, FYB cobra comissió)
- **Brevo** per a emails transaccionals (9k/mes gratis)
- **Vercel serverless** per als endpoints `/api/*` (webhooks, validacions, sessions)
- **CSS variables** a `src/styles/tokens.css` + estils inline per component
- **Tailwind v4** (via `@tailwindcss/vite`) consumeix les mateixes variables CSS

---

## Estructura de fitxers (feature-based)

```
src/
├── components/ui/              # Components atòmics reutilitzables (Avatar, Username, Button…)
├── contexts/                   # React Contexts (AdminModeContext, ProfileNavContext…)
├── features/
│   ├── auth/                   # Login, Register, GoogleOnboarding
│   ├── landing/                # Landing page
│   ├── admin/                  # AdminPanel
│   └── dashboard/              # App principal després del login
│       ├── canales/            # Canals (xat, missatges, picks)
│       ├── feed/               # Feed de picks (siguiendo + para ti)
│       ├── tipsters/           # Descoberta de tipsters
│       ├── social/             # Perfils, DMs, follows
│       ├── notifications/      # Panel de notificacions
│       ├── payments/           # OfferManager, OfferPage, PaymentSuccess, AccesoPage
│       └── hooks/              # useBets, etc.
├── hooks/                      # Hooks globals (usePolling, useUnreadChannelCount…)
├── lib/                        # Supabase client, adminUsers, randomUsername…
├── pages/                      # NO existeix — històricament era així; ara tot va a features/
└── styles/                     # tokens.css amb totes les variables CSS

api/
├── create-checkout-session.js  # Crea sessió Stripe quan un usuari compra una oferta
├── create-connect-account.js   # Onboarding Stripe Connect d'un tipster
├── check-account-status.js     # Verifica si un tipster ha completat l'onboarding
├── webhook.js                  # Stripe webhook (checkout.session.completed → afegeix membre + envia email)
└── validate-access.js          # Valida token personal d'accés (només l'usuari que va pagar el pot fer servir)
```

---

## Routing

Routes definides a `App.jsx` amb React Router DOM:

| Ruta | Component | Notes |
|------|-----------|-------|
| `/` | Landing | Pública |
| `/login` | Login | Suporta `?redirect=URL` per tornar després d'autenticar |
| `/register` | Register | Validació edat 18+, password rules, ToS |
| `/onboarding` | GoogleOnboarding | Per usuaris d'OAuth sense username encara |
| `/dashboard` | Dashboard | Requereix sessió. Tot el SPA viu aquí. |
| `/canal/:code` | CanalPage | Pública (preview de canal abans del login) |
| `/oferta/:id` | OfferPage | Pública (compra d'oferta sense login obligatori) |
| `/payment/success` | PaymentSuccess | Post-Stripe redirect |
| `/acceso/:token` | AccesoPage | Enllaç personal post-compra (validat per token) |

**Gate code beta**: `FYBM67`. Guardat a `localStorage.fyb_unlocked`. Rutes excloses del gate: `/oferta/`, `/payment/`, `/acceso/`.

Dashboard usa **tabs interns** mantinguts amb `display:none` + `visited Set` (no es desmunten en canviar de tab). Cada tab té un `key={X_Key}` que s'incrementa en navegar-hi per forçar un remount net.

---

## Dashboard — tabs

| Tab | Component | Funció |
|-----|-----------|--------|
| `estadisticas` | Stats inline | Resum del rendiment de les apostes de l'usuari |
| `historial` | Historial | Llista d'apostes amb filtres i resolució |
| `canales` | Canales/ | Llista de canals propis + units, xat, compra de VIP |
| `feed` | feed/ | Picks de tipsters: tab Siguiendo + Para ti (algorisme) |
| `tipsters` | tipsters/ | 3 tabs: Siguiendo / Sugeridos / Verificados |
| `social` | social/ | 3 tabs: Mi Perfil / DMs / Comunidad |
| `ranking` | Ranking | Top tipsters globals per yield |
| `amigos` | RankingAmigos | Ranking entre amics (mutuals) |
| `miperfil` | MiPerfil | Edita el teu perfil, els teus canals |
| `contacto` / `sugerencias` | Contacto | Sistema de tickets de suport |
| `faqs` | Faqs | Preguntes freqüents |
| `admin` | AdminPanel | Només ADMIN_EMAILS — gestió de tickets, suggerències, usuaris, canals |
| `configuracion` | Configuracion | Settings + logout |

---

## Supabase — taules principals

URL: `https://slfgvgvguwavvbkpsngf.supabase.co` (key pública al client; service role key només al `.env` per serverless)

**Auth + perfils**
- `profiles` — `id, username, name, avatar_url, bio, is_verified, banned, banned_reason, admin_warning, warning_notified, verified_notified`
- `banned_emails`, `banned_usernames`, `reserved_usernames` (admin moderation)
- `username_reservations` (reserves temporals durant signup)

**Aposta i tracking**
- `bets` — `user_id, event, pick, odds, stake, sport, market, analysis, status, date, was_private, review_status, created_at`

**Social**
- `follows` — `follower_id, following_id, created_at`
- `blocks` — bloquejos entre usuaris
- `direct_messages`, `dm_conversations`, `dm_settings`
- `notifications` — `user_id, type, from_user_id, from_username, message_id, preview, read_at`

**Canals**
- `channels` — `id, owner_id, name, description, is_private, channel_type, price, discount_price, invite_code, invite_code_discount, sport, language, deleted_at, deletion_reason, deletion_notified, pinned_comment_id, currency, created_at`
- `channel_members` — `channel_id, user_id, role, joined_at`
- `channel_messages` — `id, channel_id, user_id, content, created_at` (els picks són `[BET]:` + JSON)
- `channel_message_views`, `channel_message_view_counts` (tracking de "vist")
- `channel_bans` — `channel_id, user_id, banned_until` (NULL = permanent)

**Engagement**
- `post_likes`, `post_comments`, `comment_likes`, `poll_votes`, `bet_reports`

**Pagaments**
- `offers` — `id, channel_id, name, description, price, active, created_at`
- `purchases` — `id, user_id, offer_id, channel_id, token, stripe_session_id, amount, created_at`
- `stripe_accounts` — `user_id, stripe_account_id, onboarded`

**Suport i contingut**
- `support_tickets`, `suggestions`
- `user_stickers`, `gifs`, `avatars`, `channel-files` (Storage buckets)

---

## Sistema de canals i monetització

**4 tipus de canal** (camp `channel_type`):
- `public` — visible al cercador, qualsevol s'hi pot unir
- `free_private` — invitació amb codi, gratis
- `vip_weekly` / `vip_monthly` — subscripció de pagament (renovació manual amb codis)
- `stakazo` — accés únic de pagament a un pick concret

**Codis d'invitació**: 8 caràcters lowercase, sempre. Cada canal pot tenir-ne dos: `invite_code` (preu normal) i `invite_code_discount` (preu rebaixat, opcional per entrada tardana).

**Límits**: `MAX_OWN_CHANNELS = 5`, `MAX_JOINED_CHANNELS = 30`.

**Flux de compra Stripe Connect**:
1. Tipster fa onboarding a Stripe Connect via `/api/create-connect-account`
2. Tipster crea una `offer` lligada a un dels seus canals
3. Comprador va a `/oferta/:id` → `POST /api/create-checkout-session` → redirecció a Stripe
4. **Comissió**: 20% (estàndard) o 15% (tipsters verificats / partnership)
5. Stripe webhook `checkout.session.completed` → `/api/webhook`:
   - Insereix `purchases` amb un `token` UUID únic
   - Upsert a `channel_members`
   - Envia email via Brevo amb enllaç personal `fyourbet.com/acceso/TOKEN`
6. L'enllaç personal només el pot fer servir l'usuari que va pagar (validació via `/api/validate-access`)

---

## Sistema d'admins

Comptes admin invisibles a la UI pública (no compten als recomptes de membres, no apareixen com a tipsters per defecte). IDs hardcoded a `src/lib/adminUsers.js`:

```js
ADMIN_USER_IDS = new Set(['fbe0bfe2-858d-4f56-a155-dd79e054fc1f']) // fyourbet@gmail.com
```

`isAdminUserId(userId)` per filtrar arreu. **Excepció**: a la pestanya Tipsters (Verificados, Sugeridos, cerca) fyourbet SÍ que apareix com a tipster normal (decisió explícita).

`AdminModeContext` ofereix un toggle visible només per admins per accedir a vistes especials (canals privats al cercador, etc.).

---

## Notificacions

`useNotifications(userId)` retorna `{ notifications, unreadCount, markRead, markAllRead }`. Polling cada 30s.

Tipus de notificació (`type`): `like`, `comment`, `follow`, `channel_join`, `dm`, `channel_message`.

**Panel** (`NotificationsPanel.jsx`):
- 4 tabs: Todos / Seguidores / Likes / Comentarios
- Excloses del panel: `channel_message`, `dm` (van als badges de la sidebar)
- Deduplicació per `(from_user_id, type)` — només la més recent compta
- Badges vermells amb el comptador d'**no llegides**
- `markAllRead` es crida en **tancar** el panel (no en obrir) per permetre veure els comptes
- En canviar de tab dins del panel, també es marca tot com llegit

---

## Detalls tècnics i convencions

- **`invite_code`** sempre en lowercase (no UPPERCASE)
- **App.jsx** carrega la sessió via `supabase.auth.getSession()` + `onAuthStateChange`
- **Salts a canals via URL**: `?canal=CODE` al Dashboard obre directament el canal
- **Polling intel·ligent** (`usePolling`): es pausa quan `document.visibilityState !== 'visible'`
- **Intervals reals de polling**:
  - Notificacions, missatges de canal, DMs, unread counts: **30s**
  - Feed, comptadors admin: **60s**
  - NO hi ha Realtime (pendent — veure secció Pendent)
- **`fetchWithTimeout`** a `src/lib/supabase.js`: 15s timeout per evitar requests penjats. NO usa AbortController perquè corrompia el DNS cache del navegador.
- **`auth.lock` desactivat** al client de Supabase: el `navigator.locks` intern penjava `signInWithPassword` quan hi havia pestanyes anteriors amb sessions interrompudes.
- **Storage Buckets**: `avatars`, `channel-files`, `gifs`, `user-stickers`
- **Email transaccional**: sender verificat `fyourbet@gmail.com` (domini fyourbet.com pendent de verificar a Brevo per DKIM)

---

## ⚠️ REGLES CRÍTIQUES DE LOADING I FETCHES (no les violis MAI)

Aquestes regles existeixen per un bug recurrent de "Cargando datos" estancat. Aplica-les **automàticament** a tot codi nou que afegeixis (App.jsx, hooks, components que fetchen).

### 1. Deps de `useEffect`: SEMPRE primitius, MAI objectes

❌ `useEffect(() => fetch(), [user])` — cada esdeveniment d'auth canvia la referència de `user` i dispara refetches amb flash de loading.

✅ `useEffect(() => { if (user?.id) fetch() }, [user?.id])` — primitiu estable.

Aplica el mateix per `channel`, `profile`, etc. → usa `channel?.id`, `profile?.id`.

### 2. Estabilitzar `setUser` a App.jsx

A `onAuthStateChange`, SEMPRE compara els camps essencials i retorna `prev` si no han canviat:

```js
setUser(prev => {
  const next = { ...built, ... }
  if (prev && prev.id === next.id && prev.username === next.username && prev.email === next.email
      && prev.avatar_url === next.avatar_url && prev.is_verified === next.is_verified
      && prev.banned === next.banned && prev.needsOnboarding === next.needsOnboarding) {
    return prev
  }
  return next
})
```

### 3. TOT `fetch` async ha de tenir safety timer + try/catch/finally

❌ Sense protecció:
```js
const fetchX = async () => {
  setLoading(true)
  const { data } = await supabase.from('x').select('*')
  setData(data); setLoading(false)
}
```

✅ Amb protecció completa:
```js
const fetchX = async () => {
  setLoading(true)
  const safetyTimer = setTimeout(() => setLoading(false), 10000)
  try {
    const { data } = await supabase.from('x').select('*')
    setData(data || [])
  } catch (e) {
    setData([])
  } finally {
    clearTimeout(safetyTimer)
    setLoading(false)
  }
}
```

### 4. Refetches després del primer load: NO mostrar "Cargando"

Si un hook ja ha carregat dades, les accions posteriors (join, leave, create, polling) NO han de posar `loading=true` — faria un flash damunt de dades vàlides. Usa `useRef`:

```js
const hasLoadedRef = useRef(false)
const fetchX = async () => {
  if (!hasLoadedRef.current) setLoading(true)
  try { /* ... */ }
  finally {
    hasLoadedRef.current = true
    setLoading(false)
  }
}
```

### 5. Polling (`usePolling`) MAI ha de fer `setLoading(true)`

Per definició és silenciós. Si la funció es comparteix entre primer fetch i polling, usa el patró del punt 4.

### 6. Checklist abans de fer commit de nous hooks/components amb fetches

- [ ] `useEffect` depèn de primitius (no objectes sencers)
- [ ] El fetch té safety timer (10s)
- [ ] Try/catch/finally complet (cap branca pot deixar loading=true)
- [ ] Refetches posteriors no mostren "Cargando"
- [ ] Polling no toca el loading state

---

## Estàndard d'enginyeria

Treballa com a **Senior Fullstack Developer**. Producte de qualitat Stripe/Linear:

- **Design tokens** (CSS variables) com a font única de veritat de colors/radius/spacing. Mai colors arbitraris hardcoded.
- **Comentaris** `//` per explicar **el perquè** de decisions de negoci en lògica no trivial — no descriguis el què (el codi ja ho fa).
- **Lògica de negoci** en hooks, no en components visuals.
- **Patrons nets**: early returns, optional chaining, evita prop drilling (usa Context o Zustand — instal·lat però poc usat).
- **No `any` ni mocks** quan es pot fetchar directament.

---

## Pendent / Roadmap

- **Migració a Supabase Realtime** (substituir polling abans d'obrir FYB al públic seriós — el polling actual no escala)
- **Verificar domini fyourbet.com a Brevo** (DKIM/SPF/DMARC) per millorar deliverability d'emails
- **Sistema ranking complet** amb tiers estrictes (score 0-100)
- **Renovació automàtica de subscripcions VIP** (ara són accessos manuals per codi)
- **Perfil públic SEO-friendly** del tipster (URLs estables, OG tags)
