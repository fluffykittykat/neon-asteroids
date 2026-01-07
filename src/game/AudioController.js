export class AudioController {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.enabled = true;
        this.musicIntensity = 0;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
    }

    resume() {
        if (!this.initialized) this.init();

        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(e => console.warn("Audio Resume Failed (User interaction needed)", e));
        }

        // Force iOS Unlock with Silent Buffer (Must be inside a user event)
        // We create an empty buffer and play it.
        try {
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            if (source.start) source.start(0);
            else if (source.noteOn) source.noteOn(0); // Legacy Safari
        } catch (e) {
            console.error("iOS Audio Unlock Failed:", e);
        }
    }

    playTone(freq, type, duration, vol = 1) {
        if (!this.enabled) return;
        if (!this.initialized) this.init();

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
        if (!this.initialized) this.init();

        this.isMusicPlaying = true;
        this.musicIntensity = 0; // 0.0 to 1.0 (Low -> High)
        this.ctx.resume(); // Ensure context is running

        // Cyberpunk Arpeggio Sequence
        const sequence = [
            110, 130.81, 146.83, 164.81, // A2, C3, D3, E3
            110, 130.81, 146.83, 196.00  // A2, C3, D3, G3
        ];
        let noteIndex = 0;

        const playNextNote = () => {
            if (!this.isMusicPlaying) return;

            // If context is suspended (locked), don't try to play or it warns.
            // Just wait and try again.
            if (this.ctx.state === 'suspended') {
                setTimeout(() => playNextNote(), 500);
                return;
            }

            const now = this.ctx.currentTime;

            // Dynamic Variables based on Intensity
            const intensity = this.musicIntensity || 0;
            const tempo = 0.2 - (intensity * 0.07); // Speed up
            const filterFreq = 400 + (intensity * 1200); // Open filter

            // Bass/Lead Synth
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(sequence[noteIndex], now);

            // Detune at high intensity
            if (intensity > 0.6) {
                osc.detune.setValueAtTime(Math.random() * 20 - 10, now);
            }

            // Lowpass filter modulation
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(filterFreq, now);
            filter.frequency.linearRampToValueAtTime(filterFreq + 400 + (intensity * 500), now + 0.1);
            filter.frequency.linearRampToValueAtTime(filterFreq, now + tempo);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gain.gain.linearRampToValueAtTime(0, now + tempo);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + tempo + 0.1);

            // Sub Bass Drone (Deepening Intensity)
            if (noteIndex % 8 === 0) {
                const subOsc = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                subOsc.type = intensity > 0.7 ? 'sawtooth' : 'square'; // Aggressive bass
                subOsc.frequency.setValueAtTime(55, now);

                const bassVol = 0.2 + (intensity * 0.15);
                subGain.gain.setValueAtTime(bassVol, now);
                subGain.gain.exponentialRampToValueAtTime(0.01, now + (tempo * 8));

                subOsc.connect(subGain);
                subGain.connect(this.masterGain);
                subOsc.start(now);
                subOsc.stop(now + (tempo * 8));
            }

            // Hi-Hat / Glitch (Added at Medium Intensity)
            if (intensity > 0.3 && noteIndex % 2 === 0) {
                const hatOsc = this.ctx.createOscillator();
                const hatGain = this.ctx.createGain();
                hatOsc.type = 'square';
                hatOsc.frequency.setValueAtTime(8000 + (Math.random() * 2000), now); // Glitchy

                hatGain.gain.setValueAtTime(intensity * 0.04, now);
                hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

                const hatFilter = this.ctx.createBiquadFilter();
                hatFilter.type = 'highpass';
                hatFilter.frequency.value = 6000;

                hatOsc.connect(hatFilter);
                hatFilter.connect(hatGain);
                hatGain.connect(this.masterGain);

                hatOsc.start(now);
                hatOsc.stop(now + 0.1);
            }

            noteIndex = (noteIndex + 1) % sequence.length;

            // Schedule next note
            setTimeout(() => playNextNote(), tempo * 1000);
        };

        playNextNote();
    }

    setMusicIntensity(val) {
        this.musicIntensity = Math.max(0, Math.min(1, val));
    }

    stopMusic() {
        this.isMusicPlaying = false;
    }
}
