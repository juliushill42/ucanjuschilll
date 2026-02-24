package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/juschill/api/models"
	"github.com/lib/pq"
)

func (h *Handler) CreatePost(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	var req models.CreatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.PostType == "audio" && req.AudioURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audio_url required for audio posts"})
		return
	}
	if req.PostType == "video" && req.VideoURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "video_url required for video posts"})
		return
	}
	if req.PostType == "av" && (req.AudioURL == "" && req.VideoURL == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audio_url or video_url required for av posts"})
		return
	}

	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}

	var post models.Post
	err := h.DB.QueryRowContext(c, `
		INSERT INTO posts (user_id, title, description, post_type, audio_url, video_url,
		                   thumbnail_url, duration_seconds, genre, tags, bpm, key_signature,
		                   processing_status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
		RETURNING id, user_id, title, description, post_type, audio_url, video_url,
		          thumbnail_url, hls_url, duration_seconds, genre, tags, bpm, key_signature,
		          ai_processed, ai_mastered, has_captions, caption_url,
		          like_count, comment_count, play_count, processing_status, created_at
	`, userID, req.Title, req.Description, req.PostType, req.AudioURL, req.VideoURL,
		req.ThumbnailURL, req.DurationSeconds, req.Genre, pq.Array(tags), req.BPM, req.KeySignature,
	).Scan(
		&post.ID, &post.UserID, &post.Title, &post.Description, &post.PostType,
		&post.AudioURL, &post.VideoURL, &post.ThumbnailURL, &post.HLSURL,
		&post.DurationSeconds, &post.Genre, &post.Tags, &post.BPM, &post.KeySignature,
		&post.AiProcessed, &post.AiMastered, &post.HasCaptions, &post.CaptionURL,
		&post.LikeCount, &post.CommentCount, &post.PlayCount, &post.ProcessingStatus, &post.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create post"})
		return
	}

	c.JSON(http.StatusCreated, post)
}

func (h *Handler) GetPost(c *gin.Context) {
	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post id"})
		return
	}

	var post models.Post
	var user models.User
	err = h.DB.QueryRowContext(c, `
		SELECT p.id, p.user_id, p.title, p.description, p.post_type, p.audio_url, p.video_url,
		       p.thumbnail_url, p.hls_url, p.duration_seconds, p.genre, p.tags, p.bpm, p.key_signature,
		       p.ai_processed, p.ai_mastered, p.has_captions, p.caption_url,
		       p.like_count, p.comment_count, p.play_count, p.processing_status, p.created_at,
		       u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.is_live
		FROM posts p
		JOIN users u ON u.id = p.user_id
		WHERE p.id = $1 AND p.is_public = true
	`, postID).Scan(
		&post.ID, &post.UserID, &post.Title, &post.Description, &post.PostType,
		&post.AudioURL, &post.VideoURL, &post.ThumbnailURL, &post.HLSURL,
		&post.DurationSeconds, &post.Genre, &post.Tags, &post.BPM, &post.KeySignature,
		&post.AiProcessed, &post.AiMastered, &post.HasCaptions, &post.CaptionURL,
		&post.LikeCount, &post.CommentCount, &post.PlayCount, &post.ProcessingStatus, &post.CreatedAt,
		&user.ID, &user.Username, &user.DisplayName, &user.AvatarURL, &user.IsVerified, &user.IsLive,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	post.User = &user

	// Increment play count async
	go h.DB.Exec(`UPDATE posts SET play_count = play_count + 1 WHERE id = $1`, postID)

	// Check if liked
	if viewerID, exists := c.Get("user_id"); exists {
		var liked bool
		h.DB.QueryRowContext(c, `SELECT EXISTS(SELECT 1 FROM likes WHERE user_id=$1 AND post_id=$2)`,
			viewerID, postID).Scan(&liked)
		post.IsLiked = liked
	}

	c.JSON(http.StatusOK, post)
}

func (h *Handler) DeletePost(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post id"})
		return
	}

	result, err := h.DB.ExecContext(c, `DELETE FROM posts WHERE id = $1 AND user_id = $2`, postID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found or not yours"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func (h *Handler) LikePost(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post id"})
		return
	}

	_, err = h.DB.ExecContext(c, `INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, postID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "like failed"})
		return
	}

	// Notify post owner
	var ownerID uuid.UUID
	if h.DB.QueryRowContext(c, `SELECT user_id FROM posts WHERE id = $1`, postID).Scan(&ownerID) == nil {
		if ownerID != userID {
			h.DB.ExecContext(c, `
				INSERT INTO notifications (user_id, actor_id, notif_type, post_id)
				VALUES ($1, $2, 'like', $3)
			`, ownerID, userID, postID)
		}
	}

	c.JSON(http.StatusOK, gin.H{"liked": true})
}

func (h *Handler) UnlikePost(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post id"})
		return
	}

	h.DB.ExecContext(c, `DELETE FROM likes WHERE user_id = $1 AND post_id = $2`, userID, postID)
	c.JSON(http.StatusOK, gin.H{"liked": false})
}

func (h *Handler) GetComments(c *gin.Context) {
	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post id"})
		return
	}
	page, perPage := paginate(c)

	rows, err := h.DB.QueryContext(c, `
		SELECT c.id, c.post_id, c.user_id, c.parent_id, c.body, c.like_count, c.created_at,
		       u.username, u.display_name, u.avatar_url
		FROM comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.post_id = $1 AND c.parent_id IS NULL
		ORDER BY c.created_at DESC
		LIMIT $2 OFFSET $3
	`, postID, perPage, offset(page, perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	comments := make([]*models.Comment, 0)
	for rows.Next() {
		cm := &models.Comment{User: &models.User{}}
		rows.Scan(&cm.ID, &cm.PostID, &cm.UserID, &cm.ParentID, &cm.Body, &cm.LikeCount, &cm.CreatedAt,
			&cm.User.Username, &cm.User.DisplayName, &cm.User.AvatarURL)
		comments = append(comments, cm)
	}
	c.JSON(http.StatusOK, comments)
}

func (h *Handler) CreateComment(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post id"})
		return
	}

	var req models.CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var parentID *uuid.UUID
	if req.ParentID != nil {
		pid, err := uuid.Parse(*req.ParentID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid parent_id"})
			return
		}
		parentID = &pid
	}

	var cm models.Comment
	err = h.DB.QueryRowContext(c, `
		INSERT INTO comments (post_id, user_id, parent_id, body)
		VALUES ($1, $2, $3, $4)
		RETURNING id, post_id, user_id, parent_id, body, like_count, created_at
	`, postID, userID, parentID, req.Body).Scan(
		&cm.ID, &cm.PostID, &cm.UserID, &cm.ParentID, &cm.Body, &cm.LikeCount, &cm.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create comment"})
		return
	}

	// Notify post owner
	var ownerID uuid.UUID
	if h.DB.QueryRowContext(c, `SELECT user_id FROM posts WHERE id = $1`, postID).Scan(&ownerID) == nil {
		if ownerID != userID {
			h.DB.ExecContext(c, `
				INSERT INTO notifications (user_id, actor_id, notif_type, post_id)
				VALUES ($1, $2, 'comment', $3)
			`, ownerID, userID, postID)
		}
	}

	c.JSON(http.StatusCreated, cm)
}

func (h *Handler) DeleteComment(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	commentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid comment id"})
		return
	}

	result, err := h.DB.ExecContext(c, `DELETE FROM comments WHERE id = $1 AND user_id = $2`, commentID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "comment not found or not yours"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
