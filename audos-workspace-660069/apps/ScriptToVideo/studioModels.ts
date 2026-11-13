/**
 * Capabilities the studio planner adapts to, per selectable video model.
 * The ids are the same ones the picker, the browser pipeline and the durable
 * runner (s2v-recovery-sweeper modelConfigById) use; the limits mirror the
 * runner's registry so a planned clip is always a length the model can make.
 */
import type { VideoModelConfig } from './pipeline/videoModelService';
import { pickerDisplayModels } from './modelPicker';
import { RUNNER_MODEL_IDS } from './runnerModels';

export interface StudioModel {
  id: string;
  label: string;
  blurb: string;
  minSeconds: number;
  maxSeconds: number;
  /** Fixed clip lengths (Kling makes only 5 or 10 s). Null = any length in range. */
  durations: number[] | null;
  audio: boolean;
  aspects: string[];
  /** How many reference images one generation accepts. 0 = text only. */
  maxReferences: number;
  /** Renders with the tab closed (durable server runner). */
  durable: boolean;
}

const CAPS: Record<string, Omit<StudioModel, 'id' | 'label' | 'durable'>> = {
  'omni-1.1-flash': { blurb: 'Native dialogue and sound, up to 10 reference images.', minSeconds: 4, maxSeconds: 8, durations: null, audio: true, aspects: ['16:9', '9:16', '1:1'], maxReferences: 10 },
  'kling-3.0-omni': { blurb: 'Strong motion, up to 4 reference images. Silent clips.', minSeconds: 5, maxSeconds: 10, durations: [5, 10], audio: false, aspects: ['16:9', '9:16', '1:1'], maxReferences: 4 },
  'kling-3.0': { blurb: 'Best value, strong motion, one reference image. Silent clips.', minSeconds: 5, maxSeconds: 10, durations: [5, 10], audio: false, aspects: ['16:9', '9:16', '1:1'], maxReferences: 1 },
  'seedance-2.5': { blurb: 'Long clips up to 30s with sound, up to 3 reference images.', minSeconds: 4, maxSeconds: 30, durations: null, audio: true, aspects: ['16:9', '9:16', '1:1'], maxReferences: 3 },
  'seedance-2.0': { blurb: 'Fast clips up to 8s, one reference image.', minSeconds: 4, maxSeconds: 8, durations: null, audio: false, aspects: ['16:9', '9:16', '1:1'], maxReferences: 1 },
};

const LABELS: Record<string, string> = {
  'omni-1.1-flash': 'Gemini Omni Flash',
  'kling-3.0-omni': 'Kling 3.0 Omni',
  'kling-3.0': 'Kling 3.0',
  'seedance-2.5': 'Seedance 2.5',
  'seedance-2.0': 'Seedance 2.0',
};

/** Sensible pre-selection only — the customer can change it any time. */
export const PRESELECTED_MODEL_ID = 'omni-1.1-flash';

function fromConfig(config: VideoModelConfig): StudioModel {
  const anyConfig = config as unknown as Record<string, unknown>;
  const id = String(anyConfig.id || '');
  const caps = CAPS[id] || {
    blurb: '',
    minSeconds: Number(anyConfig.minDuration || anyConfig.minSeconds || 4),
    maxSeconds: Number(anyConfig.safeMaxDuration || anyConfig.maxSeconds || 8),
    durations: null,
    audio: anyConfig.audioSupported === true,
    aspects: ['16:9', '9:16', '1:1'],
    maxReferences: Number(anyConfig.maxReferenceImages || anyConfig.maxReferences || 1),
  };
  return {
    id,
    label: LABELS[id] || String(anyConfig.label || anyConfig.displayName || anyConfig.name || id),
    durable: RUNNER_MODEL_IDS.has(id),
    ...caps,
  };
}

export function studioModels(): StudioModel[] {
  let configs: VideoModelConfig[] = [];
  try { configs = pickerDisplayModels(); } catch { configs = []; }
  const list = configs.map(fromConfig).filter((m) => m.id);
  const ids = new Set(list.map((m) => m.id));
  ['omni-1.1-flash', 'kling-3.0-omni', 'kling-3.0', 'seedance-2.5'].forEach((id) => {
    if (!ids.has(id)) list.push({ id, label: LABELS[id], durable: RUNNER_MODEL_IDS.has(id), ...CAPS[id] });
  });
  const order = ['omni-1.1-flash', 'kling-3.0-omni', 'kling-3.0', 'seedance-2.5'];
  const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? 99 : i; };
  return list.sort((a, b) => rank(a.id) - rank(b.id));
}

export function studioModelById(id: string | null | undefined): StudioModel {
  const all = studioModels();
  return all.find((m) => m.id === id) || all.find((m) => m.id === PRESELECTED_MODEL_ID) || all[0];
}

/** The nearest clip length this model can actually render. */
export function legalSeconds(model: StudioModel, seconds: number): number {
  const wanted = Math.max(1, Math.round(Number(seconds) || model.maxSeconds));
  if (model.durations && model.durations.length) {
    for (const step of model.durations) if (step >= wanted) return step;
    return model.durations[model.durations.length - 1];
  }
  return Math.max(model.minSeconds, Math.min(model.maxSeconds, wanted));
}

const LAST_MODEL_KEY = 's2v:studio:last-model';

export function rememberedModelId(): string {
  try { return localStorage.getItem(LAST_MODEL_KEY) || PRESELECTED_MODEL_ID; } catch { return PRESELECTED_MODEL_ID; }
}

export function rememberModelId(id: string): void {
  try { localStorage.setItem(LAST_MODEL_KEY, id); } catch { /* preference only */ }
}
