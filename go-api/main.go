package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/juschill/api/db"
	"github.com/juschill/api/handlers"
	"github.com/juschill/api/middleware"
)

func main() {
	database, err := db.Connect(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer database.Close()

	rdb, err := db.ConnectRedis(os.Getenv("REDIS_URL"))
	if err != nil {
		log.Fatalf("failed to connect to redis: %v", err)
	}

	h := handlers.New(database, rdb)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		if err := database.Ping(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Static file serving
	storagePath := os.Getenv("STORAGE_PATH")
	if storagePath == "" {
		storagePath = "/data/uploads"
	}
	r.Static("/uploads", storagePath)

	api := r.Group("/api/v1")
	{
		// Auth
		api.POST("/auth/register", h.Register)
		api.POST("/auth/login", h.Login)
		api.POST("/auth/refresh", h.RefreshToken)

		// Public
		api.GET("/users/:username", h.GetUser)
		api.GET("/users/:username/posts", h.GetUserPosts)
		api.GET("/posts/:id", h.GetPost)
		api.GET("/feed/trending", h.GetTrending)
		api.GET("/feed/genre/:genre", h.GetByGenre)
		api.GET("/explore/search", h.Search)
		api.GET("/streams/live", h.GetLiveStreams)

		// Authenticated
		auth := api.Group("/")
		auth.Use(middleware.Auth())
		{
			// Me
			auth.GET("/me", h.GetMe)
			auth.PUT("/me", h.UpdateMe)
			auth.PUT("/me/avatar", h.UpdateAvatar)

			// Feed
			auth.GET("/feed", h.GetFeed)

			// Posts
			auth.POST("/posts", h.CreatePost)
			auth.DELETE("/posts/:id", h.DeletePost)

			// Likes
			auth.POST("/posts/:id/like", h.LikePost)
			auth.DELETE("/posts/:id/like", h.UnlikePost)

			// Comments
			auth.GET("/posts/:id/comments", h.GetComments)
			auth.POST("/posts/:id/comments", h.CreateComment)
			auth.DELETE("/comments/:id", h.DeleteComment)

			// Follows
			auth.POST("/follow/:username", h.Follow)
			auth.DELETE("/follow/:username", h.Unfollow)
			auth.GET("/following", h.GetFollowing)
			auth.GET("/followers", h.GetFollowers)

			// Upload
			auth.POST("/upload/audio", h.UploadAudio)
			auth.POST("/upload/video", h.UploadVideo)
			auth.POST("/upload/image", h.UploadImage)

			// AI Processing
			auth.POST("/ai/process", h.TriggerAIProcess)
			auth.GET("/ai/jobs/:id", h.GetAIJob)
			auth.GET("/ai/jobs", h.GetMyAIJobs)

			// Stream key
			auth.GET("/stream/key", h.GetStreamKey)
			auth.POST("/stream/key/rotate", h.RotateStreamKey)

			// Notifications
			auth.GET("/notifications", h.GetNotifications)
			auth.PUT("/notifications/read", h.MarkNotificationsRead)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("JusChill API starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
