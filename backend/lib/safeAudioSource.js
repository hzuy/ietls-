const dns = require('node:dns').promises
const net = require('node:net')
const path = require('node:path')

const MAX_AUDIO_BYTES = 50 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 30_000
const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac', '.webm', '.mp4', '.mpeg', '.mpga'])

function invalidSource(message) {
  const error = new Error(message)
  error.code = 'INVALID_AUDIO_SOURCE'
  return error
}

function isPublicAddress(address) {
  const family = net.isIP(address)
  if (family === 4) {
    const [a, b] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)))
  }
  if (family === 6) {
    const normalized = address.toLowerCase()
    if (normalized.includes('::ffff:')) {
      const mapped = normalized.slice(normalized.lastIndexOf(':') + 1)
      return net.isIP(mapped) === 4 && isPublicAddress(mapped)
    }
    const firstHextet = parseInt(normalized.split(':')[0] || '0', 16)
    return firstHextet >= 0x2000 && firstHextet <= 0x3fff &&
      !normalized.startsWith('2001:db8:') && !normalized.startsWith('2001:2:') && !normalized.startsWith('2001:10:')
  }
  return false
}

async function validateRemoteAudioUrl(rawUrl, lookup = dns.lookup) {
  let url
  try { url = new URL(rawUrl) } catch { throw invalidSource('Invalid audio source') }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw invalidSource('Unsupported audio source')
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || (() => {
    try { return new URL(process.env.CLOUDINARY_URL).hostname } catch { return null }
  })()
  const isCloudinary = cloudName && url.hostname.toLowerCase() === 'res.cloudinary.com' &&
    new RegExp(`^/${cloudName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/video/upload/(?:v\\d+/)?ielts-app/(?:audio|speaking_tts|user_audio)/`).test(url.pathname)
  const fallbackHost = process.env.REMOTE_UPLOADS_URL ? new URL(process.env.REMOTE_UPLOADS_URL).hostname.toLowerCase() : null
  const isConfiguredFallback = fallbackHost && url.hostname.toLowerCase() === fallbackHost && url.pathname.startsWith('/uploads/')
  if (!isCloudinary && !isConfiguredFallback) throw invalidSource('Only managed audio sources are supported')
  if (!ALLOWED_AUDIO_EXTENSIONS.has(path.extname(url.pathname).toLowerCase())) throw invalidSource('Unsupported audio format')
  let addresses
  try { addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true, verbatim: true }) }
  catch { throw invalidSource('Audio source could not be resolved') }
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw invalidSource('Invalid audio source address')
  return { url, addresses }
}

module.exports = { MAX_AUDIO_BYTES, DOWNLOAD_TIMEOUT_MS, ALLOWED_AUDIO_EXTENSIONS, isPublicAddress, validateRemoteAudioUrl }
