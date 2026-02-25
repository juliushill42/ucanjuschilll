// ============================================================
// ASTRA — Rust RTMP Ingest Server
// Julius Cameron Hill IP
// Receives RTMP streams, validates keys, outputs HLS, feeds AI
// ============================================================

use anyhow::Result;
use bytes::Bytes;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::os::unix::net::UnixListener;
use std::path::Path;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::process::Command;
use tokio::sync::{Mutex, RwLock};
use tracing::{error, info, warn};
use uuid::Uuid;

// ── CONFIG ────────────────────────────────────────────────────
const RTMP_BIND: &str = "0.0.0.0:1935";
const HLS_OUTPUT_DIR: &str = "/tmp/astra/hls";
const AI_SOCKET_PATH: &str = "/tmp/astra/ai.sock";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StreamSession {
    stream_id: String,
    stream_key: String,
    user_id: String,
    started_at: u64,
}

#[derive(Debug, Serialize)]
struct ValidateRequest {
    stream_key: String,
}

#[derive(Debug, Deserialize)]
struct ValidateResponse {
    valid: bool,
    stream_id: Option<String>,
    user_id: Option<String>,
}

type ActiveStreams = Arc<RwLock<HashMap<String, StreamSession>>>;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    // Create output dirs
    tokio::fs::create_dir_all(HLS_OUTPUT_DIR).await?;
    tokio::fs::create_dir_all("/tmp/astra").await?;

    let active_streams: ActiveStreams = Arc::new(RwLock::new(HashMap::new()));
    let http_client = Arc::new(Client::new());
    let go_api_url = std::env::var("GO_API_URL")
        .unwrap_or_else(|_| "http://go-api:8080".to_string());

    info!("ASTRA Ingest Server starting on {}", RTMP_BIND);

    let listener = TcpListener::bind(RTMP_BIND).await?;
    info!("RTMP listener bound — waiting for streams");

    loop {
        let (socket, addr) = listener.accept().await?;
        info!("New connection from {}", addr);

        let streams = Arc::clone(&active_streams);
        let client = Arc::clone(&http_client);
        let api_url = go_api_url.clone();

        tokio::spawn(async move {
            if let Err(e) = handle_rtmp_connection(socket, addr.to_string(), streams, client, api_url).await {
                error!("Connection error from {}: {}", addr, e);
            }
        });
    }
}

async fn handle_rtmp_connection(
    mut socket: tokio::net::TcpStream,
    addr: String,
    active_streams: ActiveStreams,
    client: Arc<Client>,
    go_api_url: String,
) -> Result<()> {
    // RTMP handshake — C0+C1
    let mut handshake_buf = vec![0u8; 1537];
    socket.read_exact(&mut handshake_buf).await?;

    // S0+S1+S2 response
    let mut response = vec![0u8; 3073];
    response[0] = 3; // RTMP version
    socket.write_all(&response).await?;

    // Read C2
    let mut c2 = vec![0u8; 1536];
    socket.read_exact(&mut c2).await?;

    info!("RTMP handshake complete with {}", addr);

    // Parse stream key from RTMP connect/publish messages
    let stream_key = parse_stream_key(&mut socket).await
        .unwrap_or_else(|_| "unknown".to_string());

    if stream_key == "unknown" {
        warn!("Could not parse stream key from {}", addr);
        return Ok(());
    }

    // Validate stream key with Go API
    let validate_url = format!("{}/validate-stream-key", go_api_url);
    let validate_resp = client
        .post(&validate_url)
        .json(&ValidateRequest { stream_key: stream_key.clone() })
        .send()
        .await?
        .json::<ValidateResponse>()
        .await?;

    if !validate_resp.valid {
        warn!("Invalid stream key: {} from {}", stream_key, addr);
        return Ok(());
    }

    let stream_id = validate_resp.stream_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let user_id = validate_resp.user_id.unwrap_or_default();

    info!("Stream validated: {} (user: {})", stream_id, user_id);

    // Notify Go API stream started
    let start_url = format!("{}/streams/{}/start", go_api_url, stream_key);
    let _ = client.post(&start_url).send().await;

    // Register active stream
    {
        let mut streams = active_streams.write().await;
        streams.insert(stream_key.clone(), StreamSession {
            stream_id: stream_id.clone(),
            stream_key: stream_key.clone(),
            user_id,
            started_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        });
    }

    // Start FFmpeg HLS transcoder
    let hls_dir = format!("{}/{}", HLS_OUTPUT_DIR, stream_id);
    tokio::fs::create_dir_all(&hls_dir).await?;

    let ffmpeg_handle = start_hls_transcoder(&stream_key, &stream_id, &hls_dir).await;

    // Feed frames to AI worker
    feed_ai_worker(&stream_id, &mut socket).await?;

    // Stream ended
    info!("Stream ended: {}", stream_key);

    // Notify Go API stream stopped
    let stop_url = format!("{}/streams/{}/stop", go_api_url, stream_key);
    let _ = client.post(&stop_url).send().await;

    // Cleanup
    {
        let mut streams = active_streams.write().await;
        streams.remove(&stream_key);
    }

    if let Some(mut ffmpeg) = ffmpeg_handle {
        let _ = ffmpeg.kill().await;
    }

    Ok(())
}

async fn parse_stream_key(socket: &mut tokio::net::TcpStream) -> Result<String> {
    // Read RTMP chunks to find stream key from publish message
    // Simplified parser — reads until we find the stream key pattern
    let mut buf = vec![0u8; 4096];
    let n = socket.read(&mut buf).await?;

    // Look for stream key in RTMP publish message
    // In production: use full RTMP AMF0 parser
    let data = String::from_utf8_lossy(&buf[..n]);
    if let Some(key_start) = data.find("live/") {
        let key = &data[key_start + 5..];
        let key_end = key.find(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
            .unwrap_or(key.len());
        return Ok(key[..key_end].to_string());
    }

    Ok("unknown".to_string())
}

async fn start_hls_transcoder(
    stream_key: &str,
    stream_id: &str,
    hls_dir: &str,
) -> Option<tokio::process::Child> {
    let playlist = format!("{}/playlist.m3u8", hls_dir);
    let segment = format!("{}/seg%03d.ts", hls_dir);

    let result = Command::new("ffmpeg")
        .args([
            "-i", &format!("rtmp://localhost/live/{}", stream_key),
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-b:v", "2500k",
            "-maxrate", "2500k",
            "-bufsize", "5000k",
            "-c:a", "aac",
            "-b:a", "128k",
            "-f", "hls",
            "-hls_time", "2",
            "-hls_list_size", "10",
            "-hls_flags", "delete_segments+append_list",
            "-hls_segment_filename", &segment,
            &playlist,
        ])
        .spawn();

    match result {
        Ok(child) => {
            info!("FFmpeg HLS transcoder started for stream {}", stream_id);
            Some(child)
        }
        Err(e) => {
            error!("Failed to start FFmpeg: {}", e);
            None
        }
    }
}

async fn feed_ai_worker(stream_id: &str, socket: &mut tokio::net::TcpStream) -> Result<()> {
    // Connect to AI worker Unix socket
    let ai_sock_path = std::env::var("AI_SOCKET_PATH")
        .unwrap_or_else(|_| AI_SOCKET_PATH.to_string());

    if !Path::new(&ai_sock_path).exists() {
        warn!("AI socket not found at {}, skipping AI analysis", ai_sock_path);
        // Still drain the socket so connection stays alive
        drain_socket(socket).await?;
        return Ok(());
    }

    let mut ai_conn = tokio::net::UnixStream::connect(&ai_sock_path).await?;
    info!("Connected to AI worker for stream {}", stream_id);

    // Read RTMP data, extract frames, forward to AI
    let mut buf = vec![0u8; 65536];
    let mut frame_buffer = Vec::new();
    let mut frame_count = 0u64;

    loop {
        let n = match socket.read(&mut buf).await {
            Ok(0) => break, // Connection closed
            Ok(n) => n,
            Err(e) => {
                error!("Socket read error: {}", e);
                break;
            }
        };

        frame_buffer.extend_from_slice(&buf[..n]);
        frame_count += 1;

        // Send every 30th chunk to AI (sampling)
        if frame_count % 30 == 0 && !frame_buffer.is_empty() {
            let frame_len = frame_buffer.len() as u32;
            let len_bytes = frame_len.to_le_bytes();

            if ai_conn.write_all(&len_bytes).await.is_err() {
                warn!("AI worker disconnected");
                break;
            }

            if ai_conn.write_all(&frame_buffer).await.is_err() {
                warn!("AI worker write error");
                break;
            }

            frame_buffer.clear();
        }
    }

    Ok(())
}

async fn drain_socket(socket: &mut tokio::net::TcpStream) -> Result<()> {
    let mut buf = vec![0u8; 4096];
    loop {
        match socket.read(&mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }
    }
    Ok(())
}
