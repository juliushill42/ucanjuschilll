export interface User {
  id: string;
  username: string;
  email?: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  genre: string;
  location: string;
  website: string;
  is_verified: boolean;
  is_live: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
  is_following?: boolean;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  user?: User;
  title: string;
  description: string;
  post_type: 'audio' | 'video' | 'av';
  audio_url: string;
  video_url: string;
  thumbnail_url: string;
  hls_url: string;
  duration_seconds: number;
  genre: string;
  tags: string[];
  bpm: number;
  key_signature: string;
  ai_processed: boolean;
  ai_mastered: boolean;
  has_captions: boolean;
  caption_url: string;
  like_count: number;
  comment_count: number;
  play_count: number;
  is_liked?: boolean;
  processing_status: 'pending' | 'processing' | 'ready' | 'failed';
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user?: User;
  parent_id?: string;
  body: string;
  like_count: number;
  created_at: string;
}

export interface AIJob {
  id: string;
  post_id: string;
  user_id: string;
  job_type: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  input_path: string;
  output_path: string;
  error_message: string;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface LiveStream {
  id: string;
  user_id: string;
  user?: User;
  title: string;
  started_at: string;
  peak_viewers: number;
  hls_url: string;
  is_active: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  actor?: User;
  notif_type: 'like' | 'comment' | 'follow' | 'mention' | 'live';
  post_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface FeedResponse {
  posts: Post[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}

export interface AuthResponse {
  token: string;
  refresh_token: string;
  user: User;
}

export type AIJobType =
  | 'noise_reduction'
  | 'master'
  | 'pitch_correct'
  | 'captions'
  | 'beat_detect'
  | 'stabilize'
  | 'background_remove'
  | 'thumbnail'
  | 'full_produce';

export interface UploadResponse {
  url: string;
  filename: string;
  content_type: string;
  size: number;
}
