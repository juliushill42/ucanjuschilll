import asyncio
import logging
import os
from typing import Dict, Any, Optional

import numpy as np

logger = logging.getLogger("ai-worker.audio")


class AudioProcessor:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self.whisper_model = None
        self.out_dir = os.path.join(storage_path, "ai", "processed")
        os.makedirs(self.out_dir, exist_ok=True)

    async def load_models(self):
        """Load all AI models at startup."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_whisper)

    def _load_whisper(self):
        import whisper
        logger.info("Loading Whisper model...")
        self.whisper_model = whisper.load_model("base")
        logger.info("Whisper loaded")

    def _output_path(self, job_id: str, suffix: str) -> tuple[str, str]:
        """Returns (abs_path, url_path)."""
        filename = f"{job_id}{suffix}"
        abs_path = os.path.join(self.out_dir, filename)
        url_path = f"/uploads/ai/processed/{filename}"
        return abs_path, url_path

    async def noise_reduction(self, input_path: str, job_id: str, options: Optional[Dict[str, Any]] = None) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._noise_reduction_sync, input_path, job_id, options or {})

    def _noise_reduction_sync(self, input_path: str, job_id: str, options: Dict[str, Any]) -> str:
        import soundfile as sf
        import noisereduce as nr

        abs_out, url_out = self._output_path(job_id, "_nr.wav")

        data, rate = sf.read(input_path)
        if data.ndim > 1:
            data = data.mean(axis=1)

        # Stationary noise reduction using first 0.5s as noise profile
        noise_clip_samples = int(rate * 0.5)
        noise_clip = data[:noise_clip_samples] if len(data) > noise_clip_samples else data

        prop_decrease = options.get("prop_decrease", 0.85)
        reduced = nr.reduce_noise(
            y=data,
            sr=rate,
            y_noise=noise_clip,
            prop_decrease=prop_decrease,
            stationary=True,
        )

        sf.write(abs_out, reduced, rate)
        logger.info(f"Noise reduction done: {abs_out}")
        return url_out

    async def pitch_correct(self, input_path: str, job_id: str, options: Optional[Dict[str, Any]] = None) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._pitch_correct_sync, input_path, job_id, options or {})

    def _pitch_correct_sync(self, input_path: str, job_id: str, options: Dict[str, Any]) -> str:
        import librosa
        import soundfile as sf

        abs_out, url_out = self._output_path(job_id, "_pc.wav")

        y, sr = librosa.load(input_path, sr=None)

        # Detect pitch and correct toward nearest semitone
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr,
        )

        # Compute median pitch shift needed
        valid_f0 = f0[voiced_flag]
        if len(valid_f0) > 0:
            median_f0 = float(np.median(valid_f0))
            # Find nearest semitone
            semitones_from_a4 = librosa.hz_to_midi(median_f0) - 69
            correction = -round(semitones_from_a4 % 1 - 0.5, 2)
            n_steps = options.get("pitch_shift", correction)
        else:
            n_steps = 0

        if abs(n_steps) > 0.05:
            y_corrected = librosa.effects.pitch_shift(y, sr=sr, n_steps=n_steps)
        else:
            y_corrected = y

        sf.write(abs_out, y_corrected, sr)
        logger.info(f"Pitch correction done ({n_steps:.2f} semitones): {abs_out}")
        return url_out

    async def master_audio(self, input_path: str, job_id: str, options: Optional[Dict[str, Any]] = None) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._master_sync, input_path, job_id, options or {})

    def _master_sync(self, input_path: str, job_id: str, options: Dict[str, Any]) -> str:
        """
        Mastering chain: EQ → Compression → Stereo widening → Normalization → Limiting
        Uses pydub + numpy for DSP operations.
        """
        from pydub import AudioSegment
        from pydub.effects import compress_dynamic_range, normalize
        import soundfile as sf
        import numpy as np

        abs_out, url_out = self._output_path(job_id, "_master.mp3")

        audio = AudioSegment.from_file(input_path)

        # Normalize to consistent loudness first
        audio = normalize(audio)

        # Apply compression (reduce dynamic range)
        threshold = options.get("threshold", -20.0)
        ratio = options.get("ratio", 4.0)
        audio = compress_dynamic_range(audio, threshold=threshold, ratio=ratio, attack=5.0, release=50.0)

        # High shelf boost for air (brightness) at 12kHz
        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        sample_rate = audio.frame_rate
        channels = audio.channels

        if channels > 1:
            samples = samples.reshape(-1, channels)

        # Apply gentle high shelf boost via scipy
        from scipy import signal as scipy_signal
        b_high, a_high = scipy_signal.butter(2, 12000 / (sample_rate / 2), btype='high')
        if channels > 1:
            for ch in range(channels):
                boost = scipy_signal.filtfilt(b_high, a_high, samples[:, ch]) * 0.15
                samples[:, ch] += boost
        else:
            boost = scipy_signal.filtfilt(b_high, a_high, samples) * 0.15
            samples += boost

        # Low end warmth boost at 80Hz
        b_low, a_low = scipy_signal.butter(2, [60 / (sample_rate / 2), 100 / (sample_rate / 2)], btype='band')
        if channels > 1:
            for ch in range(channels):
                warmth = scipy_signal.filtfilt(b_low, a_low, samples[:, ch]) * 0.1
                samples[:, ch] += warmth
        else:
            warmth = scipy_signal.filtfilt(b_low, a_low, samples) * 0.1
            samples += warmth

        # Limit to prevent clipping
        peak = np.max(np.abs(samples))
        if peak > 0:
            target_peak = options.get("target_peak", 0.95)
            samples = samples * (target_peak / peak)

        # Flatten back
        if channels > 1:
            samples = samples.flatten()

        samples = samples.astype(np.int16)

        result_audio = AudioSegment(
            samples.tobytes(),
            frame_rate=sample_rate,
            sample_width=2,
            channels=channels,
        )

        # Final normalize
        result_audio = normalize(result_audio)

        result_audio.export(abs_out, format="mp3", bitrate="320k",
                           tags={"comment": "Mastered by JusChill AI"})

        logger.info(f"Mastering done: {abs_out}")
        return url_out

    async def generate_captions(self, input_path: str, job_id: str, options: Optional[Dict[str, Any]] = None) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._captions_sync, input_path, job_id, options or {})

    def _captions_sync(self, input_path: str, job_id: str, options: Dict[str, Any]) -> str:
        abs_out, url_out = self._output_path(job_id, "_captions.vtt")

        if self.whisper_model is None:
            import whisper
            self.whisper_model = whisper.load_model("base")

        language = options.get("language", None)
        result = self.whisper_model.transcribe(
            input_path,
            language=language,
            word_timestamps=True,
            verbose=False,
        )

        # Write WebVTT format
        with open(abs_out, "w", encoding="utf-8") as f:
            f.write("WEBVTT\n\n")
            for i, segment in enumerate(result["segments"]):
                start = self._format_timestamp(segment["start"])
                end = self._format_timestamp(segment["end"])
                text = segment["text"].strip()
                f.write(f"{i + 1}\n{start} --> {end}\n{text}\n\n")

        logger.info(f"Captions generated: {abs_out} ({len(result['segments'])} segments)")
        return url_out

    def _format_timestamp(self, seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"

    async def detect_beats(self, input_path: str) -> Dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._detect_beats_sync, input_path)

    def _detect_beats_sync(self, input_path: str) -> Dict[str, Any]:
        import librosa

        y, sr = librosa.load(input_path, sr=None, mono=True)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr).tolist()

        onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
        onset_times = librosa.frames_to_time(onset_frames, sr=sr).tolist()

        logger.info(f"Beat detection: {float(tempo):.1f} BPM, {len(beat_times)} beats")
        return {
            "bpm": float(tempo),
            "beats": beat_times,
            "onsets": onset_times,
            "duration": float(len(y) / sr),
        }
