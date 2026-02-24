import asyncio
import logging
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from processors.audio import AudioProcessor
from processors.video import VideoProcessor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("ai-worker")

GO_API_URL = os.environ.get("GO_API_URL", "http://juschill-go-api:8000")
STORAGE_PATH = os.environ.get("STORAGE_PATH", "/data/uploads")

audio_processor: Optional[AudioProcessor] = None
video_processor: Optional[VideoProcessor] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global audio_processor, video_processor
    logger.info("Loading AI models...")
    audio_processor = AudioProcessor(storage_path=STORAGE_PATH)
    video_processor = VideoProcessor(storage_path=STORAGE_PATH)
    await audio_processor.load_models()
    logger.info("AI models ready")
    yield
    logger.info("Shutting down AI worker")

app = FastAPI(title="JusChill AI Worker", lifespan=lifespan)


class ProcessRequest(BaseModel):
    job_id: str
    post_id: str
    job_type: str
    input_path: str
    options: Optional[Dict[str, Any]] = {}


class WebhookPayload(BaseModel):
    job_id: str
    post_id: str
    status: str
    output_path: Optional[str] = ""
    job_type: str
    error: Optional[str] = ""
    progress: int = 0


async def notify_api(payload: WebhookPayload):
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            await client.post(
                f"{GO_API_URL}/api/v1/ai/webhook",
                json=payload.model_dump(),
            )
        except Exception as e:
            logger.error(f"Failed to notify API: {e}")


async def run_job(req: ProcessRequest):
    logger.info(f"Starting job {req.job_id} type={req.job_type}")

    try:
        # Resolve absolute path from relative URL
        input_abs = resolve_path(req.input_path)
        if not os.path.exists(input_abs):
            raise FileNotFoundError(f"Input file not found: {input_abs}")

        output_path = ""

        if req.job_type == "noise_reduction":
            output_path = await audio_processor.noise_reduction(
                input_abs, req.job_id, req.options
            )

        elif req.job_type == "master":
            output_path = await audio_processor.master_audio(
                input_abs, req.job_id, req.options
            )

        elif req.job_type == "pitch_correct":
            output_path = await audio_processor.pitch_correct(
                input_abs, req.job_id, req.options
            )

        elif req.job_type == "captions":
            output_path = await audio_processor.generate_captions(
                input_abs, req.job_id, req.options
            )

        elif req.job_type == "beat_detect":
            result = await audio_processor.detect_beats(input_abs)
            # Store beat data as JSON file
            import json
            out_file = os.path.join(STORAGE_PATH, "ai", req.job_id + "_beats.json")
            os.makedirs(os.path.dirname(out_file), exist_ok=True)
            with open(out_file, "w") as f:
                json.dump(result, f)
            output_path = "/uploads/ai/" + req.job_id + "_beats.json"

        elif req.job_type == "stabilize":
            output_path = await video_processor.stabilize(
                input_abs, req.job_id, req.options
            )

        elif req.job_type == "background_remove":
            output_path = await video_processor.remove_background(
                input_abs, req.job_id, req.options
            )

        elif req.job_type == "thumbnail":
            output_path = await video_processor.generate_thumbnail(
                input_abs, req.job_id
            )

        elif req.job_type == "full_produce":
            # Pipeline: noise reduction → pitch correct → master → captions
            step1 = await audio_processor.noise_reduction(input_abs, req.job_id + "_nr", req.options)
            step2 = await audio_processor.pitch_correct(resolve_path(step1), req.job_id + "_pc", req.options)
            output_path = await audio_processor.master_audio(resolve_path(step2), req.job_id + "_master", req.options)
            # Also generate captions
            await audio_processor.generate_captions(input_abs, req.job_id + "_cap", req.options)

        else:
            raise ValueError(f"Unknown job type: {req.job_type}")

        logger.info(f"Job {req.job_id} completed: {output_path}")
        await notify_api(WebhookPayload(
            job_id=req.job_id,
            post_id=req.post_id,
            status="done",
            output_path=output_path,
            job_type=req.job_type,
            progress=100,
        ))

    except Exception as e:
        logger.error(f"Job {req.job_id} failed: {e}", exc_info=True)
        await notify_api(WebhookPayload(
            job_id=req.job_id,
            post_id=req.post_id,
            status="failed",
            job_type=req.job_type,
            error=str(e),
            progress=0,
        ))


def resolve_path(url_path: str) -> str:
    """Convert relative /uploads/... URL to absolute filesystem path."""
    if url_path.startswith("/uploads/"):
        return STORAGE_PATH + url_path[len("/uploads"):]
    if os.path.isabs(url_path):
        return url_path
    return os.path.join(STORAGE_PATH, url_path)


@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": audio_processor is not None}


@app.post("/process")
async def process(req: ProcessRequest, background_tasks: BackgroundTasks):
    if audio_processor is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet")
    background_tasks.add_task(run_job, req)
    return {"job_id": req.job_id, "status": "queued"}
