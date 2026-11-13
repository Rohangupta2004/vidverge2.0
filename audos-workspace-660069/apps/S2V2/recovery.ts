/**
 * S2V 2.0 — billing and runner recovery, copied unchanged from
 * apps/ScriptToVideo/App.tsx (module-private there). These keep refunds,
 * stalled background runs and tab hand-backs behaving exactly as they do in
 * Script-to-Video, so both apps settle the same rows the same way.
 */
import { db } from '../ScriptToVideo/api';
import type { Film, FilmScene } from '../ScriptToVideo/api';
import { resolveVideoModel } from '../ScriptToVideo/pipeline/videoModelService';
import { RUNNER_MODEL_IDS } from '../ScriptToVideo/runnerModels';
import { refundCreditsStrict, isCreditAuthorizationError } from '../../lib/credits';

export function requiresSignedInVideoTab(film: Film, scenes: FilmScene[]): boolean {
  // Runway, Kling 2.x and Seedance render only while this tab stays open.
  // The durable runner renders every block on the film's one model, so a film
  // that mixes models stays on the tab too.
  const filmModel = resolveVideoModel(film.video_model).id;
  if (!DURABLE_VIDEO_MODEL_IDS.has(filmModel)) return true;
  return scenes.some((scene) => resolveVideoModel((scene.spec as any)?.engine_id || film.video_model).id !== filmModel);
}

/** A film the server finished hands control back to this tab, so a fixed
 * scene can be re-assembled here. Films still rendering are never touched. */
export function reopenForFinish(f: Film): Partial<Film> {
  const background = f.plan?.background;
  if (!f.plan || !background?.enabled || f.status !== 'ready') return {};
  return { plan: { ...f.plan, background: { ...background, enabled: false, stage: 'waiting_for_tab' as const } } };
}

/** Models the server runner (s2v-recovery-sweeper) can drive on its own. */
export const DURABLE_VIDEO_MODEL_IDS = RUNNER_MODEL_IDS;

export const IN_FLIGHT_STATUSES = new Set(['queued', 'submitted', 'processing', 'generating', 'retrying']);
const RUNNER_RESTING_STAGES = new Set(['idle', 'paused', 'cancelled', 'failed', 'ready', 'waiting_for_look', 'waiting_for_tab', 'needs_review']);

/** The durable runner renews its lease on every tick and every provider poll,
 * so a run that should be moving but has no live lease and no tick for 90s has
 * stalled: its dispatch never arrived or its worker died. */
export function backgroundStalled(film: Film): boolean {
  const background = (film.plan?.background || {}) as Record<string, unknown>;
  if (background.enabled !== true || film.status === 'ready' || film.status === 'cancelled') return false;
  if (film.plan?.orchestration?.paused === true || background.review_gate_pending === true) return false;
  if (RUNNER_RESTING_STAGES.has(String(background.stage || ''))) return false;
  if (Date.parse(String(background.lease_until || '')) > Date.now()) return false;
  const lastActivity = Math.max(...[background.last_tick_at, background.started_at, film.updated_at].map((value) => Date.parse(String(value || '')) || 0));
  return Date.now() - lastActivity > 90_000;
}

/**
 * Settle refunds the durable worker recorded while this tab was closed.
 *
 * Reopening a saved project must never be blocked by this: a refund that
 * cannot be confirmed right now stays on the pending list and is settled on
 * the next read, rather than becoming an error banner over a film whose clips
 * are all safe.
 */
export async function settlePendingBackgroundRefunds(film: Film, scenes?: FilmScene[]): Promise<void> {
  const background = film.plan?.background as any;
  if (!film.plan) return;
  const refundScenes = scenes || await db.listScenes(film.id).catch(() => [] as FilmScene[]);
  const pending = Array.isArray(background?.pending_refunds) ? [...background.pending_refunds] : [];
  for (const scene of refundScenes) {
    const billing = ((scene.spec as any)?.background || {}) as Record<string, unknown>;
    const key = String(billing.terminal_refund_pending_key || '');
    if (key && !pending.some((item: any) => String(item?.entryKey || '') === key)) {
      pending.push({ entryKey: key, reason: billing.terminal_refund_error || 'The foreground retry ladder ended before delivery.' });
    }
  }
  if (!pending.length) return;
  const settled: string[] = [];
  for (const item of pending) {
    const key = String(item?.entryKey || '').trim();
    if (!key) continue;
    try {
      await refundCreditsStrict(key, String(item?.reason || 'The background provider failed'));
      settled.push(key);
    } catch (error) {
      if (!isCreditAuthorizationError(error)) throw error;
      // Keep the entry queued; the next reopen or poll settles it.
    }
  }
  if (!settled.length) return;
  for (const scene of refundScenes) {
    const spec = { ...(scene.spec as any) };
    const billing = { ...(spec.background || {}) };
    const key = String(billing.active_credit_key || billing.idempotency_key || '');
    if (!settled.includes(key)) continue;
    spec.background = {
      ...billing,
      terminal_refunded_key: key,
      terminal_refunded_at: new Date().toISOString(),
      terminal_refund_pending_key: undefined,
      terminal_refund_error: undefined,
    };
    await db.updateScene(scene.id, { spec });
    scene.spec = spec;
  }
  const plan = {
    ...film.plan,
    background: {
      ...background,
      pending_refunds: pending.filter((item: any) => !settled.includes(String(item?.entryKey || ''))),
      refunds_reconciled_at: new Date().toISOString(),
    },
  };
  await db.updateFilm(film.id, { plan });
  film.plan = plan;
}

/**
 * A worker can fail after marking a scene generating but before persisting a
 * provider operation id. That state cannot be polled or resumed: leaving it as
 * generating creates an endless spinner. Convert only those operation-less,
 * terminal worker rows into an explicit retryable failure. Completed scenes,
 * stable credit keys and every saved provider operation remain untouched.
 */
export async function reconcileStoppedBackground(film: Film, scenes: FilmScene[]): Promise<void> {
  const background = film.plan?.background as any;
  if (!film.plan) return;
  const workerFailed = background?.stage === 'failed';
  const now = Date.now();
  const stalled = scenes.filter((scene) => {
    if (scene.status !== 'generating' || scene.asset_url) return false;
    const state = (scene.spec as any)?.background || {};
    const hasOperation = Boolean(state.operation_id || state.provider_job_id || scene.veo_operation_id);
    const updatedAt = Date.parse(String(scene.updated_at || ''));
    const foregroundAbandoned = background?.enabled !== true && !hasOperation;
    const staleWithoutOperation = !hasOperation && Number.isFinite(updatedAt) && now - updatedAt > 20 * 60 * 1000;
    return !hasOperation && (workerFailed || foregroundAbandoned || staleWithoutOperation);
  });
  if (!stalled.length) return;
  const message = 'Production stopped before saving a provider operation id. The active scene charge was reconciled at this terminal checkpoint; completed scenes are preserved.';
  let refundPending = false;
  for (const scene of stalled) {
    const currentSpec = { ...(scene.spec as any) };
    const billing = { ...(currentSpec.background || {}) };
    const key = String(billing.active_credit_key || billing.idempotency_key || `stv:film:${film.id}:scene:${scene.id}`);
    try {
      await refundCreditsStrict(key, 'Script-to-Video stopped mid-retry before a provider operation was saved');
      billing.terminal_refunded_key = key;
      billing.terminal_refunded_at = new Date().toISOString();
      billing.terminal_refund_pending_key = undefined;
      billing.terminal_refund_error = undefined;
    } catch (refundError: any) {
      refundPending = true;
      billing.terminal_refund_pending_key = key;
      billing.terminal_refund_error = String(refundError?.message || refundError);
    }
    const spec = {
      ...currentSpec,
      background: {
        ...billing,
        status: 'failed',
        provider_status: 'failed',
        failed_at: new Date().toISOString(),
        last_error: message,
      },
    };
    await db.updateScene(scene.id, { status: 'failed', error: message, spec });
    Object.assign(scene, { status: 'failed' as const, error: message, spec });
  }
  const plan = background
    ? {
        ...film.plan,
        background: {
          ...background,
          stage: 'failed' as const,
          active_scene_id: null,
          lease_owner: null,
          lease_until: null,
          last_error: message,
        },
      }
    : film.plan;
  const terminalNote = refundPending
    ? `${message} The refund is pending and Retry will confirm it before opening a new paid attempt.`
    : `${message} Retry will use a fresh attempt receipt.`;
  const patch: Partial<Film> = { plan, status: 'error', machine_state: 'PROMPT_READY', stage_note: terminalNote, error: message };
  await db.updateFilm(film.id, patch);
  Object.assign(film, patch);
}
