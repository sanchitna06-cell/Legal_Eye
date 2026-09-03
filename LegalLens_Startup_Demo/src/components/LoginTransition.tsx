import type { ReactNode } from "react";
import type { StartupPhase } from "../lib/timeline";
import "./LoginTransition.css";

interface LoginTransitionProps {
  phase: StartupPhase;
  children: ReactNode;
}

/**
 * The login layer that enters from the right. It is transparent
 * (the stage beneath provides the theme background and branding) and
 * holds the login panel, which physically slides in:
 *
 *   translateX(150%) → translateX(0)
 *
 * No fades — pure horizontal movement with a natural ease-out.
 */
export default function LoginTransition({ phase, children }: LoginTransitionProps) {
  return (
    <div className="login-layer" data-phase={phase}>
      {/* Full-height rule between the branding and the login card. */}
      <div className="login-divider" aria-hidden="true" />
      {children}
    </div>
  );
}