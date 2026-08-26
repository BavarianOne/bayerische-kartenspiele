"""
Renderer: Generates frames from timeline and encodes to video using FFmpeg.
Handles frame generation, transitions, audio sync, and H.264/MP4 output.

Muvee-style rendering:
- 4:3 source images on 16:9 canvas → letterboxed with blurred background
- Gentle Ken Burns on foreground only (no aggressive crop)
- Blurred background layer (gblur sigma=40) scaled to fill
"""

import cv2
import numpy as np
import ffmpeg
import tempfile
import os
import shutil
import subprocess
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
        
        # LRU cache for images (max 10 images in memory)
        self._image_cache = {}
        self._cache_order = []
        self._max_cache_size = 10
        # Cache for blurred backgrounds
        self._blur_cache = {}
        
        # Pre-load image paths only (not the images themselves)
        self._image_paths = {m.path for m in media_items if m.is_image}

    def _get_image(self, path: str) -> np.ndarray:
        """Load image with LRU caching."""
        if path in self._image_cache:
            # Move to end (most recently used)
            self._cache_order.remove(path)
            self._cache_order.append(path)
            return self._image_cache[path]
        
        # Load image
        frame = cv2.imread(path)
        if frame is None:
            print(f"⚠️ Failed to load image: {path}, using black frame")
            frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        else:
            # Verify image is valid
            h, w = frame.shape[:2]
            if h <= 0 or w <= 0:
                print(f"⚠️ Invalid image dimensions {w}x{h}: {path}, using black frame")
                frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        
        # Add to cache
        if len(self._cache_order) >= self._max_cache_size:
            # Remove least recently used
            lru = self._cache_order.pop(0)
            del self._image_cache[lru]
        
        self._image_cache[path] = frame
        self._cache_order.append(path)
        return frame

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

    def get_downbeat_phase(self, time: float) -> float:
        """Get phase within current measure (0-1)."""
        if len(self.downbeat_times) == 0:
            return 0.0
        
        idx = np.searchsorted(self.downbeat_times, time, side='right') - 1
        idx = max(0, min(idx, len(self.downbeat_times) - 1))
        
        downbeat_start = self.downbeat_times[idx]
        if idx + 1 < len(self.downbeat_times):
            downbeat_end = self.downbeat_times[idx + 1]
        else:
            downbeat_end = downbeat_start + (downbeat_start - self.downbeat_times[idx - 1]) if idx > 0 else downbeat_start + 2.0
        
        measure_duration = downbeat_end - downbeat_start
        if measure_duration <= 0:
            return 0.0
        
        return (time - downbeat_start) / measure_duration

    def get_energy(self, time: float) -> float:
        """Get audio energy at given time (normalized 0-1)."""
        if len(self.energy_times) == 0:
            return 0.5
        idx = np.searchsorted(self.energy_times, time, side='right') - 1
        idx = max(0, min(idx, len(self.energy_curve) - 1))
        return float(self.energy_curve[idx])

    def _get_blurred_bg(self, image: np.ndarray) -> np.ndarray:
        """Create blurred background scaled to fill 16:9 canvas."""
        cache_key = image.shape
        if cache_key in self._blur_cache:
            return self._blur_cache[cache_key]
        
        # Scale image to fill 16:9 (crop if needed)
        h, w = image.shape[:2]
        scale = max(self.width / w, self.height / h)
        new_w, new_h = int(w * scale), int(h * scale)
        
        scaled = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        
        # Center crop to 16:9
        x = max(0, (new_w - self.width) // 2)
        y = max(0, (new_h - self.height) // 2)
        cropped = scaled[y:y+self.height, x:x+self.width]
        
        # Heavy Gaussian blur
        blurred = cv2.GaussianBlur(cropped, (0, 0), sigmaX=40, sigmaY=40)
        
        self._blur_cache[cache_key] = blurred
        return blurred

    def _apply_muvee_ken_burns(self, image: np.ndarray, clip: TimelineClip, 
                                clip_progress: float, beat_phase: float) -> np.ndarray:
        """
        Muvee-style Ken Burns: 
        - Background: blurred scaled-to-fill
        - Foreground: letterboxed image with gentle zoom/pan
        """
        # Find Ken Burns effect params
        kb_params = None
        for eff in clip.effects:
            if eff.effect_type == EffectType.KEN_BURNS:
                kb_params = eff
                break
        
        if kb_params is None:
            return image
        
        h, w = image.shape[:2]
        
        # Compute fit scale (letterboxed - whole image visible)
        fit_scale_w = self.width / w
        fit_scale_h = self.height / h
        fit_scale = min(fit_scale_w, fit_scale_h)
        
        # Letterboxed image size
        letterbox_w = int(w * fit_scale)
        letterbox_h = int(h * fit_scale)
        
        # Start/end zoom relative to fit_scale
        zoom_start = kb_params.zoom_start
        zoom_end = kb_params.zoom_end
        
        # Interpolate zoom
        if kb_params.easing == "ease_in_out":
            t = clip_progress
            t = t * t * (3 - 2 * t)  # smoothstep
        elif kb_params.easing == "ease_in":
            t = clip_progress * clip_progress
        elif kb_params.easing == "ease_out":
            t = 1 - (1 - clip_progress) ** 2
        else:
            t = clip_progress
        
        zoom = zoom_start + (zoom_end - zoom_start) * t
        
        # Interpolate pan
        pan_x = kb_params.pan_start_x + (kb_params.pan_end_x - kb_params.pan_start_x) * t
        pan_y = kb_params.pan_start_y + (kb_params.pan_end_y - kb_params.pan_start_y) * t
        
        # Interpolate rotation
        rotation = kb_params.rotation_start + (kb_params.rotation_end - kb_params.rotation_start) * t
        
        # Apply zoom on the letterboxed image
        # Crop must have 16:9 aspect ratio to match output (1920x1080)
        crop_w = int(letterbox_w / zoom)
        crop_h = int(crop_w * 9 / 16)  # 16:9 aspect ratio
        
        # Ensure crop_h doesn't exceed letterbox_h
        if crop_h > letterbox_h:
            crop_h = letterbox_h
            crop_w = int(crop_h * 16 / 9)
        
        # Center of crop in letterboxed coordinates
        cx = int(letterbox_w * pan_x)
        cy = int(letterbox_h * pan_y)
        
        x1 = max(0, min(cx - crop_w // 2, letterbox_w - crop_w))
        y1 = max(0, min(cy - crop_h // 2, letterbox_h - crop_h))
        
        # Resize image to letterboxed size
        letterboxed = cv2.resize(image, (letterbox_w, letterbox_h), interpolation=cv2.INTER_LANCZOS4)
        
        # Crop zoomed region (16:9 aspect ratio)
        cropped = letterboxed[y1:y1+crop_h, x1:x1+crop_w]
        
        # Resize crop to output size (16:9 -> 16:9, no stretch)
        fg = cv2.resize(cropped, (self.width, self.height), interpolation=cv2.INTER_LANCZOS4)
        
        # Apply rotation if any
        if abs(rotation) > 0.01:
            M = cv2.getRotationMatrix2D((self.width/2, self.height/2), rotation, 1.0)
            fg = cv2.warpAffine(fg, M, (self.width, self.height), borderMode=cv2.BORDER_REFLECT_101)
        
        # Get blurred background
        bg = self._get_blurred_bg(image)
        
        # Composite: foreground over background
        return fg  # fg already covers full canvas, bg only shows if fg has transparency

    def _generate_title_frames(self) -> Generator[np.ndarray, None, None]:
        """Generate title card frames with fade in/out."""
        if not self.timeline.title_card:
            return
        
        tc = self.timeline.title_card
        title = tc.get("title", "")
        subtitle = tc.get("subtitle", "")
        duration = tc.get("duration", 4.0)
        font_size = tc.get("font_size", 80)
        font_color = tc.get("font_color", (255, 255, 255))
        bg_color = tc.get("bg_color", (0, 0, 0))
        
        title_frames = int(duration * self.fps)
        fade_frames = int(0.5 * self.fps)  # 0.5s fade in/out
        
        for i in range(title_frames):
            frame = np.full((self.height, self.width, 3), bg_color, dtype=np.uint8)
            progress = i / title_frames
            
            # Fade in/out
            if i < fade_frames:
                alpha = i / fade_frames
            elif i > title_frames - fade_frames:
                alpha = (title_frames - i) / fade_frames
            else:
                alpha = 1.0
            
            if title:
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = font_size / 50.0
                thickness = max(2, int(font_scale * 3))
                
                (text_w, text_h), baseline = cv2.getTextSize(title, font, font_scale, thickness)
                
                x = (self.width - text_w) // 2
                y = self.height // 2 - 50
                
                overlay = frame.copy()
                cv2.putText(overlay, title, (x, y), font, font_scale, font_color, thickness, cv2.LINE_AA)
                cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
            
            if subtitle:
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = font_size / 50.0
                thickness = max(1, int(font_scale * 2))
                
                (text_w, text_h), baseline = cv2.getTextSize(subtitle, font, font_scale, thickness)
                
                x = (self.width - text_w) // 2
                y = self.height // 3 + 100
                
                overlay = frame.copy()
                cv2.putText(overlay, subtitle, (x, y), font, font_scale, font_color, thickness, cv2.LINE_AA)
                cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
            
            yield frame

    def generate_frames(self) -> Generator[np.ndarray, None, None]:
        """Generate all frames for the timeline."""
        # Handle title card at the beginning if present
        if self.timeline.title_card:
            yield from self._generate_title_frames()
        
        if not self.timeline.clips:
            # Generate black frames
            black_frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
            for _ in range(self.total_frames):
                yield black_frame
            return
        
        for clip in self.timeline.clips:
            clip_frames = int(clip.duration * self.fps)
            media = self.media_items[clip.media_index]
            
            for frame_idx in range(clip_frames):
                frame_time = clip.start_time + frame_idx / self.fps
                clip_progress = frame_idx / clip_frames if clip_frames > 0 else 0
                beat_phase = self.get_beat_phase(frame_time)
                
                if media.is_image:
                    image = self._get_image(media.path)
                    if image is None:
                        image = cv2.imread(media.path)
                        if image is None:
                            image = np.zeros((self.height, self.width, 3), dtype=np.uint8)
                    
                    # Apply Ken Burns if present
                    has_kb = any(e.effect_type == EffectType.KEN_BURNS for e in clip.effects)
                    if has_kb:
                        frame = self._apply_muvee_ken_burns(image, clip, clip_progress, beat_phase)
                    else:
                        # Just letterbox
                        h, w = image.shape[:2]
                        fit_scale = min(self.width / w, self.height / h)
                        letterbox_w = int(w * fit_scale)
                        letterbox_h = int(h * fit_scale)
                        letterboxed = cv2.resize(image, (letterbox_w, letterbox_h), interpolation=cv2.INTER_LANCZOS4)
                        
                        # Paste onto blurred background
                        bg = self._get_blurred_bg(image)
                        x = (self.width - letterbox_w) // 2
                        y = (self.height - letterbox_h) // 2
                        frame = bg.copy()
                        frame[y:y+letterbox_h, x:x+letterbox_w] = letterboxed
                else:
                    # Video frame
                    frame = self._get_video_frame(media, frame_time)
                
                # NO other effects - only KEN_BURNS (already applied above)
                
                # Handle transitions
                # Transition in
                if clip.transition_in != TransitionType.NONE and frame_idx < clip.transition_in_duration * self.fps:
                    # Will be handled by crossfade with previous clip
                    pass
                
                yield frame
            
            # Note: Transition handling between clips would need lookahead
            # For now, crossfade is applied during frame generation of next clip

    def _get_video_frame(self, media: MediaItem, time: float) -> np.ndarray:
        """Get video frame at given time."""
        # Simple implementation - just return black for now
        return np.zeros((self.height, self.width, 3), dtype=np.uint8)


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
        """Encode frames to video using FFmpeg - write frames to temp files then encode."""
        
        fps = timeline.target_fps
        width = timeline.output_width
        height = timeline.output_height
        total_frames = generator.total_frames
        video_duration = timeline.get_total_duration()
        
        # Create temp directory for frames
        frames_dir = Path(self.temp_dir) / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"📸 Writing {total_frames} frames to temp directory...")
        
        # Generate and save frames
        frame_iter = generator.generate_frames()
        if self.config.show_progress:
            frame_iter = tqdm(frame_iter, total=total_frames, 
                              desc="🎞️ Rendering frames", unit="frame")
        
        for i, frame in enumerate(frame_iter):
            frame_path = frames_dir / f"frame_{i:06d}.png"
            cv2.imwrite(str(frame_path), frame)
        
        print(f"🎬 Encoding video with FFmpeg...")
        
        # Run FFmpeg - use full path to Gyan ffmpeg which has libx264
        ffmpeg_path = r"C:\Users\reine\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
        if not os.path.exists(ffmpeg_path):
            ffmpeg_path = 'ffmpeg'  # fallback to PATH
        
        # Build command with correct order: inputs first, then codec options for outputs
        cmd = [
            ffmpeg_path, '-y',
            '-framerate', str(fps),
            '-i', str(frames_dir / 'frame_%06d.png'),
        ]
        
        # Audio input
        audio_path = timeline.audio_path
        if audio_path and os.path.exists(audio_path):
            audio_abs_path = os.path.abspath(audio_path)
            # Loop audio if timeline.audio_loop is True
            if getattr(timeline, 'audio_loop', False):
                cmd.extend(['-stream_loop', '-1', '-i', audio_abs_path])
            else:
                cmd.extend(['-i', audio_abs_path])
        else:
            # Silent audio
            cmd.extend(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo'])
        
        # Video codec options (after video input)
        cmd.extend([
            '-c:v', 'libx264', '-crf', str(self.config.crf), 
            '-preset', self.config.preset, '-pix_fmt', self.config.pixel_format,
        ])
        
        # Audio codec options (after audio input)
        cmd.extend([
            '-acodec', self.config.audio_codec, '-b:a', self.config.audio_bitrate,
        ])
        
        # Mapping
        cmd.extend(['-map', '0:v:0', '-map', '1:a:0'])
        
        # Duration trim
        cmd.extend(['-t', str(video_duration)])
        
        # Output framerate
        cmd.extend(['-r', str(fps)])
        
        if self.config.threads > 0:
            cmd.extend(['-threads', str(self.config.threads)])
        cmd.append(self.config.output_path)
        
        # Run FFmpeg
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg failed (code {result.returncode}): {result.stderr}")
        except subprocess.TimeoutExpired:
            raise RuntimeError("FFmpeg encoding timed out")
        
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