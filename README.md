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


PROPRIETARY & CONFIDENTIAL
Project: ASTRA (Advanced Systemic Task & Research Architecture)

Author & Chief Architect: Julius Cameron Hill Organization: Titan Universal AI LLC IP Status: All Rights Reserved. Primary Asset for High-Speed Data Ingestion & API Orchestration.

## I. Executive Summary (The "Fifth-Grader" View)
ASTRA is like a high-speed "Vacuum" and "Brain" combined. It uses a very fast language (Rust) to suck up huge amounts of information, a smart coordinator (Go) to organize it, and a specialized worker (Python) to understand it. It’s built to be "Plug-and-Play," meaning it can be launched and updated automatically with a single command.

## II. Technical Architecture (Billionaire Architect Specs)
This is a Triple-Language Pipeline designed for maximum throughput and sovereign control:

The Ingest Engine: Rust (astra_ingest_main.rs) handles the raw data intake. This ensures zero-cost abstractions and memory safety during high-velocity data ingestion.

The API Gateway: Go (astra_go_api_fixed.go) manages the external interface and internal routing. It is optimized for high concurrency and serves as the primary handshake for the ucanjuschilll platform.

The Intelligence Layer: Python (astra_ai_worker.py) acts as the specialized "Worker," processing ingested data using Titan-standard ML libraries.

Infrastructure & Automation:

astra_docker_compose.yml: Full containerization of the ingest, API, and worker nodes.

astra_deployment.sh: Industrial-grade automation for bootstrapping the entire mesh.

astra_testing.sh: A "No-Error" validation script to ensure system integrity before full deployment.

Database Integration: Utilizes Prisma for type-safe database access and high-speed schema management.

## III. Intellectual Property & Patent Claims
ASTRA Ingest-to-Worker Handshake: The proprietary method of passing data from the Rust ingestion kernel to the Python AI worker via the Go API bridge is a core Hill trade secret.

"Fixed" API Logic: The specific optimizations in astra_go_api_fixed.go for resolving connectivity bottlenecks in sovereign mesh networks are exclusive IP.

Unified Launch System: The architecture behind launch_all_fixed.txt and bootstrap_deploy.sh for one-touch deployment of a multi-language AI mesh is patent-pending.

## IV. Deployment & Operations (No-Error Instructions)
Environment Setup: Copy .env.example to .env.local and populate with Titan-standard credentials.

Infrastructure Ignition: Execute ./bootstrap_deploy.sh to initialize the Docker environment and database schemas.

Mesh Activation: Run ./astra_deployment.sh to compile the Rust ingestor and launch the Go API and Python worker containers.

Verification: Execute ./astra_testing.sh to run the "No-Error" diagnostic suite across all ports.

## V. Acquisition Audit Note (HCL Tech Focus)
ASTRA is the "Input Powerhouse" of the Titan fleet. For HCL Tech, this represents a pre-built solution for Big Data Ingestion that is far more efficient than standard cloud-native tools. Because it runs locally and is built on Rust and Go, it offers the performance and privacy that enterprise clients demand for sensitive data processing.

