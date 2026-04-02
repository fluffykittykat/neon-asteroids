import { Vector2 } from './Vector2.js';

export class BackgroundFX {
    constructor(width, height, config = {}) {
        this.width = width;
        this.height = height;
        this.isMobile = config.isMobile || false;

        this.gridOffset = new Vector2(0, 0);
        this.stars = [];
        this.planets = [];
        this.ripples = [];

        // Generate Starfield
        const starCount = this.isMobile ? 80 : 150;
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.5 + 0.1
            });
        }

        // Generate Distant Planets
        this.generatePlanets();
    }

    generatePlanets() {
        this.planets = [];
        const count = 3;
        for (let i = 0; i < count; i++) {
            const depth = Math.random() * 0.15 + 0.05;
            this.planets.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: (Math.random() * 60 + 40) * depth * 4,
                color: `hsl(${Math.random() * 360}, 40%, 30%)`,
                hasRings: Math.random() > 0.5,
                depth: depth,
                speed: depth
            });
        }
    }

    createRipple(pos, maxRadius, amplitude, audio) {
        this.ripples.push({
            x: pos.x,
            y: pos.y,
            radius: 10,
            maxRadius: maxRadius,
            amplitude: amplitude,
            speed: 10,
            width: 100
        });
        audio.ripple();
    }

    getDistortion(x, y) {
        let dx = 0;
        let dy = 0;

        for (const r of this.ripples) {
            const dist = Math.hypot(x - r.x, y - r.y);
            const delta = dist - r.radius;
            if (Math.abs(delta) < r.width) {
                const force = Math.cos(delta / r.width * Math.PI / 2) * r.amplitude;
                const angle = Math.atan2(y - r.y, x - r.x);
                dx += Math.cos(angle) * force;
                dy += Math.sin(angle) * force;
            }
        }
        return { dx, dy };
    }

    /**
     * Update background elements: star/planet parallax, ripple physics.
     * @param {number} dt - Delta time
     * @param {object|null} ship - Ship object (needs vel, isDead)
     * @param {Array} asteroids - Asteroids array for ripple push physics
     * @param {string} state - Game state ('PLAYING', 'START', 'GAMEOVER')
     */
    update(dt, ship, asteroids, state) {
        const driftY = 4.0;

        // Update grid offset for parallax
        if (ship && !ship.isDead) {
            this.gridOffset.x -= ship.vel.x * 0.5;
            this.gridOffset.y -= ship.vel.y * 0.5;
        }

        // Helper for parallax wrapping
        const updateBg = (el, speedMult) => {
            el.y += driftY * speedMult;

            if (ship && !ship.isDead) {
                el.x -= ship.vel.x * speedMult;
                el.y -= ship.vel.y * speedMult;
            }

            // Wrap
            if (el.x < -200) el.x += this.width + 400;
            if (el.x > this.width + 200) el.x -= this.width + 400;
            if (el.y < -200) el.y += this.height + 400;
            if (el.y > this.height + 200) el.y -= this.height + 400;
        };

        for (let i = 0; i < this.stars.length; i++) { const s = this.stars[i]; updateBg(s, s.speed); }
        for (let i = 0; i < this.planets.length; i++) { const p = this.planets[i]; updateBg(p, p.speed); }

        // Update Ripples
        for (let i = 0; i < this.ripples.length; i++) {
            const r = this.ripples[i];
            r.radius += r.speed;
            r.amplitude *= 0.95;

            // Physics: Push Asteroids
            if (state === 'PLAYING') {
                for (const a of asteroids) {
                    const dist = Math.hypot(r.x - a.pos.x, r.y - a.pos.y);
                    if (Math.abs(dist - r.radius) < r.width) {
                        const angle = Math.atan2(a.pos.y - r.y, a.pos.x - r.x);
                        const waveIntensity = Math.cos((dist - r.radius) / r.width * Math.PI / 2);
                        const forceMag = r.amplitude * 0.002 * waveIntensity;

                        a.vel.x += Math.cos(angle) * forceMag;
                        a.vel.y += Math.sin(angle) * forceMag;
                    }
                }
            }
        }
        const maxDim = Math.max(this.width, this.height);
        this.ripples = this.ripples.filter(r => r.amplitude >= 0.1 && r.radius <= maxDim);
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 0;

        // 1. Planets (Deep Background Layer)
        this.planets.forEach(p => {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // Rings
            if (p.hasRings && !this.isMobile) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.1;
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.radius * 2, p.radius * 0.5, -0.4, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        // 2. Stars (Middle Layer) - BATCHED RENDERING
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();

        // Reusable variables for inline distortion (no allocation)
        let dx = 0, dy = 0, dist = 0, delta = 0, force = 0, angle = 0;

        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];

            // Inline Distortion Logic (No allocation)
            dx = 0; dy = 0;
            if (this.ripples.length > 0) {
                for (let j = 0; j < this.ripples.length; j++) {
                    const r = this.ripples[j];
                    dist = Math.sqrt((star.x - r.x) ** 2 + (star.y - r.y) ** 2);
                    delta = dist - r.radius;
                    if (Math.abs(delta) < r.width) {
                        force = Math.cos(delta / r.width * Math.PI / 2) * r.amplitude;
                        angle = Math.atan2(star.y - r.y, star.x - r.x);
                        dx += Math.cos(angle) * force;
                        dy += Math.sin(angle) * force;
                    }
                }
            }

            ctx.moveTo(star.x + dx, star.y + dy);
            ctx.arc(star.x + dx, star.y + dy, star.size, 0, Math.PI * 2);
        }
        ctx.fill(); // ONE DRAW CALL

        ctx.restore();
    }

    resize(oldW, oldH, newW, newH) {
        this.width = newW;
        this.height = newH;

        // Rescale stars to new dimensions
        if (this.stars.length > 0 && oldW > 0 && oldH > 0) {
            const scaleX = newW / oldW;
            const scaleY = newH / oldH;
            for (let i = 0; i < this.stars.length; i++) {
                this.stars[i].x *= scaleX;
                this.stars[i].y *= scaleY;
            }
        }

        // Regenerate planets for new viewport
        this.generatePlanets();
    }
}
