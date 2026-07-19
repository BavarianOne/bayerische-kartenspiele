/**
 * Math Quest: Number Kingdom - Audio Module
 * Handles all sound effects and music using Web Audio API
 */

const Audio = (function() {
    'use strict';

    let audioContext = null;
    let masterGain = null;
    let musicGain = null;
    let sfxGain = null;
    let currentMusic = null;
    let musicBuffer = null;
    let isInitialized = false;
    let settings = null;

    // Sound definitions
    const SOUNDS = {
        // UI Sounds
        click: { type: 'synth', frequency: 800, duration: 0.1, wave: 'square', volume: 0.3 },
        hover: { type: 'synth', frequency: 1200, duration: 0.05, wave: 'sine', volume: 0.15 },
        success: { type: 'sequence', notes: [
            { freq: 523.25, dur: 0.1 }, // C5
            { freq: 659.25, dur: 0.1 }, // E5
            { freq: 783.99, dur: 0.15 }, // G5
            { freq: 1046.50, dur: 0.2 }  // C6
        ], volume: 0.4 },
        error: { type: 'sequence', notes: [
            { freq: 300, dur: 0.15 },
            { freq: 200, dur: 0.2 }
        ], volume: 0.4 },
        levelUp: { type: 'sequence', notes: [
            { freq: 523.25, dur: 0.1 },
            { freq: 659.25, dur: 0.1 },
            { freq: 783.99, dur: 0.1 },
            { freq: 1046.50, dur: 0.1 },
            { freq: 1318.51, dur: 0.2 },
            { freq: 1567.98, dur: 0.3 }
        ], volume: 0.5 },
        coin: { type: 'synth', frequency: 1000, duration: 0.15, wave: 'sine', volume: 0.3, pitchBend: 1.5 },
        heartLost: { type: 'synth', frequency: 200, duration: 0.3, wave: 'sawtooth', volume: 0.4 },
        heartGained: { type: 'sequence', notes: [
            { freq: 400, dur: 0.1 },
            { freq: 600, dur: 0.15 }
        ], volume: 0.4 },
        starEarned: { type: 'sequence', notes: [
            { freq: 880, dur: 0.08 },
            { freq: 1108.73, dur: 0.08 },
            { freq: 1318.51, dur: 0.12 }
        ], volume: 0.4 },
        achievement: { type: 'sequence', notes: [
            { freq: 659.25, dur: 0.1 },
            { freq: 783.99, dur: 0.1 },
            { freq: 987.77, dur: 0.1 },
            { freq: 1318.51, dur: 0.2 },
            { freq: 1567.98, dur: 0.3 }
        ], volume: 0.5 },
        pop: { type: 'synth', frequency: 600, duration: 0.08, wave: 'square', volume: 0.25 },
        whoosh: { type: 'noise', duration: 0.3, volume: 0.2, filter: { type: 'lowpass', frequency: 2000 } },
        correct: { type: 'sequence', notes: [
            { freq: 523.25, dur: 0.08 },
            { freq: 783.99, dur: 0.12 }
        ], volume: 0.4 },
        incorrect: { type: 'synth', frequency: 150, duration: 0.4, wave: 'sawtooth', volume: 0.3 },
        timerWarning: { type: 'synth', frequency: 800, duration: 0.1, wave: 'square', volume: 0.3, repeat: 2, repeatDelay: 0.15 },
        timerDanger: { type: 'synth', frequency: 1000, duration: 0.08, wave: 'square', volume: 0.4, repeat: 4, repeatDelay: 0.1 },
        hint: { type: 'sequence', notes: [
            { freq: 600, dur: 0.1 },
            { freq: 800, dur: 0.1 }
        ], volume: 0.3 },
        purchase: { type: 'sequence', notes: [
            { freq: 523.25, dur: 0.08 },
            { freq: 659.25, dur: 0.08 },
            { freq: 783.99, dur: 0.08 },
            { freq: 1046.50, dur: 0.15 }
        ], volume: 0.4 },
        worldComplete: { type: 'sequence', notes: [
            { freq: 523.25, dur: 0.15 },
            { freq: 659.25, dur: 0.15 },
            { freq: 783.99, dur: 0.15 },
            { freq: 1046.50, dur: 0.15 },
            { freq: 1318.51, dur: 0.15 },
            { freq: 1567.98, dur: 0.3 }
        ], volume: 0.5 },
        gameComplete: { type: 'sequence', notes: [
            { freq: 523.25, dur: 0.1 },
            { freq: 659.25, dur: 0.1 },
            { freq: 783.99, dur: 0.1 },
            { freq: 1046.50, dur: 0.1 },
            { freq: 1318.51, dur: 0.1 },
            { freq: 1567.98, dur: 0.1 },
            { freq: 2093.00, dur: 0.3 }
        ], volume: 0.5 }
    };

    // Music tracks (procedurally generated)
    const MUSIC_TRACKS = {
        menu: { tempo: 100, key: 'C', mode: 'major', layers: ['melody', 'bass', 'pad'] },
        world1: { tempo: 110, key: 'F', mode: 'major', layers: ['melody', 'bass', 'pad', 'percussion'] },
        world2: { tempo: 95, key: 'G', mode: 'major', layers: ['melody', 'bass', 'pad', 'percussion'] },
        world3: { tempo: 120, key: 'D', mode: 'major', layers: ['melody', 'bass', 'pad', 'percussion'] },
        world4: { tempo: 85, key: 'A', mode: 'minor', layers: ['melody', 'bass', 'pad', 'percussion'] },
        world5: { tempo: 130, key: 'E', mode: 'minor', layers: ['melody', 'bass', 'pad', 'percussion'] },
        challenge: { tempo: 140, key: 'C', mode: 'major', layers: ['melody', 'bass', 'percussion'] },
        victory: { tempo: 120, key: 'C', mode: 'major', layers: ['melody', 'bass', 'pad'] }
    };

    // Note frequencies
    const NOTES = {
        'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63,
        'F': 349.23, 'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00,
        'A#': 466.16, 'B': 493.88
    };

    // Scales
    const SCALES = {
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
        pentatonic: [0, 2, 4, 7, 9]
    };

    // Initialize audio system - non-blocking, handles user gesture requirement
    async function init(userSettings = null) {
        if (isInitialized) return;

        settings = userSettings || Storage.getSettings();

        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create gain nodes
            masterGain = audioContext.createGain();
            musicGain = audioContext.createGain();
            sfxGain = audioContext.createGain();

            masterGain.connect(audioContext.destination);
            musicGain.connect(masterGain);
            sfxGain.connect(masterGain);

            // Set initial volumes
            masterGain.gain.value = 1;
            musicGain.gain.value = settings.musicVolume || 0.5;
            sfxGain.gain.value = settings.soundVolume || 0.7;

            // Don't await resume here - let it happen on first user interaction
            // This prevents blocking initialization
            if (audioContext.state === 'suspended') {
                // Set up one-time user interaction handler to resume audio context
                const resumeAudio = async () => {
                    if (audioContext && audioContext.state === 'suspended') {
                        try {
                            await audioContext.resume();
                            console.log('Audio context resumed on user interaction');
                        } catch (e) {
                            console.warn('Failed to resume audio context:', e);
                        }
                    }
                    // Remove listeners after first interaction
                    document.removeEventListener('click', resumeAudio);
                    document.removeEventListener('keydown', resumeAudio);
                    document.removeEventListener('touchstart', resumeAudio);
                };
                
                document.addEventListener('click', resumeAudio, { once: true, passive: true });
                document.addEventListener('keydown', resumeAudio, { once: true, passive: true });
                document.addEventListener('touchstart', resumeAudio, { once: true, passive: true });
            }

            isInitialized = true;
            console.log('Audio system initialized (awaiting user interaction for audio context)');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
            isInitialized = false;
        }
    }

    // Ensure audio context is running
    async function ensureContext() {
        if (!isInitialized) await init();
        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    }

    // Play a synthesized sound
    function playSound(soundName, options = {}) {
        if (!isInitialized || !settings.soundEnabled) return;
        
        const sound = SOUNDS[soundName];
        if (!sound) {
            console.warn(`Sound not found: ${soundName}`);
            return;
        }

        ensureContext();

        const volume = (options.volume !== undefined ? options.volume : sound.volume) * (sfxGain.gain.value);
        const now = audioContext.currentTime;

        if (sound.type === 'synth') {
            playSynth(sound, volume, now, options);
        } else if (sound.type === 'sequence') {
            playSequence(sound, volume, now, options);
        } else if (sound.type === 'noise') {
            playNoise(sound, volume, now, options);
        }
    }

    // Play a single synth note
    function playSynth(sound, volume, now, options) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        osc.type = sound.wave || 'sine';
        osc.frequency.value = (options.frequency || sound.frequency) * (options.pitchBend || 1);

        filter.type = 'lowpass';
        filter.frequency.value = 3000;
        filter.Q.value = 1;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (sound.duration || 0.2));

        if (sound.pitchBend) {
            osc.frequency.setValueAtTime(sound.frequency * sound.pitchBend, now);
            osc.frequency.exponentialRampToValueAtTime(sound.frequency, now + 0.1);
        }

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(sfxGain);

        osc.start(now);
        osc.stop(now + (sound.duration || 0.2) + 0.1);

        // Handle repeat
        if (sound.repeat) {
            for (let i = 1; i < sound.repeat; i++) {
                const repeatTime = now + i * (sound.repeatDelay || 0.2);
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                const filter2 = audioContext.createBiquadFilter();

                osc2.type = sound.wave || 'sine';
                osc2.frequency.value = sound.frequency;

                filter2.type = 'lowpass';
                filter2.frequency.value = 3000;

                gain2.gain.setValueAtTime(0, repeatTime);
                gain2.gain.linearRampToValueAtTime(volume, repeatTime + 0.01);
                gain2.gain.exponentialRampToValueAtTime(0.001, repeatTime + (sound.duration || 0.2));

                osc2.connect(filter2);
                filter2.connect(gain2);
                gain2.connect(sfxGain);

                osc2.start(repeatTime);
                osc2.stop(repeatTime + (sound.duration || 0.2) + 0.1);
            }
        }
    }

    // Play a sequence of notes
    function playSequence(sound, volume, now, options) {
        let time = now;
        sound.notes.forEach((note, index) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();

            osc.type = options.wave || 'sine';
            osc.frequency.value = note.freq;

            filter.type = 'lowpass';
            filter.frequency.value = 4000;

            const noteVolume = volume * (note.volume || 1);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(noteVolume, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, time + (note.dur || 0.2));

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(sfxGain);

            osc.start(time);
            osc.stop(time + (note.dur || 0.2) + 0.1);

            time += note.dur || 0.2;
        });
    }

    // Play noise-based sound
    function playNoise(sound, volume, now, options) {
        const bufferSize = audioContext.sampleRate * (sound.duration || 0.3);
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        source.buffer = buffer;

        if (sound.filter) {
            filter.type = sound.filter.type || 'lowpass';
            filter.frequency.value = sound.filter.frequency || 2000;
        }

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (sound.duration || 0.3));

        source.connect(filter);
        filter.connect(gain);
        gain.connect(sfxGain);

        source.start(now);
        source.stop(now + (sound.duration || 0.3) + 0.1);
    }

    // Music generation and playback
    function generateMusicTrack(trackName) {
        const track = MUSIC_TRACKS[trackName];
        if (!track) return null;

        const scale = SCALES[track.mode] || SCALES.major;
        const rootFreq = NOTES[track.key] || NOTES['C'];
        const beatDuration = 60 / track.tempo; // seconds per beat
        const measureDuration = beatDuration * 4; // 4/4 time
        const trackDuration = measureDuration * 16; // 16 measures loop

        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * trackDuration;
        const buffer = audioContext.createBuffer(2, length, sampleRate);

        // Generate each layer
        const layers = track.layers || ['melody', 'bass'];
        
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            
            layers.forEach(layer => {
                generateLayer(data, layer, track, scale, rootFreq, beatDuration, measureDuration, trackDuration, channel);
            });
        }

        return buffer;
    }

    function generateLayer(data, layer, track, scale, rootFreq, beatDuration, measureDuration, trackDuration, channel) {
        const sampleRate = audioContext.sampleRate;
        const totalSamples = data.length;

        switch (layer) {
            case 'melody':
                generateMelody(data, track, scale, rootFreq, beatDuration, measureDuration, trackDuration, channel);
                break;
            case 'bass':
                generateBass(data, track, scale, rootFreq, beatDuration, measureDuration, trackDuration);
                break;
            case 'pad':
                generatePad(data, track, scale, rootFreq, measureDuration, trackDuration);
                break;
            case 'percussion':
                generatePercussion(data, track, beatDuration, measureDuration, trackDuration);
                break;
        }
    }

    function generateMelody(data, track, scale, rootFreq, beatDuration, measureDuration, trackDuration, channel) {
        const sampleRate = audioContext.sampleRate;
        const notesPerMeasure = 4;
        const noteDuration = measureDuration / notesPerMeasure;
        
        // Simple melody pattern
        const melodyPattern = [0, 2, 4, 2, 1, 3, 5, 3, 2, 4, 6, 4, 1, 2, 0, -1];
        
        for (let measure = 0; measure < 16; measure++) {
            for (let note = 0; note < notesPerMeasure; note++) {
                const patternIndex = (measure * notesPerMeasure + note) % melodyPattern.length;
                const scaleDegree = melodyPattern[patternIndex];
                const octave = 4 + Math.floor(scaleDegree / 7);
                const noteIndex = ((scaleDegree % 7) + 7) % 7;
                const freq = rootFreq * Math.pow(2, octave - 4) * Math.pow(2, scale[noteIndex] / 12);
                
                const startTime = measure * measureDuration + note * noteDuration;
                const startSample = Math.floor(startTime * sampleRate);
                const endSample = Math.min(startSample + Math.floor(noteDuration * sampleRate * 0.8), data.length);
                
                for (let i = startSample; i < endSample; i++) {
                    const t = (i - startSample) / sampleRate;
                    const envelope = Math.exp(-t * 8) * (1 - Math.exp(-t * 50));
                    const wave = Math.sin(2 * Math.PI * freq * t) * 0.3 + 
                                Math.sin(4 * Math.PI * freq * t) * 0.1;
                    data[i] += wave * envelope * 0.15;
                }
            }
        }
    }

    function generateBass(data, track, scale, rootFreq, beatDuration, measureDuration, trackDuration) {
        const sampleRate = audioContext.sampleRate;
        const bassPattern = [0, 0, 4, 0, 0, 0, 4, 0]; // Root, root, fifth, root...
        
        for (let measure = 0; measure < 16; measure++) {
            for (let beat = 0; beat < 4; beat++) {
                const patternIndex = (measure * 4 + beat) % bassPattern.length;
                const scaleDegree = bassPattern[patternIndex];
                const noteIndex = ((scaleDegree % 7) + 7) % 7;
                const freq = rootFreq * 0.5 * Math.pow(2, scale[noteIndex] / 12); // Octave lower
                
                const startTime = measure * measureDuration + beat * beatDuration;
                const startSample = Math.floor(startTime * sampleRate);
                const endSample = Math.min(startSample + Math.floor(beatDuration * sampleRate * 0.9), data.length);
                
                for (let i = startSample; i < endSample; i++) {
                    const t = (i - startSample) / sampleRate;
                    const envelope = Math.exp(-t * 4);
                    const wave = Math.sin(2 * Math.PI * freq * t) * 0.5 + 
                                Math.sin(4 * Math.PI * freq * t) * 0.25;
                    data[i] += wave * envelope * 0.2;
                }
            }
        }
    }

    function generatePad(data, track, scale, rootFreq, measureDuration, trackDuration) {
        const sampleRate = audioContext.sampleRate;
        const chordNotes = [0, 2, 4]; // Root, third, fifth
        
        for (let measure = 0; measure < 16; measure += 2) { // Change chord every 2 measures
            const chordRoot = (measure / 2) % 4; // Simple progression
            const freqs = chordNotes.map(degree => {
                const noteIndex = ((degree + chordRoot * 2) % 7 + 7) % 7;
                return rootFreq * 0.25 * Math.pow(2, scale[noteIndex] / 12); // Two octaves lower
            });
            
            const startTime = measure * measureDuration;
            const endTime = startTime + measureDuration * 2;
            const startSample = Math.floor(startTime * sampleRate);
            const endSample = Math.min(Math.floor(endTime * sampleRate), data.length);
            
            for (let i = startSample; i < endSample; i++) {
                const t = (i - startSample) / sampleRate;
                const attack = 1 - Math.exp(-t * 2);
                const release = Math.exp(-(t - measureDuration * 1.5) * 1.5);
                const envelope = attack * (t < measureDuration * 1.5 ? 1 : release);
                
                let wave = 0;
                freqs.forEach(freq => {
                    wave += Math.sin(2 * Math.PI * freq * t) * 0.3;
                });
                
                data[i] += wave * envelope * 0.08;
            }
        }
    }

    function generatePercussion(data, track, beatDuration, measureDuration, trackDuration) {
        const sampleRate = audioContext.sampleRate;
        
        for (let measure = 0; measure < 16; measure++) {
            for (let beat = 0; beat < 4; beat++) {
                const startTime = measure * measureDuration + beat * beatDuration;
                const startSample = Math.floor(startTime * sampleRate);
                
                // Kick on beats 1 and 3
                if (beat === 0 || beat === 2) {
                    generateKick(data, startSample, sampleRate);
                }
                
                // Hi-hat on every beat
                generateHihat(data, startSample, sampleRate, beat === 0 || beat === 2 ? 0.15 : 0.08);
                
                // Snare on beats 2 and 4
                if (beat === 1 || beat === 3) {
                    generateSnare(data, startSample, sampleRate);
                }
            }
        }
    }

    function generateKick(data, startSample, sampleRate) {
        const duration = 0.15;
        const endSample = Math.min(startSample + Math.floor(duration * sampleRate), data.length);
        
        for (let i = startSample; i < endSample; i++) {
            const t = (i - startSample) / sampleRate;
            const freq = 150 * Math.exp(-t * 30) + 60;
            const envelope = Math.exp(-t * 20);
            data[i] += Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
        }
    }

    function generateSnare(data, startSample, sampleRate) {
        const duration = 0.1;
        const endSample = Math.min(startSample + Math.floor(duration * sampleRate), data.length);
        
        for (let i = startSample; i < endSample; i++) {
            const t = (i - startSample) / sampleRate;
            const envelope = Math.exp(-t * 30);
            const tone = Math.sin(2 * Math.PI * 200 * t) * 0.3;
            const noise = (Math.random() * 2 - 1) * 0.5;
            data[i] += (tone + noise) * envelope * 0.2;
        }
    }

    function generateHihat(data, startSample, sampleRate, volume) {
        const duration = 0.05;
        const endSample = Math.min(startSample + Math.floor(duration * sampleRate), data.length);
        
        for (let i = startSample; i < endSample; i++) {
            const t = (i - startSample) / sampleRate;
            const envelope = Math.exp(-t * 100);
            const noise = (Math.random() * 2 - 1);
            data[i] += noise * envelope * volume;
        }
    }

    // Play music
    async function playMusic(trackName, loop = true) {
        if (!isInitialized || !settings.musicEnabled) return;
        
        await ensureContext();
        
        // Stop current music
        stopMusic();
        
        // Generate or get cached music
        if (!musicBuffer || musicBuffer.trackName !== trackName) {
            musicBuffer = generateMusicTrack(trackName);
            if (musicBuffer) musicBuffer.trackName = trackName;
        }
        
        if (!musicBuffer) return;
        
        currentMusic = audioContext.createBufferSource();
        currentMusic.buffer = musicBuffer;
        currentMusic.loop = loop;
        currentMusic.connect(musicGain);
        currentMusic.start(0);
    }

    function stopMusic() {
        if (currentMusic) {
            try {
                currentMusic.stop();
                currentMusic.disconnect();
            } catch (e) {}
            currentMusic = null;
        }
    }

    function pauseMusic() {
        if (currentMusic && audioContext) {
            currentMusic.stop();
        }
    }

    function resumeMusic() {
        if (currentMusic && audioContext && settings.musicEnabled) {
            currentMusic = audioContext.createBufferSource();
            currentMusic.buffer = musicBuffer;
            currentMusic.loop = true;
            currentMusic.connect(musicGain);
            currentMusic.start(0, audioContext.currentTime - (currentMusic.buffer.duration - audioContext.currentTime % currentMusic.buffer.duration));
        }
    }

    // Volume controls
    function setMasterVolume(volume) {
        if (masterGain) {
            masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    function setMusicVolume(volume) {
        if (musicGain) {
            musicGain.gain.value = Math.max(0, Math.min(1, volume));
            if (settings) settings.musicVolume = volume;
        }
    }

    function setSfxVolume(volume) {
        if (sfxGain) {
            sfxGain.gain.value = Math.max(0, Math.min(1, volume));
            if (settings) settings.soundVolume = volume;
        }
    }

    function toggleMusic(enabled) {
        if (settings) settings.musicEnabled = enabled;
        if (enabled) {
            resumeMusic();
        } else {
            pauseMusic();
        }
    }

    function toggleSfx(enabled) {
        if (settings) settings.soundEnabled = enabled;
    }

    // Update settings reference
    function updateSettings(newSettings) {
        settings = newSettings;
        if (musicGain) musicGain.gain.value = settings.musicVolume || 0.5;
        if (sfxGain) sfxGain.gain.value = settings.soundVolume || 0.7;
        
        if (!settings.musicEnabled) pauseMusic();
        else if (currentMusic && musicBuffer) resumeMusic();
    }

    // Preload common sounds
    function preload() {
        // Sounds are generated on-demand, but we can warm up the audio context
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    // Cleanup
    function destroy() {
        stopMusic();
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        isInitialized = false;
    }

    // Public API
    return {
        init,
        playSound,
        playMusic,
        stopMusic,
        pauseMusic,
        resumeMusic,
        setMasterVolume,
        setMusicVolume,
        setSfxVolume,
        toggleMusic,
        toggleSfx,
        updateSettings,
        preload,
        destroy,
        SOUNDS,
        MUSIC_TRACKS
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Audio;
}