import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  AuthResponse, User, Post, Comment, FeedResponse,
  AIJob, LiveStream, Notification, UploadResponse, AIJobType
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${BASE_URL}/v1`,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('jc_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    this.client.interceptors.response.use(
      (res) => res,
      async (error: AxiosError) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          const refresh = localStorage.getItem('jc_refresh');
          if (refresh) {
            try {
              const res = await axios.post(`${BASE_URL}/v1/auth/refresh`, { refresh_token: refresh });
              localStorage.setItem('jc_token', res.data.token);
              localStorage.setItem('jc_refresh', res.data.refresh_token);
              error.config!.headers!.Authorization = `Bearer ${res.data.token}`;
              return this.client.request(error.config!);
            } catch {
              localStorage.removeItem('jc_token');
              localStorage.removeItem('jc_refresh');
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async register(data: { username: string; email: string; password: string; display_name: string }): Promise<AuthResponse> {
    const res = await this.client.post<AuthResponse>('/auth/register', data);
    this.storeTokens(res.data);
    return res.data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.client.post<AuthResponse>('/auth/login', { email, password });
    this.storeTokens(res.data);
    return res.data;
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jc_token');
      localStorage.removeItem('jc_refresh');
    }
  }

  private storeTokens(auth: AuthResponse) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jc_token', auth.token);
      localStorage.setItem('jc_refresh', auth.refresh_token);
    }
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  async getMe(): Promise<User> {
    const res = await this.client.get<User>('/me');
    return res.data;
  }

  async updateMe(data: Partial<User>): Promise<User> {
    const res = await this.client.put<User>('/me', data);
    return res.data;
  }

  async getUser(username: string): Promise<User> {
    const res = await this.client.get<User>(`/users/${username}`);
    return res.data;
  }

  async getUserPosts(username: string, page = 1): Promise<FeedResponse> {
    const res = await this.client.get<FeedResponse>(`/users/${username}/posts`, { params: { page } });
    return res.data;
  }

  async follow(username: string): Promise<void> {
    await this.client.post(`/follow/${username}`);
  }

  async unfollow(username: string): Promise<void> {
    await this.client.delete(`/follow/${username}`);
  }

  async getStreamKey(): Promise<string> {
    const res = await this.client.get<{ stream_key: string }>('/stream/key');
    return res.data.stream_key;
  }

  async rotateStreamKey(): Promise<string> {
    const res = await this.client.post<{ stream_key: string }>('/stream/key/rotate');
    return res.data.stream_key;
  }

  // ── Feed ─────────────────────────────────────────────────────────────────
  async getFeed(page = 1): Promise<FeedResponse> {
    const res = await this.client.get<FeedResponse>('/feed', { params: { page } });
    return res.data;
  }

  async getTrending(page = 1): Promise<Post[]> {
    const res = await this.client.get<Post[]>('/feed/trending', { params: { page } });
    return res.data;
  }

  async getByGenre(genre: string, page = 1): Promise<Post[]> {
    const res = await this.client.get<Post[]>(`/feed/genre/${genre}`, { params: { page } });
    return res.data;
  }

  async search(query: string, type = 'all'): Promise<{ posts?: Post[]; users?: User[] }> {
    const res = await this.client.get('/explore/search', { params: { q: query, type } });
    return res.data;
  }

  // ── Posts ─────────────────────────────────────────────────────────────────
  async getPost(id: string): Promise<Post> {
    const res = await this.client.get<Post>(`/posts/${id}`);
    return res.data;
  }

  async createPost(data: {
    title: string;
    description?: string;
    post_type: 'audio' | 'video' | 'av';
    audio_url?: string;
    video_url?: string;
    thumbnail_url?: string;
    duration_seconds?: number;
    genre?: string;
    tags?: string[];
    bpm?: number;
  }): Promise<Post> {
    const res = await this.client.post<Post>('/posts', data);
    return res.data;
  }

  async deletePost(id: string): Promise<void> {
    await this.client.delete(`/posts/${id}`);
  }

  async likePost(id: string): Promise<void> {
    await this.client.post(`/posts/${id}/like`);
  }

  async unlikePost(id: string): Promise<void> {
    await this.client.delete(`/posts/${id}/like`);
  }

  // ── Comments ──────────────────────────────────────────────────────────────
  async getComments(postId: string, page = 1): Promise<Comment[]> {
    const res = await this.client.get<Comment[]>(`/posts/${postId}/comments`, { params: { page } });
    return res.data;
  }

  async createComment(postId: string, body: string, parentId?: string): Promise<Comment> {
    const res = await this.client.post<Comment>(`/posts/${postId}/comments`, { body, parent_id: parentId });
    return res.data;
  }

  async deleteComment(id: string): Promise<void> {
    await this.client.delete(`/comments/${id}`);
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  async uploadAudio(file: File, onProgress?: (pct: number) => void): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    const res = await this.client.post<UploadResponse>('/upload/audio', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
    });
    return res.data;
  }

  async uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    const res = await this.client.post<UploadResponse>('/upload/video', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
    });
    return res.data;
  }

  async uploadImage(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    const res = await this.client.post<UploadResponse>('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  async triggerAIProcess(postId: string, jobType: AIJobType, options?: Record<string, unknown>): Promise<AIJob> {
    const res = await this.client.post<AIJob>('/ai/process', {
      post_id: postId,
      job_type: jobType,
      options: options || {},
    });
    return res.data;
  }

  async getAIJob(jobId: string): Promise<AIJob> {
    const res = await this.client.get<AIJob>(`/ai/jobs/${jobId}`);
    return res.data;
  }

  async getMyAIJobs(): Promise<AIJob[]> {
    const res = await this.client.get<AIJob[]>('/ai/jobs');
    return res.data;
  }

  // ── Live Streams ──────────────────────────────────────────────────────────
  async getLiveStreams(): Promise<LiveStream[]> {
    const res = await this.client.get<LiveStream[]>('/streams/live');
    return res.data;
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  async getNotifications(): Promise<Notification[]> {
    const res = await this.client.get<Notification[]>('/notifications');
    return res.data;
  }

  async markNotificationsRead(): Promise<void> {
    await this.client.put('/notifications/read');
  }
}

export const api = new APIClient();
