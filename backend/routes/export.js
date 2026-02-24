import express from 'express';
import archiver from 'archiver';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import path from 'path';
import { Readable } from 'stream';
const router = express.Router();

const getExtFromUrl = (urlString, fallback = 'jpg') => {
  try {
    const parsed = new URL(urlString);
    const ext = path.extname(parsed.pathname).replace('.', '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch {}
  return fallback;
};

const fetchUrlToStream = (urlString) => {
  return new Promise((resolve, reject) => {
    if (!urlString || urlString.startsWith('data:')) {
      if (urlString?.startsWith('data:')) {
        const base64Data = urlString.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const stream = Readable.from(buffer);
        resolve(stream);
        return;
      }
      reject(new Error('Invalid URL'));
      return;
    }
    
    const parsedUrl = new URL(urlString);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    protocol.get(urlString, { timeout: 60000 }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch: ${response.statusCode}`));
        return;
      }
      resolve(response);
    }).on('error', reject);
  });
};

const slugify = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
};

const formatDateTime = () => {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `${date}_${time}`;
};

router.post('/zip', async (req, res) => {
  try {
    const project = req.body;
    
    const storyTitle = project.story?.title || 'untitled-project';
    const dateTime = formatDateTime();
    const baseName = `${slugify(storyTitle)}_${dateTime}`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.zip"`);
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      // Headers already sent at this point — just destroy the connection
      if (!res.headersSent) {
        res.status(500).json({ error: true, message: err.message });
      } else {
        res.destroy();
      }
    });
    
    const selectedImages = project.selected_images || {};
    const allImages = project.images || {};       // keyed "sceneNum_promptIndex"
    const selectedVideos = project.selected_videos || {};
    const sceneNumbers = [...new Set([
      ...Object.keys(selectedImages),
      ...Object.keys(selectedVideos),
      ...Object.keys(allImages).map(k => k.split('_')[0])
    ])].sort((a, b) => Number(a) - Number(b));

    // ============ IMAGES/SELECTED FOLDER ============
    for (const sceneNum of sceneNumbers) {
      const image = selectedImages[sceneNum];
      if (image?.url) {
        try {
          const stream = await fetchUrlToStream(image.url);
          const ext = image.url.startsWith('data:')
            ? (image.url.startsWith('data:image/png') ? 'png' : 'jpg')
            : getExtFromUrl(image.url, 'jpg');
          archive.append(stream, { name: `images/selected/scene_${String(sceneNum).padStart(2, '0')}.${ext}` });
        } catch (e) {
          console.error(`Failed to fetch selected image ${sceneNum}:`, e.message);
        }
      }
    }

    // ============ IMAGES/ALL FOLDER (all generated variants) ============
    for (const [key, image] of Object.entries(allImages)) {
      if (!image?.url) continue;
      // key is "sceneNum_promptIndex" e.g. "3_2"
      const [sceneNum, promptIndex] = key.split('_');
      const variantNum = Number(promptIndex) + 1;
      try {
        const stream = await fetchUrlToStream(image.url);
        const ext = image.url.startsWith('data:')
          ? (image.url.startsWith('data:image/png') ? 'png' : 'jpg')
          : getExtFromUrl(image.url, 'jpg');
        archive.append(stream, {
          name: `images/all/scene_${String(sceneNum).padStart(2, '0')}_v${variantNum}.${ext}`
        });
      } catch (e) {
        console.error(`Failed to fetch variant image ${key}:`, e.message);
      }
    }
    
    // ============ VIDEOS FOLDER ============
    for (const sceneNum of sceneNumbers) {
      const video = selectedVideos[sceneNum];
      if (video?.url) {
        try {
          const stream = await fetchUrlToStream(video.url);
          archive.append(stream, { name: `videos/scene_${String(sceneNum).padStart(2, '0')}.mp4` });
        } catch (e) {
          console.error(`Failed to fetch video ${sceneNum}:`, e.message);
        }
      }
    }
    
    // ============ AUDIO FOLDER ============
    const audioData = project.audio || {};
    
    // Scene narration audio — store uses camelCase (sceneAudio), fallback to snake_case
    const sceneAudioMap = audioData.sceneAudio || audioData.scene_audio || {};
    if (Object.keys(sceneAudioMap).length > 0) {
      for (const [sceneId, sceneAudio] of Object.entries(sceneAudioMap)) {
        if (sceneAudio?.parts) {
          const audioParts = sceneAudio.parts.filter(p => p.type === 'audio');
          for (let i = 0; i < audioParts.length; i++) {
            try {
              const stream = await fetchUrlToStream(audioParts[i].content);
              archive.append(stream, { name: `audio/narration/${sceneId}_part${i + 1}.mp3` });
            } catch (e) {
              console.error(`Failed to fetch narration ${sceneId}:`, e.message);
            }
          }
        }
      }
    }
    
    // Sound effects — store uses camelCase (sfxAudio), fallback to snake_case
    const sfxAudioMap = audioData.sfxAudio || audioData.sfx_audio || {};
    if (Object.keys(sfxAudioMap).length > 0) {
      for (const [cue, sfx] of Object.entries(sfxAudioMap)) {
        if (sfx?.audio) {
          try {
            const stream = await fetchUrlToStream(sfx.audio);
            const cueName = cue.replace('[SFX:', '').replace(']', '').replace(/:/g, '_');
            archive.append(stream, { name: `audio/sfx/${cueName}.mp3` });
          } catch (e) {
            console.error(`Failed to fetch SFX ${cue}:`, e.message);
          }
        }
      }
    }
    
    // ============ THUMBNAIL FOLDER ============
    // Export all user-selected thumbnails (multi-select supported)
    const selectedUrls = project.thumbnail?.selected_urls || 
      (project.thumbnail?.selected_url ? [project.thumbnail.selected_url] : []);
    
    for (let i = 0; i < selectedUrls.length; i++) {
      const url = selectedUrls[i];
      if (url) {
        try {
          const stream = await fetchUrlToStream(url);
          const ext = url.startsWith('data:')
            ? (url.startsWith('data:image/png') ? 'png' : 'jpg')
            : getExtFromUrl(url, 'jpg');
          const filename = selectedUrls.length === 1
            ? `thumbnail/thumbnail.${ext}`
            : `thumbnail/thumbnail_${i + 1}.${ext}`;
          archive.append(stream, { name: filename });
        } catch (e) {
          console.error(`Failed to fetch thumbnail ${i + 1}:`, e.message);
        }
      }
    }
    
    // ============ METADATA FOLDER ============
    if (project.metadata) {
      // YouTube metadata
      archive.append(JSON.stringify(project.metadata, null, 2), { name: 'metadata/youtube_metadata.json' });
      
      // Titles as plain text
      if (project.metadata.all_titles || project.metadata.titles) {
        const titles = project.metadata.all_titles || project.metadata.titles;
        const titlesText = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');
        archive.append(titlesText, { name: 'metadata/titles.txt' });
      }
      
      // Description
      if (project.metadata.description) {
        archive.append(project.metadata.description, { name: 'metadata/description.txt' });
      }
      
      // Tags
      if (project.metadata.tags) {
        archive.append(project.metadata.tags.join(', '), { name: 'metadata/tags.txt' });
      }
      
      // Chapters
      if (project.metadata.chapters) {
        const chaptersText = project.metadata.chapters.map(c => `${c.timestamp} ${c.label}`).join('\n');
        archive.append(chaptersText, { name: 'metadata/chapters.txt' });
      }
    }
    
    // ============ SCRIPT FOLDER ============
    if (project.tts_script) {
      // Full script
      archive.append(project.tts_script, { name: 'script/narration.txt' });
    }
    
    // Script with cues (if available)
    if (project.tts_scene_breakdown) {
      let scriptWithCues = '';
      for (const scene of project.tts_scene_breakdown) {
        scriptWithCues += `\n=== ${scene.scene_id} (${scene.duration}s) ===\n`;
        scriptWithCues += `Delivery: ${scene.delivery_instructions || 'Standard'}\n\n`;
        for (const line of scene.lines) {
          scriptWithCues += `${line}\n`;
        }
      }
      archive.append(scriptWithCues, { name: 'script/narration_with_cues.txt' });
    }
    
    // ============ ROOT - PROJECT FILE ============
    // Restorable snapshot with base64 image data stripped out — images live as
    // real files in images/all/ and images/selected/ inside the ZIP.
    // The importer reconstructs state.images and state.selectedImages from those
    // files by matching filenames back to sceneNum_promptIndex keys.
    //
    // Strip base64 from: images (all variants), selected_images, all_thumbnails,
    // thumbnail urls, and audio (base64 audio blobs if any).
    const stripUrl = (obj) => obj ? { ...obj, url: undefined } : obj

    const projectExport = {
      ...project,
      version: 2,
      exported_at: new Date().toISOString(),
      // images: strip url, keep prompt so UI knows what was used per variant
      images: Object.fromEntries(
        Object.entries(project.images || {}).map(([k, v]) => [k, stripUrl(v)])
      ),
      // selected_images: strip url, keep prompt + promptIndex for reference
      selected_images: Object.fromEntries(
        Object.entries(project.selected_images || {}).map(([k, v]) => [k, stripUrl(v)])
      ),
      // thumbnails: strip urls — thumbnail files are written to thumbnail/ folder
      all_thumbnails: (project.all_thumbnails || []).map(t => stripUrl(t)),
      thumbnail: project.thumbnail ? {
        ...project.thumbnail,
        selected_url: undefined,
        selected_urls: undefined,
      } : null,
    };
    archive.append(JSON.stringify(projectExport, null, 2), { name: 'project.json' });
    
    // README
    const readme = `# ${project.story?.title || 'Video Project'}

Generated: ${new Date().toISOString()}

## Folder Structure

- \`images/selected/\` - Chosen scene image (one per scene)
- \`images/all/\` - All generated variants for every scene (up to 4 per scene)
- \`videos/\` - Generated video clips (one per scene)
- \`audio/\` - Narration and sound effects
  - \`narration/\` - Scene-by-scene voiceover
  - \`sfx/\` - Sound effects
- \`thumbnail/\` - YouTube thumbnail options
- \`metadata/\` - YouTube metadata (titles, description, tags, chapters)
- \`script/\` - Narration scripts

## Next Steps

1. Import videos into video editor
2. Add narration audio tracks
3. Overlay sound effects at marked timestamps
4. Add thumbnail
5. Upload to YouTube with metadata

## Scene Durations

${sceneNumbers.map(n => {
  const video = selectedVideos[n];
  return `- Scene ${n}: ${video?.duration || 'unknown'}s`;
}).join('\n')}
`;
    archive.append(readme, { name: 'README.md' });
    
    await archive.finalize();
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'EXPORT_ERROR' });
  }
});

export default router;
