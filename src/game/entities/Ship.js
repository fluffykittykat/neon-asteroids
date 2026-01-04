import { Entity } from './Entity.js';
import { Vector2 } from '../Vector2.js';
import { Bullet } from './Bullet.js';
import { Particle } from './Particle.js';
import { TelemetryService } from '../TelemetryService.js';

export class Ship extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 15;
        this.angle = -Math.PI / 2; // Point up
        this.rotation = 0;
        this.isThrusting = false;
        this.color = '#00f3ff'; // Neon Blue
        this.shootCooldown = 0;
        this.invulnerable = 0;
    }

    update(width, height, input, particles, bullets, audio, stats, isDashboardBlocked) {
        // Invulnerability Tick
        if (this.invulnerable > 0) this.invulnerable--;

        // Block Input if Dashboard is open
        if (isDashboardBlocked) {
            this.isThrusting = false;
            // Don't process rotation or shooting
        }

        // Rotation (Only if not blocked)
        const rot = isDashboardBlocked ? 0 : input.getRotation();
        if (rot !== 0) {
            this.rotation = rot * 0.1; // Scale rotation speed
        } else {
            this.rotation = 0;
        }
        this.angle += this.rotation;

        // Thrust
        this.isThrusting = !isDashboardBlocked && input.getThrust();
        if (this.isThrusting) {
            try {
                if (audio && audio.thrust) audio.thrust();
            } catch (e) {
                console.error("Audio error:", e);
            }

            const force = new Vector2(Math.cos(this.angle), Math.sin(this.angle));
            force.mult(0.1); // Thrust power
            this.applyForce(force);

            // Thrust particles
            for (let i = 0; i < 2; i++) {
                const px = this.pos.x - Math.cos(this.angle) * this.radius;
                const py = this.pos.y - Math.sin(this.angle) * this.radius;
                const p = new Particle(px, py, '#ff00ff');

                // Shoot particle opposite to thrust
                const pVel = new Vector2(-Math.cos(this.angle), -Math.sin(this.angle));
                pVel.mult(Math.random() * 2 + 1);

                // Add spread
                const spread = new Vector2((Math.random() - 0.5), (Math.random() - 0.5));
                pVel.add(spread);

                p.vel = pVel;

                if (particles) particles.push(p);
            }
        }

        // Drag / Friction
        this.vel.mult(0.99);

        // Shooting
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (!isDashboardBlocked && input.getFire() && this.shootCooldown <= 0) {
            // Cannot shoot while invulnerable (optional balance choice, but let's allow it for fun)
            this.shoot(bullets, stats);
            if (audio) audio.shoot();
            this.shootCooldown = 15;
        }

        super.update(width, height);
    }

    shoot(bullets, stats) {
        const b = new Bullet(
            this.pos.x + Math.cos(this.angle) * this.radius,
            this.pos.y + Math.sin(this.angle) * this.radius,
            this.angle
        );
        bullets.push(b);
        if (stats) stats.shotsFired++;
        TelemetryService.logEvent('fire', { angle: this.angle });
    }

    draw(ctx) {
        // Blink if invulnerable (every 10 frames)
        if (this.invulnerable > 0 && Math.floor(this.invulnerable / 10) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        // Draw Shield (Optimized: No ShadowMask)
        if (this.invulnerable > 0) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();

            // Faint inner glow for shield
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        ctx.rotate(this.angle + Math.PI / 2); // Adjust for drawing angle

        // Helper to draw ship shape
        const drawShape = () => {
            ctx.beginPath();
            // Simple triangle ship
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(-this.radius * 0.7, this.radius);
            ctx.lineTo(this.radius * 0.7, this.radius);
            ctx.closePath();
            ctx.stroke();
        };

        // Layer 1: Fake Glow (Wide, Transparent)
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.3;
        drawShape();

        // Layer 2: Core (Thin, Sharp)
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0; // Ensure off
        drawShape();

        // Thrust flame
        if (this.isThrusting) {
            const drawFlame = () => {
                ctx.beginPath();
                ctx.moveTo(-this.radius * 0.4, this.radius + 2);
                ctx.lineTo(0, this.radius + 15 + Math.random() * 10);
                ctx.lineTo(this.radius * 0.4, this.radius + 2);
                ctx.stroke();
            };

            // Flame Glow
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 6;
            ctx.globalAlpha = 0.4;
            drawFlame();

            // Flame Core
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1.0;
            drawFlame();
        }

        ctx.restore();
    }
}
