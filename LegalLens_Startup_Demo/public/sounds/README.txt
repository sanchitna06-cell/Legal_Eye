The real gavel "thud" recording lives here as gavel-thud.mp3.

It is served at /sounds/gavel-thud.mp3 and detected automatically by
src/lib/gavelSound.ts — no code changes needed. It plays at the exact
moment of visual impact (~2.2s into the startup sequence). To swap in a
new recording, replace the mp3 in place (keep the same filename) and
hard-refresh the page.

If the file is removed, a short synthesized knock (Web Audio API) is
played at the impact moment instead.

Note: browsers block autoplay audio until the user interacts with the
page. The strike happens ~2.2s after load, so the thud plays on impact
if the page has received a click or keypress by then; otherwise the
impact is silent (the visual strike still lands).
