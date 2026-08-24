# 🎬 myMovieMaker

**Offline movie maker** - Create music-synced videos from photos/videos like muvee, but fully offline, local, and customizable.

![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-alpha-orange.svg)

## ✨ Features

- **🎵 Beat-Synced Editing** - Automatic cut/transition timing to music beats using librosa
- **🎨 Visual Styles** - Dynamic, Cinematic, Energetic, Minimal presets
- **🖼️ Ken Burns Effect** - Smooth zoom + pan on still images
- **⚡ Pulse Zoom** - Beat-synced zoom pulses
- **🔄 Transitions** - Crossfades, slide transitions, fade to black, zoom crossfade
- **🎞️ Video Support** - Mix photos and videos seamlessly
- **🎛️ Audio Reactive** - Effects modulate with audio energy
- **⚙️ Configurable** - YAML/JSON config, CLI, or programmatic API
- **🚀 Fast Rendering** - FFmpeg piped encoding (H.264/MP4)
- **💾 Caching** - Audio analysis cached for fast iteration

## 📦 Installation

```bash
# Clone and install
git clone <repo>
cd myMovieMaker
pip install -e .

# Or install dependencies directly
pip install -r requirements.txt
```

**System Requirements:**
- Python 3.10+
- FFmpeg (for encoding): `apt install ffmpeg` / `brew install ffmpeg` / `choco install ffmpeg`

## 🚀 Quick Start

### 1. Create a demo project
```bash
python create_demo.py my_project
cd my_project
```

### 2. Add your media
Place files in `media/`:
- **Photos**: JPG, PNG, HEIC, TIFF, WebP
- **Videos**: MP4, MOV, AVI, MKV, WebM
- **Music**: MP3, WAV, FLAC, M4A (name it `music.mp3` or update config)

### 3. Configure (optional)
Edit `project.yaml`:
```yaml
name: "My Video"
style: "dynamic"          # dynamic, cinematic, energetic, minimal
media_dir: "media"
audio_file: "music.mp3"
target_fps: 30
output_width: 1920
output_height: 1080
crf: 18                   # Quality (18-23)
preset: "medium"          # Encoding speed
```

### 4. Render!
```bash
# Preview first
mymoviemaker preview .

# Render to MP4
mymoviemaker render . -o my_video.mp4
```

## 🎨 Visual Styles

| Style | Clips/Measure | Transitions | Effects | Best For |
|-------|---------------|-------------|---------|----------|
| **dynamic** | 1 | Crossfades | Ken Burns + subtle pulses | General purpose |
| **cinematic** | 0.5 | Long crossfades | Slow Ken Burns | Slideshows, memories |
| **energetic** | 2 | Hard cuts on downbeats | Pulse zoom, fast cuts | Music videos, highlights |
| **minimal** | 0.25 | Subtle crossfades | Gentle Ken Burns | Clean, professional |

## 📋 CLI Commands

```bash
# Render video
mymoviemaker render /path/to/project -o output.mp4 --style energetic --preset fast

# Preview project (media, audio, timeline plan)
mymoviemaker preview /path/to/project

# Analyze audio beats/tempo
mymoviemaker analyze /path/to/project

# Build timeline JSON (for manual editing)
mymoviemaker build-timeline /path/to/project -o timeline.json

# Create new project structure
mymoviemaker init /path/to/new_project --name "Vacation 2024" --style cinematic

# List styles
mymoviemaker styles
```

## 🐍 Python API

```python
from my_movie_maker import (
    analyze_audio, MediaManager, TimelineBuilder,
    render_timeline, Timeline
)

# 1. Analyze audio
audio_analysis = analyze_audio("music.mp3")
print(f"Tempo: {audio_analysis.tempo:.1f} BPM, Beats: {len(audio_analysis.beats)}")

# 2. Load media
media_manager = MediaManager()
media_items = media_manager.scan_directory("media/")

# 3. Build timeline
builder = TimelineBuilder(media_items, audio_analysis, style="dynamic")
timeline = builder.build()

# 4. Render
render_timeline(
    timeline=timeline,
    media_items=media_items,
    audio_analysis=audio_analysis,
    media_manager=media_manager,
    output_path="output.mp4",
    fps=30, width=1920, height=1080,
    crf=18, preset="medium"
)
```

## 📁 Project Structure

```
my_project/
├── project.yaml          # Configuration
├── media/                # Your media files
│   ├── photo1.jpg
│   ├── video1.mp4
│   └── music.mp3
├── output/               # Rendered videos (gitignored)
└── README.md
```

## ⚙️ Advanced Configuration

### Custom Timeline (in project.yaml)
Override auto-generated timeline:
```yaml
clips:
  - media_index: 0          # Index in media list
    start_time: 0.0         # Seconds
    duration: 4.5
    effects:
      - effect_type: "ken_burns"
        zoom_start: 1.0
        zoom_end: 1.4
        pan_start_x: 0.3
        pan_start_y: 0.3
        pan_end_x: 0.7
        pan_end_y: 0.7
        easing: "ease_in_out"
    transition_in: "crossfade"
    transition_in_duration: 1.0
    transition_out: "crossfade"
    transition_out_duration: 1.0
    align_to_beat: true
    audio_reactive: true
    energy_modulation: 0.2
```

### Effect Types
- `ken_burns` - Slow zoom+pan (images)
- `zoom_pan` - Beat-synced dynamic zoom/pan
- `pulse_zoom` - Quick zoom pulse on beats
- `crossfade` - Blend between clips

### Transition Types
- `crossfade` - Dissolve
- `cut` - Hard cut
- `slide_left/right/up/down` - Slide
- `fade_black` - Fade to/from black
- `zoom_crossfade` - Zoom during crossfade

### Easing Functions
`linear`, `ease_in`, `ease_out`, `ease_in_out`, `ease_in_cubic`, `ease_out_cubic`, `ease_in_out_cubic`, `beat_snap`

## 🔧 Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black src/
ruff check src/

# Type check
mypy src/
```

## 📝 How It Works

1. **Audio Analysis** → librosa detects beats, tempo, downbeats, energy curves
2. **Media Loading** → OpenCV/PIL loads images/videos, extracts metadata, generates thumbnails
3. **Timeline Building** → Maps media to beats based on style (clips per measure, transitions)
4. **Frame Generation** → OpenCV applies effects (Ken Burns, zoom, pulse) per frame
5. **Encoding** → FFmpeg pipes raw frames → H.264/MP4 with audio

## 🎯 Roadmap

- [ ] Web UI (React/Vue + WebSocket progress)
- [ ] More effects: 3D cube, flip, wipe transitions
- [ ] Text overlays / titles / captions
- [ ] Multi-track audio (music + voiceover)
- [ ] Export timeline to DaVinci/Premiere XML
- [ ] GPU acceleration (OpenCL/CUDA)
- [ ] Plugin system for custom effects

## 📄 License

MIT License - feel free to use, modify, distribute.

## 🙏 Credits

- **librosa** - Audio analysis
- **OpenCV** - Video/image processing
- **FFmpeg** - Encoding
- Inspired by **muvee** (automatic video editing)

---

**Made with ❤️ for offline, private, creative video making.**