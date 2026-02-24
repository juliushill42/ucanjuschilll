package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type User struct {
	ID             uuid.UUID `json:"id" db:"id"`
	Username       string    `json:"username" db:"username"`
	Email          string    `json:"email,omitempty" db:"email"`
	DisplayName    string    `json:"display_name" db:"display_name"`
	Bio            string    `json:"bio" db:"bio"`
	AvatarURL      string    `json:"avatar_url" db:"avatar_url"`
	Genre          string    `json:"genre" db:"genre"`
	Location       string    `json:"location" db:"location"`
	Website        string    `json:"website" db:"website"`
	IsVerified     bool      `json:"is_verified" db:"is_verified"`
	IsLive         bool      `json:"is_live" db:"is_live"`
	FollowerCount  int       `json:"follower_count" db:"follower_count"`
	FollowingCount int       `json:"following_count" db:"following_count"`
	PostCount      int       `json:"post_count" db:"post_count"`
	IsFollowing    bool      `json:"is_following,omitempty"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type Post struct {
	ID               uuid.UUID      `json:"id" db:"id"`
	UserID           uuid.UUID      `json:"user_id" db:"user_id"`
	User             *User          `json:"user,omitempty"`
	Title            string         `json:"title" db:"title"`
	Description      string         `json:"description" db:"description"`
	PostType         string         `json:"post_type" db:"post_type"`
	AudioURL         string         `json:"audio_url" db:"audio_url"`
	VideoURL         string         `json:"video_url" db:"video_url"`
	ThumbnailURL     string         `json:"thumbnail_url" db:"thumbnail_url"`
	HLSURL           string         `json:"hls_url" db:"hls_url"`
	DurationSeconds  int            `json:"duration_seconds" db:"duration_seconds"`
	Genre            string         `json:"genre" db:"genre"`
	Tags             pq.StringArray `json:"tags" db:"tags"`
	BPM              int            `json:"bpm" db:"bpm"`
	KeySignature     string         `json:"key_signature" db:"key_signature"`
	AiProcessed      bool           `json:"ai_processed" db:"ai_processed"`
	AiMastered       bool           `json:"ai_mastered" db:"ai_mastered"`
	HasCaptions      bool           `json:"has_captions" db:"has_captions"`
	CaptionURL       string         `json:"caption_url" db:"caption_url"`
	LikeCount        int            `json:"like_count" db:"like_count"`
	CommentCount     int            `json:"comment_count" db:"comment_count"`
	PlayCount        int            `json:"play_count" db:"play_count"`
	IsLiked          bool           `json:"is_liked,omitempty"`
	ProcessingStatus string         `json:"processing_status" db:"processing_status"`
	CreatedAt        time.Time      `json:"created_at" db:"created_at"`
}

type Comment struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	PostID    uuid.UUID  `json:"post_id" db:"post_id"`
	UserID    uuid.UUID  `json:"user_id" db:"user_id"`
	User      *User      `json:"user,omitempty"`
	ParentID  *uuid.UUID `json:"parent_id" db:"parent_id"`
	Body      string     `json:"body" db:"body"`
	LikeCount int        `json:"like_count" db:"like_count"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

type Notification struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	UserID    uuid.UUID  `json:"user_id" db:"user_id"`
	ActorID   uuid.UUID  `json:"actor_id" db:"actor_id"`
	Actor     *User      `json:"actor,omitempty"`
	NotifType string     `json:"notif_type" db:"notif_type"`
	PostID    *uuid.UUID `json:"post_id" db:"post_id"`
	IsRead    bool       `json:"is_read" db:"is_read"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

type AIJob struct {
	ID           uuid.UUID         `json:"id" db:"id"`
	PostID       uuid.UUID         `json:"post_id" db:"post_id"`
	UserID       uuid.UUID         `json:"user_id" db:"user_id"`
	JobType      string            `json:"job_type" db:"job_type"`
	Status       string            `json:"status" db:"status"`
	InputPath    string            `json:"input_path" db:"input_path"`
	OutputPath   string            `json:"output_path" db:"output_path"`
	ErrorMessage string            `json:"error_message" db:"error_message"`
	Progress     int               `json:"progress" db:"progress"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
}

type LiveStream struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	UserID      uuid.UUID  `json:"user_id" db:"user_id"`
	User        *User      `json:"user,omitempty"`
	Title       string     `json:"title" db:"title"`
	StartedAt   time.Time  `json:"started_at" db:"started_at"`
	EndedAt     *time.Time `json:"ended_at" db:"ended_at"`
	PeakViewers int        `json:"peak_viewers" db:"peak_viewers"`
	HLSURL      string     `json:"hls_url" db:"hls_url"`
	IsActive    bool       `json:"is_active" db:"is_active"`
}

type Pagination struct {
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
	Total   int `json:"total"`
}

type FeedResponse struct {
	Posts      []*Post    `json:"posts"`
	Pagination Pagination `json:"pagination"`
}

type RegisterRequest struct {
	Username    string `json:"username" binding:"required,min=3,max=30,alphanum"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	DisplayName string `json:"display_name" binding:"required,min=1,max=100"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type UpdateUserRequest struct {
	DisplayName string `json:"display_name"`
	Bio         string `json:"bio"`
	Genre       string `json:"genre"`
	Location    string `json:"location"`
	Website     string `json:"website"`
}

type CreatePostRequest struct {
	Title           string   `json:"title" binding:"required,min=1,max=200"`
	Description     string   `json:"description"`
	PostType        string   `json:"post_type" binding:"required,oneof=audio video av"`
	AudioURL        string   `json:"audio_url"`
	VideoURL        string   `json:"video_url"`
	ThumbnailURL    string   `json:"thumbnail_url"`
	DurationSeconds int      `json:"duration_seconds"`
	Genre           string   `json:"genre"`
	Tags            []string `json:"tags"`
	BPM             int      `json:"bpm"`
	KeySignature    string   `json:"key_signature"`
}

type CreateCommentRequest struct {
	Body     string     `json:"body" binding:"required,min=1,max=500"`
	ParentID *string    `json:"parent_id"`
}

type AIProcessRequest struct {
	PostID  string   `json:"post_id" binding:"required"`
	JobType string   `json:"job_type" binding:"required"`
	Options map[string]interface{} `json:"options"`
}

type AuthResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	User         *User  `json:"user"`
}
