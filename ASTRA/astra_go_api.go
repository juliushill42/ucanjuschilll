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

var db *sqlx.DB
var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

type User struct {
	ID           string `db:"id"`
	Username     string `db:"username"`
	Email        string `db:"email"`
	PasswordHash string `db:"password_hash"`
}

type Stream struct {
	ID        string `db:"id"`
	UserID    string `db:"user_id"`
	StreamKey string `db:"stream_key"`
	IsLive    bool   `db:"is_live"`
	Title     string `db:"title"`
}

func main() {
	var err error
	db, err = sqlx.Connect("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	r := gin.Default()

	r.POST("/register", register)
	r.POST("/login", login)
	r.POST("/validate-stream-key", validateStreamKey)
	r.POST("/streams/:key/start", streamStart)
	r.POST("/streams/:key/stop", streamStop)
	r.GET("/streams/live", getLiveStreams)

	auth := r.Group("/")
	auth.Use(authMiddleware())
	{
		auth.GET("/stream-key", getStreamKey)
		auth.POST("/stream-key/refresh", refreshStreamKey)
	}

	r.POST("/ai/highlight", aiHighlight)
	r.POST("/ai/moderation", aiModeration)

	log.Println("Go API running on :8080")
	r.Run(":8080")
}

func register(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)

	var userID string
	err := db.QueryRow(`
		INSERT INTO users (username, email, password_hash)
		VALUES ($1, $2, $3) RETURNING id
	`, req.Username, req.Email, hash).Scan(&userID)

	if err != nil {
		c.JSON(500, gin.H{"error": "Registration failed"})
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
	err := db.Get(&user, "SELECT * FROM users WHERE email=$1", req.Email)
	if err != nil {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	})

	tokenString, _ := token.SignedString(jwtSecret)
	c.JSON(200, gin.H{"token": tokenString, "user_id": user.ID})
}

func validateStreamKey(c *gin.Context) {
	var req struct {
		StreamKey string `json:"stream_key"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"valid": false, "message": "Invalid request"})
		return
	}

	var stream Stream
	err := db.Get(&stream, `
		SELECT id, user_id, stream_key, is_live 
		FROM streams WHERE stream_key=$1
	`, req.StreamKey)

	if err == sql.ErrNoRows {
		c.JSON(200, gin.H{"valid": false, "message": "Stream key not found"})
		return
	}

	if err != nil {
		c.JSON(500, gin.H{"valid": false, "message": "Database error"})
		return
	}

	c.JSON(200, gin.H{
		"valid":     true,
		"stream_id": stream.ID,
		"user_id":   stream.UserID,
		"message":   "Valid stream key",
	})
}

func streamStart(c *gin.Context) {
	key := c.Param("key")
	db.Exec(`
		UPDATE streams 
		SET is_live=true, last_started_at=NOW() 
		WHERE stream_key=$1
	`, key)
	c.JSON(200, gin.H{"status": "started"})
}

func streamStop(c *gin.Context) {
	key := c.Param("key")
	db.Exec(`UPDATE streams SET is_live=false WHERE stream_key=$1`, key)
	c.JSON(200, gin.H{"status": "stopped"})
}

func getLiveStreams(c *gin.Context) {
	var streams []Stream
	db.Select(&streams, `
		SELECT s.id, s.user_id, s.stream_key, s.is_live, s.title 
		FROM streams s WHERE s.is_live=true
	`)
	c.JSON(200, streams)
}

func getStreamKey(c *gin.Context) {
	userID := c.GetString("user_id")
	var streamKey string
	db.Get(&streamKey, `SELECT stream_key FROM streams WHERE user_id=$1`, userID)
	c.JSON(200, gin.H{"stream_key": streamKey})
}

func refreshStreamKey(c *gin.Context) {
	userID := c.GetString("user_id")
	var newKey string
	db.QueryRow(`
		UPDATE streams 
		SET stream_key=gen_random_uuid()::text 
		WHERE user_id=$1 
		RETURNING stream_key
	`, userID).Scan(&newKey)
	c.JSON(200, gin.H{"stream_key": newKey})
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
		VALUES ($1, $2, $3, $4)
	`, req.StreamID, "pending", req.Score, "highlight")

	c.JSON(200, gin.H{"status": "recorded"})
}

func aiModeration(c *gin.Context) {
	var req struct {
		StreamID string `json:"stream_id"`
		Reason   string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	db.Exec(`
		INSERT INTO ai_highlights (stream_id, clip_url, ai_label)
		VALUES ($1, $2, $3)
	`, req.StreamID, "flagged", req.Reason)

	c.JSON(200, gin.H{"status": "flagged"})
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.AbortWithStatus(401)
			return
		}

		if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
			tokenString = tokenString[7:]
		}

		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatus(401)
			return
		}

		claims := token.Claims.(jwt.MapClaims)
		c.Set("user_id", claims["user_id"])
		c.Next()
	}
}