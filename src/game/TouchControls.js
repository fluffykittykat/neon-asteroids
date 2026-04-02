export class TouchControls {
    constructor(inputHandler, width, height) {
        this.input = inputHandler;

        // Joystick state (left zone)
        this.joyTouchId = null;
        this.joyBase = null;   // {x, y} in canvas coords — appears where finger touches
        this.joyStick = null;  // {x, y} offset from base, clamped

        // Fire state (right zone)
        this.fireTouchId = null;
        this.firePos = null;   // {x, y} in canvas coords — feedback circle position
        this.isFiring = false;

        this.active = false;
        this._rafPending = false;

        // Cached rect/scale — updated in resize(), not per-event
        this._rect = null;
        this._scaleX = 1;
        this._scaleY = 1;

        this.resize(width, height);
        this.setupListeners();
    }

    setActive(isActive) {
        this.active = isActive;
        if (!isActive) {
            this.joyTouchId = null;
            this.joyBase = null;
            this.joyStick = null;
            this.fireTouchId = null;
            this.firePos = null;
            this.isFiring = false;
            this.input.setJoystick(0, 0);
            this.input.setFire(false);
        }
    }

    setupListeners() {
        window.addEventListener('touchstart', (e) => this._handleStart(e), { passive: false });
        window.addEventListener('touchmove', (e) => this._handleMove(e), { passive: false });
        window.addEventListener('touchend', (e) => this._handleEnd(e), { passive: false });
        window.addEventListener('touchcancel', (e) => this._handleEnd(e), { passive: false });

        // Re-cache rect on resize/scroll
        window.addEventListener('resize', () => this._cacheRect());
        window.addEventListener('scroll', () => this._cacheRect(), { passive: true });
    }

    // --- Touch handlers ---------------------------------------------------

    _handleStart(e) {
        if (!this.active) return;
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const { cx, cy } = this._toCanvas(t);

            if (t.clientX < window.innerWidth / 2) {
                // Left half — joystick
                if (this.joyTouchId === null) {
                    this.joyTouchId = t.identifier;
                    this.joyBase = { x: cx, y: cy };
                    this.joyStick = { x: 0, y: 0 };
                    this.updateInput();
                }
            } else {
                // Right half — fire
                this.fireTouchId = t.identifier;
                this.firePos = { x: cx, y: cy };
                this.isFiring = true;
                this.input.setFire(true);
            }
        }
    }

    _handleMove(e) {
        if (!this.active) return;
        e.preventDefault();

        if (this._rafPending) return;
        this._rafPending = true;

        // Capture touch data now — e.changedTouches may not survive past the event handler
        const touchData = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            touchData.push({ clientX: t.clientX, clientY: t.clientY, identifier: t.identifier });
        }

        requestAnimationFrame(() => {
            this._rafPending = false;
            for (let i = 0; i < touchData.length; i++) {
                const t = touchData[i];

                if (t.identifier === this.joyTouchId && this.joyBase) {
                    const { cx, cy } = this._toCanvas(t);
                    const dx = cx - this.joyBase.x;
                    const dy = cy - this.joyBase.y;
                    const dist = Math.hypot(dx, dy);
                    const clamped = Math.min(dist, this.maxRadius);
                    const angle = Math.atan2(dy, dx);

                    this.joyStick = {
                        x: Math.cos(angle) * clamped,
                        y: Math.sin(angle) * clamped
                    };
                    this.updateInput();
                }

                if (t.identifier === this.fireTouchId) {
                    const { cx, cy } = this._toCanvas(t);
                    this.firePos = { x: cx, y: cy };
                }
            }
        });
    }

    _handleEnd(e) {
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
                this.firePos = null;
                this.isFiring = false;
                this.input.setFire(false);
            }
        }
    }

    // --- Coordinate helpers -----------------------------------------------

    _toCanvas(touch) {
        return {
            cx: (touch.clientX - this._rect.left) * this._scaleX,
            cy: (touch.clientY - this._rect.top) * this._scaleY
        };
    }

    _cacheRect() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        this._rect = rect;
        this._scaleX = canvas.width / rect.width;
        this._scaleY = canvas.height / rect.height;
    }

    // --- Input normalization ----------------------------------------------

    updateInput() {
        if (!this.joyStick) return;
        const nx = this.joyStick.x / this.maxRadius;
        const ny = this.joyStick.y / this.maxRadius;
        this.input.setJoystick(nx, ny);
    }

    // --- Resize -----------------------------------------------------------

    resize(w, h) {
        this.width = w;
        this.height = h;

        // uiScale: canvas pixels per CSS pixel
        const uiScale = w / window.innerWidth;
        this.uiScale = uiScale;

        // 50% larger sizes
        this.maxRadius = 105 * uiScale;
        this.knobRadius = 42 * uiScale;
        this.fireFeedbackRadius = 80 * uiScale;

        // Re-cache rect & scale
        this._cacheRect();
    }

    // --- Drawing ----------------------------------------------------------

    draw(ctx) {
        ctx.save();

        // ---- LEFT ZONE: Move ----
        if (this.joyBase && this.joyStick) {
            // Active joystick
            // Base circle
            ctx.beginPath();
            ctx.arc(this.joyBase.x, this.joyBase.y, this.maxRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 243, 255, 0.12)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Knob
            ctx.beginPath();
            ctx.arc(
                this.joyBase.x + this.joyStick.x,
                this.joyBase.y + this.joyStick.y,
                this.knobRadius, 0, Math.PI * 2
            );
            ctx.fillStyle = 'rgba(0, 243, 255, 0.8)';
            ctx.fill();
        }

        // ---- RIGHT ZONE: Fire ----
        if (this.isFiring && this.firePos) {
            // Feedback circle at touch point
            ctx.beginPath();
            ctx.arc(this.firePos.x, this.firePos.y, this.fireFeedbackRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 100, 0.25)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 0, 100, 0.6)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.restore();
    }

}
