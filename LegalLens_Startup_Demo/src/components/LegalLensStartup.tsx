import { useCallback, useEffect, useRef, useState } from "react";
import { audioLeadMs, initGavelSound, playStrikeSound } from "../lib/gavelSound";
import { TIMELINE, type GavelPhase, type StartupPhase } from "../lib/timeline";
import GavelAnimation from "./GavelAnimation";
import BrandReveal from "./BrandReveal";
import LoginTransition from "./LoginTransition";
import LoginPage from "./LoginPage";
import "./LegalLensStartup.css";

/**
 * LegalLensStartup — the complete startup experience.
 *
 *   LegalLensStartup
 *     ├─ GavelAnimation   (appears → raises → strikes → leaves)
 *     ├─ BrandReveal      (pops in center → slides left → persists)
 *     └─ LoginTransition
 *          └─ LoginPage   (slides in from the right)
 *
 * One master timeline (see lib/timeline.ts) advances a phase state
 * machine; each sub-component animates off its own phase value.
 * The wordmark is a single never-replaced DOM node, and the login
 * screen remains interactive after the sequence completes.
 */
export default function LegalLensStartup() {
  const [phase, setPhase] = useState<StartupPhase>("black");
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  /** Play the sequence once from the black screen. */
  const runTimeline = useCallback(() => {
    clearTimers();
    setPhase("black");

    const timers = timersRef.current;
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    // Respect reduced motion: skip straight to the settled login screen.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      at(60, () => setPhase("done"));
      return;
    }

    at(TIMELINE.gavelAppear, () => setPhase("gavelAppear"));
    at(TIMELINE.gavelReady, () => setPhase("gavelReady"));

    // The double strike: sync a thud to each visual impact frame of the
    // CSS animation. We read the animation's own clock (not a JS timer)
    // so the sounds are frame-locked to the visuals with no cumulative
    // bias, and fire each sound `audioLeadMs()` early to cancel the
    // speaker pipeline latency — the knock is heard the moment the
    // gavel contacts the block.
    at(TIMELINE.strikeStart, () => {
      setPhase("strike");
      const impact1At = TIMELINE.strikeDurationMs * TIMELINE.strikeImpact1Fraction;
      const impact2At = TIMELINE.strikeDurationMs * TIMELINE.strikeImpact2Fraction;
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
                (a) => (a as Partial<CSSAnimation>).animationName === "gavel-double-strike"
              ) ?? null;
          if (!strikeAnim) {
            requestAnimationFrame(tick);
            return;
          }
        }
        const t = typeof strikeAnim.currentTime === "number" ? strikeAnim.currentTime : 0;
        if (!bang1 && t >= impact1At - lead) {
          bang1 = true;
          playStrikeSound(0);
          if (import.meta.env.DEV) {
            console.debug(`[gavel] visual impact 1 @ anim ${t.toFixed(1)}ms (fired ${Math.round(impact1At - lead)}ms)`);
          }
        }
        if (!bang2 && t >= impact2At - lead) {
          bang2 = true;
          playStrikeSound(1);
          if (import.meta.env.DEV) {
            console.debug(`[gavel] visual impact 2 @ anim ${t.toFixed(1)}ms (fired ${Math.round(impact2At - lead)}ms)`);
          }
        }
        if (!(bang1 && bang2)) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });

    at(TIMELINE.brandPop, () => setPhase("brandPop"));
    at(TIMELINE.hold, () => setPhase("hold"));
    at(TIMELINE.slide, () => setPhase("slide"));
    at(TIMELINE.login, () => setPhase("login"));
    at(TIMELINE.done, () => setPhase("done"));
  }, [clearTimers]);

  useEffect(() => {
    void initGavelSound();
    runTimeline();
    return clearTimers;
  }, [runTimeline, clearTimers]);

  // Dev-only controls for iterating on the animation in the browser.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__legalLens = {
        setPhase: (p: StartupPhase) => setPhase(p),
        replay: runTimeline,
      };
    }
  }, [runTimeline]);

  const gavelPhase: GavelPhase =
    phase === "black"
      ? "hidden"
      : phase === "gavelAppear"
        ? "appear"
        : phase === "gavelReady"
          ? "ready"
          : phase === "strike" || phase === "brandPop"
            ? "strike" // keep the strike animation running through the pop
            : "exit"; // gavel recedes during hold, before the brand slides

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      return next;
    });
  };

  return (
    <div className="startup-stage" data-phase={phase}>
      <GavelAnimation phase={gavelPhase} />
      <BrandReveal phase={phase} />

      <LoginTransition phase={phase}>
        <LoginPage phase={phase} theme={theme} onToggleTheme={toggleTheme} />
      </LoginTransition>
    </div>
  );
}