// Renderer-Test ohne API: App-Screenshot als Hintergrund
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
const bg = `data:image/png;base64,${fs.readFileSync('assets/app/progress.png').toString('base64')}`;
const app = `data:image/png;base64,${fs.readFileSync('assets/app/coach.png').toString('base64')}`;
const serveUrl = await bundle({ entryPoint: new URL('./src/index.tsx', import.meta.url).pathname });
fs.mkdirSync('work', { recursive: true });
{ const inputProps = { photos: [bg], text: "when the guy next to you still writes his sets in a notebook like it's 2009", layout: 'photo', position: 'top' }; await renderStill({ composition: await selectComposition({ serveUrl, id: 'Slide', inputProps }), serveUrl, output: 'work/t1.jpg', imageFormat: 'jpeg', inputProps }); }
{ const inputProps = { photos: [bg], text: 'me letting my app tell me exactly what to lift today', layout: 'app', app }; await renderStill({ composition: await selectComposition({ serveUrl, id: 'Slide', inputProps }), serveUrl, output: 'work/t2.jpg', imageFormat: 'jpeg', inputProps }); }
{ const inputProps = { photos: [bg, bg, bg, bg], text: 'winter arc rules pt. 2', layout: 'collage' }; await renderStill({ composition: await selectComposition({ serveUrl, id: 'Slide', inputProps }), serveUrl, output: 'work/t3.jpg', imageFormat: 'jpeg', inputProps }); }
console.log('done');
