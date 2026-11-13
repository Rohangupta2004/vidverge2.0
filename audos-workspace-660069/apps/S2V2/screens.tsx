/**
 * S2V 2.0 screens: Library · Brief · Plan · Make · Finish.
 * Presentational only — every action is a prop owned by App.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Clapperboard, Clock, Download, Eye,
  Film as FilmIcon, ImagePlus, Lightbulb, Loader2, Pause, Pencil, Play, Plus, RefreshCw, ScrollText, ShieldCheck,
  Sparkles, Square, Trash2, Upload, UserRound, Volume2, VolumeX, Wand2, X,
} from 'lucide-react';
import type { Film, FilmScene } from '../ScriptToVideo/api';
import type { StudioModel } from '../ScriptToVideo/studioModels';
import type { StudioScene } from '../ScriptToVideo/studioAgent';
import type { AssemblyProgress } from '../ScriptToVideo/pipeline/orchestrator';
import type { Aspect, ClipCheck, Rating, ShotDirection } from './quality';
import { estimateCredits, modelProfile, needsStartFrame } from './quality';
import type { Draft, PlanProgress, Screen } from './model';
import { PLAN_STEPS, clipPhase, filmSeconds, fmtDate, fmtSeconds, isS2V2Film, orderScenes, savedCheck } from './model';

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="s2-spin" aria-hidden="true" />;
}

function aspectCss(aspect: string | null | undefined): string {
  return aspect === '9:16' ? '9 / 16' : aspect === '1:1' ? '1 / 1' : '16 / 9';
}

function Meter({ label, value }: { label: string; value: Rating }) {
  const filled = value === 'best' ? 3 : value === 'good' ? 2 : 1;
  return (
    <div className="s2-meter">
      <span>{label}</span>
      <span className="s2-meter-bar" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i < filled ? 'is-on' : ''} />)}</span>
      <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Toggle({ on, onChange, title, detail, icon }: { on: boolean; onChange: (on: boolean) => void; title: string; detail?: string; icon?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="s2-toggle" onClick={() => onChange(!on)}>
      <span className="s2-toggle-box" aria-hidden="true" />
      <span style={{ display: 'grid', gap: 2 }}>
        <span className="s2-row" style={{ gap: 7, fontWeight: 750 }}>{icon}{title}</span>
        {detail ? <span className="s2-faint">{detail}</span> : null}
      </span>
    </button>
  );
}

export function Banner({ tone = 'info', icon, children, actions }: { tone?: 'info' | 'bad' | 'warn' | 'ok'; icon?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className={`s2-banner ${tone === 'info' ? '' : `is-${tone}`}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <span style={{ marginTop: 1, color: tone === 'bad' ? 'var(--s2-bad)' : tone === 'warn' ? 'var(--s2-warn)' : tone === 'ok' ? 'var(--s2-ok)' : 'var(--s2-accent)' }}>{icon || <AlertTriangle size={18} />}</span>
      <div className="s2-banner-body">
        <div>{children}</div>
        {actions ? <div className="s2-row">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="s2-modal-back" onClick={onClose}>
      <div className="s2-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="s2-row s2-between"><h2>{title}</h2><button type="button" className="s2-btn is-ghost s2-icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function QaBadge({ check, checking }: { check: ClipCheck | null; checking?: boolean }) {
  if (checking) return <span className="s2-badge"><Spinner size={12} /> Checking</span>;
  if (!check) return null;
  if (check.status === 'clean') return <span className="s2-badge is-ok"><ShieldCheck size={12} /> Clean</span>;
  if (check.status === 'flagged') return <span className="s2-badge is-bad"><AlertTriangle size={12} /> Looks off</span>;
  return <span className="s2-badge"><Eye size={12} /> Check by eye</span>;
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

const STEP_ORDER: Screen[] = ['brief', 'plan', 'make', 'finish'];
const STEP_LABEL: Record<string, string> = { brief: 'Brief', plan: 'Plan', make: 'Make', finish: 'Finish' };

export function TopBar({ screen, onLibrary, onNew }: { screen: Screen; onLibrary: () => void; onNew: () => void }) {
  const at = STEP_ORDER.indexOf(screen);
  return (
    <header className="s2-top">
      <div className="s2-brand"><span className="s2-brand-mark"><Clapperboard size={16} /></span>Script to Video<span className="s2-brand-ver">2.0</span></div>
      <nav className="s2-steps" aria-label="Progress">
        {screen !== 'library' ? STEP_ORDER.map((step, index) => (
          <span key={step} className={`s2-step ${index === at ? 'is-on' : index < at ? 'is-done' : ''}`} aria-current={index === at ? 'step' : undefined}>
            <span className="s2-step-n">{index < at ? <Check size={12} /> : index + 1}</span>
            <span className="s2-step-label">{STEP_LABEL[step]}</span>
          </span>
        )) : null}
      </nav>
      <div className="s2-row" style={{ gap: 6 }}>
        {screen === 'library' ? <button type="button" className="s2-btn is-primary is-small" onClick={onNew}><Plus size={15} /> New video</button>
          : <button type="button" className="s2-btn is-ghost is-small" onClick={onLibrary}><FilmIcon size={15} /> Your films</button>}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

function filmStatus(film: Film): { label: string; tone: string } {
  if (film.status === 'ready' && film.final_video_url) return { label: 'Ready', tone: 'is-ok' };
  if (film.status === 'error' || film.status === 'blocked') return { label: 'Needs you', tone: 'is-bad' };
  if (film.status === 'cancelled') return { label: 'Stopped', tone: '' };
  if (film.status === 'producing' || film.status === 'assembling') return { label: film.status === 'assembling' ? 'Assembling' : 'Rendering', tone: 'is-accent' };
  return { label: 'Planned', tone: '' };
}

export function LibraryScreen({ films, loading, onNew, onOpen, onDelete }: {
  films: Film[];
  loading: boolean;
  onNew: () => void;
  onOpen: (film: Film) => void;
  onDelete: (film: Film) => void;
}) {
  const [only2, setOnly2] = useState(false);
  const shown = films.filter((film) => !film.is_archived && (!only2 || isS2V2Film(film)));
  return (
    <div className="s2-page">
      <div className="s2-section-head" style={{ marginBottom: 18 }}>
        <div className="s2-stack" style={{ gap: 6 }}>
          <span className="s2-eyebrow">Your films</span>
          <h1>Make it look real.</h1>
          <p className="s2-muted">Consistent people, clean motion, no warping — every clip is directed and checked.</p>
        </div>
        <div className="s2-seg" role="group" aria-label="Filter films">
          <button type="button" aria-pressed={!only2} onClick={() => setOnly2(false)}>All films</button>
          <button type="button" aria-pressed={only2} onClick={() => setOnly2(true)}>Made in 2.0</button>
        </div>
      </div>
      {loading ? (
        <div className="s2-films">{[0, 1, 2].map((i) => <div key={i} className="s2-film"><div className="s2-film-thumb s2-shimmer" /><div className="s2-shimmer" style={{ height: 14, borderRadius: 6 }} /></div>)}</div>
      ) : shown.length ? (
        <div className="s2-films">
          {shown.map((film) => {
            const status = filmStatus(film);
            return (
              <div key={film.id} className="s2-film">
                <button type="button" onClick={() => onOpen(film)} style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 10 }} aria-label={`Open ${film.title || 'film'}`}>
                  <div className="s2-film-thumb">
                    {film.final_thumb_url ? <img src={film.final_thumb_url} alt="" loading="lazy" />
                      : film.final_video_url ? <video src={film.final_video_url} muted playsInline preload="metadata" />
                        : <FilmIcon size={26} />}
                  </div>
                  <div style={{ display: 'grid', gap: 6, padding: '0 4px' }}>
                    <div style={{ fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{film.title || 'Untitled film'}</div>
                    <div className="s2-row" style={{ gap: 6 }}>
                      <span className={`s2-badge ${status.tone}`}>{status.label}</span>
                      {isS2V2Film(film) ? <span className="s2-badge is-accent">2.0</span> : null}
                      <span className="s2-faint">{fmtDate(film.created_at)}</span>
                    </div>
                  </div>
                </button>
                <div className="s2-row s2-between" style={{ padding: '0 2px' }}>
                  <span className="s2-faint">{film.aspect_ratio || '16:9'}{filmSeconds(film) ? ` · ${fmtSeconds(filmSeconds(film))}` : ''}</span>
                  <button type="button" className="s2-btn is-ghost is-small s2-icon-btn" aria-label={`Delete ${film.title || 'film'}`} onClick={() => onDelete(film)}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="s2-empty">
          <span className="s2-brand-mark" style={{ width: 48, height: 48, borderRadius: 14 }}><Clapperboard size={22} /></span>
          <h2>{only2 ? 'No 2.0 films yet' : 'No films yet'}</h2>
          <p className="s2-muted" style={{ maxWidth: 420 }}>Describe an idea or paste a script. You review the full plan, with the cast and every shot, before anything renders.</p>
          <button type="button" className="s2-btn is-primary" onClick={onNew}><Sparkles size={16} /> Make your first video</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------

const LENGTHS = [15, 30, 45, 60, 90, 120];
const FRAMES: Array<{ id: Aspect; label: string; w: number; h: number }> = [
  { id: '16:9', label: 'Landscape', w: 36, h: 20 },
  { id: '9:16', label: 'Vertical', w: 16, h: 28 },
  { id: '1:1', label: 'Square', w: 24, h: 24 },
];

export function BriefScreen({ draft, models, onChange, onPlan, hasPlan, onOpenPlan }: {
  draft: Draft;
  models: StudioModel[];
  onChange: (patch: Partial<Draft>) => void;
  onPlan: () => void;
  hasPlan: boolean;
  onOpenPlan: () => void;
}) {
  const model = models.find((m) => m.id === draft.modelId) || models[0];
  const profile = model ? modelProfile(model.id) : null;
  const words = draft.text.trim().split(/\s+/).filter(Boolean).length;
  const ready = words >= 3 && Boolean(model);
  const credits = model ? estimateCredits(model.id, draft.seconds) : null;
  const custom = !LENGTHS.includes(draft.seconds);
  return (
    <div className="s2-page s2-narrow">
      <div className="s2-stack" style={{ gap: 8 }}>
        <span className="s2-eyebrow">Step 1 · Brief</span>
        <h1>What are we making?</h1>
        <p className="s2-muted">Planning is free. You see the cast, every shot and the cost before anything renders.</p>
      </div>

      <div className="s2-section">
        <div className="s2-row s2-between" style={{ marginBottom: 10 }}>
          <div className="s2-seg" role="group" aria-label="Start from">
            <button type="button" aria-pressed={draft.mode === 'idea'} onClick={() => onChange({ mode: 'idea' })}><Lightbulb size={15} /> I have an idea</button>
            <button type="button" aria-pressed={draft.mode === 'script'} onClick={() => onChange({ mode: 'script' })}><ScrollText size={15} /> I have a script</button>
          </div>
          <span className="s2-faint">{words} word{words === 1 ? '' : 's'}</span>
        </div>
        <textarea
          className="s2-textarea is-hero"
          aria-label={draft.mode === 'idea' ? 'Your idea' : 'Your script'}
          value={draft.text}
          onChange={(event) => onChange({ text: event.target.value })}
          placeholder={draft.mode === 'idea'
            ? 'A young chef opens her tiny ramen shop at dawn. Steam, the first customer, a quiet smile. Warm, cinematic, 30 seconds.'
            : 'Paste your script. Scene headings, dialogue and narration are kept word for word. Use @name for a saved character.'}
        />
        <p className="s2-faint" style={{ marginTop: 8 }}>{draft.mode === 'idea' ? 'Who is in it, where it happens, the feeling. We write a full script from this.' : 'Your words are kept exactly. We only plan the shots around them.'}</p>
      </div>

      <div className="s2-section">
        <h3 style={{ marginBottom: 12 }}>Video model</h3>
        <div className="s2-models">
          {models.map((m) => {
            const p = modelProfile(m.id);
            return (
              <button key={m.id} type="button" className="s2-model" aria-pressed={m.id === draft.modelId} onClick={() => onChange({ modelId: m.id })}>
                <div className="s2-row s2-between"><span className="s2-model-name">{m.label}</span>{m.id === draft.modelId ? <CheckCircle2 size={18} color="var(--s2-accent)" /> : null}</div>
                <Meter label="Same people" value={p.identity} />
                <Meter label="Motion" value={p.motion} />
                <div className="s2-row" style={{ gap: 6 }}>
                  <span className="s2-badge">{m.durations ? `${m.durations.join(' or ')}s clips` : `${m.minSeconds}–${m.maxSeconds}s clips`}</span>
                  <span className="s2-badge">{m.audio ? <><Volume2 size={11} /> Sound</> : <><VolumeX size={11} /> Silent</>}</span>
                  {m.durable ? <span className="s2-badge is-ok">Tab can close</span> : <span className="s2-badge is-warn">Keep tab open</span>}
                </div>
              </button>
            );
          })}
        </div>
        {profile ? <p className="s2-faint" style={{ marginTop: 10 }}>{profile.identityWhy}{!profile.characterFilms ? ' For films where the same people appear in many clips, Gemini Omni Flash or Kling 3.0 Omni hold faces better.' : ''}</p> : null}
      </div>

      <div className="s2-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 22 }}>
        <div>
          <span className="s2-label">Length</span>
          <div className="s2-chips">
            {LENGTHS.map((s) => <button key={s} type="button" className="s2-chip" aria-pressed={draft.seconds === s} onClick={() => onChange({ seconds: s })}>{fmtSeconds(s)}</button>)}
            <label className={`s2-chip ${custom ? 'is-on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="number" min={5} max={600} value={custom ? draft.seconds : ''} placeholder="Other" aria-label="Custom length in seconds"
                onChange={(event) => { const v = Math.round(Number(event.target.value)); if (v >= 5 && v <= 600) onChange({ seconds: v }); }}
                style={{ width: 56, background: 'transparent', border: 0, outline: 'none', color: 'inherit', fontWeight: 700 }} />s
            </label>
          </div>
        </div>
        <div>
          <span className="s2-label">Frame</span>
          <div className="s2-frames">
            {FRAMES.map((f) => (
              <button key={f.id} type="button" className="s2-frame" aria-pressed={draft.aspect === f.id} onClick={() => onChange({ aspect: f.id })}>
                <span className="s2-frame-shape" style={{ width: f.w, height: f.h }} />{f.label}<span className="s2-faint">{f.id}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="s2-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <div>
          <span className="s2-label">Motion</span>
          <div className="s2-seg" role="group" aria-label="Motion pacing">
            <button type="button" aria-pressed={draft.pacing === 'realistic'} onClick={() => onChange({ pacing: 'realistic' })}>Realistic motion</button>
            <button type="button" aria-pressed={draft.pacing === 'long'} onClick={() => onChange({ pacing: 'long' })}>Longest takes</button>
          </div>
          <p className="s2-faint" style={{ marginTop: 8 }}>{draft.pacing === 'realistic' ? 'Recommended. Shorter clips with one or two simple actions each — the biggest single fix for warped motion.' : 'Fills each clip to the model’s maximum length. Fewer cuts, more risk of rushed motion.'}</p>
        </div>
        <div>
          <span className="s2-label">Voice-over</span>
          <Toggle on={draft.narration} onChange={(on) => onChange({ narration: on })} title="Add a narrator" detail="Recorded after the clips render and mixed into the final film." />
        </div>
      </div>

      <div className="s2-footer">
        <span className="s2-faint">{model ? <>{fmtSeconds(draft.seconds)} on {model.label}{credits ? <> · about {credits.toLocaleString()} credits to render</> : null}</> : null}</span>
        <div className="s2-row">
          {hasPlan ? <button type="button" className="s2-btn" onClick={onOpenPlan}>Back to your plan</button> : null}
          <button type="button" className="s2-btn is-primary" disabled={!ready} onClick={onPlan}><Wand2 size={16} /> {hasPlan ? 'Plan again' : 'Plan my video'} <ArrowRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function PlanProgressView({ progress }: { progress: PlanProgress }) {
  const at = PLAN_STEPS.findIndex((s) => s.id === progress.active);
  return (
    <div className="s2-page s2-narrow">
      <div className="s2-card is-glow" style={{ display: 'grid', gap: 18, padding: 26 }}>
        <div className="s2-stack" style={{ gap: 6 }}>
          <span className="s2-eyebrow">Step 2 · Plan</span>
          <h2>Directing your film…</h2>
          <p className="s2-muted">{progress.detail || 'This takes a minute or two. Nothing is charged.'}</p>
        </div>
        <div className="s2-progress" aria-hidden="true"><span style={{ width: `${Math.round(((progress.done.length + 0.5) / PLAN_STEPS.length) * 100)}%` }} /></div>
        <div className="s2-tasks">
          {PLAN_STEPS.map((step, index) => {
            const done = progress.done.includes(step.id);
            const active = step.id === progress.active && !done;
            return (
              <div key={step.id} className={`s2-task ${done ? 'is-done' : active ? 'is-active' : ''}`}>
                <span className="s2-task-dot">{done ? <Check size={13} /> : active ? <Spinner size={13} /> : index + 1}</span>
                {step.label}
              </div>
            );
          })}
        </div>
        {at >= 2 ? <p className="s2-faint">Every clip gets a start pose, timed motion, an end pose that seeds the next clip, hand and face notes, and a list of things that must not happen.</p> : null}
      </div>
    </div>
  );
}

function ShotCard({ index, scene, direction, prompt, modelId, aspect, frameStatus, onRedrawFrame, onEdit, onRedirect, busy }: {
  index: number;
  scene: StudioScene;
  direction: ShotDirection | undefined;
  prompt: string;
  modelId: string;
  aspect: Aspect;
  frameStatus: 'loading' | 'error' | undefined;
  onRedrawFrame: () => void;
  onEdit: (patch: Partial<ShotDirection>) => void;
  onRedirect: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [motion, setMotion] = useState(direction?.motion_sequence || '');
  const [camera, setCamera] = useState(direction?.camera || '');
  const [poseEnd, setPoseEnd] = useState(direction?.pose_end || '');
  useEffect(() => { if (!editing) { setMotion(direction?.motion_sequence || ''); setCamera(direction?.camera || ''); setPoseEnd(direction?.pose_end || ''); } }, [direction, editing]);
  const wantsFrame = needsStartFrame(scene, index, modelId);
  const continues = index > 0 && scene.cut_type === 'continuous';
  return (
    <article className="s2-shot" aria-label={`Clip ${index + 1}`}>
      <div className="s2-shot-media" style={{ aspectRatio: aspectCss(aspect) }}>
        <span className="s2-shot-num">{index + 1}</span>
        {scene.storyboard_url ? <img src={scene.storyboard_url} alt={`Start frame for clip ${index + 1}`} />
          : frameStatus === 'loading' ? <div className="s2-shimmer" style={{ position: 'absolute', inset: 0 }} />
            : <div style={{ display: 'grid', justifyItems: 'center', gap: 6, padding: 10, textAlign: 'center', fontSize: 11.5 }}>
              {continues ? <><ArrowRight size={18} />Starts from clip {index}&rsquo;s last frame</> : wantsFrame ? <><ImagePlus size={18} />{frameStatus === 'error' ? 'Start frame failed' : 'No start frame'}</> : <><Clapperboard size={18} />New shot</>}
            </div>}
      </div>
      <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        <div className="s2-row s2-between">
          <h3 style={{ minWidth: 0 }}>{scene.title || `Clip ${index + 1}`}</h3>
          <div className="s2-row" style={{ gap: 6 }}>
            <span className="s2-badge"><Clock size={11} /> {scene.duration_s}s</span>
            <span className={`s2-badge ${continues ? 'is-accent' : ''}`}>{continues ? 'Continues' : 'New shot'}</span>
            {direction && !direction.complete ? <span className="s2-badge is-warn">Default direction</span> : null}
          </div>
        </div>
        {direction?.beats?.length ? (
          <div className="s2-beats">
            {direction.beats.map((beat, i) => (
              <div key={i} className="s2-beat" style={{ flex: Math.max(0.5, beat.end_s - beat.start_s) }}><b>{beat.start_s}–{beat.end_s}s</b>{beat.action}</div>
            ))}
          </div>
        ) : <p className="s2-muted">{scene.summary}</p>}
        {editing ? (
          <div className="s2-stack" style={{ gap: 10 }}>
            <label><span className="s2-label">Motion</span><textarea className="s2-textarea" value={motion} onChange={(e) => setMotion(e.target.value)} /></label>
            <label><span className="s2-label">Camera</span><textarea className="s2-textarea" style={{ minHeight: 70 }} value={camera} onChange={(e) => setCamera(e.target.value)} /></label>
            <label><span className="s2-label">Ends on (seeds the next clip)</span><textarea className="s2-textarea" style={{ minHeight: 70 }} value={poseEnd} onChange={(e) => setPoseEnd(e.target.value)} /></label>
            <div className="s2-row">
              <button type="button" className="s2-btn is-primary is-small" onClick={() => { onEdit({ motion_sequence: motion, camera, pose_end: poseEnd }); setEditing(false); }}><Check size={14} /> Save direction</button>
              <button type="button" className="s2-btn is-ghost is-small" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : direction ? (
          <dl className="s2-kv">
            <dt>Camera</dt><dd>{direction.camera}</dd>
            <dt>Ends on</dt><dd>{direction.pose_end}</dd>
            {direction.simplified ? <><dt>Simplified</dt><dd>{direction.simplified}</dd></> : null}
          </dl>
        ) : null}
        {!editing ? (
          <div className="s2-row" style={{ gap: 6 }}>
            <button type="button" className="s2-btn is-small" disabled={busy} onClick={() => setEditing(true)}><Pencil size={13} /> Edit direction</button>
            <button type="button" className="s2-btn is-ghost is-small" disabled={busy} onClick={onRedirect}><RefreshCw size={13} /> Re-direct</button>
            {wantsFrame ? <button type="button" className="s2-btn is-ghost is-small" disabled={busy || frameStatus === 'loading'} onClick={onRedrawFrame}><ImagePlus size={13} /> {scene.storyboard_url ? 'Redraw start frame' : 'Draw start frame'}</button> : null}
            <details>
              <summary><ChevronDown size={14} /> Exact prompt</summary>
              <pre className="s2-pre">{prompt}</pre>
            </details>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function PlanScreen(props: {
  draft: Draft;
  model: StudioModel;
  progress: PlanProgress | null;
  error: string;
  busy: boolean;
  onBack: () => void;
  onRetryPlan: () => void;
  onRedrawSheet: (characterId: string) => void;
  onUploadSheet: (characterId: string, file: File) => void;
  onRedrawFrame: (sceneKey: string) => void;
  onEditDirection: (sceneKey: string, patch: Partial<ShotDirection>) => void;
  onRedirect: (sceneKey: string) => void;
  onApprove: () => void;
  onAutoPause: (on: boolean) => void;
}) {
  const { draft, model, progress, error, busy } = props;
  const plan = draft.plan;
  const uploadFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  if (progress) return <PlanProgressView progress={progress} />;
  if (!plan) {
    return (
      <div className="s2-page s2-narrow">
        <Banner tone="bad" actions={<><button type="button" className="s2-btn is-primary is-small" onClick={props.onRetryPlan}><RefreshCw size={14} /> Try again</button><button type="button" className="s2-btn is-ghost is-small" onClick={props.onBack}>Back to brief</button></>}>
          {error || 'There is no plan yet.'}
        </Banner>
      </div>
    );
  }
  const total = plan.scenes.reduce((sum, s) => sum + (Number(s.duration_s) || 0), 0);
  const credits = estimateCredits(model.id, total);
  const sheetsMissing = plan.characters.filter((c) => !c.imageUrl);
  const sheetsLoading = Object.values(draft.sheetStatus).some((s) => s === 'loading');
  const framesLoading = Object.values(draft.frameStatus).some((s) => s === 'loading');
  const directed = plan.scenes.filter((s) => draft.directions[s.key]?.complete).length;
  const framesWanted = plan.scenes.filter((s, i) => needsStartFrame(s, i, model.id));
  const framesReady = framesWanted.filter((s) => s.storyboard_url).length;
  const canApprove = !busy && !sheetsLoading && !framesLoading && sheetsMissing.length === 0;
  const checks: Array<{ ok: boolean; warn?: boolean; text: string }> = [
    { ok: sheetsMissing.length === 0, text: plan.characters.length ? `${plan.characters.length - sheetsMissing.length} of ${plan.characters.length} people have a locked sheet` : 'No recurring people in this film' },
    { ok: directed === plan.scenes.length, warn: directed < plan.scenes.length, text: `${directed} of ${plan.scenes.length} clips fully directed` },
    { ok: true, text: 'Anti-distortion rules on every clip' },
    ...(framesWanted.length ? [{ ok: framesReady === framesWanted.length, warn: framesReady < framesWanted.length, text: `${framesReady} of ${framesWanted.length} new shots start from a drawn frame` }] : []),
    { ok: draft.pacing === 'realistic', warn: draft.pacing !== 'realistic', text: draft.pacing === 'realistic' ? 'Clips paced for clean motion' : 'Longest takes: more risk of rushed motion' },
    { ok: modelProfile(model.id).characterFilms || !plan.characters.length, warn: !modelProfile(model.id).characterFilms && plan.characters.length > 0, text: `${model.label}: faces held ${modelProfile(model.id).identity === 'best' ? 'best' : modelProfile(model.id).identity === 'good' ? 'well' : 'fairly'}` },
  ];
  return (
    <div className="s2-page">
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
        const file = event.target.files?.[0]; const id = uploadFor.current;
        if (file && id) props.onUploadSheet(id, file);
        event.target.value = '';
      }} />
      <div className="s2-split">
        <div style={{ minWidth: 0 }}>
          <div className="s2-stack" style={{ gap: 6 }}>
            <span className="s2-eyebrow">Step 2 · Plan</span>
            <h1>{plan.title}</h1>
            {plan.logline ? <p className="s2-muted">{plan.logline}</p> : null}
          </div>
          {error ? <div style={{ marginTop: 16 }}><Banner tone="bad">{error}</Banner></div> : null}
          {plan.notes.length ? <div style={{ marginTop: 16 }}><Banner tone="info" icon={<Lightbulb size={18} />}>{plan.notes.join(' ')}</Banner></div> : null}

          <section className="s2-section">
            <div className="s2-section-head"><h2>Cast</h2><span className="s2-faint">One locked look per person, used in every clip.</span></div>
            {plan.characters.length ? (
              <div className="s2-cast">
                {plan.characters.map((c) => {
                  const status = draft.sheetStatus[c.id];
                  return (
                    <div key={c.id} className="s2-person">
                      <div className="s2-person-img">
                        {status === 'loading' ? <div className="s2-shimmer" style={{ width: '100%', height: '100%' }} />
                          : c.imageUrl ? <img src={c.imageUrl} alt={`${c.name} character sheet`} />
                            : <div style={{ display: 'grid', justifyItems: 'center', gap: 6, fontSize: 12 }}><UserRound size={26} />{status === 'error' ? 'Sheet failed' : 'No sheet yet'}</div>}
                      </div>
                      <div><div style={{ fontWeight: 750 }}>{c.name}{c.mention ? <span className="s2-faint"> @{c.mention}</span> : null}</div><p className="s2-faint" style={{ marginTop: 3 }}>{[c.appearance, c.wardrobe].filter(Boolean).join(' · ').slice(0, 180)}</p></div>
                      <div className="s2-row" style={{ gap: 6 }}>
                        <button type="button" className="s2-btn is-small" disabled={busy || status === 'loading'} onClick={() => props.onRedrawSheet(c.id)}><RefreshCw size={13} /> {c.imageUrl ? 'Redraw' : 'Draw'}</button>
                        <button type="button" className="s2-btn is-ghost is-small" disabled={busy || status === 'loading'} onClick={() => { uploadFor.current = c.id; fileInput.current?.click(); }}><Upload size={13} /> Upload</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="s2-muted">No people on screen — this film is pure motion design or scenery.</p>}
          </section>

          <section className="s2-section">
            <div className="s2-section-head"><h2>Shots</h2><span className="s2-faint">{plan.scenes.length} clips · {fmtSeconds(total)}</span></div>
            <div className="s2-shots">
              {plan.scenes.map((scene, index) => (
                <ShotCard key={scene.key} index={index} scene={scene} direction={draft.directions[scene.key]} prompt={scene.prompt} modelId={model.id} aspect={draft.aspect}
                  frameStatus={draft.frameStatus[scene.key]} busy={busy}
                  onRedrawFrame={() => props.onRedrawFrame(scene.key)}
                  onEdit={(patch) => props.onEditDirection(scene.key, patch)}
                  onRedirect={() => props.onRedirect(scene.key)} />
              ))}
            </div>
          </section>

          <section className="s2-section">
            <details>
              <summary><ChevronDown size={14} /> The script this plan follows</summary>
              <pre className="s2-pre" style={{ maxHeight: 420 }}>{draft.script}</pre>
            </details>
          </section>
        </div>

        <aside className="s2-aside">
          <div className="s2-card is-glow" style={{ display: 'grid', gap: 14 }}>
            <h3>Ready to make</h3>
            <dl className="s2-kv">
              <dt>Clips</dt><dd>{plan.scenes.length}</dd>
              <dt>Length</dt><dd>{fmtSeconds(total)}</dd>
              <dt>Model</dt><dd>{model.label}</dd>
              <dt>Frame</dt><dd>{draft.aspect}</dd>
              <dt>Estimate</dt><dd>{credits ? `about ${credits.toLocaleString()} credits` : 'confirmed before rendering'}</dd>
            </dl>
            <hr className="s2-divider" style={{ margin: 0 }} />
            <div className="s2-tasks">
              {checks.map((check, i) => (
                <div key={i} className={`s2-task ${check.ok ? 'is-done' : ''}`} style={{ fontSize: 12.5 }}>
                  <span className="s2-task-dot" style={check.warn ? { borderColor: 'var(--s2-warn)', color: 'var(--s2-warn)' } : undefined}>{check.ok ? <Check size={12} /> : <AlertTriangle size={12} />}</span>{check.text}
                </div>
              ))}
            </div>
            <Toggle on={draft.autoPause} onChange={props.onAutoPause} title="Stop on a bad clip" detail="Each clip is checked when it lands. If it looks warped, production pauses before its last frame seeds the next clip. Works while this tab is open." icon={<ShieldCheck size={14} />} />
            <button type="button" className="s2-btn is-primary is-wide" disabled={!canApprove} onClick={props.onApprove}><Play size={16} /> Approve & make video</button>
            {sheetsMissing.length && !sheetsLoading ? <p className="s2-faint">Draw or upload a sheet for {sheetsMissing.map((c) => c.name).join(', ')} first — every person needs one to stay consistent.</p> : null}
            {sheetsLoading || framesLoading ? <p className="s2-faint"><Spinner size={12} /> Still drawing images…</p> : null}
            <button type="button" className="s2-btn is-ghost is-small" onClick={props.onBack}><ArrowLeft size={14} /> Change the brief</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Make
// ---------------------------------------------------------------------------

const PHASE_LABEL: Record<string, string> = { queued: 'Queued', rendering: 'Rendering', done: 'Done', skipped: 'Skipped', failed: 'Failed', review: 'Needs you', cancelled: 'Stopped' };

function ClipCard({ scene, aspect, check, checking, active, canAct, onRerender, onRetry }: {
  scene: FilmScene; aspect: string; check: ClipCheck | null; checking: boolean; active: boolean; canAct: boolean;
  onRerender: () => void; onRetry: () => void;
}) {
  const phase = clipPhase(scene);
  const flagged = check?.status === 'flagged';
  return (
    <div className={`s2-clip ${active ? 'is-active' : ''} ${phase === 'failed' || flagged ? 'is-bad' : ''}`}>
      <div className="s2-clip-media" style={{ aspectRatio: aspectCss(aspect) }}>
        {scene.asset_url && phase === 'done' ? <video src={scene.asset_url} poster={scene.keyframe_url || undefined} muted playsInline controls preload="metadata" />
          : phase === 'rendering' ? <div className="s2-shimmer" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><Spinner size={22} /></div>
            : scene.first_frame_url ? <img src={scene.first_frame_url} alt="" />
              : <FilmIcon size={22} />}
        <span className="s2-shot-num">{scene.idx + 1}</span>
      </div>
      <div className="s2-row s2-between" style={{ gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String((scene.spec as any)?.studio_title || (scene.spec as any)?.summary || `Clip ${scene.idx + 1}`)}</span>
        <span className={`s2-badge ${phase === 'done' ? 'is-ok' : phase === 'failed' || phase === 'review' ? 'is-bad' : phase === 'rendering' ? 'is-accent' : ''}`}>{phase === 'rendering' ? <Spinner size={11} /> : null}{PHASE_LABEL[phase]}</span>
      </div>
      <div className="s2-row" style={{ gap: 6 }}>
        <span className="s2-faint">{Math.round(Number(scene.duration_s) || 0)}s</span>
        <QaBadge check={check} checking={checking} />
      </div>
      {flagged && check?.issues.length ? <p className="s2-faint" style={{ color: 'var(--s2-bad)' }}>{check.issues.slice(0, 2).join(' · ')}</p> : null}
      {phase === 'failed' && scene.error ? <p className="s2-faint" style={{ color: 'var(--s2-bad)' }}>{String(scene.error).slice(0, 180)}</p> : null}
      {phase === 'failed' || phase === 'review' ? <button type="button" className="s2-btn is-small" disabled={!canAct} onClick={onRetry}><RefreshCw size={13} /> Retry clip</button> : null}
      {phase === 'done' && (flagged || check?.status === 'unchecked') ? <button type="button" className="s2-btn is-small" disabled={!canAct} onClick={onRerender}><Wand2 size={13} /> Re-render clip</button> : null}
    </div>
  );
}

export function MakeScreen(props: {
  film: Film;
  scenes: FilmScene[];
  checks: Record<number, ClipCheck>;
  checkingId: number | null;
  note: string;
  error: string;
  busy: boolean;
  durable: boolean;
  stalled: boolean;
  holdSceneId: number | null;
  /** A signed-in tab render is running right now. */
  tabActive: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetry: (scene: FilmScene) => void;
  onRerender: (scene: FilmScene) => void;
  onKeep: () => void;
  onStart: () => void;
  onOpenFinish: () => void;
  onDismissError: () => void;
}) {
  const { film, busy } = props;
  const scenes = orderScenes(props.scenes);
  const done = scenes.filter((s) => clipPhase(s) === 'done' || clipPhase(s) === 'skipped').length;
  const rendering = scenes.find((s) => clipPhase(s) === 'rendering') || null;
  const background = film.plan?.background;
  // A run that stopped on a failed clip is not running: Retry has to be available.
  const serverRunning = background?.enabled === true && !['ready', 'cancelled', 'error'].includes(String(film.status)) && String(background?.stage || '') !== 'failed';
  const running = serverRunning || props.tabActive;
  const paused = serverRunning && film.plan?.orchestration?.paused === true;
  const remaining = scenes.some((s) => ['queued', 'failed', 'review'].includes(clipPhase(s)));
  const canStart = !running && remaining && film.status !== 'cancelled' && !rendering;
  const anyDone = scenes.some((s) => clipPhase(s) === 'done');
  const hold = props.holdSceneId != null ? scenes.find((s) => s.id === props.holdSceneId) || null : null;
  const total = scenes.reduce((sum, s) => sum + (Number(s.duration_s) || 0), 0);
  const pct = scenes.length ? Math.round((done / scenes.length) * 100) : 0;
  const nothingGenerating = !rendering;
  return (
    <div className="s2-page">
      <div className="s2-section-head" style={{ marginBottom: 16 }}>
        <div className="s2-stack" style={{ gap: 6, minWidth: 0 }}>
          <span className="s2-eyebrow">Step 3 · Make</span>
          <h1 style={{ overflowWrap: 'anywhere' }}>{film.title || 'Your film'}</h1>
          <p className="s2-muted">{done} of {scenes.length} clips done · {fmtSeconds(total)} · {props.durable ? 'renders on our servers — you can close this tab' : 'keep this tab open while it renders'}</p>
        </div>
        <div className="s2-row">
          {canStart ? <button type="button" className="s2-btn is-primary" disabled={busy} onClick={props.onStart}><Play size={16} /> {anyDone ? 'Continue rendering' : 'Start rendering'}</button> : null}
          {running && !paused ? <button type="button" className="s2-btn" disabled={busy && !props.tabActive} onClick={props.onPause}><Pause size={15} /> {props.tabActive ? 'Pause after this clip' : 'Pause'}</button> : null}
          {running && paused ? <button type="button" className="s2-btn is-primary" disabled={busy} onClick={props.onResume}><Play size={15} /> Resume</button> : null}
          {serverRunning ? <button type="button" className="s2-btn is-danger" disabled={busy} onClick={props.onStop}><Square size={14} /> Stop</button> : null}
          {done === scenes.length && scenes.length ? <button type="button" className="s2-btn is-primary" onClick={props.onOpenFinish}>Finish <ArrowRight size={15} /></button> : null}
        </div>
      </div>
      <div className="s2-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Clips done"><span style={{ width: `${pct}%` }} /></div>
      <div className="s2-stack" style={{ marginTop: 16, gap: 10 }}>
        {props.error ? <Banner tone="bad" actions={<button type="button" className="s2-btn is-ghost is-small" onClick={props.onDismissError}>Dismiss</button>}>{props.error}</Banner> : null}
        {hold ? (
          <Banner tone="warn" actions={<>
            <button type="button" className="s2-btn is-primary is-small" disabled={busy || !nothingGenerating} onClick={() => props.onRerender(hold)}><Wand2 size={13} /> Re-render clip {hold.idx + 1}</button>
            <button type="button" className="s2-btn is-ghost is-small" disabled={busy} onClick={props.onKeep}>Keep it and continue</button>
          </>}>
            <b>Clip {hold.idx + 1} looks off.</b> {(props.checks[hold.id]?.issues || []).slice(0, 3).join(' · ')} Production is paused so this frame doesn&rsquo;t carry into the next clip.{!nothingGenerating ? ' Re-render unlocks when the clip in progress finishes.' : ''}
          </Banner>
        ) : null}
        {paused && !hold ? <Banner tone="info" icon={<Pause size={18} />}>Paused. A clip already submitted may still finish; no new clip starts until you resume.</Banner> : null}
        {props.stalled ? <Banner tone="warn">The render server hasn&rsquo;t reported in for a while. We&rsquo;ve nudged it; this usually clears within a couple of minutes.</Banner> : null}
        {film.status === 'cancelled' ? <Banner tone="info" icon={<Square size={16} />}>Stopped. Finished clips are saved.</Banner> : null}
        {props.note && !props.error ? <p className="s2-faint">{props.note}</p> : null}
      </div>
      <div className="s2-clips" style={{ marginTop: 18 }}>
        {scenes.map((scene) => (
          <ClipCard key={scene.id} scene={scene} aspect={film.aspect_ratio || '16:9'} check={props.checks[scene.id] || savedCheck(scene)} checking={props.checkingId === scene.id}
            active={rendering?.id === scene.id} canAct={!busy && nothingGenerating && (!running || paused)}
            onRerender={() => props.onRerender(scene)} onRetry={() => props.onRetry(scene)} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Finish
// ---------------------------------------------------------------------------

export function FinishScreen(props: {
  film: Film;
  scenes: FilmScene[];
  checks: Record<number, ClipCheck>;
  assembly: AssemblyProgress | null;
  busy: boolean;
  error: string;
  onAssemble: () => void;
  onRerender: (scene: FilmScene) => void;
  onBack: () => void;
  onNew: () => void;
}) {
  const { film, busy } = props;
  const scenes = orderScenes(props.scenes);
  const checks = scenes.map((s) => props.checks[s.id] || savedCheck(s));
  const clean = checks.filter((c) => c?.status === 'clean').length;
  const flagged = scenes.filter((s, i) => checks[i]?.status === 'flagged');
  const assembling = film.status === 'assembling' || props.assembly?.running === true;
  const serverOwned = film.plan?.background?.enabled === true && film.status !== 'ready';
  return (
    <div className="s2-page">
      <div className="s2-section-head" style={{ marginBottom: 16 }}>
        <div className="s2-stack" style={{ gap: 6, minWidth: 0 }}>
          <span className="s2-eyebrow">Step 4 · Finish</span>
          <h1 style={{ overflowWrap: 'anywhere' }}>{film.title || 'Your film'}</h1>
        </div>
        <div className="s2-row">
          <button type="button" className="s2-btn is-ghost" onClick={props.onBack}><ArrowLeft size={15} /> Clips</button>
          <button type="button" className="s2-btn" onClick={props.onNew}><Plus size={15} /> New video</button>
        </div>
      </div>
      {props.error ? <div style={{ marginBottom: 14 }}><Banner tone="bad">{props.error}</Banner></div> : null}
      <div className="s2-split">
        <div className="s2-card" style={{ padding: 12 }}>
          {film.final_video_url ? (
            <video src={film.final_video_url} poster={film.final_thumb_url || undefined} controls playsInline style={{ width: '100%', maxHeight: '70vh', borderRadius: 10, background: '#000', display: 'block', aspectRatio: aspectCss(film.aspect_ratio) }} />
          ) : (
            <div style={{ aspectRatio: aspectCss(film.aspect_ratio), maxHeight: '70vh', borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--s2-surface)', padding: 20 }}>
              {assembling || serverOwned ? (
                <div style={{ display: 'grid', gap: 12, width: 'min(100%, 380px)' }}>
                  <div className="s2-row"><Spinner /> <b>{props.assembly?.detail || film.stage_note || 'Assembling your film…'}</b></div>
                  {props.assembly ? <div className="s2-progress"><span style={{ width: `${Math.round(props.assembly.percent)}%` }} /></div> : null}
                  {props.assembly?.steps?.length ? (
                    <div className="s2-tasks">{props.assembly.steps.map((step) => (
                      <div key={step.key} className={`s2-task ${step.status === 'done' ? 'is-done' : step.status === 'active' ? 'is-active' : step.status === 'failed' ? 'is-error' : ''}`} style={{ fontSize: 12.5 }}>
                        <span className="s2-task-dot">{step.status === 'done' ? <Check size={12} /> : step.status === 'active' ? <Spinner size={12} /> : step.status === 'failed' ? <X size={12} /> : null}</span>{step.label}
                      </div>
                    ))}</div>
                  ) : null}
                </div>
              ) : (
                <div style={{ display: 'grid', justifyItems: 'center', gap: 12, textAlign: 'center' }}>
                  <FilmIcon size={28} />
                  <p className="s2-muted">Every clip is ready. Join them into one film.</p>
                  <button type="button" className="s2-btn is-primary" disabled={busy} onClick={props.onAssemble}><Sparkles size={16} /> Assemble film</button>
                </div>
              )}
            </div>
          )}
          {film.final_video_url ? (
            <div className="s2-row s2-between" style={{ padding: '12px 4px 2px' }}>
              <span className="s2-faint">{film.aspect_ratio || '16:9'} · {fmtSeconds(filmSeconds(film, scenes))}</span>
              <div className="s2-row">
                <button type="button" className="s2-btn is-ghost is-small" disabled={busy} onClick={props.onAssemble}><RefreshCw size={13} /> Re-assemble</button>
                <a className="s2-btn is-primary is-small" href={film.final_video_url} download target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><Download size={14} /> Download MP4</a>
              </div>
            </div>
          ) : null}
        </div>
        <aside className="s2-aside">
          <div className="s2-card" style={{ display: 'grid', gap: 12 }}>
            <h3>Clip quality</h3>
            <p className="s2-faint">{clean} of {scenes.length} clips checked clean{flagged.length ? ` · ${flagged.length} look off` : ''}. Checks look at sampled frames for warping, drift and plan match; give the film a watch too.</p>
            <div className="s2-tasks">
              {scenes.map((scene, i) => (
                <div key={scene.id} className="s2-row s2-between" style={{ gap: 8 }}>
                  <span style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scene.idx + 1}. {String((scene.spec as any)?.studio_title || `Clip ${scene.idx + 1}`)}</span>
                  <span className="s2-row" style={{ gap: 6 }}>
                    <QaBadge check={checks[i]} />
                    {checks[i]?.status === 'flagged' || checks[i]?.status === 'unchecked' ? <button type="button" className="s2-btn is-ghost is-small s2-icon-btn" aria-label={`Re-render clip ${scene.idx + 1}`} disabled={busy || serverOwned} onClick={() => props.onRerender(scene)}><Wand2 size={14} /></button> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
