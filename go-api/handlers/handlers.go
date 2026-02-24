package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type Handler struct {
	DB  *sql.DB
	RDB *redis.Client
}

func New(db *sql.DB, rdb *redis.Client) *Handler {
	return &Handler{DB: db, RDB: rdb}
}

func (h *Handler) currentUserID(c *gin.Context) (uuid.UUID, bool) {
	id, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return uuid.Nil, false
	}
	return id.(uuid.UUID), true
}

func paginate(c *gin.Context) (int, int) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	perPage, err := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if err != nil || perPage < 1 || perPage > 50 {
		perPage = 20
	}
	return page, perPage
}

func offset(page, perPage int) int {
	return (page - 1) * perPage
}
