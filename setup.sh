#!/bin/bash
set -e

echo "🎵 JusChill Platform Setup"
echo "=========================="

if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env from .env.example"
  echo "⚠️  Edit .env before continuing (add API keys, change passwords)"
  echo "   Run: nano .env"
  exit 1
fi

echo "✅ .env found"
echo "🐳 Building and starting all services..."

docker compose pull postgres redis 2>/dev/null || true
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 15

STATUS=$(docker compose ps --format json 2>/dev/null | python3 -c "import sys,json; data=[json.loads(l) for l in sys.stdin if l.strip()]; unhealthy=[d['Name'] for d in data if d.get('Health','healthy') not in ('healthy','')]; print('unhealthy: '+', '.join(unhealthy) if unhealthy else 'all healthy')" 2>/dev/null || echo "check manually")

echo ""
echo "✅ JusChill is live!"
echo ""
echo "  🌐 Platform:  http://localhost"
echo "  🔌 API:       http://localhost/api/v1/health"
echo "  📡 RTMP:      rtmp://localhost/live"
echo "  📺 HLS:       http://localhost/hls/"
echo ""
echo "Services: $STATUS"
echo ""
echo "📋 Logs: docker compose logs -f"
echo "🛑 Stop: docker compose down"
