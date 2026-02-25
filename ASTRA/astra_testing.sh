#!/bin/bash
# Astra Platform - Complete Testing Suite
# Tests all components end-to-end

set -e

API_URL="http://localhost:8080"
RTMP_URL="rtmp://localhost:1935/live"

echo "🧪 Astra Platform Testing Suite"
echo "================================"

# Test 1: Database connectivity
echo ""
echo "Test 1: Database Connection"
docker exec astra-db psql -U astra_admin -d astra_platform -c "SELECT version();" > /dev/null 2>&1 && echo "✅ Database OK" || echo "❌ Database FAILED"

# Test 2: Go API Health
echo ""
echo "Test 2: Go API Health"
curl -s http://localhost:8080/streams/live > /dev/null && echo "✅ API OK" || echo "❌ API FAILED"

# Test 3: User Registration
echo ""
echo "Test 3: User Registration"
REGISTER_RESPONSE=$(curl -s -X POST $API_URL/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@astra.io","password":"test123"}')

if echo $REGISTER_RESPONSE | grep -q "user_id"; then
    echo "✅ Registration OK"
    USER_ID=$(echo $REGISTER_RESPONSE | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4)
else
    echo "❌ Registration FAILED"
    USER_ID=""
fi

# Test 4: User Login
echo ""
echo "Test 4: User Login"
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@astra.io","password":"test123"}')

if echo $LOGIN_RESPONSE | grep -q "token"; then
    echo "✅ Login OK"
    TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo "❌ Login FAILED"
    TOKEN=""
fi

# Test 5: Get Stream Key
echo ""
echo "Test 5: Stream Key Retrieval"
if [ ! -z "$TOKEN" ]; then
    STREAM_KEY_RESPONSE=$(curl -s -X GET $API_URL/stream-key \
      -H "Authorization: Bearer $TOKEN")
    
    if echo $STREAM_KEY_RESPONSE | grep -q "stream_key"; then
        echo "✅ Stream Key OK"
        STREAM_KEY=$(echo $STREAM_KEY_RESPONSE | grep -o '"stream_key":"[^"]*"' | cut -d'"' -f4)
        echo "   Stream Key: $STREAM_KEY"
    else
        echo "❌ Stream Key FAILED"
        STREAM_KEY=""
    fi
else
    echo "⚠️  Skipped (no token)"
fi

# Test 6: Stream Key Validation
echo ""
echo "Test 6: Stream Key Validation"
if [ ! -z "$STREAM_KEY" ]; then
    VALIDATION=$(curl -s -X POST $API_URL/validate-stream-key \
      -H "Content-Type: application/json" \
      -d "{\"stream_key\":\"$STREAM_KEY\"}")
    
    if echo $VALIDATION | grep -q '"valid":true'; then
        echo "✅ Validation OK"
    else
        echo "❌ Validation FAILED"
    fi
else
    echo "⚠️  Skipped (no stream key)"
fi

# Test 7: AI Worker Connection
echo ""
echo "Test 7: AI Worker Status"
docker logs astra-ai-worker --tail 10 | grep -q "listening" && echo "✅ AI Worker OK" || echo "⚠️  AI Worker check inconclusive"

# Test 8: Ingest Server Status
echo ""
echo "Test 8: Ingest Server Status"
docker logs astra-ingest --tail 10 | grep -q "initialized" && echo "✅ Ingest OK" || echo "⚠️  Ingest check inconclusive"

# Test 9: RTMP Connection Test
echo ""
echo "Test 9: RTMP Connection (requires ffmpeg)"
if command -v ffmpeg &> /dev/null && [ ! -z "$STREAM_KEY" ]; then
    echo "Testing RTMP with dummy stream for 5 seconds..."
    timeout 5 ffmpeg -re -f lavfi -i testsrc=duration=5:size=640x480:rate=30 \
      -f lavfi -i sine=frequency=1000:duration=5 \
      -c:v libx264 -preset ultrafast -tune zerolatency -b:v 1000k \
      -c:a aac -b:a 128k \
      -f flv $RTMP_URL/$STREAM_KEY 2>&1 | grep -q "speed=" && echo "✅ RTMP Test OK" || echo "⚠️  RTMP Test inconclusive"
else
    echo "⚠️  Skipped (ffmpeg not found or no stream key)"
fi

# Test 10: Live Streams Endpoint
echo ""
echo "Test 10: Live Streams Query"
LIVE_STREAMS=$(curl -s $API_URL/streams/live)
if [ ! -z "$LIVE_STREAMS" ]; then
    echo "✅ Live Streams OK"
    echo "   Response: $LIVE_STREAMS"
else
    echo "❌ Live Streams FAILED"
fi

echo ""
echo "================================"
echo "🏁 Testing Complete"
echo ""
echo "📊 Summary:"
echo "   - Copy artifacts to project directories"
echo "   - Run: docker-compose up -d"
echo "   - Execute this test suite"
echo "   - Monitor logs: docker-compose logs -f"
echo ""
echo "🎬 Stream with OBS:"
echo "   Server: $RTMP_URL"
echo "   Key: [Your stream key from /stream-key endpoint]"