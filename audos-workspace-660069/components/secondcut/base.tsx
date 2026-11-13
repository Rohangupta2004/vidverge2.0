import React, { useEffect } from 'react';
import { MEDIA } from './media';
import { STUDIO_HUES } from '../studioHues';

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  bot: 'M12 8V4H8M4 12a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 14h2M20 14h2M9 13v2M15 13v2',
  film: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 3v18M17 3v18M3 8h4M3 12h18M3 16h4M17 8h4M17 16h4',
  sparkles: 'M10 3l1.9 5.1L17 10l-5.1 1.9L10 17l-1.9-5.1L3 10l5.1-1.9zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9zM19 2v4M17 4h4',
  clapper: 'M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8zM4 11 3.2 7.9a2 2 0 0 1 1.4-2.4l11.6-3.2a2 2 0 0 1 2.5 1.4L19.4 6 4 11zM7.5 4.7l3 4.2M12.4 3.4l3 4.1',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  video: 'M16 10.5 21.2 7a.5.5 0 0 1 .8.4v9.2a.5.5 0 0 1-.8.4L16 13.5M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  flask: 'M10 2v7.5L4.7 18a2 2 0 0 0 1.7 3h11.2a2 2 0 0 0 1.7-3L14 9.5V2M8.5 2h7M7 16h10',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5',
  library: 'M4 4v16M9 4v16M14 6l4 14M4 20h5',
  palette: 'M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3 3h-2.5a2 2 0 0 0-1.5 3.3c.6.7.3 3.7-3 3.7zM7.5 10.5h.01M12 7.5h.01M16.5 10.5h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  chevR: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  chevU: 'M6 15l6-6 6 6',
  play: 'M7 4.5v15l12-7.5z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  coins: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM18.1 10.4A6 6 0 1 1 10.3 18M7 6h1v4M16.7 13.9l.7.7-2.8 2.8',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  menu: 'M4 6h16M4 12h16M4 18h16',
  more: 'M12 12h.01M12 5h.01M12 19h.01',
};

export function Icon({ n, size, style, className }: { n: string; size?: number; style?: React.CSSProperties; className?: string }) {
  return (
    <svg className={'ico ' + (className || '')} viewBox="0 0 24 24" style={{ ...(size ? { width: size, height: size } : {}), ...style }} aria-hidden="true">
      <path d={P[n] || P.sparkles} />
    </svg>
  );
}

/* Brand mark: three gold light trails forming the V wing (vector redraw of the Vidverge logo). */
export const LOGO_D = [0, 7, 14].map((o) => `M2 ${6 + o} C 26 ${4 + o}, 34 ${10 + o}, 42 ${30 + o * 0.5} Q 50 ${58 - o * 0.2} 58 ${30 + o * 0.5} C 66 ${10 + o}, 74 ${4 + o}, 98 ${6 + o}`);

export function Logo({ size = 34 }: { size?: number }) {
  const id = React.useMemo(() => 'vxlg' + Math.random().toString(36).slice(2, 8), []);
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 100 62" aria-hidden="true" style={{ flex: 'none', filter: 'drop-shadow(0 0 6px rgba(255,190,40,.7))' }}>
      <defs><linearGradient id={id} x1="0" x2="1"><stop offset="0" stopColor="#ffab00" /><stop offset=".5" stopColor="#fff0b0" /><stop offset="1" stopColor="#ffa600" /></linearGradient></defs>
      {LOGO_D.map((d, i) => <path key={i} d={d} fill="none" stroke={`url(#${id})`} strokeWidth={3.4 - i * 0.7} strokeLinecap="round" opacity={1 - i * 0.16} />)}
    </svg>
  );
}

export const Guides = () => <span className="guides" aria-hidden="true"><i /><i /><i /><i /></span>;

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ v: T; l?: string; icon?: string }>; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" className={value === o.v ? 'on' : ''} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.icon ? <Icon n={o.icon} size={14} /> : null}{o.l || o.v}
        </button>
      ))}
    </div>
  );
}

export function Modal({ onClose, children, wide, label }: { onClose?: () => void; children: React.ReactNode; wide?: boolean; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={'glass modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={label}>
        {onClose ? <button type="button" className="iconbtn x" onClick={onClose} aria-label="Close"><Icon n="x" /></button> : null}
        {children}
      </div>
    </div>
  );
}

export interface StudioInfo {
  id: string;
  hue: string;
  name: string;
  icon: string;
  tag: string;
  line: string;
  give: string;
  get: string;
  steps: string[];
  img: string;
}

/* The nine studios. `id` is the config.json app id each one opens. */
export const STUDIOS: StudioInfo[] = [
  { id: 'script-to-video', name: 'Script-to-Video', icon: 'clapper', tag: 'Scripts', line: 'Turn an idea or approved script into a complete film.', give: 'A script or a one-line idea', get: 'A scene-by-scene film with the same cast in every shot', steps: ['Paste script', 'Approve cast sheets', 'Approve plan', 'Film is assembled'], img: 'frame_62_b1', hue: '' },
  { id: 'faceless', name: 'Faceless', icon: 'film', tag: 'Shorts', line: 'Narration-first films with timed visuals and captions.', give: 'A topic and a short brief', get: 'A narrated short with timed visuals, captions and music', steps: ['Write the brief', 'Approve narration', 'Pick a voice', 'Render'], img: 'frame_80_b0', hue: '' },
  { id: 'ads-studio', name: 'Vergeye Ads Studio', icon: 'target', tag: 'Intel → Ads', line: 'Research winning ads and build an original campaign.', give: 'A website, product link or company name', get: 'Researched ad angles and a finished campaign video', steps: ['Discover', 'Research', 'Strategize', 'Create', 'Edit'], img: 'frame_68_b2', hue: '' },
  { id: 'ugc-studio', name: 'UGC Studio', icon: 'video', tag: 'Creators', line: 'Creator-led product videos with regional AI actors.', give: 'A product and what is true about it', get: 'A creator-style ad with a regional AI actor', steps: ['Choose actor', 'Add product', 'Approve script', 'Approve price', 'Get clips'], img: 'frame_103_b1', hue: '' },
  { id: 'sceneforge', name: 'SceneForge', icon: 'layers', tag: 'Characters', line: 'Presenter and avatar explainers with voice and captions.', give: 'A script or topic', get: 'A presenter video, fully edited, as one MP4', steps: ['Write script', 'Pick avatar', 'Pick voice', 'Review drafts', 'Render'], img: 'frame_68_b0', hue: '' },
  { id: 'avatar-app', name: 'Avatar App', icon: 'user', tag: 'HeyGen v3', line: 'Avatar production, translation, batches and brand kits.', give: 'A script, photo or audio file', get: 'An avatar video in 9:16, 1:1 or 16:9, plus translation and batches', steps: ['Choose mode', 'Pick look and voice', 'Add script', 'Generate'], img: 'char_79_presenter', hue: '' },
  { id: 'video-enhancer', name: 'Video Enhancer', icon: 'sparkles', tag: 'Editing', line: 'Edit, caption, reframe and polish existing footage.', give: 'Footage you already have', get: 'A polished cut: grade, captions, reframing, cuts', steps: ['Upload video', 'Describe the edit', 'Review before and after', 'Export'], img: 'frame_103_b2', hue: '' },
  { id: 'cineagent', name: 'Studio', icon: 'wand', tag: 'CineAgent', line: 'Upload raw footage and get a finished cut.', give: 'Raw footage up to 50MB', get: 'A finished film the AI directed, edited and reviewed', steps: ['Upload footage', 'Set preferences', 'Agent edits', 'Review the cut'], img: 'frame_62_b0', hue: '' },
  { id: 'video-provider-lab', name: 'Provider Lab', icon: 'flask', tag: 'Models', line: 'One direct shot with Seedance, Kling or Omni Flash.', give: 'One prompt and optional references', get: 'A single clip from the model you choose', steps: ['Pick model', 'Describe the shot', 'Set duration', 'Generate'], img: 'frame_62_b2', hue: '' },
].map((s) => ({ ...s, hue: STUDIO_HUES[s.id] || '#f2c14a' }));

export function studioInfo(id?: string | null): StudioInfo | undefined {
  return STUDIOS.find((s) => s.id === id);
}

export const mediaSrc = (key: string) => MEDIA[key] || '';
