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

## ⚠️ REGLA OBLIGATÒRIA: Internacionalització (i18n) — SEMPRE 3 IDIOMES

**TOT string visible per a l'usuari ha d'estar traduit a ES + EN + FR.** Sense excepcions per a codi nou.

### Sistema

- **Llibreria**: `i18next` + `react-i18next`
- **Fitxers de traducció**: `src/i18n/locales/es.json`, `en.json`, `fr.json`
- **Hook**: `const { t, i18n } = useTranslation()` a cada component que mostri text

### Regles obligatòries

1. **Cap string hardcoded visible** als components — tots han d'usar `t('clau')`.
2. **Quan afegeixis una clau nova** a `es.json`, afegeix-la també a `en.json` i `fr.json` en el mateix commit. Mai deixar claus sense traducció als 3 fitxers.
3. **Contingut data-driven** (llistes de docs, configuració per idioma): usa funcions `getXxx(lang)` en lloc d'objectes estàtics. Exemple: `getLegalDocs(i18n.language)`, `getInfoDocs(i18n.language)`.
4. **Dades que varien per idioma** però no caben bé com a claus JSON (blocs de text llarg, arrays de contingut): afegeix versions ES/EN/FR directament al fitxer de dades (com `legalDocs.jsx`, `infoDocs.jsx`).
5. **Excepció**: `AdminPanel` (intern, admin-only) no cal traduir-lo.

### Flux de treball quan es tradueix

- No rellegeixis tots els components — tradueix només els fitxers afectats.
- Si una clau ja existeix als JSONs, reutilitza-la; no creïs duplicats.
- Si hi ha més de 100 textos nous, primer genera totes les claus i després edita els JSON.

### Checklist abans de fer commit de qualsevol component nou

- [ ] `import { useTranslation } from 'react-i18next'` + `const { t } = useTranslation()`
- [ ] Tots els strings visibles usen `t('clau')`
- [ ] La clau nova existeix a `es.json`, `en.json` i `fr.json`
- [ ] Si el component mostra contingut que canvia per idioma, usa `i18n.language`

### Estructura de claus recomanada

```
common.*          → textos genèrics (accept, cancel, back, save…)
bets.*            → aposta: labels, estats (won/lost/void/pending)
chatView.*        → canal de xat
canales.*         → llista de canals, creació, cerca
poll.*            → enquestes
dm.*              → missatges directes
tipsters.*        → descoberta i perfils de tipsters
ranking.*         → ranking global i d'amics
misApuestas.*     → historial i stats d'aposta pròpies
configuracion.*   → settings i compte
legal.*           → pàgines legals (chrome)
infoPage.*        → pàgines informatives (chrome)
contactPage.*     → pàgina de contacte pública
cookie.*          → banner de cookies
```

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

## Git — mai sense permís explícit

No facis mai commit, push ni pull. Només quan l'usuari ho demani explícitament.

---

## Ordre de treball (CRÍTIC)

Sempre segueix aquest ordre:

1. Entendre el problema.
2. Localitzar els fitxers.
3. Pensar la solució.
4. Implementar.
5. Revisar.
6. Acabar.

No saltis directament a escriure codi.

Quan hi hagi un bug, segueix aquest ordre:

1. Reproduir-lo.
2. Trobar la causa.
3. Explicar la causa a l'usuari.
4. Arreglar-la.
5. Comprovar que no es trenca res més.

---

## Raonament i coherència arquitectònica (CRÍTIC)

Abans d'implementar qualsevol canvi, no assumeixis que cal crear una solució nova. La primera pregunta sempre ha de ser:

> "Ja existeix alguna funcionalitat, patró o implementació dins del projecte que resolgui aquest mateix problema?"

Si la resposta és sí: reutilitza-la, estén-la, redirigeix-hi o adapta-la. NO creïs una implementació paral·lela.

**Cerca de funcionalitats similars** — quan rebis una tasca:
1. Identifica què vol aconseguir l'usuari, no només què ha escrit.
2. Busca si aquesta funcionalitat ja existeix en algun altre lloc.
3. Analitza com està implementada.
4. Mantén el mateix comportament, UX i arquitectura sempre que sigui possible.

**Pensar abans de crear** — abans de crear un component, pàgina, hook, funció, ruta, consulta o estat nou, pregunta't:
- Ja existeix? Puc reutilitzar-la? Puc redirigir-hi? Puc compartir la mateixa lògica?

Si qualsevol resposta és "sí", reutilitza.

**Consistència del producte** — FindYourBet ha de comportar-se com un únic producte. Evita duplicar pantalles, lògica, fetches, estats, components i rutes.

**Pensament crític** — no executis instruccions de forma literal sense analitzar-les. Entén la intenció real. Si existeix una forma més coherent, més simple o més integrada amb l'arquitectura actual, proposa-la. Pensa com un Senior Full Stack Engineer responsable de mantenir una única arquitectura coherent durant anys.

---

## No toquis el que no cal

No canviïs mai — si no és necessari per solucionar el problema:

- imports
- format del codi
- noms de variables
- ordre dels components
- espais en blanc
- comentaris existents

---

## Eficiència de tokens (CRÍTIC)

Abans de llegir qualsevol fitxer, pregunta't: *"Necessito realment aquest fitxer per completar la tasca?"* Si la resposta és no, no l'obris.

Abans de modificar codi:

1. Busca primer el fitxer correcte.
2. No llegeixis directoris sencers si no és necessari.
3. No rellegeixis fitxers que no canviaran.
4. No facis resums del codi.
5. Modifica només els fitxers estrictament necessaris.
6. Si només cal editar una funció, no reescriguis el fitxer complet.
7. Evita explorar més de 5 fitxers abans de començar a implementar.
8. No inspeccionis dependències si no són rellevants.
9. Si la tasca afecta menys de 3 fitxers, treballa només sobre aquests — no exploris la resta del projecte.

**Codebases grans:**
- Prefereix Grep/ripgrep abans d'obrir fitxers.
- Cerca per símbols abans de llegir implementacions completes.
- Llegeix només els blocs de codi necessaris, no fitxers sencers.
- No facis resums de fitxers grans.
- No revisis automàticament fitxers relacionats si la tasca és local.
- Quan una tasca afecti més de 10 fitxers, proposa dividir-la en fases abans de continuar.

---

## Estàndard d'enginyeria

Treballa com a **Senior Fullstack Developer**. Producte de qualitat Stripe/Linear:

- **Design tokens** (CSS variables) com a font única de veritat de colors/radius/spacing. Mai colors arbitraris hardcoded.
- **Comentaris** `//` per explicar **el perquè** de decisions de negoci en lògica no trivial — no descriguis el què (el codi ja ho fa).
- **Lògica de negoci** en hooks, no en components visuals.
- **Patrons nets**: early returns, optional chaining, evita prop drilling (usa Context o Zustand — instal·lat però poc usat).
- **No `any` ni mocks** quan es pot fetchar directament.
- **Rendiment React**: memoització només quan aporta valor real; evita renders innecessaris, fetches duplicats, `useEffect` redundants i estats derivats (calcula'ls a partir de l'estat existent).

---

## Pendent / Roadmap

- **Migració a Supabase Realtime** (substituir polling abans d'obrir FYB al públic seriós — el polling actual no escala)
- **Verificar domini fyourbet.com a Brevo** (DKIM/SPF/DMARC) per millorar deliverability d'emails
- **Sistema ranking complet** amb tiers estrictes (score 0-100)
- **Renovació automàtica de subscripcions VIP** (ara són accessos manuals per codi)
- **Perfil públic SEO-friendly** del tipster (URLs estables, OG tags)
