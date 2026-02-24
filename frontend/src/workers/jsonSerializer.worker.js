// Web Worker: serializes large project objects to JSON off the main thread
// so the UI doesn't freeze on projects with many base64 images.
self.onmessage = (e) => {
  try {
    const json = JSON.stringify(e.data, null, 2)
    self.postMessage({ ok: true, json })
  } catch (err) {
    self.postMessage({ ok: false, error: err.message })
  }
}
