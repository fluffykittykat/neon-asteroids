import { Vector2 } from './Vector2.js';

export class TouchControls {
    constructor(inputHandler, width, height) {
        this.input = inputHandler;
        this.resize(width, height);

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

        // Calculate Scale Factor (Canvas Pixels per Window Pixel)
        // We assume the canvas fills the window visually.
        const rect = e.target.getBoundingClientRect();
        const scaleX = e.target.width / rect.width;
        const scaleY = e.target.height / rect.height;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            // Map Touch to Canvas Coordinates
            const x = (t.clientX - rect.left) * scaleX;
            const y = (t.clientY - rect.top) * scaleY;

            // Logic: Left half of SCREEN (not canvas) is joystick
            // t.clientX is screen coordinate
            if (t.clientX < window.innerWidth / 2) {
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
                // Update Fire Button Position to be under finger?
                // For now, let's just trigger fire.
                this.input.setFire(true);
            }
        }
    }

    handleMove(e) {
        if (!this.active) return;
        e.preventDefault();

        const rect = e.target.getBoundingClientRect();
        const scaleX = e.target.width / rect.width;
        const scaleY = e.target.height / rect.height;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            if (t.identifier === this.joyTouchId) {
                const x = (t.clientX - rect.left) * scaleX;
                const y = (t.clientY - rect.top) * scaleY;

                const dx = x - this.joyBase.x;
                const dy = y - this.joyBase.y;
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

        // Dynamic UI Scaling
        // If the game resolution is much larger than the screen (e.g. on mobile with virtual resolution),
        // we need to scale up the UI elements so they remain physically touchable.
        const uiScale = w / window.innerWidth;

        this.maxRadius = 50 * uiScale;
        this.fireBtnRadius = 40 * uiScale;

        this.margin = 80 * uiScale;

        this.fireBtnPos = { x: this.width - this.margin, y: this.height - this.margin };
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
            ctx.arc(this.joyBase.x + this.joyStick.x, this.joyBase.y + this.joyStick.y, 20 * (this.maxRadius / 50), 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Idle: Show faint hint area
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.margin, this.height - this.margin, this.maxRadius, 0, Math.PI * 2);
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
