import { Vector2 } from './Vector2.js';

export class TouchControls {
    constructor(inputHandler, width, height) {
        this.input = inputHandler;
        this.width = width;
        this.height = height;

        // Joystick (Left)
        this.joyBase = null; // {x, y}
        this.joyTouchId = null;
        this.joyStick = null; // {x, y} relative to base
        this.maxRadius = 50;

        // Fire Button (Right)
        this.fireTouchId = null;
        this.fireBtnPos = { x: width - 80, y: height - 80 };
        this.fireBtnRadius = 40;
        this.fireBtnRadius = 40;
        this.isFiring = false;

        this.active = false; // Only active during gameplay

        this.setupListeners();
    }

    setActive(isActive) {
        this.active = isActive;
        if (!isActive) {
            this.joyTouchId = null;
            this.fireTouchId = null;
            this.input.setJoystick(0, 0);
            this.input.setFire(false);
        }
    }

    setupListeners() {
        // Prevent default touch actions (scrolling/zooming)
        window.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
        window.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        window.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
    }

    handleStart(e) {
        if (!this.active) return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const x = t.clientX;
            const y = t.clientY;

            // Left side = Joystick
            if (x < this.width / 2) {
                if (this.joyTouchId === null) {
                    this.joyTouchId = t.identifier;
                    this.joyBase = { x, y };
                    this.joyStick = { x: 0, y: 0 };
                    this.updateInput();
                }
            }
            // Right side = Fire
            else {
                this.isFiring = true;
                this.fireTouchId = t.identifier;
                // Update Fire Button Position to be under finger for comfort? 
                // No, keep static for muscle memory.
                this.input.setFire(true);
            }
        }
    }

    handleMove(e) {
        if (!this.active) return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            if (t.identifier === this.joyTouchId) {
                const dx = t.clientX - this.joyBase.x;
                const dy = t.clientY - this.joyBase.y;
                const dist = Math.hypot(dx, dy);
                const angle = Math.atan2(dy, dx);

                // Clamp stick
                const clampedDist = Math.min(dist, this.maxRadius);
                this.joyStick = {
                    x: Math.cos(angle) * clampedDist,
                    y: Math.sin(angle) * clampedDist
                };

                this.updateInput();
            }
        }
    }

    handleEnd(e) {
        if (!this.active) return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            if (t.identifier === this.joyTouchId) {
                this.joyTouchId = null;
                this.joyBase = null;
                this.joyStick = null;
                this.input.setJoystick(0, 0);
            }

            if (t.identifier === this.fireTouchId) {
                this.fireTouchId = null;
                this.isFiring = false;
                this.input.setFire(false);
            }
        }
    }

    updateInput() {
        // Normalize stick to -1..1
        const nx = this.joyStick.x / this.maxRadius;
        const ny = this.joyStick.y / this.maxRadius;
        this.input.setJoystick(nx, ny);
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        this.fireBtnPos = { x: w - 80, y: h - 80 };
    }

    draw(ctx) {
        // Only draw if touch is supported or active
        // Simplest check: just always draw generic UI hints if desired, 
        // but for "Virtual Joystick" we usually show it only when active OR show static placeholders.

        // Let's draw static placeholders that light up.

        ctx.save();

        // --- Joystick Area (Left) ---
        if (this.joyBase) {
            // Dragging: Show Base and Stick
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
            ctx.lineWidth = 2;

            // Base
            ctx.beginPath();
            ctx.arc(this.joyBase.x, this.joyBase.y, this.maxRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Stick
            ctx.fillStyle = 'rgba(0, 243, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(this.joyBase.x + this.joyStick.x, this.joyBase.y + this.joyStick.y, 20, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Idle: Show faint hint area
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(80, this.height - 80, this.maxRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // --- Fire Button (Right) ---
        ctx.fillStyle = this.isFiring ? 'rgba(255, 0, 100, 0.8)' : 'rgba(255, 0, 100, 0.3)';
        ctx.beginPath();
        ctx.arc(this.fireBtnPos.x, this.fireBtnPos.y, this.fireBtnRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FIRE', this.fireBtnPos.x, this.fireBtnPos.y);

        ctx.restore();
    }
}
