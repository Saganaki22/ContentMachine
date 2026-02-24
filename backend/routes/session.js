// Auto-save session route.
// Saves project state to output/<sessionId>/ as real files so nothing
// is lost even if the user never manually exports.
//
// Endpoints:
//   POST /api/session/save          — save/update a session
//   GET  /api/session/list          — list all saved sessions
//   GET  /api/session/:id           — load session.json for a session
//   GET  /api/session/:id/files/*   — serve individual files (images/videos)
//   DELETE /api/session/:id         — delete a session

import express from 'express'
import fs from 'fs/promises'
import { createWriteStream, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import http from 'http'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_ROOT = path.join(__dirname, '..', '..', 'output')

// Ensure output root exists on startup
await fs.mkdir(OUTPUT_ROOT, { recursive: true })

// ── Helpers ────────────────────────────────────────────────────────────────

// Decode a base64 data URI or download an HTTP URL to a local file.
// Returns the relative path written (e.g. "images/all/scene_01_v1.png").
const saveAsset = async (url, relPath, sessionDir) => {
  if (!url) return null
  const absPath = path.join(sessionDir, relPath)
  await fs.mkdir(path.dirname(absPath), { recursive: true })

  if (url.startsWith('data:')) {
    // base64 data URI — decode and write
    const [header, b64] = url.split(',')
    if (!b64) return null
    const buf = Buffer.from(b64, 'base64')
    await fs.writeFile(absPath, buf)
    return relPath
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Download from CDN
    await new Promise((resolve, reject) => {
      const proto = url.startsWith('https') ? https : http
      const file = createWriteStream(absPath)
      proto.get(url, (res) => {
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
      }).on('error', async (err) => {
        file.close()
        try { await fs.unlink(absPath) } catch {}
        reject(err)
      })
    })
    return relPath
  }

  return null
}

const extFromUrl = (url, fallback = 'jpg') => {
  if (!url) return fallback
  if (url.startsWith('data:image/png')) return 'png'
  if (url.startsWith('data:image/webp')) return 'webp'
  if (url.startsWith('data:image/gif')) return 'gif'
  const match = url.match(/\.(\w{2,4})(?:\?|$)/)
  return match ? match[1].toLowerCase() : fallback
}

const pad = (n) => String(n).padStart(2, '0')

// ── POST /api/session/save ─────────────────────────────────────────────────
// Body: { sessionId, project }
// project is the exportProject() snapshot from the frontend.
// Images in project.images and project.selected_images may be base64 or HTTP URLs.
// We extract them to files and replace URLs with local file references.
router.post('/save', async (req, res) => {
  try {
    const { sessionId, project } = req.body
    if (!sessionId || !project) {
      return res.status(400).json({ error: 'sessionId and project required' })
    }

    const sessionDir = path.join(OUTPUT_ROOT, sessionId)
    await fs.mkdir(sessionDir, { recursive: true })

    // Deep clone project so we can replace URLs with local paths
    const snapshot = JSON.parse(JSON.stringify(project))

    // ── Save all image variants ──────────────────────────────────────────
    for (const [key, img] of Object.entries(snapshot.images || {})) {
      if (!img?.url) continue
      const [sceneNum, promptIdx] = key.split('_')
      const variantNum = parseInt(promptIdx, 10) + 1
      const ext = extFromUrl(img.url)
      const relPath = `images/all/scene_${pad(sceneNum)}_v${variantNum}.${ext}`
      try {
        const saved = await saveAsset(img.url, relPath, sessionDir)
        if (saved) img.url = `__session_file__/${saved}`
      } catch (e) {
        console.warn(`Session save: failed to write image ${key}:`, e.message)
      }
    }

    // ── Save selected images ─────────────────────────────────────────────
    for (const [sceneNum, img] of Object.entries(snapshot.selected_images || {})) {
      if (!img?.url) continue
      const ext = extFromUrl(img.url)
      const relPath = `images/selected/scene_${pad(sceneNum)}.${ext}`
      try {
        const saved = await saveAsset(img.url, relPath, sessionDir)
        if (saved) img.url = `__session_file__/${saved}`
      } catch (e) {
        console.warn(`Session save: failed to write selected image ${sceneNum}:`, e.message)
      }
    }

    // ── Save image history ───────────────────────────────────────────────
    for (const [key, entries] of Object.entries(snapshot.image_history || {})) {
      const [sceneNum, promptIdx] = key.split('_')
      const variantNum = parseInt(promptIdx, 10) + 1
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        if (!entry?.url) continue
        const ext = extFromUrl(entry.url)
        const relPath = `images/history/scene_${pad(sceneNum)}_v${variantNum}_prev${i + 1}.${ext}`
        try {
          const saved = await saveAsset(entry.url, relPath, sessionDir)
          if (saved) entry.url = `__session_file__/${saved}`
        } catch (e) {
          console.warn(`Session save: failed to write history image ${key}[${i}]:`, e.message)
        }
      }
    }

    // ── Save thumbnails ──────────────────────────────────────────────────
    for (const [idx, thumb] of Object.entries(snapshot.all_thumbnails || {}).concat(
      // also handle thumbnails keyed by index
      Object.entries(
        Array.isArray(snapshot.all_thumbnails)
          ? {}
          : {}
      )
    )) {
      // all_thumbnails is an array
    }
    if (Array.isArray(snapshot.all_thumbnails)) {
      for (let i = 0; i < snapshot.all_thumbnails.length; i++) {
        const thumb = snapshot.all_thumbnails[i]
        if (!thumb?.url) continue
        const ext = extFromUrl(thumb.url)
        const relPath = `thumbnails/thumbnail_${pad(i + 1)}.${ext}`
        try {
          const saved = await saveAsset(thumb.url, relPath, sessionDir)
          if (saved) thumb.url = `__session_file__/${saved}`
        } catch (e) {
          console.warn(`Session save: failed to write thumbnail ${i}:`, e.message)
        }
      }
    }

    // ── Save thumbnail history ───────────────────────────────────────────
    for (const [idx, entries] of Object.entries(snapshot.thumbnail_history || {})) {
      for (let i = 0; i < (entries || []).length; i++) {
        const entry = entries[i]
        if (!entry?.url) continue
        const ext = extFromUrl(entry.url)
        const relPath = `thumbnails/history/thumbnail_${pad(parseInt(idx, 10) + 1)}_prev${i + 1}.${ext}`
        try {
          const saved = await saveAsset(entry.url, relPath, sessionDir)
          if (saved) entry.url = `__session_file__/${saved}`
        } catch (e) {
          console.warn(`Session save: failed to write thumbnail history ${idx}[${i}]:`, e.message)
        }
      }
    }

    // ── Save selected thumbnail urls ─────────────────────────────────────
    if (snapshot.thumbnail?.selected_url) {
      const ext = extFromUrl(snapshot.thumbnail.selected_url)
      try {
        const saved = await saveAsset(snapshot.thumbnail.selected_url, `thumbnails/selected.${ext}`, sessionDir)
        if (saved) snapshot.thumbnail.selected_url = `__session_file__/${saved}`
      } catch {}
    }

    // ── Videos are HTTP URLs — just keep as-is (CDN links) ──────────────
    // Video files can be large; we don't download them on every auto-save.
    // They are preserved as CDN URLs in session.json.
    // (If CDN link expires the user can re-generate; videos are also in ZIP export)

    // ── Write session metadata ───────────────────────────────────────────
    snapshot._session = {
      id: sessionId,
      saved_at: new Date().toISOString(),
      title: project.story?.title || 'Untitled',
    }

    // Atomic write: write to .tmp then rename
    const jsonPath = path.join(sessionDir, 'session.json')
    const tmpPath  = jsonPath + '.tmp'
    await fs.writeFile(tmpPath, JSON.stringify(snapshot, null, 2), 'utf8')
    await fs.rename(tmpPath, jsonPath)

    res.json({ ok: true, sessionId })
  } catch (err) {
    console.error('Session save error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/session/list ──────────────────────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    const entries = await fs.readdir(OUTPUT_ROOT, { withFileTypes: true })
    const sessions = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const jsonPath = path.join(OUTPUT_ROOT, entry.name, 'session.json')
      try {
        const raw = await fs.readFile(jsonPath, 'utf8')
        const data = JSON.parse(raw)
        sessions.push({
          id: entry.name,
          title: data._session?.title || data.story?.title || 'Untitled',
          saved_at: data._session?.saved_at || null,
          scene_count: data.scenes?.length || 0,
          has_images: Object.values(data.images || {}).some(i => i?.url),
          has_videos: Object.values(data.video_jobs || {}).some(j => j?.url),
          has_thumbnail: !!(data.thumbnail?.selected_url),
        })
      } catch {
        // session.json missing or corrupt — skip
      }
    }
    sessions.sort((a, b) => (b.saved_at || '').localeCompare(a.saved_at || ''))
    res.json({ sessions })
  } catch (err) {
    console.error('Session list error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/session/:id ───────────────────────────────────────────────────
// Returns session.json with __session_file__ placeholders replaced with
// full HTTP URLs so the frontend can load images directly.
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    // Basic safety: no path traversal
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      return res.status(400).json({ error: 'Invalid session id' })
    }
    const jsonPath = path.join(OUTPUT_ROOT, id, 'session.json')
    const raw = await fs.readFile(jsonPath, 'utf8')
    // Replace __session_file__/<relPath> with a full URL the browser can fetch
    const baseUrl = `${req.protocol}://${req.get('host')}/api/session/${id}/files`
    const resolved = raw.replaceAll(
      /"__session_file__\/([^"]+)"/g,
      (_, relPath) => `"${baseUrl}/${relPath}"`
    )
    res.setHeader('Content-Type', 'application/json')
    res.send(resolved)
  } catch (err) {
    console.error('Session load error:', err)
    res.status(404).json({ error: 'Session not found' })
  }
})

// ── GET /api/session/:id/files/* ───────────────────────────────────────────
// Serves individual asset files (images, thumbnails) directly.
router.get('/:id/files/*', async (req, res) => {
  try {
    const { id } = req.params
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      return res.status(400).json({ error: 'Invalid session id' })
    }
    const relPath = req.params[0]
    if (!relPath || relPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid path' })
    }
    const absPath = path.join(OUTPUT_ROOT, id, relPath)
    // Ensure file is inside session dir
    if (!absPath.startsWith(path.join(OUTPUT_ROOT, id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    res.sendFile(absPath)
  } catch (err) {
    res.status(404).json({ error: 'File not found' })
  }
})

// ── DELETE /api/session/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      return res.status(400).json({ error: 'Invalid session id' })
    }
    const sessionDir = path.join(OUTPUT_ROOT, id)
    await fs.rm(sessionDir, { recursive: true, force: true })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
