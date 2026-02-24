import express from 'express';
import * as fal from '@fal-ai/client';
import Replicate from 'replicate';
import { GoogleGenAI } from '@google/genai';
const router = express.Router();

// Recursively replace N/A-like sentinel values with a fallback
const sanitizeNAValues = (obj) => {
  if (Array.isArray(obj)) return obj.map(sanitizeNAValues);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && /^(n\/a|none|unknown|tbd|n\.a\.)$/i.test(v.trim())) {
        // Replace with field-specific sensible defaults
        if (k === 'clothing') out[k] = 'period-appropriate attire';
        else if (k === 'weather') out[k] = 'clear';
        else if (k === 'time_of_day') out[k] = 'midday';
        else if (k === 'action') out[k] = 'stands in scene';
        else out[k] = '';
      } else {
        out[k] = sanitizeNAValues(v);
      }
    }
    return out;
  }
  return obj;
};

const safeParseJSON = (text) => {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  
  try {
    return sanitizeNAValues(JSON.parse(cleaned));
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
    
    // If we're mid-string, close the string first so depth counts below are valid
    if (inString) repaired += '"';

    // Remove trailing incomplete key-value pairs safely.
    // Strategy: strip from the last top-level comma that is NOT inside a string,
    // object, or array — this avoids greedy regexes that corrupt prompt strings
    // containing brackets or quotes (e.g. "holding a [torch]...").
    // We walk backwards to find the last safe truncation point.
    {
      let depth = 0;
      let inStr = false;
      let esc = false;
      let lastSafeComma = -1;
      for (let i = 0; i < repaired.length; i++) {
        const c = repaired[i];
        if (esc) { esc = false; continue; }
        if (c === '\\' && inStr) { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') depth--;
        else if (c === ',' && depth === 1) lastSafeComma = i;
      }
      // If the JSON is clearly truncated mid-value at the top level, prune to last safe comma
      if (lastSafeComma > 0 && (inString || repaired.trimEnd().endsWith(':'))) {
        repaired = repaired.slice(0, lastSafeComma);
      }
    }

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
      const result = sanitizeNAValues(JSON.parse(repaired));
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

const callClaudeViaReplicate = async (keys, model, systemPrompt, userContent) => {
  const replicate = new Replicate({ auth: keys.replicate });
  
  // Normalise model identifier: 'claude-3.5-sonnet' → 'anthropic/claude-3.5-sonnet'
  const replicateModel = model?.startsWith('anthropic/')
    ? model
    : model
      ? `anthropic/${model}`
      : 'anthropic/claude-3.5-sonnet';

  const output = await withReplicateRetry(() => replicate.run(replicateModel, {
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
    // Note: Claude models are routed via callClaudeViaReplicate, never reach here
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
  // Safety net: should be unreachable (last attempt always throws above)
  throw new Error('Gemini: max retries exhausted');
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
      return await callClaudeViaReplicate(keys, model, effectiveSystemPrompt, userContent);
    }
    // No recognised model prefix — fail fast instead of silently routing to Gemini
    throw new Error(`Unsupported Replicate model: "${model}". Use a model starting with "anthropic/", "claude", "gemini", or "google/gemini".`);
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
        ? 'any even number from 6 to 20 (6, 8, 10, 12, 14, 16, 18, 20)'
        : '6, 8, or 10';

  const avgDuration   = isKlingTurbo ? 7 : isKling ? 8 : isFast ? 14 : 8;
  const climateDur    = isKlingTurbo ? '10s' : isKling ? '12-15s' : isFast ? '18-20s' : '10s';
  const atmosphereDur = isKlingTurbo ? '10s' : isKling ? '10-12s' : isFast ? '14-16s' : '8s';

  const durationGuide = isKlingTurbo ? `
- 5 seconds: Quick cuts, reactions, action beats, transitions
- 10 seconds: Establishing shots, emotional peaks, slow reveals, climax moments` : isKling ? `
- 3-4 seconds: Very quick cuts, reaction shots
- 5-6 seconds: Fast cuts, action beats
- 7-8 seconds: Standard beats, building tension
- 9-10 seconds: Establishing shots, emotional moments
- 11-13 seconds: Slow reveals, dramatic peaks
- 14-15 seconds: Epic establishing shots, maximum impact climax moments` : isFast ? `
- 6 seconds: ONLY for very fast cuts, sharp reactions, sudden action beats — use sparingly
- 8 seconds: Quick beats, punchy transitions
- 10 seconds: Standard dialogue and character moments
- 12 seconds: Establishing shots, emotional beats — prefer this as your baseline
- 14 seconds: Slow reveals, dramatic tension — use frequently
- 16 seconds: Epic establishing shots, important narrative turns
- 18-20 seconds: Maximum impact sweeping reveals, climax moments — use generously for key scenes
NOTE: The model handles up to 20s natively. Favour 12-20s for most scenes to make full use of the model's capability.` : `
- 6 seconds: Quick cuts, reactions, fast action beats
- 8 seconds: Standard beats, dialogue, building tension
- 10 seconds: Establishing shots, emotional peaks, slow reveals, critical moments`;

  return `You are a Lead Cinematic Director and storyboard architect. Create detailed shot lists with SMART pacing based on story content.

INPUT: Selected story object + maxMinutes constraint.

CRITICAL CONSTRAINT: Video durations can ONLY be ${allowedDurations} seconds. No other values allowed.

JSON FIELD RULES (MANDATORY):
- NEVER use "N/A", "none", "unknown", or empty strings for any field.
- clothing: ALWAYS specify a COMPLETE head-to-toe period-accurate outfit. MANDATORY components: (1) upper body garment, (2) lower body garment, (3) NAMED footwear with type (e.g. "brown leather ankle boots", "iron-buckled black leather oxfords", "worn canvas sandals", "knee-high riding boots", "hobnail leather brogues"). Example: "coarse wool tunic, dark linen breeches, worn brown leather ankle boots". NEVER leave any component unspecified. NEVER omit footwear.
- action: ALWAYS describe a specific physical action (e.g. "raises torch above head", "kneels examining ground").
- weather: ALWAYS use a real condition (e.g. "clear", "overcast", "light rain", "heavy fog", "scorching sun").
- time_of_day: ALWAYS use a real time (e.g. "dawn", "midday", "dusk", "night", "golden hour").
- key_props: ALWAYS list at least one relevant prop from the scene. Never an empty array.

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
    // Derive model-specific values once — reused in both system prompt and user content.
    // buildScenePlanningPrompt() already encodes these; mirror them here for the user message.
    const isKlingTurbo     = videoModel === 'kwaivgi/kling-v2.5-turbo-pro';
    const isKling          = videoModel === 'kwaivgi/kling-v3-video';
    const isFast           = videoModel === 'lightricks/ltx-2-fast';
    const allowedDurations = isKlingTurbo ? '5 or 10'
      : isKling ? 'any integer from 3 to 15'
      : isFast  ? 'any even number from 6 to 20 (6, 8, 10, 12, 14, 16, 18, 20)'
      : '6, 8, or 10';
    const avgDuration      = isKlingTurbo ? 7 : isKling ? 8 : isFast ? 14 : 8;
    const maxSceneDuration = isKlingTurbo ? 10 : isKling ? 15 : isFast ? 20 : 10;
    const minActionDur     = isFast ? 8 : 6;
    const standardBeatDur  = isFast ? '12-14s' : isKling ? '6-10s' : '6-8s';

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
- Action sequences: 5-6 scenes × ${minActionDur}s (rapid cuts)
- Dramatic reveals: 2-3 scenes (setup→hold→payoff)
- Standard beats: 1-2 scenes × ${standardBeatDur}

Return ONLY this JSON. Every field must have a real, specific value — never "N/A", "none", or vague placeholders:
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
        "duration_seconds": ${isFast ? 14 : isKling ? 10 : isKlingTurbo ? 10 : 8},
        "shot_type": "wide",
        "camera_intent": "Slow push-in reveals scale of the fortress walls",
        "visual_description": "Torchlit stone ramparts at dusk, soldiers in formation on the battlements",
        "mannequin_details": {
          "count": 2,
          "action": "stands at attention gripping spear, scanning the horizon",
          "clothing": "iron chainmail hauberk over linen gambeson with iron helmet, rough wool breeches, iron-buckled brown leather knee boots",
          "porcelain_tone": "off-white"
        },
        "environment": {
          "time_of_day": "dusk",
          "weather": "overcast with distant lightning",
          "key_props": ["iron spears", "burning torch brackets", "stone battlements"]
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

INPUT: Scene objects from the Scene Plan, each containing visual_description, shot_type, mannequin_details, and environment.

VISUAL STYLE MANDATE (NON-NEGOTIABLE):
- Figures: Seamless glossy porcelain mannequins with perfectly smooth finish - like high-quality ceramic figurines or museum display mannequins.
- Surface: Smooth glossy porcelain, pristine and unblemished - NO cracks, NO texture, NO weathering on the mannequin itself.
- NO doll joints, NO visible articulation points, NO seams.
- NO visible stands, rods, or support structures attached to the mannequins. Mannequins appear free-standing or naturally posed.
- Faces: Featureless smooth porcelain surface (no eyes, nose, mouth details carved in).
- Skin tone: Off-white/cream porcelain OR warm brown porcelain depending on character ethnicity. NEVER realistic human skin colors.
- Hair: Mannequins CAN have painted or sculpted hair appropriate to the character and era.
- CRITICAL CLOTHING RULE: Mannequins MUST ALWAYS be fully clothed in complete, period-accurate outfits from head to toe. MANDATORY: (1) upper body garment explicitly named, (2) lower body garment explicitly named (trousers, breeches, skirt, etc.), (3) NAMED footwear with specific type (e.g. "brown leather ankle boots", "iron-buckled knee-high riding boots", "worn canvas sandals", "hobnail leather brogues", "pointed black leather court shoes") — NEVER just "shoes" or "boots" without qualifier. Use the exact clothing from mannequin_details.clothing in full. NEVER show bare legs, bare feet, or incomplete lower-body clothing. The entire outfit must be visible and highly detailed.
- Pose: Body language and gestures convey emotion despite featureless faces.

CRITICAL: Do NOT include "Unreal Engine 5" or any engine names as text in the image.

VISUAL-NARRATION SYNC:
The image MUST directly illustrate what the narrator is saying in this scene. If narrator says "Keeper Walsh fought to close the iron door", the image shows a mannequin in full period clothing fighting to close an iron door. The visual matches the spoken words.

CINEMATOGRAPHY VOCABULARY TO USE:

Shot types — pick the most dramatically appropriate for the variation:
- Extreme wide / aerial establishing: Subject tiny, vast environment dominates
- Wide establishing: Full environment context, subject readable in frame
- Medium shot: Subject waist-up, environment visible as context
- Medium close-up: Chest-up, face/expression body language readable
- Close-up: Head and shoulders or single object, emotional weight
- Extreme close-up / macro: Texture detail — fingers, fabric weave, sweat on porcelain, droplets
- Two-shot: Two figures in frame, spatial relationship conveyed
- Over-the-shoulder: One figure seen from behind, looking toward subject or horizon
- POV shot: Camera placed at subject eye-level looking outward

Camera angles — layer onto shot type:
- Eye-level: Neutral, observational, documentary feel
- Low angle (worm's eye): Power, dominance, looming threat, heroism
- High angle (bird's eye): Vulnerability, isolation, God's-eye overview
- Dutch angle (canted frame, 15–30°): Psychological unease, disorientation, tension
- Overhead / top-down: Patterns, scale, entrapment
- Canted extreme (45°+): Chaos, collapse, extreme psychological disturbance

Lens character — inject as texture into the prompt:
- 14mm ultra-wide: Extreme environmental scale, slight barrel distortion, claustrophobia in tight spaces
- 24mm wide: Classic cinematic wide, clean perspective, documentary feel
- 35mm: Natural field of view, intimate without distortion
- 50mm: Neutral "human eye" perspective, objective clarity
- 85mm portrait: Compressed background, subject isolation, emotional intimacy
- 135–200mm telephoto: Heavy background compression, subject extracted from environment, voyeuristic distance
- Fisheye (full-frame or circular): Extreme distortion, paranoia, dreamlike or supernatural feel, curved horizon
- Anamorphic widescreen: Oval bokeh, lens flares on highlights, cinematic 2.39:1 feel, horizontal streaks

Depth of field:
- Razor-thin DOF (f/1.4–f/2): Subject razor-sharp, background melts into abstract colour
- Shallow DOF (f/2.8–f/4): Subject sharp, background soft and painterly
- Deep focus (f/8–f/16): Both foreground and background sharp, everything in play
- Split focus diopter: Two planes in simultaneous focus, foreground object AND distant subject both sharp

LIGHTING VOCABULARY — choose specifically, never use "studio lighting" as a catch-all:

Natural / atmospheric:
- Golden hour: Warm amber-orange raking light, long shadows stretching across ground
- Magic hour / blue hour: Cool blue twilight, soft shadowless illumination, melancholic
- Harsh midday sun: Hard overhead light, deep black shadows, bleached highlights
- Overcast diffused: Flat even grey light, no shadows, quiet and sombre
- Moonlight: Cool blue-silver, sharp hard shadows, high contrast silver highlights
- Firelight / torchlight: Flickering amber-orange, dancing shadows, hot bright centre with deep surrounding darkness
- Candlelight: Intimate warm point-source, very low key, pools of orange in darkness
- Lightning flash: Instant harsh white illumination, freezes motion, creates stark shadows
- Foggy diffusion: Light scatters through mist, halos around sources, flat and eerie
- Underwater caustics: Rippling light patterns on surfaces, shifting blue-green

Cinematic / artificial:
- Chiaroscuro (Rembrandt): Strong single-source light carving one side of subject, deep shadow opposite
- Hard rim / kicker light: Bright edge light separating subject from dark background, hair and shoulder highlighted
- God rays / crepuscular rays: Shafts of volumetric light through fog, smoke, or gaps in architecture
- Practical lights in frame: Lanterns, fires, windows — light source visible and driving the scene
- Neon / coloured gel: Saturated coloured light casting, red/blue/green toned shadows
- High-key: Bright, low contrast, flat — clinical, oppressive brightness
- Low-key / noir: Predominantly dark, small pools of light, heavy shadows dominate
- Three-point lighting: Key + fill + rim, controlled and balanced
- Silhouette: Subject backlit, front completely dark, form only
- Contre-jour (shooting into light): Subject lit from behind, glowing edges, foreground in shadow
- Bioluminescence / practical glow: Objects emit their own eerie blue-green or amber light

Atmospheric / rendering texture:
- Volumetric fog / god rays: Visible light shafts, atmospheric depth
- Lens flare: Deliberate flare from bright source — add "anamorphic lens flare" for horizontal streaks
- Motion blur on environment: Background slightly blurred, suggests speed or wind
- Chromatic aberration: Slight colour fringing at edges, adds photographic realism
- Film grain overlay: 35mm grain texture, analogue feel
- Heat haze / atmospheric distortion: Shimmering air above hot surfaces

COMPOSITION FRAMEWORK:
"Photorealistic render, ray tracing, Octane render, [lens + camera angle + shot type], [environment/weather], fully clothed seamless glossy porcelain mannequin in [complete period-accurate outfit: upper garment + lower garment + named footwear type] showing EXACTLY what narrator describes, [specific lighting setup], [atmospheric texture], [props], 8K resolution, [DOF specification], no visible stands or supports, hyperrealistic"

MANDATORY RULES FOR EVERY PROMPT (ALL 4 VARIATIONS PER SCENE):
- EVERY prompt must contain "seamless glossy porcelain mannequin" with the FULL outfit from mannequin_details.clothing — upper garment, lower garment, AND named footwear type (e.g. "brown leather ankle boots", not just "boots")
- NEVER omit lower-body clothing or footwear — mannequins must NEVER appear bare-legged or bare-footed
- EVERY prompt must include "featureless smooth porcelain face, no eyes/nose/mouth"
- EVERY prompt must include the specific action from mannequin_details.action
- EVERY prompt must include "8K resolution, no visible stands or supports, hyperrealistic"
- ALL 4 variations must include the mannequin — Detail and Atmospheric are NOT environment-only shots
- EVERY prompt must specify a NAMED lighting setup (e.g. "chiaroscuro single-source torchlight", "golden hour raking backlight", "moonlit rim light with deep shadow fill") — never just "dramatic lighting" or "cinematic lighting"
- EVERY prompt must specify a LENS CHARACTER (e.g. "14mm ultra-wide", "85mm portrait lens", "anamorphic widescreen", "fisheye") matched to the emotional intent of the variation
- EVERY prompt must specify a DEPTH OF FIELD (e.g. "razor-thin DOF f/1.8, background dissolves to amber bokeh", "deep focus f/11, every plane sharp")
- Use varied lighting and lens choices ACROSS the 4 variations — do not repeat the same lens or lighting setup twice in one scene

OUTPUT FORMAT:
Return ONLY valid JSON. Generate 4 distinct variations per scene (Establishing, Intimate, Detail, Atmospheric).

EXAMPLE OUTPUT (follow this structure and level of detail exactly — note the varied lens, lighting, and DOF across all 4 variations):
{
  "scenes": [
    {
      "scene_id": "s01",
      "scene_number": 1,
      "variations": [
        {
          "variation_id": "s01_v1_establishing",
          "type": "establishing",
          "prompt": "Photorealistic render, ray tracing, Octane render, 14mm ultra-wide extreme establishing shot looking up at storm-lashed fortress on rocky cliff, seamless glossy porcelain mannequin in iron chainmail hauberk over linen gambeson with iron helmet stands at attention gripping spear on the battlements, featureless smooth porcelain face, off-white porcelain skin tone, massive waves crashing below, dark storm clouds with crepuscular god rays breaking through, practical torchlight bracketing the frame with warm amber against cold storm grey, volumetric fog rolling across the cliff face, deep focus f/11 every plane sharp from foreground rocks to distant horizon, anamorphic widescreen lens flare on torch bracket, iron spears and burning torch brackets visible, 8K resolution, no visible stands or supports, hyperrealistic"
        },
        {
          "variation_id": "s01_v2_intimate",
          "type": "intimate",
          "prompt": "Photorealistic render, ray tracing, Octane render, 85mm portrait lens medium shot waist-up, seamless glossy porcelain mannequin in iron chainmail hauberk over linen gambeson with iron helmet scanning the horizon with hand raised to brow, featureless smooth porcelain face, off-white porcelain skin tone, chiaroscuro single-source torchlight carving the left side of the mannequin in warm amber while the right side falls into deep blue-grey storm shadow, shallow DOF f/2.8 — stone battlements behind dissolve into soft grey bokeh, rain streaking past catching the torchlight as bright silver streaks, iron spear gripped in other hand, 8K resolution, no visible stands or supports, hyperrealistic"
        },
        {
          "variation_id": "s01_v3_detail",
          "type": "detail",
          "prompt": "Photorealistic render, ray tracing, Octane render, 135mm telephoto extreme close-up on hands of seamless glossy porcelain mannequin gripping iron spear shaft, iron chainmail hauberk sleeves visible, off-white porcelain fingers wrapped tight around worn iron, razor-thin DOF f/1.4 — spear grip tack-sharp, chainmail rings dissolve into warm amber bokeh behind, practical torchlight reflecting as a hot white specular highlight off smooth glossy porcelain knuckle surface, individual raindrops on chainmail rings caught mid-fall, chromatic aberration fringing at frame edges, stone battlement edge barely visible in soft focus background, 8K resolution, no visible stands or supports, hyperrealistic"
        },
        {
          "variation_id": "s01_v4_atmospheric",
          "type": "atmospheric",
          "prompt": "Photorealistic render, ray tracing, Octane render, fisheye lens low Dutch angle 25° canted frame, seamless glossy porcelain mannequin in iron chainmail hauberk and iron helmet silhouetted contre-jour against lightning-lit storm clouds, featureless smooth porcelain face turned skyward catching a single lightning flash as cold white rim light along helmet edge and shoulder pauldrons, surrounding scene drops into near-black low-key darkness, off-white porcelain surface catching lightning specular, curved fisheye horizon warps the battlement walls inward, rain streaking horizontally across distorted frame, burning torch brackets visible as small warm amber points in the deep black, deep focus f/8 everything distorted but sharp, 8K resolution, no visible stands or supports, hyperrealistic"
        }
      ],
      "continuity_checklist": ["Mannequin in all 4 variations", "Iron chainmail consistent across shots", "Storm weather consistent", "Torch practical lighting present in all shots", "Off-white porcelain tone consistent"]
    }
  ]
}`;

router.post('/image-prompts', async (req, res) => {
  try {
    const { scenePlan, scenes: scenesOverride } = req.body;

    // Accept either a full scenePlan or a pre-sliced scenes array (for batching)
    const sourceScenes = scenesOverride || scenePlan?.scenes || [];

    if (sourceScenes.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'No scenes provided — pass either a scenePlan with scenes or a scenes array override.',
        code: 'NO_SCENES'
      });
    }

    const scenesData = sourceScenes.map(scene => ({
      scene_id: scene.scene_id,
      scene_number: scene.scene_number,
      visual_description: scene.visual_description,
      shot_type: scene.shot_type,
      camera_intent: scene.camera_intent,
      mannequin_details: scene.mannequin_details,
      environment: scene.environment
    }));

    const userContent = `Create image prompts for these scenes following all rules and the example format in your instructions:

${JSON.stringify(scenesData, null, 2)}`;

    const text = await callClaude(req, IMAGE_PROMPT_SYSTEM, userContent);
    const parsed = safeParseJSON(text);

    // Normalise to array — Claude sometimes returns { scenes: [...] } or a plain object
    let scenes;
    if (Array.isArray(parsed)) {
      scenes = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const candidate = parsed.scenes || parsed.image_prompts || parsed.variations;
      if (Array.isArray(candidate)) {
        scenes = candidate;
      } else {
        const vals = Object.values(parsed);
        if (vals.length > 0 && vals.every(v => v && typeof v === 'object')) {
          scenes = vals;
        } else {
          return res.status(500).json({
            error: true,
            message: 'LLM returned an object instead of an array for image prompts — could not coerce to array',
            code: 'IMAGE_PROMPTS_NOT_ARRAY',
            raw: parsed
          });
        }
      }
    } else {
      return res.status(500).json({
        error: true,
        message: 'LLM returned unexpected type for image prompts',
        code: 'IMAGE_PROMPTS_NOT_ARRAY'
      });
    }

    res.json(scenes);
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

Translational moves:
| Movement | Feel / Use Case |
|---|---|
| Slow push in (dolly forward) | Building tension, intimacy, ominous approach |
| Pull back / reveal (dolly back) | Scale reveal, awe, isolation, dread |
| Lateral dolly (left or right) | Following action, documentary observation, parallax depth |
| Diagonal dolly | Dynamic energy, slight unease |
| Truck left/right (pure lateral) | Subject stays constant size, background slides — surveillance feel |

Rotational / pivot moves:
| Movement | Feel / Use Case |
|---|---|
| Pan left/right | Following movement, surveying environment |
| Tilt up | Revealing height, grandeur, aspiration |
| Tilt down | Weight, consequence, looking at ground or fallen subject |
| Dutch roll (banking tilt into Dutch angle) | Psychological shift, growing dread |
| Orbit / arc around subject | 3D reveal, subject as centrepiece, god-like perspective |

Vertical moves:
| Movement | Feel / Use Case |
|---|---|
| Crane up (pedestal rise) | Epic establishing, departure, God's-eye reveal |
| Crane down (pedestal lower) | Descending into scene, intimacy, weight |
| Boom sweep | Dramatic arc — combines rise with pan |

Combined / compound moves:
| Movement | Feel / Use Case |
|---|---|
| Dolly zoom (Vertigo effect) | Background grows/shrinks while subject stays constant — psychological rupture |
| Push in + tilt up | Subject looms larger as camera moves closer and looks up — power |
| Pull back + crane up | Epic scale reveal — subject recedes into vast environment |
| Orbit + push in | Spiralling approach — obsession, locked focus |
| Handheld drift | Subtle organic instability — documentary authenticity, unease |
| Shake / impact hit | Sudden violent camera movement — explosion, impact, shock |

Specialty / lens-driven motion:
| Movement | Feel / Use Case |
|---|---|
| Rack focus (static camera, focus shifts) | Foreground blurs as background sharpens or vice versa — reveal, consequence |
| Whip pan | Fast blur across frame — time jump, disorientation, action cut |
| Snap zoom | Fast crash zoom to subject — emphasis, shock, retro drama |
| Fisheye drift | Wide distorted lens drifts slowly — dreamlike, paranoid, supernatural |
| Anamorphic sweep | Horizontal lens flare streaks across frame during pan |

LIGHTING EVOLUTION VOCABULARY (for lighting_evolution field):
- Flicker to steady: Fire/torch settles — calm after chaos
- Steady to flicker: Wind picks up — growing threat
- Lightning strike: Instant full-exposure flash at a specific timestamp, then return to dark
- God ray sweep: Shaft of volumetric light moves across scene as clouds shift
- Candle blow-out: Scene dims from warm amber to near-black
- Dawn break: Gradual warm light creeps across scene from one edge
- Explosion flash: Bright white-orange burst, then rolling smoke dims the light
- Shadow sweep: A moving shadow slowly crosses the subject — threat approaching
- Colour temperature shift: Warm to cool (day to night) or cool to warm (fire ignites)
- Practical flicker (neon/sign): Intermittent coloured light pulses on subject

DURATION CONSTRAINTS (STRICT):
You must output instructions that exactly match the scene_plan.duration_seconds.
Motion Format: "[camera motion], while [subject motion], [environment motion]"

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema.`;

router.post('/video-prompts', async (req, res) => {
  try {
    const { scenePlan, scenes: scenesOverride, selectedImages } = req.body;

    // Accept either a full scenePlan or a pre-sliced scenes array (for batching)
    const sourceScenes = scenesOverride || scenePlan?.scenes || [];

    if (sourceScenes.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'No scenes provided — pass either a scenePlan with scenes or a scenes array override.',
        code: 'NO_SCENES'
      });
    }

    const sceneData = sourceScenes.map(scene => {
      const selected = (selectedImages || []).find(img => img.scene_number === scene.scene_number);
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
    const parsed = safeParseJSON(text);

    // Normalise to array — Claude sometimes returns { prompts: [...] } or an object
    let videoPrompts;
    if (Array.isArray(parsed)) {
      videoPrompts = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const candidate = parsed.prompts || parsed.video_prompts || parsed.scenes;
      if (Array.isArray(candidate)) {
        videoPrompts = candidate;
      } else {
        const vals = Object.values(parsed);
        if (vals.length > 0 && vals.every(v => v && typeof v === 'object')) {
          videoPrompts = vals;
        } else {
          return res.status(500).json({
            error: true,
            message: 'LLM returned an object instead of an array for video prompts — could not coerce to array',
            code: 'VIDEO_PROMPTS_NOT_ARRAY',
            raw: parsed
          });
        }
      }
    } else {
      return res.status(500).json({
        error: true,
        message: 'LLM returned unexpected type for video prompts',
        code: 'VIDEO_PROMPTS_NOT_ARRAY'
      });
    }

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

    if (!scenePlan?.scenes) {
      return res.status(400).json({ error: true, message: 'scenePlan.scenes is required', code: 'MISSING_SCENE_PLAN' });
    }
    
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

    if (!scenePlan?.scenes) {
      return res.status(400).json({ error: true, message: 'scenePlan.scenes is required', code: 'MISSING_SCENE_PLAN' });
    }

    let cumulativeTime = 0;
    const sceneTiming = scenePlan.scenes.map(s => {
      const start = cumulativeTime;
      const dur = Number(s.duration_seconds) || 0;  // guard against undefined/NaN
      cumulativeTime += dur;
      return { scene_id: s.scene_id, start_seconds: start, duration: dur };
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
    if (!Array.isArray(prompts)) {
      return res.status(500).json({
        error: true,
        message: 'LLM returned an object instead of an array for thumbnail prompts — could not coerce to array',
        code: 'THUMBNAIL_PROMPTS_NOT_ARRAY',
        raw: prompts
      });
    }
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
