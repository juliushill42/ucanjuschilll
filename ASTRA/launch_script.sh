#!/bin/bash
# Astra Platform - Broke Founder Launch Script
# Uses: Local machine + SSD + GPU credits (RunPod/Vast.ai)
# Cost: $0/month cloud, ~$20/month GPU credits

set -e

echo "🚀 ASTRA PLATFORM - ZERO-COST LAUNCH"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker not installed${NC}"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}❌ Docker Compose not installed${NC}"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo -e "${RED}❌ curl not installed${NC}"; exit 1; }

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Setup directories on SSD
echo "📁 Setting up directories..."

SSD_PATH="/mnt/ssd/astra"
HDD_PATH="/mnt/hdd/astra-backup"

# Detect mount points (adjust for your system)
if [ ! -d "/mnt/ssd" ]; then
    echo -e "${YELLOW}⚠️  /mnt/ssd not found, using ~/astra instead${NC}"
    SSD_PATH="$HOME/astra"
fi

mkdir -p $SSD_PATH/{postgres,redis,hls,logs}
mkdir -p $HDD_PATH

echo -e "${GREEN}✅ Directories created${NC}"
echo ""

# Generate ngrok config for remote GPU access
echo "🌐 Setting up remote GPU tunnel..."

cat > ngrok.yml << EOF
version: "2"
authtoken: YOUR_NGROK_TOKEN_HERE
tunnels:
  rtmp:
    proto: tcp
    addr: 1935
  api:
    proto: http
    addr: 8080
  socket:
    proto: http
    addr: 9000
EOF

echo -e "${YELLOW}⚠️  Edit ngrok.yml with your token from ngrok.com${NC}"
echo ""

# Create .env file
echo "🔧 Creating environment configuration..."

cat > .env << EOF
# Database
DATABASE_URL=postgresql://astra_admin:local_dev_password@localhost:5432/astra_platform

# JWT Secret (change for production)
JWT_SECRET=broke_founder_jwt_secret_12261958

# Storage Paths
HLS_OUTPUT_DIR=$SSD_PATH/hls
LOG_DIR=$SSD_PATH/logs

# Remote GPU Worker (for RunPod/Vast.ai)
RUNPOD_API_KEY=your_runpod_api_key
GPU_WORKER_URL=https://your-runpod-instance.runpod.io

# Ngrok URLs (fill after starting ngrok)
NGROK_RTMP_URL=tcp://0.tcp.ngrok.io:12345
NGROK_API_URL=https://abc123.ngrok.io
EOF

echo -e "${GREEN}✅ Configuration created${NC}"
echo ""

# Start local services
echo "🐳 Starting local services..."

docker-compose -f docker-compose-local.yml up -d

echo -e "${GREEN}✅ Services starting...${NC}"
echo ""

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 5

# Health checks
echo "🏥 Running health checks..."

check_service() {
    local name=$1
    local url=$2
    
    if curl -sf $url > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not responding${NC}"
        return 1
    fi
}

check_service "PostgreSQL" "http://localhost:5432" || true
check_service "Go API" "http://localhost:8080/streams/live"
check_service "Nginx" "http://localhost:80/health"

echo ""

# Setup RunPod GPU worker
echo "🎮 GPU Worker Setup (RunPod/Vast.ai)..."
echo ""
echo "Option 1: RunPod"
echo "  1. Go to runpod.io"
echo "  2. Deploy PyTorch template"
echo "  3. Upload ai_worker.py"
echo "  4. Set env: GO_API_URL=\$NGROK_API_URL"
echo ""
echo "Option 2: Vast.ai"
echo "  1. Go to vast.ai"
echo "  2. Search 'pytorch'"
echo "  3. Deploy cheapest GPU (~\$0.15/hr)"
echo "  4. SSH and run ai_worker.py"
echo ""

# Generate test stream key
echo "🔑 Generating test stream key..."

RESPONSE=$(curl -s -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@local.dev","password":"test123"}')

if echo $RESPONSE | grep -q "user_id"; then
    echo -e "${GREEN}✅ Test user created${NC}"
    
    # Login to get token
    TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8080/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@local.dev","password":"test123"}')
    
    if echo $TOKEN_RESPONSE | grep -q "token"; then
        TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.token')
        
        # Get stream key
        STREAM_KEY=$(curl -s -X GET http://localhost:8080/stream-key \
          -H "Authorization: Bearer $TOKEN" | jq -r '.stream_key')
        
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}🎉 ASTRA PLATFORM LAUNCHED!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "📺 Web Player: http://localhost"
        echo "🔌 API: http://localhost:8080"
        echo "📊 Logs: docker-compose logs -f"
        echo ""
        echo "🎬 OBS Settings:"
        echo "   Server: rtmp://localhost/live"
        echo "   Stream Key: $STREAM_KEY"
        echo ""
        echo "💰 Monthly Costs:"
        echo "   Infrastructure: \$0 (running locally)"
        echo "   GPU Credits: ~\$20 (RunPod/Vast.ai)"
        echo "   Domain: \$0 (use ngrok free tier)"
        echo "   TOTAL: ~\$20/month"
        echo ""
        echo "📈 Revenue Strategy:"
        echo "   1. Demo to 20 companies this week"
        echo "   2. License tech for \$10K-50K"
        echo "   3. Or: Get 50 beta users → monetize"
        echo ""
        echo "🚀 Next Steps:"
        echo "   1. Start ngrok: ngrok start --all"
        echo "   2. Deploy GPU worker to RunPod"
        echo "   3. Test stream with OBS"
        echo "   4. Send demo video to prospects"
        echo ""
    fi
else
    echo -e "${RED}❌ Failed to create test user${NC}"
fi

# Backup script
echo "💾 Creating backup script..."

cat > backup.sh << 'EOF'
#!/bin/bash
# Backup to HDD daily
DATE=$(date +%Y%m%d)
tar -czf /mnt/hdd/astra-backup/backup-$DATE.tar.gz \
  /mnt/ssd/astra/postgres \
  /mnt/ssd/astra/redis \
  /mnt/ssd/astra/hls

# Keep only last 7 days
find /mnt/hdd/astra-backup -name "backup-*.tar.gz" -mtime +7 -delete
EOF

chmod +x backup.sh

echo -e "${GREEN}✅ Backup script created (./backup.sh)${NC}"
echo ""

# Create monitoring dashboard
echo "📊 Creating monitoring dashboard..."

cat > monitor.sh << 'EOF'
#!/bin/bash
# Simple monitoring dashboard

while true; do
    clear
    echo "🎥 ASTRA PLATFORM STATUS"
    echo "======================="
    echo ""
    
    echo "📦 Docker Services:"
    docker-compose ps
    echo ""
    
    echo "💾 Storage Usage:"
    df -h | grep -E "ssd|hdd"
    echo ""
    
    echo "🔥 Active Streams:"
    curl -s http://localhost:8080/streams/live | jq -r '.[] | "  • \(.title) (\(.viewer_count) viewers)"' 2>/dev/null || echo "  No active streams"
    echo ""
    
    echo "📊 API Stats (last 10 requests):"
    docker logs astra-api-local --tail 10 2>/dev/null | grep -E "POST|GET" | tail -5
    echo ""
    
    sleep 5
done
EOF

chmod +x monitor.sh

echo -e "${GREEN}✅ Monitor script created (./monitor.sh)${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 LAUNCH COMPLETE - READY TO DEMO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"