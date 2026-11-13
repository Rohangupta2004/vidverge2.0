/**
 * S2V 2.0 — Script-to-Video, rebuilt around consistent, undistorted motion.
 *
 *   Brief → Plan (script, clips paced for clean motion, every shot directed,
 *   locked character sheets, start frames) → Make (the existing durable
 *   runner or the signed-in tab, each clip checked as it lands) → Finish
 *   (the existing assembly).
 *
 * The production pipeline is Script-to-Video's own, unchanged: the same
 * WorkspaceDB rows (s2v_films / s2v_film_scenes), the same stv-scene-generate
 * Start and s2v-recovery-sweeper runner, the same credit receipts, refunds and
 * frame chaining, and the same assembly. Films made here open in the classic
 * app too. What changes is what each clip is asked to render (./quality) and
 * the screens (./screens).
 */
import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { withBrandContext } from '../../components/BrandContextLayer';
import { db, generateOpenAiImage } from '../ScriptToVideo/api';
import type { Film, FilmScene, StoredReference } from '../ScriptToVideo/api';
import {
  breakdownScript, deterministicBreakdown, ensureCast, fitScenesToModel, ideaToScript, linkCastToScenes, linkSavedCharacters,
} from '../ScriptToVideo/studioAgent';
import type { PlanOptions, StudioCharacter, StudioPlan } from '../ScriptToVideo/studioAgent';
import { studioModelById, studioModels } from '../ScriptToVideo/studioModels';
import type { StudioModel } from '../ScriptToVideo/studioModels';
import { createStudioFilm } from '../ScriptToVideo/studioFilm';
import type { ScriptVersion } from '../ScriptToVideo/studioFilm';
import {
  allScenesDone, autoPostProduce, autoProduce, generateScene, prepareFilmAudioStage, readyToAutoAssemble, retryScene, runFinalAssembly,
} from '../ScriptToVideo/pipeline/orchestrator';
import type { AssemblyProgress, RunHooks } from '../ScriptToVideo/pipeline/orchestrator';
import { audioReady } from '../ScriptToVideo/pipeline/audio';
import { VideoModelService } from '../ScriptToVideo/pipeline/videoModelService';
import { DEFAULT_OPENAI_VOICE, loadOpenAiVoicePref } from '../ScriptToVideo/pipeline/voiceSource';
import type { VoiceSourceId } from '../ScriptToVideo/pipeline/voiceSource';
import { callS2vHook as callHook, friendlyErrorMessage } from '../ScriptToVideo/friendlyErrors';
import { acquireCreditAuthorization, requireVerifiedCreditSession } from '../../lib/credits';
import { saveVideoToHistory } from '../../lib/videoHistory';
import {
  assembleClipPrompt, characterSheetPrompt, checkClip, contextFromPlan, directShots, drawStartFrame, estimateCredits,
  needsStartFrame, pacedModel, shotInputsFromPlan,
} from './quality';
import type { Aspect, ClipCheck, DirectorContext, ShotDirection, ShotInput } from './quality';
import {
  IN_FLIGHT_STATUSES, backgroundStalled, reconcileStoppedBackground, reopenForFinish, requiresSignedInVideoTab,
  settlePendingBackgroundRefunds,
} from './recovery';
import { EMPTY_DRAFT, clipPhase, clearDraft, isS2V2Film, loadDraft, orderScenes, saveDraft, savedCheck } from './model';
import type { Draft, PlanProgress, PlanStepId, Screen } from './model';
import { BriefScreen, FinishScreen, LibraryScreen, MakeScreen, Modal, PlanScreen, TopBar } from './screens';
import { S2_CSS } from './theme';

type Confirm =
  | { kind: 'approve' }
  | { kind: 'rerender'; scene: FilmScene }
  | { kind: 'stop' }
  | { kind: 'delete'; film: Film };

const friendly = (value: unknown) => friendlyErrorMessage(value);
const now = () => new Date().toISOString();

async function mapLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const worker = async () => { while (cursor < items.length) { const item = items[cursor++]; await task(item); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** Script-to-Video's planner without its field-prompt pass: S2V 2.0 directs every shot itself. */
async function planClips(script: string, opts: PlanOptions): Promise<StudioPlan> {
  const notes: string[] = [];
  let base: Omit<StudioPlan, 'model_id' | 'planned_at' | 'notes'>;
  try {
    base = await breakdownScript(script, opts);
  } catch {
    base = { title: 'Untitled film', logline: '', visual_style: '', world: '', characters: [], scenes: deterministicBreakdown(script).scenes };
    notes.push('The planner was busy, so clips were split straight from your script. Plan again any time.');
  }
  linkSavedCharacters(base, opts.savedCharacters, script);
  ensureCast(base);
  linkCastToScenes(base);
  const fitted = fitScenesToModel(base.scenes, opts.model);
  base.scenes = fitted.scenes;
  notes.push(...fitted.notes);
  return { ...base, model_id: opts.model.id, planned_at: now(), notes };
}

function withPrompts(plan: StudioPlan, directions: Record<string, ShotDirection>, model: StudioModel, aspect: Aspect): StudioPlan {
  const ctx = contextFromPlan(plan, model, aspect);
  return {
    ...plan,
    scenes: plan.scenes.map((scene) => {
      const direction = directions[scene.key];
      if (!direction) return scene;
      return { ...scene, prompt: assembleClipPrompt({ direction, input: { characters: scene.characters, summary: scene.summary, script: scene.script_segment }, ctx, dialogue: scene.dialogue }) };
    }),
  };
}

/** Director context for a saved film (re-render path). */
function contextFromFilm(film: Film, avoid?: string, previousEndPose?: string): DirectorContext {
  const plan: any = film.plan || {};
  const model = studioModelById(film.video_model);
  return {
    title: film.title || plan.title || 'Untitled film',
    logline: String(plan.story_summary || ''),
    style: String(plan.visual_style || plan.style_direction || ''),
    world: String(plan.world || ''),
    cast: (Array.isArray(plan.characters) ? plan.characters : [])
      .filter((c: any) => c && c.kind !== 'narrator')
      .map((c: any) => ({ id: String(c.id), name: String(c.name || c.id), appearance: [c.age_appearance, c.appearance].filter(Boolean).join('; '), wardrobe: String(c.wardrobe || '') })),
    modelId: model.id,
    modelLabel: model.label,
    audio: model.audio && plan.characters_speak === true,
    aspect: (film.aspect_ratio || '16:9') as Aspect,
    avoid,
    previousEndPose,
  };
}

function inputFromRow(scene: FilmScene): ShotInput {
  const spec: any = scene.spec || {};
  const prior: ShotDirection | undefined = spec.s2v2_direction;
  return {
    key: scene.scene_key,
    index: scene.idx,
    duration: Math.max(1, Math.round(Number(scene.duration_s) || 8)),
    continuous: scene.idx > 0 && spec.cut_type === 'continuous',
    title: String(spec.studio_title || spec.summary || `Clip ${scene.idx + 1}`),
    summary: String(spec.summary || spec.visual_goal || ''),
    script: String(scene.script_segment || ''),
    characters: Array.isArray(spec.characters) ? spec.characters.map(String) : [],
    speakers: scene.dialogue?.line && (scene.dialogue as any).kind !== 'narrator' && scene.dialogue.speaker ? [String(scene.dialogue.speaker)] : [],
    camera: prior?.camera || '',
    motionHint: prior?.motion_sequence || String(spec.visual_goal || ''),
  };
}

function voiceSourceFor(film: Film | null): VoiceSourceId {
  if (!film) return 'none';
  if (film.audio) return (film.audio.voice_source || 'elevenlabs') as VoiceSourceId;
  return film.plan?.narration_enabled === true ? 'elevenlabs' : 'none';
}

function S2V2App() {
  const [screen, setScreen] = useState<Screen>('library');
  const [draft, setDraftState] = useState<Draft>(() => loadDraft());
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [planError, setPlanError] = useState('');
  const [films, setFilms] = useState<Film[]>([]);
  const [libLoading, setLibLoading] = useState(true);
  const [film, setFilm] = useState<Film | null>(null);
  const [scenes, setScenes] = useState<FilmScene[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [assembly, setAssembly] = useState<AssemblyProgress | null>(null);
  const [checks, setChecks] = useState<Record<number, ClipCheck>>({});
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [holdSceneId, setHoldSceneId] = useState<number | null>(null);
  const [stalled, setStalled] = useState(false);
  const [tabActive, setTabActive] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const models = useMemo(() => studioModels(), []);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const engineFilm = useRef<Film | null>(null);
  const engineScenes = useRef<FilmScene[]>([]);
  const running = useRef(false);
  const planRun = useRef(0);
  const savedRefs = useRef<StoredReference[]>([]);
  const tabRun = useRef(false);
  const holdRef = useRef<number | null>(null);
  holdRef.current = holdSceneId;
  const postKickedFor = useRef<number | null>(null);
  const assembleKickedFor = useRef<number | null>(null);
  const runnerKickAt = useRef(0);
  const recordedUrls = useRef<Set<string>>(new Set());
  const checkedUrls = useRef<Set<string>>(new Set());
  const openaiVoice = useRef(loadOpenAiVoicePref() || DEFAULT_OPENAI_VOICE);

  const hooks = useRef<RunHooks>({
    onFilm: (patch) => setFilm((f) => (f ? { ...f, ...patch } : f)),
    onScene: (id, patch) => setScenes((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    onNote: (text) => setNote(text),
    onAssembly: (p) => setAssembly(p),
  }).current;

  const setDraft = (update: Partial<Draft> | ((current: Draft) => Draft)) => {
    setDraftState((current) => {
      const next = typeof update === 'function' ? update(current) : { ...current, ...update };
      draftRef.current = next;
      return next;
    });
  };
  useEffect(() => { saveDraft(draft); }, [draft]);

  function adopt(f: Film, list: FilmScene[]) {
    if (f.final_video_url) recordedUrls.current.add(String(f.final_video_url));
    engineFilm.current = f;
    engineScenes.current = list;
    setFilm({ ...f });
    setScenes(list.map((s) => ({ ...s })));
  }

  /** One pipeline operation at a time, with the error shown in plain words. */
  async function run(work: () => Promise<void>): Promise<boolean> {
    if (running.current) { setNote('Another step is still finishing — try again in a moment.'); return false; }
    running.current = true;
    setBusy(true);
    setError('');
    try { await work(); return true; }
    catch (e) { setError(friendly(e)); return false; }
    finally { running.current = false; setBusy(false); }
  }

  // ---------------------------------------------------------------- library

  async function loadLibrary() {
    setLibLoading(true);
    try {
      const stored = window.localStorage.getItem('space_session_workspace-660069');
      const session = stored ? JSON.parse(stored) : null;
      if (session?.authorized === true && session?.identityMode === 'email_registration') {
        // Same rule as Script-to-Video: email-only sessions cannot read private rows from the browser.
        setFilms([]); setLibLoading(false); return;
      }
    } catch { /* normal path */ }
    try { setFilms(await db.listFilms()); }
    catch (e) { const message = String((e as Error)?.message || e); if (!/verified session|required for private/i.test(message)) setError(friendly(e)); }
    finally { setLibLoading(false); }
  }
  useEffect(() => { void loadLibrary(); void acquireCreditAuthorization(); }, []);

  async function openFilm(f: Film) {
    setError(''); setNote(''); setAssembly(null); setStalled(false); setHoldSceneId(null); setChecks({});
    postKickedFor.current = null; assembleKickedFor.current = null;
    await acquireCreditAuthorization();
    try {
      const list = await db.listScenes(f.id);
      const interrupted = f.plan?.background?.enabled !== true && f.status === 'assembling' && f.machine_state === 'FFMPEG_ASSEMBLY' && !f.final_video_url;
      if (interrupted) {
        const recovery: Partial<Film> = { status: 'producing', machine_state: audioReady(f.audio) ? 'AUDIO_READY' : 'ALL_SCENES_COMPLETED', stage_note: 'The previous assembly was interrupted — resuming from the saved clips.', error: null };
        await db.updateFilm(f.id, recovery);
        Object.assign(f, recovery);
      }
      try { await reconcileStoppedBackground(f, list); await settlePendingBackgroundRefunds(f, list); }
      catch (e) { setError(friendly(e)); }
      adopt(f, list);
      if (f.plan?.background?.enabled && f.plan.background.stage !== 'failed' && f.status !== 'ready' && f.status !== 'cancelled') {
        void callHook('s2v-recovery-sweeper', { op: 'tick', film_id: f.id, chain_id: f.plan.background.chain_id, source: 'creator-reopen' }).catch(() => undefined);
      }
      if (allScenesDone(list)) {
        setScreen('finish');
        if (!f.plan?.background?.enabled && !f.final_video_url && !f.error) void run(() => finishIfReady());
      } else setScreen('make');
    } catch (e) { setError(friendly(e)); }
  }

  function confirmDelete(f: Film) { setConfirm({ kind: 'delete', film: f }); }
  async function deleteFilm(f: Film) {
    setConfirm(null);
    const previous = films;
    setFilms((list) => list.filter((x) => x.id !== f.id));
    try { await db.deleteFilm(f.id); } catch (e) { setError(friendly(e)); setFilms(previous); }
  }

  // ---------------------------------------------------------------- planning

  async function handlePlan() {
    const runId = ++planRun.current;
    const stale = () => planRun.current !== runId;
    const d = draftRef.current;
    const model = studioModelById(d.modelId);
    const paced = pacedModel(model, d.pacing);
    const done: PlanStepId[] = [];
    const step = (active: PlanStepId, detail: string) => { if (!stale()) setProgress({ active, done: [...done], detail }); };
    setPlanError('');
    setScreen('plan');
    try {
      step('script', d.mode === 'idea' ? 'Writing a full script from your idea…' : 'Reading your script…');
      const saved = await db.listReferences().catch(() => [] as StoredReference[]);
      savedRefs.current = saved;
      const savedCharacters: StudioCharacter[] = saved
        .filter((r) => r.type === 'character' || !r.type)
        .map((r) => ({ id: r.name, name: r.display_name || r.name, appearance: r.description || '', wardrobe: '', mention: r.name, imageUrl: r.url }));
      const script = d.mode === 'idea' ? await ideaToScript(d.text, { aspect: d.aspect, targetSeconds: d.seconds, model: paced }) : d.text.trim();
      if (stale()) return;
      done.push('script');
      step('scenes', `Splitting it into clips for ${model.label}${d.pacing === 'realistic' ? `, at most ${paced.maxSeconds}s each so the motion stays clean` : ''}…`);
      const base = await planClips(script, { aspect: d.aspect, targetSeconds: d.seconds, model: paced, savedCharacters });
      if (stale()) return;
      done.push('scenes');
      step('direction', `Directing ${base.scenes.length} shots: start pose, timed motion, end pose, camera…`);
      const directions = await directShots(shotInputsFromPlan(base), contextFromPlan(base, model, d.aspect), (n, total) => step('direction', `Directed ${n} of ${total} shots…`));
      if (stale()) return;
      done.push('direction');
      const plan = withPrompts(base, directions, model, d.aspect);
      setDraft((current) => ({ ...current, script, plan, directions, sheetStatus: {}, frameStatus: {} }));
      setProgress(null);
      // Sheets, then start frames, fill in on the plan screen while the creator reads it.
      const withSheets = await drawSheets(plan, plan.characters.filter((c) => !c.imageUrl).map((c) => c.id), runId);
      if (stale() || !withSheets) return;
      await drawFrames(withSheets, plan.scenes.filter((s, i) => needsStartFrame(s, i, model.id)).map((s) => s.key), runId);
    } catch (e) {
      if (stale()) return;
      setProgress(null);
      setPlanError(friendly(e));
    }
  }

  /** Draw locked sheets for these characters; returns the plan with every sheet that landed. */
  async function drawSheets(plan: StudioPlan, ids: string[], runId = planRun.current): Promise<StudioPlan | null> {
    const urls: Record<string, string> = {};
    setDraft((current) => ({ ...current, sheetStatus: { ...current.sheetStatus, ...Object.fromEntries(ids.map((id) => [id, 'loading' as const])) } }));
    await mapLimit(ids, 2, async (id) => {
      const character = plan.characters.find((c) => c.id === id);
      if (!character) return;
      try {
        const url = await generateOpenAiImage(characterSheetPrompt(character, plan), '1:1', 'premium');
        urls[id] = url;
        if (planRun.current !== runId) return;
        setDraft((current) => {
          if (!current.plan) return current;
          const status = { ...current.sheetStatus }; delete status[id];
          return { ...current, sheetStatus: status, plan: { ...current.plan, characters: current.plan.characters.map((c) => (c.id === id ? { ...c, imageUrl: url } : c)) } };
        });
      } catch {
        if (planRun.current === runId) setDraft((current) => ({ ...current, sheetStatus: { ...current.sheetStatus, [id]: 'error' } }));
      }
    });
    if (planRun.current !== runId) return null;
    return { ...plan, characters: plan.characters.map((c) => (urls[c.id] ? { ...c, imageUrl: urls[c.id] } : c)) };
  }

  /** Draw start frames for these shots from the plan's current sheets. Failures never block. */
  async function drawFrames(plan: StudioPlan, keys: string[], runId = planRun.current): Promise<void> {
    const d = draftRef.current;
    const ready = keys.filter((key) => {
      const scene = plan.scenes.find((s) => s.key === key);
      return scene && d.directions[key] && scene.characters.every((id) => plan.characters.find((c) => c.id === id)?.imageUrl);
    });
    if (!ready.length) return;
    setDraft((current) => ({ ...current, frameStatus: { ...current.frameStatus, ...Object.fromEntries(ready.map((key) => [key, 'loading' as const])) } }));
    await mapLimit(ready, 2, async (key) => {
      const scene = plan.scenes.find((s) => s.key === key)!;
      try {
        const url = await drawStartFrame({ direction: draftRef.current.directions[key], scene, cast: plan.characters, style: plan.visual_style, aspect: d.aspect });
        if (planRun.current !== runId) return;
        setDraft((current) => {
          if (!current.plan) return current;
          const status = { ...current.frameStatus }; delete status[key];
          return { ...current, frameStatus: status, plan: { ...current.plan, scenes: current.plan.scenes.map((s) => (s.key === key ? { ...s, storyboard_url: url, storyboard_status: 'ready' as const } : s)) } };
        });
      } catch {
        if (planRun.current === runId) setDraft((current) => ({ ...current, frameStatus: { ...current.frameStatus, [key]: 'error' } }));
      }
    });
  }

  async function redrawSheet(id: string) {
    const plan = draftRef.current.plan;
    if (!plan) return;
    const updated = await drawSheets(plan, [id]);
    const model = studioModelById(draftRef.current.modelId);
    // Start frames drawn from the old sheet no longer match: redraw them too.
    if (updated) await drawFrames(updated, updated.scenes.filter((s, i) => s.characters.includes(id) && needsStartFrame(s, i, model.id)).map((s) => s.key));
  }

  async function uploadSheet(id: string, file: File) {
    setDraft((current) => ({ ...current, sheetStatus: { ...current.sheetStatus, [id]: 'loading' } }));
    try {
      const url = await VideoModelService.uploadReference(file, file.name);
      setDraft((current) => {
        if (!current.plan) return current;
        const status = { ...current.sheetStatus }; delete status[id];
        return { ...current, sheetStatus: status, plan: { ...current.plan, characters: current.plan.characters.map((c) => (c.id === id ? { ...c, imageUrl: url } : c)) } };
      });
      const plan = draftRef.current.plan;
      const model = studioModelById(draftRef.current.modelId);
      if (plan) await drawFrames(plan, plan.scenes.filter((s, i) => s.characters.includes(id) && needsStartFrame(s, i, model.id)).map((s) => s.key));
    } catch (e) {
      setDraft((current) => ({ ...current, sheetStatus: { ...current.sheetStatus, [id]: 'error' } }));
      setPlanError(friendly(e));
    }
  }

  async function redrawFrame(key: string) {
    const plan = draftRef.current.plan;
    if (plan) await drawFrames(plan, [key]);
  }

  /** Save edited direction; a changed end pose also becomes the next continuing clip's start pose. */
  function editDirection(key: string, patch: Partial<ShotDirection>) {
    setDraft((current) => {
      if (!current.plan) return current;
      const model = studioModelById(current.modelId);
      const directions = { ...current.directions, [key]: { ...current.directions[key], ...patch } };
      const index = current.plan.scenes.findIndex((s) => s.key === key);
      const next = current.plan.scenes[index + 1];
      if (patch.pose_end && next && next.cut_type === 'continuous' && directions[next.key]) directions[next.key] = { ...directions[next.key], pose_start: patch.pose_end };
      return { ...current, directions, plan: withPrompts(current.plan, directions, model, current.aspect) };
    });
  }

  async function redirectShot(key: string) {
    const d = draftRef.current;
    if (!d.plan) return;
    const model = studioModelById(d.modelId);
    const inputs = shotInputsFromPlan(d.plan);
    const index = inputs.findIndex((input) => input.key === key);
    if (index < 0) return;
    const previous = index > 0 ? d.directions[inputs[index - 1].key]?.pose_end : '';
    await run(async () => {
      const got = await directShots([inputs[index]], { ...contextFromPlan(d.plan!, model, d.aspect), previousEndPose: previous });
      const direction = got[key];
      if (!direction?.complete) throw new Error('That shot could not be re-directed right now. Please try again.');
      editDirection(key, direction);
    });
  }

  // ---------------------------------------------------------------- production

  async function approveAndMake() {
    setConfirm(null);
    const d = draftRef.current;
    const plan = d.plan;
    if (!plan) return;
    const model = studioModelById(d.modelId);
    await run(async () => {
      setNote('Saving your plan…');
      const version: ScriptVersion = { id: `v_${Date.now().toString(36)}`, kind: d.mode === 'idea' ? 'improved' : 'original', label: d.mode === 'idea' ? 'Written from your idea' : 'Your script', text: d.script, created_at: now() };
      const created = await createStudioFilm({
        plan, model, aspect: d.aspect, targetSeconds: d.seconds, versions: [version], activeVersionId: version.id,
        idea: d.mode === 'idea' ? d.text : '', projectRefs: [], attachStoryboard: true, narration: d.narration, savedRefs: savedRefs.current,
        extraStudio: { app: 's2v2', s2v2: { version: 1, pacing: d.pacing, auto_pause: d.autoPause } },
      });
      // Real timed beats and the directed shot on every saved clip.
      const rows = orderScenes(await db.listScenes(created.id));
      const specByKey: Record<string, any> = {};
      for (const row of rows) {
        const direction = d.directions[row.scene_key];
        if (!direction) continue;
        const spec: any = { ...(row.spec as any) };
        const firstBeat = Array.isArray(spec.timed_beats) ? spec.timed_beats[0] || {} : {};
        spec.timed_beats = direction.beats.map((beat, i) => ({ start_s: beat.start_s, end_s: beat.end_s, action: beat.action, camera: direction.camera, ...(i === 0 && firstBeat.dialogue ? { dialogue: firstBeat.dialogue } : {}) }));
        spec.s2v2_direction = direction;
        spec.prompt_source = 'studio';
        await db.updateScene(row.id, { spec });
        row.spec = spec;
        specByKey[row.scene_key] = spec;
      }
      let fresh = (await db.getFilm(created.id)) || created;
      if (fresh.plan?.scenes) {
        const planPatch = {
          ...fresh.plan,
          scenes: fresh.plan.scenes.map((s) => (specByKey[s.scene_key] ? { ...s, spec: specByKey[s.scene_key] } : s)),
          // Approving a plan that shows "no people on screen" is the cast review.
          ...(!(fresh.character_refs || []).length ? { cast_reviewed: true } : {}),
        };
        await db.updateFilm(fresh.id, { plan: planPatch });
        fresh = { ...fresh, plan: planPatch };
      }
      clearDraft();
      setDraft({ ...EMPTY_DRAFT, modelId: d.modelId, aspect: d.aspect, seconds: d.seconds, pacing: d.pacing, narration: d.narration, autoPause: d.autoPause });
      setChecks({}); setHoldSceneId(null); postKickedFor.current = null; assembleKickedFor.current = null;
      adopt(fresh, rows);
      setScreen('make');
      void loadLibrary();
      await startProduction();
    });
  }

  /** Start or continue rendering: the durable runner when the model allows it, otherwise this tab. */
  async function startProduction() {
    const f = engineFilm.current;
    if (!f) return;
    const cast = Array.isArray(f.character_refs) ? f.character_refs : [];
    if (f.plan?.cast_reviewed !== true && cast.length) throw new Error('Every person needs an approved character sheet before rendering.');
    await ensurePrompts(f);
    if (requiresSignedInVideoTab(f, engineScenes.current)) { await renderInTab(); return; }
    const access = await callHook<{ approved?: boolean; error?: string }>('stv-scene-generate', { op: 'access-check' });
    if (!access?.approved) throw new Error(access?.error || 'This account is not approved for video generation yet.');
    const runLive = f.plan?.background?.enabled === true && engineScenes.current.some((s) => IN_FLIGHT_STATUSES.has(String(s.status)));
    if (!runLive) {
      const patch: Partial<Film> = { status: 'plan_ready', machine_state: 'PREPARING_SCENE', error: null, stage_note: 'Every shot is directed. Authorizing credits, then starting the clips…' };
      await db.updateFilm(f.id, patch);
      Object.assign(f, patch);
    }
    setNote('Authorizing credits — nothing has been sent to a video model yet…');
    const result = await callHook<{ success?: boolean; error?: string }>('stv-scene-generate', { op: 'start', filmId: f.id, reviewBeforeAssembly: false, captions: false, lookCheck: false });
    if (!result?.success) throw new Error(result?.error || 'The render server did not accept this film.');
    runnerKickAt.current = Date.now();
    setStalled(false);
    const [fresh, freshScenes] = await Promise.all([db.getFilm(f.id), db.listScenes(f.id)]);
    if (fresh) adopt(fresh, freshScenes);
    setNote('Rendering on our servers, one clip after another. You can close this tab.');
  }

  /** Direct and save any unfinished clip that has no prompt yet (films planned outside 2.0). */
  async function ensurePrompts(f: Film) {
    const missing = orderScenes(engineScenes.current).filter((s) => !String(s.prompt || '').trim() && !['completed', 'succeeded', 'skipped'].includes(String(s.status)));
    if (!missing.length) return;
    setNote(`Directing ${missing.length} shot${missing.length === 1 ? '' : 's'} before rendering…`);
    const ctx = contextFromFilm(f);
    const inputs = missing.map(inputFromRow);
    const directions = await directShots(inputs, ctx);
    for (const scene of missing) {
      const direction = directions[scene.scene_key];
      if (!direction) continue;
      const input = inputs.find((i) => i.key === scene.scene_key)!;
      const dialogue = scene.dialogue?.line && (scene.dialogue as any).kind !== 'narrator' ? [{ speaker: String(scene.dialogue.speaker || ''), line: String(scene.dialogue.line) }] : [];
      const prompt = assembleClipPrompt({ direction, input, ctx, dialogue });
      const spec: any = { ...(scene.spec as any), s2v2_direction: direction, prompt_version: Number((scene.spec as any)?.prompt_version || 0) + 1,
        timed_beats: direction.beats.map((beat) => ({ start_s: beat.start_s, end_s: beat.end_s, action: beat.action, camera: direction.camera })) };
      await db.updateScene(scene.id, { prompt, spec });
      Object.assign(scene, { prompt, spec });
    }
    setScenes(engineScenes.current.map((s) => ({ ...s })));
  }

  /** Models that only render while a signed-in tab is open (Seedance today). */
  async function renderInTab() {
    const f = engineFilm.current;
    if (!f) return;
    await requireVerifiedCreditSession();
    const walletCheck = await callHook<{ affordable?: boolean; error?: string }>('stv-scene-generate', { op: 'wallet-check', filmId: f.id }).catch(() => null);
    if (walletCheck?.affordable === false && walletCheck.error) throw new Error(walletCheck.error);
    const voiceLock = await callHook<{ voiceMap?: unknown }>('stv-scene-generate', { op: 'voice-map', filmId: f.id }).catch(() => null);
    if (voiceLock?.voiceMap && f.plan && !(f.plan as any).voice_map) Object.assign(f, { plan: { ...f.plan, voice_map: voiceLock.voiceMap } });
    if (f.plan?.background?.enabled) {
      const plan = {
        ...f.plan,
        background: { ...f.plan.background, enabled: false, stage: 'failed' as const, lease_owner: null, lease_until: null } as any,
        orchestration: f.plan.orchestration ? { ...f.plan.orchestration, paused: false, state: 'resumable' as const, checkpoint: 'signed_in_browser_retry', updated_at: now() } : f.plan.orchestration,
      };
      await db.updateFilm(f.id, { plan });
      Object.assign(f, { plan });
      setFilm({ ...f });
    }
    tabRun.current = true;
    setTabActive(true);
    setNote('Rendering in this tab — keep it open until every clip is done.');
    try {
      const failed = orderScenes(engineScenes.current).find((s) => s.status === 'failed');
      if (failed) await retryScene(f, engineScenes.current, failed, hooks);
      await autoProduce(f, engineScenes.current, hooks, () => tabRun.current && holdRef.current == null);
      await finishIfReady();
    } finally {
      tabRun.current = false;
      setTabActive(false);
    }
  }

  /** All clips done and the film is back with this tab: audio for the chosen mode, then assembly. */
  async function finishIfReady() {
    const f = engineFilm.current;
    if (!f || f.plan?.background?.enabled || !allScenesDone(engineScenes.current)) return;
    setScreen('finish');
    if (f.final_video_url) return;
    if (postKickedFor.current !== f.id && f.status !== 'ready' && !audioReady(f.audio)) {
      postKickedFor.current = f.id;
      await autoPostProduce(f, engineScenes.current, hooks);
    }
    if (assembleKickedFor.current === f.id || !readyToAutoAssemble(f, engineScenes.current)) return;
    assembleKickedFor.current = f.id;
    setNote('Every clip is ready — assembling your film…');
    await runFinalAssembly(f, engineScenes.current, hooks, { captions: false, voiceSource: voiceSourceFor(f), openaiVoice: openaiVoice.current });
  }

  async function assembleNow() {
    const f = engineFilm.current;
    if (!f) return;
    if (f.plan?.background?.enabled && f.status === 'assembling' && Date.now() - (Date.parse(String(f.updated_at || '')) || 0) < 10 * 60_000) {
      setNote('Your film is being assembled on the server — it appears here when it lands.');
      return;
    }
    await run(() => runFinalAssembly(f, engineScenes.current, hooks, { captions: false, voiceSource: voiceSourceFor(f), openaiVoice: openaiVoice.current }));
  }

  function kickRunner(target: Film, source: string) {
    runnerKickAt.current = Date.now();
    void callHook('s2v-recovery-sweeper', { op: 'tick', film_id: target.id, chain_id: target.plan?.background?.chain_id, source }).catch(() => undefined);
  }

  /** Narration and the rest of post for a server-made film, once its last clip lands (as in Script-to-Video). */
  function kickPostVideoAudio(target: Film, list: FilmScene[]) {
    const plan = target.plan;
    if (postKickedFor.current === target.id || running.current) return;
    if (!plan?.background?.enabled || !allScenesDone(list)) return;
    if (plan.audio_policy === 'fully-silent' || plan.audio_enabled === false || audioReady(target.audio)) return;
    postKickedFor.current = target.id;
    running.current = true;
    setBusy(true);
    void prepareFilmAudioStage(target, list, hooks, { voiceSource: voiceSourceFor(target), openaiVoice: openaiVoice.current } as any)
      .catch(async (audioError: any) => {
        const next = { ...(target.plan || {}), audio_warning: String(audioError?.message || audioError), audio_optional_retry: true } as any;
        try { await db.updateFilm(target.id, { plan: next }); Object.assign(target, { plan: next }); } catch { /* next read reconciles */ }
      })
      .finally(async () => {
        running.current = false;
        setBusy(false);
        if (engineFilm.current?.id !== target.id) return;
        try {
          const [fresh, freshScenes] = await Promise.all([db.getFilm(target.id), db.listScenes(target.id)]);
          if (!fresh || fresh.plan?.background?.enabled === true || fresh.final_video_url || fresh.error || !allScenesDone(freshScenes)) return;
          adopt(fresh, freshScenes);
          void run(() => finishIfReady());
        } catch { /* Finish keeps its Assemble button */ }
      });
  }

  // Background progress is read from WorkspaceDB; this never submits a render itself.
  useEffect(() => {
    if ((screen !== 'make' && screen !== 'finish') || !film?.plan?.background?.enabled || film.status === 'ready') return;
    const filmId = film.id;
    let live = true;
    const refresh = async () => {
      try {
        const [fresh, freshScenes] = await Promise.all([db.getFilm(filmId), db.listScenes(filmId)]);
        if (!live || !fresh) return;
        try { await reconcileStoppedBackground(fresh, freshScenes); await settlePendingBackgroundRefunds(fresh, freshScenes); }
        catch (e) { setError(friendly(e)); }
        if (running.current) return; // a tab operation owns the engine objects right now
        adopt(fresh, freshScenes);
        if (fresh.plan?.background?.enabled !== true && allScenesDone(freshScenes) && !fresh.final_video_url) {
          setScreen('finish');
          if (!fresh.error) void run(() => finishIfReady());
          return;
        }
        const isStalled = backgroundStalled(fresh);
        setStalled(isStalled);
        if (isStalled && Date.now() - runnerKickAt.current > 120_000) kickRunner(fresh, 's2v2-stall-kick');
        kickPostVideoAudio(fresh, freshScenes);
        if (fresh.status === 'ready' && fresh.final_video_url) setScreen('finish');
      } catch { /* the next read reconciles; the server keeps going */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { live = false; window.clearInterval(timer); };
  }, [film?.id, film?.status, film?.plan?.background?.enabled, screen]);

  // Record the finished film in the suite's video history once.
  useEffect(() => {
    const url = film?.final_video_url ? String(film.final_video_url) : '';
    if (!url || recordedUrls.current.has(url)) return;
    recordedUrls.current.add(url);
    void saveVideoToHistory({ appId: 'script-to-video', title: film?.title || 'S2V 2.0 film', videoUrl: url, thumbnailUrl: film?.final_thumb_url || null, durationSec: Number(film?.duration_s) || null });
  }, [film?.final_video_url]);

  // Check each clip once it lands (2.0 films, while this tab is open).
  useEffect(() => {
    if (!film || !isS2V2Film(film) || checkingId != null) return;
    const ordered = orderScenes(scenes);
    const next = ordered.find((s) => clipPhase(s) === 'done' && s.asset_url && !checks[s.id] && !savedCheck(s) && !checkedUrls.current.has(String(s.asset_url)));
    if (!next) return;
    checkedUrls.current.add(String(next.asset_url));
    setCheckingId(next.id);
    const plan: any = film.plan || {};
    const direction: ShotDirection | undefined = (next.spec as any)?.s2v2_direction;
    const castIds: string[] = Array.isArray((next.spec as any)?.characters) ? (next.spec as any).characters : [];
    const castText = (Array.isArray(plan.characters) ? plan.characters : []).filter((c: any) => castIds.includes(c.id))
      .map((c: any) => `${c.name}: ${[c.appearance, c.wardrobe].filter(Boolean).join('; ')}`).join(' | ');
    const planText = direction ? `${direction.subject} Motion: ${direction.motion_sequence}` : String((next.spec as any)?.summary || next.script_segment || '');
    void checkClip({ videoUrl: String(next.asset_url), durationS: Number(next.duration_s) || 6, planText, castText, engine: String(film.video_model || '') })
      .then(async (result) => {
        setChecks((current) => ({ ...current, [next.id]: result }));
        try {
          const validation = { ...(next.validation || {}), s2v2_qa: result } as any;
          await db.updateScene(next.id, { validation });
        } catch { /* the badge still shows for this session */ }
        const autoPause = (film.plan as any)?.studio?.s2v2?.auto_pause !== false;
        const isLast = ordered[ordered.length - 1]?.id === next.id;
        if (result.status === 'flagged' && autoPause && !isLast && !allScenesDone(engineScenes.current)) {
          setHoldSceneId(next.id);
          const f = engineFilm.current;
          if (f?.plan?.background?.enabled && !f.plan.orchestration?.paused) void setPaused(true, `Paused: clip ${next.idx + 1} looks off, so its last frame won't seed the next clip.`);
        }
      })
      .finally(() => setCheckingId(null));
  }, [film, scenes, checks, checkingId]);

  async function setPaused(paused: boolean, stageNote?: string) {
    const f = engineFilm.current;
    if (!f?.plan?.background?.enabled) {
      if (paused) { tabRun.current = false; setNote('Pausing after the clip in progress…'); }
      else if (!tabActive) await run(() => startProduction());
      return;
    }
    await run(async () => {
      const plan = { ...f.plan!, orchestration: { ...((f.plan!.orchestration || {}) as any), paused, state: paused ? 'resumable' as const : 'queued' as const, checkpoint: paused ? 'paused_after_current_job' : 'resume_requested', updated_at: now() } };
      const text = stageNote || (paused ? 'Paused — the clip in progress may finish, but no new clip starts.' : 'Resumed — continuing from the saved checkpoint.');
      await db.updateFilm(f.id, { plan, stage_note: text });
      Object.assign(f, { plan, stage_note: text });
      setFilm({ ...f });
      if (!paused) kickRunner(f, 's2v2-resume');
    });
  }

  async function stopFutureJobs() {
    setConfirm(null);
    const f = engineFilm.current;
    if (!f?.plan?.background?.enabled) { tabRun.current = false; return; }
    await run(async () => {
      const plan = { ...f.plan!, orchestration: { ...((f.plan!.orchestration || {}) as any), cancel_requested: true, state: 'cancelled' as const, checkpoint: 'stop_future_jobs_requested', updated_at: now() } };
      const text = 'Stopped. Finished clips stay saved; a clip already submitted may still settle.';
      await db.updateFilm(f.id, { plan, status: 'cancelled', stage_note: text });
      Object.assign(f, { plan, status: 'cancelled' as const, stage_note: text });
      setFilm({ ...f });
      kickRunner(f, 's2v2-stop');
    });
  }

  async function keepAndContinue() {
    setHoldSceneId(null);
    holdRef.current = null;
    const f = engineFilm.current;
    if (f?.plan?.background?.enabled && f.plan.orchestration?.paused) await setPaused(false);
    else if (!tabActive) await run(() => startProduction());
  }

  /** A new take of one finished clip, directed to avoid what went wrong. Charged as one clip. */
  async function rerenderClip(scene: FilmScene) {
    setConfirm(null);
    await run(async () => {
      const f = engineFilm.current;
      const target = engineScenes.current.find((s) => s.id === scene.id);
      if (!f || !target) return;
      if (engineScenes.current.some((s) => clipPhase(s) === 'rendering')) throw new Error('Wait for the clip in progress to finish, then re-render.');
      await requireVerifiedCreditSession();
      const handBack = reopenForFinish(f);
      if (handBack.plan) { await db.updateFilm(f.id, handBack); Object.assign(f, handBack); }
      if (f.plan?.background?.enabled) {
        const plan = {
          ...f.plan,
          background: { ...f.plan.background, enabled: false, stage: 'failed' as const, lease_owner: null, lease_until: null } as any,
          orchestration: f.plan.orchestration ? { ...f.plan.orchestration, paused: false, state: 'resumable' as const, checkpoint: `scene_${target.idx + 1}_s2v2_rerender`, updated_at: now() } : f.plan.orchestration,
        };
        await db.updateFilm(f.id, { plan });
        Object.assign(f, { plan });
      }
      const check = checks[target.id] || savedCheck(target);
      const ordered = orderScenes(engineScenes.current);
      const previous = ordered.find((s) => s.idx === target.idx - 1);
      const ctx = contextFromFilm(f, check?.issues.join('; ') || 'The previous take showed warping or identity drift.', (previous?.spec as any)?.s2v2_direction?.pose_end);
      setNote(`Re-directing clip ${target.idx + 1}…`);
      const input = inputFromRow(target);
      const direction = (await directShots([input], ctx))[input.key];
      const dialogue = target.dialogue?.line && (target.dialogue as any).kind !== 'narrator' ? [{ speaker: String(target.dialogue.speaker || ''), line: String(target.dialogue.line) }] : [];
      const prompt = assembleClipPrompt({ direction, input, ctx, dialogue });
      const spec: any = { ...(target.spec as any), prompt_source: 'studio', s2v2_direction: direction, s2v2_retake: { at: now(), issues: check?.issues || [] },
        timed_beats: direction.beats.map((beat) => ({ start_s: beat.start_s, end_s: beat.end_s, action: beat.action, camera: direction.camera })) };
      await db.updateScene(target.id, { prompt, spec });
      Object.assign(target, { prompt, spec });
      setNote(`Rendering a new take of clip ${target.idx + 1}…`);
      await generateScene(f, engineScenes.current, target, hooks, { prepareNext: false });
      setChecks((current) => { const nextChecks = { ...current }; delete nextChecks[target.id]; return nextChecks; });
      setHoldSceneId(null);
      if (f.final_video_url) {
        const patch: Partial<Film> = { final_video_url: null, final_thumb_url: null, status: 'producing', machine_state: allScenesDone(engineScenes.current) ? 'ALL_SCENES_COMPLETED' : f.machine_state, stage_note: `Clip ${target.idx + 1} was re-rendered — re-assembling.`, error: null };
        await db.updateFilm(f.id, patch);
        Object.assign(f, patch);
      }
      assembleKickedFor.current = null;
      setFilm({ ...f });
      setScenes(engineScenes.current.map((s) => ({ ...s })));
      if (allScenesDone(engineScenes.current)) await finishIfReady();
      else setNote(`Clip ${target.idx + 1} has a new take. Press Continue rendering for the rest.`);
    });
  }

  // ---------------------------------------------------------------- render

  const model = studioModelById(draft.modelId);
  const filmModel = film ? studioModelById(film.video_model) : model;
  const durable = film ? !requiresSignedInVideoTab(film, scenes) : model.durable;
  const confirmSeconds = draft.plan ? draft.plan.scenes.reduce((sum, s) => sum + (Number(s.duration_s) || 0), 0) : 0;

  return (
    <AppShell title="S2V 2.0" header={false} watermark={false} scroll={false} maxWidth="full" padding={0}>
      <div className="s2">
        <style>{S2_CSS}</style>
        <TopBar screen={screen} onLibrary={() => { setScreen('library'); void loadLibrary(); }} onNew={() => setScreen('brief')} />
        <main className="s2-scroll">
          {screen === 'library' ? <LibraryScreen films={films} loading={libLoading} onNew={() => setScreen('brief')} onOpen={(f) => void openFilm(f)} onDelete={confirmDelete} /> : null}
          {screen === 'brief' ? <BriefScreen draft={draft} models={models} onChange={(patch) => setDraft(patch)} onPlan={() => void handlePlan()} hasPlan={Boolean(draft.plan)} onOpenPlan={() => setScreen('plan')} /> : null}
          {screen === 'plan' ? (
            <PlanScreen draft={draft} model={model} progress={progress} error={planError || error} busy={busy}
              onBack={() => { planRun.current += 1; setProgress(null); setScreen('brief'); }}
              onRetryPlan={() => void handlePlan()}
              onRedrawSheet={(id) => void redrawSheet(id)}
              onUploadSheet={(id, file) => void uploadSheet(id, file)}
              onRedrawFrame={(key) => void redrawFrame(key)}
              onEditDirection={editDirection}
              onRedirect={(key) => void redirectShot(key)}
              onApprove={() => setConfirm({ kind: 'approve' })}
              onAutoPause={(on) => setDraft({ autoPause: on })} />
          ) : null}
          {screen === 'make' && film ? (
            <MakeScreen film={film} scenes={scenes} checks={checks} checkingId={checkingId} note={note} error={error} busy={busy} durable={durable} stalled={stalled}
              holdSceneId={holdSceneId} tabActive={tabActive}
              onPause={() => void setPaused(true)} onResume={() => void setPaused(false)} onStop={() => setConfirm({ kind: 'stop' })}
              onRetry={() => void run(() => startProduction())} onRerender={(scene) => setConfirm({ kind: 'rerender', scene })}
              onKeep={() => void keepAndContinue()} onStart={() => void run(() => startProduction())}
              onOpenFinish={() => setScreen('finish')} onDismissError={() => setError('')} />
          ) : null}
          {screen === 'finish' && film ? (
            <FinishScreen film={film} scenes={scenes} checks={checks} assembly={assembly} busy={busy} error={error}
              onAssemble={() => void assembleNow()} onRerender={(scene) => setConfirm({ kind: 'rerender', scene })}
              onBack={() => setScreen('make')} onNew={() => setScreen('brief')} />
          ) : null}
        </main>

        {confirm?.kind === 'approve' && draft.plan ? (
          <Modal title="Make this video?" onClose={() => setConfirm(null)}>
            <p className="s2-muted">{draft.plan.scenes.length} clips · {confirmSeconds}s on {model.label}{estimateCredits(model.id, confirmSeconds) ? ` · about ${estimateCredits(model.id, confirmSeconds)!.toLocaleString()} credits` : ''}.</p>
            <p className="s2-faint">Credits are charged per clip as it renders, after the server confirms your balance. A clip that fails is refunded automatically. {model.durable ? 'You can close this tab once it starts.' : 'Keep this tab open while it renders.'}</p>
            <div className="s2-row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="s2-btn is-ghost" onClick={() => setConfirm(null)}>Not yet</button>
              <button type="button" className="s2-btn is-primary" onClick={() => void approveAndMake()}>Make video</button>
            </div>
          </Modal>
        ) : null}
        {confirm?.kind === 'rerender' ? (
          <Modal title={`Re-render clip ${confirm.scene.idx + 1}?`} onClose={() => setConfirm(null)}>
            <p className="s2-muted">The shot is re-directed to avoid what went wrong, then rendered once on {filmModel.label}: {Math.round(Number(confirm.scene.duration_s) || 0)}s{estimateCredits(filmModel.id, Number(confirm.scene.duration_s) || 0) ? `, about ${estimateCredits(filmModel.id, Number(confirm.scene.duration_s) || 0)!.toLocaleString()} credits` : ''}. Refunded automatically if the render fails.</p>
            <p className="s2-faint">Every other clip stays as it is. Keep this tab open until the new take lands.{(() => {
              const nextClip = orderScenes(scenes).find((s) => s.idx === confirm.scene.idx + 1);
              return nextClip && (nextClip.spec as any)?.cut_type === 'continuous' && clipPhase(nextClip) === 'done'
                ? ` Clip ${nextClip.idx + 1} was already made from this clip's old last frame — if the join looks off afterwards, re-render it too.` : '';
            })()}</p>
            <div className="s2-row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="s2-btn is-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="s2-btn is-primary" onClick={() => void rerenderClip(confirm.scene)}>Re-render</button>
            </div>
          </Modal>
        ) : null}
        {confirm?.kind === 'stop' ? (
          <Modal title="Stop this film?" onClose={() => setConfirm(null)}>
            <p className="s2-muted">No new clip will start. A clip already submitted may still finish and be charged. Finished clips stay saved.</p>
            <div className="s2-row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="s2-btn is-ghost" onClick={() => setConfirm(null)}>Keep going</button>
              <button type="button" className="s2-btn is-danger" onClick={() => void stopFutureJobs()}>Stop</button>
            </div>
          </Modal>
        ) : null}
        {confirm?.kind === 'delete' ? (
          <Modal title="Delete this film?" onClose={() => setConfirm(null)}>
            <p className="s2-muted">&ldquo;{confirm.film.title || 'Untitled film'}&rdquo; and its clips are removed from your library. This can&rsquo;t be undone.</p>
            <div className="s2-row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="s2-btn is-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="s2-btn is-danger" onClick={() => void deleteFilm(confirm.film)}>Delete</button>
            </div>
          </Modal>
        ) : null}

        {busy && screen !== 'plan' && note ? (
          <div className="s2-toast" role="status"><Loader2 size={15} className="s2-spin" />{note}</div>
        ) : null}
        {error && (screen === 'library' || screen === 'brief') ? (
          <div className="s2-toast" role="alert" style={{ borderColor: 'var(--s2-bad)' }}><AlertTriangle size={15} color="var(--s2-bad)" />{error}<button type="button" className="s2-btn is-ghost is-small s2-icon-btn" aria-label="Dismiss" onClick={() => setError('')}><X size={14} /></button></div>
        ) : null}
      </div>
    </AppShell>
  );
}

class S2V2Boundary extends Component<{ children?: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: unknown) { console.error('[S2V2] crashed:', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="s2" style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <style>{S2_CSS}</style>
        <div className="s2-card" style={{ maxWidth: 440, textAlign: 'center', display: 'grid', gap: 12 }}>
          <h2>This screen hit a snag</h2>
          <p className="s2-muted">Your film is saved after every step. Reopen it from Your films and it picks up where it left off.</p>
          <button type="button" className="s2-btn is-primary" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      </div>
    );
  }
}

function App() {
  return <S2V2Boundary><S2V2App /></S2V2Boundary>;
}

export default withBrandContext(App, 'S2V 2.0');
