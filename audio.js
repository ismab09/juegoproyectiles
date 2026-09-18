/**
 * audio.js - Síntesis de sonido procedural para fútbol con Web Audio API
 * No requiere archivos de audio externos (100% autónomo y offline)
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Impacto del botín con la pelota
    playKick() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Golpe seco (transitorio rápido)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        // Ruido de roce de cuero
        const bufferSize = ctx.sampleRate * 0.08;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.08);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        whiteNoise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        osc.start(now);
        whiteNoise.start(now);
        osc.stop(now + 0.15);
        whiteNoise.stop(now + 0.09);
    }

    // Balón viajando por el aire (efecto de viento/combado)
    playWhoosh() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const bufferSize = ctx.sampleRate * 0.5;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 3.0;
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.5);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.2);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(now);
        noise.stop(now + 0.5);
    }

    // Impacto metálico con el travesaño o poste (CLAAANG)
    playCrossbar() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const freqs = [520, 840, 1320, 2100];
        freqs.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now);

            const decay = 0.8 - idx * 0.12;
            gain.gain.setValueAtTime(0.35 / (idx + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + decay);
        });
    }

    // Impacto sordo en la barrera (cuerpo / piernas)
    playWallHit() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    // Rugido del estadio y festejo de gol
    playGoal() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Ruido blanco filtrado simulando la multitud celebrando
        const duration = 2.4;
        const bufferSize = ctx.sampleRate * duration;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const crowdNoise = ctx.createBufferSource();
        crowdNoise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.linearRampToValueAtTime(1100, now + 0.5);
        filter.frequency.linearRampToValueAtTime(700, now + duration);
        filter.Q.value = 1.2;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.8, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        crowdNoise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        crowdNoise.start(now);
        crowdNoise.stop(now + duration);

        // Sonido de red estremeciéndose
        this.playNetRustle();

        // Bocinas de estadio retro
        this.playRetroAirHorns();

        // Grito de gol retro con fanfarria arcade y voz
        this.playRetroGoalVoice();
    }

    // Bocina de estadio tradicional / retro (HONK-HONK-HONK)
    playRetroAirHorns() {
        if (!this.enabled || !this.ctx) return;
        const ctx = this.ctx;
        const baseTime = ctx.currentTime + 0.15;
        const hornTimes = [0, 0.22, 0.44];

        hornTimes.forEach((offset) => {
            const t = baseTime + offset;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sawtooth';
            osc2.type = 'square';
            osc1.frequency.setValueAtTime(320, t);
            osc2.frequency.setValueAtTime(480, t);

            gain.gain.setValueAtTime(0.001, t);
            gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
            gain.gain.setValueAtTime(0.25, t + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(t);
            osc2.start(t);
            osc1.stop(t + 0.20);
            osc2.stop(t + 0.20);
        });
    }

    // Fanfarria arcade y locutor retro gritando ¡GOOOOOL!
    playRetroGoalVoice() {
        if (!this.enabled || !this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Fanfarria de acordes arcade de 16 bits (estilo Super Sidekicks / ISS Deluxe)
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // Acorde triunfal Do Mayor
        notes.forEach((freq, idx) => {
            const t = now + idx * 0.07;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square'; // Timbre retro 8/16-bit
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.001, t);
            gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(t);
            osc.stop(t + 0.5);
        });

        // Locutor de estadio gritando ¡¡GOOOOOOL!! (usando SpeechSynthesis del navegador)
        try {
            if ('speechSynthesis' in window) {
                // Cancelar locuciones previas
                window.speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance('¡¡Goooooool!! ¡Golazo!');
                utterance.lang = 'es-ES';
                utterance.rate = 1.35; // Rápido y eufórico
                utterance.pitch = 1.4; // Tono enérgico
                utterance.volume = 1.0;

                // Buscar voces en español
                const voices = window.speechSynthesis.getVoices();
                const esVoice = voices.find(v => v.lang.startsWith('es') || v.lang.includes('ES') || v.lang.includes('AR') || v.lang.includes('UY') || v.lang.includes('MX'));
                if (esVoice) {
                    utterance.voice = esVoice;
                }

                setTimeout(() => {
                    window.speechSynthesis.speak(utterance);
                }, 200);
            }
        } catch (e) {
            console.log('SpeechSynthesis no disponible:', e);
        }
    }

    // Red sacudiéndose
    playNetRustle() {
        if (!this.enabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const dur = 0.4;
        const bufferSize = ctx.sampleRate * dur;
        const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.15));
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2200;
        const gain = ctx.createGain();
        gain.gain.value = 0.4;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
    }

    // Silbato del árbitro
    playWhistle() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.value = 2650;
        osc2.frequency.value = 2900;

        // Trémolo
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 35;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 50;
        lfo.connect(osc1.frequency);
        lfo.connect(osc2.frequency);

        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.03);
        gain.gain.setValueAtTime(0.35, now + 0.22);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.32);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        lfo.start(now);
        osc1.start(now);
        osc2.start(now);
        lfo.stop(now + 0.35);
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
    }

    // Atajada de Muslera: impacto de guantes y reacción de la grada
    playSave() {
        if (!this.enabled) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Golpe seco de guantes (thump / manotazo)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.16);

        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.20);

        // Murmullo / suspiro de la tribuna "¡¡Uhhhhh!!"
        const dur = 1.3;
        const bufferSize = ctx.sampleRate * dur;
        const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, now);
        filter.frequency.linearRampToValueAtTime(200, now + dur);

        const crowdGain = ctx.createGain();
        crowdGain.gain.setValueAtTime(0.01, now);
        crowdGain.gain.linearRampToValueAtTime(0.35, now + 0.12);
        crowdGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        src.connect(filter);
        filter.connect(crowdGain);
        crowdGain.connect(ctx.destination);
        src.start(now);
        src.stop(now + dur);
    }
}

const AudioFX = new SoundEngine();
