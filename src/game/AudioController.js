export class AudioController {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.enabled = true; // Enabled by default
        this.musicIntensity = 0;
        this.initialized = false;
        this.isMusicPlaying = false;
        this.alienMode = false;
    }

    init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5; // Louder
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
        this.enabled = true;
    }

    resume() {
        if (!this.initialized) this.init();

        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                // console.log("Audio Context Resumed");
            }).catch(e => console.warn("Audio Resume Failed (User interaction needed)", e));
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

        // Cleanup Graph
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    }

    shoot() {
        if (!this.enabled) return;
        if (!this.initialized) this.init();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(150, now);
        subOsc.frequency.linearRampToValueAtTime(50, now + 0.1);

        subGain.gain.setValueAtTime(0.5, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        subOsc.connect(subGain);
        subGain.connect(this.masterGain);

        osc.start();
        osc.stop(now + 0.2);
        subOsc.start();
        subOsc.stop(now + 0.2);

        // Cleanup
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
        subOsc.onended = () => {
            subOsc.disconnect();
            subGain.disconnect();
        };
    }

    alienShoot() {
        if (!this.enabled || !this.initialized) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.3);

        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 30;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 200;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(now + 0.3);
        lfo.stop(now + 0.3);

        // Cleanup Graph
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
            lfo.disconnect();
            lfoGain.disconnect();
        };
    }

    explode(color = '#ffffff', size = 1) {
        if (!this.enabled) return;
        if (!this.initialized) this.init();

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
        if (!this.initialized) this.init();
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
        if (!this.initialized) this.init();
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
        if (!this.initialized) this.init();
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
        if (!this.initialized) this.init();

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
        if (!this.enabled) return;
        if (this.isMusicPlaying) return; // Already running
        if (!this.initialized) this.init();

        console.log("AudioController: Starting Music Loop (Scheduler)");
        this.isMusicPlaying = true;

        // Ensure context is ready
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(e => console.warn("Context resume failed in startMusic", e));
        }

        // Initialize Scheduler
        this.musicIntensity = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.1; // Start slighly in future
        this.noteIndex = 0;

        this.scheduler();
    }

    scheduler() {
        if (!this.isMusicPlaying) return;

        try {
            // Auto-Resume: If context suspended (e.g. user inactive or backgrounded), try to wake it
            if (this.ctx.state === 'suspended') {
                console.log("AudioScheduler: Context suspended, attempting resume...");
                this.ctx.resume().catch(e => console.debug("Resume pending user gesture"));
                // Retry in 500ms instead of tight loop
                this.timerID = setTimeout(() => this.scheduler(), 500);
                return;
            }

            // Lookahead: Schedule audio for the next 0.1s
            const lookahead = 0.1;

            // If the context is somehow way behind (e.g. tab switch), reset time to avoid playing catch-up
            if (this.nextNoteTime < this.ctx.currentTime - 0.5) {
                this.nextNoteTime = this.ctx.currentTime + 0.1;
            }

            // Safety: Limit loop to prevent getting stuck if logic fails
            let iterations = 0;
            while (this.nextNoteTime < this.ctx.currentTime + lookahead && iterations < 10) {
                this.playNoteAt(this.nextNoteTime);

                // Advance Time
                let intensity = this.musicIntensity || 0;
                // Tempo: 0.2s (Low) -> 0.13s (High)
                const tempo = Math.max(0.1, 0.2 - (intensity * 0.07)); // Clamp min tempo

                this.nextNoteTime += tempo;
                iterations++;
            }
        } catch (e) {
            console.error("AudioScheduler Error:", e);
        }

        // Check scheduler often (e.g., every 25ms)
        this.timerID = setTimeout(() => this.scheduler(), 25);
    }

    playNoteAt(time) {
        try {
            // Safe check for valid time
            if (!isFinite(time)) return;

            const sequence = [
                220, 261.63, 293.66, 329.63, // A3, C4, D4, E4
                220, 261.63, 293.66, 392.00  // A3, C4, D4, G4
            ];

            let currentSequence = sequence;
            let intensity = this.musicIntensity || 0;

            if (this.alienMode) {
                intensity = Math.max(intensity, 0.8);
                currentSequence = [
                    220, 233.08, 220, 233.08,
                    220, 246.94, 220, 207.65
                ];
            }

            const noteFreq = currentSequence[this.noteIndex % currentSequence.length];
            const tempo = Math.max(0.1, 0.2 - (intensity * 0.07));
            const filterFreq = 400 + (intensity * 1200);

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = this.alienMode ? 'square' : 'sawtooth';
            osc.frequency.setValueAtTime(noteFreq, time);

            if (intensity > 0.6) {
                osc.detune.setValueAtTime(Math.random() * 20 - 10, time);
            }

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(filterFreq, time);
            filter.frequency.linearRampToValueAtTime(filterFreq + 400 + (intensity * 500), time + 0.05);
            filter.frequency.linearRampToValueAtTime(filterFreq, time + tempo);

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.3, time + 0.02);
            gain.gain.linearRampToValueAtTime(0, time + tempo - 0.02);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(time);
            osc.stop(time + tempo);

            // Sub Bass
            if (this.noteIndex % 8 === 0) {
                const subOsc = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                subOsc.type = intensity > 0.7 ? 'sawtooth' : 'square';
                subOsc.frequency.setValueAtTime(this.alienMode ? 40 : 55, time);

                const bassVol = 0.2 + (intensity * 0.15);
                subGain.gain.setValueAtTime(bassVol, time);
                subGain.gain.exponentialRampToValueAtTime(0.001, time + (tempo * 8));

                subOsc.connect(subGain);
                subGain.connect(this.masterGain);
                subOsc.start(time);
                subOsc.stop(time + (tempo * 8));
            }

            // Hi-Hat
            if (intensity > 0.3 && this.noteIndex % 2 === 0) {
                const hatOsc = this.ctx.createOscillator();
                const hatGain = this.ctx.createGain();
                const hatFilter = this.ctx.createBiquadFilter();

                hatOsc.type = 'square';
                hatOsc.frequency.setValueAtTime(8000 + (Math.random() * 2000), time);

                hatFilter.type = 'highpass';
                hatFilter.frequency.value = 6000;

                hatGain.gain.setValueAtTime(intensity * 0.04, time);
                hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

                hatOsc.connect(hatFilter);
                hatFilter.connect(hatGain);
                hatGain.connect(this.masterGain);

                hatOsc.start(time);
                hatOsc.stop(time + 0.05);
            }

            this.noteIndex++;
        } catch (e) {
            console.warn("Audio Playback Error:", e);
        }
    }

    setMusicIntensity(val) {
        this.musicIntensity = Math.max(0, Math.min(1, val));
    }

    setAlienMode(isActive) {
        this.alienMode = isActive;
    }

    stopMusic() {
        this.isMusicPlaying = false;
        if (this.timerID) clearTimeout(this.timerID);
        this.timerID = null;
    }
}
