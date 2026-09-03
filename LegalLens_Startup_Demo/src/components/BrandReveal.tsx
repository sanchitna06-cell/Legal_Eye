import { useState } from "react";
import type { StartupPhase } from "../lib/timeline";
import { ScalesIcon } from "./icons";
import "./BrandReveal.css";

interface BrandRevealProps {
  phase: StartupPhase;
}

/**
 * Custom brand mark: drop your own PNG at
 *
 *   public/brand-mark.png   (served as /brand-mark.png)
 *
 * and it will be used beside the wordmark automatically. Until that
 * file exists, a small scales-of-justice SVG is shown instead, so the
 * layout never breaks while the artwork is being made.
 */
export default function BrandReveal({ phase }: BrandRevealProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="brand" data-phase={phase} aria-hidden="true">
      <span className="brand-icon">
        {logoFailed ? (
          <ScalesIcon />
        ) : (
          <img
            className="brand-mark"
            src="/brand-mark.png"
            alt=""
            draggable={false}
            onError={() => setLogoFailed(true)}
          />
        )}
      </span>
      <span className="brand-wordmark">LegalLens</span>
      <span className="brand-tagline">Case Intelligence for Legal Professionals</span>
    </div>
  );
}