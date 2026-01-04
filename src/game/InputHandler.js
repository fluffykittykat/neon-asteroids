export class InputHandler {
    constructor() {
        this.keys = {};

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    isDown(code) {
        return !!this.keys[code];
    }

    // --- Virtual Input (Touch) ---
    setJoystick(x, y) {
        this.joystick = { x, y };
    }

    setFire(isFiring) {
        this.virtualFire = isFiring;
    }

    // High-level abstractions
    getRotation() {
        if (this.isDown('ArrowLeft') || this.isDown('KeyA')) return -1;
        if (this.isDown('ArrowRight') || this.isDown('KeyD')) return 1;
        // Joystick X-axis (Deadzone 0.1)
        if (this.joystick && Math.abs(this.joystick.x) > 0.1) return this.joystick.x;
        return 0;
    }

    getThrust() {
        if (this.isDown('ArrowUp') || this.isDown('KeyW')) return true;
        // Joystick Y-axis (Pushing UP means Y < 0 usually, but let's say Up on stick)
        // If joystick.y is -1 (up), we thrust
        if (this.joystick && this.joystick.y < -0.3) return true;
        return false;
    }

    getFire() {
        return this.isDown('Space') || this.isDown('Enter') || this.virtualFire;
    }
}
