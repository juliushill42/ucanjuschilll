import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export type UploadResult = {
  url: string
  publicId: string
  duration?: number
  format: string
  bytes: number
}

export async function uploadAudio(
  buffer: Buffer,
  filename: string,
  userId: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video', // Cloudinary uses 'video' for audio too
        folder: `juschill/audio/${userId}`,
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        format: 'mp3',
        audio_codec: 'mp3',
        bit_rate: '320k',
        transformation: [{ audio_codec: 'mp3', bit_rate: '320k' }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'))
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          duration: result.duration,
          format: result.format,
          bytes: result.bytes,
        })
      }
    )
    uploadStream.end(buffer)
  })
}

export async function uploadVideo(
  buffer: Buffer,
  filename: string,
  userId: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        folder: `juschill/video/${userId}`,
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        transformation: [
          { quality: 'auto:best', fetch_format: 'auto' },
          { width: 1080, crop: 'limit' },
        ],
        eager: [
          { width: 400, height: 400, crop: 'fill', gravity: 'auto', format: 'jpg' },
        ],
        eager_async: true,
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'))
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          duration: result.duration,
          format: result.format,
          bytes: result.bytes,
        })
      }
    )
    uploadStream.end(buffer)
  })
}

export async function uploadImage(
  buffer: Buffer,
  userId: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: `juschill/images/${userId}`,
        transformation: [{ quality: 'auto:best', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'))
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        })
      }
    )
    uploadStream.end(buffer)
  })
}

export async function deleteMedia(publicId: string, resourceType: 'image' | 'video' = 'video') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
}

export { cloudinary }
