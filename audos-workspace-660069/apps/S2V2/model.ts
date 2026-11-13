/** Shared S2V 2.0 types and small helpers (no React). */
import type { Film, FilmScene } from '../ScriptToVideo/api';
import type { StudioPlan } from '../ScriptToVideo/studioAgent';
import type { Aspect, ClipCheck, Pacing, ShotDirection } from './quality';

export type Screen = 'library' | 'brief' | 'plan' | 'make' | 'finish';
export type Mode = 'idea' | 'script';
export type JobStatus = 'loading' | 'error';

export interface Draft {
  mode: Mode;
  text: string;
  seconds: number;
  aspect: Aspect;
  modelId: string;
  pacing: Pacing;
  narration: boolean;
  /** The script the plan was built from (the idea's generated script, or the creator's own). */
  script: string;
  plan: StudioPlan | null;
  directions: Record<string, ShotDirection>;
  sheetStatus: Record<string, JobStatus>;
  frameStatus: Record<string, JobStatus>;
  /** Pause production when a finished clip looks distorted. */
  autoPause: boolean;
}

export type PlanStepId = 'script' | 'scenes' | 'direction' | 'cast' | 'frames';
export interface PlanProgress {
  active: PlanStepId;
  done: PlanStepId[];
  detail: string;
}

export const PLAN_STEPS: Array<{ id: PlanStepId; label: string }> = [
  { id: 'script', label: 'Write the script' },
  { id: 'scenes', label: 'Break it into clips for the model' },
  { id: 'direction', label: 'Direct every shot: poses, motion, camera' },
  { id: 'cast', label: 'Draw locked character sheets' },
  { id: 'frames', label: 'Draw start frames for new shots' },
];

export const EMPTY_DRAFT: Draft = {
  mode: 'idea',
  text: '',
  seconds: 30,
  aspect: '16:9',
  modelId: 'omni-1.1-flash',
  pacing: 'realistic',
  narration: false,
  script: '',
  plan: null,
  directions: {},
  sheetStatus: {},
  frameStatus: {},
  autoPause: true,
};

const DRAFT_KEY = 's2v2:draft:v1';

export function loadDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return { ...EMPTY_DRAFT };
    const parsed = JSON.parse(raw);
    // Jobs never survive a reload: a spinner from a closed tab would spin forever.
    return { ...EMPTY_DRAFT, ...parsed, sheetStatus: {}, frameStatus: {} };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function saveDraft(draft: Draft): void {
  try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, sheetStatus: {}, frameStatus: {} })); } catch { /* convenience only */ }
}

export function clearDraft(): void {
  try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* convenience only */ }
}

export function orderScenes(scenes: FilmScene[]): FilmScene[] {
  return [...scenes].sort((a, b) => a.idx - b.idx);
}

const RENDERING = new Set(['queued', 'submitted', 'processing', 'generating', 'retrying']);
const DONE = new Set(['completed', 'succeeded', 'skipped']);

export type ClipPhase = 'queued' | 'rendering' | 'done' | 'skipped' | 'failed' | 'review' | 'cancelled';

export function clipPhase(scene: FilmScene): ClipPhase {
  const status = String(scene.status || 'waiting');
  if (status === 'skipped') return 'skipped';
  if (DONE.has(status)) return 'done';
  if (RENDERING.has(status)) return 'rendering';
  if (status === 'failed' || status === 'error') return 'failed';
  if (status === 'needs_review' || status === 'needs_action') return 'review';
  if (status === 'cancelled') return 'cancelled';
  return 'queued';
}

export function isS2V2Film(film: Film): boolean {
  return (film.plan as any)?.studio?.app === 's2v2';
}

export function filmSeconds(film: Film, scenes?: FilmScene[]): number {
  const fromScenes = (scenes || []).reduce((sum, scene) => sum + (Number(scene.duration_s) || 0), 0);
  return Math.round(Number(film.duration_s) || fromScenes || Number((film.plan as any)?.target_duration_sec) || 0);
}

export function savedCheck(scene: FilmScene): ClipCheck | null {
  const check = (scene.validation as any)?.s2v2_qa;
  return check && typeof check === 'object' && check.video_url === scene.asset_url ? (check as ClipCheck) : null;
}

export function fmtSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}
