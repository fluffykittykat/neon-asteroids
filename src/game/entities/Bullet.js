import { Entity } from './Entity.js';
import { Vector2 } from '../Vector2.js';

export class Bullet extends Entity {
    constructor(x, y, angle) {
        super(x, y);
        this.radius = 6; // Bigger hit box
        this.angle = angle;
        this.speed = 12;
        this.vel = new Vector2(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
        this.color = '#ffffff'; // Core is white
        this.glowColor = '#ff0033'; // Glow is Neon Red
        this.life = 100; // Increased range (was 50)
    }

    update(width, height) {
        this.pos.add(this.vel);

        // Bullets die if they go off screen (or wrap, depending on design choice. Let's wrap but have a lifetime)
        // Actually, Asteroids bullets usually wrap, but have a short range.
        if (this.pos.x < 0) this.pos.x = width;
        if (this.pos.x > width) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = height;
        if (this.pos.y > height) this.pos.y = 0;

        this.life--;
        if (this.life <= 0) {
            this.isDead = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // Efficient Glow (Fake it with layers instead of expensive shadowBlur)
        // Layer 1: Wide faint glow
        ctx.fillStyle = this.glowColor;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(-30, -8, 60, 16);

        // Layer 2: Core glow
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-28, -5, 56, 10);

        // Layer 3: The Beam (Solid)
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-25, -4, 50, 8, 4);
        ctx.fill();

        // Layer 4: Intense Core
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-20, -1, 40, 2);

        ctx.restore();
    }
}
