// node build.mjs plans/<datei>.json
// Holt Pixabay- (oder Pexels-)Fotos zu jedem Slide, rendert die Slides (1080×1920 JPG) nach
// posts/<post-id>/NN.jpg und schreibt credits.json. Danach: git add/commit/push,
// die Bilder sind dann unter raw.githubusercontent.com öffentlich erreichbar.
//
// Plan-Format:
// { "posts": [ { "id": "2026-10-18-winter-arc", "caption": "...", "slides": [
//     { "text": "winter arc rules pt. 2", "layout": "collage", "query": "dark gym night" },
//     { "text": "track every single set.", "layout": "app", "app": "coach", "query": "gym bench dark" } ] } ] }
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = env.PIXABAY_API_KEY || env.PEXELS_API_KEY;
const PROVIDER = env.PIXABAY_API_KEY ? 'pixabay' : 'pexels';
if (!KEY) throw new Error('PIXABAY_API_KEY (oder PEXELS_API_KEY) fehlt in .env');

const planFile = process.argv[2];
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const usedFile = path.join(ROOT, 'used-photos.json');
const used = new Set(fs.existsSync(usedFile) ? JSON.parse(fs.readFileSync(usedFile, 'utf8')) : []);

async function pixabay(query, n) {
  const url = `https://pixabay.com/api/?key=${KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&safesearch=true&per_page=60&order=popular`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Pixabay ${r.status} für "${query}"`);
  const j = await r.json();
  const pick = j.hits.filter((p) => !used.has(`px${p.id}`) && p.imageHeight >= 1600).slice(0, Math.max(n * 4, 8));
  pick.sort(() => Math.random() - 0.5);
  const out = pick.slice(0, n);
  if (out.length < n) throw new Error(`Zu wenige neue Fotos für "${query}"`);
  out.forEach((p) => used.add(`px${p.id}`));
  return out.map((p) => ({ id: p.id, src: p.largeImageURL, by: p.user, url: p.pageURL }));
}

async function photosFor(query, n) {
  return PROVIDER === 'pixabay' ? pixabay(query, n) : pexels(query, n);
}

async function pexels(query, n) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=40&size=large`;
  const r = await fetch(url, { headers: { Authorization: KEY } });
  if (!r.ok) throw new Error(`Pexels ${r.status} für "${query}"`);
  const j = await r.json();
  // Dunkle, ruhige Fotos bevorzugen (avg_color), bereits benutzte überspringen
  const lum = (hex) => { const v = parseInt(hex.slice(1), 16); return 0.3 * (v >> 16) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255); };
  const pick = j.photos.filter((p) => !used.has(p.id)).sort((a, b) => lum(a.avg_color || '#808080') - lum(b.avg_color || '#808080')).slice(0, Math.max(n * 3, 6));
  // etwas Zufall, damit gleiche Suchbegriffe nicht immer dasselbe liefern
  pick.sort(() => Math.random() - 0.5);
  const out = pick.slice(0, n);
  if (out.length < n) throw new Error(`Zu wenige neue Fotos für "${query}"`);
  out.forEach((p) => used.add(p.id));
  return out.map((p) => ({ id: p.id, src: `${p.src.original}?auto=compress&cs=tinysrgb&w=1400`, by: p.photographer, url: p.url }));
}

const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.tsx') });

for (const post of plan.posts) {
  const dir = path.join(ROOT, 'posts', post.id);
  fs.mkdirSync(dir, { recursive: true });
  const credits = [];
  for (const [i, s] of post.slides.entries()) {
    const photos = await photosFor(s.query, s.layout === 'collage' ? 4 : 1);
    credits.push(...photos.map((p) => ({ slide: i + 1, photographer: p.by, url: p.url })));
    const app = s.app ? `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'assets/app', `${s.app}.png`)).toString('base64')}` : undefined;
    const output = path.join(dir, `${String(i + 1).padStart(2, '0')}.jpg`);
    const inputProps = { photos: photos.map((p) => p.src), text: s.text, layout: s.layout ?? 'photo', app, position: s.position, size: s.size };
    const composition = await selectComposition({ serveUrl, id: 'Slide', inputProps });
    await renderStill({ composition, serveUrl, output, imageFormat: 'jpeg', jpegQuality: 92, inputProps });
    console.log('ok', post.id, i + 1);
  }
  fs.writeFileSync(path.join(dir, 'credits.json'), JSON.stringify({ caption: post.caption, credits }, null, 2));
  fs.writeFileSync(usedFile, JSON.stringify([...used]));
}
