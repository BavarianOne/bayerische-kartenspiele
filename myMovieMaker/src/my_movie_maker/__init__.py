"""
myMovieMaker: Offline movie maker - photos/videos synced to music beats.
Like muvee but fully offline, local, and customizable.
"""

__version__ = "0.1.0"
__author__ = "Your Name"

from .audio.analyzer import analyze_audio, AudioAnalysis, BeatInfo
from .media.manager import MediaManager, MediaItem
from .timeline.builder import Timeline, TimelineBuilder, TimelineClip, EffectParams, EffectType, TransitionType
from .effects.engine import apply_effect, apply_transition
from .render.renderer import render_timeline, RenderConfig

__all__ = [
    "analyze_audio",
    "AudioAnalysis", 
    "BeatInfo",
    "MediaManager",
    "MediaItem",
    "Timeline",
    "TimelineBuilder",
    "TimelineClip",
    "EffectParams",
    "EffectType",
    "TransitionType",
    "apply_effect",
    "apply_transition",
    "render_timeline",
    "RenderConfig",
]