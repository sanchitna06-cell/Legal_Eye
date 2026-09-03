/**
 * Gavel "thud" audio — fired at the exact visual-impact frame.
 *
 * A real recording may be placed at
 *
 *   public/sounds/gavel-thud.mp3   (served as /sounds/gavel-thud.mp3)
 *
 * It is preloaded and decoded once at startup. The file is scanned for
 * its knock transients (a recording may be a single knock, or a double
 * strike like "bang-bang" — each sharp attack is detected from the
 * waveform). Each visual strike then plays from the offset of its own
 * knock, so the audible hit starts on the frame of contact rather than
 * after a silent lead-in or an echo of an earlier knock.
 *
 * Speakers add a small pipeline latency (audio context buffering + the
 * output device), so `audioLeadMs()` exposes that estimate and the
 * startup orchestrator fires each sound slightly early — by the time
 * the sound reaches the speakers, the gavel is at the block. High-
 * latency devices (Bluetooth speakers/headphones can be 150–300ms)
 * are supported up to a 300ms cap.
 *
 * Autoplay note: browsers require a user gesture before audio can play.
 * Each knock therefore tries to start immediately; if the context is
 * still suspended it is resumed first and the knock plays as soon as
 * the browser allows. For reliable sound, click or press a key during
 * the black screen (the first ~1s). The strike happens ~2s after load.
 *
 * Without the mp3, a short synthesized wooden knock (low damped tone +
 * filtered transient) is played instead.
 */

const MP3_URL = "/sounds/gavel-thud.mp3";

/**
 * Manual tuning aid — set to a positive number of milliseconds to force
 * the audio lead instead of measuring it (0 = auto-measure). Useful if
 * a device reports no latency (e.g. some Windows audio stacks report
 * outputLatency = 0 and the knock then arrives slightly late).
 */
const LEAD_OVERRIDE_MS = 0;

let ctx: AudioContext | null = null;
let mp3Buffer: AudioBuffer | null = null;
/** Start offsets (seconds into the file) of each detected knock. */
let knockOffsets: number[] = [];
let mode: "pending" | "mp3" | "synth" = "pending";
/** Estimate of the delay between scheduling audio and it being heard. */
let audioLeadSec = 0.06;

async function detectMp3(): Promise<boolean> {
  try {
    const res = await fetch(MP3_URL, { method: "HEAD" });
    // Some dev servers answer 200 with the SPA fallback for missing
    // files, so also require an audio content type.
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("audio/");
  } catch {
    return false;
  }
}

function ensureContext(): AudioContext | null {
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

/**
 * Locate the sharp knock transients: sliding 2ms RMS energy, spikes
 * above 25% of the peak that decay below 10% mark one knock each.
 * Falls back to the first audible sound if nothing spike-like is found.
 */
function measureKnocks(buffer: AudioBuffer): number[] {
  const ch = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const win = Math.max(1, Math.floor(sr * 0.002));
  const rms: number[] = [];
  for (let i = 0; i + win < ch.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += ch[j] * ch[j];
    rms.push(Math.sqrt(s / win));
  }
  const peak = Math.max(...rms);
  const starts: number[] = [];
  let inSpike = false;
  for (let i = 0; i < rms.length; i++) {
    const t = (i * win) / sr;
    if (t > 2.5) break; // ignore far-off echoes
    if (!inSpike && rms[i] > peak * 0.25) {
      inSpike = true;
      starts.push(t);
    } else if (inSpike && rms[i] < peak * 0.1) {
      inSpike = false;
    }
  }
  const knocks = starts.filter((t) => t > 0.05); // skip leading clicks
  if (knocks.length === 0) {
    const first = rms.findIndex((r) => r > peak * 0.1);
    if (first >= 0) knocks.push((first * win) / sr);
  }
  return knocks;
}

/** Estimate the delay from "scheduled" to "heard" on this device. */
function refreshLatency(): void {
  if (LEAD_OVERRIDE_MS > 0) {
    audioLeadSec = Math.min(LEAD_OVERRIDE_MS, 300) / 1000;
    return;
  }
  const ac = ctx;
  if (!ac) return;
  let lat = 0;
  const b = (ac as unknown as { baseLatency?: number }).baseLatency;
  const o = (ac as unknown as { outputLatency?: number }).outputLatency;
  if (typeof b === "number" && Number.isFinite(b)) lat += b;
  if (typeof o === "number" && Number.isFinite(o) && o > 0) lat += o;
  if (lat <= 0) {
    // Nothing reported at all (some Windows stacks report 0) — assume
    // a plausible middle-ground.
    lat = 0.06;
  } else if (lat < 0.03) {
    // Reported numbers too small to be believable (e.g. baseLatency
    // alone) — nudge toward a realistic speaker pipeline.
    lat = 0.045;
  }
  // High-latency devices (Bluetooth can be 150–300ms) up to 300ms.
  audioLeadSec = Math.min(Math.max(lat, 0.02), 0.3);
}

/**
 * Try to get the audio context running (needed before any sound can
 * play). Resolves true if sound is currently possible.
 */
export async function ensureAudioRunning(): Promise<boolean> {
  const ac = ensureContext();
  if (!ac) return false;
  if (ac.state === "running") return true;
  try {
    await ac.resume();
    refreshLatency();
  } catch {
    // not allowed yet — will retry on the next gesture / strike
  }
  return ensureContext()?.state === "running";
}

/**
 * Detect + preload the mp3 once at startup; measure its knock offsets so
 * each impact can be synced sample-accurately. Warm the audio context on
 * the first user gesture (and re-measure latency once running).
 */
export async function initGavelSound(): Promise<void> {
  if (await detectMp3()) {
    try {
      const res = await fetch(MP3_URL);
      const ab = await res.arrayBuffer();
      const ac = ensureContext();
      if (ac) {
        const decoded = await ac.decodeAudioData(ab);
        mp3Buffer = decoded;
        knockOffsets = measureKnocks(decoded);
        mode = "mp3";
      }
    } catch {
      // fall through to synth
    }
    if (mode !== "mp3") mode = "synth";
  } else {
    mode = "synth";
  }
  refreshLatency();
  if (import.meta.env.DEV) {
    console.debug(
      `[gavel] audio ready: ${mode}, knocks @ ${knockOffsets.map((k) => k.toFixed(3)).join(", ")}s, lead ≈ ${(audioLeadSec * 1000).toFixed(0)}ms`
    );
  }

  const warm = () => {
    void ensureAudioRunning();
    window.removeEventListener("pointerdown", warm);
    window.removeEventListener("pointerup", warm);
    window.removeEventListener("keydown", warm);
    window.removeEventListener("touchend", warm);
  };
  window.addEventListener("pointerdown", warm, { once: true });
  window.addEventListener("pointerup", warm, { once: true });
  window.addEventListener("touchend", warm, { once: true });
  window.addEventListener("keydown", warm, { once: true });

  // Dev diagnostics — poke from the console to see audio state.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__gavelSound = {
      state: () => ensureContext()?.state ?? "no-context",
      mode: () => mode,
      knocks: () => knockOffsets,
      leadMs: audioLeadMs,
      resume: () => ensureAudioRunning(),
      play: (i: number) => playStrikeSound(i),
    };
  }
}

/** Estimated speaker latency (ms) — callers fire sounds this early. */
export function audioLeadMs(): number {
  return audioLeadSec * 1000;
}

/**
 * Play the knock for one visual strike — call when the gavel reaches
 * (impact − audioLeadMs) on the animation clock. Strike 0 plays the
 * recording's first knock, strike 1 the second (falling back to the
 * first if the file holds a single knock). Each buffer is cut just
 * before the next knock so no stray echoes bleed across strikes.
 */
export function playStrikeSound(strikeIndex: number): void {
  if (mode === "pending") return; // preload still in flight — skip quietly
  const ac = ensureContext();
  if (!ac) return;
  if (ac.state !== "running") {
    // Not unlocked yet (autoplay). Resume and play the instant the
    // browser allows — otherwise a late first interaction would make
    // this strike silent.
    ac.resume()
      .then(() => {
        if (ac.state === "running") scheduleKnock(ac, strikeIndex);
      })
      .catch(() => {});
    return;
  }
  scheduleKnock(ac, strikeIndex);
}

function scheduleKnock(ac: AudioContext, strikeIndex: number): void {
  if (mode === "mp3" && mp3Buffer) {
    const idx = Math.min(strikeIndex, knockOffsets.length - 1);
    const offset = knockOffsets[idx];
    if (offset === undefined) return;

    const src = ac.createBufferSource();
    src.buffer = mp3Buffer;
    const gain = ac.createGain();
    gain.gain.value = 0.85;
    src.connect(gain);
    gain.connect(ac.destination);
    src.start(ac.currentTime, offset);

    // Stop just before the file's next knock so strike 1 cannot ring a
    // second, un-synced bang into strike 2.
    const next = knockOffsets[idx + 1];
    if (typeof next === "number" && next - offset > 0.05) {
      src.stop(ac.currentTime + (next - offset - 0.03));
    }

    if (import.meta.env.DEV) {
      console.debug(
        `[gavel] strike ${strikeIndex} → file offset ${offset.toFixed(3)}s @ ${performance.now().toFixed(0)}ms (lead ${audioLeadMs().toFixed(0)}ms)`
      );
    }
    return;
  }
  synthThud();
}

/** Short, deep, authoritative knock synthesized with the Web Audio API. */
function synthThud(): void {
  const ac = ensureContext();
  if (!ac || ac.state !== "running") return;

  const t = ac.currentTime;
  const duration = 0.5;

  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.6, t + 0.006);
  master.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  master.connect(ac.destination);

  // Main body: a damped low tone with a slight downward pitch — the "thud".
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(88, t + 0.24);
  osc.connect(master);
  osc.start(t);
  osc.stop(t + 0.3);

  // Second body resonance for warmth.
  const osc2 = ac.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(84, t);
  osc2.frequency.exponentialRampToValueAtTime(52, t + 0.32);
  osc2.connect(master);
  osc2.start(t);
  osc2.stop(t + 0.35);

  // Brief filtered noise transient — the wooden "knock" attack.
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.06), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.015));
  }
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;
  noise.connect(filter);
  filter.connect(master);
  noise.start(t);
  noise.stop(t + 0.1);
}
