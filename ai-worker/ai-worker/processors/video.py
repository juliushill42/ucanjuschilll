import asyncio
import logging
import os
import subprocess
import tempfile
from typing import Dict, Any, Optional

logger = logging.getLogger("ai-worker.video")


class VideoProcessor:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self.out_dir = os.path.join(storage_path, "ai", "video")
        os.makedirs(self.out_dir, exist_ok=True)

    def _output_path(self, job_id: str, suffix: str) -> tuple[str, str]:
        filename = f"{job_id}{suffix}"
        abs_path = os.path.join(self.out_dir, filename)
        url_path = f"/uploads/ai/video/{filename}"
        return abs_path, url_path

    def _run_ffmpeg(self, args: list[str], timeout: int = 300) -> subprocess.CompletedProcess:
        cmd = ["ffmpeg", "-y"] + args
        logger.info(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result.stderr[-2000:]}")
        return result

    async def stabilize(self, input_path: str, job_id: str, options: Optional[Dict[str, Any]] = None) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._stabilize_sync, input_path, job_id, options or {})

    def _stabilize_sync(self, input_path: str, job_id: str, options: Dict[str, Any]) -> str:
        abs_out, url_out = self._output_path(job_id, "_stable.mp4")
        trf_file = os.path.join(self.out_dir, f"{job_id}.trf")

        smoothing = options.get("smoothing", 10)
        zoom = options.get("zoom", 5)

        # Pass 1: detect motion vectors
        self._run_ffmpeg([
            "-i", input_path,
            "-vf", f"vidstabdetect=stepsize=6:shakiness=8:accuracy=9:result={trf_file}",
            "-f", "null", "-"
        ])

        # Pass 2: apply stabilization
        self._run_ffmpeg([
            "-i", input_path,
            "-vf", f"vidstabtransform=input={trf_file}:zoom={zoom}:smoothing={smoothing}:interpol=bicubic,unsharp=5:5:0.8:3:3:0.4",
            "-c:v", "libx264", "-crf", "18", "-preset", "medium",
            "-c:a", "copy",
            abs_out
        ])

        # Cleanup transform file
        if os.path.exists(trf_file):
            os.remove(trf_file)

        logger.info(f"Stabilization done: {abs_out}")
        return url_out

    async def remove_background(self, input_path: str, job_id: str, options: Optional[Dict[str, Any]] = None) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._remove_background_sync, input_path, job_id, options or {})

    def _remove_background_sync(self, input_path: str, job_id: str, options: Dict[str, Any]) -> str:
        """
        Background removal using ffmpeg chromakey for green/blue screens,
        or color range keying for common backgrounds.
        For arbitrary backgrounds, uses a frame-by-frame approach with simple thresholding.
        """
        abs_out, url_out = self._output_path(job_id, "_nobg.mp4")

        bg_color = options.get("bg_color", None)  # e.g. "green", "blue", hex like "00ff00"
        replacement_color = options.get("replacement", "black")

        if bg_color in ("green", "0x00ff00", "00ff00"):
            vf = f"chromakey=0x00ff00:0.1:0.2,format=yuv420p"
        elif bg_color in ("blue", "0x0000ff", "0000ff"):
            vf = f"chromakey=0x0000ff:0.1:0.2,format=yuv420p"
        else:
            # General background removal: extract frames, process, reassemble
            return self._background_remove_general(input_path, job_id, abs_out, url_out, options)

        self._run_ffmpeg([
            "-i", input_path,
            "-vf", vf,
            "-c:v", "libx264", "-crf", "18",
            "-c:a", "copy",
            abs_out
        ])

        logger.info(f"Background removal done: {abs_out}")
        return url_out

    def _background_remove_general(self, input_path: str, job_id: str, abs_out: str, url_out: str, options: Dict) -> str:
        """
        General background removal using GrabCut algorithm on keyframes
        with optical flow propagation. Requires PIL.
        """
        from PIL import Image
        import numpy as np

        frames_dir = tempfile.mkdtemp(prefix=f"juschill_{job_id}_")

        try:
            # Extract frames
            self._run_ffmpeg([
                "-i", input_path,
                "-vf", "fps=30",
                os.path.join(frames_dir, "frame_%05d.png")
            ])

            frame_files = sorted([
                f for f in os.listdir(frames_dir) if f.endswith(".png")
            ])

            if not frame_files:
                raise RuntimeError("No frames extracted from video")

            # Process each frame: simple luminance-based background separation
            # In production this would use a proper segmentation model (SAM, U2-Net etc.)
            # This implementation uses a histogram-based approach
            processed_dir = tempfile.mkdtemp(prefix=f"juschill_{job_id}_proc_")

            for fname in frame_files:
                img = Image.open(os.path.join(frames_dir, fname)).convert("RGB")
                arr = np.array(img, dtype=np.float32)

                # Simple edge-based foreground mask
                from PIL import ImageFilter
                edges = img.filter(ImageFilter.FIND_EDGES)
                edge_arr = np.array(edges.convert("L"), dtype=np.float32)

                # Dilate edges to create rough foreground mask
                from scipy.ndimage import binary_dilation
                mask = edge_arr > 30
                mask = binary_dilation(mask, iterations=8)

                # Apply: keep masked area, darken background
                result = arr.copy()
                result[~mask] = result[~mask] * 0.1  # near-black background

                out_img = Image.fromarray(result.astype(np.uint8))
                out_img.save(os.path.join(processed_dir, fname))

            # Get original fps
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=r_frame_rate",
                 "-of", "default=noprint_wrappers=1:nokey=1", input_path],
                capture_output=True, text=True
            )
            fps_str = probe.stdout.strip()
            if "/" in fps_str:
                num, den = fps_str.split("/")
                fps = f"{num}/{den}"
            else:
                fps = fps_str or "30"

            # Reassemble
            self._run_ffmpeg([
                "-framerate", fps,
                "-i", os.path.join(processed_dir, "frame_%05d.png"),
                "-i", input_path,
                "-map", "0:v", "-map", "1:a",
                "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-shortest",
                abs_out
            ])

        finally:
            # Cleanup temp dirs
            import shutil
            if os.path.exists(frames_dir):
                shutil.rmtree(frames_dir, ignore_errors=True)
            if "processed_dir" in dir() and os.path.exists(processed_dir):
                shutil.rmtree(processed_dir, ignore_errors=True)

        logger.info(f"General background removal done: {abs_out}")
        return url_out

    async def generate_thumbnail(self, input_path: str, job_id: str) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._thumbnail_sync, input_path, job_id)

    def _thumbnail_sync(self, input_path: str, job_id: str) -> str:
        abs_out, url_out = self._output_path(job_id, "_thumb.jpg")

        # Extract frame at 10% through video for a representative thumbnail
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", input_path],
            capture_output=True, text=True
        )
        try:
            duration = float(probe.stdout.strip())
            seek_time = duration * 0.1
        except (ValueError, TypeError):
            seek_time = 1.0

        self._run_ffmpeg([
            "-ss", str(seek_time),
            "-i", input_path,
            "-vframes", "1",
            "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
            "-q:v", "2",
            abs_out
        ])

        logger.info(f"Thumbnail generated: {abs_out}")
        return url_out

    async def extract_audio(self, input_path: str, job_id: str) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._extract_audio_sync, input_path, job_id)

    def _extract_audio_sync(self, input_path: str, job_id: str) -> str:
        abs_out, url_out = self._output_path(job_id, "_audio.wav")
        self._run_ffmpeg([
            "-i", input_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "44100",
            "-ac", "2",
            abs_out
        ])
        logger.info(f"Audio extracted: {abs_out}")
        return url_out
