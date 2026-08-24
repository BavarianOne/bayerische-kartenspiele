"""
Audio Analysis Module: Beat detection, tempo, energy curves.
Uses librosa for robust onset/beat detection.
"""

import numpy as np
import librosa
from dataclasses import dataclass
from typing import Optional, List
import json


@dataclass
class BeatInfo:
    """Information about a single beat."""
    time: float           # Time in seconds
    strength: float       # Beat strength (0-1)
    is_downbeat: bool     # True if this is a downbeat (measure start)


@dataclass
class AudioAnalysis:
    """Complete audio analysis result."""
    duration: float               # Total duration in seconds
    sample_rate: int              # Audio sample rate
    tempo: float                  # Estimated BPM
    beats: List[BeatInfo]         # All detected beats
    downbeats: List[BeatInfo]     # Downbeats (measure starts)
    onset_times: np.ndarray       # All onset times
    onset_strength: np.ndarray    # Onset strength envelope
    rms_energy: np.ndarray        # RMS energy curve
    spectral_centroid: np.ndarray # Spectral centroid (brightness)
    times: np.ndarray             # Time axis for curves


def analyze_audio(audio_path: str, 
                  target_sr: int = 22050,
                  hop_length: int = 512) -> AudioAnalysis:
    """
    Analyze audio file for beats, tempo, and energy curves.
    
    Args:
        audio_path: Path to audio file
        target_sr: Target sample rate for analysis (lower = faster)
        hop_length: Hop length for STFT
        
    Returns:
        AudioAnalysis with all extracted features
    """
    print(f"🎵 Loading audio: {audio_path}")
    y, sr = librosa.load(audio_path, sr=target_sr)
    duration = len(y) / sr
    
    print("🔍 Detecting tempo and beats...")
    # Tempo estimation
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop_length)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)
    
    # Onset detection for beat strength
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    onset_times = librosa.frames_to_time(np.arange(len(onset_env)), sr=sr, hop_length=hop_length)
    
    # Get beat strengths from onset envelope at beat positions
    beat_strengths = []
    for bt in beat_times:
        idx = np.argmin(np.abs(onset_times - bt))
        beat_strengths.append(float(onset_env[idx]))
    
    # Normalize beat strengths
    beat_strengths = np.array(beat_strengths)
    if beat_strengths.max() > 0:
        beat_strengths = beat_strengths / beat_strengths.max()
    
    # Detect downbeats (using librosa's downbeat detection)
    try:
        downbeat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop_length, 
                                                   start_bpm=tempo, tightness=100)[1]
        downbeat_times = librosa.frames_to_time(downbeat_frames, sr=sr, hop_length=hop_length)
    except:
        # Fallback: assume 4/4 time, every 4th beat is downbeat
        downbeat_times = beat_times[::4]
    
    # Build BeatInfo objects
    beats = []
    for i, (bt, bs) in enumerate(zip(beat_times, beat_strengths)):
        is_downbeat = any(abs(bt - dt) < 0.05 for dt in downbeat_times)
        beats.append(BeatInfo(time=float(bt), strength=float(bs), is_downbeat=is_downbeat))
    
    downbeats = [b for b in beats if b.is_downbeat]
    
    # Energy curves
    print("📊 Computing energy curves...")
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)
    
    # Spectral centroid (brightness)
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    cent_times = librosa.frames_to_time(np.arange(len(cent)), sr=sr, hop_length=hop_length)
    
    # Interpolate all curves to common time base
    common_times = np.linspace(0, duration, num=max(len(rms_times), len(cent_times), len(onset_times)))
    
    rms_interp = np.interp(common_times, rms_times, rms)
    cent_interp = np.interp(common_times, cent_times, cent)
    onset_interp = np.interp(common_times, onset_times, onset_env)
    
    # Normalize curves to 0-1
    for curve in [rms_interp, cent_interp, onset_interp]:
        if curve.max() > 0:
            curve /= curve.max()
    
    return AudioAnalysis(
        duration=duration,
        sample_rate=sr,
        tempo=float(tempo),
        beats=beats,
        downbeats=downbeats,
        onset_times=onset_times,
        onset_strength=onset_env,
        rms_energy=rms_interp,
        spectral_centroid=cent_interp,
        times=common_times
    )


def save_analysis(analysis: AudioAnalysis, output_path: str):
    """Save analysis to JSON for caching/debugging."""
    data = {
        "duration": analysis.duration,
        "sample_rate": analysis.sample_rate,
        "tempo": analysis.tempo,
        "beats": [
            {"time": b.time, "strength": b.strength, "is_downbeat": b.is_downbeat}
            for b in analysis.beats
        ],
        "downbeats": [
            {"time": b.time, "strength": b.strength, "is_downbeat": b.is_downbeat}
            for b in analysis.downbeats
        ],
        "times": analysis.times.tolist(),
        "rms_energy": analysis.rms_energy.tolist(),
        "spectral_centroid": analysis.spectral_centroid.tolist(),
    }
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"💾 Analysis saved to: {output_path}")


def load_analysis(input_path: str) -> AudioAnalysis:
    """Load analysis from JSON cache."""
    with open(input_path, 'r') as f:
        data = json.load(f)
    
    beats = [BeatInfo(**b) for b in data["beats"]]
    downbeats = [BeatInfo(**b) for b in data["downbeats"]]
    
    return AudioAnalysis(
        duration=data["duration"],
        sample_rate=data["sample_rate"],
        tempo=data["tempo"],
        beats=beats,
        downbeats=downbeats,
        onset_times=np.array([]),  # Not cached
        onset_strength=np.array([]),
        rms_energy=np.array(data["rms_energy"]),
        spectral_centroid=np.array(data["spectral_centroid"]),
        times=np.array(data["times"])
    )


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        analysis = analyze_audio(sys.argv[1])
        print(f"\n📈 Results:")
        print(f"  Duration: {analysis.duration:.2f}s")
        print(f"  Tempo: {analysis.tempo:.1f} BPM")
        print(f"  Beats: {len(analysis.beats)}")
        print(f"  Downbeats: {len(analysis.downbeats)}")
        
        # Save for caching
        save_analysis(analysis, sys.argv[1] + ".analysis.json")
    else:
        print("Usage: python -m my_movie_maker.audio.analyzer <audio_file>")