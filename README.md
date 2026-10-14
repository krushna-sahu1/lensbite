# LensBite 🍽️📷

A personal, Gemini Live–style AI food tracker. Point your phone camera at food and just talk:

> "Look at this and tell me its calories and nutrients."

The agent sees your camera, answers by voice in real time, lets you interrupt it (barge-in), answers follow-ups, and logs meals when you confirm, all tracked against your daily goals.

Or turn a packaged food around, show the back of the pack, and say:

> "Rate this."

It reads the nutrition table and ingredients, scores the product 0–10 by voice, and shows a product card on screen.

- **No nutrition database:** the AI estimates everything itself, as ranges.
- **Single user, no login, no backend DB:** meals and goals live in your browser's `localStorage`.
- **Your API key stays on the server:** the browser gets a short-lived *ephemeral token* from `/api/token`.

## Features

| Screen | What it does |
| --- | --- |
| **Home** | Today's calories / protein / carbs / fat / fiber vs. goals, meal list (tap 🗑 to delete), big **Go Live** button |
| **Live** | Rear-camera preview, always-on mic, live transcript of both sides, End button. Streams 16 kHz PCM audio continuously and ~1 JPEG frame/sec. AI audio plays immediately and stops the moment you talk over it. Shows the **product card** after a label scan, plus a **Label** button for label mode. |
| **Settings** | Daily calorie/macro goals, export/import logs as JSON, clear data, optional access code |

Agent tools (function calling, run in the browser):

- `log_meal(name, meal_type, calories, protein_g, carbs_g, fat_g, fiber_g, notes)`: only after you confirm
- `get_today_summary()`
- `delete_last_meal()`
- `scan_label()`: switches to label mode before the agent reads a pack
- `show_product_rating(product_name, score, verdict, unit, serving_size, per_serving, per_100, pros, cons, ingredient_warnings, …)`: shows the product card (never saved)

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

2. **Install and configure:**

   ```bash
   npm install
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   ```ini
   GEMINI_API_KEY=your-key-here
   # optional, see "Protecting your deployment"
   ACCESS_CODE=
   ```

3. **Run:**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>. `localhost` counts as a secure origin, so camera and mic work on your computer.

### Testing on your phone

Mobile browsers only allow camera/mic on **HTTPS**, so `http://192.168.x.x:3000` won't work. Options:

- **Deploy to Vercel** (easiest, see below), or
- Run `npx next dev --experimental-https` and open the `https://<your-computer-ip>:3000` URL on your phone (accept the self-signed certificate warning), or
- Use a tunnel such as `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo (framework auto-detected as Next.js).
3. Under **Environment Variables**, add `GEMINI_API_KEY` (and ideally `ACCESS_CODE`).
4. Deploy, open the `https://….vercel.app` URL on your phone, and *Add to Home Screen* for an app-like experience.

### Protecting your deployment

There's no login, so anyone who finds your URL could request tokens and spend your quota. Set `ACCESS_CODE` in Vercel to any secret phrase, then on your phone go to **Settings → Access code** and enter the same phrase once. It's stored on that device and sent with each token request.

## How it works

```
 Phone browser                                            Your server (Vercel)
 ─────────────                                            ────────────────────
 Go Live ──POST /api/token────────────────────────────▶  GoogleGenAI({ apiKey })
         ◀──────────── { token: "auth_tokens/…" } ─────  .authTokens.create({ uses: 1, … })

 new GoogleGenAI({ apiKey: token }).live.connect(…)  ◀════ WebSocket ════▶  Gemini Live (gemini-3.8-live)
   mic → AudioWorklet → 16 kHz PCM ─────────────────▶ sendRealtimeInput({ audio })
   <video> → canvas → JPEG @1 fps (sharper for labels) ▶ sendRealtimeInput({ video })
   speakers ◀── 24 kHz PCM queue ◀──────────────────  serverContent.modelTurn (audio)
   stop playback ◀──────────────────────────────────  serverContent.interrupted (barge-in)
   transcript ◀─────────────────────────────────────  input/outputTranscription
   localStorage ◀── runTool() ── sendToolResponse ◀─  toolCall (log_meal, …)
   product card ◀── runTool() ── sendToolResponse ◀─  toolCall (scan_label, show_product_rating)
```

### Code map

| File | Purpose |
| --- | --- |
| `src/app/api/token/route.ts` | Creates the ephemeral token (API key never leaves the server) |
| `src/lib/live-session.ts` | **The core.** Connects to Gemini Live, streams mic/camera, plays audio, handles barge-in, tools, transcript, silence timeout, reconnects |
| `src/lib/audio.ts` | `MicStreamer` (mic → PCM chunks) and `PcmPlayer` (gap-free playback with instant stop) |
| `public/worklets/pcm-recorder.js` | AudioWorklet that downsamples the mic to 16 kHz 16-bit PCM |
| `src/lib/media.ts` | Camera/mic permissions, error messages, JPEG frame capture |
| `src/lib/prompt.ts` | System instruction (personality, rules, today's goals and totals) |
| `src/lib/tools.ts` | Tool declarations + browser-side handlers |
| `src/lib/label.ts` | Label scanner: parses `show_product_rating`, fills in per-100 g / per-serving values, traffic-light thresholds |
| `src/components/ProductCard.tsx` | Product card overlay on the Live screen |
| `src/lib/storage.ts` | localStorage store (meals, goals, import/export) + `useStore()` hook |
| `src/lib/config.ts` | Model name, voice, timeouts, frame size; tweak here |
| `src/app/page.tsx`, `src/components/*` | Home screen and Live overlay UI |
| `src/app/settings/page.tsx` | Goals, export/import, access code |

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
- **"Camera and microphone need a secure (HTTPS) connection":** see *Testing on your phone*.
- **"quota exceeded":** you've hit the free-tier limit. Wait, or check usage in Google AI Studio.
- **The agent keeps asking you to move closer to a label:** fill most of the screen with the nutrition table, avoid glare from overhead lights, and hold still for a second or two. Small, curved, or shiny packs are the hardest. Check that `LIVE_MEDIA_RESOLUTION` is still `MEDIA_RESOLUTION_HIGH`.
- **No sound on iPhone:** make sure the ring/silent switch is off and the volume is up.

## Notes

- Estimates are AI guesses and can be meaningfully off. Label scores are the AI's judgment, and a misread digit is possible. Glance at the card's numbers before logging. This is not medical advice.
- Ephemeral tokens are a Preview feature of the Gemini API. If token creation or connection starts failing after an SDK upgrade, check <https://ai.google.dev/gemini-api/docs/ephemeral-tokens>.
- Data lives only in this browser. Use **Settings → Export JSON** for backups or to move to a new phone.
