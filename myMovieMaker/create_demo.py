#!/usr/bin/env python3
"""
Create a demo project with synthetic media for testing.
Generates test images and a simple audio tone for testing without real media.
"""

import cv2
import numpy as np
import wave
import struct
from pathlib import Path
import random


def create_test_images(output_dir: Path, count: int = 10):
    """Create synthetic test images with different patterns."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    patterns = [
        ("gradient", lambda w, h, i: create_gradient(w, h, i)),
        ("checkerboard", lambda w, h, i: create_checkerboard(w, h, i)),
        ("circles", lambda w, h, i: create_circles(w, h, i)),
        ("noise", lambda w, h, i: create_noise(w, h, i)),
        ("geometric", lambda w, h, i: create_geometric(w, h, i)),
    ]
    
    for i in range(count):
        pattern_name, pattern_func = patterns[i % len(patterns)]
        img = pattern_func(1920, 1080, i)
        
        # Add frame number
        cv2.putText(img, f"Test Image {i+1}", (50, 100), 
                    cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
        cv2.putText(img, f"Pattern: {pattern_name}", (50, 200), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (200, 200, 200), 2)
        
        path = output_dir / f"test_{i+1:02d}_{pattern_name}.jpg"
        cv2.imwrite(str(path), img)
        print(f"  Created: {path.name}")
    
    print(f"✅ Created {count} test images in {output_dir}")


def create_gradient(w, h, seed):
    """Create gradient image."""
    random.seed(seed)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    color1 = [random.randint(50, 200) for _ in range(3)]
    color2 = [random.randint(50, 200) for _ in range(3)]
    
    for y in range(h):
        t = y / h
        for c in range(3):
            img[y, :, c] = int(color1[c] * (1 - t) + color2[c] * t)
    return img


def create_checkerboard(w, h, seed):
    """Create checkerboard pattern."""
    random.seed(seed)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    square_size = 80
    color1 = [random.randint(50, 200) for _ in range(3)]
    color2 = [random.randint(50, 200) for _ in range(3)]
    
    for y in range(0, h, square_size):
        for x in range(0, w, square_size):
            color = color1 if ((x // square_size) + (y // square_size)) % 2 == 0 else color2
            img[y:y+square_size, x:x+square_size] = color
    return img


def create_circles(w, h, seed):
    """Create concentric circles."""
    random.seed(seed)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    center = (w // 2, h // 2)
    max_radius = min(w, h) // 2
    num_circles = 15
    
    for i in range(num_circles):
        radius = int(max_radius * (i + 1) / num_circles)
        color = [random.randint(50, 255) for _ in range(3)]
        thickness = 3 if i % 2 == 0 else -1
        cv2.circle(img, center, radius, color, thickness)
    return img


def create_noise(w, h, seed):
    """Create colored noise."""
    random.seed(seed)
    base_color = [random.randint(50, 200) for _ in range(3)]
    img = np.full((h, w, 3), base_color, dtype=np.uint8)
    noise = np.random.randint(-50, 50, (h, w, 3), dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return img


def create_geometric(w, h, seed):
    """Create geometric shapes."""
    random.seed(seed)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    shapes = 20
    
    for _ in range(shapes):
        color = [random.randint(50, 255) for _ in range(3)]
        shape_type = random.randint(0, 3)
        x = random.randint(0, w)
        y = random.randint(0, h)
        size = random.randint(30, 200)
        
        if shape_type == 0:  # Rectangle
            cv2.rectangle(img, (x, y), (x+size, y+size//2), color, -1)
        elif shape_type == 1:  # Circle
            cv2.circle(img, (x, y), size//2, color, -1)
        elif shape_type == 2:  # Triangle
            pts = np.array([[x, y], [x+size, y], [x+size//2, y+size]], np.int32)
            cv2.fillPoly(img, [pts], color)
        else:  # Line
            cv2.line(img, (x, y), (x+size, y+size), color, 5)
    return img


def create_test_audio(output_path: Path, duration: float = 30.0, bpm: float = 120.0):
    """Create a simple test audio file with click track at specified BPM."""
    sample_rate = 44100
    samples = int(duration * sample_rate)
    
    # Generate click track
    beat_interval = 60.0 / bpm  # seconds per beat
    beat_samples = int(beat_interval * sample_rate)
    
    audio_data = np.zeros(samples, dtype=np.float32)
    
    # Add clicks on beats
    for beat_idx in range(int(duration / beat_interval) + 2):
        click_pos = int(beat_idx * beat_samples)
        if click_pos >= samples:
            break
        
        # Strong click on downbeats (every 4 beats)
        is_downbeat = beat_idx % 4 == 0
        click_freq = 1000 if is_downbeat else 800
        click_duration = 0.05 if is_downbeat else 0.03
        click_samples = int(click_duration * sample_rate)
        
        for i in range(min(click_samples, samples - click_pos)):
            t = i / sample_rate
            envelope = np.exp(-t * 50)  # Quick decay
            audio_data[click_pos + i] += envelope * np.sin(2 * np.pi * click_freq * t) * (0.5 if is_downbeat else 0.3)
    
    # Add subtle continuous tone for energy curve
    for i in range(samples):
        t = i / sample_rate
        # Low frequency drone
        audio_data[i] += 0.05 * np.sin(2 * np.pi * 110 * t)  # A2
        # Modulated by beat
        beat_phase = (t % beat_interval) / beat_interval
        audio_data[i] += 0.02 * np.sin(2 * np.pi * 220 * t) * (1 + 0.5 * np.sin(2 * np.pi * beat_phase * 4))
    
    # Normalize
    max_val = np.max(np.abs(audio_data))
    if max_val > 0:
        audio_data = audio_data / max_val * 0.8
    
    # Convert to 16-bit PCM
    audio_int16 = (audio_data * 32767).astype(np.int16)
    
    # Write WAV file
    with wave.open(str(output_path), 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())
    
    print(f"✅ Created test audio: {output_path} ({duration}s, {bpm} BPM)")


def create_demo_project(project_dir: Path):
    """Create a complete demo project."""
    print(f"🎬 Creating demo project in: {project_dir}")
    project_dir.mkdir(parents=True, exist_ok=True)
    
    media_dir = project_dir / "media"
    media_dir.mkdir(exist_ok=True)
    
    # Create test media
    create_test_images(media_dir, 12)
    create_test_audio(media_dir / "music.wav", duration=30.0, bpm=128.0)
    
    # Create project config
    import yaml
    config = {
        'name': 'Demo Project',
        'style': 'dynamic',
        'media_dir': 'media',
        'audio_file': 'music.wav',
        'target_fps': 30,
        'output_width': 1920,
        'output_height': 1080,
        'crf': 20,
        'preset': 'fast',
    }
    
    with open(project_dir / 'project.yaml', 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)
    
    # Create README
    readme = """# Demo Project

This is a test project with synthetic media to verify muvee-clone works.

## Contents

- `media/` - 12 synthetic test images + 30s click track at 128 BPM
- `project.yaml` - Project configuration

## Quick Test

```bash
# Preview project
mymoviemaker preview .

# Analyze audio
mymoviemaker analyze .

# Render (fast preset for quick test)
mymoviemaker render . -o demo_output.mp4 --preset fast --crf 23
```
"""
    (project_dir / "README.md").write_text(readme)
    
    print(f"\n✅ Demo project ready!")
    print(f"   Run: muuve render {project_dir} -o output.mp4 --preset fast")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        create_demo_project(Path(sys.argv[1]))
    else:
        create_demo_project(Path("demo_project"))