import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '200mb' }));

const apiKeys = {
  fal: process.env.FAL_API_KEY || '',
  replicate: process.env.REPLICATE_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || '',
  elevenlabs: process.env.ELEVENLABS_API_KEY || '',
};

export const getApiKey = (provider) => apiKeys[provider];
export const setApiKey = (provider, key) => {
  apiKeys[provider] = key;
};

const envPath = join(__dirname, '.env');
const saveKeysToEnv = () => {
  const envContent = `FAL_API_KEY=${apiKeys.fal}
REPLICATE_API_KEY=${apiKeys.replicate}
GEMINI_API_KEY=${apiKeys.gemini}
ELEVENLABS_API_KEY=${apiKeys.elevenlabs}
PORT=${PORT}
`;
  fs.writeFileSync(envPath, envContent);
};

app.set('apiKeys', apiKeys);
app.set('saveKeysToEnv', saveKeysToEnv);

import settingsRoutes from './routes/settings.js';
import claudeRoutes from './routes/claude.js';
import imagesRoutes from './routes/images.js';
import videosRoutes from './routes/videos.js';
import thumbnailRoutes from './routes/thumbnail.js';
import exportRoutes from './routes/export.js';
import elevenlabsRoutes from './routes/elevenlabs.js';
import sessionRoutes from './routes/session.js';

app.use('/api/settings', settingsRoutes);
app.use('/api/claude', claudeRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/thumbnail', thumbnailRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/elevenlabs', elevenlabsRoutes);
app.use('/api/session', sessionRoutes);

app.use((err, _req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({ error: true, message: err.message || 'Internal server error', code: 'INTERNAL_ERROR' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
