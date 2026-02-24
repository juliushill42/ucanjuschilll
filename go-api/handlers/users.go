package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/juschill/api/models"
)

func (h *Handler) GetMe(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	var user models.User
	err := h.DB.QueryRowContext(c, `
		SELECT id, username, email, display_name, bio, avatar_url, genre, location, website,
		       is_verified, is_live, follower_count, following_count, post_count, created_at
		FROM users WHERE id = $1
	`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName, &user.Bio, &user.AvatarURL,
		&user.Genre, &user.Location, &user.Website, &user.IsVerified, &user.IsLive,
		&user.FollowerCount, &user.FollowingCount, &user.PostCount, &user.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *Handler) GetUser(c *gin.Context) {
	username := c.Param("username")

	var user models.User
	err := h.DB.QueryRowContext(c, `
		SELECT id, username, display_name, bio, avatar_url, genre, location, website,
		       is_verified, is_live, follower_count, following_count, post_count, created_at
		FROM users WHERE username = $1 AND is_active = true
	`, username).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Bio, &user.AvatarURL,
		&user.Genre, &user.Location, &user.Website, &user.IsVerified, &user.IsLive,
		&user.FollowerCount, &user.FollowingCount, &user.PostCount, &user.CreatedAt,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	// Check if current user follows this user
	if viewerID, exists := c.Get("user_id"); exists {
		var exists bool
		h.DB.QueryRowContext(c, `SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2)`,
			viewerID, user.ID).Scan(&exists)
		user.IsFollowing = exists
	}

	c.JSON(http.StatusOK, user)
}

func (h *Handler) UpdateMe(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	err := h.DB.QueryRowContext(c, `
		UPDATE users
		SET display_name = COALESCE(NULLIF($1, ''), display_name),
		    bio = COALESCE(NULLIF($2, ''), bio),
		    genre = COALESCE(NULLIF($3, ''), genre),
		    location = COALESCE(NULLIF($4, ''), location),
		    website = COALESCE(NULLIF($5, ''), website),
		    updated_at = NOW()
		WHERE id = $6
		RETURNING id, username, display_name, bio, avatar_url, genre, location, website,
		          is_verified, is_live, follower_count, following_count, post_count, created_at
	`, req.DisplayName, req.Bio, req.Genre, req.Location, req.Website, userID).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Bio, &user.AvatarURL,
		&user.Genre, &user.Location, &user.Website, &user.IsVerified, &user.IsLive,
		&user.FollowerCount, &user.FollowingCount, &user.PostCount, &user.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *Handler) UpdateAvatar(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	var body struct {
		AvatarURL string `json:"avatar_url" binding:"required,url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := h.DB.ExecContext(c, `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`,
		body.AvatarURL, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"avatar_url": body.AvatarURL})
}

func (h *Handler) GetUserPosts(c *gin.Context) {
	username := c.Param("username")
	page, perPage := paginate(c)

	var targetID uuid.UUID
	err := h.DB.QueryRowContext(c, `SELECT id FROM users WHERE username = $1`, username).Scan(&targetID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	var total int
	h.DB.QueryRowContext(c, `SELECT COUNT(*) FROM posts WHERE user_id = $1 AND is_public = true`, targetID).Scan(&total)

	rows, err := h.DB.QueryContext(c, `
		SELECT id, user_id, title, description, post_type, audio_url, video_url, thumbnail_url,
		       hls_url, duration_seconds, genre, tags, bpm, key_signature,
		       ai_processed, ai_mastered, has_captions, caption_url,
		       like_count, comment_count, play_count, processing_status, created_at
		FROM posts
		WHERE user_id = $1 AND is_public = true
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, targetID, perPage, offset(page, perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	posts := make([]*models.Post, 0)
	for rows.Next() {
		p := &models.Post{}
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.Title, &p.Description, &p.PostType, &p.AudioURL, &p.VideoURL,
			&p.ThumbnailURL, &p.HLSURL, &p.DurationSeconds, &p.Genre, &p.Tags, &p.BPM,
			&p.KeySignature, &p.AiProcessed, &p.AiMastered, &p.HasCaptions, &p.CaptionURL,
			&p.LikeCount, &p.CommentCount, &p.PlayCount, &p.ProcessingStatus, &p.CreatedAt,
		); err != nil {
			continue
		}
		posts = append(posts, p)
	}

	c.JSON(http.StatusOK, models.FeedResponse{
		Posts:      posts,
		Pagination: models.Pagination{Page: page, PerPage: perPage, Total: total},
	})
}

func (h *Handler) Follow(c *gin.Context) {
	followerID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	username := c.Param("username")

	var targetID uuid.UUID
	err := h.DB.QueryRowContext(c, `SELECT id FROM users WHERE username = $1`, username).Scan(&targetID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if followerID == targetID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot follow yourself"})
		return
	}

	_, err = h.DB.ExecContext(c, `
		INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, followerID, targetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "follow failed"})
		return
	}

	// Create notification
	h.DB.ExecContext(c, `
		INSERT INTO notifications (user_id, actor_id, notif_type)
		VALUES ($1, $2, 'follow')
	`, targetID, followerID)

	c.JSON(http.StatusOK, gin.H{"following": true})
}

func (h *Handler) Unfollow(c *gin.Context) {
	followerID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	username := c.Param("username")

	var targetID uuid.UUID
	err := h.DB.QueryRowContext(c, `SELECT id FROM users WHERE username = $1`, username).Scan(&targetID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	_, err = h.DB.ExecContext(c, `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`, followerID, targetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "unfollow failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"following": false})
}

func (h *Handler) GetFollowing(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	page, perPage := paginate(c)

	rows, err := h.DB.QueryContext(c, `
		SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.is_live,
		       u.follower_count, u.following_count, u.post_count
		FROM users u
		JOIN follows f ON f.following_id = u.id
		WHERE f.follower_id = $1
		ORDER BY f.created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, perPage, offset(page, perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	users := make([]*models.User, 0)
	for rows.Next() {
		u := &models.User{}
		rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.AvatarURL, &u.IsVerified, &u.IsLive,
			&u.FollowerCount, &u.FollowingCount, &u.PostCount)
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

func (h *Handler) GetFollowers(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	page, perPage := paginate(c)

	rows, err := h.DB.QueryContext(c, `
		SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.is_live,
		       u.follower_count, u.following_count, u.post_count
		FROM users u
		JOIN follows f ON f.follower_id = u.id
		WHERE f.following_id = $1
		ORDER BY f.created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, perPage, offset(page, perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	users := make([]*models.User, 0)
	for rows.Next() {
		u := &models.User{}
		rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.AvatarURL, &u.IsVerified, &u.IsLive,
			&u.FollowerCount, &u.FollowingCount, &u.PostCount)
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

func (h *Handler) GetStreamKey(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	var key string
	h.DB.QueryRowContext(c, `SELECT stream_key FROM users WHERE id = $1`, userID).Scan(&key)
	c.JSON(http.StatusOK, gin.H{"stream_key": key})
}

func (h *Handler) RotateStreamKey(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	var key string
	h.DB.QueryRowContext(c, `
		UPDATE users SET stream_key = encode(gen_random_bytes(32), 'hex'), updated_at = NOW()
		WHERE id = $1 RETURNING stream_key
	`, userID).Scan(&key)
	c.JSON(http.StatusOK, gin.H{"stream_key": key})
}

func (h *Handler) GetNotifications(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	page, perPage := paginate(c)

	rows, err := h.DB.QueryContext(c, `
		SELECT n.id, n.user_id, n.actor_id, n.notif_type, n.post_id, n.is_read, n.created_at,
		       u.username, u.display_name, u.avatar_url
		FROM notifications n
		JOIN users u ON u.id = n.actor_id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, perPage, offset(page, perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	notifs := make([]*models.Notification, 0)
	for rows.Next() {
		n := &models.Notification{Actor: &models.User{}}
		rows.Scan(&n.ID, &n.UserID, &n.ActorID, &n.NotifType, &n.PostID, &n.IsRead, &n.CreatedAt,
			&n.Actor.Username, &n.Actor.DisplayName, &n.Actor.AvatarURL)
		notifs = append(notifs, n)
	}
	c.JSON(http.StatusOK, notifs)
}

func (h *Handler) MarkNotificationsRead(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	h.DB.ExecContext(c, `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, userID)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
