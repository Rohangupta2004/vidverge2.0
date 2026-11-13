/**
 * Vidverge Design System v8.0 (second cut) — gold on black, one main action per
 * screen in gold, each studio marked by its own hue (see components/studioHues.ts).
 *
 * All TypeScript UI tokens originate here. config.json mirrors the same values
 * as --space-* variables for the OS shell. Compatibility aliases remain so
 * older studios adopt v3 without breaking their existing imports.
 */

export const COLORS = {
  bg: 'var(--vg-bg)',
  surface: 'var(--vg-surface)',
  raised: 'var(--vg-raised)',
  hover: 'var(--vg-hover)',
  border: 'var(--vg-border)',
  controlBorder: 'var(--vg-control-border)',
  text: 'var(--vg-text)',
  secondary: 'var(--vg-secondary)',
  muted: 'var(--vg-muted)',
  accent: 'var(--vg-accent)',
  onAccent: 'var(--vg-on-accent)',
  accentHover: 'var(--vg-accent-hover)',
  accentPressed: 'var(--vg-accent-pressed)',
  accentSoft: 'var(--vg-accent-soft)',
  selected: 'var(--vg-selected)',
  selectedSoft: 'var(--vg-selected-soft)',
  onSelected: 'var(--vg-on-selected)',
  bronze: 'var(--vg-bronze)',
  gold: 'var(--vg-gold)',
  btn: 'var(--vg-btn)',
  onBtn: 'var(--vg-on-btn)',
  btnHover: 'var(--vg-btn-hover)',
  btnPressed: 'var(--vg-btn-pressed)',
  credit: 'var(--vg-credit)',
  creditSoft: 'var(--vg-credit-soft)',
  creditInk: 'var(--vg-credit-ink)',
  focus: 'var(--vg-focus)',
  success: 'var(--vg-success)',
  successBg: 'var(--vg-success-bg)',
  warning: 'var(--vg-warning)',
  warningBg: 'var(--vg-warning-bg)',
  danger: 'var(--vg-danger)',
  dangerBg: 'var(--vg-danger-bg)',
  info: 'var(--vg-info)',
  infoBg: 'var(--vg-info-bg)',
  goldBright: 'var(--vg-gold-bright)',
  goldDeep: 'var(--vg-gold-deep)',
  goldTint: 'var(--vg-gold-tint)',
  amber: 'var(--vg-amber)',
  // Timeline tracks stay hex because canvas/SVG painters cannot resolve CSS variables.
  trackVideo: '#F2C14A',
  trackBroll: '#B9820F',
  trackCaptions: '#F6CD62',
  trackText: '#FBF4E2',
  trackMusic: '#8C6A1E',
  trackVoice: '#8E856D',

  // Compatibility names used by existing studios.
  surfaceAlt: 'var(--vg-raised)',
  input: 'var(--vg-bg)',
  buttonSecondary: 'var(--vg-raised)',
  borderHover: 'var(--line-gold)',
  borderInput: 'var(--vg-control-border)',
  primary: 'var(--vg-accent)',
  primaryGlow: 'var(--vg-accent-hover)',
  accentGlow: 'var(--vg-accent-hover)',
  textMuted: 'var(--vg-secondary)',
  textFaint: 'var(--vg-muted)',
  error: 'var(--vg-danger)',
} as const;

export const FONT = {
  heading: 'var(--display)',
  body: 'var(--body)',
  mono: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

export const TYPE = {
  brand: { fontSize: 64, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.045em' },
  appTitle: { fontSize: 32, lineHeight: '38px', fontWeight: 800, letterSpacing: '-0.03em' },
  sectionTitle: { fontSize: 20, lineHeight: '28px', fontWeight: 700, letterSpacing: '-0.015em' },
  cardTitle: { fontSize: 16, lineHeight: '22px', fontWeight: 700, letterSpacing: '-0.01em' },
  body: { fontSize: 14, lineHeight: '22px', fontWeight: 400 },
  compact: { fontSize: 14, lineHeight: '20px', fontWeight: 400 },
  control: { fontSize: 14, lineHeight: '20px', fontWeight: 600 },
  metadata: { fontSize: 12, lineHeight: '16px', fontWeight: 500 },
} as const;

export const RADIUS = { badge: 6, sm: 12, md: 12, card: 14, lg: 14, dialog: 22, xl: 22, brand: 28 } as const;
export const SPACING = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64 } as const;
export const MOTION = {
  fast: '150ms cubic-bezier(.2,.7,.2,1)',
  standard: '180ms cubic-bezier(.2,.7,.2,1)',
  overlay: '240ms cubic-bezier(.2,.8,.2,1)',
} as const;

export const HEADING_TRACKING = '-0.025em';
export const SHADOW = {
  glow: '0 0 0 1px color-mix(in srgb, var(--vg-selected) 26%, transparent)',
  glowCyan: '0 0 0 1px color-mix(in srgb, var(--vg-selected) 26%, transparent)',
  card: 'inset 0 1px 0 rgba(255,236,190,.06), 0 18px 48px rgba(0,0,0,0.4)',
  overlay: '0 24px 70px rgba(0,0,0,.65)',
} as const;
export const MOBILE_BREAKPOINT = 768;
export const CONTENT_MAX_WIDTH = 1280;

// Gold on black: the one main action per screen is the gold gradient (kept as an
// image value so `background:` and `background-image:` consumers both work).
export const GRADIENT = {
  brand: 'var(--molten)',
  action: 'linear-gradient(135deg,#ffefb8 0%,#f2c14a 42%,#c48a12 100%)',
  actionHover: 'linear-gradient(135deg,#fff4cc 0%,#f6cd62 42%,#d39a1a 100%)',
  display: 'var(--molten)',
  surface: 'var(--card-grad)',
  selected: 'linear-gradient(0deg,var(--vg-selected-soft),var(--vg-selected-soft))',
  ambient: 'var(--haze, none)',
  brandSoft: 'var(--molten-soft)',
  beam: 'linear-gradient(0deg,var(--vg-selected),var(--vg-selected))',
  header: 'none',
} as const;

export function alpha(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `color-mix(in srgb, ${hex} ${Math.round(Math.max(0, Math.min(1, amount)) * 100)}%, transparent)`;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, amount))})`;
}

export const CSS_VARS: Record<string, string> = {
  // DARK (gold on black) defaults. The ivory theme overrides live in ui/GlobalStyles.tsx.
  '--vg-bg': '#000000',
  '--vg-surface': '#0f0c08',
  '--vg-raised': '#17130c',
  '--vg-hover': '#1f1a10',
  '--vg-border': '#2a2416',
  '--vg-control-border': '#4a4024',
  '--vg-text': '#fbf4e2',
  '--vg-secondary': '#cfc3a6',
  '--vg-muted': '#8e856d',
  '--vg-accent': '#f2c14a',
  '--vg-on-accent': '#1a1200',
  '--vg-accent-hover': '#f6cd62',
  '--vg-accent-pressed': '#b9820f',
  '--vg-accent-soft': 'rgba(242,193,74,.13)',
  '--vg-selected': '#f2c14a',
  '--vg-selected-soft': 'rgba(242,193,74,.13)',
  '--vg-on-selected': '#f6cd62',
  '--vg-bronze': '#b9820f',
  '--vg-gold': '#f2c14a',
  '--vg-gold-bright': '#f6cd62',
  '--vg-gold-deep': '#b9820f',
  '--vg-gold-tint': 'rgba(242,193,74,.13)',
  '--vg-amber': '#ff7d45',
  '--vg-error': '#ff6b6b',
  '--vg-focus': '#f2c14a',
  '--vg-btn': '#f2c14a',
  '--vg-on-btn': '#1a1200',
  '--vg-btn-hover': '#f6cd62',
  '--vg-btn-pressed': '#b9820f',
  '--vg-credit': '#f2c14a',
  '--vg-credit-soft': 'rgba(242,193,74,.13)',
  '--vg-credit-ink': '#f6cd62',
  '--vg-success': '#35c9b4',
  '--vg-success-bg': 'rgba(53,201,180,.14)',
  '--vg-warning': '#ff7d45',
  '--vg-warning-bg': 'rgba(255,125,69,.15)',
  '--vg-danger': '#ff6b6b',
  '--vg-danger-bg': 'rgba(255,107,107,.14)',
  '--vg-info': '#cfc3a6',
  '--vg-info-bg': 'rgba(255,232,180,.06)',
  '--vg-gradient-brand': GRADIENT.display,
  '--vg-gradient-action': GRADIENT.action,
  '--vg-gradient-action-hover': GRADIENT.actionHover,
  '--vg-gradient-surface': GRADIENT.surface,
  '--vg-gradient-selected': GRADIENT.selected,
  '--vg-gradient-ambient': GRADIENT.ambient,
  '--vg-glow': SHADOW.glow,
  '--vg-space-1': `${SPACING.xxs}px`,
  '--vg-space-2': `${SPACING.xs}px`,
  '--vg-space-3': `${SPACING.sm}px`,
  '--vg-space-4': `${SPACING.md}px`,
  '--vg-space-6': `${SPACING.lg}px`,
  '--vg-space-8': `${SPACING.xl}px`,
  '--vg-space-12': `${SPACING['2xl']}px`,
  '--vg-space-16': `${SPACING['3xl']}px`,
  '--vg-radius-control': `${RADIUS.sm}px`,
  '--vg-radius-card': `${RADIUS.card}px`,
  '--vg-radius-dialog': `${RADIUS.dialog}px`,
  '--vg-elevation-card': SHADOW.card,
  '--vg-elevation-overlay': SHADOW.overlay,
};

export type ThemeColor = keyof typeof COLORS;
export default { COLORS, FONT, TYPE, RADIUS, SPACING, MOTION, SHADOW, GRADIENT, CSS_VARS, alpha };
