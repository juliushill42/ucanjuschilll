import asyncio
import logging
import os
import json
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any

import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel

from processors.audio import AudioProcessor
from processors.video import VideoProcessor
from services.vertex_ai import VertexAIService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger("ai-worker")

GO_API_URL    = os.environ.get("GO_API_URL",    "http://juschill-go-api:8000")
STORAGE_PATH  = os.environ.get("STORAGE_PATH",  "/data/uploads")
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
GCP_REGION     = os.environ.get("GCP_REGION", "us-central1")

audio_processor:   Optional[AudioProcessor]   = None
video_processor:   Optional[VideoProcessor]   = None
vertex_ai_service: Optional[VertexAIService]  = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global audio_processor, video_processor, vertex_ai_service

    logger.info("Initializing AI Worker...")

    if not GCP_PROJECT_ID:
        raise RuntimeError("GCP_PROJECT_ID environment variable must be set")

    vertex_ai_service = VertexAIService(project_id=GCP_PROJECT_ID, region=GCP_REGION)
    logger.info(f"Vertex AI initialized: project={GCP_PROJECT_ID}, region={GCP_REGION}")

    audio_processor = AudioProcessor(storage_path=STORAGE_PATH)
    video_processor = VideoProcessor(storage_path=STORAGE_PATH)
    await audio_processor.load_models()
    logger.info("AI models loaded")

    yield

    logger.info("Shutting down AI worker")


app = FastAPI(title="JusChill AI Worker (Vertex AI)", lifespan=lifespan)


class ProcessRequest(BaseModel):
    job_id:     str
    post_id:    str
    job_type:   str
    input_path: str
    options:    Optional[Dict[str, Any]] = {}


class WebhookPayload(BaseModel):
    job_id:      str
    post_id:     str
    status:      str
    output_path: Optional[str] = ""
    job_type:    str
    error:       Optional[str] = ""
    progress:    int = 0
    metadata:    Optional[Dict[str, Any]] = {}


async def notify_api(payload: WebhookPayload):
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            await client.post(
                f"{GO_API_URL}/api/v1/ai/webhook",
                json=payload.model_dump(),
            )
        except Exception as e:
            logger.error(f"Failed to notify API: {e}")


def resolve_path(url_path: str) -> str:
    if url_path.startswith("/uploads/"):
        return STORAGE_PATH + url_path[len("/uploads"):]
    if os.path.isabs(url_path):
        return url_path
    return os.path.join(STORAGE_PATH, url_path)


async def save_captions_to_file(captions: list, job_id: str) -> str:
    out_file = os.path.join(STORAGE_PATH, "ai", job_id + "_captions.json")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w") as f:
        json.dump(captions, f)
    return f"/uploads/ai/{job_id}_captions.json"


async def run_job(req: ProcessRequest):
    logger.info(f"Starting job {req.job_id} type={req.job_type}")
    try:
        input_abs = resolve_path(req.input_path)
        if not os.path.exists(input_abs):
            raise FileNotFoundError(f"Input file not found: {input_abs}")

        output_path = ""
        metadata    = {}

        if req.job_type == "noise_reduction":
            output_path = await audio_processor.noise_reduction(input_abs, req.job_id, req.options)
        elif req.job_type == "master":
            output_path = await audio_processor.master_audio(input_abs, req.job_id, req.options)
        elif req.job_type == "pitch_correct":
            output_path = await audio_processor.pitch_correct(input_abs, req.job_id, req.options)
        elif req.job_type == "captions":
            caption_data = await vertex_ai_service.generate_captions(input_abs, req.job_id)
            output_path  = await save_captions_to_file(caption_data, req.job_id)
            metadata = {"captions": caption_data}
        elif req.job_type == "beat_detect":
            result   = await audio_processor.detect_beats(input_abs)
            out_file = os.path.join(STORAGE_PATH, "ai", req.job_id + "_beats.json")
            os.makedirs(os.path.dirname(out_file), exist_ok=True)
            with open(out_file, "w") as f:
                json.dump(result, f)
            output_path = "/uploads/ai/" + req.job_id + "_beats.json"
            metadata = result
        elif req.job_type == "stabilize":
            output_path = await video_processor.stabilize(input_abs, req.job_id, req.options)
        elif req.job_type == "background_remove":
            output_path = await video_processor.remove_background(input_abs, req.job_id, req.options)
        elif req.job_type == "thumbnail":
            output_path = await video_processor.generate_thumbnail(input_abs, req.job_id)
        elif req.job_type == "text_to_speech":
            text  = req.options.get("text", "")
            voice = req.options.get("voice", "en-US-Neural2-C")
            if not text:
                raise ValueError("text_to_speech requires 'text' option")
            await vertex_ai_service.synthesize_speech(text, voice, req.job_id)
            output_path = f"/uploads/ai/{req.job_id}_tts.wav"
        elif req.job_type == "full_produce":
            step1 = await audio_processor.noise_reduction(input_abs, req.job_id + "_nr", req.options)
            step2 = await audio_processor.pitch_correct(resolve_path(step1), req.job_id + "_pc", req.options)
            output_path  = await audio_processor.master_audio(resolve_path(step2), req.job_id + "_master", req.options)
            caption_data = await vertex_ai_service.generate_captions(input_abs, req.job_id + "_cap")
            metadata = {"captions": caption_data}
        else:
            raise ValueError(f"Unknown job type: {req.job_type}")

        logger.info(f"Job {req.job_id} completed: {output_path}")
        await notify_api(WebhookPayload(
            job_id=req.job_id, post_id=req.post_id, status="done",
            output_path=output_path, job_type=req.job_type, progress=100, metadata=metadata,
        ))

    except Exception as e:
        logger.error(f"Job {req.job_id} failed: {e}", exc_info=True)
        await notify_api(WebhookPayload(
            job_id=req.job_id, post_id=req.post_id, status="failed",
            job_type=req.job_type, error=str(e), progress=0,
        ))


@app.get("/health")
async def health():
    return {
        "status":          "ok",
        "models_loaded":   audio_processor is not None,
        "vertex_ai_ready": vertex_ai_service is not None,
    }


@app.post("/process")
async def process(req: ProcessRequest, background_tasks: BackgroundTasks):
    if audio_processor is None or vertex_ai_service is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet")
    background_tasks.add_task(run_job, req)
    return {"job_id": req.job_id, "status": "queued"}
