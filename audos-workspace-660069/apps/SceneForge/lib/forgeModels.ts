/** The Remotion agent's primary model, as accepted by /proxy/anthropic/v1/messages. */
export const FORGE_OPUS_MODEL = 'claude-opus-5-5';
/** Projects saved before the Opus 5.5 switch still carry this id. */
export const LEGACY_FORGE_OPUS_MODEL = 'claude-opus-5';
export const FORGE_FALLBACK_MODEL = 'gpt-6.1-sol';

export type ForgeOpusModel = typeof FORGE_OPUS_MODEL | typeof LEGACY_FORGE_OPUS_MODEL;

export const FORGE_OPUS_LABEL = 'Claude Opus 5.5';

export function isForgeOpusModel(model: unknown): model is ForgeOpusModel {
  return model === FORGE_OPUS_MODEL || model === LEGACY_FORGE_OPUS_MODEL;
}

/** Display name for a stored model id; legacy Opus 5 projects keep their original label. */
export function forgeOpusLabel(model: unknown): string {
  return model === LEGACY_FORGE_OPUS_MODEL ? 'Claude Opus 5' : FORGE_OPUS_LABEL;
}

/** Display name for any model id recorded in the per-role model log. */
export function forgeModelName(model: unknown): string {
  const id = String(model || '');
  if (!id) return 'Unknown model';
  if (isForgeOpusModel(id)) return forgeOpusLabel(id);
  if (id === FORGE_FALLBACK_MODEL) return 'GPT 6.1 Sol';
  if (id === 'deterministic-guided-fallback') return 'Template (no AI model)';
  const gemini = id.match(/^gemini-([\d.]+)-(pro|flash)/i);
  if (gemini) return `Gemini ${gemini[1]} ${gemini[2].charAt(0).toUpperCase()}${gemini[2].slice(1).toLowerCase()}`;
  if (/^gemini/i.test(id)) return 'Gemini vision';
  return id;
}
