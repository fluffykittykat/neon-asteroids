import { Entity } from './Entity.js';
import { Vector2 } from '../Vector2.js';

export class Asteroid extends Entity {
    constructor(x, y, radius) {
        super(x, y);
        this.radius = radius || 40;
        this.vel = new Vector2((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);

        // Random Neon Colors
        const colors = ['#ff00ff', '#00ff00', '#ffff00', '#ff0055'];
        this.color = colors[Math.floor(Math.random() * colors.length)];

        // Create random vertex offsets for jagged look
        this.totalPoints = Math.floor(Math.random() * 5 + 7);
        this.offsets = [];
        for (let i = 0; i < this.totalPoints; i++) {
            this.offsets.push((Math.random() * this.radius * 0.4) - (this.radius * 0.2));
        }
    }

    draw(ctx) {
        ctx.save();
        // ctx.shadowBlur = 15; // Removed for performance
        // ctx.shadowColor = this.color;
        ctx.strokeStyle = '#ffffff'; // White outline
        ctx.lineWidth = 2;
        ctx.fillStyle = this.color + '33'; // Semi-transparent fill (hex alpha 33)

        ctx.translate(this.pos.x, this.pos.y);

        ctx.beginPath();
        for (let i = 0; i < this.totalPoints; i++) {
            const angle = map(i, 0, this.totalPoints, 0, Math.PI * 2);
            const r = this.radius + this.offsets[i];
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    update(width, height) {
        // Friction: Return to normal speed logic
        // If moving faster than base speed (approx 4), slow down
        const currentSpeed = this.vel.mag();
        const maxNormalSpeed = 2; // Base speed seems to be around 2-3

        if (currentSpeed > maxNormalSpeed) {
            this.vel.mult(0.98); // Decay "excess energy"
        }

        this.pos.add(this.vel);

        // Screen Wrapping
        if (this.pos.x < -this.radius) this.pos.x = width + this.radius;
        if (this.pos.x > width + this.radius) this.pos.x = -this.radius;
        if (this.pos.y < -this.radius) this.pos.y = height + this.radius;
        if (this.pos.y > height + this.radius) this.pos.y = -this.radius;
    }

    break() {
        const newPieces = [];
        if (this.radius > 20) {
            const count = 2; // Always split into 2
            for (let i = 0; i < count; i++) {
                const a = new Asteroid(this.pos.x, this.pos.y, this.radius / 2);
                a.vel = this.vel.copy().add(new Vector2((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5));
                newPieces.push(a);
            }
        }
        return newPieces;
    }
}

function map(n, start1, stop1, start2, stop2) {
    return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}
