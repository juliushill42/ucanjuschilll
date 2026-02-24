package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/juschill/api/models"
)

func (h *Handler) GetFeed(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	page, perPage := paginate(c)

	var total int
	h.DB.QueryRowContext(c, `
		SELECT COUNT(*) FROM posts p
		JOIN follows f ON f.following_id = p.user_id
		WHERE f.follower_id = $1 AND p.is_public = true AND p.processing_status = 'ready'
	`, userID).Scan(&total)

	rows, err := h.DB.QueryContext(c, `
		SELECT p.id, p.user_id, p.title, p.description, p.post_type, p.audio_url, p.video_url,
		       p.thumbnail_url, p.hls_url, p.duration_seconds, p.genre, p.tags, p.bpm, p.key_signature,
		       p.ai_processed, p.ai_mastered, p.has_captions, p.caption_url,
		       p.like_count, p.comment_count, p.play_count, p.processing_status, p.created_at,
		       u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.is_live,
		       EXISTS(SELECT 1 FROM likes l WHERE l.user_id = $1 AND l.post_id = p.id) as is_liked
		FROM posts p
		JOIN follows f ON f.following_id = p.user_id
		JOIN users u ON u.id = p.user_id
		WHERE f.follower_id = $1 AND p.is_public = true AND p.processing_status = 'ready'
		ORDER BY p.created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, perPage, offset(page, perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	posts := scanPostsWithUser(rows, true)
	c.JSON(http.StatusOK, models.FeedResponse{
		Posts:      posts,
		Pagination: models.Pagination{Page: page, PerPage: perPage, Total: total},
	})
}

func (h *Handler) GetTrending(c *gin.Context) {
	page, perPage := paginate(c)

	rows, err := h.DB.QueryContext(c, `
		SELECT p.id, p.user_id, p.title, p.description, p.post_type, p.audio_url, p.video_url,
		       p.thumbnail_url, p.hls_url, p.duration_seconds, p.genre, p.tags, p.bpm, p.key_signature,
		       p.ai_processed, p.ai_mastered, p.has_captions, p.caption_url,
		       p.like_count, p.comment_count, p.play_count, p.processing_status, p.created_at,
		       u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.is_live,
		       false as is_liked
		FROM posts p
		JOIN users u ON u.id = p.user_id
		WHERE p.is_public = true AND p.processing_status = 'ready'
		  AND p.created_at > NOW() - INTERVAL '7 days'
		ORDER BY (p.like_count * 3 + p.comment_count * 2 + p.play_count) DESC
		LIMIT $1 OFFSET $2
	`, perPage, offset(page, perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	posts := scanPostsWithUser(rows, true)
	c.JSON(http.StatusOK, posts)
}

func (h *Handler) GetByGenre(c *gin.Context) {
	genre := c.Param("genre")
	page, perPage := paginate(c)

	rows, err := h.DB.QueryContext(c, `
		SELECT p.id, p.user_id, p.title, p.description, p.post_type, p.audio_url, p.video_url,
		       p.thumbnail_url, p.hls_url, p.duration_seconds, p.genre, p.tags, p.bpm, p.key_signature,
		       p.ai_processed, p.ai_mastered, p.has_captions, p.caption_url,
		       p.like_count, p.comment_count, p.play_count, p.processing_status, p.created_at,
		       u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.is_live,
		       false as is_liked
		FROM posts p
		JOIN users u ON u.id = p.user_id
		WHERE p.is_public = true AND p.processing_status = 'ready'
		  AND LOWER(p.genre) = LOWER($1)
		ORDER BY p.created_at DESC
		LIMIT $2 OFFSET $3
	`, genre, perPage, offset(page, perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	posts := scanPostsWithUser(rows, true)
	c.JSON(http.StatusOK, posts)
}

func (h *Handler) Search(c *gin.Context) {
	query := c.Query("q")
	searchType := c.DefaultQuery("type", "all")
	page, perPage := paginate(c)

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q parameter required"})
		return
	}

	result := gin.H{}

	if searchType == "all" || searchType == "users" {
		rows, _ := h.DB.QueryContext(c, `
			SELECT id, username, display_name, avatar_url, is_verified, is_live,
			       follower_count, following_count, post_count
			FROM users
			WHERE is_active = true AND (
				username ILIKE $1 OR display_name ILIKE $1
			)
			ORDER BY follower_count DESC
			LIMIT $2
		`, "%"+query+"%", perPage)
		if rows != nil {
			defer rows.Close()
			users := make([]*models.User, 0)
			for rows.Next() {
				u := &models.User{}
				rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.AvatarURL, &u.IsVerified, &u.IsLive,
					&u.FollowerCount, &u.FollowingCount, &u.PostCount)
				users = append(users, u)
			}
			result["users"] = users
		}
	}

	if searchType == "all" || searchType == "posts" {
		rows, _ := h.DB.QueryContext(c, `
			SELECT p.id, p.user_id, p.title, p.description, p.post_type, p.audio_url, p.video_url,
			       p.thumbnail_url, p.hls_url, p.duration_seconds, p.genre, p.tags, p.bpm, p.key_signature,
			       p.ai_processed, p.ai_mastered, p.has_captions, p.caption_url,
			       p.like_count, p.comment_count, p.play_count, p.processing_status, p.created_at,
			       u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.is_live,
			       false as is_liked
			FROM posts p
			JOIN users u ON u.id = p.user_id
			WHERE p.is_public = true AND p.processing_status = 'ready'
			  AND (p.title ILIKE $1 OR p.description ILIKE $1 OR p.genre ILIKE $1)
			ORDER BY p.like_count DESC
			LIMIT $2 OFFSET $3
		`, "%"+query+"%", perPage, offset(page, perPage))
		if rows != nil {
			defer rows.Close()
			posts := scanPostsWithUser(rows, true)
			result["posts"] = posts
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetLiveStreams(c *gin.Context) {
	rows, err := h.DB.QueryContext(c, `
		SELECT ls.id, ls.user_id, ls.title, ls.started_at, ls.peak_viewers, ls.hls_url,
		       u.username, u.display_name, u.avatar_url, u.is_verified
		FROM live_streams ls
		JOIN users u ON u.id = ls.user_id
		WHERE ls.is_active = true
		ORDER BY ls.started_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	streams := make([]*models.LiveStream, 0)
	for rows.Next() {
		s := &models.LiveStream{User: &models.User{}}
		rows.Scan(&s.ID, &s.UserID, &s.Title, &s.StartedAt, &s.PeakViewers, &s.HLSURL,
			&s.User.Username, &s.User.DisplayName, &s.User.AvatarURL, &s.User.IsVerified)
		streams = append(streams, s)
	}
	c.JSON(http.StatusOK, streams)
}

func scanPostsWithUser(rows interface{ Scan(...interface{}) error; Next() bool }, hasIsLiked bool) []*models.Post {
	posts := make([]*models.Post, 0)
	for rows.Next() {
		p := &models.Post{User: &models.User{}}
		args := []interface{}{
			&p.ID, &p.UserID, &p.Title, &p.Description, &p.PostType,
			&p.AudioURL, &p.VideoURL, &p.ThumbnailURL, &p.HLSURL,
			&p.DurationSeconds, &p.Genre, &p.Tags, &p.BPM, &p.KeySignature,
			&p.AiProcessed, &p.AiMastered, &p.HasCaptions, &p.CaptionURL,
			&p.LikeCount, &p.CommentCount, &p.PlayCount, &p.ProcessingStatus, &p.CreatedAt,
			&p.User.ID, &p.User.Username, &p.User.DisplayName, &p.User.AvatarURL,
			&p.User.IsVerified, &p.User.IsLive,
		}
		if hasIsLiked {
			args = append(args, &p.IsLiked)
		}
		if err := rows.Scan(args...); err != nil {
			continue
		}
		posts = append(posts, p)
	}
	return posts
}

// IncrementPlayCount called when a post is played
func (h *Handler) IncrementPlayCount(postID uuid.UUID) {
	h.DB.Exec(`UPDATE posts SET play_count = play_count + 1 WHERE id = $1`, postID)
}
