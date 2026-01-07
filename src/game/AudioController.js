export class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Default volume
        this.masterGain.connect(this.ctx.destination);
        this.enabled = true;
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        // Force iOS Unlock with Silent Buffer
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
    }

    playTone(freq, type, duration, vol = 1) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    shoot() {
        // Pew pew! Upgrade: Dual oscillator "Laser" chirp
        if (!this.enabled) return;
        const now = this.ctx.currentTime;

        // 1. High-pitch Chirp (The "Pew")
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth'; // Saw is richer than square
        osc.frequency.setValueAtTime(1200, now); // Start high
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.2); // Drop fast

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        // 2. Low-end Punch (The "Thump")
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(150, now);
        subOsc.frequency.linearRampToValueAtTime(50, now + 0.1);

        subGain.gain.setValueAtTime(0.5, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        // Connect
        osc.connect(gain);
        gain.connect(this.masterGain);

        subOsc.connect(subGain);
        subGain.connect(this.masterGain);

        osc.start();
        osc.stop(now + 0.2);
        subOsc.start();
        subOsc.stop(now + 0.2);
    }
    explode(color = '#ffffff', size = 1) {
        if (!this.enabled) return;

        const now = this.ctx.currentTime;
        // Base Volume varies by size (0.5 to 1.5)
        const vol = 0.5 + (size / 100);

        if (color === 'cow') {
            // MOO SPLOSION
            this.moo(); // Call moo base
            // Add squish sound
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
            osc.type = 'triangle';

            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(now + 0.5);
            return;
        }

        // Color Mapping
        let type = 'sawtooth';
        let freq = 100;
        let decay = 0.3;

        if (color === '#ff00ff') { // Magenta (High Energy)
            type = 'square';
            freq = 200;
            decay = 0.2;
        } else if (color === '#00ff00') { // Green (Radioactive)
            type = 'sawtooth';
            freq = 80;
            decay = 0.5;
        } else if (color === '#ffff00') { // Yellow (Standard)
            type = 'triangle';
            freq = 120;
            decay = 0.3;
        } else { // Red/Heavy
            type = 'sawtooth';
            freq = 60;
            decay = 0.6;
        }

        // Low Rumble (Body)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + decay);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + decay);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(now + decay);

        // High Crackle (Detail)
        this.playTone(800 - (size * 2), 'square', 0.1, vol * 0.3);
    }

    thrust() {
        // Engine hum
        if (!this.enabled) return;
        // Debounce thrust sound to avoid overlapping mess
        const now = this.ctx.currentTime;
        if (this._lastThrust && now - this._lastThrust < 0.1) return;
        this._lastThrust = now;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.1);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(now + 0.1);
    }

    die() {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;

        // Pitiful descending slide
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        // Do a few "wobbles" on the way down
        osc.frequency.linearRampToValueAtTime(300, now + 0.2);
        osc.frequency.linearRampToValueAtTime(200, now + 0.4);
        osc.frequency.linearRampToValueAtTime(100, now + 0.6);
        osc.frequency.exponentialRampToValueAtTime(10, now + 1.2); // Long sad slide

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.6);
        gain.gain.linearRampToValueAtTime(0, now + 1.2); // Fade out

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(now + 1.2);
    }

    ripple() {
        if (!this.enabled) return;
        // Sci-fi "warp" sound: Low frequency sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 1.5);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1.0);

        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 1.5);
    }

    moo() {
        if (!this.enabled) return;

        // Try Web Speech API for "Actual Word"
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance("Moo");
            utterance.pitch = 0.1; // Deep voice
            utterance.rate = 0.5;  // Slow drawl
            utterance.volume = 1.0;
            window.speechSynthesis.speak(utterance);
        } else {
            // Fallback to Synth if Speech API fails
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.8);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
            gain.gain.linearRampToValueAtTime(0, now + 1.0);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(now + 1.0);
        }
    }

    startMusic() {
        if (!this.enabled || this.isMusicPlaying) return;
        this.isMusicPlaying = true;
        this.ctx.resume(); // Ensure context is running

        // Cyberpunk Arpeggio Sequence
        const sequence = [
            110, 130.81, 146.83, 164.81, // A2, C3, D3, E3
            110, 130.81, 146.83, 196.00  // A2, C3, D3, G3
        ];
        let noteIndex = 0;
        const tempo = 0.2; // Seconds per note

        const playNextNote = () => {
            if (!this.isMusicPlaying) return;

            const now = this.ctx.currentTime;

            // Bass/Lead Synth
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(sequence[noteIndex], now);

            // Lowpass filter for dark sci-fi feel
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, now);
            filter.frequency.linearRampToValueAtTime(800, now + 0.1); // Wah effect
            filter.frequency.linearRampToValueAtTime(400, now + tempo);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.05); // Fade in
            gain.gain.linearRampToValueAtTime(0, now + tempo); // Fade out

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + tempo + 0.1);

            // Sub Bass Drone (every 8 notes)
            if (noteIndex % 8 === 0) {
                const subOsc = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                subOsc.type = 'square';
                subOsc.frequency.setValueAtTime(55, now); // A1 (Deep)

                subGain.gain.setValueAtTime(0.2, now);
                subGain.gain.exponentialRampToValueAtTime(0.01, now + (tempo * 8));

                subOsc.connect(subGain);
                subGain.connect(this.masterGain);
                subOsc.start(now);
                subOsc.stop(now + (tempo * 8));
            }

            noteIndex = (noteIndex + 1) % sequence.length;

            // Schedule next note
            setTimeout(() => playNextNote(), tempo * 1000);
        };

        playNextNote();
    }

    stopMusic() {
        this.isMusicPlaying = false;
    }
}
