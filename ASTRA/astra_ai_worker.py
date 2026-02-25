import socket
import struct
import os
import numpy as np
import torch
import cv2
import requests
from pathlib import Path

SOCKET_PATH = "/tmp/astra/ai.sock"
GO_API_URL = os.getenv("GO_API_URL", "http://localhost:8080")
FRAME_SAMPLE_RATE = 30
ACTION_THRESHOLD = 0.75
PROHIBITED_THRESHOLD = 0.85

class FrameAnalyzer:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.frame_count = 0
        print(f"AI Worker initialized on {self.device}")

    def analyze_frame(self, frame_bytes):
        try:
            np_arr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return None, None
            
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            variance = np.var(gray)
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            
            action_score = min(1.0, (variance / 5000.0 + edge_density) / 2)
            
            hist = cv2.calcHist([frame], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            prohibited_score = np.max(hist)
            
            return action_score, prohibited_score
            
        except Exception as e:
            print(f"Frame analysis error: {e}")
            return None, None

    def send_event(self, stream_id, event_type, score):
        try:
            if event_type == "highlight":
                requests.post(
                    f"{GO_API_URL}/ai/highlight",
                    json={"stream_id": stream_id, "timestamp": self.frame_count, "score": score},
                    timeout=1
                )
            elif event_type == "moderation":
                requests.post(
                    f"{GO_API_URL}/ai/moderation",
                    json={"stream_id": stream_id, "reason": f"Score: {score:.2f}"},
                    timeout=1
                )
        except Exception as e:
            print(f"Failed to send {event_type} event: {e}")

def main():
    Path(SOCKET_PATH).parent.mkdir(parents=True, exist_ok=True)
    
    if os.path.exists(SOCKET_PATH):
        os.remove(SOCKET_PATH)
    
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.bind(SOCKET_PATH)
    sock.listen(1)
    
    print(f"AI Worker listening on {SOCKET_PATH}")
    
    analyzer = FrameAnalyzer()
    
    while True:
        try:
            conn, _ = sock.accept()
            print("Rust ingest connected")
            stream_id = "unknown"
            
            while True:
                header = conn.recv(4)
                if not header:
                    print("Rust disconnected")
                    break
                
                frame_len = struct.unpack("I", header)[0]
                data = b""
                
                while len(data) < frame_len:
                    chunk = conn.recv(min(frame_len - len(data), 65536))
                    if not chunk:
                        break
                    data += chunk
                
                if len(data) != frame_len:
                    continue
                
                analyzer.frame_count += 1
                
                if analyzer.frame_count % FRAME_SAMPLE_RATE != 0:
                    continue
                
                action_score, prohibited_score = analyzer.analyze_frame(data)
                
                if action_score is None:
                    continue
                
                if action_score > ACTION_THRESHOLD:
                    print(f"🔥 Highlight detected: {action_score:.3f}")
                    analyzer.send_event(stream_id, "highlight", action_score)
                
                if prohibited_score > PROHIBITED_THRESHOLD:
                    print(f"🚨 Moderation alert: {prohibited_score:.3f}")
                    analyzer.send_event(stream_id, "moderation", prohibited_score)
                
                if analyzer.frame_count % 300 == 0:
                    print(f"Processed {analyzer.frame_count} frames")
                    
        except Exception as e:
            print(f"Connection error: {e}")

if __name__ == "__main__":
    main()