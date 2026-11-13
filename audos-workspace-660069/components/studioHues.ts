/**
 * Studio colours from the second design. Each studio's hue only marks where you
 * are (nav, accents, step markers); gold stays reserved for the one main action.
 * Keys are config.json app ids. Anything not listed falls back to gold.
 */
export const STUDIO_HUES: Record<string, string> = {
  'script-to-video': '#f4c33c',
  faceless: '#2fc2b0',
  'ads-studio': '#ff7a3c',
  'ugc-studio': '#e0668a',
  sceneforge: '#ffe9b8',
  'avatar-app': '#d08a4a',
  'video-enhancer': '#a78bfa',
  cineagent: '#5bb8ff',
  'video-provider-lab': '#7fe0a8',
};

export const DEFAULT_HUE = '#f2c14a';

export function studioHue(appId?: string | null): string {
  return (appId && STUDIO_HUES[appId]) || DEFAULT_HUE;
}

export function isStudioApp(appId?: string | null): boolean {
  return !!appId && Object.prototype.hasOwnProperty.call(STUDIO_HUES, appId);
}

/** `[data-vv-studio="<id>"]{--hue:<hex>}` rules, so any element tagged with a studio id can read var(--hue). */
export function studioHueCss(): string {
  return Object.entries(STUDIO_HUES)
    .map(([id, hue]) => `[data-vv-studio="${id}"]{--hue:${hue};}`)
    .join('\n');
}
