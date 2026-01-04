import { Entity } from './Entity.js';
import { Vector2 } from '../Vector2.js';

export class Cow extends Entity {
    constructor(x, y, scale = 2) {
        super(x, y);
        this.scale = scale;
        this.vel = new Vector2(Math.random() * 2 - 1, Math.random() * 2 - 1);
        this.radius = 20 * scale; // Radius scales with size
        this.angle = 0;
        this.rotSpeed = (Math.random() - 0.5) * 0.05;
        this.timer = 0;
        this.mooInterval = Math.random() * 500 + 200;

        // Generate Random Spots
        this.spots = [];
        for (let i = 0; i < 5; i++) {
            this.spots.push({
                x: (Math.random() - 0.5) * 40,
                y: (Math.random() - 0.5) * 20,
                r: Math.random() * 5 + 3
            });
        }
    }

    update(width, height, audio) {
        super.update(width, height);
        this.angle += this.rotSpeed;

        // Randomly Moo
        this.timer++;
        if (this.timer > this.mooInterval) {
            // Silence is golden.
            this.timer = 0;
            this.mooInterval = Math.random() * 500 + 200;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // Scale everything up by this.scale
        const s = this.scale;

        // Draw Cow Body
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        // Body
        ctx.roundRect(-15 * s, -10 * s, 30 * s, 20 * s, 5 * s);
        ctx.fill();
        ctx.stroke();

        // Spots (Black)
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        this.spots.forEach(spot => {
            // Constrain spots to body somewhat (visual only)
            ctx.moveTo(spot.x + spot.r, spot.y);
            ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
        });
        ctx.fill();

        // Head
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(18 * s, -5 * s, 8 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(20 * s, -7 * s, 1.5 * s, 0, Math.PI * 2);
        ctx.arc(16 * s, -7 * s, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * s; // Thicker legs
        ctx.beginPath();
        ctx.moveTo(-10 * s, 10 * s); ctx.lineTo(-12 * s, 18 * s);
        ctx.moveTo(10 * s, 10 * s); ctx.lineTo(12 * s, 18 * s);
        ctx.moveTo(-10 * s, -10 * s); ctx.lineTo(-12 * s, -18 * s);
        ctx.moveTo(10 * s, -10 * s); ctx.lineTo(12 * s, -18 * s);
        ctx.stroke();

        // Udders (Pink)
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.arc(0, 10 * s, 4 * s, 0, Math.PI, false);
        ctx.fill();

        ctx.restore();
    }
}
