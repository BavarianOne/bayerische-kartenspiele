"""
Renderer: Generates frames from timeline and encodes to video using FFmpeg.
Handles frame generation, transitions, audio sync, and H.264/MP4 output.
"""

import cv2
import numpy as np
import ffmpeg
import tempfile
import os
import shutil
from pathlib import Path
from typing import List, Optional, Generator, Tuple
from dataclasses import dataclass
from tqdm import tqdm
import math

from ..timeline.builder import Timeline, TimelineClip, TransitionType, EffectParams, EffectType
from ..media.manager import MediaManager, MediaItem
from ..audio.analyzer import AudioAnalysis, BeatInfo
from ..effects.engine import (
    apply_effect, apply_transition, KenBurnsEffect, ZoomPanEffect,
    CrossfadeEffect, PulseZoomEffect
)


@dataclass
class RenderConfig:
    """Configuration for rendering."""
    output_path: str
    fps: int = 30
    width: int = 1920
    height: int = 1080
    crf: int = 18              # Quality (lower = better, 18-23 typical)
    preset: str = "medium"     # Encoding speed preset
    audio_codec: str = "aac"
    audio_bitrate: str = "192k"
    pixel_format: str = "yuv420p"
    threads: int = 0           # 0 = auto
    # Progress
    show_progress: bool = True
    # Temp dir
    temp_dir: Optional[str] = None


class FrameGenerator:
    """Generates video frames from timeline."""
    
    def __init__(self, timeline: Timeline, media_items: List[MediaItem], 
                 audio_analysis: AudioAnalysis, media_manager: MediaManager,
                 config: RenderConfig):
        self.timeline = timeline
        self.media_items = media_items
        self.audio = audio_analysis
        self.media_manager = media_manager
        self.config = config
        
        self.fps = timeline.target_fps
        self.width = timeline.output_width
        self.height = timeline.output_height
        self.total_frames = int(timeline.get_total_duration() * self.fps)
        
        # Pre-compute beat info for fast lookup
        self.beat_times = np.array([b.time for b in audio_analysis.beats])
        self.downbeat_times = np.array([b.time for b in audio_analysis.downbeats])
        self.energy_curve = audio_analysis.rms_energy
        self.energy_times = audio_analysis.times
        
        # Cache for video frames
        self._video_frame_cache = {}
    
    def get_beat_phase(self, time: float) -> float:
        """Get phase within current beat (0-1)."""
        if len(self.beat_times) == 0:
            return 0.0
        
        # Find current beat
        idx = np.searchsorted(self.beat_times, time, side='right') - 1
        idx = max(0, min(idx, len(self.beat_times) - 1))
        
        beat_start = self.beat_times[idx]
        if idx + 1 < len(self.beat_times):
            beat_end = self.beat_times[idx + 1]
        else:
            beat_end = beat_start + (beat_start - self.beat_times[idx - 1]) if idx > 0 else beat_start + 0.5
        
        beat_duration = beat_end - beat_start
        if beat_duration <= 0:
            return 0.0
        
        return (time - beat_start) / beat_duration
    
    def get_energy_at_time(self, time: float) -> float:
        """Get audio energy (0-1) at given time."""
        if len(self.energy_times) == 0:
            return 0.5
        idx = np.searchsorted(self.energy_times, time, side='right') - 1
        idx = max(0, min(idx, len(self.energy_curve) - 1))
        return float(self.energy_curve[idx])
    
    def get_frame_for_clip(self, clip: TimelineClip, clip_progress: float, 
                           frame_time: float) -> np.ndarray:
        """Get the rendered frame for a clip at given progress."""
        media = self.media_items[clip.media_index]
        output_size = (self.width, self.height)
        
        if media.is_image:
            # Load image (cached by media manager)
            frame = cv2.imread(media.path)
            if frame is None:
                frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        else:
            # Video: get frame at specific time
            video_time = clip.start_time + clip_progress * clip.duration
            frame = self.media_manager.get_video_frame(media.path, video_time)
            if frame is None:
                frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        
        # Apply effects
        beat_phase = self.get_beat_phase(frame_time)
        energy = self.get_energy_at_time(frame_time)
        
        # Start with base frame
        result = frame
        
        # Apply each effect in sequence
        for effect_params in clip.effects:
            # Modify effect params based on audio if reactive
            if clip.audio_reactive and effect_params.effect_type in [EffectType.KEN_BURNS, EffectType.ZOOM_PAN]:
                # Modulate zoom by energy
                energy_mod = 1.0 + energy * effect_params.energy_modulation
                # Create modified params
                mod_params = EffectParams(
                    effect_type=effect_params.effect_type,
                    zoom_start=effect_params.zoom_start * energy_mod,
                    zoom_end=effect_params.zoom_end * energy_mod,
                    pan_start_x=effect_params.pan_start_x,
                    pan_start_y=effect_params.pan_start_y,
                    pan_end_x=effect_params.pan_end_x,
                    pan_end_y=effect_params.pan_end_y,
                    rotation_start=effect_params.rotation_start,
                    rotation_end=effect_params.rotation_end,
                    easing=effect_params.easing,
                    intensity=effect_params.intensity,
                    sync_to_beat=effect_params.sync_to_beat,
                    pulse_strength=effect_params.pulse_strength,
                    pulse_frequency=effect_params.pulse_frequency
                )
                result = apply_effect(result, mod_params, clip_progress, output_size, beat_phase)
            else:
                result = apply_effect(result, effect_params, clip_progress, output_size, beat_phase)
        
        return result
    
    def get_transition_frame(self, clip_a: TimelineClip, clip_b: TimelineClip,
                             trans_progress: float, frame_time: float) -> np.ndarray:
        """Get frame during transition between two clips."""
        # Get frames from both clips
        # For transition, clip_a is ending, clip_b is starting
        progress_a = 1.0  # End of clip_a
        progress_b = 0.0  # Start of clip_b
        
        frame_a = self.get_frame_for_clip(clip_a, progress_a, frame_time)
        frame_b = self.get_frame_for_clip(clip_b, progress_b, frame_time)
        
        # Apply transition
        trans_type = clip_a.transition_out.value if clip_a.transition_out != TransitionType.NONE else clip_b.transition_in.value
        duration = max(clip_a.transition_out_duration, clip_b.transition_in_duration)
        
        return apply_transition(frame_a, frame_b, trans_progress, trans_type, duration)
    
    def generate_frames(self) -> Generator[np.ndarray, None, None]:
        """Generate all frames for the timeline."""
        if not self.timeline.clips:
            # Generate black frames
            black = np.zeros((self.height, self.width, 3), dtype=np.uint8)
            for _ in range(self.total_frames):
                yield black
            return
        
        # Sort clips by start time
        clips = sorted(self.timeline.clips, key=lambda c: c.start_time)
        
        for frame_idx in range(self.total_frames):
            frame_time = frame_idx / self.fps
            
            # Find active clip(s)
            active_clips = [c for c in clips if c.start_time <= frame_time < c.end_time]
            starting_clips = [c for c in clips if abs(c.start_time - frame_time) < 1.0/self.fps]
            ending_clips = [c for c in clips if abs(c.end_time - frame_time) < 1.0/self.fps]
            
            if not active_clips and not starting_clips:
                # No active clip - black frame (or background)
                bg_color = self.timeline.background_color
                yield np.full((self.height, self.width, 3), bg_color, dtype=np.uint8)
                continue
            
            # Handle transitions
            if starting_clips and active_clips:
                # Transition from previous to new clip
                prev_clip = active_clips[0]
                new_clip = starting_clips[0]
                
                if prev_clip != new_clip:
                    # In transition
                    trans_duration = max(prev_clip.transition_out_duration, new_clip.transition_in_duration)
                    trans_start = new_clip.start_time
                    trans_progress = (frame_time - trans_start) / trans_duration
                    trans_progress = max(0.0, min(1.0, trans_progress))
                    
                    frame = self.get_transition_frame(prev_clip, new_clip, trans_progress, frame_time)
                    yield frame
                    continue
            
            # Normal clip rendering
            if active_clips:
                clip = active_clips[0]
                clip_progress = (frame_time - clip.start_time) / clip.duration
                clip_progress = max(0.0, min(1.0, clip_progress))
                
                frame = self.get_frame_for_clip(clip, clip_progress, frame_time)
                yield frame
            else:
                # Fallback
                yield np.zeros((self.height, self.width, 3), dtype=np.uint8)


class VideoRenderer:
    """Main renderer that orchestrates frame generation and FFmpeg encoding."""
    
    def __init__(self, config: RenderConfig):
        self.config = config
        self.temp_dir = config.temp_dir or tempfile.mkdtemp(prefix="muvee_render_")
        self.frames_dir = Path(self.temp_dir) / "frames"
        self.frames_dir.mkdir(parents=True, exist_ok=True)
    
    def render(self, timeline: Timeline, media_items: List[MediaItem], 
               audio_analysis: AudioAnalysis, media_manager: MediaManager) -> str:
        """
        Render timeline to video file.
        
        Returns:
            Path to output video file
        """
        print(f"🎬 Starting render: {self.config.output_path}")
        print(f"   Resolution: {timeline.output_width}x{timeline.output_height} @ {timeline.target_fps}fps")
        print(f"   Duration: {timeline.get_total_duration():.2f}s ({int(timeline.get_total_duration() * timeline.target_fps)} frames)")
        
        # Create frame generator
        generator = FrameGenerator(timeline, media_items, audio_analysis, media_manager, self.config)
        
        # Generate frames and encode with FFmpeg (piping frames directly)
        output_path = self._encode_with_ffmpeg(generator, timeline, audio_analysis)
        
        # Cleanup temp files
        self._cleanup()
        
        print(f"✅ Render complete: {output_path}")
        return output_path
    
    def _encode_with_ffmpeg(self, generator: FrameGenerator, 
                            timeline: Timeline, audio_analysis: AudioAnalysis) -> str:
        """Encode frames to video using FFmpeg with piped input."""
        
        # Prepare FFmpeg input for raw video frames
        fps = timeline.target_fps
        width = timeline.output_width
        height = timeline.output_height
        
        # Video input from pipe
        video_input = ffmpeg.input('pipe:', format='rawvideo', 
                                    pix_fmt='bgr24', s=f'{width}x{height}', r=fps)
        
        # Audio input
        audio_path = timeline.audio_path
        if audio_path and os.path.exists(audio_path):
            audio_input = ffmpeg.input(audio_path)
            # Trim audio to match video duration if needed
            video_duration = timeline.get_total_duration()
            audio_input = audio_input.filter('atrim', start=0, end=video_duration)
        else:
            # Generate silent audio
            audio_input = ffmpeg.input('anullsrc=r=44100:cl=stereo', format='lavfi', 
                                        t=timeline.get_total_duration())
        
        # Build output
        output = ffmpeg.output(
            video_input, audio_input, self.config.output_path,
            vcodec='libx264',
            crf=self.config.crf,
            preset=self.config.preset,
            pix_fmt=self.config.pixel_format,
            acodec=self.config.audio_codec,
            audio_bitrate=self.config.audio_bitrate,
            r=fps,
            threads=self.config.threads,
            **{'map': '0:v:0', 'map': '1:a:0'}
        ).overwrite_output()
        
        # Run FFmpeg with piped frames
        process = output.run_async(pipe_stdin=True, pipe_stdout=True, pipe_stderr=True)
        
        try:
            total_frames = generator.total_frames
            frame_iter = generator.generate_frames()
            
            if self.config.show_progress:
                frame_iter = tqdm(frame_iter, total=total_frames, 
                                  desc="🎞️ Rendering frames", unit="frame")
            
            for frame in frame_iter:
                # Write frame to FFmpeg stdin
                process.stdin.write(frame.tobytes())
            
            # Close stdin to signal end of input
            process.stdin.close()
            
            # Wait for completion
            stdout, stderr = process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='ignore') if stderr else "Unknown error"
                raise RuntimeError(f"FFmpeg failed (code {process.returncode}): {error_msg}")
            
        except Exception as e:
            process.kill()
            raise e
        
        return self.config.output_path
    
    def _cleanup(self):
        """Clean up temporary files."""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir, ignore_errors=True)


def render_timeline(timeline: Timeline, media_items: List[MediaItem],
                    audio_analysis: AudioAnalysis, media_manager: MediaManager,
                    output_path: str, **kwargs) -> str:
    """
    Convenience function to render a timeline.
    
    Args:
        timeline: The timeline to render
        media_items: List of media items
        audio_analysis: Audio analysis for beat sync
        media_manager: Media manager for loading frames
        output_path: Output video path
        **kwargs: Additional RenderConfig options
    
    Returns:
        Path to rendered video
    """
    config = RenderConfig(output_path=output_path, **kwargs)
    renderer = VideoRenderer(config)
    return renderer.render(timeline, media_items, audio_analysis, media_manager)


if __name__ == "__main__":
    # Quick test
    print("Renderer module loaded successfully")
    print("Usage: from my_movie_maker.render import render_timeline")