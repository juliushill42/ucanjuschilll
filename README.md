# JusChill Platform 💯
### Built for the Artists, Dreamers, and the Unseen

Full-stack artist social platform + AI-powered studio (Voice & Vision).

## Quick Start
```bash
git clone <your-repo> && cd juschill
chmod +x setup.sh && ./setup.sh
```
Open http://localhost

## Stack
- **API**: Go + Gin
- **AI Worker**: Python + FastAPI + Whisper + FFmpeg
- **RTMP Ingest**: Rust + Tokio → HLS
- **Frontend**: Next.js 14 + TypeScript + Tailwind
- **DB**: PostgreSQL 15 | **Cache**: Redis 7 | **Proxy**: Nginx

## AI Features (Voice & Vision Studio)
- Noise Reduction, AI Mastering, Pitch Correction, Auto Captions (Whisper)
- Beat Detection, Video Stabilization, Auto Thumbnail

## Go Live (RTMP)
Profile → Reveal Stream Key → OBS: `rtmp://yourserver/live` + key

## Deploy to Production
Update `.env` with your domain, add SSL certs to `./ssl/`, run `docker compose up -d`

Built for ucanjuschill.com 💯
