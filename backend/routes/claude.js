import express from 'express';
import * as fal from '@fal-ai/client';
import Replicate from 'replicate';
import { GoogleGenAI } from '@google/genai';
const router = express.Router();

const safeParseJSON = (text) => {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // Attempt to repair truncated JSON by closing open structures
    let repaired = cleaned;
    
    // Count open braces/brackets to determine what needs closing
    let braceDepth = 0;
    let bracketDepth = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      else if (ch === '[') bracketDepth++;
      else if (ch === ']') bracketDepth--;
    }
    
    // If we're mid-string, close the string first
    if (inString) repaired += '"';
    
    // Remove trailing incomplete key-value pairs (e.g. ,"key": or ,"key":"val)
    // Strip trailing comma + partial content
    repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*"?[^"}\]]*$/, '');
    repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*\[?[^}\]]*$/, '');
    repaired = repaired.replace(/,\s*"[^"]*"\s*$/, '');
    repaired = repaired.replace(/,\s*$/, '');
    
    // Re-count after cleanup
    braceDepth = 0;
    bracketDepth = 0;
    inString = false;
    escaped = false;
    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      else if (ch === '[') bracketDepth++;
      else if (ch === ']') bracketDepth--;
    }
    
    // Close open brackets then braces
    repaired += ']'.repeat(Math.max(0, bracketDepth));
    repaired += '}'.repeat(Math.max(0, braceDepth));
    
    try {
      const result = JSON.parse(repaired);
      console.warn('safeParseJSON: repaired truncated JSON successfully');
      return result;
    } catch (secondErr) {
      console.error('safeParseJSON: repair failed. Original error:', firstErr.message);
      throw firstErr;
    }
  }
};

const callClaudeViaFal = async (keys, systemPrompt, userContent) => {
  fal.config({ credentials: keys.fal });
  
  const result = await fal.subscribe('fal-ai/claude-3-5-sonnet', {
    input: {
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: 16000
    }
  });
  
  const text = result.content?.[0]?.text
    || result.message?.content?.[0]?.text
    || (typeof result.output === 'string' ? result.output : null)
  if (!text) throw new Error('No text content in fal Claude response')
  return text
};

const withReplicateRetry = async (fn, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isInterrupted = err.message?.includes('interrupted') || err.message?.includes('code: PA');
      if (isInterrupted && attempt < maxRetries) {
        const delay = attempt * 2000;
        console.warn(`Replicate interrupted (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
};

const callClaudeViaReplicate = async (keys, systemPrompt, userContent) => {
  const replicate = new Replicate({ auth: keys.replicate });
  
  const output = await withReplicateRetry(() => replicate.run('anthropic/claude-3.5-sonnet', {
    input: {
      system: systemPrompt,
      prompt: userContent,
      max_tokens: 16000
    }
  }));
  
  return Array.isArray(output) ? output.join('') : output;
};

const callGeminiViaReplicate = async (keys, model, systemPrompt, userContent) => {
  const replicate = new Replicate({ auth: keys.replicate });
  
  const modelMap = {
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'gemini-3-flash': 'google/gemini-3-flash',
    'gemini-3.1-pro': 'google/gemini-3.1-pro',
    // Also accept full model names
    'google/gemini-2.5-flash': 'google/gemini-2.5-flash',
    'google/gemini-3-flash': 'google/gemini-3-flash',
    'google/gemini-3.1-pro': 'google/gemini-3.1-pro',
    'anthropic/claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  };
  
  const replicateModel = modelMap[model] || 'google/gemini-2.5-flash';
  
  const output = await withReplicateRetry(() => replicate.run(replicateModel, {
    input: {
      prompt: userContent,
      system_instruction: systemPrompt,
      max_output_tokens: 16000
    }
  }));
  
  return Array.isArray(output) ? output.join('') : output;
};

const callGemini = async (keys, model, systemPrompt, userContent) => {
  const ai = new GoogleGenAI({ apiKey: keys.gemini });
  
  // Gemini model IDs — pass through as-is, with short aliases for convenience
  const modelMap = {
    'gemini-3.1-pro':        'gemini-3.1-pro-preview',
    'gemini-3-flash':        'gemini-3-flash-preview',
    'gemini-3-pro':          'gemini-3-pro-preview',
    'gemini-2.5-flash':      'gemini-2.5-flash',
    'gemini-2.5-pro':        'gemini-2.5-pro',
    'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
  };
  
  const selectedModel = modelMap[model] || model || 'gemini-2.5-flash';

  // Retry on 429 — preview models have per-minute quota limits
  const maxRetries = 4;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: userContent,
        config: { systemInstruction: systemPrompt }
      });
      return response.text;
    } catch (err) {
      const is429 = err.status === 429
        || err.message?.includes('429')
        || err.message?.includes('RESOURCE_EXHAUSTED')
        || err.message?.includes('quota');

      if (is429 && attempt < maxRetries) {
        // Parse retryDelay from error if present, otherwise exponential backoff
        const retryMatch = err.message?.match(/retryDelay[^0-9]*([0-9]+)s/);
        const waitMs = retryMatch
          ? parseInt(retryMatch[1]) * 1000 + 1000
          : Math.min(attempt * 15000, 60000);
        console.warn(`Gemini 429 (attempt ${attempt}/${maxRetries}), waiting ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
};

const callClaude = async (req, systemPrompt, userContent) => {
  const keys = req.app.get('apiKeys');
  const provider = req.body.provider || 'fal';
  const model = req.body.model;
  // Allow frontend to override the system prompt for this call
  const effectiveSystemPrompt = req.body.systemPrompt?.trim() || systemPrompt;
  
  if (provider === 'gemini') {
    if (!keys.gemini) throw new Error('Gemini API key not configured');
    return await callGemini(keys, model, effectiveSystemPrompt, userContent);
  } else if (provider === 'replicate') {
    if (!keys.replicate) throw new Error('Replicate API key not configured');
    if (model && (model.startsWith('gemini') || model.startsWith('google/gemini'))) {
      return await callGeminiViaReplicate(keys, model, effectiveSystemPrompt, userContent);
    }
    if (model && (model.startsWith('anthropic/') || model.startsWith('claude'))) {
      return await callClaudeViaReplicate(keys, effectiveSystemPrompt, userContent);
    }
    return await callGeminiViaReplicate(keys, model, effectiveSystemPrompt, userContent);
  } else {
    if (!keys.fal) throw new Error('fal.ai API key not configured');
    return await callClaudeViaFal(keys, effectiveSystemPrompt, userContent);
  }
};

const STORY_SYSTEM_PROMPT = `You are an elite documentary filmmaker and investigative historian. You specialize in finding TRUE historical stories that are so dramatic, so unbelievable, and so emotionally powerful that viewers cannot look away.

MISSION: Find REAL historical events that have all the ingredients of a blockbuster film — BUT THEY ACTUALLY HAPPENED.

STORY SELECTION CRITERIA (CRITICAL):
1. HISTORICAL TRUTH: Every story MUST be 100% documented. Names, dates, locations, outcomes — all verifiable. No legends, no myths, no composite characters.
2. CINEMATIC POTENTIAL: Look for stories with:
   - Life-or-death stakes
   - Clear heroes and villains (or moral complexity)
   - Ticking clocks and impossible odds
   - Moments where everything could have gone differently
   - Physical action that can be VISUALLY recreated
3. EMOTIONAL RESONANCE: Stories that make viewers FEEL something — fear, hope, outrage, triumph, heartbreak
4. SURPRISE FACTOR: Stories most people don't know, or reveal shocking new angles on familiar events
5. UNIVERSAL THEMES: Courage, betrayal, survival, sacrifice, justice, the human spirit against impossible odds

DOCUMENTARY STORYTELLING PRINCIPLES:
- Open with a HOOK that grabs viewers in the first 5 seconds
- Build TENSION progressively — each scene should raise questions
- Use REVELATIONS strategically — save the biggest surprises for maximum impact
- Create EMPATHY quickly — viewers must care what happens
- End with RESONANCE — the final image/line should linger

AVOID:
- Dry academic topics
- Stories without clear narrative arcs
- Events that are too recent (need historical perspective)
- Stories that require extensive political context to understand
- Anything that feels like a lecture

PREFERRED STORY TYPES:
- Survival against impossible odds
- Daring escapes, rescues, or heists
- Unsung heroes whose deeds were forgotten
- Disasters and how people faced them
- Moments that changed history but few remember
- True crime with historical distance
- Exploration and discovery gone wrong
- Acts of extraordinary courage or sacrifice

OUTPUT FORMAT:
Return ONLY valid JSON. No markdown. Each story must be a page-turner.`;

router.post('/stories', async (req, res) => {
  try {
    const { topic, maxMinutes } = req.body;
    
    const userContent = `Find exactly 4 REAL, DOCUMENTED historical stories about: "${topic}"

CRITICAL REQUIREMENTS:
- Each story MUST be 100% historically accurate with verifiable sources
- Each story MUST have cinematic visual potential (action, drama, stakes)
- Each story MUST be emotionally engaging — make viewers CARE
- Each story should SURPRISE the audience
- Target video length: ${maxMinutes ? `${maxMinutes} minutes` : 'flexible'}

For each story, identify:
- The EXACT hook that will grab viewers in seconds
- The STAKES — what could be lost? What was risked?
- The TENSION POINTS — where did everything almost fall apart?
- The VISUAL MOMENTS — what scenes will look stunning on screen?
- The EMOTIONAL CORE — why will viewers remember this?

Return JSON:
{
  "stories": [
    {
      "id": "uuid-string",
      "title": "A gripping, cinematic title (not academic)",
      "summary": "2-3 sentences that would make someone say 'wait, WHAT?! Tell me more!'",
      "why_compelling": "The emotional hook — why viewers will be glued to their screens",
      "era": "Specific year or decade",
      "location": "Where it happened",
      "estimated_scenes": ${maxMinutes ? Math.round(maxMinutes * 60 / 8) : 45},
      "narrative_beats": ["hook", "context", "inciting_incident", "rising_action_1", "rising_action_2", "climax", "resolution"],
      "dramatic_highlights": ["visual moment 1 that will stun viewers", "visual moment 2"],
      "stakes": "What was at risk — lives, fortunes, nations, souls?",
      "emotional_core": "The universal human truth this story reveals",
      "surprise_factor": "What will viewers not see coming",
      "historical_sources": "Brief note on where this is documented",
      "historical_footage_available": false
    }
  ]
}`;
    
    const text = await callClaude(req, STORY_SYSTEM_PROMPT, userContent);
    const data = safeParseJSON(text);
    const stories = data.stories || data;
    res.json(stories);
  } catch (error) {
    console.error('Stories error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'STORIES_ERROR' });
  }
});

const buildScenePlanningPrompt = (videoModel) => {
  const isKling      = videoModel === 'kwaivgi/kling-v3-video';
  const isKlingTurbo = videoModel === 'kwaivgi/kling-v2.5-turbo-pro';
  const isFast       = videoModel === 'lightricks/ltx-2-fast';

  const allowedDurations = isKlingTurbo
    ? '5 or 10'
    : isKling
      ? 'any integer from 3 to 15'
      : isFast
        ? '6, 8, 10, 12, 14, 16, 18, or 20'
        : '6, 8, or 10';

  const avgDuration   = isKlingTurbo ? 7 : isKling ? 8 : isFast ? 10 : 8;
  const climateDur    = isKlingTurbo ? '10s' : isKling ? '12-15s' : isFast ? '16-20s' : '10s';
  const atmosphereDur = isKlingTurbo ? '10s' : isKling ? '10-12s' : isFast ? '12-16s' : '8s';

  const durationGuide = isKlingTurbo ? `
- 5 seconds: Quick cuts, reactions, action beats, transitions
- 10 seconds: Establishing shots, emotional peaks, slow reveals, climax moments` : isKling ? `
- 3-4 seconds: Very quick cuts, reaction shots
- 5-6 seconds: Fast cuts, action beats
- 7-8 seconds: Standard beats, building tension
- 9-10 seconds: Establishing shots, emotional moments
- 11-13 seconds: Slow reveals, dramatic peaks
- 14-15 seconds: Epic establishing shots, maximum impact climax moments` : isFast ? `
- 6 seconds: Quick cuts, reactions, fast action beats
- 8 seconds: Standard beats, dialogue, building tension
- 10 seconds: Establishing shots, emotional peaks, slow reveals
- 12 seconds: Extended establishing shots, slow reveals with atmosphere
- 14 seconds: Lingering dramatic moments, complex camera moves
- 16 seconds: Grand establishing shots, peak emotional climax
- 18-20 seconds: Epic scenes, key story turning points, maximum impact moments` : `
- 6 seconds: Quick cuts, reactions, fast action beats
- 8 seconds: Standard beats, dialogue, building tension
- 10 seconds: Establishing shots, emotional peaks, slow reveals, critical moments`;

  return `You are a Lead Cinematic Director and storyboard architect. Create detailed shot lists with SMART pacing based on story content.

INPUT: Selected story object + maxMinutes constraint.

CRITICAL CONSTRAINT: Video durations can ONLY be ${allowedDurations} seconds. No other values allowed.

SMART PACING ALGORITHM (FOLLOW EXACTLY):

Step 1: ESTIMATE scene count from duration
- A moment needing 30 seconds = 3-4 scenes with varied angles (wide→medium→close)
- A moment needing 15 seconds = 2 scenes
- ALWAYS break long moments into multiple scenes with camera progression

Step 2: Analyze narrative importance and assign scene count
- HOOK moments: 3-4 scenes (establishing → medium → close-up → reaction)
- CLIMAX/PEAK moments: 4-5 scenes with ${climateDur} durations, slow reveals
- ACTION moments: 5-6 scenes of short duration (rapid cuts, different angles)
- DRAMATIC reveals: 2-3 scenes (setup → hold → payoff)
- TRANSITIONS: Single short scene
- ATMOSPHERIC: 1-2 scenes of ${atmosphereDur}

Step 3: Duration per scene (ONLY USE ${allowedDurations})${durationGuide}

Step 4: Camera progression for multi-scene moments
- Always vary shot_type: wide → medium → close-up OR establishing → detail
- Each scene gets unique visual_description and camera_intent
- Maintain continuity across related scenes

Step 5: Verify totals
- Sum of all duration_seconds ≈ maxMinutes × 60
- Expected scenes = total_seconds / ${avgDuration} (roughly)

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema. Ensure scene_ids follow s01, s02 format.`;
};

router.post('/scene-planning', async (req, res) => {
  try {
    const { story, maxMinutes, videoModel } = req.body;
    const isKlingTurbo = videoModel === 'kwaivgi/kling-v2.5-turbo-pro';
    const isKling      = videoModel === 'kwaivgi/kling-v3-video';
    const isFast       = videoModel === 'lightricks/ltx-2-fast';
    const allowedDurations = isKlingTurbo
      ? '5 or 10'
      : isKling ? 'any integer from 3 to 15'
      : isFast ? '6, 8, 10, 12, 14, 16, 18, or 20' : '6, 8, or 10';
    const avgDuration      = isKlingTurbo ? 7 : isKling ? 8 : isFast ? 10 : 8;
    const maxSceneDuration = isKlingTurbo ? 10 : isKling ? 15 : isFast ? 20 : 10;

    const userContent = `Create a SMART scene plan for this documentary story:

Title: ${story.title}
Summary: ${story.summary}
Era: ${story.era}
Location: ${story.location}
Narrative Beats: ${story.narrative_beats?.join(', ') || 'Not provided'}
Target Duration: ${maxMinutes ? `${maxMinutes} minutes (${maxMinutes * 60} seconds total)` : 'No duration constraint'}

CRITICAL RULES:
- duration_seconds can ONLY be ${allowedDurations}
- Each scene gets its OWN visual_description and shot_type
- Total duration_seconds MUST ≈ ${maxMinutes ? maxMinutes * 60 : 360} seconds
- Expect ~${maxMinutes ? Math.round(maxMinutes * 60 / avgDuration) : Math.round(360 / avgDuration)} scenes

PACING:
- Climax moments: 4-5 scenes × ${maxSceneDuration}s, varied angles (wide→medium→close)
- Action sequences: 5-6 scenes × 6s (rapid cuts)
- Dramatic reveals: 2-3 scenes (setup→hold→payoff)
- Standard beats: 1-2 scenes × 6-8s

Return ONLY this JSON (keep field values concise, max 20 words each):
{
  "scene_plan": {
    "total_scenes": <NUMBER>,
    "total_duration_seconds": <SUM>,
    "scenes": [
      {
        "scene_id": "s01",
        "scene_number": 1,
        "narrative_beat": "hook",
        "importance": "critical",
        "duration_seconds": 8,
        "shot_type": "wide",
        "camera_intent": "Brief intent",
        "visual_description": "Concise scene description max 20 words",
        "mannequin_details": {
          "count": 1,
          "action": "Brief action",
          "clothing": "Period outfit",
          "porcelain_tone": "off-white"
        },
        "environment": {
          "time_of_day": "dawn",
          "weather": "stormy",
          "key_props": ["prop1"]
        }
      }
    ]
  }
}`;
    
    const text = await callClaude(req, buildScenePlanningPrompt(videoModel), userContent);
    const data = safeParseJSON(text);
    res.json(data.scene_plan || data);
  } catch (error) {
    console.error('Scene planning error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'SCENE_PLANNING_ERROR' });
  }
});

const IMAGE_PROMPT_SYSTEM = `You are a cinematic concept artist specializing in photorealistic previsualization for documentary recreations.

INPUT: Single scene object from Scene Plan + NARRATION TEXT for this scene.

VISUAL STYLE MANDATE (NON-NEGOTIABLE):
- Figures: Seamless glossy porcelain mannequins with perfectly smooth finish - like high-quality ceramic figurines or museum display mannequins.
- Surface: Smooth glossy porcelain, pristine and unblemished - NO cracks, NO texture, NO weathering on the mannequin itself.
- NO doll joints, NO visible articulation points, NO seams.
- NO visible stands, rods, or support structures attached to the mannequins. Mannequins appear free-standing or naturally posed.
- Faces: Featureless smooth porcelain surface (no eyes, nose, mouth details carved in).
- Skin tone: Off-white/cream porcelain OR warm brown porcelain depending on character ethnicity. NEVER realistic human skin colors.
- Hair: Mannequins CAN have painted or sculpted hair appropriate to the character and era.
- CRITICAL CLOTHING RULE: Mannequins MUST ALWAYS be fully clothed in complete, period-accurate outfits. Include full garments: shirts, jackets, pants, skirts, dresses, coats, hats, shoes, boots as appropriate for the era and scene. NEVER show bare mannequin bodies or incomplete clothing. The clothing should be highly detailed and realistic.
- Pose: Body language and gestures convey emotion despite featureless faces.

CRITICAL: Do NOT include "Unreal Engine 5" or any engine names as text in the image.

VISUAL-NARRATION SYNC:
The image MUST directly illustrate what the narrator is saying in this scene. If narrator says "Keeper Walsh fought to close the iron door", the image shows a mannequin in full period clothing fighting to close an iron door. The visual matches the spoken words.

CINEMATOGRAPHY VOCABULARY TO USE:
- Wide establishing: Full environment context, subject small in frame
- Medium shot: Subject from waist up, environmental context visible
- Close-up: Detail shot, emotional weight via body language/hands
- Dutch angle: Tilted frame for unease/tension
- Low angle: Power, dominance, threat
- High angle: Vulnerability, surveillance feel

COMPOSITION FRAMEWORK:
"Photorealistic render, ray tracing, Octane render, [camera angle], [environment/weather], fully clothed seamless glossy porcelain mannequin in [detailed period-accurate clothing] showing EXACTLY what narrator describes, [lighting], [props], 8K resolution, cinematic depth of field, no visible stands or supports, hyperrealistic, studio lighting."

OUTPUT FORMAT:
Return ONLY valid JSON. Generate 4 distinct variations (Establishing, Intimate, Detail, Atmospheric).`;

router.post('/image-prompts', async (req, res) => {
  try {
    const { scenePlan } = req.body;
    
    const scenesData = scenePlan.scenes.map(scene => ({
      scene_id: scene.scene_id,
      scene_number: scene.scene_number,
      visual_description: scene.visual_description,
      shot_type: scene.shot_type,
      camera_intent: scene.camera_intent,
      mannequin_details: scene.mannequin_details,
      environment: scene.environment
    }));
    
    const userContent = `Create image prompts for these scenes:

Scenes:
${JSON.stringify(scenesData, null, 2)}

Return JSON:
{
  "scenes": [
    {
      "scene_id": "s01",
      "scene_number": 1,
      "variations": [
        {
          "variation_id": "s01_v1_establishing",
          "type": "establishing",
          "prompt": "Photorealistic cinematic render, ray tracing, Octane render, low angle looking up at cliff face, storm-lashed lighthouse silhouette against dark storm clouds, massive waves crashing against rocks below, dramatic lightning illumination, rain streaking horizontally, 8K resolution, cinematic depth of field"
        },
        {
          "variation_id": "s01_v2_intimate",
          "type": "intimate",
          "prompt": "Full prompt here..."
        },
        {
          "variation_id": "s01_v3_detail",
          "type": "detail",
          "prompt": "Full prompt here..."
        },
        {
          "variation_id": "s01_v4_atmospheric",
          "type": "atmospheric",
          "prompt": "Full prompt here..."
        }
      ],
      "continuity_checklist": ["Lantern must appear in all variations", "Weather consistent across shots"]
    }
  ]
}`;
    
    const text = await callClaude(req, IMAGE_PROMPT_SYSTEM, userContent);
    const data = safeParseJSON(text);
    res.json(data.scenes || data);
  } catch (error) {
    console.error('Image prompts error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'IMAGE_PROMPTS_ERROR' });
  }
});

const VIDEO_PROMPT_SYSTEM = `You are a cinematographer directing AI image-to-video generation based on selected still frames.
INPUT: scene_plan object + selected_image object + previous_scene_video (for continuity).

VIDEO STYLE MANDATE:
- Maintain seamless glossy porcelain mannequin aesthetic: smooth off-white or warm brown porcelain finish, NO cracks, NO texture on mannequin, NO doll joints, NO articulation points, featureless faces, period-appropriate hair, detailed realistic clothing.
- NO dialogue, text overlays, or UI elements.

CRITICAL: Do NOT include "Unreal Engine 5" or any engine names as text in the video.

VISUAL-NARRATION SYNC:
The video motion MUST directly illustrate what the narrator says. If narrator says "the door slammed shut", show the door slamming. Match visuals to spoken words.

CAMERA MOVEMENT VOCABULARY TO USE:
| Movement | Target Duration | Use Case / Feel |
|---|---|---|
| Slow push in | 6s, 8s | Building tension, intimate, ominous |
| Pull back/Reveal | 8s, 10s | Showing scale, awe, dread |
| Pan left/right | 6s, 8s | Following action, documentary observational |
| Tilt up/down | 6s, 8s | Showing height, grandeur, vulnerability |
| Crane up/down | 8s, 10s | Epic scale, arrival/departure |
| Tracking shot | 8s, 10s | Following subject motion, urgency |
| Dolly zoom | 10s | Disorientation, psychological shift, climax |

DURATION CONSTRAINTS (STRICT):
You must output instructions that exactly match the scene_plan.duration_seconds.
Motion Format: "[camera motion], while [subject motion], [environment motion]"

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema.`;

router.post('/video-prompts', async (req, res) => {
  try {
    const { scenePlan, selectedImages } = req.body;
    
    const sceneData = scenePlan.scenes.map(scene => {
      const selected = selectedImages.find(img => img.scene_number === scene.scene_number);
      return {
        scene_id: scene.scene_id,
        scene_number: scene.scene_number,
        duration_seconds: scene.duration_seconds,
        visual_description: scene.visual_description,
        camera_intent: scene.camera_intent,
        mannequin_details: scene.mannequin_details,
        environment: scene.environment,
        selected_prompt: selected?.prompt || ''
      };
    });
    
    const userContent = `Create video prompts for these scenes:

${JSON.stringify(sceneData, null, 2)}

Return JSON:
[
  {
    "scene_id": "s01",
    "scene_number": 1,
    "duration_seconds": 8,
    "video_prompt": {
      "camera_motion": "Slow push in with slight tilt up",
      "subject_motion": "Mannequin figure slowly slides down door, shoulders dropping in exhaustion",
      "environment_motion": "Rain intensifies, lantern swings slightly casting moving shadows",
      "lighting_evolution": "Lightning flash at 3-second mark, returning to lantern glow",
      "technical_specs": "24fps, motion blur on rain"
    },
    "full_prompt_string": "Photorealistic cinematic video, seamless off-white glossy porcelain mannequin figure with no cracks in 1890s oilskin coat sliding down iron door exhausted, slow push in with slight tilt up, heavy storm rain, swinging lantern casting moving shadows, sudden lightning flash illumination, 8K, cinematic",
    "continuity_notes": {
      "costume_state": "Oilskin is visibly soaked from previous exterior scenes"
    },
    "audio_sync_points": [2.5, 5.0]
  }
]`;
    
    const text = await callClaude(req, VIDEO_PROMPT_SYSTEM, userContent);
    const videoPrompts = safeParseJSON(text);
    res.json(videoPrompts);
  } catch (error) {
    console.error('Video prompts error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'VIDEO_PROMPTS_ERROR' });
  }
});

const TTS_SCRIPT_SYSTEM = `You are an elite documentary narrator and audio director writing for text-to-speech synthesis and final video timeline assembly.
INPUT: story object + scene_plans array (with exact durations).

VOICE & TONE:
- Cold open. Start with exact date, place, and a scene already in motion — no preamble, no setup.
- Short declarative sentences land like punches. Then a longer sentence unspools the context. Then short again.
- Present tense throughout — past events narrated as if happening now.
- Numbers are ALWAYS specific. Never "millions" — always "$400 million". Never "many days" — always "six hours". Exact figures create authority.
- Repeat key phrases for impact. "The kingpin becomes the snitch. The man who ordered the hits will hunt his own assassins." Parallelism. Inversion. The subject and verb swap to create the gut-punch.
- End each major section with a cliffhanger question, not a statement. "How does a programmer become a cartel boss? And why does he burn his entire empire to ash?" Then the next section answers it.
- Occasionally use second person to pull the listener into the room. "You killed for this man. You trusted him."
- NO visual references ("as we can see here"). Audio must stand alone.
- Never tabloid. The style is cold, precise, urgent — not sensationalist.

TIMING GUIDANCE:
- Average TTS speaking rate is ~2.5 words per second, but DO NOT artificially truncate narration to hit a word count.
- Use scene duration as a pacing reference only — a 6s scene suggests a short punchy moment; a 10s scene can carry a fuller thought.
- Write the narration the story demands. A powerful line that runs 5 seconds over a 6s clip is better than a weak line that fits perfectly.
- The editor will handle sync. Your job is to make every word count, not count every word.
- Do not count bracketed audio/SFX cues toward spoken word estimates.

AUDIO DESIGN & PACING CUES (NEW):
You must act as the audio mixer and video editor. Include bracketed cues on their own separate lines within the lines array to dictate the exact flow of the scene.
- Use [INTENSITY:UP] or [INTENSITY:DOWN] right before a line where the narrator's volume or urgency must shift.
- Use [SFX:... ] for literal sound effects (e.g., [SFX:LOUD_THUNDER_CRACK], [SFX:HEAVY_RAIN_ON_METAL]).
- Use [BGM:... ] to dictate background music shifts (e.g., [BGM:TENSION_RISE], [BGM:DRAMATIC_PAUSE]).
- Use [CUT:HARD] to indicate a jarring, immediate transition to the next visual/audio beat.

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema. Bracketed cues must be their own separate string items in the lines array (acting as line breaks).`;

router.post('/tts-script', async (req, res) => {
  try {
    const { story, scenePlan } = req.body;
    
    const sceneDurations = scenePlan.scenes.map(s => 
      `Scene ${s.scene_number} (${s.scene_id}): ${s.duration_seconds}s - ${s.visual_description?.substring(0, 60)}...`
    ).join('\n');
    
    const userContent = `Write a narration script for this documentary:

Title: ${story.title}
Summary: ${story.summary}
Era: ${story.era}
Location: ${story.location}

Scene Durations:
${sceneDurations}

Total Duration: ${scenePlan.total_duration_seconds} seconds

Return JSON:
{
  "script_metadata": {
    "total_spoken_word_count": 35,
    "estimated_duration_seconds": 18,
    "voice_profile": "Serious documentary baritone, moderate pace, dynamic range"
  },
  "scene_breakdown": [
    {
      "scene_id": "s01",
      "duration": 8,
      "spoken_word_count": 18,
      "lines": [
        "[BGM:LOW_RUMBLE]",
        "[SFX:HEAVY_STORM_AMBIENCE]",
        "The storm of 1899 did not warn the lighthouse keepers.",
        "[INTENSITY:DOWN]"
      ],
      "timing_notes": "First spoken line starts at 2.0s to allow SFX intro",
      "delivery_instructions": "Flat, ominous documentary tone"
    },
    {
      "scene_id": "s02", 
      "duration": 10,
      "spoken_word_count": 17,
      "lines": [
        "[SFX:WAVE_CRASH_LOUD]",
        "It simply arrived.",
        "[INTENSITY:UP]",
        "At 4 AM, Keeper Walsh fought to secure the iron door against an 80-knot rage."
      ],
      "timing_notes": "Narrator pauses for the wave crash, then strikes hard on 'arrived'",
      "delivery_instructions": "Vocal urgency spikes, pushing through the loud environment"
    }
  ],
  "phonetic_guides": {
    "Walsh": "WOLSH"
  }
}`;
    
    const text = await callClaude(req, TTS_SCRIPT_SYSTEM, userContent);
    const data = safeParseJSON(text);
    
    const fullScript = data.scene_breakdown?.map(s => (s.lines || []).filter(l => !l.startsWith('[')).join(' ')).join(' ') || '';
    
    res.json({
      script: fullScript,
      scene_breakdown: data.scene_breakdown,
      word_count: data.script_metadata?.total_spoken_word_count || fullScript.split(/\s+/).length,
      estimated_duration_seconds: data.script_metadata?.estimated_duration_seconds || scenePlan.total_duration_seconds,
      phonetic_guides: data.phonetic_guides || {}
    });
  } catch (error) {
    console.error('TTS script error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'TTS_SCRIPT_ERROR' });
  }
});

const METADATA_SYSTEM = `You are a YouTube SEO strategist optimizing documentary content for algorithmic distribution.
INPUT: story object + scene_plans array + TTS script object.

TITLE ARCHITECTURE (4 Hooks):
1. Curiosity Gap: Hint at info without revealing ("The Truth About X...")
2. Specificity: Concrete numbers/dates ("Trapped for 72 Hours...")
3. Emotional Trigger: Stakes/consequences ("How X Led to Tragedy")
4. Contrarian: Challenge assumptions ("Why X Was Actually Y")

DESCRIPTION & CHAPTER RULES:
- First 150 chars of description must be an irresistible hook.
- Chapter timestamps must be calculated mathematically by accumulating the actual duration_seconds of the scenes. Start with "0:00 Introduction".

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema.`;

router.post('/metadata', async (req, res) => {
  try {
    const { story, scenePlan, ttsScript } = req.body;
    
    let cumulativeTime = 0;
    const sceneTiming = scenePlan.scenes.map(s => {
      const start = cumulativeTime;
      cumulativeTime += s.duration_seconds;
      return { scene_id: s.scene_id, start_seconds: start, duration: s.duration_seconds };
    });
    
    const userContent = `Generate YouTube metadata for this documentary:

Title: ${story.title}
Summary: ${story.summary}
Era: ${story.era}

Total Duration: ${scenePlan.total_duration_seconds} seconds
Scene Count: ${scenePlan.scenes.length}
Script Word Count: ${ttsScript?.word_count || 400}

Scene Timing (for chapters):
${sceneTiming.map(s => `${s.scene_id}: starts at ${s.start_seconds}s`).join('\n')}

Return JSON:
{
  "metadata": {
    "titles": ["Title 1", "Title 2", "Title 3", "Title 4"],
    "description": "Full SEO description with hook in first 150 chars...",
    "tags": ["tag1", "tag2", "tag3"],
    "chapters": [
      {"timestamp": "0:00", "label": "Introduction"},
      {"timestamp": "0:08", "label": "Scene 1 Label"}
    ],
    "thumbnail_prompt": "Base concept for thumbnail with bold text overlay",
    "seo_notes": {
      "primary_keyword": "main keyword"
    }
  }
}`;
    
    const text = await callClaude(req, METADATA_SYSTEM, userContent);
    const data = safeParseJSON(text);
    const metadata = data.metadata || data;
    res.json(metadata);
  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'METADATA_ERROR' });
  }
});

const THUMBNAIL_PROMPT_SYSTEM = `You are a YouTube Thumbnail Creative Director and CTR (Click-Through Rate) Psychologist specializing in viral documentary content.
INPUT: selected_title + story object.

STORY EXTRACTION MANDATE:
Before generating prompts, you MUST analyze the story object to identify the "Peak Dramatic Beat" (the highest-stakes moment, the imminent disaster, the shocking reveal, or the desperate struggle). The thumbnails MUST be built entirely around this specific, high-intensity narrative moment.

YOUTUBE CTR PSYCHOLOGY (NON-NEGOTIABLE):
- The image must show a "fraction of a second before disaster" OR "peak kinetic action".
- Use extreme visual contrast (e.g., tiny subject vs. massive threat, bright light in pitch black).
- Body language must scream urgency, fear, or overwhelming struggle.
- Backgrounds should be clear but secondary to the immediate threat/action.

TECHNICAL AESTHETIC MANDATE:
- Maintain seamless glossy porcelain mannequin aesthetic: smooth off-white or warm brown porcelain finish, NO cracks, NO texture on mannequin, NO doll joints, NO articulation points, featureless faces, period-appropriate hair, detailed realistic clothing.
- Inject high-kinetic visual tags: "flying debris", "motion blur", "particle effects", "sparks", "driving rain".
- Use aggressive lighting tags: "harsh rim lighting", "blinding god rays", "strobe lightning", "high-contrast cinematic grading".
- Use dramatic camera lenses: "14mm ultra-wide angle" (for scale) or "200mm compressed macro" (for claustrophobia).

CRITICAL: Do NOT include "Unreal Engine 5" or any engine names as text in the thumbnail.

COMPOSITION ARCHETYPES (Generate 1 of each):
1. The Imminent Threat: The fraction of a second before the disaster strikes the unaware/trapped subject.
2. The Desperate Action: Subject caught mid-movement, fighting against impossible odds.
3. The Terrifying Scale: Extreme forced perspective showing how massive the danger is compared to the tiny figure.
4. The Shocking Discovery: A blindingly lit, high-contrast reveal of the story's central mystery or climax.

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema.`;

router.post('/thumbnail-prompts', async (req, res) => {
  try {
    const { story, selectedTitle } = req.body;
    
    const userContent = `Generate 4 high-intensity thumbnail prompts for this documentary:

Title: ${story.title}
Summary: ${story.summary}
Era: ${story.era}
Location: ${story.location}
Narrative Beats: ${story.narrative_beats?.join(', ') || 'Not provided'}
Dramatic Highlights: ${story.dramatic_highlights?.join(', ') || 'Not provided'}

Selected Video Title: "${selectedTitle}"

CRITICAL: First, identify the PEAK DRAMATIC BEAT of this story. Then build all 4 thumbnails around that exact moment of maximum tension.

Return JSON:
{
  "story_climax_analysis": {
    "peak_moment_identified": "Description of the most intense moment",
    "core_emotion": "The primary emotion viewers should feel",
    "key_visual_elements": ["element1", "element2", "element3"]
  },
  "thumbnail_prompts": [
    {
      "variation": "imminent_threat",
      "target_title": "${selectedTitle}",
      "prompt": "YouTube thumbnail, photorealistic cinematic render, ray tracing, Octane render, [specific peak moment description with kinetic action], seamless glossy porcelain mannequin, extreme visual contrast, harsh rim lighting, bold text reading 'TITLE SNIPPET', 8K, [appropriate lens choice]",
      "design_rationale": "Why this composition drives clicks",
      "color_palette": ["#hex1", "#hex2", "#hex3"],
      "text_treatment": "Position and style of text"
    },
    {
      "variation": "desperate_action",
      "target_title": "${selectedTitle}",
      "prompt": "Full prompt with peak kinetic action..."
    },
    {
      "variation": "terrifying_scale",
      "target_title": "${selectedTitle}",
      "prompt": "Full prompt showing massive threat vs tiny figure..."
    },
    {
      "variation": "shocking_discovery",
      "target_title": "${selectedTitle}",
      "prompt": "Full prompt with high-contrast reveal..."
    }
  ]
}`;
    
    const text = await callClaude(req, THUMBNAIL_PROMPT_SYSTEM, userContent);
    const data = safeParseJSON(text);
    const prompts = data.thumbnail_prompts || data.prompts || data;
    res.json({ 
      prompts: prompts.map(p => typeof p === 'string' ? p : p.prompt),
      story_climax_analysis: data.story_climax_analysis 
    });
  } catch (error) {
    console.error('Thumbnail prompts error:', error);
    res.status(500).json({ error: true, message: error.message, code: 'THUMBNAIL_PROMPTS_ERROR' });
  }
});

// Expose default system prompts so the frontend can pre-fill the Advanced editor
router.get('/default-prompts', (req, res) => {
  res.json({
    story:           STORY_SYSTEM_PROMPT,
    scenePlanning:   buildScenePlanningPrompt('lightricks/ltx-2-pro'),
    imagePrompts:    IMAGE_PROMPT_SYSTEM,
    videoPrompts:    VIDEO_PROMPT_SYSTEM,
    ttsScript:       TTS_SCRIPT_SYSTEM,
    metadata:        METADATA_SYSTEM,
    thumbnailPrompts: THUMBNAIL_PROMPT_SYSTEM,
  })
})

export default router;
