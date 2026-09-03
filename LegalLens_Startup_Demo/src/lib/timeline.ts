/**
 * Master timeline for the LegalLens startup sequence (milliseconds
 * from mount). Tune these constants rather than scattering magic
 * numbers through the components.
 *
 *  0.0–0.9    completely black screen
 *  0.9–1.45   gavel appears raised, settles into its striking stance
 *  1.45–3.2   DOUBLE STRIKE: wind-up → STRIKE 1 (≈2.05s) → lift →
 *             STRIKE 2 (≈2.68s) → settle
 *  2.76–3.4   "LegalLens" pops in at center from the final impact
 *  3.4–3.7    the gavel recedes while the wordmark holds in the center
 *  3.7–4.7    the wordmark rests alone in the center — a full ~1s
 *             calm beat before it moves
 *  4.7–5.0    brand slides toward the left; login panel slides in
 *             from the right; theme applies
 *  5.9+       final login screen, stationary and interactive
 */
export const TIMELINE = {
  /** Step 1 → 2: black screen ends, gavel appears slightly raised. */
  gavelAppear: 900,
  /** Step 2: gavel settles naturally into its striking position. */
  gavelReady: 1150,
  /** Step 3: the double-strike sequence begins (the CSS animation runs
   *  uninterruptibly through both strikes from here). */
  strikeStart: 1450,
  /** Duration of the CSS double-strike keyframes — keep in sync with
   *  GavelAnimation.css. */
  strikeDurationMs: 1750,
  /** Fractions of the strike animation at which the gavel contacts the
   *  block (strike 1 then strike 2) — keep in sync with the keyframes. */
  strikeImpact1Fraction: 0.34,
  strikeImpact2Fraction: 0.7,
  /** Step 4: wordmark pops in at center, just after the second impact. */
  brandPop: 2760,
  /** The strike animation has ended and the gavel now recedes while the
   *  wordmark holds its centered pose. */
  hold: 3400,
  /** Steps 5–7: brand slides left. The gavel is long gone by now, so the
   *  wordmark has rested alone at center for a full ~1 second. */
  slide: 4700,
  /** Step 6 + 8: login panel slides in from the right; theme transition begins. */
  login: 5000,
  /** Everything settled. */
  done: 5900,
} as const;

/** Global scene phase — drives brand, background and login layer. */
export type StartupPhase =
  | "black"
  | "gavelAppear"
  | "gavelReady"
  | "strike"
  | "brandPop"
  | "hold"
  | "slide"
  | "login"
  | "done";

/** Gavel-specific phase — kept separate so the strike animation completes. */
export type GavelPhase = "hidden" | "appear" | "ready" | "strike" | "exit";
