/**
 * Master choreography for the JURY HASH opening sequence.
 *
 * The gavel + sound block play the startup choreography from the reference
 * demo: the scene fades in already raised, settles into a striking stance,
 * then runs ONE uninterrupted double-strike animation (~1.75s) whose two
 * contact frames are at 34% and 70% of the run. Every number is a
 * millisecond offset from sequence start, so CSS, React state and the
 * impact sounds share one clock.
 *
 *   0.0–0.2    darkness; courtroom haze begins bleeding out of the black
 *   0.9–1.15   gavel + sound block fade in, raised (+8deg)
 *   1.15–1.45  the gavel settles into its striking stance (5.5deg)
 *   1.45–3.2   DOUBLE STRIKE (one 1.75s run): wind-up → STRIKE 1 (≈2.045s)
 *              → lift → STRIKE 2 (≈2.675s) → settle. The two thud sounds
 *              are NOT timer beats — the component reads the CSS animation's
 *              own clock and fires each knock at (impact − speaker lead),
 *              so audio is frame-locked to the visuals.
 *   3.4        the gavel scene recedes, leaving the stage clear
 *   3.9        JURY HASH wordmark reveals at the centre
 *   5.2        courtroom dims, brand holds
 *   6.2        intro hands over to the application
 */

export const TIMELINE = {
  /** courtroom haze begins bleeding out of darkness */
  hazeIn: 200,
  /** the gavel + sound block scene fades in, already raised */
  gavelIn: 900,
  /** the gavel settles from raised into its striking stance */
  gavelReady: 1150,
  /** the uninterrupted double-strike animation begins (1.75s run) */
  strikeStart: 1450,
  /** the scene recedes, well before the wordmark takes centre stage */
  gavelExit: 3400,
  /** JURY HASH wordmark reveals at the centre */
  brandIn: 3900,
  /** courtroom recedes, brand settles */
  settle: 5200,
  /** intro hands over to the application shell */
  handoff: 6200,
} as const;

export type IntroPhase =
  "dark" | "haze" | "gavel" | "ready" | "strike" | "exit" | "brand" | "settle" | "done";

/** Gavel-scene pose driven by the timeline above. */
export type GavelPose = "hidden" | "appear" | "ready" | "strike" | "exit";

/** Duration of the CSS double-strike keyframes — keep in sync with @keyframes gavel-double-strike. */
export const STRIKE_DURATION_MS = 1750;
/** Impact offsets inside the strike run — keep in sync with the keyframes (34% / 70%). */
export const STRIKE_IMPACT_1_MS = 595;
export const STRIKE_IMPACT_2_MS = 1225;
