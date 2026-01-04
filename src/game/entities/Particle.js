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
        // Optimized: Removed shadowBlur for performance
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
