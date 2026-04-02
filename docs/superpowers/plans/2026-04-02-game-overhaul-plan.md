# Neon Asteroids: Game Overhaul Implementation Plan

**Spec:** `docs/superpowers/specs/2026-04-02-game-overhaul-design.md`
**Date:** 2026-04-02

## Phase 1: Decompose Game.js

**Branch:** `phase-1/decompose-game` | **PR target:** `main`

### Task 1.1 — Create BackgroundFX.js
- **Create:** `src/game/BackgroundFX.js`
- **Modify:** `src/game/Game.js` — remove star generation (84-98), generatePlanets (480-496), background update (520-576), createRipple (1060-1071), getDistortion (1118-1134), drawGrid (1170-1226)
- **Class:** `BackgroundFX(width, height, config)` with `config = { isMobile }`
- **Methods:** `generatePlanets()`, `createRipple(pos, maxRadius, amplitude, audio)`, `getDistortion(x, y)`, `update(dt, ship, asteroids, state)`, `draw(ctx)`, `resize(oldW, oldH, newW, newH)`
- **Drop:** `nebulae` array (dead code)
- **Verify:** Stars drift with parallax, planets render with rings, ripples distort stars and push asteroids

### Task 1.2 — Create SpawnManager.js
- **Create:** `src/game/SpawnManager.js`
- **Modify:** `src/game/Game.js` — remove spawnAsteroids (467-478), cow spawn (634-645), alien spawn (664-674), density logic (682-686)
- **Methods:** `spawnAsteroids(count, asteroids, width, height)`, `updateCow(cow, width, height, audio)`, `updateAlien(alien, ship, asteroids, bullets, audio, stats, state, width, height)`, `maintainDensity(asteroids, level)`
- **Verify:** Asteroids spawn safely, cow/alien appear randomly, density scales with level

### Task 1.3 — Create CollisionSystem.js
- **Create:** `src/game/CollisionSystem.js`
- **Modify:** `src/game/Game.js` — remove checkCollisions (689-893), checkAsteroidCollisions (896-952), breakAsteroid (987-998)
- **Depends on:** 1.1 (calls createRipple via callback)
- **Methods:** `checkCollisions(ship, bullets, asteroids, alien, cow, callbacks)`, `checkAsteroidCollisions(asteroids)`, `breakAsteroid(asteroid, index, asteroids)`
- **Internal:** `_calculateScore(asteroid)` for size+color multiplier logic
- **Verify:** All collision types work, scoring matches, elastic bounce works

### Task 1.4 — Create UIManager.js
- **Create:** `src/game/UIManager.js`
- **Modify:** `src/game/Game.js` — remove UI refs (132-161), setupAuth (185-287), updateUI (1073-1077), leaderboard methods (1079-1116)
- **Methods:** `setupAuth(callbacks)`, `updateScore/Lives/HighScore()`, `showStartScreen/GameOverScreen()`, `fetchAndRenderLeaderboard()`, `swapMobilePrompts(isMobile)`
- **Verify:** HUD updates, auth flow, leaderboard rendering, button events

### Task 1.5 — Create Renderer.js
- **Create:** `src/game/Renderer.js`
- **Modify:** `src/game/Game.js` — remove draw (1136-1168)
- **Depends on:** 1.1 (calls backgroundFX.draw)
- **Methods:** `draw(gameState)`, `drawFPS(ctx, fps)`
- **Verify:** Full visual rendering matches pre-refactor

### Task 1.6 — Slim Game.js to orchestrator
- **Modify:** `src/game/Game.js` — wire all subsystems
- **Depends on:** 1.1-1.5
- **Target:** ~200-250 lines
- **Remove:** `initLevel()` (dead code)
- **Verify:** Full playthrough, all features work, Game.js under 300 lines

## Phase 2: Mobile iOS Fixes

**Branch:** `phase-2/mobile-ios` | **PR target:** `main`

### Task 2.1 — Zone-based dynamic joystick
- **Rewrite:** `src/game/TouchControls.js`
- Left 50% = move zone (dynamic joystick, 105px radius)
- Right 50% = fire zone (tap anywhere, 80px radius)
- Joystick base spawns at touch-down point
- Semi-transparent zone indicators when idle
- **Verify:** Touch controls work on mobile emulation, visually larger

### Task 2.2 — Safe area CSS
- **Modify:** `style.css`
- HUD: `top: max(20px, env(safe-area-inset-top))`
- Remove body-level safe-area padding, apply to individual elements
- Dashboard: safe-area-aware padding
- **Verify:** Content below notch, dashboard respects safe areas

### Task 2.3 — Safe area in TouchControls
- **Modify:** `src/game/TouchControls.js`
- **Depends on:** 2.1
- Avoid home indicator zone, offset zone indicators
- **Verify:** Controls don't overlap home indicator

### Task 2.4 — Responsive HUD buttons (44px tap targets)
- **Modify:** `style.css`
- **Depends on:** 2.2
- Min 44x44px buttons, notch clearance for FPS counter
- **Verify:** Buttons easily tappable on iPhone

### Task 2.5 — Cache canvas coordinate mapping
- **Modify:** `src/game/TouchControls.js`, `src/game/Game.js`
- **Depends on:** 2.3
- Cache `getBoundingClientRect()` and scale factors on resize
- **Verify:** Touch accurately maps after rotation/resize

## Phase 3: Performance Optimization

**Branch:** `phase-3/performance` | **PR target:** `main`

### Task 3.1 — Mobile-aware particle and star caps
- **Modify:** `BackgroundFX.js`, `Game.js`
- Stars: 80 on mobile, 150 on desktop
- Particle cap: 200 on mobile, 300 on desktop
- Skip planet rings on mobile
- **Verify:** Reduced counts on mobile, desktop unchanged

### Task 3.2 — Collision early-exit optimizations
- **Modify:** `CollisionSystem.js`
- AABB pre-check before distance calc
- Inline `dx*dx + dy*dy` instead of `Math.sqrt` for comparisons
- **Verify:** No collision regressions, reduced frame time

### Task 3.3 — Hot-path loop and math optimizations
- **Modify:** `BackgroundFX.js`, `Game.js`
- Replace `forEach` with `for` in hot loops
- Replace `Math.hypot` with inline math where only comparing
- **Verify:** No regressions, reduced frame time

### Task 3.4 — Throttle touchmove to 60fps
- **Modify:** `TouchControls.js`
- **Depends on:** 2.5
- RAF guard on `handleMove()` to prevent excess processing on 120Hz
- **Verify:** Smooth joystick tracking, reduced handler calls

### Task 3.5 — Particle object pool
- **Modify:** `Particle.js`, `Game.js`
- Static `ParticlePool` with acquire/release pattern
- Pre-allocate 200 particles
- Swap-pop cleanup instead of filter
- **Verify:** Same visual behavior, reduced GC spikes

## Phase 4: Code Cleanup

**Branch:** `phase-4/cleanup` | **PR target:** `main`

### Task 4.1 — Remove dead code
- Remove `initLevel()`, `nebulae`, commented-out code, debug console.logs
- **Verify:** No regressions, clean grep results

### Task 4.2 — Consolidate API keys
- Move Firebase config from hardcoded AuthService.js to env vars
- Consolidate `.env`/`.env.local` to single key in `.env.local`
- **Verify:** No hardcoded API keys in source, auth still works

### Task 4.3 — Consolidate audio unlock listeners
- **Depends on:** 4.1
- Single unlock method, self-removing after first success
- **Verify:** Audio plays on first interaction

### Task 4.4 — Consolidate dashboard visibility checks
- **Depends on:** 4.1
- Replace verbose DOM checks with `dashboard.isVisible()`
- **Verify:** Game pauses/resumes correctly with dashboard

### Task 4.5 — Final polish
- **Depends on:** 4.1-4.4
- Naming consistency, unused imports, remaining console.logs
- **Verify:** Full playthrough, no warnings

## Dependency Graph

```
Phase 1: 1.1 ──┬──> 1.3 ──┬──> 1.6
         1.2 ──┤          │
         1.4 ──┤          │
         1.1 ──> 1.5 ─────┘

Phase 2: 2.1 ──> 2.3 ──> 2.5
         2.2 ──> 2.4

Phase 3: 3.1, 3.2, 3.3 (parallel)
         3.4 (after 2.5)
         3.5 (after 3.1)

Phase 4: 4.1 ──> 4.3, 4.4 ──> 4.5
         4.2 (parallel)
```
