# Neon Asteroids: Code Overhaul, Mobile iOS, & Performance

**Date:** 2026-04-02
**Status:** Approved

## Summary

Holistic overhaul of the neon-asteroids game covering: (1) decomposing the 1254-line Game.js monolith into focused modules, (2) zone-based touch controls and iPhone-safe UI for iOS, (3) performance optimizations across rendering and collision systems, (4) general code cleanup.

## Constraints

- Keep code simple — no unnecessary abstractions
- Target modern iPhones (12+ with notch/Dynamic Island)
- Maintain all existing gameplay, visual style, and features
- Small, reviewable chunks — each phase gets its own PR
- Nothing is off-limits for improvement

## Phase 1: Decompose Game.js

Extract responsibilities from the 1254-line Game.js into focused modules. Pure refactor — zero behavior changes.

### New Modules

**Game.js (~200 lines) — Orchestrator**
- Game loop (`loop`, `update`, `draw`)
- State machine (START, PLAYING, GAMEOVER)
- Entity arrays ownership
- Delegates to subsystems

**Renderer.js (~250 lines) — All Canvas Drawing**
- `draw()` pipeline: clear, camera shake, grid, entities, touch controls
- `drawGrid()` — planets, stars with ripple distortion
- Canvas setup and DPI handling
- FPS counter

**CollisionSystem.js (~150 lines) — Hit Detection & Response**
- `checkCollisions()` — bullets vs asteroids/ship/alien/cow
- `checkAsteroidCollisions()` — asteroid-asteroid elastic bounce
- Close-call detection
- Scoring logic (size + color multipliers)

**UIManager.js (~200 lines) — HUD & Screens**
- DOM element references and updates (score, lives, high score)
- Start/gameover screen show/hide
- Auth UI wiring (login, logout, profile display)
- Button event listeners (pause, quit, logs)
- Leaderboard rendering

**SpawnManager.js (~100 lines) — Entity Lifecycle**
- `spawnAsteroids()` — safe-distance spawning
- `generatePlanets()` — background planet generation
- Cow spawn logic (random per-frame chance)
- Alien spawn logic (random per-frame chance)
- Wave progression / target density calculation

**BackgroundFX.js (~150 lines) — Visual Background**
- Star field (150 stars, parallax, wrapping)
- Planet rendering (parallax, rings)
- Ripple system (creation, update, physics push on asteroids, distortion calculation)
- Grid offset tracking

### Wiring Pattern

Game.js creates all subsystems in constructor. Each frame:
```
loop() -> update(dt) -> draw()

update(dt):
  backgroundFX.update(dt, ship, asteroids, state)
  particles.update()
  if PLAYING:
    ship.update(input)
    entities.update()
    spawnManager.update(asteroids, level, score)
    collisionSystem.check(ship, bullets, asteroids, alien, cow)

draw():
  renderer.draw(gameState)
```

Subsystems receive what they need as arguments — no circular references.

**Key design decisions:**
- BackgroundFX exposes a `getDistortion(x, y)` method; Renderer calls it during the star draw loop
- Pause/dashboard-open guard stays in Game.js at the top of `update(dt)` — particles and shake decay still run while paused (matching current behavior)
- A read-only config object `{ isMobile }` is passed to subsystems that need conditional behavior (BackgroundFX, particle system)

## Phase 2: Mobile iOS Fixes

### Zone-Based Dynamic Joystick (TouchControls.js rewrite)

**Current:** Fixed joystick bottom-left (70px radius), fixed fire button bottom-right (55px radius). Too small, wrong position.

**New:**
- Left 50% of screen = move zone. Joystick appears where thumb lands.
- Right 50% of screen = fire zone. Tap anywhere to fire.
- Joystick base radius: 105px (50% larger)
- Fire button radius: 80px (45% larger)
- Dynamic joystick: base spawns at touch-down point, knob tracks finger
- Visual: semi-transparent zone indicators when idle, full joystick when active

### Safe Area Support

- HUD top bar: respect `env(safe-area-inset-top)` — push below notch/Dynamic Island
- Touch controls: respect `env(safe-area-inset-bottom)` — avoid home indicator
- Dashboard overlay: add safe-area padding on all sides
- Canvas: account for safe areas in coordinate mapping

### Responsive HUD

- Move HUD button bar (LOGS, PAUSE, QUIT) below the notch area
- Scale button sizes for touch (min 44px tap targets per Apple HIG)
- Ensure FPS counter doesn't overlap with Dynamic Island

### CSS Updates

- Apply safe-area insets to individual UI elements, not just body
- Dashboard window: add safe-area-aware padding
- Chat input: ensure 16px+ font (prevent iOS auto-zoom)

## Phase 3: Performance Optimization

### Rendering

- Reduce particle cap from 300 to 200 on mobile (detect via `isMobile`)
- Reduce star count from 150 to 80 on mobile
- Skip planet ring rendering on mobile
- Use `Math.hypot` only where needed — inline `dx*dx + dy*dy` for hot paths
- Avoid `forEach` in hot loops — use `for` loops (already partially done)

### Collision Detection

- Early-exit broad phase: skip bullets far from any asteroid (quadrant check)
- Cache `radius + radius` sums to avoid recalculation
- Asteroid-asteroid: skip pairs with large separation (bounding box pre-check)

### Touch Input

- Throttle `touchmove` handler to ~60fps using `requestAnimationFrame` guard
- Remove redundant `getBoundingClientRect()` calls on every touch event — cache on resize

### Memory

- Object pool for particles (avoid GC spikes from constant new/filter)
- Pre-allocate star and planet arrays

## Phase 4: Code Cleanup

### API Key Consolidation

- `.env` and `.env.local` have different Gemini API keys — consolidate to a single key in `.env.local` only, remove the stale key from `.env`
- Verify `.env.local` is in `.gitignore` (it should be already)
- Remove hardcoded Firebase API key from AuthService.js — move to env vars

### Dead Code

- Remove `initLevel()` (empty method)
- Remove `nebulae` array (declared but never populated or used)
- Clean up commented-out code throughout

### General Quality

- Consistent naming (some camelCase, some not)
- Remove all debug `console.log` calls in Game.js (including "NEON ASTEROIDS v3.0 - ALIEN FIX" and others)
- Remove redundant dashboard visibility checks (checked in multiple places)
- Consolidate duplicate audio unlock listeners
