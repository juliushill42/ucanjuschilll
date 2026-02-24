package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/juschill/api/middleware"
	"github.com/juschill/api/models"
	"golang.org/x/crypto/bcrypt"
)

func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	var user models.User
	err = h.DB.QueryRowContext(c, `
		INSERT INTO users (username, email, password_hash, display_name)
		VALUES ($1, $2, $3, $4)
		RETURNING id, username, email, display_name, bio, avatar_url, genre, location, website,
		          is_verified, is_live, follower_count, following_count, post_count, created_at
	`, req.Username, req.Email, string(hash), req.DisplayName).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName, &user.Bio, &user.AvatarURL,
		&user.Genre, &user.Location, &user.Website, &user.IsVerified, &user.IsLive,
		&user.FollowerCount, &user.FollowingCount, &user.PostCount, &user.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username or email already taken"})
		return
	}

	token, refresh, err := generateTokens(user.ID.String(), user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	user.Email = ""
	c.JSON(http.StatusCreated, models.AuthResponse{Token: token, RefreshToken: refresh, User: &user})
}

func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	var passwordHash string
	err := h.DB.QueryRowContext(c, `
		SELECT id, username, email, password_hash, display_name, bio, avatar_url, genre,
		       location, website, is_verified, is_live, follower_count, following_count, post_count, created_at
		FROM users WHERE email = $1 AND is_active = true
	`, req.Email).Scan(
		&user.ID, &user.Username, &user.Email, &passwordHash, &user.DisplayName, &user.Bio,
		&user.AvatarURL, &user.Genre, &user.Location, &user.Website, &user.IsVerified, &user.IsLive,
		&user.FollowerCount, &user.FollowingCount, &user.PostCount, &user.CreatedAt,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	token, refresh, err := generateTokens(user.ID.String(), user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	user.Email = ""
	c.JSON(http.StatusOK, models.AuthResponse{Token: token, RefreshToken: refresh, User: &user})
}

func (h *Handler) RefreshToken(c *gin.Context) {
	var body struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(body.RefreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET") + "_refresh"), nil
	})
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	newToken, newRefresh, err := generateTokens(claims.UserID, claims.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": newToken, "refresh_token": newRefresh})
}

func generateTokens(userID, username string) (string, string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))

	claims := &middleware.Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(secret)
	if err != nil {
		return "", "", err
	}

	refreshClaims := &middleware.Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.New().String(),
		},
	}

	refresh := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, err := refresh.SignedString([]byte(os.Getenv("JWT_SECRET") + "_refresh"))
	if err != nil {
		return "", "", err
	}

	return tokenStr, refreshStr, nil
}
