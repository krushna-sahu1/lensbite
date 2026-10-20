# LensBite 🍽️📷

A personal, Gemini Live–style AI food tracker. Point your phone camera at food and just talk:

> "Look at this and tell me its calories and nutrients."

The agent sees your camera, answers by voice in real time, lets you interrupt it (barge-in), answers follow-ups, and logs meals when you confirm, all tracked against your daily goals.

Or turn a packaged food around, show the back of the pack, and say:

> "Rate this."

It reads the nutrition table and ingredients, scores the product 0–10 by voice, and shows a product card on screen.

- **No nutrition database:** the AI estimates everything itself, as ranges.
- **Your data in Supabase:** meals and goals live in Postgres, behind Google sign-in. Row Level Security lets each user read and write only their own rows (`user_id = auth.uid()`).
- **Your API key stays on the server:** signed-in users get a short-lived *ephemeral token* from `/api/token`; `GEMINI_API_KEY` never reaches the browser.
- **See the patterns:** the Insights tab charts your calories by day, week and month, so you can tell whether the last month was better than the one before it.

## Features

| Screen | What it does |
| --- | --- |
| **Login** | Tap **Continue with Google** and pick an account, and you're in. Every other page needs a session. |
| **Home** | Greeting, a big animated calorie ring, protein / carbs / fat / fiber vs. goals, the day's meals grouped by type (swipe a meal left to delete it, then **Undo**), a 7-day sparkline that leads to Insights, and a pulsing **Go Live** button. |
| **Live** | Rear-camera preview, always-on mic, live transcript of both sides, End button. Streams 16 kHz PCM audio continuously and ~1 JPEG frame/sec. AI audio plays immediately and stops the moment you talk over it. Shows the **product card** after a label scan, plus a **Label** button for label mode. |
| **Insights** | **Day / Week / Month** views of your log: a bar chart of daily calories with a dashed goal line, a month calendar heatmap coloured by how much of your goal each day hit, an area chart, a protein/carbs/fat donut, stat cards (daily average, best day, days on target, streak, change vs. the previous period), and a bottom sheet with a day's meals when you tap a day. |
| **Settings** | Daily calorie/macro goals, light/dark/system theme, export/import logs as JSON, move meals left in this browser by the old localStorage version into your account, clear data, sign out |

Agent tools (function calling, run in the browser against Supabase as the signed-in user):

- `log_meal(name, meal_type, calories, protein_g, carbs_g, fat_g, fiber_g, notes)`: only after you confirm
- `get_today_summary()`
- `delete_last_meal()`
- `scan_label()`: switches to label mode before the agent reads a pack
- `show_product_rating(product_name, score, verdict, unit, serving_size, per_serving, per_100, pros, cons, ingredient_warnings, …)`: shows the product card (never saved)

## Insights

The **Insights** tab (bottom navigation) turns your food log into numbers you can act on.

- **Day / Week / Month.** The segmented control switches the period. Week and Month can be walked backwards and forwards with the arrows; the next arrow is disabled once you'd be moving into the future, and **Back to today** jumps back.
- **Week:** a bar chart of the calories eaten each day, with a dashed line at your goal. Tapping a bar (or one of the day buttons underneath it) opens that day's meals.
- **Month:** a calendar heatmap where every square is a day, coloured by how much of your goal it hit, plus an area chart of the month's calories.
- **Macro split:** a donut of protein, carbs and fat for the period, weighted by energy (4 kcal per gram of protein and carbs, 9 per gram of fat).
- **Stat cards:** daily average, best day, days on target, the current streak, and how the period compares with the one before it.
- **A day, on tap:** the bottom sheet lists everything logged that day.

How the numbers are worked out (all in `src/lib/storage.ts`, all in the phone's own timezone):

- Days are local calendar days, and every day in the period is included — days without meals are filled with zeros, so the charts always show the full period.
- **On target** means the day has meals and stayed at or below the calorie goal.
- The **streak** counts back from the end of the period. Days with no meals haven't happened yet, so they don't break it; a day that missed the goal does.
- The **daily average** is the period total divided by the number of days in the period.
- The **comparison** is the change in total calories against the equivalent previous period (yesterday, last week, last month).

## Product label scanner

Show the back of a packaged food and say **"rate this"** (or "scan this", "check the label", …):

1. **Label mode turns on.** It's triggered by what you say, by the agent's `scan_label` call, or by tapping **Label**. Frames go out sharper (up to 1536 px, JPEG quality 0.9, same 1 fps) so small print stays legible. Label mode switches itself off after 60 s without label activity, unless you turned it on with the button.
2. **The agent reads the nutrition table and ingredients exactly.** It never guesses numbers. If text is blurry, cut off or glary, it asks you to move closer, hold steady, or rotate the pack.
3. **It rates the product 0–10.** Negatives: sugar, sodium, saturated and trans fat. Positives: protein and fiber. It also weighs ingredient quality (added sugars under any name, refined flour, palm oil, artificial sweeteners and colors, preservatives, ultra-processing), misleading claims, unrealistic serving sizes, and your goals and what's left today.
4. **You hear the score and one or two sentences, then it stops.** Ask follow-ups ("what's bad in the ingredients?", "how much sugar per serving?") in the same session.
5. **A product card shows** the color-coded score, key numbers per 100 g/ml and per serving, pros and cons, and ingredient warnings. Per-100 g values are colored with UK FSA traffic-light thresholds. If the label only prints one column, the app computes the other from the serving size. Tap the card's header to collapse it, or ✕ to close it.
6. **Say "log one serving"** (or "log two servings") to log it with the existing `log_meal` tool, using the exact per-serving label values.

Nothing about a scanned product is stored. The card lives in memory and disappears when a new product is rated or the session ends.

Quality-of-life details:

- Auto-ends after **2 minutes of silence** to save free-tier quota (with a countdown for the last 20 s).
- Context-window compression is on, so audio+video sessions aren't cut off at the API's 2-minute default.
- Transparent **reconnect with session resumption** when the server rotates the connection (~every 10 min) or the network blips.
- Friendly errors for denied/missing/busy camera or mic, non-HTTPS origins, quota exhaustion, and dropped sessions. If the camera fails, it continues voice-only.
- Keeps the screen awake while live (Wake Lock API, where supported).

## Setup

Requires Node.js 20+.

1. **Get a Gemini API key** at <https://aistudio.google.com/apikey>.

2. **Create a Supabase project** at <https://supabase.com/dashboard> (the free tier is plenty), then create the tables. Either paste each file in `supabase/migrations/` (in name order) into **SQL Editor** and run it, or use the CLI:

   ```bash
   npx supabase login
   npx supabase init        # once; keeps the existing supabase/migrations folder
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   The migrations create `meals` and `settings` with Row Level Security on and one policy per operation, all `user_id = auth.uid()`.

   No extra migration is needed for the Insights screen: `meals` already has a composite index on `(user_id, eaten_at desc)`, which is exactly what the date-range queries on that screen use.

3. **Configure sign-in** in the Supabase dashboard:

   - **Google provider:** under **Authentication → Sign In / Providers → Google**, enable it and paste the **Client ID** and **Client Secret** from a Google Cloud OAuth client (<https://console.cloud.google.com/apis/credentials>). Add the **Authorized redirect URI** shown on that Supabase page (`https://<project-ref>.supabase.co/auth/v1/callback`) to the Google Cloud client.
   - **URL Configuration:** set the **Site URL** and **Redirect URLs**:
     - **Site URL:** your production URL, e.g. `https://lensbite.vercel.app`. This is the fallback Supabase uses for any redirect whose target it doesn't recognize, so it must be the deployed URL — *not* `localhost`.
     - **Redirect URLs:** add every origin you sign in from, e.g. `https://<your-domain>/**` and `http://localhost:3000/**`. The app returns from Google through `/auth/callback`.

   Sign-in uses Google, so there's no email sender to configure. You can turn off email sign-in under **Authentication → Sign In / Providers → Email**.

4. **Install and configure:**

   ```bash
   npm install
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   ```ini
   GEMINI_API_KEY=your-key-here
   # Supabase → Project Settings → API Keys
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

5. **Run:**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>, tap **Continue with Google**, and pick an account. `localhost` counts as a secure origin, so camera and mic work on your computer.

6. **Lock it to you** (recommended): once you've signed in the first time, turn off **Authentication → Sign In / Providers → Allow new users to sign up**. Otherwise anyone with your URL can create an account. They'd never see your data (RLS), but they could spend your Gemini quota.

7. **Coming from the localStorage version?** Open **Settings** in the same browser you used before and tap **Move them to my account**. Or export JSON from the old version and import it here.

### Testing on your phone

Mobile browsers only allow camera/mic on **HTTPS**, so `http://192.168.x.x:3000` won't work. Options:

- **Deploy to Vercel** (easiest, see below), or
- Run `npx next dev --experimental-https` and open the `https://<your-computer-ip>:3000` URL on your phone (accept the self-signed certificate warning), or
- Use a tunnel such as `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo (framework auto-detected as Next.js).
3. Under **Environment Variables**, add `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. In Supabase, set the **Site URL** and add `https://<your-domain>/**` to **Redirect URLs** (Setup step 3).
5. Deploy, open the `https://….vercel.app` URL on your phone and sign in. On Android, *Add to Home Screen* gives an app-like experience (on iPhone, see the next section first).

### Signing in on a phone

Google sign-in opens Google's account picker and then returns to `/auth/callback` in the same browser. Supabase's PKCE flow keeps a secret in the browser that started the sign-in, so if the flow finishes in a different browser you'll see a "code verifier" error — use one browser for the whole round trip.

On iPhone, a home-screen app keeps its own cookies, separate from Safari's. If Google sign-in opens in Safari, the session lands in Safari, not the home-screen app. Use LensBite in Safari, or bookmark it there instead of adding it to the home screen.

### Protecting your deployment

- `/api/token` hands out Gemini tokens only to signed-in users (it verifies the Supabase session cookie), so a stranger with your URL can't spend your quota.
- `src/proxy.ts` redirects signed-out visitors to `/login` and keeps the session cookie fresh. It's a convenience: the real protection for your data is Row Level Security in the database, which applies even to someone calling the Supabase API directly with the public key.
- Turn off new sign-ups after your first login (Setup step 6).

## How it works

```
 Phone browser                                            Your server (Vercel)
 ─────────────                                            ────────────────────
 any page ─────────────────────────────────────────────▶  proxy.ts: refresh session, else → /login
 Go Live ──POST /api/token (session cookie)───────────▶  getClaims() ✓ → GoogleGenAI({ apiKey })
         ◀──────────── { token: "auth_tokens/…" } ─────  .authTokens.create({ uses: 1, … })

 new GoogleGenAI({ apiKey: token }).live.connect(…)  ◀════ WebSocket ════▶  Gemini Live (gemini-3.8-live)
   mic → AudioWorklet → 16 kHz PCM ─────────────────▶ sendRealtimeInput({ audio })
   <video> → canvas → JPEG @1 fps (sharper for labels) ▶ sendRealtimeInput({ video })
   speakers ◀── 24 kHz PCM queue ◀──────────────────  serverContent.modelTurn (audio)
   stop playback ◀──────────────────────────────────  serverContent.interrupted (barge-in)
   transcript ◀─────────────────────────────────────  input/outputTranscription
   Supabase (RLS) ◀── runTool() ── sendToolResponse ◀─ toolCall (log_meal, …)
   product card ◀── runTool() ── sendToolResponse ◀─  toolCall (scan_label, show_product_rating)
```

### Code map

| File | Purpose |
| --- | --- |
| `src/app/api/token/route.ts` | Creates the ephemeral token for signed-in users (API key never leaves the server) |
| `src/proxy.ts`, `src/lib/supabase/proxy.ts` | Refreshes the Supabase session on each request; sends signed-out visitors to `/login` |
| `src/app/login/page.tsx`, `src/app/auth/callback/route.ts` | Google sign-in button, and the OAuth callback that exchanges the code for a session |
| `src/lib/supabase/*` | Browser and server Supabase clients, env check, table types |
| `supabase/migrations/*.sql` | `meals` and `settings` tables with Row Level Security |
| `src/lib/live-session.ts` | **The core.** Connects to Gemini Live, streams mic/camera, plays audio, handles barge-in, tools, transcript, silence timeout, reconnects |
| `src/lib/audio.ts` | `MicStreamer` (mic → PCM chunks) and `PcmPlayer` (gap-free playback with instant stop) |
| `public/worklets/pcm-recorder.js` | AudioWorklet that downsamples the mic to 16 kHz 16-bit PCM |
| `src/lib/media.ts` | Camera/mic permissions, error messages, JPEG frame capture |
| `src/lib/prompt.ts` | System instruction (personality, rules, today's goals and totals) |
| `src/lib/tools.ts` | Tool declarations + browser-side handlers (read/write Supabase) |
| `src/lib/label.ts` | Label scanner: parses `show_product_rating`, fills in per-100 g / per-serving values, traffic-light thresholds |
| `src/components/ProductCard.tsx` | Product card overlay on the Live screen |
| `src/lib/storage.ts` | Supabase-backed store (today's meals, goals, import/export, moving old localStorage data) + `useStore()` hook, plus the date-range and aggregation helpers the Insights screen is built on |
| `src/lib/config.ts` | Model name, voice, timeouts, frame size; tweak here |
| `src/app/page.tsx`, `src/components/*` | Home screen and Live overlay UI |
| `src/app/insights/page.tsx`, `src/components/insights/*` | Day / Week / Month charts, stat cards and the day sheet |
| `src/app/settings/page.tsx` | Goals, appearance, export/import, sign out |
| `src/components/BottomNav.tsx`, `src/components/ui.tsx`, `src/components/Sheet.tsx`, `src/components/ConfirmDialog.tsx`, `src/components/Toast.tsx` | Shared UI: bottom navigation, cards, bottom sheet, confirm dialog, toasts |
| `src/app/globals.css` | Design tokens (light + dark), keyframes, reduced-motion rules |

### Design system

Everything visual hangs off a small set of CSS custom properties in `src/app/globals.css`:

- **Tokens.** `--background`, `--surface`, `--foreground`, `--muted`, `--line`, `--track` for the greys; `--accent`, `--protein`, `--carbs`, `--fat`, `--fiber` for the brand and the macros; `--heat-0` … `--heat-4` for the calendar heatmap. Tailwind picks them up through `@theme inline`, so `bg-surface`, `text-muted` and friends work like any other colour.
- **Light and dark.** The dark palette lives in `:root[data-theme="dark"]`. A tiny script in `src/app/layout.tsx` sets that attribute before the first paint (so there's no flash), and **Settings → Appearance** switches between Light, Dark and System. The choice is kept in `localStorage` under `lensbite:theme`.
- **Motion.** Animations are short and subtle. A global `prefers-reduced-motion` rule turns off every CSS animation, and the charts check `useReducedMotion()` before animating.
- **Touch and safe areas.** Buttons are at least 44 px tall, and the bottom navigation and the **Go Live** button respect `env(safe-area-inset-bottom)` so they clear the home indicator on iOS.
- **Keyboard.** Dialogs and the bottom sheet trap focus and close on <kbd>Esc</kbd>; charts are labelled and the Recharts charts get their arrow-key navigation from `accessibilityLayer`.

## Customizing

All in `src/lib/config.ts`:

- `LIVE_MODEL`: defaults to `gemini-3.8-live`. Swap in `gemini-3.8-live-extended-thinking` for more reasoning (note: that model requires non-blocking tools).
- `VOICE_NAME`: e.g. `Kore`, `Puck`, `Charon`, `Aoede`.
- `SILENCE_TIMEOUT_MS`, `FRAME_INTERVAL_MS`, `FRAME_MAX_SIZE`, `FRAME_JPEG_QUALITY`.
- `LABEL_FRAME_MAX_SIZE`, `LABEL_FRAME_JPEG_QUALITY`, `LABEL_MODE_TIMEOUT_MS`: label mode.
- `LIVE_MEDIA_RESOLUTION`: how many tokens Gemini spends per camera frame. It's set to `MEDIA_RESOLUTION_HIGH` (~280 tokens/frame) because at the default (~70 tokens/frame) small label print isn't legible, however sharp the JPEG is. That's roughly 4x the video tokens for the whole session. If you never scan labels, set it to `MEDIA_RESOLUTION_UNSPECIFIED`.

The agent's personality and rules are plain text in `src/lib/prompt.ts`.

## Troubleshooting

- **The AI keeps interrupting itself:** your phone's speaker is leaking into the mic. Lower the volume or use earbuds. Echo cancellation is requested, but some devices handle it better than others.
- **"Permission … denied":** allow camera/mic for the site in your browser settings (iOS: *Settings → Safari → Camera/Microphone*), then tap **Go Live again**.
- **Google sign-in bounces back to `/login`, or Google says the redirect URI is invalid:** add the origin you're on to **Authentication → URL Configuration → Redirect URLs** (Setup step 3), and make sure the Google Cloud OAuth client lists `https://<project-ref>.supabase.co/auth/v1/callback` as an **Authorized redirect URI**. Supabase falls back to the **Site URL** for unrecognized targets, so keep that set to the deployed URL.
- **"Camera and microphone need a secure (HTTPS) connection":** see *Testing on your phone*.
- **"quota exceeded":** you've hit the free-tier limit. Wait, or check usage in Google AI Studio.
- **The agent keeps asking you to move closer to a label:** fill most of the screen with the nutrition table, avoid glare from overhead lights, and hold still for a second or two. Small, curved, or shiny packs are the hardest. Check that `LIVE_MEDIA_RESOLUTION` is still `MEDIA_RESOLUTION_HIGH`.
- **No sound on iPhone:** make sure the ring/silent switch is off and the volume is up.

## Notes

- Estimates are AI guesses and can be meaningfully off. Label scores are the AI's judgment, and a misread digit is possible. Glance at the card's numbers before logging. This is not medical advice.
- Ephemeral tokens are a Preview feature of the Gemini API. If token creation or connection starts failing after an SDK upgrade, check <https://ai.google.dev/gemini-api/docs/ephemeral-tokens>.
- Data lives in your Supabase project, so it follows you to any device you sign in on. **Settings → Export JSON** still gives you a portable backup.
- `src/lib/supabase/database.types.ts` is written by hand to match the migrations. After changing a table, update it or regenerate it with `npx supabase gen types typescript --project-id <ref>`.
- The charts use [Recharts](https://recharts.org). They're loaded on demand (`next/dynamic`) so the rest of the app doesn't pay for them, and they read their colours from the CSS tokens so they follow the light/dark theme.
