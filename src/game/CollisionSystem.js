import { Vector2 } from './Vector2.js';
import { TelemetryService } from './TelemetryService.js';

export class CollisionSystem {
    constructor() {
        // Stateless — no instance state needed
    }

    /**
     * Main collision detection pass.
     *
     * @param {Object} params
     * @param {Object} params.ship
     * @param {Array}  params.bullets
     * @param {Array}  params.asteroids
     * @param {Object|null} params.alien
     * @param {Object|null} params.cow
     * @param {Object} params.stats  — mutated in-place (hits, closeCalls, etc.)
     * @param {Object} params.callbacks
     *   onPlayerHit, onAlienKilled(alien), onAsteroidHit(asteroid, index, points),
     *   onCowKilled(cow), createExplosion(pos, color, count),
     *   createRipple(pos, maxRadius, amplitude), updateUI, audio
     */
    checkCollisions({ ship, bullets, asteroids, alien, cow, stats, callbacks }) {
        const {
            onPlayerHit,
            onAlienKilled,
            onAsteroidHit,
            onCowKilled,
            createExplosion,
            createRipple,
            updateUI,
            audio,
        } = callbacks;

        // Collision Detection
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];

            // 1. HOSTILE BULLET vs SHIP
            if (b.isHostile) {
                if (ship && !ship.isDead && !ship.isInvulnerable) {
                    const dist = Vector2.distance(b.pos, ship.pos);
                    if (dist < ship.radius + b.radius) {
                        onPlayerHit();
                        stats.alienHitsTaken++;
                        TelemetryService.logEvent('damage', { source: 'alien' });
                        b.isDead = true;
                    }
                }
                continue; // Hostile bullets don't hit asteroids
            }

            // 2. FRIENDLY BULLET vs ALIEN
            if (alien && !b.isHostile) {
                const dist = Vector2.distance(b.pos, alien.pos);
                if (dist < alien.radius + b.radius) {
                    // Alien Killed
                    createExplosion(alien.pos, '#00ff00', 100);
                    // RIPPLE EFFECT ADDED
                    createRipple(alien.pos, 300, 50);

                    audio.explode('#00ff00', 30);
                    stats.aliensKilled++;
                    TelemetryService.logEvent('kill', { target: 'alien' });
                    onAlienKilled(alien);
                    b.isDead = true;
                    updateUI();
                    continue;
                }
            }

            // 3. FRIENDLY BULLET vs ASTEROIDS
            for (let j = asteroids.length - 1; j >= 0; j--) {
                const a = asteroids[j];
                if (a.collidesWith(b)) {
                    // Classify Size
                    let sizeCat = 'Small';
                    if (a.radius > 30) sizeCat = 'Large';
                    else if (a.radius > 15) sizeCat = 'Medium';

                    TelemetryService.logEvent('hit', {
                        targetType: 'asteroid',
                        size: sizeCat,
                        radius: Math.round(a.radius),
                        color: a.color
                    });

                    // Track color and size stats
                    stats.asteroidColorMap = stats.asteroidColorMap || {};
                    stats.asteroidColorMap[a.color] = (stats.asteroidColorMap[a.color] || 0) + 1;

                    stats.asteroidSizeMap = stats.asteroidSizeMap || { Small: 0, Medium: 0, Large: 0 };
                    stats.asteroidSizeMap[sizeCat]++;

                    stats.hits++;

                    b.isDead = true;

                    const pts = this._calculateScore(a);

                    // MEGA EXPLOSION for Bullet Impact
                    const distToShip = ship ? Vector2.distance(ship.pos, a.pos) : 1000;
                    // Amplitude: Base 200, scale by size, boosted by proximity (closer = stronger)
                    // Proximity factor: 1.0 at 1000px, 3.0 at 0px
                    const proximity = 1 + (1000 - Math.min(distToShip, 1000)) / 500;
                    const rippleAmp = (a.radius * 2) * proximity;

                    createExplosion(a.pos, a.color, 150);
                    createRipple(a.pos, rippleAmp, 30);
                    audio.explode(a.color, a.radius);

                    onAsteroidHit(a, j, pts);

                    break;
                }
            }

            if (b.isDead) continue; // Skip cow check if bullet hit asteroid

            // Bullet vs Cow
            if (cow && Vector2.distance(b.pos, cow.pos) < cow.radius + 10) {
                b.isDead = true;

                // OPERATION SPILLED MILK
                createExplosion(cow.pos, '#ffffff', 300); // MASSIVE MILK STORM
                createRipple(cow.pos, 800, 80); // Huge space distortion

                audio.explode('cow', 100);
                audio.ripple();

                onCowKilled(cow);
            }
        }

        // Check Close Calls (Ship vs Asteroids) - Independent of bullets
        if (ship && !ship.isDead && !ship.isInvulnerable) { // Only check if vulnerable
            for (let i = 0; i < asteroids.length; i++) { const a = asteroids[i];
                const dx = ship.pos.x - a.pos.x;
                const dy = ship.pos.y - a.pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const safeDist = a.radius + ship.radius + 40; // 40px margin
                const dangerDist = a.radius + ship.radius + 5;

                if (dist < safeDist && dist > dangerDist) {
                    // Debounce close calls
                    if (!a.hadCloseCall) {
                        stats.closeCalls++;
                        TelemetryService.logEvent('close_call', { dist: Math.round(dist) });
                        a.hadCloseCall = true; // Flag to prevent spamming close call on same asteroid
                    }
                }
            }

            // Ship vs Asteroid (Actual Collision)
            for (const a of asteroids) {
                if (a.collidesWith(ship)) {
                    onPlayerHit();
                    return;
                }
            }
        }
    }

    /**
     * Elastic bounce physics between asteroids. Modifies positions/velocities in-place.
     * @param {Array} asteroids
     */
    checkAsteroidCollisions(asteroids) {
        for (let i = 0; i < asteroids.length; i++) {
            const a1 = asteroids[i];
            for (let j = i + 1; j < asteroids.length; j++) {
                const a2 = asteroids[j];

                const dx = a2.pos.x - a1.pos.x;
                const dy = a2.pos.y - a1.pos.y;
                const minDist = a1.radius + a2.radius;
                if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) continue;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < minDist) {
                    // 1. Resolve Overlap (Push apart)
                    const overlap = minDist - dist;

                    // Avoid div by zero
                    if (dist === 0) continue;

                    const nx = dx / dist;
                    const ny = dy / dist;

                    // Move apart proportional to inverse mass (radius for now)
                    // Simplified: move equally
                    const moveX = nx * overlap * 0.5;
                    const moveY = ny * overlap * 0.5;

                    a1.pos.x -= moveX;
                    a1.pos.y -= moveY;
                    a2.pos.x += moveX;
                    a2.pos.y += moveY;

                    // 2. Elastic Bounce
                    // v1' = v1 - 2*m2/(m1+m2) * dot(v1-v2, n) * n
                    // Assuming Mass ~ radius^2 (Area)
                    const m1 = a1.radius * a1.radius;
                    const m2 = a2.radius * a2.radius;

                    // Relative velocity
                    const dvx = a1.vel.x - a2.vel.x;
                    const dvy = a1.vel.y - a2.vel.y;

                    const dotProduct = dvx * nx + dvy * ny;

                    // Conservation Impulse
                    const imp = (2 * dotProduct) / (m1 + m2);

                    // Apply impulse
                    a1.vel.x -= imp * m2 * nx;
                    a1.vel.y -= imp * m2 * ny;
                    a2.vel.x += imp * m1 * nx;
                    a2.vel.y += imp * m1 * ny;
                }
            }
        }
    }

    /**
     * Remove asteroid at index via swap-and-pop, break it, return new pieces.
     * @param {Object} asteroid
     * @param {number} index
     * @param {Array} asteroids
     * @returns {Array} new asteroid pieces from asteroid.break()
     */
    breakAsteroid(asteroid, index, asteroids) {
        // Swap-and-pop: O(1) removal instead of O(n) splice
        asteroids[index] = asteroids[asteroids.length - 1];
        asteroids.pop();
        return asteroid.break();
    }

    /**
     * Calculate score for destroying an asteroid based on size and color.
     * @param {Object} asteroid
     * @returns {number} point value
     * @private
     */
    _calculateScore(asteroid) {
        // Base score by size (smaller = harder to hit = more points)
        let basePoints = 150; // Small (hardest) - high reward
        if (asteroid.radius > 30) basePoints = 25; // Large (easy target)
        else if (asteroid.radius > 15) basePoints = 50; // Medium

        // Size multiplier for extra differentiation
        // Tiny asteroids (radius < 8) get bonus
        let sizeMultiplier = 1.0;
        if (asteroid.radius < 8) sizeMultiplier = 1.5; // Tiny bonus
        else if (asteroid.radius < 12) sizeMultiplier = 1.2; // Very small bonus

        // Color multiplier (Rarer colors = more points)
        let colorMultiplier = 1.0;
        const colorLower = (asteroid.color || '').toLowerCase();
        if (colorLower.includes('ff00ff') || colorLower.includes('magenta') || colorLower.includes('pink')) {
            colorMultiplier = 2.0; // Magenta/Pink - RARE
        } else if (colorLower.includes('00ffff') || colorLower.includes('cyan')) {
            colorMultiplier = 1.8; // Cyan - Uncommon
        } else if (colorLower.includes('ffff00') || colorLower.includes('yellow')) {
            colorMultiplier = 1.5; // Yellow - Medium
        } else if (colorLower.includes('00ff00') || colorLower.includes('green')) {
            colorMultiplier = 1.2; // Green - Common+
        } else if (colorLower.includes('ff0000') || colorLower.includes('red')) {
            colorMultiplier = 1.3; // Red - Medium
        }
        // Default (other colors) = 1.0

        return Math.round(basePoints * sizeMultiplier * colorMultiplier);
    }
}
