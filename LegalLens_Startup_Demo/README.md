# LegalLens — Startup & Login Prototype

A self-contained frontend prototype of the LegalLens startup experience:
black screen → gavel appears → gavel strikes (thud) → **LegalLens** pops in →
branding slides left → login panel slides in from the right → final login screen.

No backend, no database, no real authentication — the login form is a visual
placeholder. The animation plays once on load and the login screen stays
interactive afterwards.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Production build: `npm run build` (output in `dist/`).

## Structure

```
src/
  main.tsx                       React entry; applies theme before first paint
  App.tsx                        renders LegalLensStartup
  components/
    LegalLensStartup.tsx         orchestrates the sequence (phase state machine)
    GavelAnimation.tsx/.css      gavel: appear → raise → strike → rebound → exit
    BrandReveal.tsx/.css         one persistent wordmark: center pop → slides left
    LoginTransition.tsx/.css     login layer; panel slides in from the right
    LoginPage.tsx/.css           final login card, password toggle, theme toggle
    icons.tsx                    inline SVG icons (scales, eye, sun/moon)
  lib/
    timeline.ts                  master timing constants + phase types
    gavelSound.ts                thud audio (mp3 if present, synth fallback)
  styles/global.css              light/dark theme tokens
public/
  gavel.png                      the gavel asset (head + handle), used unmodified
  block.png                      the sound block asset (brass plate on top)
  brand-mark.png                 the brand's scales-of-justice logo (custom PNG)
  sounds/gavel-thud.mp3          the real gavel-thud recording

## Your artwork — where it lives

**Gavel thud sound** — the real recording is at `public/sounds/gavel-thud.mp3`.
It is detected at startup and played at the exact impact moment. If the
file is ever removed, a synthesized knock (Web Audio API) is used as a
fallback. The logic lives in `src/lib/gavelSound.ts`. To swap in a new
recording, replace the mp3 in place (same filename) and hard-refresh.

**Brand mark (scales of justice logo)** — your custom PNG is at
`public/brand-mark.png`. `BrandReveal` renders it beside the wordmark
and falls back to a built-in SVG scales icon only if the file is
missing. The PNG is shown as-is (no recoloring), so make sure it reads
on both light and dark surfaces. To swap it, replace the file in place
and hard-refresh.

---

Design details adopted from the client's startup storyboard (kept
restrained for the institutional feel — no explosions or flashing):

- A soft warm pool of light grounds the gavel scene during the strikes.
- At each impact, a small golden light blooms at the point where the
  head meets the brass plate (positioned from measured plate geometry,
  not eyeballed).
- The wordmark appears to be born from the impact: a thin gold light
  streak draws out beneath "LegalLens" during the center pop, then
  quietly disappears as the brand settles left.
- After the gavel recedes, the wordmark rests alone in the center for a
  full ~1s calm beat before it slides to the left.
- The brand mark renders ~4× the original size so the emblem's detail
  reads clearly (CSS variable `--mark` in `BrandReveal.css`); the brand
  column clearance scales with it, and the divider steps aside below
  ~1080px so the two columns never collide.
- A quiet vertical divider sits between the branding and the login card,
  hugging the card's left edge (~57% of the viewport on wide screens).
- Final login: tagline "Insight. Development. Justice.", small user /
  lock icons inside the fields, the CTA reads "Login", and the button
  adapts per theme — navy with white text in light mode, gold with dark
  text in dark mode.

---

The gavel and sound block were split from one composite photo by the
client. The block is composited inside the gavel's canvas box at the
measured composite geometry — tune these CSS variables in
`GavelAnimation.css` if the artwork changes:

    --block-left    horizontal placement (left edge of the scene box)
    --block-top     vertical placement
    --block-width   rendered size (block currently shown slightly
                    smaller than the raw composite scale)

Only the gavel moves during the strike; it rotates about a pivot at the
handle end (transform-origin on `.gavel-rot`) so the head arcs down
onto the block plate, which stays planted and takes a tiny recoil at
impact.
```

## Component contract

`LegalLensStartup` runs one master timeline (`src/lib/timeline.ts`) and drives
every child through a `phase` prop — the structure maps directly onto the
intended integration:

```
LegalLensStartup
  ├─ GavelAnimation   (appears → raises → strikes → leaves)
  ├─ BrandReveal      (pops in center → slides left → persists)
  └─ LoginTransition
       └─ LoginPage   (slides in from the right)
```

Key behaviors to preserve when integrating:

- The wordmark is **one DOM node** from the center pop to the final screen —
  it is never faded out, crossfaded, or replaced.
- The main transitions are **position-based** (`translateX`/`translateY`,
  `left`/`top`, `scale`, small rotations); opacity is used only where
  genuinely necessary (gavel entry/exit, icon & tagline appearance).
- The gavel strikes **twice** inside one continuous CSS keyframe
  animation; a thud is synchronized to each impact frame in
  `LegalLensStartup`.

## Audio

The impact plays a deep, short thud. Without a recording, a synthesized
knock is used (Web Audio API — low damped tone + filtered transient).

To use a real recording, place it at:

```
public/sounds/gavel-thud.mp3
```

It is detected automatically (HEAD request + audio content-type check) and
preloaded/decoded once at startup. The module scans the waveform for each
sharp knock transient (a recording may hold one knock or a natural
double strike) and plays the matching knock per visual strike, trimmed so
no echoes bleed across strikes. Speaker latency is measured
(`baseLatency` + `outputLatency`) and each sound is fired that early,
frame-locked to the CSS animation clock, so the audible thud lands
exactly on the frame the gavel contacts the block. No code changes
needed when swapping the file.

Note: browsers block autoplay audio until a user gesture. The strikes
happen ~2–2.7s after load, so each thud plays on impact if the page
received a click/keypress by then; otherwise that strike is silent (the
visuals still carry the moment).

## Themes

The final login screen follows the user's `prefers-color-scheme` (light or
dark), applied together with the login panel entering. A small toggle in the
top-right corner switches themes after the animation so both can be demoed.
The startup scene is always black; the theme takes over only when the login
screen arrives.

## Timeline

| Time | Beat |
| --- | --- |
| 0.0–0.9s | Completely black screen |
| 0.9–1.45s | Gavel appears raised, settles into its striking stance |
| 1.45–2.05s | Wind-up → **STRIKE 1** (≈2.05s) |
| 2.05–2.68s | Gavel lifts → **STRIKE 2** (≈2.68s), settle |
| 2.76–3.4s | “LegalLens” pops in at center, tied to strike 2 |
| 3.4–4.7s | Gavel recedes (gone by ~3.7s); the wordmark rests alone in the center for a full ~1s calm beat |
| 4.7–5.0s | Branding slides left (~3s gavel on screen total) |
| 5.0–5.9s | Login panel slides in from the right; theme applies |
| 5.9s+ | Final login screen, stationary and interactive |

Timing lives in `src/lib/timeline.ts` (JS) and the matching CSS keyframes —
keep `strikeDurationMs` / `strikeImpact1Fraction` /
`strikeImpact2Fraction` in sync with `GavelAnimation.css` if you retune
either.

## Dev helpers

In dev mode only, the sequence can be driven from the console:

```js
window.__legalLens.setPhase("black");   // jump to any phase
window.__legalLens.replay();            // restart from the black screen
```

`prefers-reduced-motion` is respected: the sequence skips straight to the
final login screen.