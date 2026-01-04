import { Vector2 } from '../Vector2.js';

export class Entity {
    constructor(x, y) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(0, 0);
        this.acc = new Vector2(0, 0);
        this.radius = 10;
        this.angle = 0;
        this.isDead = false;
        this.color = '#fff';
        this.glowColor = '#fff';
    }

    update(width, height) {
        this.vel.add(this.acc);
        this.pos.add(this.vel);
        this.acc.mult(0); // Reset acceleration

        // Screen wrapping
        if (this.pos.x < -this.radius) this.pos.x = width + this.radius;
        if (this.pos.x > width + this.radius) this.pos.x = -this.radius;
        if (this.pos.y < -this.radius) this.pos.y = height + this.radius;
        if (this.pos.y > height + this.radius) this.pos.y = -this.radius;
    }

    applyForce(force) {
        this.acc.add(force);
    }

    draw(ctx) {
        // Override in subclasses
    }

    collidesWith(other) {
        const d = Vector2.distance(this.pos, other.pos);
        return d < this.radius + other.radius;
    }
}
