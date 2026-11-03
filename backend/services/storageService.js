const cloudinary = require('cloudinary').v2
const path = require('path')
const fs = require('fs')
const { MAX_AUDIO_BYTES, DOWNLOAD_TIMEOUT_MS, ALLOWED_AUDIO_EXTENSIONS, validateRemoteAudioUrl } = require('../lib/safeAudioSource')
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
  const invalidSource = message => Object.assign(new Error(message), { code: 'INVALID_AUDIO_SOURCE' })
  if (typeof audioUrl !== 'string' || !audioUrl.trim()) throw invalidSource('Audio source is required')
  if (audioUrl.startsWith('/uploads/')) {
    if (/%2f|%5c|%00/i.test(audioUrl) || audioUrl.includes('\\') || audioUrl.includes('?') || audioUrl.includes('#')) throw invalidSource('Invalid audio path')
    let relative
    try { relative = decodeURIComponent(audioUrl.slice('/uploads/'.length)) } catch { throw invalidSource('Invalid audio path') }
    if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..' || part.includes(':')) || !ALLOWED_AUDIO_EXTENSIONS.has(path.extname(relative).toLowerCase())) throw invalidSource('Invalid audio path or format')
    const root = fs.realpathSync(uploadsDir)
    let filePath
    try { filePath = fs.realpathSync(path.join(root, relative)) } catch { throw invalidSource('Audio file does not exist on server') }
    const fileStat = fs.statSync(filePath)
    if (!filePath.startsWith(`${root}${path.sep}`) || !fileStat.isFile()) throw invalidSource('Invalid audio path')
    if (fileStat.size > MAX_AUDIO_BYTES) throw invalidSource('Audio file exceeds 50 MB limit')
    return { filePath, isTemp: false, cleanup: () => {} }
  }
  const { url, addresses } = await validateRemoteAudioUrl(audioUrl)
  const tmpDir = path.join(uploadsDir, 'tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  const tempFilePath = path.join(tmpDir, `transcribe-${process.pid}-${Date.now()}-${require('node:crypto').randomBytes(8).toString('hex')}${path.extname(url.pathname).toLowerCase()}`)
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    try { fs.unlinkSync(tempFilePath) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  try {
    const transport = url.protocol === 'https:' ? require('node:https') : require('node:http')
    const net = require('node:net')
    await new Promise((resolve, reject) => {
      const pinned = addresses[0]
      let req
      const wholeTimer = setTimeout(() => req?.destroy(new Error('Audio download timed out')), DOWNLOAD_TIMEOUT_MS)
      const finish = callback => value => { clearTimeout(wholeTimer); callback(value) }
      try {
        req = transport.get(url, {
          agent: false,
          lookup: (_host, _options, callback) => callback(null, pinned.address, net.isIP(pinned.address)),
          timeout: DOWNLOAD_TIMEOUT_MS,
        }, async response => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            response.resume(); finish(reject)(new Error('Unable to download audio from managed storage')); return
          }
          const length = Number(response.headers['content-length'])
          if (Number.isFinite(length) && length > MAX_AUDIO_BYTES) {
            response.destroy(); finish(reject)(new Error('Audio file exceeds 50 MB limit')); return
          }
          let received = 0
          response.on('data', chunk => {
            received += chunk.length
            if (received > MAX_AUDIO_BYTES) response.destroy(new Error('Audio file exceeds 50 MB limit'))
          })
          try { await require('node:stream/promises').pipeline(response, fs.createWriteStream(tempFilePath, { flags: 'wx' })); finish(resolve)() } catch (error) { finish(reject)(error) }
        })
        req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => req.destroy(new Error('Audio download timed out')))
        req.on('error', finish(reject))

      } catch (error) { finish(reject)(error) }
    })
    return { filePath: tempFilePath, isTemp: true, cleanup }
  } catch (error) { cleanup(); throw error }
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
