import { Particle } from './entities/Particle.js';

export class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
    }

    draw(gameState) {
        const { ctx, width, height, shake, state, bullets, particles, asteroids, ship, cow, alien, touchControls, backgroundFX } = gameState;

        // Clear with trail effect
        ctx.fillStyle = 'rgba(5, 5, 16, 0.4)'; // 0.4 alpha for trails
        ctx.fillRect(0, 0, width, height);

        ctx.save();

        // Apply Camera Shake
        if (shake > 0) {
            const dx = (Math.random() - 0.5) * shake;
            const dy = (Math.random() - 0.5) * shake;
            ctx.translate(dx, dy);
        }

        // Draw background (grid, stars, planets)
        backgroundFX.draw(ctx);

        // Additive Blending for NEON GLOW
        ctx.globalCompositeOperation = 'lighter';

        if (state === 'PLAYING' || state === 'GAMEOVER') {
            bullets.forEach(b => b.draw(ctx));
            Particle.batchDraw(particles, ctx);
            asteroids.forEach(a => a.draw(ctx));
            if (ship && !ship.isDead) ship.draw(ctx);
            if (cow) cow.draw(ctx);
            if (alien) alien.draw(ctx);
            // Draw Touch Controls on top
            if (touchControls) touchControls.draw(ctx);
        }

        ctx.restore();
    }

    drawFPS(ctx, fps) {
        ctx.save();
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px monospace';
        ctx.fillText(`FPS: ${fps || 0} `, 10, 20);
        ctx.restore();
    }
}
