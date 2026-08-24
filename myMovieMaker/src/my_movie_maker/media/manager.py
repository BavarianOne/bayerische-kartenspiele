"""
Media Manager: Load images/videos, extract metadata, generate thumbnails.
"""

import cv2
import numpy as np
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from PIL import Image
import json


@dataclass
class MediaItem:
    """A single media item (image or video)."""
    path: str
    media_type: str           # 'image' or 'video'
    width: int
    height: int
    duration: float           # For videos: duration in seconds. For images: 0
    fps: float                # For videos: frames per second. For images: 0
    thumbnail: Optional[np.ndarray] = None  # Thumbnail as numpy array (BGR)
    metadata: dict = field(default_factory=dict)
    
    @property
    def aspect_ratio(self) -> float:
        return self.width / self.height if self.height > 0 else 1.0
    
    @property
    def is_video(self) -> bool:
        return self.media_type == 'video'
    
    @property
    def is_image(self) -> bool:
        return self.media_type == 'image'


class MediaManager:
    """Manages loading and preprocessing of media files."""
    
    SUPPORTED_IMAGES = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp', '.heic'}
    SUPPORTED_VIDEOS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg'}
    
    def __init__(self, thumbnail_size: Tuple[int, int] = (320, 180)):
        self.thumbnail_size = thumbnail_size
        self.items: List[MediaItem] = []
    
    def scan_directory(self, directory: str, recursive: bool = True) -> List[MediaItem]:
        """Scan directory for supported media files."""
        path = Path(directory)
        pattern = "**/*" if recursive else "*"
        
        items = []
        for file_path in path.glob(pattern):
            if file_path.is_file():
                suffix = file_path.suffix.lower()
                if suffix in self.SUPPORTED_IMAGES:
                    items.append(self.load_image(str(file_path)))
                elif suffix in self.SUPPORTED_VIDEOS:
                    items.append(self.load_video(str(file_path)))
        
        self.items = items
        print(f"📁 Found {len(items)} media files ({sum(1 for i in items if i.is_image)} images, {sum(1 for i in items if i.is_video)} videos)")
        return items
    
    def load_image(self, path: str) -> MediaItem:
        """Load image and extract metadata."""
        # Use PIL for better format support (including HEIC)
        try:
            with Image.open(path) as img:
                width, height = img.size
                # Convert to RGB if needed
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                # Generate thumbnail
                thumb_img = img.copy()
                thumb_img.thumbnail(self.thumbnail_size, Image.Resampling.LANCZOS)
                thumbnail = cv2.cvtColor(np.array(thumb_img), cv2.COLOR_RGB2BGR)
        except Exception as e:
            print(f"⚠️ PIL failed for {path}, trying OpenCV: {e}")
            # Fallback to OpenCV
            img_cv = cv2.imread(path)
            if img_cv is None:
                raise ValueError(f"Cannot load image: {path}")
            height, width = img_cv.shape[:2]
            thumbnail = cv2.resize(img_cv, self.thumbnail_size)
        
        return MediaItem(
            path=path,
            media_type='image',
            width=width,
            height=height,
            duration=0.0,
            fps=0.0,
            thumbnail=thumbnail,
            metadata={'format': Path(path).suffix.lower()}
        )
    
    def load_video(self, path: str) -> MediaItem:
        """Load video and extract metadata."""
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {path}")
        
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        
        # Extract thumbnail from middle frame
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count // 2)
        ret, frame = cap.read()
        if ret:
            thumbnail = cv2.resize(frame, self.thumbnail_size)
        else:
            thumbnail = None
        
        cap.release()
        
        return MediaItem(
            path=path,
            media_type='video',
            width=width,
            height=height,
            duration=duration,
            fps=fps,
            thumbnail=thumbnail,
            metadata={
                'format': Path(path).suffix.lower(),
                'frame_count': frame_count,
                'codec': int(cap.get(cv2.CAP_PROP_FOURCC)) if hasattr(cv2, 'CAP_PROP_FOURCC') else 0
            }
        )
    
    def get_video_frame(self, path: str, time: float) -> Optional[np.ndarray]:
        """Extract a specific frame from video at given time (seconds)."""
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            return None
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_idx = int(time * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        cap.release()
        
        return frame if ret else None
    
    def get_video_frames(self, path: str, start_time: float, duration: float, 
                         target_fps: float = 30) -> List[np.ndarray]:
        """Extract multiple frames from video for a duration."""
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            return []
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        start_frame = int(start_time * fps)
        end_frame = int((start_time + duration) * fps)
        frame_step = max(1, int(fps / target_fps))
        
        frames = []
        for frame_idx in range(start_frame, end_frame, frame_step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if ret:
                frames.append(frame)
            else:
                break
        
        cap.release()
        return frames
    
    def save_thumbnails(self, output_dir: str):
        """Save all thumbnails to directory for UI/debugging."""
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        for i, item in enumerate(self.items):
            if item.thumbnail is not None:
                thumb_path = Path(output_dir) / f"thumb_{i:04d}_{Path(item.path).stem}.jpg"
                cv2.imwrite(str(thumb_path), item.thumbnail)
        print(f"🖼️ Saved {len(self.items)} thumbnails to {output_dir}")


def create_media_grid(media_items: List[MediaItem], grid_cols: int = 4, 
                      cell_size: Tuple[int, int] = (200, 150)) -> np.ndarray:
    """Create a grid image of all thumbnails for overview."""
    if not media_items:
        return np.zeros((cell_size[1], cell_size[0], 3), dtype=np.uint8)
    
    rows = (len(media_items) + grid_cols - 1) // grid_cols
    grid_h = rows * cell_size[1]
    grid_w = grid_cols * cell_size[0]
    grid = np.zeros((grid_h, grid_w, 3), dtype=np.uint8)
    
    for idx, item in enumerate(media_items):
        if item.thumbnail is None:
            continue
        row = idx // grid_cols
        col = idx % grid_cols
        y = row * cell_size[1]
        x = col * cell_size[0]
        
        # Resize thumbnail to cell size
        thumb = cv2.resize(item.thumbnail, cell_size)
        grid[y:y+cell_size[1], x:x+cell_size[0]] = thumb
        
        # Add label
        label = f"{idx}: {Path(item.path).name}"
        cv2.putText(grid, label, (x+5, y+20), cv2.FONT_HERSHEY_SIMPLEX, 
                    0.4, (255, 255, 255), 1, cv2.LINE_AA)
        if item.is_video:
            cv2.putText(grid, f"{item.duration:.1f}s @ {item.fps:.1f}fps", 
                        (x+5, y+40), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1, cv2.LINE_AA)
    
    return grid


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        mgr = MediaManager()
        items = mgr.scan_directory(sys.argv[1])
        for item in items:
            print(f"  {item.path}: {item.width}x{item.height}, {item.duration:.2f}s, {item.media_type}")
        
        # Create overview grid
        grid = create_media_grid(items)
        cv2.imwrite("media_overview.jpg", grid)
        print("🖼️ Overview saved to media_overview.jpg")
    else:
        print("Usage: python -m my_movie_maker.media.manager <directory>")