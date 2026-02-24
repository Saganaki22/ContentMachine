// Web Worker: extracts a ZIP project file off the main thread.
// Receives a File/Blob via postMessage, returns the fully reconstructed
// project object with image URLs as base64 data URIs.
//
// Workers have no FileReader but DO have Blob + arrayBuffer(), which we
// use to convert file entries to base64 data URIs without blocking the UI.

import JSZip from 'jszip'

const mimeFromExt = (filename) => {
  const ext = filename.split('.').pop().toLowerCase()
  if (ext === 'png')  return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif')  return 'image/gif'
  return 'image/jpeg'
}

// Convert a JSZip file entry to a base64 data URI using arrayBuffer (no FileReader needed)
const entryToDataUri = async (zipFile, mime) => {
  const buf = await zipFile.async('arraybuffer')
  // Convert ArrayBuffer → base64 in chunks to avoid call-stack overflow on large files
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return `data:${mime};base64,${btoa(binary)}`
}

self.onmessage = async (e) => {
  try {
    const file = e.data // File or Blob

    const zip = await JSZip.loadAsync(file)

    // ── Parse project.json ──────────────────────────────────────────────────
    const jsonFile = zip.file('project.json')
    if (!jsonFile) throw new Error('No project.json found in ZIP')
    const project = JSON.parse(await jsonFile.async('string'))

    // ── Collect file paths by folder ────────────────────────────────────────
    const allVariantFiles  = []  // images/all/scene_NN_vM.ext
    const selectedFiles    = []  // images/selected/scene_NN.ext
    const thumbnailFiles   = []  // thumbnail/thumbnail*.ext
    const videoFiles       = []  // videos/scene_NN.mp4  (pass through URL only)

    zip.forEach((path, f) => {
      if (f.dir) return
      if (path.startsWith('images/all/'))      allVariantFiles.push({ path, f })
      else if (path.startsWith('images/selected/')) selectedFiles.push({ path, f })
      else if (path.startsWith('thumbnail/'))   thumbnailFiles.push({ path, f })
      else if (path.startsWith('videos/'))      videoFiles.push({ path, f })
    })

    // ── Reconstruct images (all variants) ───────────────────────────────────
    // Start from project.images which has prompt/error but no url (stripped on export)
    const images = { ...(project.images || {}) }
    await Promise.all(allVariantFiles.map(async ({ path, f }) => {
      const filename = path.split('/').pop()           // scene_01_v1.jpg
      const match = filename.match(/scene_(\d+)_v(\d+)/)
      if (!match) return
      const sceneNum    = parseInt(match[1], 10)
      const promptIndex = parseInt(match[2], 10) - 1
      const key = `${sceneNum}_${promptIndex}`
      const url = await entryToDataUri(f, mimeFromExt(filename))
      images[key] = { ...(images[key] || {}), url, loading: false, error: null }
    }))

    // ── Reconstruct selected_images ─────────────────────────────────────────
    const selectedImages = { ...(project.selected_images || {}) }
    await Promise.all(selectedFiles.map(async ({ path, f }) => {
      const filename = path.split('/').pop()           // scene_01.jpg
      const match = filename.match(/scene_(\d+)/)
      if (!match) return
      const sceneNum = parseInt(match[1], 10)
      const url = await entryToDataUri(f, mimeFromExt(filename))
      selectedImages[sceneNum] = { ...(selectedImages[sceneNum] || {}), url }
    }))

    // ── Reconstruct thumbnails ──────────────────────────────────────────────
    // Sort by filename so index order is stable
    thumbnailFiles.sort((a, b) => a.path.localeCompare(b.path))
    const allThumbnails = await Promise.all(thumbnailFiles.map(async ({ path, f }, i) => {
      const url = await entryToDataUri(f, mimeFromExt(path))
      const prompt = project.all_thumbnails?.[i]?.prompt || ''
      return { url, prompt }
    }))

    // Reattach thumbnail urls to the thumbnail field
    let thumbnail = project.thumbnail || null
    if (thumbnail && allThumbnails.length) {
      thumbnail = {
        ...thumbnail,
        selected_url:  allThumbnails[0]?.url,
        selected_urls: allThumbnails.map(t => t.url),
      }
    }

    self.postMessage({
      ok: true,
      project: {
        ...project,
        images,
        selected_images: selectedImages,
        all_thumbnails:  allThumbnails,
        thumbnail,
      }
    })
  } catch (err) {
    self.postMessage({ ok: false, error: err.message })
  }
}
