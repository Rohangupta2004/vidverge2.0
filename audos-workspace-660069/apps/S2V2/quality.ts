/**
 * S2V 2.0 — the quality layer.
 *
 * Script-to-Video's pipeline (planner, durable runner, credits, frame
 * chaining, assembly) is reused as it is. This module changes only WHAT the
 * pipeline is asked to render:
 *
 *  1. Model profiles: what each model can really keep consistent, read from
 *     the runner's reference routing (s2v-recovery-sweeper plannedReferences /
 *     klingReferencePlan), so the creator picks with honest expectations.
 *  2. Motion pacing: "Realistic motion" caps clip length per model, so each
 *     clip carries one or two simple actions instead of a packed 30s take.
 *  3. Shot direction: every clip gets the full SHOT SPEC (start pose, motion
 *     in timed beats, end pose, hands, face, camera, light, physical
 *     plausibility, MUST NOT list) plus S2V 2.0 motion-realism rules. Clips
 *     are directed together, so clip N starts in the exact pose clip N-1
 *     ends in. The studio path used to save a short field prompt that skipped
 *     all of this.
 *  4. Start frames: every new shot with people gets one clean full-frame
 *     still, drawn FROM the locked character sheets, so the video model
 *     starts from a real frame instead of a reference-sheet collage.
 *  5. Clip check: each finished clip is sampled and judged for warping,
 *     identity drift and plan match, so a bad clip can be caught before its
 *     last frame seeds the next one.
 */
import { askOpusJson } from '../ScriptToVideo/pipeline/opus';
import {
  SHOT_SPEC_RULES, assembleShotPrompt, defaultMustNot, missingShotSections, promptFamilyFor,
  promptFamilyGuidance, shotPromptBudget, slowMotionRequested,
} from '../ScriptToVideo/pipeline/shotPromptSpec';
import { scrubProviderPrompt } from '../ScriptToVideo/pipeline/promptDirector';
import { resolveVideoModel } from '../ScriptToVideo/pipeline/videoModelService';
import { uploadDataUrl } from '../ScriptToVideo/api';
import type { StudioCharacter, StudioPlan, StudioScene } from '../ScriptToVideo/studioAgent';
import type { StudioModel } from '../ScriptToVideo/studioModels';
import { visionQA } from '../../lib/visionQA';
import { workspaceFetch } from '../../lib/workspace';
import { creditsForSeconds } from '../../lib/credits';

export type Aspect = '16:9' | '9:16' | '1:1';
export type Pacing = 'realistic' | 'long';
export type Rating = 'best' | 'good' | 'fair';

// ---------------------------------------------------------------------------
// 1. Model profiles
// ---------------------------------------------------------------------------

export interface ModelProfile {
  identity: Rating;
  motion: Rating;
  /** One line on why, in plain words. */
  identityWhy: string;
  /** Recommended for films with recurring people. */
  characterFilms: boolean;
  /** S2V 2.0 draws start frames for new shots on this model. */
  startFrames: boolean;
}

const PROFILES: Record<string, ModelProfile> = {
  'omni-1.1-flash': {
    identity: 'best', motion: 'good', characterFilms: true, startFrames: true,
    identityWhy: 'Every clip gets the previous clip’s last frame and every character sheet together.',
  },
  'kling-3.0-omni': {
    identity: 'good', motion: 'best', characterFilms: true, startFrames: true,
    identityWhy: 'Sends the previous frame plus up to three character sheets on each clip.',
  },
  'kling-3.0': {
    identity: 'fair', motion: 'best', characterFilms: false, startFrames: false,
    identityWhy: 'Takes one image per clip, so later clips rely on the last frame alone and faces can drift.',
  },
  'seedance-2.5': {
    identity: 'good', motion: 'good', characterFilms: true, startFrames: true,
    identityWhy: 'Strong long takes; continuing clips get only the previous frame.',
  },
  'seedance-2.0': {
    identity: 'fair', motion: 'fair', characterFilms: false, startFrames: false,
    identityWhy: 'One image per clip and short clips; best for simple shots.',
  },
};

export function modelProfile(id: string): ModelProfile {
  return PROFILES[id] || { identity: 'fair', motion: 'fair', characterFilms: false, startFrames: false, identityWhy: 'Consistency depends on the previous frame only.' };
}

/** Longest clip per model under "Realistic motion": one or two simple actions. */
const REALISTIC_CAP: Record<string, number> = {
  'omni-1.1-flash': 8,
  'kling-3.0-omni': 10,
  'kling-3.0': 10,
  'seedance-2.5': 10,
  'seedance-2.0': 8,
};

/** The model the planner sees: same model, clip length capped for clean motion. */
export function pacedModel(model: StudioModel, pacing: Pacing): StudioModel {
  if (pacing !== 'realistic') return model;
  const cap = Math.min(model.maxSeconds, REALISTIC_CAP[model.id] || model.maxSeconds);
  const durations = model.durations ? model.durations.filter((d) => d <= cap) : null;
  return { ...model, maxSeconds: cap, durations: durations && durations.length ? durations : model.durations };
}

const PRICING_ENGINE: Record<string, string> = {
  'omni-1.1-flash': 'gemini-omni-1.1-flash',
  'seedance-2.5': 'openrouter/bytedance/seedance-2.5',
  'seedance-2.0': 'openrouter/bytedance/seedance-2.0-fast',
  'kling-3.0': 'kling-3.0',
  'kling-3.0-omni': 'kling-3.0-omni',
};

/** Local estimate with the wallet's own math. The server confirms before any charge. */
export function estimateCredits(modelId: string, seconds: number): number | null {
  try {
    const value = creditsForSeconds(seconds, PRICING_ENGINE[modelId] || modelId);
    return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Shot direction
// ---------------------------------------------------------------------------

export interface Beat { start_s: number; end_s: number; action: string }

export interface ShotDirection {
  subject: string;
  pose_start: string;
  motion_sequence: string;
  pose_end: string;
  hands: string;
  face_gaze: string;
  camera: string;
  lighting: string;
  environment: string;
  depth_of_field: string;
  physical_plausibility: string;
  continuity: string;
  must_not: string[];
  beats: Beat[];
  /** What the director simplified so the motion renders cleanly, if anything. */
  simplified: string;
  /** False when the writer was unavailable and safe defaults were used. */
  complete: boolean;
}

/** One clip as the director sees it. Built from a studio plan or a saved scene row. */
export interface ShotInput {
  key: string;
  index: number;
  duration: number;
  continuous: boolean;
  title: string;
  summary: string;
  script: string;
  characters: string[];
  speakers: string[];
  camera: string;
  motionHint: string;
  part?: { index: number; of: number } | null;
}

export interface DirectorContext {
  title: string;
  logline: string;
  style: string;
  world: string;
  cast: Array<Pick<StudioCharacter, 'id' | 'name' | 'appearance' | 'wardrobe'>>;
  modelId: string;
  modelLabel: string;
  audio: boolean;
  aspect: Aspect;
  /** Problems seen in an earlier take of this clip, to avoid on the next one. */
  avoid?: string;
  /** The end pose of the clip before the first one in this batch. */
  previousEndPose?: string;
}

/** Extra items every S2V 2.0 clip carries on top of the pipeline's baseline list. */
export const EXTRA_MUST_NOT = [
  'no face changing shape or identity between frames',
  'no hair, skin tone or clothing changing colour or style',
  'no limbs bending the wrong way or passing through bodies or objects',
  'no flickering, shimmering or crawling textures',
  'no feet sliding across the ground or bodies floating',
  'no duplicated people or objects',
  'no captions, subtitles or on-screen text',
];

const MOTION_REALISM_RULES = `MOTION REALISM RULES (S2V 2.0 — these decide whether the clip looks real or warps):
- One primary action per beat, and at most one beat per 4 seconds (5 seconds for a long take). Never more than three beats in one clip.
- Never combine fast subject motion with a fast camera move. When the subject moves quickly, the camera is static or follows slowly; when the camera moves, the subject moves calmly.
- Default camera: static, a slow push-in, or a slow lateral move. No whip pans, crash zooms, rapid orbits or shaky handheld unless the script asks for them.
- Stage motions that video models commonly distort in their simplest form: hands handling small objects, fingers interlacing, writing, eating, typing close-up, fast spins, hugs with crossed arms, people crossing in front of each other, faces turning more than 90 degrees quickly, mirror reflections, crowds interacting. If the script needs one, use a medium shot, keep it slow, use a single clear contact point, and let hands leave frame rather than shrink.
- Keep faces large enough to hold: when a person is the focus, frame a medium shot or closer. In wide shots keep people small and calm, seen from behind or in profile.
- Real-time speed. Motion starts within the first half second and settles completely in the last half second, so the final frame is sharp and still.
- Screen direction holds across cuts (the 180-degree rule): a person walking left to right keeps walking left to right in the next clip. Light direction and time of day never change within a scene.
- Never invent props, people or actions the script does not ask for.`;

const DIRECTOR_SYSTEM = `You are the director of photography and motion supervisor for an AI-generated film. You receive several CONSECUTIVE clips of ONE film. Write a SHOT SPEC for each clip so the video model never has to guess, the motion looks real, and nothing warps.

${SHOT_SPEC_RULES}

For each clip, put the SHOT SPEC fields directly in its object, plus:
- "beats": [{"start_s": number, "end_s": number, "action": string}] covering 0 to the clip's duration exactly, contiguous, whole or half seconds, one plain action each.
- "simplified": one short sentence if you simplified an action so it renders cleanly, otherwise "".

${MOTION_REALISM_RULES}

CONTINUITY RULES:
- For a clip marked CONTINUES, "pose_start" restates the previous clip's "pose_end" word for word, and position, wardrobe, props, light and camera side carry over.
- For a NEW SHOT, say so in "continuity" and keep identity, wardrobe and look exactly as locked.
- "pose_end" is a clean, still, balanced pose with every visible limb stated: it becomes the next clip's first frame.

OTHER RULES:
- Stage exactly what the script segment says: one story beat, nothing invented.
- Do not write spoken words and do not add a Dialogue or Narration section; the pipeline appends exact words. When someone speaks on camera, stage the delivery visually.
- Never use the words realism, realistic, photorealistic, hyper-realistic, gravity, inertia, physics or weight anywhere.

Return ONLY JSON: {"shots":[{"index": number, ...SHOT SPEC fields, "beats": [...], "simplified": string}]}`;

function str(value: unknown, max = 1200): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function lockLine(c: Pick<StudioCharacter, 'name' | 'appearance' | 'wardrobe'>): string {
  return `${c.name} — ${[c.appearance, c.wardrobe ? `wardrobe: ${c.wardrobe}` : ''].filter(Boolean).join('; ')}`;
}

export function lockedSubjects(ctx: Pick<DirectorContext, 'cast'>, characterIds: string[]): string[] {
  return ctx.cast.filter((c) => characterIds.includes(c.id)).map(lockLine);
}

/** Contiguous beats that cover exactly 0..duration, or one beat when the writer's are unusable. */
export function normalizeBeats(raw: unknown, duration: number, fallback: string): Beat[] {
  const list = (Array.isArray(raw) ? raw : [])
    .map((beat: any) => ({ start_s: Number(beat?.start_s), end_s: Number(beat?.end_s), action: str(beat?.action, 400) }))
    .filter((beat) => Number.isFinite(beat.start_s) && Number.isFinite(beat.end_s) && beat.end_s > beat.start_s && beat.action)
    .sort((a, b) => a.start_s - b.start_s);
  if (!list.length) return [{ start_s: 0, end_s: duration, action: str(fallback, 400) || 'The planned action plays at real-time pace.' }];
  const round = (n: number) => Math.round(n * 2) / 2;
  const out: Beat[] = [];
  let cursor = 0;
  for (const beat of list.slice(0, 3)) {
    const end = Math.min(duration, Math.max(cursor + 0.5, round(beat.end_s)));
    if (end <= cursor) continue;
    out.push({ start_s: cursor, end_s: end, action: beat.action });
    cursor = end;
    if (cursor >= duration) break;
  }
  if (!out.length) return [{ start_s: 0, end_s: duration, action: list[0].action }];
  out[out.length - 1] = { ...out[out.length - 1], end_s: duration };
  return out;
}

function toDirection(raw: any, input: ShotInput): ShotDirection {
  const shot = raw && typeof raw === 'object' ? raw : {};
  const mustNot = Array.isArray(shot.must_not)
    ? shot.must_not.map((item: unknown) => str(item, 160)).filter(Boolean)
    : str(shot.must_not, 900).split(/;|\n/).map((item) => item.trim()).filter(Boolean);
  return {
    subject: str(shot.subject, 1400),
    pose_start: str(shot.pose_start, 700),
    motion_sequence: str(shot.motion_sequence, 1400),
    pose_end: str(shot.pose_end, 700),
    hands: str(shot.hands, 500),
    face_gaze: str(shot.face_gaze, 500),
    camera: str(shot.camera, 600),
    lighting: str(shot.lighting, 500),
    environment: str(shot.environment, 700),
    depth_of_field: str(shot.depth_of_field, 300),
    physical_plausibility: str(shot.physical_plausibility, 600),
    continuity: str(shot.continuity, 600),
    must_not: mustNot.slice(0, 14),
    beats: normalizeBeats(shot.beats, input.duration, input.motionHint || input.summary),
    simplified: str(shot.simplified, 300),
    complete: missingShotSections(shot).length === 0,
  };
}

function describeInput(input: ShotInput, ctx: DirectorContext): string {
  const cast = ctx.cast.filter((c) => input.characters.includes(c.id)).map((c) => c.name);
  return [
    `CLIP ${input.index}: "${input.title}" — ${input.duration}s — ${input.continuous ? 'CONTINUES directly from the previous clip’s last frame' : 'NEW SHOT'}${input.part && input.part.of > 1 ? ` (part ${input.part.index} of ${input.part.of} of one longer moment)` : ''}`,
    `What happens: ${input.summary || input.title}`,
    input.script ? `Script segment (verbatim): "${input.script}"` : '',
    `On screen: ${cast.join(', ') || 'no named characters'}`,
    input.speakers.length ? `Speaking on camera: ${input.speakers.join(', ')} (stage the delivery; words are added later)` : 'Nobody speaks on camera.',
    input.camera ? `Planner's camera idea: ${input.camera}` : '',
    input.motionHint ? `Planner's motion idea: ${input.motionHint}` : '',
  ].filter(Boolean).join('\n');
}

function contextLines(ctx: DirectorContext): string {
  const family = promptFamilyFor(ctx.modelId);
  return [
    `FILM: ${ctx.title}${ctx.logline ? ` — ${ctx.logline}` : ''}`,
    ctx.style ? `VISUAL STYLE (applied automatically as the lead clause; describe content inside it): ${ctx.style}` : '',
    ctx.world ? `WORLD: ${ctx.world}` : '',
    ctx.cast.length ? `LOCKED CAST (repeat each on-screen person's line verbatim in "subject"):\n${ctx.cast.map((c) => `- ${lockLine(c)}`).join('\n')}` : 'CAST: none.',
    `MODEL: ${ctx.modelLabel}, frame ${ctx.aspect}. ${ctx.audio ? 'It renders sound.' : 'It renders SILENT video: never describe audible speech, music or sound.'}`,
    `PROMPT FAMILY: ${promptFamilyGuidance(family)}`,
    ctx.avoid ? `THE PREVIOUS TAKE OF THIS CLIP HAD THESE PROBLEMS — stage it so they cannot happen again: ${ctx.avoid}` : '',
  ].filter(Boolean).join('\n\n');
}

/**
 * Direct a run of consecutive clips. Batches of five go to the writer in
 * order, and each batch is told where the previous one ended, so start and
 * end poses chain across the whole film. Never throws: a clip the writer
 * could not direct gets the pipeline's safe defaults and `complete: false`.
 */
export async function directShots(inputs: ShotInput[], ctx: DirectorContext, onProgress?: (done: number, total: number) => void): Promise<Record<string, ShotDirection>> {
  const out: Record<string, ShotDirection> = {};
  let previousEndPose = ctx.previousEndPose || '';
  for (let start = 0; start < inputs.length; start += 5) {
    const batch = inputs.slice(start, start + 5);
    const user = [
      contextLines(ctx),
      previousEndPose && batch[0]?.continuous ? `THE CLIP BEFORE THIS BATCH ENDS ON: ${previousEndPose}` : '',
      batch.map((input) => describeInput(input, ctx)).join('\n\n'),
    ].filter(Boolean).join('\n\n');
    let shots: any[] = [];
    try {
      const reply = await askOpusJson<any>({ system: DIRECTOR_SYSTEM, user, maxTokens: 16000, effort: 'medium' });
      shots = Array.isArray(reply?.shots) ? reply.shots : [];
    } catch {
      shots = [];
    }
    for (const input of batch) {
      const raw = shots.find((shot) => Number(shot?.index) === input.index) || null;
      const direction = toDirection(raw, input);
      if (input.continuous && previousEndPose && !direction.pose_start) direction.pose_start = previousEndPose;
      out[input.key] = direction;
      previousEndPose = direction.pose_end || previousEndPose;
    }
    onProgress?.(Math.min(inputs.length, start + batch.length), inputs.length);
  }
  return out;
}

const RUNNER_RESERVE = 480;

/** The exact prompt the video model receives for one directed clip. */
export function assembleClipPrompt(params: {
  direction: ShotDirection;
  input: Pick<ShotInput, 'characters' | 'summary' | 'script'>;
  ctx: Pick<DirectorContext, 'cast' | 'style' | 'modelId' | 'audio'>;
  dialogue: Array<{ speaker: string; line: string; delivery?: string }>;
}): string {
  const { direction, input, ctx } = params;
  const maxChars = Number(resolveVideoModel(ctx.modelId).promptMaxChars) || 2500;
  const spoken = ctx.audio ? params.dialogue.filter((d) => d.line) : [];
  const exact = spoken.length
    ? `Dialogue — exact words: ${spoken.map((d) => `${d.speaker}${d.delivery ? ` (${d.delivery})` : ''}: "${d.line}"`).join(' ')}`
    : '';
  const slowMo = slowMotionRequested(`${input.script} ${input.summary}`);
  // The runner prepends a CONTINUITY FRAME line and appends LOOK LOCK / VOICE LOCK, then caps the whole
  // prompt from the end; reserve room so the cap never cuts the shot spec.
  const budget = shotPromptBudget({ maxChars, reservedChars: (exact ? exact.length + 2 : 0) + RUNNER_RESERVE });
  const text = assembleShotPrompt({
    shot: direction,
    style: ctx.style,
    lockedSubjects: lockedSubjects(ctx, input.characters),
    mustNot: [...defaultMustNot(slowMo), ...EXTRA_MUST_NOT],
    budget,
    beats: direction.beats,
    fallbackMotion: direction.beats.map((beat) => `${beat.start_s}-${beat.end_s}s: ${beat.action}`).join('; ') || input.summary,
  });
  const prompt = scrubProviderPrompt(text);
  return exact ? `${prompt}\n${exact}` : prompt;
}

/** Shot inputs for a studio plan, in film order. */
export function shotInputsFromPlan(plan: StudioPlan): ShotInput[] {
  return plan.scenes.map((scene: StudioScene, index: number) => ({
    key: scene.key,
    index,
    duration: Math.max(1, Math.round(Number(scene.duration_s) || 8)),
    continuous: index > 0 && scene.cut_type === 'continuous',
    title: scene.title,
    summary: scene.summary,
    script: scene.script_segment,
    characters: scene.characters,
    speakers: Array.from(new Set(scene.dialogue.map((d) => d.speaker).filter(Boolean))),
    camera: scene.camera || scene.prompt_fields?.camera_movement || '',
    motionHint: scene.prompt_fields?.motion || '',
    part: scene.part || null,
  }));
}

export function contextFromPlan(plan: StudioPlan, model: StudioModel, aspect: Aspect): DirectorContext {
  return {
    title: plan.title,
    logline: plan.logline,
    style: plan.visual_style,
    world: plan.world,
    cast: plan.characters.map((c) => ({ id: c.id, name: c.name, appearance: c.appearance, wardrobe: c.wardrobe })),
    modelId: model.id,
    modelLabel: model.label,
    audio: model.audio,
    aspect,
  };
}

// ---------------------------------------------------------------------------
// 3. Character sheets and start frames
// ---------------------------------------------------------------------------

/** A turnaround sheet: three views of the same person, both hands visible. */
export function characterSheetPrompt(c: StudioCharacter, plan: Pick<StudioPlan, 'visual_style' | 'film_kind'>): string {
  return [
    `Character turnaround reference sheet for a film: ${c.name}.`,
    `Appearance, locked for the whole film: ${c.appearance || 'distinctive and specific, as the script describes'}.`,
    c.wardrobe ? `Wardrobe, locked for the whole film: ${c.wardrobe}.` : '',
    'Three views of the SAME person side by side: full-body front view, full-body three-quarter view, and a head-and-shoulders close-up. Identical face, hair, skin tone, build and wardrobe in all three.',
    'Neutral relaxed expression, arms relaxed at the sides, both hands fully visible with five fingers each, feet flat on the ground.',
    'Plain light-grey studio background, soft even light, sharp focus, no text, no labels, no logos, no other people.',
    plan.visual_style ? `Render in the film's look: ${plan.visual_style}` : plan.film_kind === 'animation' ? 'Clean animated style.' : 'Natural photographic look.',
  ].filter(Boolean).join(' ');
}

export function needsStartFrame(scene: StudioScene, index: number, modelId: string): boolean {
  if (!modelProfile(modelId).startFrames) return false;
  if (!scene.characters.length) return false;
  return index === 0 || scene.cut_type !== 'continuous';
}

function frameSize(aspect: Aspect): string {
  return aspect === '9:16' ? '1024x1536' : aspect === '1:1' ? '1024x1024' : '1536x1024';
}

async function cropToAspect(base64: string, mimeType: string, aspect: Aspect, fileName: string): Promise<string> {
  const [w, h] = aspect === '9:16' ? [1080, 1920] : aspect === '1:1' ? [1080, 1080] : [1920, 1080];
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('The start frame could not be decoded.'));
    element.src = `data:${mimeType || 'image/png'};base64,${base64}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The start frame canvas is unavailable.');
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale; const dh = image.naturalHeight * scale;
  context.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return uploadDataUrl(canvas.toDataURL('image/jpeg', 0.9), fileName);
}

/**
 * One full-frame still for the first frame of a new shot, drawn from the
 * locked character sheets with high input fidelity. Uses the platform's
 * image-to-image route (no wallet debit, per its docs).
 */
export async function drawStartFrame(params: {
  direction: ShotDirection;
  scene: Pick<StudioScene, 'characters' | 'summary'>;
  cast: StudioCharacter[];
  style: string;
  aspect: Aspect;
}): Promise<string> {
  const people = params.cast.filter((c) => params.scene.characters.includes(c.id) && c.imageUrl).slice(0, 4);
  if (!people.length) throw new Error('No locked character sheet for this shot.');
  const d = params.direction;
  const prompt = [
    'One single film still: the FIRST FRAME of a shot. One continuous image, never a collage, grid or reference sheet.',
    params.style ? `Look: ${params.style}.` : '',
    `Framing and lens: ${d.camera || 'eye-level medium shot, 35mm'}.`,
    `In frame: ${d.subject || params.scene.summary}.`,
    d.pose_start ? `Exact pose: ${d.pose_start}.` : '',
    d.environment ? `Setting: ${d.environment}.` : '',
    d.lighting ? `Light: ${d.lighting}.` : '',
    'Every person matches their labeled identity reference exactly: same face, hair, skin tone, build and wardrobe. Ignore the reference sheets’ layout, grey background and multiple views.',
    'Natural anatomy, five fingers on each visible hand, sharp focus, no text, no captions, no logos, no watermark.',
  ].filter(Boolean).join(' ');
  const response = await workspaceFetch('/api/generate/image-to-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1.5',
      prompt,
      images: people.map((c, i) => ({ data: c.imageUrl, label: `PERSON IDENTITY ${i + 1}: ${c.name} — likeness, hair and wardrobe only` })),
      referenceLimit: people.length,
      inputFidelity: 'high',
      quality: 'medium',
      size: frameSize(params.aspect),
      fallbackPolicy: 'none',
      returnBase64: true,
    }),
  }, { waitForSession: false });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.imageBase64) throw new Error(String(data?.error?.message || data?.error || 'The start frame could not be drawn.'));
  return cropToAspect(String(data.imageBase64), String(data.mimeType || 'image/png'), params.aspect, `s2v2-start-frame-${Date.now()}.jpg`);
}

// ---------------------------------------------------------------------------
// 4. Clip check
// ---------------------------------------------------------------------------

export interface ClipCheck {
  status: 'clean' | 'flagged' | 'unchecked';
  issues: string[];
  scores?: { artifacts: number; character_consistency: number; prompt_match: number };
  checked_at: string;
  video_url: string;
}

/**
 * Sample four frames of a finished clip and judge them. Flagged when the
 * frames show artifacts (warping, extra fingers, melting), the person drifts
 * from the locked look, or the clip misses the planned action.
 */
export async function checkClip(params: { videoUrl: string; durationS: number; planText: string; castText: string; engine: string }): Promise<ClipCheck> {
  const now = new Date().toISOString();
  try {
    const result = await visionQA({
      videoUrl: params.videoUrl,
      durationS: params.durationS,
      planText: params.planText.slice(0, 1800),
      characterSheet: params.castText.slice(0, 1200) || undefined,
      app: 's2v2',
      engine: params.engine,
      contentType: 'clip',
    });
    if (result.reviewByEye) return { status: 'unchecked', issues: ['The automatic check was unavailable — please look at this clip yourself.'], checked_at: now, video_url: params.videoUrl };
    const scores = { artifacts: result.scores.artifacts, character_consistency: result.scores.character_consistency, prompt_match: result.scores.prompt_match };
    const flagged = scores.artifacts < 6 || (Boolean(params.castText) && scores.character_consistency < 6) || scores.prompt_match < 5;
    const issues = result.issues.filter((issue) => !/safe zone|brand|logo placement/i.test(issue)).slice(0, 6);
    return { status: flagged ? 'flagged' : 'clean', issues: flagged && !issues.length ? ['The frames show warping or drift.'] : issues, scores, checked_at: now, video_url: params.videoUrl };
  } catch {
    return { status: 'unchecked', issues: ['The automatic check could not run — please look at this clip yourself.'], checked_at: now, video_url: params.videoUrl };
  }
}
