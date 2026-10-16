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
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const envFile = path.join(ROOT, '.env');
const env = !fs.existsSync(envFile) ? {} : Object.fromEntries(
  fs.readFileSync(envFile, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = env.PIXABAY_API_KEY || env.PEXELS_API_KEY;
const PROVIDER = env.PIXABAY_API_KEY ? 'pixabay' : 'pexels';
// Eigene Bildergalerie (Standard): Ordner aus GALLERY_DIR oder ./gallery. Wird nie ins Repo geladen.
const GALLERY = env.GALLERY_DIR || path.join(ROOT, 'gallery');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' };
const galleryImage = (file) => {
  const f = path.join(GALLERY, file);
  if (!fs.existsSync(f)) throw new Error(`Bild nicht in der Galerie: ${file}`);
  used.add(`g:${file}`);
  // iPhone-Fotos (HEIC) kann der Renderer nicht lesen → einmal per sips nach JPG wandeln
  if (/\.heic$/i.test(f)) {
    const jpg = path.join(ROOT, 'work', `${path.basename(f)}.jpg`);
    fs.mkdirSync(path.dirname(jpg), { recursive: true });
    if (!fs.existsSync(jpg)) execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', '2400', f, '--out', jpg]);
    return { id: file, src: `data:image/jpeg;base64,${fs.readFileSync(jpg).toString('base64')}`, by: 'own', url: '' };
  }
  return { id: file, src: `data:${MIME[path.extname(f).toLowerCase()] || 'image/jpeg'};base64,${fs.readFileSync(f).toString('base64')}`, by: 'own', url: '' };
};

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
    // Slide nennt Galerie-Bilder ("image": "datei.jpg" oder Liste) – sonst Stockfoto-Suche ("query")
    const photos = s.image
      ? [s.image].flat().map(galleryImage)
      : KEY
        ? await photosFor(s.query, s.layout === 'collage' ? 4 : 1)
        : (() => { throw new Error(`Slide ${i + 1} von ${post.id}: weder "image" noch Stockfoto-Schlüssel`); })();
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
