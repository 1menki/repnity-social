import { useEffect, useState } from 'react';
import { AbsoluteFill, Composition, continueRender, delayRender, Img, registerRoot } from 'remotion';

/**
 * Ein TikTok-Slide im Stil des Accounts: dunkles Foto im Vollbild, weißer
 * TikTok-Text mit weichem Schatten. Varianten: Collage aus 4 Fotos, oder ein
 * echter Repnity-Screenshot auf einem Handy über dem abgedunkelten Foto.
 */
export type SlideProps = {
  photos: string[]; // 1 Foto, bei layout "collage" 4
  text: string;
  layout: 'photo' | 'collage' | 'app';
  /** Bei layout "app": Screenshot-URL */
  app?: string;
  /** Textposition: oben (Hook), mitte, unten */
  position?: 'top' | 'middle' | 'bottom';
  size?: number;
};

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=TikTok+Sans:wght@500;600&display=block';

function useFont() {
  const [handle] = useState(() => delayRender('TikTok Sans'));
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_CSS;
    document.head.appendChild(link);
    link.onload = () => document.fonts.load('600 60px "TikTok Sans"').then(() => document.fonts.ready).then(() => continueRender(handle));
    link.onerror = () => continueRender(handle);
  }, [handle]);
}

const textStyle = (size: number): React.CSSProperties => ({
  fontFamily: '"TikTok Sans", "Proxima Nova", -apple-system, sans-serif',
  fontWeight: 600,
  fontSize: size,
  lineHeight: 1.22,
  color: '#FFFFFF',
  textAlign: 'center',
  letterSpacing: -0.2,
  textShadow: '0 0 3px rgba(0,0,0,0.85), 0 2px 10px rgba(0,0,0,0.55)',
  whiteSpace: 'pre-wrap',
});

export function Slide({ photos, text, layout, app, position = 'middle', size = 66 }: SlideProps) {
  useFont();
  const top = position === 'top' ? 360 : position === 'bottom' ? 1300 : 760;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {layout === 'collage' ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8, padding: '0' }}>
          {photos.slice(0, 4).map((p) => (
            <Img key={p} src={p} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.82) saturate(0.85)' }} />
          ))}
        </div>
      ) : (
        <Img src={photos[0]} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: layout === 'app' ? 'brightness(0.45) blur(6px) saturate(0.8)' : 'brightness(0.78) saturate(0.85)' }} />
      )}
      {/* Korn wie bei iPhone-Fotos in schwachem Licht */}
      <AbsoluteFill style={{ opacity: 0.09, mixBlendMode: 'overlay' }}>
        <svg width="100%" height="100%">
          <filter id="g">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={photos[0].length % 9} />
          </filter>
          <rect width="100%" height="100%" filter="url(#g)" />
        </svg>
      </AbsoluteFill>
      {layout === 'app' && app ? (
        <div
          style={{
            position: 'absolute',
            left: 540 - 290,
            top: 640,
            width: 580,
            height: 1260,
            borderRadius: 78,
            padding: 14,
            background: 'linear-gradient(145deg, #2b2f38, #0d0f13 45%, #1c2028)',
            boxShadow: '0 50px 120px rgba(0,0,0,0.7)',
            transform: 'rotate(-4deg)',
          }}
        >
          <Img src={app} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', borderRadius: 66 }} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 90, right: 90, top: layout === 'app' ? 250 : layout === 'collage' ? 900 : top, transform: layout === 'collage' ? 'translateY(-50%)' : undefined }}>
        <div style={textStyle(layout === 'collage' ? size + 6 : size)}>{text}</div>
      </div>
    </AbsoluteFill>
  );
}

registerRoot(() => (
  <Composition
    id="Slide"
    component={Slide}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={1}
    defaultProps={{ photos: ['https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg'], text: 'winter arc rules.', layout: 'photo' } as SlideProps}
  />
));
