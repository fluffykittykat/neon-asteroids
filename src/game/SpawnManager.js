import { Asteroid } from './entities/Asteroid.js';
import { Cow } from './entities/Cow.js';
import { Alien } from './entities/Alien.js';

export class SpawnManager {
    constructor() {
        // Stateless manager — no instance state needed
    }

    spawnAsteroids(count, asteroids, width, height) {
        for (let i = 0; i < count; i++) {
            let x, y;
            // Spawn away from center to avoid instant death
            do {
                x = Math.random() * width;
                y = Math.random() * height;
            } while (Math.hypot(x - width / 2, y - height / 2) < 200);

            asteroids.push(new Asteroid(x, y));
        }
    }

    updateCow(cow, width, height, audio) {
        if (cow) {
            cow.update(width, height, audio);
            return cow;
        } else if (Math.random() < 0.002) { // 0.2% chance per frame to spawn
            return new Cow(
                Math.random() > 0.5 ? 0 : width,
                Math.random() * height
            );
        }
        return null;
    }

    updateAlien(alien, width, height, ship, asteroids, bullets, audio, stats, state, onFire) {
        if (alien) {
            alien.update(width, height, ship, asteroids, bullets, audio, onFire);
            if (alien.isDead) return null;
            return alien;
        } else if (state === 'PLAYING' && Math.random() < 0.001) { // 0.1% chance to spawn alien
            stats.aliensSpawned++;
            return new Alien(width, height);
        }
        return null;
    }

    maintainDensity(asteroids, level, width, height) {
        const targetCount = 10 + level * 3;

        if (asteroids.length < targetCount && Math.random() < 0.02) { // 2% chance per frame to spawn if low
            this.spawnAsteroids(1, asteroids, width, height);
        }
    }
}
