"""
CLI Interface: Main entry point, config loading, project management.
"""

import click
import yaml
import json
from pathlib import Path
from typing import Optional, List
import sys

from ..audio.analyzer import analyze_audio, save_analysis, load_analysis, AudioAnalysis
from ..media.manager import MediaManager, MediaItem
from ..timeline.builder import Timeline, TimelineBuilder, create_timeline_from_config, TimelineClip, EffectParams, EffectType, TransitionType
from ..render.renderer import render_timeline, RenderConfig


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """🎬 myMovieMaker: Offline movie maker - photos/videos synced to music beats."""
    pass


@cli.command()
@click.argument('project_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--config', '-c', 'config_file', default='project.yaml', help='Project config file')
@click.option('--output', '-o', default='output.mp4', help='Output video file')
@click.option('--style', '-s', type=click.Choice(['dynamic', 'cinematic', 'energetic', 'minimal']), default='dynamic', help='Visual style')
@click.option('--fps', default=30, help='Output FPS')
@click.option('--width', default=1920, help='Output width')
@click.option('--height', default=1080, help='Output height')
@click.option('--crf', default=18, help='Quality (lower=better, 18-23)')
@click.option('--preset', default='medium', type=click.Choice(['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow']), help='Encoding preset')
@click.option('--force-analyze', is_flag=True, help='Force re-analyze audio even if cache exists')
@click.option('--dry-run', is_flag=True, help='Show timeline without rendering')
def render(project_dir: str, config_file: str, output: str, style: str, fps: int, 
           width: int, height: int, crf: int, preset: str, force_analyze: bool, dry_run: bool):
    """Render a project to video."""
    project_path = Path(project_dir)
    config_path = project_path / config_file
    
    # Load or create config
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
        print(f"📋 Loaded config: {config_path}")
    else:
        config = {}
        print(f"📝 No config found, using defaults")
    
    # Override with CLI args
    config.setdefault('style', style)
    config.setdefault('target_fps', fps)
    config.setdefault('output_width', width)
    config.setdefault('output_height', height)
    config.setdefault('crf', crf)
    config.setdefault('preset', preset)
    
    # Find media files
    media_dir = project_path / config.get('media_dir', 'media')
    if not media_dir.exists():
        media_dir = project_path
        print(f"📁 Using project dir as media dir: {media_dir}")
    
    # Find audio file
    audio_file = config.get('audio_file')
    if not audio_file:
        # Auto-detect first audio file
        audio_extensions = {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'}
        for f in media_dir.iterdir():
            if f.suffix.lower() in audio_extensions:
                audio_file = str(f)
                print(f"🎵 Auto-detected audio: {f.name}")
                break
    
    if not audio_file:
        click.echo("❌ No audio file found! Specify in config or place in media directory.", err=True)
        sys.exit(1)
    
    audio_path = project_path / audio_file if not Path(audio_file).is_absolute() else Path(audio_file)
    
    # Analyze audio
    analysis_cache = audio_path.with_suffix(audio_path.suffix + '.analysis.json')
    if analysis_cache.exists() and not force_analyze:
        print(f"⚡ Loading cached analysis: {analysis_cache}")
        audio_analysis = load_analysis(str(analysis_cache))
        audio_analysis.audio_path = str(audio_path)
    else:
        print(f"🔍 Analyzing audio: {audio_path}")
        audio_analysis = analyze_audio(str(audio_path))
        audio_analysis.audio_path = str(audio_path)
        save_analysis(audio_analysis, str(analysis_cache))
    
    # Load media
    media_manager = MediaManager()
    media_items = media_manager.scan_directory(str(media_dir))
    
    if not media_items:
        click.echo("❌ No media files found!", err=True)
        sys.exit(1)
    
    # Filter out audio files from media
    media_items = [m for m in media_items if m.media_type != 'audio']
    
    # Build timeline
    print(f"🎬 Building {config['style']} timeline...")
    timeline = create_timeline_from_config(config, media_items, audio_analysis)
    
    # Apply CLI overrides to timeline
    timeline.target_fps = fps
    timeline.output_width = width
    timeline.output_height = height
    timeline.style = style
    
    if dry_run:
        print(f"\n📋 Timeline Preview:")
        print(f"   Clips: {len(timeline.clips)}")
        print(f"   Duration: {timeline.get_total_duration():.2f}s")
        print(f"   Resolution: {timeline.output_width}x{timeline.output_height} @ {timeline.target_fps}fps")
        print(f"   Audio: {audio_path.name} ({audio_analysis.duration:.1f}s, {audio_analysis.tempo:.1f} BPM)")
        for i, clip in enumerate(timeline.clips):
            media = media_items[clip.media_index]
            effects_str = ", ".join([e.effect_type.value for e in clip.effects]) or "none"
            print(f"  {i+1}. {Path(media.path).name} @ {clip.start_time:.2f}s ({clip.duration:.2f}s) - {effects_str}")
        return
    
    # Render
    output_path = project_path / output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        render_timeline(
            timeline=timeline,
            media_items=media_items,
            audio_analysis=audio_analysis,
            media_manager=media_manager,
            output_path=str(output_path),
            fps=fps,
            width=width,
            height=height,
            crf=crf,
            preset=preset
        )
        click.echo(f"✅ Done! Output: {output_path}")
    except Exception as e:
        click.echo(f"❌ Render failed: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('project_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--config', '-c', 'config_file', default='project.yaml', help='Project config file')
def analyze(project_dir: str, config_file: str):
    """Analyze audio file and show beat/tempo info."""
    project_path = Path(project_dir)
    config_path = project_path / config_file
    
    config = {}
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
    
    audio_file = config.get('audio_file')
    if not audio_file:
        click.echo("❌ No audio_file in config", err=True)
        sys.exit(1)
    
    audio_path = project_path / audio_file if not Path(audio_file).is_absolute() else Path(audio_file)
    
    analysis = analyze_audio(str(audio_path))
    analysis.audio_path = str(audio_path)
    
    print(f"\n🎵 Audio Analysis: {audio_path.name}")
    print(f"   Duration: {analysis.duration:.2f}s")
    print(f"   Tempo: {analysis.tempo:.1f} BPM")
    print(f"   Beats: {len(analysis.beats)}")
    print(f"   Downbeats: {len(analysis.downbeats)}")
    
    print(f"\n🥁 First 16 beats:")
    for i, beat in enumerate(analysis.beats[:16]):
        db_marker = " 🎯" if beat.is_downbeat else ""
        print(f"   {i+1:2d}. {beat.time:6.3f}s  strength={beat.strength:.2f}{db_marker}")
    
    if len(analysis.beats) > 16:
        print(f"   ... and {len(analysis.beats) - 16} more beats")


@cli.command()
@click.argument('project_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--config', '-c', 'config_file', default='project.yaml', help='Project config file')
@click.option('--output', '-o', default='timeline.json', help='Output timeline file')
def build_timeline(project_dir: str, config_file: str, output: str):
    """Build timeline and save to JSON (for inspection/editing)."""
    project_path = Path(project_dir)
    config_path = project_path / config_file
    
    config = {}
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
    
    media_dir = project_path / config.get('media_dir', 'media')
    audio_file = config.get('audio_file')
    
    audio_path = project_path / audio_file if not Path(audio_file).is_absolute() else Path(audio_file)
    analysis_cache = audio_path.with_suffix(audio_path.suffix + '.analysis.json')
    
    if analysis_cache.exists():
        audio_analysis = load_analysis(str(analysis_cache))
    else:
        audio_analysis = analyze_audio(str(audio_path))
        save_analysis(audio_analysis, str(analysis_cache))
    
    audio_analysis.audio_path = str(audio_path)
    
    media_manager = MediaManager()
    media_items = media_manager.scan_directory(str(media_dir))
    media_items = [m for m in media_items if m.media_type != 'audio']
    
    timeline = create_timeline_from_config(config, media_items, audio_analysis)
    
    # Save timeline
    output_path = project_path / output
    with open(output_path, 'w') as f:
        json.dump(timeline.to_dict(), f, indent=2)
    
    print(f"💾 Timeline saved to: {output_path}")
    print(f"   Clips: {len(timeline.clips)}")
    print(f"   Duration: {timeline.get_total_duration():.2f}s")


@cli.command()
@click.argument('project_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--config', '-c', 'config_file', default='project.yaml', help='Project config file')
def preview(project_dir: str, config_file: str):
    """Show project preview (media list, audio analysis, timeline plan)."""
    project_path = Path(project_dir)
    config_path = project_path / config_file
    
    config = {}
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
    
    print(f"📁 Project: {project_path.name}")
    print(f"📋 Config: {config_file}")
    
    # Media
    media_dir = project_path / config.get('media_dir', 'media')
    media_manager = MediaManager()
    media_items = media_manager.scan_directory(str(media_dir))
    
    images = [m for m in media_items if m.is_image]
    videos = [m for m in media_items if m.is_video]
    audio_files = [m for m in media_items if m.media_type == 'audio']
    
    print(f"\n📸 Media: {len(images)} images, {len(videos)} videos, {len(audio_files)} audio")
    for m in images[:10]:
        print(f"   🖼️  {Path(m.path).name} ({m.width}x{m.height})")
    for m in videos[:10]:
        print(f"   🎞️  {Path(m.path).name} ({m.width}x{m.height}, {m.duration:.1f}s, {m.fps:.1f}fps)")
    if len(images) > 10 or len(videos) > 10:
        print(f"   ... and {max(0, len(images)-10) + max(0, len(videos)-10)} more")
    
    # Audio
    audio_file = config.get('audio_file')
    if audio_file:
        audio_path = project_path / audio_file if not Path(audio_file).is_absolute() else Path(audio_file)
        analysis_cache = audio_path.with_suffix(audio_path.suffix + '.analysis.json')
        
        if analysis_cache.exists():
            audio_analysis = load_analysis(str(analysis_cache))
        else:
            audio_analysis = analyze_audio(str(audio_path))
        
        print(f"\n🎵 Audio: {audio_path.name}")
        print(f"   Duration: {audio_analysis.duration:.2f}s")
        print(f"   Tempo: {audio_analysis.tempo:.1f} BPM")
        print(f"   Beats: {len(audio_analysis.beats)}")
    
    # Timeline preview
    if media_items and audio_file:
        media_items_filtered = [m for m in media_items if m.media_type != 'audio']
        timeline = create_timeline_from_config(config, media_items_filtered, audio_analysis)
        print(f"\n🎬 Timeline ({config.get('style', 'dynamic')} style):")
        print(f"   Clips: {len(timeline.clips)}")
        print(f"   Duration: {timeline.get_total_duration():.2f}s")


@cli.command()
@click.argument('project_dir', type=click.Path(file_okay=False, dir_okay=True))
@click.option('--name', default='my_project', help='Project name')
@click.option('--style', default='dynamic', type=click.Choice(['dynamic', 'cinematic', 'energetic', 'minimal']))
def init(project_dir: str, name: str, style: str):
    """Create a new project structure with example config."""
    project_path = Path(project_dir)
    project_path.mkdir(parents=True, exist_ok=True)
    
    # Create directories
    (project_path / 'media').mkdir(exist_ok=True)
    (project_path / 'output').mkdir(exist_ok=True)
    
    # Create example config
    config = {
        'name': name,
        'style': style,
        'media_dir': 'media',
        'audio_file': 'music.mp3',  # Place your audio file here
        'target_fps': 30,
        'output_width': 1920,
        'output_height': 1080,
        'crf': 18,
        'preset': 'medium',
        # Optional: explicit timeline (overrides auto-build)
        # 'clips': [...]
    }
    
    config_path = project_path / 'project.yaml'
    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)
    
    # Create README
    readme = f"""# {name}

muvee-clone project - Create music-synced videos from photos/videos.

## Quick Start

1. Place your media files in `media/`:
   - Photos: JPG, PNG, HEIC, etc.
   - Videos: MP4, MOV, etc.
   - Music: MP3, WAV, FLAC, etc. (name it `music.mp3` or update `audio_file` in config)

2. Edit `project.yaml` if needed:
   - `style`: dynamic, cinematic, energetic, minimal
   - `audio_file`: your music filename
   - Resolution, quality settings

3. Render:
   ```bash
   mymoviemaker render .
   ```

## Commands

- `mymoviemaker preview .` - Show project overview
- `mymoviemaker analyze .` - Show audio beat analysis
- `mymoviemaker build-timeline .` - Export timeline JSON for editing
- `mymoviemaker render .` - Render final video

## Styles

- **dynamic**: Balanced, 1 clip per measure, crossfades, Ken Burns
- **cinematic**: Slower, longer clips, smooth Ken Burns, long crossfades
- **energetic**: Fast cuts, 2 clips per measure, pulse effects, hard cuts on downbeats
- **minimal**: Slow, 1 clip per 4 measures, subtle effects
"""
    
    (project_path / 'README.md').write_text(readme)
    
    print(f"✅ Project created at: {project_path}")
    print(f"   📁 media/ - put your photos/videos/music here")
    print(f"   ⚙️  project.yaml - configure your project")
    print(f"   📖 README.md - this guide")
    print(f"\n🎬 Next steps:")
    print(f"   1. Add media to {project_path}/media/")
    print(f"   2. Edit {project_path}/project.yaml")
    print(f"   3. Run: muuve render {project_path}")


@cli.command()
def styles():
    """List available visual styles."""
    styles_info = {
        'dynamic': '🎯 Balanced - 1 clip/measure, crossfades, Ken Burns, subtle pulses',
        'cinematic': '🎬 Slow & smooth - 1 clip/2 measures, long Ken Burns, long crossfades',
        'energetic': '⚡ Fast & punchy - 2 clips/measure, pulse zoom, hard cuts on downbeats',
        'minimal': '✨ Subtle - 1 clip/4 measures, gentle Ken Burns, minimal transitions'
    }
    
    print("\n🎨 Available Styles:")
    for name, desc in styles_info.items():
        print(f"   {name:12} - {desc}")


if __name__ == "__main__":
    cli()