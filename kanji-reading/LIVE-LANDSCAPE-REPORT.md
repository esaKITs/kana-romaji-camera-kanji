# Camera Live, landscape and source visibility — 2026-10-24

Second-edition development only. First-edition main, backup, Pages configuration and public UI are not changed.

## Changes

- Live still runs serial on-device OCR automatically (1.8-second polling, no overlapping jobs). Small hand tremors previously invalidated results under the strict whole-frame motion guard. The camera now uses a central, translation-tolerant fingerprint comparison (up to two pixels at 96×64), a 0.65 rejection threshold and 150 ms settling. Major scene changes and obsolete session results remain rejected. This is lightweight motion rejection, not tracking or alignment of labels to moving text.
- Orientation and video dimension changes invalidate the old frame and restart Live scheduling. All image layers keep the same cover geometry; Still uses contain. In short landscape viewports, shutter/image controls move to the right, options remain at top left, with safe-area padding.
- Camera labels use up to 32 local background representatives rather than the lab's three-tone palette. Original source pixels are sampled. Representatives stay fixed in a scene and per-label hysteresis resists exposure-induced switching. Palette state is bounded and clears on source/scene changes. Dark/light foregrounds follow background contrast. This reduces seams but is not image inpainting and does not reproduce a complex background texture.
- New ◐ control cycles original-image visibility 0%, 25%, 55%, 100%. It changes only replacement-paper opacity; romaji remains opaque and gains a contrasting outline when the original shows through. Live and Still share rendering. Changes repaint immediately without OCR. Preference persists alongside mode and long-vowel style under the existing second-edition key.
- Three modes and all romaji spelling rules remain unchanged.

## Verification

`npm test --prefix kanji-reading/lab`: 78 tests pass. New tests cover tolerance of hand tremors, rejection of a changed scene, bounded multi-color state and exposure hysteresis, actual canvas alpha compositing for all four levels in Live/Still, and the actual camera controller under deterministic mocked camera/OCR/timers: repeated Live recognition, Still pause/return, orientation restart, background pause/resume, preference persistence and stopping the stream.

Browser layout QA used actual app iframes at 390×844 and 844×390. The new control and Still layout render in both. The local preview is HTTP and cannot initialize OCR asset integrity checks (`crypto.subtle` unavailable); no security fallback was introduced. Vite production build succeeds.

Not verified on a physical phone in this revision: actual Live OCR throughput/first result, hand tremor thresholds, landscape video orientation on iOS/Android, long-session memory, flashlight exposure stability and app return with OS-suspended camera. The earlier user iPhone screenshots are evidence of an earlier build only. The reported Live symptom's exact cause on that phone is not yet proven; strict motion rejection is an identified starvation risk addressed here.
