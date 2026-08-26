"""
Timeline Engine: Maps media items to beats, defines effect parameters and transitions.
This is the core "brain" that decides what happens when.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
import random
import math


class EffectType(Enum):
    KEN_BURNS = "ken_burns"           # Slow zoom + pan on still image
    ZOOM_PAN = "zoom_pan"             # Dynamic zoom/pan synced to beat
    CROSSFADE = "crossfade"           # Crossfade between two clips
    CUT = "cut"                       # Hard cut on beat
    PULSE_ZOOM = "pulse_zoom"         # Quick zoom pulse on beat
    SLIDE = "slide"                   # Slide transition
    FADE_BLACK = "fade_black"         # Fade to/from black


class TransitionType(Enum):
    NONE = "none"
    CROSSFADE = "crossfade"
    CUT = "cut"
    SLIDE_LEFT = "slide_left"
    SLIDE_RIGHT = "slide_right"
    SLIDE_UP = "slide_up"
    SLIDE_DOWN = "slide_down"
    ZOOM_CROSSFADE = "zoom_crossfade"
    FADE_BLACK = "fade_black"


@dataclass
class EffectParams:
    """Parameters for a visual effect."""
    effect_type: EffectType
    # Ken Burns / Zoom Pan
    zoom_start: float = 1.0
    zoom_end: float = 1.0
    pan_start_x: float = 0.5        # 0-1 normalized
    pan_start_y: float = 0.5
    pan_end_x: float = 0.5
    pan_end_y: float = 0.5
    rotation_start: float = 0.0     # degrees
    rotation_end: float = 0.0
    # Crossfade
    crossfade_duration: float = 1.0
    # Pulse
    pulse_strength: float = 0.1
    pulse_frequency: float = 1.0    # pulses per beat
    # General
    easing: str = "ease_in_out"     # linear, ease_in, ease_out, ease_in_out, beat_snap
    intensity: float = 1.0          # Global intensity multiplier
    sync_to_beat: bool = True       # Whether effect params sync to beat grid
    
    def to_dict(self) -> dict:
        return {
            "effect_type": self.effect_type.value,
            "zoom_start": self.zoom_start,
            "zoom_end": self.zoom_end,
            "pan_start_x": self.pan_start_x,
            "pan_start_y": self.pan_start_y,
            "pan_end_x": self.pan_end_x,
            "pan_end_y": self.pan_end_y,
            "rotation_start": self.rotation_start,
            "rotation_end": self.rotation_end,
            "crossfade_duration": self.crossfade_duration,
            "pulse_strength": self.pulse_strength,
            "pulse_frequency": self.pulse_frequency,
            "easing": self.easing,
            "intensity": self.intensity,
            "sync_to_beat": self.sync_to_beat
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'EffectParams':
        data = data.copy()
        data['effect_type'] = EffectType(data['effect_type'])
        return cls(**data)


@dataclass
class TimelineClip:
    """A single clip on the timeline."""
    media_index: int                # Index into media list
    start_time: float               # Start time in seconds (absolute)
    duration: float                 # Duration in seconds
    effects: List[EffectParams] = field(default_factory=list)
    transition_in: TransitionType = TransitionType.NONE
    transition_in_duration: float = 0.5
    transition_out: TransitionType = TransitionType.NONE
    transition_out_duration: float = 0.5
    # Beat alignment
    align_to_beat: bool = True      # Snap start to nearest beat
    beat_offset: float = 0.0        # Offset from beat (in beats, e.g., 0.5 = off-beat)
    # Audio reactivity
    audio_reactive: bool = False    # Modulate effect by audio energy
    energy_modulation: float = 0.0  # How much energy affects zoom/pan (0-1)
    
    @property
    def end_time(self) -> float:
        return self.start_time + self.duration
    
    def to_dict(self) -> dict:
        return {
            "media_index": self.media_index,
            "start_time": self.start_time,
            "duration": self.duration,
            "effects": [e.to_dict() for e in self.effects],
            "transition_in": self.transition_in.value,
            "transition_in_duration": self.transition_in_duration,
            "transition_out": self.transition_out.value,
            "transition_out_duration": self.transition_out_duration,
            "align_to_beat": self.align_to_beat,
            "beat_offset": self.beat_offset,
            "audio_reactive": self.audio_reactive,
            "energy_modulation": self.energy_modulation
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'TimelineClip':
        data = data.copy()
        data['effects'] = [EffectParams.from_dict(e) for e in data.get('effects', [])]
        data['transition_in'] = TransitionType(data.get('transition_in', 'none'))
        data['transition_out'] = TransitionType(data.get('transition_out', 'none'))
        return cls(**data)


@dataclass
class Timeline:
    """Complete timeline with all clips and global settings."""
    clips: List[TimelineClip] = field(default_factory=list)
    # Global settings
    target_fps: int = 30
    output_width: int = 1920
    output_height: int = 1080
    background_color: tuple = (0, 0, 0)
    # Audio
    audio_path: str = ""
    audio_start_offset: float = 0.0  # Start audio at this time
    audio_loop: bool = False         # Loop audio to cover all clips
    # Style presets
    style: str = "dynamic"           # dynamic, cinematic, energetic, minimal
    # Title card (optional)
    title_card: Optional[Dict[str, Any]] = None  # {"title": "...", "subtitle": "...", "duration": 3.0, "font_size": 80, "font_color": (255,255,255), "bg_color": (0,0,0)}
    # Override style min clip duration
    min_clip_duration: Optional[float] = None
    
    def get_total_duration(self) -> float:
        if not self.clips:
            return 0.0
        return max(clip.end_time for clip in self.clips)
    
    def sort_clips(self):
        """Sort clips by start time."""
        self.clips.sort(key=lambda c: c.start_time)
    
    def to_dict(self) -> dict:
        data = {
            "clips": [c.to_dict() for c in self.clips],
            "target_fps": self.target_fps,
            "output_width": self.output_width,
            "output_height": self.output_height,
            "background_color": list(self.background_color),
            "audio_path": self.audio_path,
            "audio_start_offset": self.audio_start_offset,
            "audio_loop": self.audio_loop,
            "style": self.style
        }
        if self.title_card:
            data["title_card"] = self.title_card
        if self.min_clip_duration is not None:
            data["min_clip_duration"] = self.min_clip_duration
        return data
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Timeline':
        data = data.copy()
        data['clips'] = [TimelineClip.from_dict(c) for c in data.get('clips', [])]
        if 'background_color' in data:
            data['background_color'] = tuple(data['background_color'])
        if 'title_card' in data:
            data['title_card'] = data['title_card']
        return cls(**data)


class TimelineBuilder:
    """Builds timelines automatically from media and audio analysis."""
    
    def __init__(self, media_items: List, audio_analysis, style: str = "dynamic"):
        self.media_items = media_items
        self.audio = audio_analysis
        self.style = style
        self.clips: List[TimelineClip] = []
        
        # Style configurations
        self.styles = {
            "dynamic": {
                "clips_per_measure": 1,      # 1 clip per measure (4 beats)
                "prefer_crossfade": True,
                "ken_burns_probability": 0.7,
                "pulse_probability": 0.3,
                "cut_on_downbeat": True,
                "min_clip_duration": 3.0,
            },
            "cinematic": {
                "clips_per_measure": 0.5,    # 1 clip per 2 measures
                "prefer_crossfade": True,
                "ken_burns_probability": 0.9,
                "pulse_probability": 0.1,
                "cut_on_downbeat": False,
                "min_clip_duration": 5.0,
            },
            "energetic": {
                "clips_per_measure": 2,      # 2 clips per measure (every 2 beats)
                "prefer_crossfade": False,
                "ken_burns_probability": 0.3,
                "pulse_probability": 0.6,
                "cut_on_downbeat": True,
                "min_clip_duration": 0.5,
            },
            "minimal": {
                "clips_per_measure": 0.25,   # 1 clip per 4 measures
                "prefer_crossfade": True,
                "ken_burns_probability": 0.5,
                "pulse_probability": 0.0,
                "cut_on_downbeat": False,
                "min_clip_duration": 8.0,
            }
        }
    
    def build(self) -> Timeline:
        """Build automatic timeline based on style and audio analysis."""
        style_config = self.styles.get(self.style, self.styles["dynamic"])
        
        if not self.audio.beats:
            print("⚠️ No beats detected, using fallback timeline")
            return self._build_fallback_timeline()
        
        # Calculate clip duration based on style
        beats_per_clip = 4 / style_config["clips_per_measure"]  # 4 beats per measure
        avg_beat_interval = 60.0 / self.audio.tempo  # seconds per beat
        clip_duration = beats_per_clip * avg_beat_interval
        
        # Limit clip duration - use style-specific min or override
        min_duration = getattr(self, 'min_clip_duration_override', None)
        if min_duration is None:
            min_duration = style_config.get("min_clip_duration", 3.0)
        clip_duration = max(min_duration, min(clip_duration, 8.0))
        
        print(f"🎬 Building {self.style} timeline:")
        print(f"   Tempo: {self.audio.tempo:.1f} BPM, Beat interval: {avg_beat_interval:.3f}s")
        print(f"   Clip duration: {clip_duration:.2f}s ({beats_per_clip:.1f} beats)")
        
        # Use downbeats as primary sync points for FIRST clip only, then sequential
        sync_points = [b.time for b in self.audio.downbeats] if self.audio.downbeats else [b.time for b in self.audio.beats]
        
        # Start first clip at first downbeat (or 0)
        first_sync = sync_points[0] if sync_points else 0.0
        
        current_time = first_sync
        media_idx = 0
        
        # If audio_loop is enabled, don't limit to audio.duration
        max_time = float('inf') if self.audio_loop else self.audio.duration
        
        while media_idx < len(self.media_items) and current_time < max_time:
            media = self.media_items[media_idx]
            
            # Determine clip duration
            if media.is_video:
                actual_duration = min(media.duration, clip_duration * 2)
            else:
                actual_duration = clip_duration
            
            # Ensure we don't go past audio duration (unless looping)
            if not self.audio_loop and current_time + actual_duration > self.audio.duration:
                actual_duration = max(0.5, self.audio.duration - current_time)
                if actual_duration < 0.5:
                    break
            
            # Choose effects based on media type and style
            effects = self._choose_effects(media, style_config, len(self.clips))
            
            # Choose transitions
            trans_in = TransitionType.CROSSFADE if style_config["prefer_crossfade"] and media_idx > 0 else TransitionType.NONE
            trans_out = TransitionType.CROSSFADE if style_config["prefer_crossfade"] else TransitionType.CUT
            
            clip = TimelineClip(
                media_index=media_idx,
                start_time=current_time,
                duration=actual_duration,
                effects=effects,
                transition_in=trans_in,
                transition_in_duration=min(0.5, actual_duration * 0.2),
                transition_out=trans_out,
                transition_out_duration=min(0.5, actual_duration * 0.2),
                align_to_beat=True,
                audio_reactive=self.style in ["dynamic", "energetic"],
                energy_modulation=0.3 if self.style == "energetic" else 0.1
            )
            
            self.clips.append(clip)
            current_time += actual_duration
            media_idx += 1
        
        print(f"✅ Created {len(self.clips)} clips, total duration: {current_time:.2f}s")
        
        return Timeline(
                    clips=self.clips,
                    target_fps=30,
                    output_width=1920,
                    output_height=1080,
                    audio_path=getattr(self.audio, 'audio_path', ''),
                    audio_loop=getattr(self, 'audio_loop', False),
                    style=self.style,
                    min_clip_duration=getattr(self, 'min_clip_duration_override', None),
                    title_card=getattr(self, 'title_card_override', None)
                )
    
    def _choose_effects(self, media, style_config: dict, clip_index: int) -> List[EffectParams]:
            """Choose effects for a clip based on media type and style."""
            effects = []
            rng = random.Random(clip_index * 12345)  # Deterministic per clip
        
            if media.is_image:
                # Images get Ken Burns only (preserves aspect ratio)
                effects.append(self._random_ken_burns(rng, media))
            
                # NO pulse zoom - causes aspect ratio issues
            else:
                # Videos: mostly cuts, maybe subtle ken burns on static scenes
                if rng.random() < 0.2:
                    effects.append(self._random_ken_burns(rng, media, zoom_range=0.05))
        
            return effects
    
    def _random_ken_burns(self, rng: random.Random, media, zoom_range: float = 0.3) -> EffectParams:
    		"""Generate random Ken Burns parameters with proper fit zoom."""
    		output_w, output_h = 1920, 1080
	
    		# Compute fit zoom: zoom level where entire image fits in output
    		# zoom = output_dim / source_dim (1.0 = 1:1, <1 = zoom out to fit)
    		fit_zoom_w = output_w / media.width
    		fit_zoom_h = output_h / media.height
    		fit_zoom = min(fit_zoom_w, fit_zoom_h)
	
    		# Ken Burns zoom is RELATIVE TO LETTERBOXED IMAGE (1.0 = whole image visible)
    		# fit_zoom is already applied for letterboxing in renderer
    		# Start at 1.0 (full letterboxed visible), end at 1.15 (gentle crop in)
    		zoom_start = 1.0
    		zoom_end = 1.15
	
    		# Random pan (normalized 0-1, centered on image)
    		pan_start_x = rng.uniform(0.3, 0.7)
    		pan_start_y = rng.uniform(0.3, 0.7)
    		pan_end_x = rng.uniform(0.3, 0.7)
    		pan_end_y = rng.uniform(0.3, 0.7)
	
    		# Subtle rotation
    		rotation_start = rng.uniform(-2, 2)
    		rotation_end = rng.uniform(-2, 2)
	
    		return EffectParams(
    			effect_type=EffectType.KEN_BURNS,
    			zoom_start=zoom_start,
    			zoom_end=zoom_end,
    			pan_start_x=pan_start_x,
    			pan_start_y=pan_start_y,
    			pan_end_x=pan_end_x,
    			pan_end_y=pan_end_y,
    			rotation_start=rotation_start,
    			rotation_end=rotation_end,
    			easing="ease_in_out",
    		intensity=1.0,
    		sync_to_beat=False  # Ken Burns is continuous
    	)
    
    def _random_zoom_pan(self, rng: random.Random) -> EffectParams:
        """Generate random Zoom Pan (beat-synced) parameters."""
        return EffectParams(
            effect_type=EffectType.ZOOM_PAN,
            zoom_start=1.0,
            zoom_end=rng.uniform(1.05, 1.2),
            pan_start_x=rng.uniform(0.3, 0.7),
            pan_start_y=rng.uniform(0.3, 0.7),
            pan_end_x=rng.uniform(0.3, 0.7),
            pan_end_y=rng.uniform(0.3, 0.7),
            easing="beat_snap",
            intensity=1.0,
            sync_to_beat=True
        )
    
    def _build_fallback_timeline(self) -> Timeline:
        """Fallback when no beats detected."""
        clip_duration = 4.0  # 4 seconds per clip
        current_time = 0.0
        
        for i, media in enumerate(self.media_items):
            duration = clip_duration if media.is_image else min(media.duration, clip_duration * 2)
            
            if current_time + duration > 60:  # Max 60s fallback
                break
            
            effects = [self._random_ken_burns(random.Random(i), media)] if media.is_image else []
            
            clip = TimelineClip(
                media_index=i,
                start_time=current_time,
                duration=duration,
                effects=effects,
                transition_in=TransitionType.CROSSFADE if i > 0 else TransitionType.NONE,
                transition_out=TransitionType.CROSSFADE,
            )
            self.clips.append(clip)
            current_time += duration
        
        return Timeline(clips=self.clips, style=self.style)


def create_timeline_from_config(config: dict, media_items: List, audio_analysis) -> Timeline:
    """Create timeline from configuration dict (YAML/JSON)."""
    # If config has explicit clips, use them
    if "clips" in config and config["clips"]:
        timeline = Timeline.from_dict(config)
        return timeline
    
    # Otherwise auto-build
    style = config.get("style", "dynamic")
    builder = TimelineBuilder(media_items, audio_analysis, style)
    
    # Allow overriding clips_per_measure from config
    if "clips_per_measure" in config:
        builder.styles[style]["clips_per_measure"] = config["clips_per_measure"]
    
    # Allow overriding min_clip_duration from config
        if "min_clip_duration" in config:
            builder.min_clip_duration_override = config["min_clip_duration"]
    
        # Allow audio_loop from config
        if "audio_loop" in config:
            builder.audio_loop = config["audio_loop"]
    
        # Allow title_card from config
            if "title_card" in config:
                builder.title_card_override = config["title_card"]
                print(f"📝 Title card config loaded: {config['title_card'].get('title', '')}")
    
            return builder.build()


if __name__ == "__main__":
    # Test with mock data
    from my_movie_maker.audio.analyzer import AudioAnalysis, BeatInfo
    from my_movie_maker.media.manager import MediaItem
    import numpy as np
    
    # Mock audio analysis
    beats = [BeatInfo(i*0.5, 1.0, i%4==0) for i in range(40)]
    downbeats = [b for b in beats if b.is_downbeat]
    audio = AudioAnalysis(
        duration=30.0, sample_rate=22050, tempo=120.0,
        beats=beats, downbeats=downbeats,
        onset_times=np.array([]), onset_strength=np.array([]),
        rms_energy=np.ones(300), spectral_centroid=np.ones(300),
        times=np.linspace(0, 30, 300)
    )
    
    # Mock media
    media = [
        MediaItem(f"img{i}.jpg", "image", 1920, 1080, 0, 0) for i in range(10)
    ]
    
    # Build timeline
    builder = TimelineBuilder(media, audio, "dynamic")
    timeline = builder.build()
    
    print(f"\nTimeline: {len(timeline.clips)} clips")
    for i, clip in enumerate(timeline.clips):
        print(f"  Clip {i}: media={clip.media_index}, {clip.start_time:.2f}-{clip.end_time:.2f}s, effects={len(clip.effects)}")