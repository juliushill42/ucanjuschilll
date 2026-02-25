#!/bin/bash
# Astra Platform - Complete Deployment Script
# IP: Julius Cameron Hill (12261958 Protocol)

set -e

echo "🚀 Astra Platform Deployment"
echo "=============================="

# Create directory structure
mkdir -p {go-api,ai-worker,rust-ingest,init-db}

# Go API Dockerfile
cat > go-api/Dockerfile << 'EOF'
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o api main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/api .
EXPOSE 8080
CMD ["./api"]
EOF

# Go API go.mod
cat > go-api/go.mod << 'EOF'
module astra-api

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/jmoiron/sqlx v1.3.5
	github.com/lib/pq v1.10.9
	golang.org/x/crypto v0.17.0
)
EOF

# AI Worker Dockerfile
cat > ai-worker/Dockerfile << 'EOF'
FROM pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime
WORKDIR /app
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ai_worker.py .
CMD ["python", "ai_worker.py"]
EOF

# AI Worker requirements
cat > ai-worker/requirements.txt << 'EOF'
torch==2.1.0
opencv-python-headless==4.8.1.78
numpy==1.26.2
requests==2.31.0
EOF

# Rust Ingest Dockerfile
cat > rust-ingest/Dockerfile << 'EOF'
FROM rust:1.75 AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y libavcodec-dev libavformat-dev libavutil-dev libswscale-dev pkg-config
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libavcodec59 libavformat59 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/astra-ingest .
EXPOSE 1935
CMD ["./astra-ingest"]
EOF

# Rust Cargo.toml
cat > rust-ingest/Cargo.toml << 'EOF'
[package]
name = "astra-ingest"
version = "1.0.0"
edition = "2021"

[dependencies]
tokio = { version = "1.35", features = ["full"] }
bytes = "1.5"
tracing = "0.1"
tracing-subscriber = "0.3"
uuid = { version = "1.6", features = ["v4", "serde"] }
anyhow = "1.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
reqwest = { version = "0.11", features = ["json"] }
ffmpeg-next = "6.1"
EOF

# PostgreSQL init script
cat > init-db/01_init.sql << 'EOF'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stream_key VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) DEFAULT 'New Astra Stream',
    category VARCHAR(100),
    is_live BOOLEAN DEFAULT FALSE,
    viewer_count INT DEFAULT 0,
    last_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ai_highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    clip_url TEXT NOT NULL,
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    ai_label VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stream_key ON streams(stream_key);
CREATE INDEX idx_is_live ON streams(is_live);
CREATE INDEX idx_user_streams ON streams(user_id);
EOF

# Nginx config
cat > nginx.conf << 'EOF'
events {
    worker_connections 4096;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    server {
        listen 80;
        
        location /hls/ {
            alias /usr/share/nginx/html/hls/;
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
            add_header Cache-Control no-cache;
            add_header Access-Control-Allow-Origin *;
        }
        
        location /api/ {
            proxy_pass http://go-api:8080/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
EOF

# Create src directory for Rust
mkdir -p rust-ingest/src

echo ""
echo "✅ Directory structure created"
echo "✅ Dockerfiles generated"
echo "✅ Configuration files ready"
echo ""
echo "📋 Next Steps:"
echo "1. Copy main.rs to rust-ingest/src/"
echo "2. Copy main.go to go-api/"
echo "3. Copy ai_worker.py to ai-worker/"
echo "4. Run: docker-compose up --build"
echo ""
echo "🎯 RTMP Endpoint: rtmp://localhost:1935/live/YOUR_STREAM_KEY"
echo "🌐 API Endpoint: http://localhost:8080"
echo "📺 HLS Playback: http://localhost/hls/STREAM_ID/playlist.m3u8"