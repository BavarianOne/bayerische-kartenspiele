"""
Effects Engine: Ken Burns, Crossfade, Zoom Pan, Pulse Zoom - all implemented with OpenCV.
These generate transformed frames given a source image/frame and time progress.
"""

import cv2
import numpy as np
from typing import Optional, Tuple
from dataclasses import dataclass
import math

from ..timeline.builder import EffectParams, EffectType


@dataclass
class TransformParams:
    """Complete transformation parameters for a frame."""
    # Affine transform
    matrix: np.ndarray          # 2x3 affine matrix
    output_size: Tuple[int, int]  # (width, height)
    # Blending
    alpha: float = 1.0          # Global opacity
    # For crossfade
    blend_frame: Optional[np.ndarray] = None
    blend_alpha: float = 0.0


def easing_function(t: float, easing: str) -> float:
    """Apply easing function to normalized time t (0-1)."""
    t = max(0.0, min(1.0, t))
    
    if easing == "linear":
        return t
    elif easing == "ease_in":
        return t * t
    elif easing == "ease_out":
        return 1 - (1 - t) * (1 - t)
    elif easing == "ease_in_out":
        return 3 * t * t - 2 * t * t * t
    elif easing == "ease_in_cubic":
        return t * t * t
    elif easing == "ease_out_cubic":
        return 1 - (1 - t) ** 3
    elif easing == "ease_in_out_cubic":
        return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2
    elif easing == "beat_snap":
        # Snap to nearest beat subdivision (for beat-synced effects)
        # This is handled at timeline level, here just return t
        return t
    else:
        return t


def lerp(a: float, b: float, t: float) -> float:
    """Linear interpolation."""
    return a + (b - a) * t


def lerp_point(ax: float, ay: float, bx: float, by: float, t: float) -> Tuple[float, float]:
    """Linear interpolation between two points."""
    return (lerp(ax, bx, t), lerp(ay, by, t))


class KenBurnsEffect:
    """Classic Ken Burns effect: slow zoom + pan on still images."""
    
    @staticmethod
    def compute_transform(frame: np.ndarray, params: EffectParams, 
                          progress: float, output_size: Tuple[int, int]) -> TransformParams:
        """
        Compute Ken Burns transform for given progress (0-1).
        
        Args:
            frame: Source image (H, W, 3)
            params: Ken Burns effect parameters
            progress: Normalized time progress (0-1)
            output_size: Target output (width, height)
            
        Returns:
            TransformParams with affine matrix
        """
        h, w = frame.shape[:2]
        out_w, out_h = output_size
        
        # Apply easing
        t = easing_function(progress, params.easing)
        
        # Interpolate zoom
        zoom = lerp(params.zoom_start, params.zoom_end, t)
        
        # Interpolate pan (normalized 0-1)
        pan_x = lerp(params.pan_start_x, params.pan_end_x, t)
        pan_y = lerp(params.pan_start_y, params.pan_end_y, t)
        
        # Interpolate rotation
        rotation = lerp(params.rotation_start, params.rotation_end, t)
        rad = math.radians(rotation)
        
        # Calculate source region
        # We want to show a region of size (out_w/zoom, out_h/zoom) from the source
        src_w = out_w / zoom
        src_h = out_h / zoom
        
        # Center of source region in source coordinates (0-1 normalized)
        cx = pan_x * w
        cy = pan_y * h
        
        # Source rectangle corners (before rotation)
        half_w = src_w / 2
        half_h = src_h / 2
        
        # Build transformation matrix
        # Step 1: Translate to center of source region
        # Step 2: Rotate
        # Step 3: Scale
        # Step 4: Translate to output center
        
        # OpenCV gets affine matrix from 3 point correspondences
        # Source points (in source image coordinates)
        src_pts = np.array([
            [cx - half_w, cy - half_h],  # top-left
            [cx + half_w, cy - half_h],  # top-right
            [cx - half_w, cy + half_h],  # bottom-left
        ], dtype=np.float32)
        
        # Apply rotation to source points
        cos_r = math.cos(rad)
        sin_r = math.sin(rad)
        rotated_pts = []
        for px, py in src_pts:
            dx = px - cx
            dy = py - cy
            rx = dx * cos_r - dy * sin_r + cx
            ry = dx * sin_r + dy * cos_r + cy
            rotated_pts.append([rx, ry])
        
        src_pts = np.array(rotated_pts, dtype=np.float32)
        
        # Destination points (in output image coordinates)
        dst_pts = np.array([
            [0, 0],
            [out_w, 0],
            [0, out_h],
        ], dtype=np.float32)
        
        # Compute affine matrix
        matrix = cv2.getAffineTransform(src_pts, dst_pts)
        
        return TransformParams(
            matrix=matrix,
            output_size=output_size,
            alpha=params.intensity
        )
    
    @staticmethod
    def apply(frame: np.ndarray, params: EffectParams, 
              progress: float, output_size: Tuple[int, int]) -> np.ndarray:
        """Apply Ken Burns effect and return transformed frame."""
        transform = KenBurnsEffect.compute_transform(frame, params, progress, output_size)
        result = cv2.warpAffine(
            frame, transform.matrix, transform.output_size,
            flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101
        )
        return result


class ZoomPanEffect:
    """Beat-synced dynamic zoom/pan effect."""
    
    @staticmethod
    def compute_transform(frame: np.ndarray, params: EffectParams,
                          progress: float, output_size: Tuple[int, int],
                          beat_progress: float = 0.0) -> TransformParams:
        """
        Compute Zoom Pan transform.
        
        Args:
            frame: Source image
            params: Effect parameters
            progress: Clip progress (0-1)
            output_size: Target size
            beat_progress: Progress within current beat (0-1), for beat-snapping
        """
        h, w = frame.shape[:2]
        out_w, out_h = output_size
        
        # For beat-snap easing, use beat_progress for zoom pulses
        if params.sync_to_beat and params.easing == "beat_snap":
            # Pulse zoom on each beat
            pulse = math.sin(beat_progress * math.pi * 2 * params.pulse_frequency)
            t = progress + pulse * params.pulse_strength
            t = max(0.0, min(1.0, t))
        else:
            t = easing_function(progress, params.easing)
        
        # Interpolate parameters
        zoom = lerp(params.zoom_start, params.zoom_end, t)
        pan_x = lerp(params.pan_start_x, params.pan_end_x, t)
        pan_y = lerp(params.pan_start_y, params.pan_end_y, t)
        rotation = lerp(params.rotation_start, params.rotation_end, t)
        rad = math.radians(rotation)
        
        # Source region size
        src_w = out_w / zoom
        src_h = out_h / zoom
        
        # Center in source
        cx = pan_x * w
        cy = pan_y * h
        
        # Source points
        half_w = src_w / 2
        half_h = src_h / 2
        src_pts = np.array([
            [cx - half_w, cy - half_h],
            [cx + half_w, cy - half_h],
            [cx - half_w, cy + half_h],
        ], dtype=np.float32)
        
        # Apply rotation
        cos_r = math.cos(rad)
        sin_r = math.sin(rad)
        rotated_pts = []
        for px, py in src_pts:
            dx = px - cx
            dy = py - cy
            rx = dx * cos_r - dy * sin_r + cx
            ry = dx * sin_r + dy * cos_r + cy
            rotated_pts.append([rx, ry])
        
        src_pts = np.array(rotated_pts, dtype=np.float32)
        
        # Destination points
        dst_pts = np.array([
            [0, 0],
            [out_w, 0],
            [0, out_h],
        ], dtype=np.float32)
        
        matrix = cv2.getAffineTransform(src_pts, dst_pts)
        
        return TransformParams(
            matrix=matrix,
            output_size=output_size,
            alpha=params.intensity
        )
    
    @staticmethod
    def apply(frame: np.ndarray, params: EffectParams,
              progress: float, output_size: Tuple[int, int],
              beat_progress: float = 0.0) -> np.ndarray:
        transform = ZoomPanEffect.compute_transform(frame, params, progress, output_size, beat_progress)
        result = cv2.warpAffine(
            frame, transform.matrix, transform.output_size,
            flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101
        )
        return result


class CrossfadeEffect:
    """Crossfade transition between two frames."""
    
    @staticmethod
    def apply(frame_a: np.ndarray, frame_b: np.ndarray, 
              progress: float, params: EffectParams) -> np.ndarray:
        """
        Crossfade from frame_a to frame_b.
        
        Args:
            frame_a: First frame (start)
            frame_b: Second frame (end)
            progress: Transition progress (0-1, 0=frame_a, 1=frame_b)
            params: Crossfade parameters (uses crossfade_duration for timing)
        """
        # Ensure same size
        if frame_a.shape != frame_b.shape:
            frame_b = cv2.resize(frame_b, (frame_a.shape[1], frame_a.shape[0]))
        
        t = easing_function(progress, params.easing)
        alpha = 1.0 - t  # frame_a weight
        beta = t         # frame_b weight
        
        result = cv2.addWeighted(frame_a, alpha, frame_b, beta, 0)
        return result


class PulseZoomEffect:
    """Quick zoom pulse synchronized to beats."""
    
    @staticmethod
    def apply(frame: np.ndarray, params: EffectParams,
              progress: float, output_size: Tuple[int, int],
              beat_phase: float = 0.0) -> np.ndarray:
        """
        Apply pulse zoom.
        
        Args:
            frame: Source frame
            params: Pulse parameters
            progress: Clip progress
            output_size: Target size
            beat_phase: Phase within beat cycle (0-1)
        """
        h, w = frame.shape[:2]
        out_w, out_h = output_size
        
        # Pulse based on beat phase
        pulse = math.sin(beat_phase * math.pi * 2 * params.pulse_frequency)
        zoom_mod = 1.0 + pulse * params.pulse_strength * params.intensity
        
        # Base zoom from progress
        base_zoom = lerp(params.zoom_start, params.zoom_end, progress)
        zoom = base_zoom * zoom_mod
        
        # Center crop with zoom
        src_w = out_w / zoom
        src_h = out_h / zoom
        
        cx = w / 2
        cy = h / 2
        
        half_w = src_w / 2
        half_h = src_h / 2
        
        src_pts = np.array([
            [cx - half_w, cy - half_h],
            [cx + half_w, cy - half_h],
            [cx - half_w, cy + half_h],
        ], dtype=np.float32)
        
        dst_pts = np.array([
            [0, 0],
            [out_w, 0],
            [0, out_h],
        ], dtype=np.float32)
        
        matrix = cv2.getAffineTransform(src_pts, dst_pts)
        
        result = cv2.warpAffine(
            frame, matrix, output_size,
            flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101
        )
        
        return result


class SlideTransition:
    """Slide transition between clips."""
    
    @staticmethod
    def apply(frame_a: np.ndarray, frame_b: np.ndarray,
              progress: float, direction: str = "left") -> np.ndarray:
        """Slide frame_b over frame_a (or reverse)."""
        h, w = frame_a.shape[:2]
        
        if frame_b.shape != frame_a.shape:
            frame_b = cv2.resize(frame_b, (w, h))
        
        t = easing_function(progress, "ease_in_out")
        
        if direction == "left":
            # frame_b slides in from right
            offset = int(w * (1 - t))
            result = frame_a.copy()
            result[:, :w-offset] = frame_b[:, offset:]
            result[:, w-offset:] = frame_a[:, w-offset:]
        elif direction == "right":
            offset = int(w * t)
            result = frame_a.copy()
            result[:, offset:] = frame_b[:, :w-offset]
            result[:, :offset] = frame_a[:, :offset]
        elif direction == "up":
            offset = int(h * (1 - t))
            result = frame_a.copy()
            result[:h-offset, :] = frame_b[offset:, :]
            result[h-offset:, :] = frame_a[h-offset:, :]
        elif direction == "down":
            offset = int(h * t)
            result = frame_a.copy()
            result[offset:, :] = frame_b[:h-offset, :]
            result[:offset, :] = frame_a[:offset, :]
        else:
            result = CrossfadeEffect.apply(frame_a, frame_b, progress, 
                                           EffectParams(effect_type=EffectType.CROSSFADE))
        
        return result


class FadeBlackTransition:
    """Fade to/from black."""
    
    @staticmethod
    def apply(frame: np.ndarray, progress: float, fade_in: bool = True) -> np.ndarray:
        """Fade frame to/from black."""
        t = easing_function(progress, "ease_in_out")
        if not fade_in:
            t = 1.0 - t
        
        # Blend with black
        black = np.zeros_like(frame)
        result = cv2.addWeighted(frame, t, black, 1.0 - t, 0)
        return result


# Effect dispatcher
def apply_effect(frame: np.ndarray, params: EffectParams, 
                 progress: float, output_size: Tuple[int, int],
                 beat_phase: float = 0.0,
                 next_frame: Optional[np.ndarray] = None,
                 transition_progress: float = 0.0) -> np.ndarray:
    """
    Main effect dispatcher - applies the appropriate effect.
    
    Args:
        frame: Current frame
        params: Effect parameters
        progress: Clip progress (0-1)
        output_size: Target output size
        beat_phase: Current beat phase (0-1) for beat-synced effects
        next_frame: Next clip's frame (for transitions)
        transition_progress: Transition progress (0-1)
    """
    if params.effect_type == EffectType.KEN_BURNS:
        return KenBurnsEffect.apply(frame, params, progress, output_size)
    
    elif params.effect_type == EffectType.ZOOM_PAN:
        return ZoomPanEffect.apply(frame, params, progress, output_size, beat_phase)
    
    elif params.effect_type == EffectType.PULSE_ZOOM:
        return PulseZoomEffect.apply(frame, params, progress, output_size, beat_phase)
    
    elif params.effect_type == EffectType.CROSSFADE and next_frame is not None:
        return CrossfadeEffect.apply(frame, next_frame, transition_progress, params)
    
    elif params.effect_type == EffectType.CUT:
        # Hard cut - just return frame (handled at timeline level)
        return frame
    
    else:
        # Default: just resize to output
        return cv2.resize(frame, output_size, interpolation=cv2.INTER_LANCZOS4)


def apply_transition(frame_a: np.ndarray, frame_b: np.ndarray,
                     progress: float, trans_type: str, 
                     duration: float = 1.0) -> np.ndarray:
    """Apply transition between two frames."""
    from ..timeline.builder import TransitionType
    
    try:
        ttype = TransitionType(trans_type)
    except:
        ttype = TransitionType.CROSSFADE
    
    if ttype == TransitionType.CROSSFADE:
        params = EffectParams(effect_type=EffectType.CROSSFADE, crossfade_duration=duration)
        return CrossfadeEffect.apply(frame_a, frame_b, progress, params)
    
    elif ttype in [TransitionType.SLIDE_LEFT, TransitionType.SLIDE_RIGHT,
                   TransitionType.SLIDE_UP, TransitionType.SLIDE_DOWN]:
        direction = ttype.value.replace("slide_", "")
        return SlideTransition.apply(frame_a, frame_b, progress, direction)
    
    elif ttype == TransitionType.FADE_BLACK:
        if progress < 0.5:
            # Fade out frame_a
            return FadeBlackTransition.apply(frame_a, progress * 2, fade_in=False)
        else:
            # Fade in frame_b
            return FadeBlackTransition.apply(frame_b, (progress - 0.5) * 2, fade_in=True)
    
    elif ttype == TransitionType.ZOOM_CROSSFADE:
        # Zoom crossfade - both frames zoom during transition
        h, w = frame_a.shape[:2]
        zoom = 1.0 + 0.1 * math.sin(progress * math.pi)
        
        # Apply zoom to both
        src_w = w / zoom
        src_h = h / zoom
        cx, cy = w / 2, h / 2
        
        src_pts = np.array([
            [cx - src_w/2, cy - src_h/2],
            [cx + src_w/2, cy - src_h/2],
            [cx - src_w/2, cy + src_h/2],
        ], dtype=np.float32)
        
        dst_pts = np.array([[0, 0], [w, 0], [0, h]], dtype=np.float32)
        matrix = cv2.getAffineTransform(src_pts, dst_pts)
        
        zoomed_a = cv2.warpAffine(frame_a, matrix, (w, h), flags=cv2.INTER_LANCZOS4)
        zoomed_b = cv2.warpAffine(frame_b, matrix, (w, h), flags=cv2.INTER_LANCZOS4)
        
        return CrossfadeEffect.apply(zoomed_a, zoomed_b, progress,
                                     EffectParams(effect_type=EffectType.CROSSFADE))
    
    else:
        # Default crossfade
        return CrossfadeEffect.apply(frame_a, frame_b, progress,
                                     EffectParams(effect_type=EffectType.CROSSFADE))


if __name__ == "__main__":
    # Quick test
    test_img = np.random.randint(0, 255, (1080, 1920, 3), dtype=np.uint8)
    output_size = (1920, 1080)
    
    # Test Ken Burns
    kb_params = EffectParams(
        effect_type=EffectType.KEN_BURNS,
        zoom_start=1.0, zoom_end=1.3,
        pan_start_x=0.3, pan_start_y=0.3,
        pan_end_x=0.7, pan_end_y=0.7,
        rotation_start=0, rotation_end=2,
        easing="ease_in_out"
    )
    
    for p in [0.0, 0.25, 0.5, 0.75, 1.0]:
        result = KenBurnsEffect.apply(test_img, kb_params, p, output_size)
        print(f"Ken Burns progress {p}: {result.shape}")
    
    # Test Crossfade
    test_img2 = np.random.randint(0, 255, (1080, 1920, 3), dtype=np.uint8)
    cf_params = EffectParams(effect_type=EffectType.CROSSFADE, crossfade_duration=1.0)
    
    for p in [0.0, 0.5, 1.0]:
        result = CrossfadeEffect.apply(test_img, test_img2, p, cf_params)
        print(f"Crossfade progress {p}: {result.shape}")
    
    print("✅ Effects test passed!")