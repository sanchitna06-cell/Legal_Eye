import { useEffect, useMemo, useRef, useState } from "react";
import courtroom from "@/assets/courtroom.jpg";
import gavelImg from "@/assets/gavel.png";
import blockImg from "@/assets/block.png";
import {
  TIMELINE,
  STRIKE_IMPACT_1_MS,
  STRIKE_IMPACT_2_MS,
  type GavelPose,
  type IntroPhase,
} from "@/lib/intro-timeline";
import { audioLeadMs, initGavelSound, playStrikeSound } from "@/lib/gavel-sound";
import { JuryHashMark } from "@/components/brand/JURYHashMark";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const ORDER: Array<[IntroPhase, number]> = [
  ["haze", TIMELINE.hazeIn],
  ["gavel", TIMELINE.gavelIn],
  ["ready", TIMELINE.gavelReady],
  ["strike", TIMELINE.strikeStart],
  ["exit", TIMELINE.gavelExit],
  ["brand", TIMELINE.brandIn],
  ["settle", TIMELINE.settle],
  ["done", TIMELINE.handoff],
];

function poseOf(phase: IntroPhase): GavelPose {
  switch (phase) {
    case "gavel":
      return "appear";
    case "ready":
      return "ready";
    case "strike":
      // The double-strike keyframes run uninterrupted through both contacts.
      return "strike";
    case "exit":
    case "brand":
    case "settle":
    case "done":
      return "exit";
    default:
      return "hidden";
  }
}

export function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<IntroPhase>("dark");
  const complete = useRef(onComplete);
  complete.current = onComplete;

  const reduced = useMemo(prefersReducedMotion, []);

  useEffect(() => {
    // Warm the gavel audio: preload /sounds/gavel-thud.mp3, measure its
    // knock offsets and the speaker pipeline lead.
    void initGavelSound();

    if (reduced) {
      setPhase("settle");
      const t = window.setTimeout(() => complete.current(), 900);
      return () => window.clearTimeout(t);
    }

    // One master clock: each beat lands at its TIMELINE offset. The two
    // strike sounds are frame-locked to the CSS double-strike animation —
    // the moment the strike phase begins we poll the animation's own clock
    // and fire each knock at (impact − speaker lead), the same approach as
    // the reference startup demo, so what you hear lands on the frame the
    // gavel meets the block.
    const timers = ORDER.map(([next, at]) =>
      window.setTimeout(() => {
        setPhase(next);
        if (next === "done") complete.current();
        if (next === "strike") {
          const lead = audioLeadMs();
          let bang1 = false;
          let bang2 = false;
          let strikeAnim: Animation | null = null;
          const tick = () => {
            if (!strikeAnim) {
              strikeAnim =
                document
                  .getAnimations()
                  .find(
                    (a) => (a as Partial<CSSAnimation>).animationName === "gavel-double-strike",
                  ) ?? null;
              if (!strikeAnim) {
                requestAnimationFrame(tick);
                return;
              }
            }
            const t = typeof strikeAnim.currentTime === "number" ? strikeAnim.currentTime : 0;
            if (!bang1 && t >= STRIKE_IMPACT_1_MS - lead) {
              bang1 = true;
              playStrikeSound(0);
            }
            if (!bang2 && t >= STRIKE_IMPACT_2_MS - lead) {
              bang2 = true;
              playStrikeSound(1);
            }
            if (!(bang1 && bang2)) {
              requestAnimationFrame(tick);
            }
          };
          requestAnimationFrame(tick);
        }
      }, at),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

  const pose = poseOf(phase);
  const brandVisible = phase === "brand" || phase === "settle" || phase === "done";
  const courtroomDims = phase === "settle" || phase === "done";

  return (
    <div
      className="startup-sequence fixed inset-0 z-50 overflow-hidden grain"
      aria-hidden="true"
      style={{ opacity: phase === "done" ? 0 : 1, transition: "opacity 900ms ease" }}
    >
      {/* Courtroom, emerging through haze — the background stays the same */}
      <div
        className="absolute inset-0"
        style={{
          opacity: phase === "dark" ? 0 : courtroomDims ? 0.18 : 0.62,
          transition: "opacity 2200ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <img
          src={courtroom}
          alt=""
          width={1920}
          height={1088}
          className="h-full w-full object-cover"
          style={{
            filter: "saturate(0.55) contrast(0.92) blur(3px) brightness(0.72)",
            animation: "haze-drift 14s ease-out both",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_18%,oklch(0.1_0.01_60/0.85)_78%)]" />
      </div>

      {/* Gavel + sound block — the startup choreography from the reference
          demo: scene fades in raised, settles, then runs one uninterrupted
          double strike onto the block. Pose names drive the CSS in
          styles.css; impacts, recoil and glow are frame-locked there. */}
      {pose !== "hidden" && (
        <div className="le-gavel-scene" data-gp={pose}>
          <div className="le-scene-glow" />
          <div className="le-block-wrap">
            <img className="le-block" src={blockImg} alt="" width={1040} height={362} />
          </div>
          <div className="le-gavel-rot">
            <img className="le-gavel" src={gavelImg} alt="" width={1536} height={1024} />
          </div>
          <span className="le-impact-glow le-impact-glow-1" />
          <span className="le-impact-glow le-impact-glow-2" />
        </div>
      )}

      {/* Brand reveal */}
      <div
        className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center px-6 text-center"
        style={{
          opacity: brandVisible ? 1 : 0,
          transform: `translateY(${brandVisible ? "-50%" : "-44%"})`,
          transition: "opacity 1100ms ease, transform 1100ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <JuryHashMark className="mb-6 h-10 w-10 text-[var(--startup-accent)]" />{" "}
        <div className="relative overflow-hidden">
          <h1
            className="font-display text-[clamp(2.5rem,9vw,5.5rem)] leading-none tracking-[-0.02em]"
            style={{ color: "var(--startup-text)" }}
          >
            JURY <span style={{ color: "var(--startup-accent)" }}>HASH</span>
          </h1>
          {brandVisible && (
            <span
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-[linear-gradient(90deg,transparent,oklch(0.95_0.05_85/0.55),transparent)]"
              style={{ animation: "sheen-sweep 1500ms 350ms ease-out both" }}
            />
          )}
        </div>
        <div
          className="mt-6 h-px w-40"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in oklab, var(--startup-accent) 60%, transparent), transparent)",
          }}
        />
        <p
          className="mt-5 text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: "var(--startup-muted)" }}
        >
          Legal Records · Case History · Intelligence
        </p>
      </div>
    </div>
  );
}
