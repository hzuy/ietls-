const cloudinary = require('cloudinary').v2
const path = require('path')
const fs = require('fs')
const { uploadsDir, moveToSubdir } = require('../lib/adminUploads')
const { resizeUploadedCover } = require('../lib/imageResize')

/**
 * Checks whether Cloudinary credentials are configured in the environment.
 */
function isCloudConfigured() {
  if (process.env.CLOUDINARY_URL) return true
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    return true
  }
  return false
}

/**
 * Initializes Cloudinary configuration if credentials are present.
 */
function initCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL })
  } else if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    })
  }
}

/**
 * Uploads a local file to Cloudinary.
 * Deletes the local file on successful upload.
 */
async function uploadToCloudinary(localPath, { folder = 'media', resourceType = 'auto', publicId } = {}) {
  initCloudinary()
  const options = {
    folder: `ielts-app/${folder}`,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  }
  if (publicId) options.public_id = publicId

  const result = await cloudinary.uploader.upload(localPath, options)

  // Clean up local temp file after upload
  try {
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath)
    }
  } catch {
    // Non-fatal cleanup error
  }

  return {
    url: result.secure_url,
    filename: result.public_id || path.basename(localPath),
    publicId: result.public_id,
    format: result.format,
    bytes: result.bytes,
  }
}

/**
 * Upload an image file (e.g. question diagrams, map, rich text images).
 * If Cloudinary is configured, uploads to Cloudinary with resource_type 'image'.
 * If not, falls back to storing in backend/uploads/<subdir>/.
 */
async function uploadImage(file, { subdir = 'questions', folder = 'questions' } = {}) {
  if (isCloudConfigured()) {
    try {
      const res = await uploadToCloudinary(file.path, { folder, resourceType: 'image' })
      return { url: res.url, filename: file.filename, cloud: true }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[storageService.uploadImage Cloud Error, falling back to disk]', err.message)
      }
      // Fallback to local disk
    }
  }
  const url = moveToSubdir(file, subdir)
  return { url, filename: file.filename, cloud: false }
}

/**
 * Upload an audio file (e.g. listening exam audio).
 * If Cloudinary is configured, uploads to Cloudinary with resource_type 'video' (Cloudinary handles audio as video).
 * If not, falls back to storing in backend/uploads/<subdir>/.
 */
async function uploadAudio(file, { subdir = 'audio', folder = 'audio' } = {}) {
  if (isCloudConfigured()) {
    try {
      const res = await uploadToCloudinary(file.path, { folder, resourceType: 'video' })
      return { url: res.url, filename: file.filename, cloud: true }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[storageService.uploadAudio Cloud Error, falling back to disk]', err.message)
      }
      // Fallback to local disk
    }
  }
  const url = moveToSubdir(file, subdir)
  return { url, filename: file.filename, cloud: false }
}

/**
 * Upload a book cover or practice/sample thumbnail:
 * First resizes to 400px .webp via sharp (resizeUploadedCover).
 * If Cloudinary is configured, uploads the resized .webp to Cloudinary and removes the local file.
 * If not, keeps the optimized .webp on local disk.
 */
async function uploadOptimizedCover(file, { dir, urlPrefix, folder = 'covers' }) {
  const localResized = await resizeUploadedCover(file, { dir, urlPrefix })
  if (isCloudConfigured()) {
    try {
      const localWebpPath = path.join(dir, localResized.filename)
      if (fs.existsSync(localWebpPath)) {
        const res = await uploadToCloudinary(localWebpPath, { folder, resourceType: 'image' })
        return { url: res.url, filename: localResized.filename, cloud: true }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[storageService.uploadOptimizedCover Cloud Error, falling back to disk]', err.message)
      }
    }
  }
  return { url: localResized.url, filename: localResized.filename, cloud: false }
}

/**
 * Resolves an audioUrl (which might be a remote Cloudinary URL or a local /uploads/ URL)
 * into a local file path suitable for passing to Groq Whisper transcription.
 * Returns { filePath, isTemp, cleanup: () => void }
 */
async function resolveAudioForTranscription(audioUrl) {
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
    const tmpDir = path.join(uploadsDir, 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const tempFilePath = path.join(tmpDir, `transcribe-${Date.now()}-${Math.round(Math.random() * 1e9)}.mp3`)

    const response = await fetch(audioUrl)
    if (!response.ok) {
      throw new Error(`Không thể tải file audio từ cloud (${response.status} ${response.statusText})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer))

    return {
      filePath: tempFilePath,
      isTemp: true,
      cleanup: () => {
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
        } catch {
          // ignore
        }
      },
    }
  }

  const filename = audioUrl.replace('/uploads/', '')
  const filePath = path.join(uploadsDir, filename)
  if (!fs.existsSync(filePath)) {
    throw new Error('File audio không tồn tại trên server')
  }

  return {
    filePath,
    isTemp: false,
    cleanup: () => {},
  }
}

module.exports = {
  isCloudConfigured,
  initCloudinary,
  uploadToCloudinary,
  uploadImage,
  uploadAudio,
  uploadOptimizedCover,
  resolveAudioForTranscription,
}
