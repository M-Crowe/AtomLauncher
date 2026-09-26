# Adversarial Review & QA Report: CreeperCanvas & BottomNav Routing

## 1. Independent Requirements Derivation
- **R1: Controlled BottomNav & Multi-view Routing**:
  - `BottomNav.tsx` must support controlled navigation state (`activeTab` / `value`, `onChange` / `onSelect`), while retaining graceful fallback for uncontrolled usage.
  - Smooth sliding highlight animation (`translateX`) must be preserved and correctly aligned with the tab items.
  - In `App.tsx`, unified page state (`home` | `settings` | `tools`) must conditionally render the respective views.
  - `PluginSlot` (WASM plugin module) must be hosted inside the `tools` view with intact props (`pluginDir`, `entryJs`).
- **R2: Dynamic Interactive Creeper Showcase on Canvas (Pretext)**:
  - 8-bit classic green pixel Creeper with 4-leg alternate swing kinematics, torso bobbing, patrol walking, and boundary turnaround.
  - `@chenglou/pretext` multiline typography for "ATOM LAUNCHER" art title and random Minecraft splashes, with zero DOM reflows and zero `measureText` in the hot render loop.
  - Interactive easter eggs: Proximity watching (stopping, head tilting, pupils focusing on cursor), click startled reaction (swelling, flashing, 36 explosive smoke/spark particles, "Ssssss!" speech bubble, startled leap and panic speed), and splash card clicking.
  - Responsive canvas sizing without scrollbars or distortion, 100% code-driven with zero external image dependencies.

---

## 2. Issues Identified in Prior Attempt

### Issue 1: Pupil Gaze Offset Inverted When Creeper Faces Left
- **Input**: Cursor positioned to the left of the Creeper (`mouseX < creeperX`).
- **Expected**: Creeper turns left (`dir = -1`), and its eyes/pupils focus towards the cursor (forward, to the left).
- **Actual**: Eyes shifted backwards (to the right, away from the cursor).
- **Root Cause**: `s.lookOffsetX` was computed in world coordinates (`s.mouseX > s.creeperX ? 1 : -1`). However, Creeper rendering applies `ctx.scale(s.dir, 1)`. In the mirrored local coordinate system when `dir = -1`, adding a negative world offset (`-1`) shifted the pupil pixels in local -X, which points in world +X (backward/away from the cursor).
- **Fix**: Accounted for the Creeper's facing direction in local space (`s.lookOffsetX = Math.abs(s.mouseX - s.creeperX) > 10 ? 1 : 0`), ensuring local eye offsets always gaze forward towards the cursor. Also pre-filled the head base rect (`ctx.fillStyle = CREEPER_COLORS.G1; ctx.fillRect(x, y, 8 * P, 8 * P);`) to prevent transparent 1px voids when eye pixels shift.

### Issue 2: Frame-Rate Dependent Movement and Easter Egg Timers
- **Input**: Running on high-refresh-rate displays (120Hz, 144Hz, 240Hz).
- **Expected**: Creeper moves at consistent real-world velocity (pixels per second) and startled effect lasts ~1.1 seconds.
- **Actual**: `s.creeperX += s.dir * s.speed` and `s.startledTimer--` / `s.panicTimer--` decremented raw integer counts per frame without `dt`. On a 144Hz display, Creeper ran 2.4x faster and startled duration was cut to < 0.45 seconds.
- **Root Cause**: Missing time delta normalization for spatial velocity, particle decays, and timer counters.
- **Fix**: Introduced `const timeScale = Math.min(Math.max(dt * 60, 0.2), 3);` to normalize Creeper movement, particle physics, cloud translation, and startled/panic countdowns to 60fps baseline.

### Issue 3: Boundary Turnaround Clamping Oscillation at Narrow Container Widths (< 80px)
- **Input**: Container width resized below 72px (e.g. 50px or 60px).
- **Expected**: Creeper maintains a safe patrol corridor and turns around cleanly without vibration.
- **Actual**: `leftBound = 36` and `rightBound = width - 36` resulted in `leftBound >= rightBound`. Creeper hit both clamping boundaries simultaneously, flipping `dir` every single frame in an infinite oscillation loop.
- **Root Cause**: Hardcoded 36px static margins without minimum corridor bounds.
- **Fix**: Formulated dynamic boundaries `leftBound = Math.min(36, Math.max(12, width * 0.15))` and `rightBound = Math.max(leftBound + 16, width - leftBound)`, guaranteeing `leftBound < rightBound` with a minimum 16px patrol width under any viewport.

### Issue 4: DOM `measureText` Called in Hot RAF Loop & Fragile Multiline Title Handling
- **Input**: Title rendering during `renderLoop` (60/144fps), or container compressed so title wraps to 2 lines.
- **Expected**: 100% Pretext arithmetic layout without querying Canvas `measureText` per frame, and multiline title wrapped neatly with splash card positioned below it.
- **Actual**:
  1. `ctx.measureText("ATOM")` and `ctx.measureText(" ")` were called on every animation frame, defeating Pretext's cache.
  2. When title wrapped into 2 lines, it only measured `titleLayout.lines[0].width` ("ATOM") to center, but drew both "ATOM" and "LAUNCHER" side by side on line 0, overflowing the canvas and ignoring line 1.
  3. `cardY` was hardcoded to 56, colliding directly with wrapped title lines.
- **Root Cause**: Ignoring Pretext's prepared segment widths (`titlePrepared.widths`) and assuming 1-line title geometry.
- **Fix**:
  1. Extracted precomputed segment widths (`titlePrepared.widths[0]`, `[1]`, `[2]`) from Pretext handle for zero-overhead split coloring.
  2. Added multiline support rendering Line 0 ("ATOM") and Line 1 ("LAUNCHER") vertically stacked when wrapped.
  3. Dynamically computed `cardY = titleBottomY + 18` so splash card always stays clear of title.

### Issue 5: BottomNav Regression in Highlight Elevation & Missing Uncontrolled Support
- **Input**: Uncontrolled `<BottomNav />` usage without props, or tab key validation.
- **Expected**: Retains internal state for uncontrolled usage, safely maps unknown tabs, and preserves the elevated green Minecraft button style from HEAD.
- **Actual**: BottomNav threw away internal state completely, rendering it broken when used uncontrolled. Also, invalid tab values caused `translateX(NaN%)`.
- **Root Cause**: Removal of internal `useState` and unguarded `indexMap[current]`.
- **Fix**: Restored `useState<NavValue>(defaultValue)` fallback, guarded `rawCurrent in indexMap ? rawCurrent : 'home'`, and preserved button `flex-1` alignment with slider `w-1/3`.

### Issue 6: 1-Frame Unscaled Canvas Glitch on Mount
- **Input**: Component mount before initial ResizeObserver callback.
- **Expected**: Canvas initialized to container dimensions immediately on first frame.
- **Actual**: Canvas began with HTML default 300x150 bitmap until ResizeObserver fired in a subsequent microtask/tick.
- **Root Cause**: Canvas dimensions were only set inside ResizeObserver callback.
- **Fix**: Synchronously measured `container.getBoundingClientRect()` and called `updateSize()` on mount prior to launching RAF.

---

## 3. Verification Record
- **Automated Tests (`npm test`)**: 12/12 test suites passing (5 new adversarial regression suites added).
  - `R1. BottomNav component interface and controlled contract`
  - `R1. App view routing and state management`
  - `R2. Pretext Typography layout with "ATOM LAUNCHER" art title and splashes`
  - `R2. Creeper 8-bit walking kinematics and boundary turnaround logic`
  - `R2. Creeper proximity watching and startled easter egg logic`
  - `R1. SettingsView pixel UI placeholder panels`
  - `R1. ToolsView WASM plugin integration`
  - `R1. BottomNav uncontrolled fallback and safe navigation mapping`
  - `R2. Creeper boundary turnaround at narrow widths (< 80px) prevents oscillation`
  - `R2. Creeper gaze direction math in local coordinate space`
  - `R2. Frame-rate independent physics with dt scaling (60Hz vs 144Hz)`
  - `R2. Pretext multiline wrapping under extreme compression (< 80px)`
- **Production Build (`npm run build`)**: `tsc && vite build` built cleanly in 1.02s with zero TypeScript diagnostics and zero warnings.
