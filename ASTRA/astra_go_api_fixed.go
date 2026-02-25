package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// ============================================================
// ASTRA — Go API (Fixed)
// Julius Cameron Hill IP
// Added: /health, viewer count updates, env-only secrets
// ============================================================

var db *sqlx.DB

func jwtSecret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		log.Fatal("[ASTRA] FATAL: JWT_SECRET not set")
	}
	return []byte(s)
}

type User struct {
	ID           string `db:"id"`
	Username     string `db:"username"`
	Email        string `db:"email"`
	PasswordHash string `db:"password_hash"`
}

type Stream struct {
	ID          string `db:"id" json:"id"`
	UserID      string `db:"user_id" json:"user_id"`
	StreamKey   string `db:"stream_key" json:"stream_key,omitempty"`
	IsLive      bool   `db:"is_live" json:"is_live"`
	Title       string `db:"title" json:"title"`
	ViewerCount int    `db:"viewer_count" json:"viewer_count"`
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("[ASTRA] DATABASE_URL not set")
	}

	var err error
	for i := 0; i < 10; i++ {
		db, err = sqlx.Connect("postgres", dbURL)
		if err == nil {
			break
		}
		log.Printf("[ASTRA] DB not ready, retrying (%d/10)...", i+1)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("[ASTRA] DB connection failed: %v", err)
	}
	defer db.Close()

	gin.SetMode(os.Getenv("GIN_MODE"))
	r := gin.Default()

	// ── HEALTH ───────────────────────────────────────────────
	r.GET("/health", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(503, gin.H{"status": "db_down"})
			return
		}
		c.JSON(200, gin.H{
			"status":    "ok",
			"service":   "astra-go-api",
			"timestamp": time.Now().UTC(),
		})
	})

	// ── PUBLIC ───────────────────────────────────────────────
	r.POST("/register", register)
	r.POST("/login", login)
	r.POST("/validate-stream-key", validateStreamKey)
	r.POST("/streams/:key/start", streamStart)
	r.POST("/streams/:key/stop", streamStop)
	r.POST("/streams/:key/heartbeat", streamHeartbeat)
	r.GET("/streams/live", getLiveStreams)
	r.GET("/streams/:id/watch", getWatchInfo)

	// ── AUTH REQUIRED ────────────────────────────────────────
	auth := r.Group("/")
	auth.Use(authMiddleware())
	{
		auth.GET("/stream-key", getStreamKey)
		auth.POST("/stream-key/refresh", refreshStreamKey)
		auth.GET("/me/stream", getMyStream)
	}

	// ── AI CALLBACKS ─────────────────────────────────────────
	r.POST("/ai/highlight", aiHighlight)
	r.POST("/ai/moderation", aiModeration)

	port := os.Getenv("ASTRA_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("[ASTRA] Go API running on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

func register(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required,min=3,max=30"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	var userID string
	err := db.QueryRow(`
		INSERT INTO users (username, email, password_hash)
		VALUES ($1, $2, $3) RETURNING id
	`, req.Username, req.Email, string(hash)).Scan(&userID)
	if err != nil {
		c.JSON(409, gin.H{"error": "Username or email already exists"})
		return
	}

	db.Exec(`
		INSERT INTO streams (user_id, stream_key, title)
		VALUES ($1, gen_random_uuid()::text, $2)
	`, userID, req.Username+"'s Stream")

	c.JSON(201, gin.H{"user_id": userID})
}

func login(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	var user User
	if err := db.Get(&user, "SELECT * FROM users WHERE email=$1", req.Email); err != nil {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	})
	tokenStr, _ := token.SignedString(jwtSecret())
	c.JSON(200, gin.H{"token": tokenStr, "user_id": user.ID, "username": user.Username})
}

func validateStreamKey(c *gin.Context) {
	var req struct {
		StreamKey string `json:"stream_key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"valid": false})
		return
	}

	var stream Stream
	err := db.Get(&stream, `
		SELECT id, user_id, stream_key, is_live, title, viewer_count
		FROM streams WHERE stream_key=$1
	`, req.StreamKey)

	if err == sql.ErrNoRows {
		c.JSON(200, gin.H{"valid": false, "message": "Stream key not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"valid": false})
		return
	}

	c.JSON(200, gin.H{
		"valid":     true,
		"stream_id": stream.ID,
		"user_id":   stream.UserID,
	})
}

func streamStart(c *gin.Context) {
	key := c.Param("key")
	db.Exec(`
		UPDATE streams SET is_live=true, last_started_at=NOW(), viewer_count=0
		WHERE stream_key=$1
	`, key)
	c.JSON(200, gin.H{"status": "live"})
}

func streamStop(c *gin.Context) {
	key := c.Param("key")
	db.Exec(`UPDATE streams SET is_live=false, viewer_count=0 WHERE stream_key=$1`, key)
	c.JSON(200, gin.H{"status": "offline"})
}

func streamHeartbeat(c *gin.Context) {
	key := c.Param("key")
	var req struct {
		ViewerCount int `json:"viewer_count"`
	}
	c.ShouldBindJSON(&req)
	db.Exec(`UPDATE streams SET viewer_count=$1 WHERE stream_key=$2`, req.ViewerCount, key)
	c.JSON(200, gin.H{"status": "ok"})
}

func getLiveStreams(c *gin.Context) {
	var streams []Stream
	db.Select(&streams, `
		SELECT id, user_id, title, is_live, viewer_count
		FROM streams WHERE is_live=true
		ORDER BY viewer_count DESC
	`)
	if streams == nil {
		streams = []Stream{}
	}
	c.JSON(200, streams)
}

func getWatchInfo(c *gin.Context) {
	id := c.Param("id")
	var stream Stream
	if err := db.Get(&stream, `
		SELECT id, user_id, title, is_live, viewer_count
		FROM streams WHERE id=$1
	`, id); err != nil {
		c.JSON(404, gin.H{"error": "Stream not found"})
		return
	}

	hlsURL := "/hls/" + id + "/playlist.m3u8"
	c.JSON(200, gin.H{
		"stream":   stream,
		"hls_url":  hlsURL,
	})
}

func getStreamKey(c *gin.Context) {
	userID := c.GetString("user_id")
	var s Stream
	db.Get(&s, `SELECT stream_key, title, is_live, viewer_count FROM streams WHERE user_id=$1`, userID)
	c.JSON(200, gin.H{"stream_key": s.StreamKey, "title": s.Title, "is_live": s.IsLive})
}

func refreshStreamKey(c *gin.Context) {
	userID := c.GetString("user_id")
	var newKey string
	db.QueryRow(`
		UPDATE streams SET stream_key=gen_random_uuid()::text
		WHERE user_id=$1 RETURNING stream_key
	`, userID).Scan(&newKey)
	c.JSON(200, gin.H{"stream_key": newKey})
}

func getMyStream(c *gin.Context) {
	userID := c.GetString("user_id")
	var s Stream
	db.Get(&s, `SELECT id, user_id, title, is_live, viewer_count FROM streams WHERE user_id=$1`, userID)
	c.JSON(200, s)
}

func aiHighlight(c *gin.Context) {
	var req struct {
		StreamID  string  `json:"stream_id"`
		Timestamp int64   `json:"timestamp"`
		Score     float64 `json:"score"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	db.Exec(`
		INSERT INTO ai_highlights (stream_id, clip_url, confidence_score, ai_label)
		VALUES ($1, $2, $3, 'highlight')
	`, req.StreamID, "pending", req.Score)
	c.JSON(200, gin.H{"status": "recorded"})
}

func aiModeration(c *gin.Context) {
	var req struct {
		StreamID string  `json:"stream_id"`
		Reason   string  `json:"reason"`
		Score    float64 `json:"score"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	db.Exec(`
		INSERT INTO ai_highlights (stream_id, clip_url, confidence_score, ai_label)
		VALUES ($1, 'flagged', $2, $3)
	`, req.StreamID, req.Score, req.Reason)
	c.JSON(200, gin.H{"status": "flagged"})
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || len(header) < 8 {
			c.AbortWithStatusJSON(401, gin.H{"error": "Missing token"})
			return
		}
		tokenStr := header[7:] // strip "Bearer "
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return jwtSecret(), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(401, gin.H{"error": "Invalid token"})
			return
		}
		claims := token.Claims.(jwt.MapClaims)
		c.Set("user_id", claims["user_id"])
		c.Set("username", claims["username"])
		c.Next()
	}
}
