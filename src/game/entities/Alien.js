
import { Entity } from './Entity.js';
import { Vector2 } from '../Vector2.js';
import { Bullet } from './Bullet.js';

export class Alien extends Entity {
    constructor(width, height) {
        // Spawn on random edge
        let x, y;
        if (Math.random() > 0.5) {
            x = Math.random() > 0.5 ? -30 : width + 30;
            y = Math.random() * height;
        } else {
            x = Math.random() * width;
            y = Math.random() > 0.5 ? -30 : height + 30;
        }

        super(x, y);
        this.width = width;
        this.height = height;
        this.radius = 40;

        // Random velocity vector
        this.vel = new Vector2(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4
        );

        // Ensure it moves somewhat onto screen
        if (x < 0 && this.vel.x < 0) this.vel.x *= -1;
        if (x > width && this.vel.x > 0) this.vel.x *= -1;
        if (y < 0 && this.vel.y < 0) this.vel.y *= -1;
        if (y > height && this.vel.y > 0) this.vel.y *= -1;

        this.shootTimer = 0;
        this.shootInterval = 120; // 2 seconds at 60fps
        this.angle = 0;

        // Smooth movement parameters
        this.time = 0; // Initialize time for wave calculations
        this.baseVelX = this.vel.x; // Store base direction
        this.baseVelY = this.vel.y;
        this.randomizeWavePattern(); // Set initial wave parameters
    }

    update(width, height, ship, asteroids, bullets, audio, onShoot) {
        // SMOOTH CURVED MOVEMENT using sine waves
        // This creates swooping, organic flight patterns

        // Increment time for wave calculations
        this.time = (this.time || 0) + 0.02;

        // Base velocity with sine wave modulation for curves
        const waveX = Math.sin(this.time * this.waveFreqX) * this.waveAmpX;
        const waveY = Math.cos(this.time * this.waveFreqY) * this.waveAmpY;

        // Apply curved motion to base direction
        this.vel.x = this.baseVelX + waveX;
        this.vel.y = this.baseVelY + waveY;

        this.pos.add(this.vel);

        // Screen Boundaries: Bounce and change pattern
        if (this.pos.x < 0 && this.vel.x < 0) {
            this.baseVelX = Math.abs(this.baseVelX);
            this.randomizeWavePattern();
        }
        if (this.pos.x > width && this.vel.x > 0) {
            this.baseVelX = -Math.abs(this.baseVelX);
            this.randomizeWavePattern();
        }
        if (this.pos.y < 0 && this.vel.y < 0) {
            this.baseVelY = Math.abs(this.baseVelY);
            this.randomizeWavePattern();
        }
        if (this.pos.y > height && this.vel.y > 0) {
            this.baseVelY = -Math.abs(this.baseVelY);
            this.randomizeWavePattern();
        }

        // Occasionally change the wave pattern for variety (smooth transition)
        if (Math.random() < 0.003) { // ~0.3% chance per frame
            this.randomizeWavePattern();
        }

        // Shooting Logic
        this.shootTimer++;
        if (this.shootTimer > this.shootInterval && ship && !ship.isDead) {
            this.tryShoot(ship, asteroids, bullets, audio, onShoot);
        }

        // Rotate visual (smooth wobble)
        this.angle += 0.03;
    }

    randomizeWavePattern() {
        // Change wave parameters for new flight pattern
        // Frequencies control how tight the curves are
        this.waveFreqX = 0.5 + Math.random() * 1.5; // 0.5 to 2.0
        this.waveFreqY = 0.5 + Math.random() * 1.5;

        // Amplitudes control how wide the swoops are
        this.waveAmpX = 1 + Math.random() * 2; // 1 to 3
        this.waveAmpY = 1 + Math.random() * 2;

        // Occasionally change base direction slightly
        if (Math.random() < 0.3) {
            this.baseVelX += (Math.random() - 0.5) * 1;
            this.baseVelY += (Math.random() - 0.5) * 1;

            // Clamp base velocity
            this.baseVelX = Math.max(-2, Math.min(2, this.baseVelX));
            this.baseVelY = Math.max(-2, Math.min(2, this.baseVelY));
        }
    }

    tryShoot(ship, asteroids, bullets, audio, onShoot) {
        // Blind Fire - No Raycasting (Performance)
        const toShipX = ship.pos.x - this.pos.x;
        const toShipY = ship.pos.y - this.pos.y;

        // Normalize direction
        const dist = Math.sqrt(toShipX * toShipX + toShipY * toShipY);
        if (dist === 0) return; // Prevent divide by zero

        const dirX = toShipX / dist;
        const dirY = toShipY / dist;

        // FIRE!
        // Accuracy Scatter: 50% to 100% accurate meant "sometimes misses".
        // We implement this as a random angular jitter.
        const baseAngle = Math.atan2(dirY, dirX);
        const accuracy = 0.5 + Math.random() * 0.5; // 0.5 (bad) to 1.0 (perfect)
        // Max scatter: +/- 20 degrees (approx 0.35 rad). Less accuracy = More scatter.
        const scatter = (1 - accuracy) * 0.5 * (Math.random() < 0.5 ? -1 : 1);

        const finalAngle = baseAngle + scatter;

        const bullet = new Bullet(this.pos.x, this.pos.y, finalAngle);
        bullet.isHostile = true;
        bullet.color = '#ff00ff';
        bullet.glowColor = '#00ff00';
        bullet.speed = 6;
        bullet.life = 200; // Match player range
        // Recalculate velocity with new angle and speed
        bullet.vel = new Vector2(Math.cos(finalAngle) * 6, Math.sin(finalAngle) * 6);
        bullets.push(bullet);

        if (audio) audio.alienShoot();
        if (onShoot) onShoot();

        this.shootTimer = 0;
        this.shootInterval = 100 + Math.random() * 100;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        // Saucer wobble
        ctx.rotate(Math.sin(this.angle) * 0.2);

        // Draw Saucer (No Shadows for Performance)
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        // ctx.shadowBlur = 0; // Removed expensive shadow

        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Dome
        ctx.beginPath();
        ctx.arc(0, -this.radius * 0.25, this.radius * 0.5, Math.PI, 0);
        ctx.stroke();

        // Lights
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        const r = this.radius;
        const offset = r * 0.6;
        ctx.arc(-offset, 0, 3, 0, Math.PI * 2);
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.arc(offset, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
