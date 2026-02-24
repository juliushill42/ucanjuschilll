package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/juschill/api/models"
)

const maxUploadSize = 500 * 1024 * 1024 // 500MB

var allowedAudioTypes = map[string]bool{
	"audio/mpeg": true, "audio/mp3": true, "audio/wav": true,
	"audio/x-wav": true, "audio/ogg": true, "audio/flac": true,
	"audio/aac": true, "audio/mp4": true,
}

var allowedVideoTypes = map[string]bool{
	"video/mp4": true, "video/webm": true, "video/ogg": true,
	"video/quicktime": true, "video/x-msvideo": true,
}

var allowedImageTypes = map[string]bool{
	"image/jpeg": true, "image/png": true, "image/webp": true, "image/gif": true,
}

func (h *Handler) UploadAudio(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	h.handleFileUpload(c, userID, "audio", allowedAudioTypes)
}

func (h *Handler) UploadVideo(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	h.handleFileUpload(c, userID, "video", allowedVideoTypes)
}

func (h *Handler) UploadImage(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	h.handleFileUpload(c, userID, "image", allowedImageTypes)
}

func (h *Handler) handleFileUpload(c *gin.Context, userID uuid.UUID, fileType string, allowedTypes map[string]bool) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}
	defer file.Close()

	// Read first 512 bytes to detect content type
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read file"})
		return
	}
	contentType := http.DetectContentType(buf[:n])

	// Also check by extension for audio files (DetectContentType is poor at audio)
	ext := strings.ToLower(filepath.Ext(header.Filename))
	extTypes := map[string]string{
		".mp3": "audio/mpeg", ".wav": "audio/wav", ".flac": "audio/flac",
		".aac": "audio/aac", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
		".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
		".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
	}
	if extType, ok := extTypes[ext]; ok {
		contentType = extType
	}

	if !allowedTypes[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("file type %s not allowed", contentType)})
		return
	}

	storagePath := os.Getenv("STORAGE_PATH")
	if storagePath == "" {
		storagePath = "/data/uploads"
	}

	userDir := filepath.Join(storagePath, fileType, userID.String())
	if err := os.MkdirAll(userDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage error"})
		return
	}

	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	destPath := filepath.Join(userDir, filename)

	dest, err := os.Create(destPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save file"})
		return
	}
	defer dest.Close()

	// Write the already-read bytes first, then the rest
	dest.Write(buf[:n])
	if _, err := io.Copy(dest, file); err != nil {
		os.Remove(destPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "file write error"})
		return
	}

	relPath := filepath.Join("/uploads", fileType, userID.String(), filename)
	c.JSON(http.StatusOK, gin.H{
		"url":          relPath,
		"filename":     filename,
		"content_type": contentType,
		"size":         header.Size,
	})
}

func (h *Handler) TriggerAIProcess(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	var req models.AIProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	postID, err := uuid.Parse(req.PostID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post_id"})
		return
	}

	// Verify post ownership
	var inputURL string
	var postType string
	err = h.DB.QueryRowContext(c, `
		SELECT audio_url, video_url, post_type FROM posts WHERE id = $1 AND user_id = $2
	`, postID, userID).Scan(&inputURL, &inputURL, &postType)

	// Re-select the correct URL based on job type
	if req.JobType == "noise_reduction" || req.JobType == "master" || req.JobType == "captions" || req.JobType == "pitch_correct" {
		h.DB.QueryRowContext(c, `SELECT audio_url FROM posts WHERE id = $1`, postID).Scan(&inputURL)
	} else {
		h.DB.QueryRowContext(c, `SELECT video_url FROM posts WHERE id = $1`, postID).Scan(&inputURL)
	}

	if inputURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "post has no media file"})
		return
	}

	// Create AI job record
	var job models.AIJob
	err = h.DB.QueryRowContext(c, `
		INSERT INTO ai_jobs (post_id, user_id, job_type, input_path, status)
		VALUES ($1, $2, $3, $4, 'queued')
		RETURNING id, post_id, user_id, job_type, status, input_path, output_path, error_message, progress, created_at, updated_at
	`, postID, userID, req.JobType, inputURL).Scan(
		&job.ID, &job.PostID, &job.UserID, &job.JobType, &job.Status,
		&job.InputPath, &job.OutputPath, &job.ErrorMessage, &job.Progress,
		&job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create job"})
		return
	}

	// Update post processing status
	h.DB.ExecContext(c, `UPDATE posts SET processing_status = 'processing' WHERE id = $1`, postID)

	// Dispatch to AI worker
	go h.dispatchToAIWorker(job.ID.String(), postID.String(), req.JobType, inputURL, req.Options)

	c.JSON(http.StatusAccepted, job)
}

func (h *Handler) dispatchToAIWorker(jobID, postID, jobType, inputPath string, options map[string]interface{}) {
	aiWorkerURL := os.Getenv("AI_WORKER_URL")
	if aiWorkerURL == "" {
		aiWorkerURL = "http://juschill-ai-worker:8001"
	}

	payload := map[string]interface{}{
		"job_id":     jobID,
		"post_id":    postID,
		"job_type":   jobType,
		"input_path": inputPath,
		"options":    options,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", aiWorkerURL+"/process", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	client.Do(req) // Fire and forget; worker calls back via webhook
}

func (h *Handler) GetAIJob(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}

	jobID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid job id"})
		return
	}

	var job models.AIJob
	err = h.DB.QueryRowContext(c, `
		SELECT id, post_id, user_id, job_type, status, input_path, output_path, error_message, progress, created_at, updated_at
		FROM ai_jobs WHERE id = $1 AND user_id = $2
	`, jobID, userID).Scan(
		&job.ID, &job.PostID, &job.UserID, &job.JobType, &job.Status,
		&job.InputPath, &job.OutputPath, &job.ErrorMessage, &job.Progress,
		&job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}
	c.JSON(http.StatusOK, job)
}

func (h *Handler) GetMyAIJobs(c *gin.Context) {
	userID, ok := h.currentUserID(c)
	if !ok {
		return
	}
	page, perPage := paginate(c)

	rows, err := h.DB.QueryContext(c, `
		SELECT id, post_id, user_id, job_type, status, input_path, output_path, error_message, progress, created_at, updated_at
		FROM ai_jobs WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, perPage, offset(page, perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	jobs := make([]*models.AIJob, 0)
	for rows.Next() {
		j := &models.AIJob{}
		rows.Scan(&j.ID, &j.PostID, &j.UserID, &j.JobType, &j.Status,
			&j.InputPath, &j.OutputPath, &j.ErrorMessage, &j.Progress, &j.CreatedAt, &j.UpdatedAt)
		jobs = append(jobs, j)
	}
	c.JSON(http.StatusOK, jobs)
}

// AIJobWebhook called by AI worker when job completes
func (h *Handler) AIJobWebhook(c *gin.Context) {
	var payload struct {
		JobID      string `json:"job_id" binding:"required"`
		PostID     string `json:"post_id" binding:"required"`
		Status     string `json:"status" binding:"required"`
		OutputPath string `json:"output_path"`
		JobType    string `json:"job_type"`
		Error      string `json:"error"`
		Progress   int    `json:"progress"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.DB.ExecContext(c, `
		UPDATE ai_jobs SET status = $1, output_path = $2, error_message = $3, progress = $4, updated_at = NOW()
		WHERE id = $5
	`, payload.Status, payload.OutputPath, payload.Error, payload.Progress, payload.JobID)

	if payload.Status == "done" && payload.OutputPath != "" {
		switch payload.JobType {
		case "noise_reduction", "master", "pitch_correct":
			h.DB.ExecContext(c, `UPDATE posts SET audio_url = $1, ai_processed = true, processing_status = 'ready' WHERE id = $2`,
				payload.OutputPath, payload.PostID)
		case "captions":
			h.DB.ExecContext(c, `UPDATE posts SET caption_url = $1, has_captions = true, processing_status = 'ready' WHERE id = $2`,
				payload.OutputPath, payload.PostID)
		case "stabilize", "background_remove":
			h.DB.ExecContext(c, `UPDATE posts SET video_url = $1, ai_processed = true, processing_status = 'ready' WHERE id = $2`,
				payload.OutputPath, payload.PostID)
		case "thumbnail":
			h.DB.ExecContext(c, `UPDATE posts SET thumbnail_url = $1, processing_status = 'ready' WHERE id = $2`,
				payload.OutputPath, payload.PostID)
		}
	} else if payload.Status == "failed" {
		h.DB.ExecContext(c, `UPDATE posts SET processing_status = 'failed' WHERE id = $1`, payload.PostID)
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Needed to prevent unused import
var _ = multipart.FileHeader{}
