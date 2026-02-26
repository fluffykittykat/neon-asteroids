import { Entity } from './Entity.js';
import { Vector2 } from '../Vector2.js';

export class Particle extends Entity {
    constructor(x, y, color) {
        super(x, y);
        this.color = color || '#ff00ff';
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        this.vel = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.015;
        this.radius = Math.random() * 3 + 1;
        this._customDraw = false; // Flag for particles with overridden draw (e.g. mini-cows)
    }

    update(width, height) {
        this.pos.add(this.vel);
        this.life -= this.decay;
        this.radius *= 0.95; // Shrink
        if (this.life <= 0) {
            this.isDead = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Batch-render all particles with minimal state changes.
     * Custom-draw particles (e.g. mini-cows) fall back to individual draw().
     */
    static batchDraw(particles, ctx) {
        const groups = {};
        const custom = [];

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p._customDraw) {
                custom.push(p);
                continue;
            }
            if (!groups[p.color]) groups[p.color] = [];
            groups[p.color].push(p);
        }

        // Batch draw by color group
        ctx.save();
        for (const color in groups) {
            const group = groups[color];
            ctx.fillStyle = color;
            for (let i = 0; i < group.length; i++) {
                const p = group[i];
                ctx.globalAlpha = p.life;
                ctx.beginPath();
                ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();

        // Draw custom particles individually
        for (let i = 0; i < custom.length; i++) {
            custom[i].draw(ctx);
        }
    }
}
