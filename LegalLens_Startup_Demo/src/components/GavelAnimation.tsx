import type { GavelPhase } from "../lib/timeline";
import "./GavelAnimation.css";

interface GavelAnimationProps {
  phase: GavelPhase;
}

/**
 * The judge's gavel and sound block — two separate provided assets:
 *
 *   /gavel.png — the gavel (head upper-left, handle down-right)
 *   /block.png — the sound block (brass plate on top)
 *
 * The block is a fixed layer; only the gavel moves. It rotates about
 * a pivot at the handle end (where a hand grips it), so the head
 * swings down onto the block's plate on impact.
 *
 * Alignment: the images were split from one composite photo. The block
 * layer is scaled/positioned inside the gavel's canvas box using the
 * measured composite geometry (see the CSS variables in
 * GavelAnimation.css), so the two line up exactly as in the original.
 *
 * Phases chain so the gavel never snaps:
 *   hidden → appear (raised) → ready → strike → exit
 * "strike" runs one uninterrupted double-strike animation (~1.75s);
 * its two impact frames (34% and 70%) are what the two thud sounds
 * sync to in LegalLensStartup.
 */
export default function GavelAnimation({ phase }: GavelAnimationProps) {
  return (
    <div className="gavel-scene" data-gp={phase} aria-hidden="true">
      {/* Soft warm pool of light beneath the block — grounds the scene. */}
      <div className="scene-glow" />
      {/* The block is wrapped so the impact light can anchor to the
          measured position of its brass plate and move with it. */}
      <div className="block-wrap">
        {/* Versioned query so stale caches never serve outdated assets while
            the artwork is still being iterated on. */}
        <img className="gavel-block" src="/block.png?v=2" alt="" draggable={false} />
      </div>
      <div className="gavel-rot">
        <img className="gavel-img" src="/gavel.png?v=2" alt="" draggable={false} />
      </div>
      {/* Restrained golden light at the point of impact — one per strike.
          Drawn above the gavel so the flash reads at the contact. */}
      <span className="impact-glow impact-glow-1" />
      <span className="impact-glow impact-glow-2" />
    </div>
  );
}