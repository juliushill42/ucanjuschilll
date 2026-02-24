use anyhow::{anyhow, Result};
use bytes::{Buf, BufMut, Bytes, BytesMut};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::process::Command;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

const RTMP_HANDSHAKE_C0C1_SIZE: usize = 1537;
const RTMP_HANDSHAKE_S0S1S2_SIZE: usize = 3073;
const RTMP_HANDSHAKE_C2_SIZE: usize = 1536;
const RTMP_CHUNK_HEADER_FMT0_SIZE: usize = 12;

#[derive(Debug, Clone)]
struct StreamSession {
    stream_key: String,
    user_id: String,
    hls_dir: String,
    ffmpeg_pid: Option<u32>,
}

type Sessions = Arc<Mutex<HashMap<String, StreamSession>>>;

#[derive(Serialize)]
struct StreamStartPayload {
    stream_key: String,
    hls_url: String,
}

#[derive(Serialize)]
struct StreamEndPayload {
    stream_key: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("juschill_ingest=info".parse().unwrap()),
        )
        .init();

    let bind_addr = env::var("RTMP_BIND").unwrap_or_else(|_| "0.0.0.0:1935".to_string());
    let hls_output_dir = env::var("HLS_OUTPUT_DIR").unwrap_or_else(|_| "/tmp/juschill/hls".to_string());
    let go_api_url = env::var("GO_API_URL").unwrap_or_else(|_| "http://juschill-go-api:8000".to_string());

    tokio::fs::create_dir_all(&hls_output_dir).await?;

    let sessions: Sessions = Arc::new(Mutex::new(HashMap::new()));
    let listener = TcpListener::bind(&bind_addr).await?;
    info!("RTMP ingest listening on {}", bind_addr);

    loop {
        match listener.accept().await {
            Ok((socket, peer)) => {
                info!("New RTMP connection from {}", peer);
                let sessions_clone = sessions.clone();
                let hls_dir = hls_output_dir.clone();
                let api_url = go_api_url.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(socket, sessions_clone, hls_dir, api_url).await {
                        error!("Connection error from {}: {}", peer, e);
                    }
                });
            }
            Err(e) => {
                error!("Accept error: {}", e);
            }
        }
    }
}

async fn handle_connection(
    mut socket: TcpStream,
    sessions: Sessions,
    hls_dir: String,
    go_api_url: String,
) -> Result<()> {
    // ── RTMP Handshake ────────────────────────────────────────────────────────
    let mut c0c1 = vec![0u8; RTMP_HANDSHAKE_C0C1_SIZE];
    socket.read_exact(&mut c0c1).await?;

    if c0c1[0] != 0x03 {
        return Err(anyhow!("Unsupported RTMP version: {}", c0c1[0]));
    }

    // S0S1S2: version + zeros for S1, echo C1 for S2
    let mut s0s1s2 = vec![0u8; RTMP_HANDSHAKE_S0S1S2_SIZE];
    s0s1s2[0] = 0x03;
    // S1: timestamp (4 bytes) + zeros (4 bytes) + 1528 random bytes
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as u32;
    s0s1s2[1..5].copy_from_slice(&ts.to_be_bytes());
    // S2 = echo of C1 (bytes 1..1537 of c0c1)
    s0s1s2[1537..].copy_from_slice(&c0c1[1..]);

    socket.write_all(&s0s1s2).await?;

    let mut c2 = vec![0u8; RTMP_HANDSHAKE_C2_SIZE];
    socket.read_exact(&mut c2).await?;

    info!("RTMP handshake complete");

    // ── Chunk Stream Processing ───────────────────────────────────────────────
    let mut buf = BytesMut::with_capacity(65536);
    let mut stream_key: Option<String> = None;
    let mut ffmpeg_child: Option<tokio::process::Child> = None;
    let mut ffmpeg_stdin: Option<tokio::process::ChildStdin> = None;
    let mut publishing = false;

    loop {
        let mut tmp = [0u8; 4096];
        let n = match socket.read(&mut tmp).await {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) => {
                warn!("Read error: {}", e);
                break;
            }
        };

        buf.extend_from_slice(&tmp[..n]);

        // Try to parse RTMP chunks
        loop {
            if buf.is_empty() {
                break;
            }

            let first_byte = buf[0];
            let fmt = (first_byte >> 6) & 0x03;
            let csid = (first_byte & 0x3f) as usize;

            // Basic chunk header parsing for connect/publish/data
            if buf.len() < 12 {
                break; // Wait for more data
            }

            // For this implementation, we detect publish/connect by looking for known AMF strings
            let data_slice = &buf[..buf.len().min(256)];
            let data_str = String::from_utf8_lossy(data_slice);

            // Detect stream key from publish command
            if data_str.contains("publish") && stream_key.is_none() {
                // Extract stream key - it follows the "publish" AMF string
                if let Some(key) = extract_stream_key_from_amf(&buf) {
                    info!("Stream publishing with key: {}", &key[..key.len().min(8)]);
                    stream_key = Some(key.clone());

                    // Verify stream key with API
                    match verify_stream_key(&go_api_url, &key).await {
                        Ok(user_id) => {
                            info!("Stream key verified for user {}", user_id);
                            let hls_stream_dir = format!("{}/{}", hls_dir, &key[..8]);
                            tokio::fs::create_dir_all(&hls_stream_dir).await?;

                            // Launch ffmpeg to transcode RTMP → HLS
                            let mut child = Command::new("ffmpeg")
                                .args([
                                    "-i", "pipe:0",
                                    "-c:v", "libx264",
                                    "-preset", "veryfast",
                                    "-tune", "zerolatency",
                                    "-crf", "23",
                                    "-c:a", "aac",
                                    "-ar", "44100",
                                    "-b:a", "128k",
                                    "-f", "hls",
                                    "-hls_time", "2",
                                    "-hls_list_size", "6",
                                    "-hls_flags", "delete_segments+append_list",
                                    "-hls_segment_filename", &format!("{}/seg_%03d.ts", hls_stream_dir),
                                    &format!("{}/stream.m3u8", hls_stream_dir),
                                ])
                                .stdin(Stdio::piped())
                                .stdout(Stdio::null())
                                .stderr(Stdio::null())
                                .spawn()?;

                            ffmpeg_stdin = child.stdin.take();
                            ffmpeg_child = Some(child);
                            publishing = true;

                            // Notify API that stream started
                            let hls_url = format!("/hls/{}/stream.m3u8", &key[..8]);
                            notify_stream_start(&go_api_url, &key, &hls_url, &user_id).await.ok();

                            let session = StreamSession {
                                stream_key: key.clone(),
                                user_id,
                                hls_dir: hls_stream_dir,
                                ffmpeg_pid: None,
                            };
                            sessions.lock().await.insert(key, session);
                        }
                        Err(e) => {
                            warn!("Invalid stream key: {}", e);
                            return Err(anyhow!("Invalid stream key"));
                        }
                    }
                }
            }

            // Forward raw data to ffmpeg stdin if publishing
            if publishing {
                if let Some(stdin) = &mut ffmpeg_stdin {
                    let data = buf.clone().freeze();
                    if let Err(e) = stdin.write_all(&data).await {
                        warn!("ffmpeg stdin write error: {}", e);
                        break;
                    }
                }
            }

            // Consume buffer - simplified: consume all buffered data each cycle
            buf.clear();
            break;
        }
    }

    // Stream ended - cleanup
    if let Some(key) = &stream_key {
        info!("Stream ended for key {}", &key[..key.len().min(8)]);
        drop(ffmpeg_stdin);

        if let Some(mut child) = ffmpeg_child {
            let _ = child.wait().await;
        }

        notify_stream_end(&go_api_url, key).await.ok();

        let mut sess = sessions.lock().await;
        sess.remove(key);
    }

    Ok(())
}

fn extract_stream_key_from_amf(buf: &BytesMut) -> Option<String> {
    // AMF0 string format: 0x02 + 2-byte length + string bytes
    // Scan buffer for stream key pattern after "publish" command
    let data = buf.as_ref();
    let publish_marker = b"publish";

    if let Some(pos) = data.windows(publish_marker.len()).position(|w| w == publish_marker) {
        // Stream key should be an AMF string after the publish marker
        let search_from = pos + publish_marker.len();
        if search_from + 4 < data.len() {
            // Look for AMF0 string type (0x02)
            for i in search_from..data.len().saturating_sub(3) {
                if data[i] == 0x02 {
                    let len = u16::from_be_bytes([data[i + 1], data[i + 2]]) as usize;
                    if len > 0 && len < 128 && i + 3 + len <= data.len() {
                        let key_bytes = &data[i + 3..i + 3 + len];
                        if let Ok(key) = std::str::from_utf8(key_bytes) {
                            if key.len() >= 16 && key.chars().all(|c| c.is_ascii_alphanumeric()) {
                                return Some(key.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

async fn verify_stream_key(api_url: &str, key: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(&format!("{}/api/v1/stream/verify/{}", api_url, key))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await?;
        let user_id = body["user_id"]
            .as_str()
            .ok_or_else(|| anyhow!("No user_id in response"))?
            .to_string();
        Ok(user_id)
    } else {
        Err(anyhow!("Invalid stream key, status: {}", resp.status()))
    }
}

async fn notify_stream_start(api_url: &str, key: &str, hls_url: &str, user_id: &str) -> Result<()> {
    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "stream_key": key,
        "hls_url": hls_url,
        "user_id": user_id,
    });
    client
        .post(&format!("{}/api/v1/stream/started", api_url))
        .json(&payload)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await?;
    Ok(())
}

async fn notify_stream_end(api_url: &str, key: &str) -> Result<()> {
    let client = reqwest::Client::new();
    let payload = serde_json::json!({ "stream_key": key });
    client
        .post(&format!("{}/api/v1/stream/ended", api_url))
        .json(&payload)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await?;
    Ok(())
}
