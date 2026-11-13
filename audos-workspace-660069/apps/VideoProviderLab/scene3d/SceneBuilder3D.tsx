/**
 * VIDEO PROVIDER LAB — 3D Scene Builder.
 *
 * Compose a scene from primitives, props, stand-in characters, uploaded GLB
 * models and image billboards; light it with a preset; save camera angles as
 * shots; keyframe a short move; then render a still, record a clip, hand the
 * render to a Lab video model, or stylise it with the image model.
 *
 * Loaded lazily from ./Scene3DMode, and three.js itself is fetched at runtime
 * by ./sceneEngine, so none of this touches the Lab's Generate mode.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  AlertCircle, Award, Bookmark, Camera, CheckCircle2, Circle, Coffee, Copy, Database, Download, Film, Flower2,
  Folder, Hexagon, Home, Image as ImageIcon, Key, Lightbulb, Mountain, Pause, Play, Send, Sparkles, Square,
  Target, Trash2, TrendingUp, Triangle, Type, Upload, UserRound, Users, Wand2, X, Tablet,
} from 'lucide-react';

import { COLORS, FONT as THEME_FONT } from '../../../components/theme';
import {
  ASPECTS, BACKDROPS, CATEGORIES, DEFAULT_CAMERA, LIBRARY, LIGHTING_PRESETS, MATERIALS, MAX_DURATION, MIN_DURATION,
  aspectRatio, createDoc, createElement, displayTransform, exportSize, hasAnimation, libraryItem, lightingPreset,
  newId, removeKeyAt, upsertKey,
} from './sceneModel';
import type {
  CategoryId, ElementKind, LightingId, SceneDoc, SceneElement, SceneHandoff, Transform, Vec3,
} from './sceneModel';
import { SceneEngine, loadThree, webglSupport } from './sceneEngine';
import type { GizmoMode } from './sceneEngine';
import {
  databaseAvailable, debounce, deleteScene, listScenes, readDraft, saveScene, writeDraft,
} from './sceneStore';
import type { SavedScene } from './sceneStore';
import {
  MAX_IMAGE_BYTES, MAX_MODEL_BYTES, STYLE_PRESETS, ensureDataUrl, safeFileName, saveClipToHistory, styliseImage,
  triggerDownload, uploadSceneFile,
} from './sceneOutputs';

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------

const FONT = THEME_FONT.body;
const MONO = THEME_FONT.mono;
const STYLE_ID = 'vpl-scene3d-styles';
const MAX_ELEMENTS = 200;

const ICONS: Record<ElementKind, any> = {
  cube: Square, sphere: Circle, cylinder: Database, cone: Triangle, torus: Target, plane: Tablet, text: Type,
  pedestal: Award, table: Coffee, chair: Home, lamp: Lightbulb, plant: Flower2, arch: Mountain, stairs: TrendingUp,
  mannequin: UserRound, figure: Users, model: Hexagon, billboard: ImageIcon,
};

function useBuilderStyles() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.s3d-root{display:grid;grid-template-columns:236px minmax(0,1fr) 316px;height:100%;min-height:0;width:100%}',
      '.s3d-side{min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}',
      '.s3d-center{min-width:0;min-height:0;display:flex;flex-direction:column}',
      '@media(max-width:1180px){.s3d-root{grid-template-columns:200px minmax(0,1fr) 284px}}',
      '@media(max-width:900px){.s3d-root{display:flex;flex-direction:column;overflow-y:auto}.s3d-side{overflow:visible}.s3d-center{min-height:440px;flex:0 0 auto}.s3d-stage{min-height:300px}}',
      '.s3d-btn{transition:filter 120ms cubic-bezier(.2,0,0,1),background 120ms cubic-bezier(.2,0,0,1);cursor:pointer;font-family:inherit}',
      '.s3d-btn:hover:not(:disabled){filter:brightness(1.15)}',
      '.s3d-btn:disabled{opacity:.42;cursor:not-allowed}',
      `.s3d-btn:focus-visible,.s3d-field:focus-visible{outline:2px solid ${COLORS.focus};outline-offset:3px}`,
      `.s3d-field{background:${COLORS.input};color:${COLORS.text};border:1px solid ${COLORS.controlBorder};border-radius:10px;padding:0 10px;min-height:36px;font-size:12.5px;font-family:inherit;min-width:0;box-sizing:border-box;width:100%}`,
      'textarea.s3d-field{padding:8px 10px;resize:vertical;line-height:1.5}',
      '.s3d-range{width:100%;accent-color:#d4af37}',
      `.s3d-side::-webkit-scrollbar{width:6px}.s3d-side::-webkit-scrollbar-thumb{background:${COLORS.border};border-radius:6px}`,
      '@media (prefers-reduced-motion: reduce){.s3d-btn{transition:none}}',
    ].join('\n');
    document.head.appendChild(style);
  }, []);
}

const panelTitle: CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: COLORS.textFaint, margin: 0 };
const helperText: CSSProperties = { fontSize: 11, color: COLORS.textFaint, lineHeight: 1.5, margin: 0 };
const card: CSSProperties = { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 };

function Btn({ children, onClick, disabled, primary, active, title, small, style }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  active?: boolean;
  title?: string;
  small?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      className="s3d-btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active === undefined ? undefined : active}
      style={{
        minHeight: small ? 32 : 40,
        padding: small ? '0 10px' : '0 14px',
        borderRadius: 10,
        border: primary ? 'none' : `1px solid ${active ? COLORS.accent : COLORS.border}`,
        background: primary ? COLORS.accent : active ? COLORS.accentSoft : COLORS.raised,
        color: primary ? COLORS.onAccent : active ? COLORS.text : COLORS.secondary,
        fontSize: small ? 11.5 : 12.5,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Keeps its own text so a value can be cleared and retyped; reports only values that parse. */
function NumberField({ value, onCommit, step = 0.1, min, max, label, width }: {
  value: number;
  onCommit: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label?: string;
  width?: number | string;
}) {
  const shown = (next: number) => String(Math.round(next * 1000) / 1000);
  const [text, setText] = useState(shown(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(shown(value));
  }, [value]);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, width }}>
      {label ? <span style={{ fontSize: 9.5, fontWeight: 800, color: COLORS.textFaint, letterSpacing: 0.5 }}>{label}</span> : null}
      <input
        className="s3d-field"
        type="number"
        value={text}
        step={step}
        min={min}
        max={max}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setText(shown(value)); }}
        onChange={(event) => {
          setText(event.target.value);
          let next = Number(event.target.value);
          if (event.target.value.trim() === '' || !Number.isFinite(next)) return;
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          onCommit(next);
        }}
        style={{ fontFamily: MONO, fontSize: 12, padding: '0 6px' }}
      />
    </label>
  );
}

function Thumb({ src, swatch, Icon, size = 40 }: { src?: string; swatch: string; Icon: any; size?: number }) {
  const [failed, setFailed] = useState(false);
  const usable = src && !failed;
  return (
    <span
      aria-hidden="true"
      style={{
        width: Math.round(size * 1.6), height: size, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
        background: usable ? COLORS.bg : swatch, border: `1px solid ${COLORS.border}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {usable
        ? <img src={src} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <Icon size={Math.round(size * 0.42)} color="rgba(255,255,255,0.85)" />}
    </span>
  );
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const text = String(error || '');
  return text && text !== '[object Object]' ? text : 'Something went wrong.';
}

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

const CATEGORY_SWATCH: Record<CategoryId, string> = {
  primitives: 'linear-gradient(135deg,#3a3f4d,#1a1d26)',
  props: 'linear-gradient(135deg,#5a4a36,#1a1d26)',
  characters: 'linear-gradient(135deg,#4d4a5e,#1a1d26)',
  uploads: 'linear-gradient(135deg,#29251a,#1a1d26)',
};
const CATEGORY_ICON: Record<CategoryId, any> = { primitives: Square, props: Coffee, characters: UserRound, uploads: Upload };

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

type Status = 'checking' | 'unsupported' | 'loading' | 'ready' | 'error';
type PanelTab = 'element' | 'scene' | 'shots' | 'render';
type SaveState = 'idle' | 'saving' | 'saved' | 'local';
type Notice = { tone: 'info' | 'good' | 'warn' | 'error'; text: string } | null;

interface ClipResult {
  url: string;
  blob: Blob;
  extension: string;
  duration: number;
  savedUrl: string;
  listed: boolean;
}

export interface SceneBuilder3DProps {
  onSendToLab: (handoff: SceneHandoff) => void;
  activeModelName: string;
}

export default function SceneBuilder3D({ onSendToLab, activeModelName }: SceneBuilder3DProps) {
  useBuilderStyles();

  const initial = useMemo(() => readDraft(), []);
  const [doc, setDoc] = useState<SceneDoc>(() => initial?.doc || createDoc());
  const docRef = useRef(doc);
  const [sceneId, setSceneId] = useState<number | null>(initial?.sceneId ?? null);
  const sceneIdRef = useRef(sceneId);
  const history = useRef<{ past: SceneDoc[]; future: SceneDoc[] }>({ past: [], future: [] });
  const [, setHistoryTick] = useState(0);
  const coalesce = useRef({ key: '', at: 0 });

  const [status, setStatus] = useState<Status>('checking');
  const [statusText, setStatusText] = useState('');
  const [engineKey, setEngineKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');
  const gizmoModeRef = useRef(gizmoMode);
  gizmoModeRef.current = gizmoMode;
  const [tab, setTab] = useState<PanelTab>('element');
  const [category, setCategory] = useState<CategoryId>('primitives');
  const [thumbs, setThumbs] = useState<{ lighting: Partial<Record<LightingId, string>>; categories: Partial<Record<CategoryId, string>> }>({ lighting: {}, categories: {} });
  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(0);
  playheadRef.current = playhead;
  const [playing, setPlaying] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveText, setSaveText] = useState('');
  const [scenes, setScenes] = useState<SavedScene[]>([]);
  const [scenesState, setScenesState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [assetErrors, setAssetErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [fov, setFov] = useState(doc.camera.fov);

  const [still, setStill] = useState('');
  const [clip, setClip] = useState<ClipResult | null>(null);
  const [recording, setRecording] = useState<number | null>(null);
  const recordingRef = useRef(false);
  const [clipSaving, setClipSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRole, setAiRole] = useState<SceneHandoff['role']>('seed');
  const [firstShot, setFirstShot] = useState('');
  const [lastShot, setLastShot] = useState('');
  const [styleId, setStyleId] = useState(STYLE_PRESETS[0].id);
  const [styleNotes, setStyleNotes] = useState('');
  const [stylised, setStylised] = useState<{ busy: boolean; url: string; error: string }>({ busy: false, url: '', error: '' });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SceneEngine | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const selected = doc.elements.find((element) => element.id === selectedId) || null;
  const flash = useCallback((tone: NonNullable<Notice>['tone'], text: string) => setNotice({ tone, text }), []);

  useEffect(() => {
    if (!notice || notice.tone === 'error') return undefined;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  // -------------------------------------------------------------------------
  // Document + history
  // -------------------------------------------------------------------------

  const applyDoc = useCallback((next: SceneDoc) => {
    docRef.current = next;
    setDoc(next);
  }, []);

  /** Every edit goes through here. Edits sharing a key within ~1s (typing, dragging a slider) are one undo step. */
  const commit = useCallback((recipe: (current: SceneDoc) => SceneDoc, key = '') => {
    const prev = docRef.current;
    const next = recipe(prev);
    if (next === prev) return;
    const now = Date.now();
    const merge = key !== '' && coalesce.current.key === key && now - coalesce.current.at < 1000;
    coalesce.current = { key, at: now };
    if (!merge) history.current.past = [...history.current.past.slice(-79), prev];
    history.current.future = [];
    setHistoryTick((value) => value + 1);
    applyDoc(next);
  }, [applyDoc]);

  const undo = useCallback(() => {
    const past = history.current.past;
    if (!past.length) return;
    const prev = past[past.length - 1];
    history.current.past = past.slice(0, -1);
    history.current.future = [docRef.current, ...history.current.future].slice(0, 80);
    coalesce.current = { key: '', at: 0 };
    setHistoryTick((value) => value + 1);
    applyDoc(prev);
  }, [applyDoc]);

  const redo = useCallback(() => {
    const future = history.current.future;
    if (!future.length) return;
    const next = future[0];
    history.current.future = future.slice(1);
    history.current.past = [...history.current.past, docRef.current].slice(-80);
    coalesce.current = { key: '', at: 0 };
    setHistoryTick((value) => value + 1);
    applyDoc(next);
  }, [applyDoc]);

  const resetHistory = useCallback(() => {
    history.current = { past: [], future: [] };
    coalesce.current = { key: '', at: 0 };
    setHistoryTick((value) => value + 1);
  }, []);

  const updateElement = useCallback((id: string, patch: Partial<SceneElement>, key = '') => {
    commit((current) => ({
      ...current,
      elements: current.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
    }), key);
  }, [commit]);

  /** Keyed elements get a key at the playhead (auto-key); others move their base pose. */
  const commitTransform = useCallback((id: string, transform: Transform, key = '') => {
    commit((current) => {
      const track = current.animation.elements[id];
      if (track && track.length) {
        return {
          ...current,
          animation: {
            ...current.animation,
            elements: { ...current.animation.elements, [id]: upsertKey(track, { t: r2(playheadRef.current), ...transform }) },
          },
        };
      }
      return {
        ...current,
        elements: current.elements.map((element) => (
          element.id === id ? { ...element, position: transform.position, rotation: transform.rotation, scale: transform.scale } : element
        )),
      };
    }, key);
  }, [commit]);
  const commitTransformRef = useRef(commitTransform);
  commitTransformRef.current = commitTransform;

  const addElement = useCallback((kind: ElementKind, extra: Partial<SceneElement> = {}): SceneElement | null => {
    if (docRef.current.elements.length >= MAX_ELEMENTS) {
      flash('warn', `A scene holds up to ${MAX_ELEMENTS} elements.`);
      return null;
    }
    const target = engineRef.current?.getView().target || DEFAULT_CAMERA.target;
    const item = libraryItem(kind);
    const spread = ((docRef.current.elements.length % 5) - 2) * 0.2;
    const element = createElement(kind, { position: [r2(target[0] + spread), item ? item.y : 0, r2(target[2])], ...extra });
    commit((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(element.id);
    setTab('element');
    return element;
  }, [commit, flash]);

  const duplicateElement = useCallback((id: string) => {
    const source = docRef.current.elements.find((element) => element.id === id);
    if (!source) return;
    if (docRef.current.elements.length >= MAX_ELEMENTS) {
      flash('warn', `A scene holds up to ${MAX_ELEMENTS} elements.`);
      return;
    }
    const shift = (value: Vec3): Vec3 => [r2(value[0] + 0.6), value[1], value[2]];
    const copy: SceneElement = { ...source, id: newId('el'), name: `${source.name} copy`.slice(0, 80), position: shift(source.position) };
    commit((current) => {
      const track = current.animation.elements[id];
      return {
        ...current,
        elements: [...current.elements, copy],
        animation: track?.length
          ? { ...current.animation, elements: { ...current.animation.elements, [copy.id]: track.map((key) => ({ ...key, position: shift(key.position) })) } }
          : current.animation,
      };
    });
    setSelectedId(copy.id);
  }, [commit, flash]);

  const deleteElement = useCallback((id: string) => {
    commit((current) => {
      const { [id]: _removed, ...rest } = current.animation.elements;
      return { ...current, elements: current.elements.filter((element) => element.id !== id), animation: { ...current.animation, elements: rest } };
    });
    setSelectedId((value) => (value === id ? null : value));
  }, [commit]);

  useEffect(() => {
    if (selectedId && !doc.elements.some((element) => element.id === selectedId)) setSelectedId(null);
  }, [doc.elements, selectedId]);

  // -------------------------------------------------------------------------
  // Engine
  // -------------------------------------------------------------------------

  const scheduleSaveRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    const support = webglSupport();
    if (!support.ok) {
      setStatus('unsupported');
      setStatusText(support.reason);
      return undefined;
    }
    setStatus('loading');
    setStatusText('Downloading the 3D engine…');
    loadThree().then((lib) => {
      if (cancelled || !hostRef.current) return;
      let engine: SceneEngine;
      try {
        engine = new SceneEngine(lib, hostRef.current, {
          onSelect: (id) => {
            setSelectedId(id);
            if (id) setTab('element');
          },
          onTransformEnd: (id, transform) => commitTransformRef.current(id, transform),
          onAssetError: (id, text) => setAssetErrors((prev) => ({ ...prev, [id]: text })),
          onContextLost: () => {
            setStatus('error');
            setStatusText('The 3D view lost its graphics context (the GPU reset, or too many 3D tabs are open). Reload the view to carry on — your scene is safe.');
          },
          onViewEnd: () => scheduleSaveRef.current(),
        });
      } catch (error) {
        setStatus('error');
        setStatusText(errorText(error));
        return;
      }
      engineRef.current = engine;
      engine.setDoc(docRef.current);
      engine.setView(docRef.current.camera);
      engine.setGizmoMode(gizmoModeRef.current);
      engine.setPlayhead(playheadRef.current, false);
      try { setThumbs(engine.renderThumbnails()); } catch { /* swatch fallbacks stay */ }
      setStatus('ready');
    }).catch((error) => {
      if (cancelled) return;
      setStatus('error');
      setStatusText(errorText(error));
    });
    return () => {
      cancelled = true;
      const engine = engineRef.current;
      if (engine) {
        docRef.current = { ...docRef.current, camera: engine.getView() };
        writeDraft(docRef.current, sceneIdRef.current);
        engine.dispose();
      }
      engineRef.current = null;
    };
  }, [engineKey]);

  useEffect(() => {
    if (status === 'ready') engineRef.current?.setDoc(doc);
  }, [doc, status]);

  useEffect(() => {
    if (status === 'ready') engineRef.current?.select(selectedId);
  }, [selectedId, status]);

  useEffect(() => {
    if (status === 'ready') engineRef.current?.setGizmoMode(gizmoMode);
  }, [gizmoMode, status]);

  useEffect(() => {
    if (status === 'ready' && !playing) engineRef.current?.setPlayhead(playhead, true);
  }, [playhead, status]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => {
      const width = Math.max(0, stage.clientWidth - 24);
      const height = Math.max(0, stage.clientHeight - 24);
      const ratio = aspectRatio(doc.aspect);
      let w = width;
      let h = width / ratio;
      if (h > height) { h = height; w = height * ratio; }
      setBox({ width: Math.floor(w), height: Math.floor(h) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [doc.aspect, status]);

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  const saveChain = useRef<Promise<void>>(Promise.resolve());

  const enqueueSave = useCallback(() => {
    saveChain.current = saveChain.current.then(async () => {
      const engine = engineRef.current;
      const current: SceneDoc = { ...docRef.current, camera: engine ? engine.getView() : docRef.current.camera };
      writeDraft(current, sceneIdRef.current);
      if (!databaseAvailable()) {
        setSaveState('local');
        setSaveText('Saved on this device — the workspace database is not available here.');
        return;
      }
      setSaveState('saving');
      let thumbnail: string | null = null;
      try {
        if (engine && !engine.isPlaying() && !recordingRef.current) {
          const size = exportSize(current.aspect, 320);
          thumbnail = engine.renderStill(size.width, size.height, { mime: 'image/jpeg', quality: 0.7 });
        }
      } catch { /* the row saves without a preview */ }
      try {
        const id = await saveScene(current, sceneIdRef.current, thumbnail);
        if (sceneIdRef.current !== id) {
          sceneIdRef.current = id;
          setSceneId(id);
          writeDraft(current, id);
        }
        setSaveState('saved');
        setSaveText('Saved');
      } catch (error) {
        setSaveState('local');
        setSaveText(`Saved on this device only: ${errorText(error)}`);
      }
    });
    return saveChain.current;
  }, []);

  const autosave = useMemo(() => debounce(() => { void enqueueSave(); }, 1500), [enqueueSave]);
  scheduleSaveRef.current = () => autosave.call();

  const firstDoc = useRef(true);
  useEffect(() => {
    if (firstDoc.current) { firstDoc.current = false; return; }
    writeDraft(doc, sceneIdRef.current);
    autosave.call();
  }, [doc, autosave]);

  useEffect(() => () => autosave.flush(), [autosave]);

  const refreshScenes = useCallback(async () => {
    setScenesState('loading');
    try {
      setScenes(await listScenes());
    } finally {
      setScenesState('ready');
    }
  }, []);

  useEffect(() => {
    if (tab === 'scene' && scenesState === 'idle') void refreshScenes();
  }, [tab, scenesState, refreshScenes]);

  const openDoc = useCallback(async (next: SceneDoc, id: number | null) => {
    autosave.cancel();
    await enqueueSave();
    engineRef.current?.stop();
    setPlaying(false);
    setPlayhead(0);
    setSelectedId(null);
    setAssetErrors({});
    sceneIdRef.current = id;
    setSceneId(id);
    resetHistory();
    applyDoc(next);
    setFov(next.camera.fov);
    engineRef.current?.setView(next.camera);
    writeDraft(next, id);
    setSaveState(id ? 'saved' : 'idle');
    setSaveText(id ? 'Saved' : '');
    void refreshScenes();
  }, [applyDoc, autosave, enqueueSave, refreshScenes, resetHistory]);

  const removeScene = useCallback(async (scene: SavedScene) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${scene.name}"? This cannot be undone.`)) return;
    await deleteScene(scene.id);
    if (sceneIdRef.current === scene.id) await openDoc(createDoc(), null);
    else void refreshScenes();
  }, [openDoc, refreshScenes]);

  // -------------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
      const root = rootRef.current;
      const inside = !!(target && root && root.offsetParent !== null && (root.contains(target) || target === document.body));
      if (!inside || status !== 'ready' || recordingRef.current) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if (mod && key === 'y') { event.preventDefault(); redo(); return; }
      if (mod && key === 'd') { event.preventDefault(); if (selectedId) duplicateElement(selectedId); return; }
      if (mod) return;
      if (key === 'w') setGizmoMode('translate');
      else if (key === 'e') setGizmoMode('rotate');
      else if (key === 'r') setGizmoMode('scale');
      else if (key === 'escape') setSelectedId(null);
      else if ((key === 'delete' || key === 'backspace') && selectedId) { event.preventDefault(); deleteElement(selectedId); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteElement, duplicateElement, redo, selectedId, status, undo]);

  // -------------------------------------------------------------------------
  // Uploads
  // -------------------------------------------------------------------------

  const placeUpload = useCallback(async (file: File, kind: 'model' | 'billboard') => {
    const isModel = kind === 'model';
    const name = file.name || (isModel ? 'model.glb' : 'image.png');
    if (isModel && !/\.(glb|gltf)$/i.test(name)) { flash('warn', `${name} is not a .glb or .gltf file.`); return; }
    if (!isModel && !/^image\/(png|jpeg|webp)$/i.test(file.type)) { flash('warn', `${name} is not a PNG, JPEG or WebP image.`); return; }
    const limit = isModel ? MAX_MODEL_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) { flash('warn', `${name} is over the ${Math.round(limit / 1024 / 1024)}MB limit.`); return; }
    const local = URL.createObjectURL(file);
    setBusy(`Uploading ${name}…`);
    let url = local;
    let stored = false;
    try {
      url = await uploadSceneFile(file, isModel ? 'vpl-scene3d-models' : 'vpl-scene3d-images');
      engineRef.current?.registerAssetAlias(url, local);
      stored = true;
    } catch (error) {
      flash('warn', `${name} could not be uploaded (${errorText(error)}). It is placed for this session only and will not be saved with the scene.`);
    } finally {
      setBusy('');
    }
    const base = name.replace(/\.[^.]+$/, '').slice(0, 60) || (isModel ? '3D model' : 'Image');
    addElement(kind, { name: base, assetUrl: url, assetName: name, color: '#ffffff', material: 'matte' });
    if (stored) flash('good', `${name} added to the scene.`);
  }, [addElement, flash]);

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------

  const lastTick = useRef(0);
  const togglePlay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.isPlaying()) {
      engine.stop();
      setPlaying(false);
      return;
    }
    const duration = docRef.current.animation.duration;
    const from = playheadRef.current >= duration - 0.02 ? 0 : playheadRef.current;
    setPlaying(true);
    lastTick.current = 0;
    engine.play(from, (t) => {
      const now = performance.now();
      if (now - lastTick.current > 66) { lastTick.current = now; setPlayhead(r2(t)); }
    }, () => {
      setPlaying(false);
      setPlayhead(docRef.current.animation.duration);
    });
  }, []);

  const scrub = useCallback((t: number) => {
    engineRef.current?.stop();
    setPlaying(false);
    setPlayhead(Math.max(0, Math.min(docRef.current.animation.duration, r2(t))));
  }, []);

  const keySelected = useCallback(() => {
    if (!selected) return;
    const current = displayTransform(docRef.current, selected, playheadRef.current);
    commit((d) => ({
      ...d,
      animation: { ...d.animation, elements: { ...d.animation.elements, [selected.id]: upsertKey(d.animation.elements[selected.id], { t: r2(playheadRef.current), ...current }) } },
    }));
    flash('info', `Key set for ${selected.name} at ${playheadRef.current.toFixed(1)}s. Move the playhead and transform it again to add the next key.`);
  }, [commit, flash, selected]);

  const unkeySelected = useCallback((all: boolean) => {
    if (!selected) return;
    const pose = displayTransform(docRef.current, selected, playheadRef.current);
    commit((d) => {
      const remaining = all ? [] : removeKeyAt(d.animation.elements[selected.id], playheadRef.current);
      const { [selected.id]: _gone, ...rest } = d.animation.elements;
      const elements = remaining.length ? { ...rest, [selected.id]: remaining } : rest;
      return {
        ...d,
        // Keep the pose the element shows now as its base, so clearing keys does not make it jump.
        elements: remaining.length ? d.elements : d.elements.map((element) => (element.id === selected.id ? { ...element, ...pose } : element)),
        animation: { ...d.animation, elements },
      };
    });
  }, [commit, selected]);

  const keyCamera = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const view = engine.getView();
    commit((d) => ({ ...d, animation: { ...d.animation, camera: upsertKey(d.animation.camera, { t: r2(playheadRef.current), ...view }) } }));
    flash('info', `Camera key set at ${playheadRef.current.toFixed(1)}s.`);
  }, [commit, flash]);

  const clearCameraKeys = useCallback(() => {
    commit((d) => ({ ...d, animation: { ...d.animation, camera: [] } }));
  }, [commit]);

  // -------------------------------------------------------------------------
  // Shots
  // -------------------------------------------------------------------------

  const saveShot = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const view = engine.getView();
    commit((d) => ({ ...d, shots: [...d.shots, { id: newId('shot'), name: `Shot ${d.shots.length + 1}`, ...view }].slice(0, 30) }));
  }, [commit]);

  const goToShot = useCallback((view: { position: Vec3; target: Vec3; fov: number }) => {
    engineRef.current?.setView(view);
    setFov(view.fov);
    scheduleSaveRef.current();
  }, []);

  // -------------------------------------------------------------------------
  // Outputs
  // -------------------------------------------------------------------------

  const renderCurrent = useCallback((longSide: number, mime: string, quality?: number, view?: { position: Vec3; target: Vec3; fov: number }) => {
    const engine = engineRef.current;
    if (!engine) throw new Error('The 3D view is not ready yet.');
    const size = exportSize(docRef.current.aspect, longSide);
    return engine.renderStill(size.width, size.height, { mime, quality, view });
  }, []);

  const exportStill = useCallback(() => {
    try {
      const url = renderCurrent(1920, 'image/png');
      setStill(url);
      triggerDownload(url, `${safeFileName(docRef.current.name, 'scene')}-${docRef.current.aspect.replace(':', 'x')}.png`);
    } catch (error) {
      flash('error', `The still could not be rendered: ${errorText(error)}`);
    }
  }, [flash, renderCurrent]);

  const recordClip = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const support = SceneEngine.recordingSupport();
    if (!support.ok) { flash('warn', support.reason); return; }
    engine.stop();
    setPlaying(false);
    const current = docRef.current;
    const size = exportSize(current.aspect, 1280);
    const turntable = !hasAnimation(current);
    setSelectedId(null);
    recordingRef.current = true;
    setRecording(0);
    let shown = 0;
    try {
      const result = await engine.recordClip({
        width: size.width,
        height: size.height,
        duration: current.animation.duration,
        turntable,
        onProgress: (fraction) => {
          if (fraction - shown >= 0.04 || fraction >= 1) { shown = fraction; setRecording(fraction); }
        },
      });
      setClip((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(result.blob), blob: result.blob, extension: result.extension, duration: current.animation.duration, savedUrl: '', listed: false };
      });
      if (turntable) flash('info', 'No keyframes yet, so the clip is a slow orbit of the current view.');
    } catch (error) {
      if (errorText(error) !== 'Recording cancelled.') flash('error', errorText(error));
    } finally {
      recordingRef.current = false;
      setRecording(null);
    }
  }, [flash]);

  const saveClip = useCallback(async () => {
    if (!clip || clipSaving) return;
    setClipSaving(true);
    try {
      const saved = await saveClipToHistory({ blob: clip.blob, extension: clip.extension, title: docRef.current.name, durationSec: clip.duration });
      setClip((prev) => (prev ? { ...prev, savedUrl: saved.url, listed: saved.listed } : prev));
      flash(saved.listed ? 'good' : 'warn', saved.listed
        ? 'Clip saved to Your videos.'
        : 'Clip uploaded, but Your videos could not be updated (sign in to keep a history). The link below still works.');
    } catch (error) {
      flash('error', `The clip could not be uploaded: ${errorText(error)}`);
    } finally {
      setClipSaving(false);
    }
  }, [clip, clipSaving, flash]);

  const shots = doc.shots;
  useEffect(() => {
    if (!shots.length) { setFirstShot(''); setLastShot(''); return; }
    const first = shots.some((shot) => shot.id === firstShot) ? firstShot : shots[0].id;
    let last = shots.some((shot) => shot.id === lastShot) ? lastShot : shots[shots.length - 1].id;
    if (shots.length > 1 && last === first) last = (shots.slice().reverse().find((shot) => shot.id !== first) || shots[0]).id;
    if (first !== firstShot) setFirstShot(first);
    if (last !== lastShot) setLastShot(last);
  }, [shots, firstShot, lastShot]);

  const sendToLab = useCallback((imageOverride?: string) => {
    try {
      const current = docRef.current;
      const prompt = aiPrompt.trim().length >= 10 ? aiPrompt.trim() : 'Make this scene come alive with natural, cinematic motion.';
      let images: string[] = [];
      let role: SceneHandoff['role'] = imageOverride ? 'seed' : aiRole;
      if (imageOverride) {
        images = [imageOverride];
      } else if (role === 'frames') {
        const a = current.shots.find((shot) => shot.id === firstShot);
        const b = current.shots.find((shot) => shot.id === lastShot);
        if (!a || !b || a.id === b.id) { flash('warn', 'Pick two different saved shots for the first and last frame.'); return; }
        images = [renderCurrent(1280, 'image/jpeg', 0.9, a), renderCurrent(1280, 'image/jpeg', 0.9, b)];
      } else if (role === 'reference') {
        images = [renderCurrent(1280, 'image/jpeg', 0.9), ...current.shots.slice(0, 2).map((shot) => renderCurrent(1280, 'image/jpeg', 0.9, shot))];
      } else {
        role = 'seed';
        images = [renderCurrent(1280, 'image/jpeg', 0.9)];
      }
      onSendToLab({ images, role, prompt, aspectRatio: current.aspect });
    } catch (error) {
      flash('error', `The render could not be prepared: ${errorText(error)}`);
    }
  }, [aiPrompt, aiRole, firstShot, flash, lastShot, onSendToLab, renderCurrent]);

  const runStylise = useCallback(async () => {
    setStylised({ busy: true, url: '', error: '' });
    try {
      const source = renderCurrent(1280, 'image/jpeg', 0.92);
      const url = await styliseImage({ imageDataUrl: source, styleId, notes: styleNotes, aspect: docRef.current.aspect });
      setStylised({ busy: false, url, error: '' });
    } catch (error) {
      setStylised({ busy: false, url: '', error: errorText(error) });
    }
  }, [renderCurrent, styleId, styleNotes]);

  const animateStylised = useCallback(async () => {
    if (!stylised.url) return;
    try {
      sendToLab(await ensureDataUrl(stylised.url));
    } catch (error) {
      flash('error', `The stylised image could not be attached: ${errorText(error)}`);
    }
  }, [flash, sendToLab, stylised.url]);

  useEffect(() => () => { if (clip?.url) URL.revokeObjectURL(clip.url); }, [clip?.url]);

  // -------------------------------------------------------------------------
  // Surface
  // -------------------------------------------------------------------------

  if (status === 'unsupported') {
    return (
      <div role="alert" style={{ margin: 'auto', maxWidth: 460, padding: 24, textAlign: 'center', color: COLORS.text, fontFamily: FONT }}>
        <AlertCircle size={22} color={COLORS.warning} />
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>3D isn’t available on this device</div>
        <p style={{ ...helperText, fontSize: 12.5, marginTop: 8 }}>
          {statusText} Turn on hardware acceleration in your browser settings, or open Vidverge in a current version of Chrome, Edge, Safari or Firefox. The Generate tab still works as normal.
        </p>
      </div>
    );
  }

  const ready = status === 'ready';
  const track = selected ? doc.animation.elements[selected.id] || [] : [];
  const shownTransform = selected ? displayTransform(doc, selected, playhead) : null;
  const duration = doc.animation.duration;
  const animated = hasAnimation(doc);
  const recordingSupport = SceneEngine.recordingSupport();
  const elementsInCategory = LIBRARY.filter((item) => item.category === category);
  const categoryDef = CATEGORIES.find((item) => item.id === category) || CATEGORIES[0];

  const transformRow = (label: string, field: keyof Transform, step: number, min?: number) => (
    <div>
      <div style={{ ...panelTitle, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
        {(['X', 'Y', 'Z'] as const).map((axis, index) => (
          <NumberField
            key={axis}
            label={axis}
            step={step}
            min={min}
            value={shownTransform ? shownTransform[field][index] : 0}
            onCommit={(next) => {
              if (!selected || !shownTransform) return;
              const value = [...shownTransform[field]] as Vec3;
              value[index] = next;
              commitTransform(selected.id, { ...shownTransform, [field]: value }, `num:${selected.id}:${field}:${index}`);
            }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="s3d-root" style={{ color: COLORS.text, fontFamily: FONT, background: COLORS.bg }}>
      {/* Library + outliner */}
      <aside className="s3d-side" style={{ borderRight: `1px solid ${COLORS.border}`, background: COLORS.surface }} aria-label="Element library">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 style={panelTitle}>Library</h3>
          <div role="tablist" aria-label="Element categories" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {CATEGORIES.map((item) => {
              const active = item.id === category;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="s3d-btn"
                  onClick={() => setCategory(item.id)}
                  title={item.helper}
                  style={{
                    padding: 6, borderRadius: 10, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 5,
                    border: `1px solid ${active ? COLORS.accent : COLORS.border}`, background: active ? COLORS.accentSoft : COLORS.bg, color: COLORS.text,
                  }}
                >
                  <Thumb src={thumbs.categories[item.id]} swatch={CATEGORY_SWATCH[item.id]} Icon={CATEGORY_ICON[item.id]} size={44} />
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>{item.label}</span>
                </button>
              );
            })}
          </div>
          <p style={helperText}>{categoryDef.helper}</p>
        </div>

        {category === 'uploads' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              ref={modelInputRef}
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void placeUpload(file, 'model');
              }}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void placeUpload(file, 'billboard');
              }}
            />
            <Btn onClick={() => modelInputRef.current?.click()} disabled={!ready || Boolean(busy)}><Hexagon size={14} /> Upload GLB / GLTF</Btn>
            <p style={helperText}>One .glb file, or a .gltf with textures embedded, up to 50MB. It is scaled to about 1.6 m and stood on the floor.</p>
            <Btn onClick={() => imageInputRef.current?.click()} disabled={!ready || Boolean(busy)}><ImageIcon size={14} /> Upload image billboard</Btn>
            <p style={helperText}>PNG, JPEG or WebP up to 10MB, shown as a standing 1.5 m card. Transparent PNGs become cut-outs.</p>
            {busy ? <p style={{ ...helperText, color: COLORS.accent }}>{busy}</p> : null}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {elementsInCategory.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <button
                  key={item.kind}
                  type="button"
                  className="s3d-btn"
                  disabled={!ready}
                  onClick={() => addElement(item.kind)}
                  title={`Add ${item.label}: ${item.helper}`}
                  style={{
                    minHeight: 54, padding: '7px 8px', borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.bg,
                    color: COLORS.text, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                    <Icon size={13} color={COLORS.accent} /> {item.label}
                  </span>
                  <span style={{ fontSize: 10, color: COLORS.textFaint, lineHeight: 1.3 }}>{item.helper}</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h3 style={panelTitle}>{`In this scene (${doc.elements.length})`}</h3>
          {!doc.elements.length ? <p style={helperText}>Empty. Add something from the library above.</p> : null}
          {doc.elements.map((element) => {
            const Icon = ICONS[element.kind];
            const active = element.id === selectedId;
            const keyed = (doc.animation.elements[element.id] || []).length > 0;
            return (
              <button
                key={element.id}
                type="button"
                className="s3d-btn"
                onClick={() => { setSelectedId(element.id); setTab('element'); }}
                style={{
                  minHeight: 34, padding: '0 8px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7, textAlign: 'left',
                  border: `1px solid ${active ? COLORS.accent : 'transparent'}`, background: active ? COLORS.accentSoft : 'transparent', color: COLORS.text, fontSize: 12,
                }}
              >
                <Icon size={13} color={active ? COLORS.accent : COLORS.textFaint} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{element.name}</span>
                {keyed ? <Key size={11} color={COLORS.accent} aria-label="animated" /> : null}
                {assetErrors[element.id] ? <AlertCircle size={12} color={COLORS.error} aria-label="file problem" /> : null}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Viewport */}
      <section className="s3d-center" aria-label="3D viewport">
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '8px 12px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
          {([['translate', 'Move', 'W'], ['rotate', 'Rotate', 'E'], ['scale', 'Scale', 'R']] as const).map(([mode, label, keyHint]) => (
            <Btn key={mode} small active={gizmoMode === mode} onClick={() => setGizmoMode(mode)} title={`${label} the selected element (${keyHint})`}>{label}</Btn>
          ))}
          <span style={{ width: 1, height: 22, background: COLORS.border, margin: '0 2px' }} />
          <Btn small onClick={undo} disabled={!history.current.past.length} title="Undo (Ctrl/Cmd+Z)">Undo</Btn>
          <Btn small onClick={redo} disabled={!history.current.future.length} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</Btn>
          <Btn small onClick={() => selected && duplicateElement(selected.id)} disabled={!selected} title="Duplicate (Ctrl/Cmd+D)"><Copy size={12} /></Btn>
          <Btn small onClick={() => selected && deleteElement(selected.id)} disabled={!selected} title="Delete (Del)"><Trash2 size={12} /></Btn>
          <span style={{ width: 1, height: 22, background: COLORS.border, margin: '0 2px' }} />
          {ASPECTS.map((item) => (
            <Btn key={item.id} small active={doc.aspect === item.id} onClick={() => commit((d) => ({ ...d, aspect: item.id }))} title={`Frame and render at ${item.label}`}>{item.label}</Btn>
          ))}
          <span
            role="status"
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: saveState === 'local' ? COLORS.warning : COLORS.textFaint, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={saveText}
          >
            {saveState === 'saved' ? <CheckCircle2 size={12} color={COLORS.success} /> : saveState === 'local' ? <AlertCircle size={12} /> : null}
            {saveState === 'saving' ? 'Saving…' : saveText || 'Autosaves as you work'}
          </span>
        </div>

        <div ref={stageRef} className="s3d-stage" style={{ flex: '1 1 auto', minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07080b' }}>
          <div
            ref={hostRef}
            style={{ width: box.width, height: box.height, position: 'relative', borderRadius: 6, overflow: 'hidden', boxShadow: `0 0 0 1px ${COLORS.border}`, background: '#111318' }}
          />
          {status !== 'ready' ? (
            <div role={status === 'error' ? 'alert' : 'status'} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ ...card, maxWidth: 420, textAlign: 'center', alignItems: 'center' }}>
                {status === 'error' ? <AlertCircle size={20} color={COLORS.error} /> : null}
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{status === 'error' ? 'The 3D view could not start' : 'Preparing the 3D view'}</div>
                <p style={{ ...helperText, fontSize: 12 }}>{statusText || 'Checking this device…'}</p>
                {status === 'error' ? <Btn primary onClick={() => setEngineKey((value) => value + 1)}>Reload 3D view</Btn> : null}
              </div>
            </div>
          ) : null}
          {recording !== null ? (
            <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14, display: 'flex', alignItems: 'center', gap: 10, ...card, padding: '8px 12px', flexDirection: 'row' }}>
              <Film size={14} color={COLORS.accent} />
              <span style={{ fontSize: 12 }}>{`Recording… ${Math.round(recording * 100)}% — keep this tab visible`}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 4, background: COLORS.border, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(recording * 100)}%`, height: '100%', background: COLORS.accent }} />
              </div>
              <Btn small onClick={() => engineRef.current?.cancelRecording()}>Cancel</Btn>
            </div>
          ) : null}
          {notice ? (
            <div
              role={notice.tone === 'error' ? 'alert' : 'status'}
              style={{
                position: 'absolute', top: 12, left: 12, right: 12, margin: '0 auto', maxWidth: 560, display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '9px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5, color: COLORS.text,
                background: notice.tone === 'error' ? COLORS.dangerBg : notice.tone === 'warn' ? COLORS.warningBg : notice.tone === 'good' ? COLORS.successBg : COLORS.raised,
                border: `1px solid ${notice.tone === 'error' ? COLORS.danger : notice.tone === 'warn' ? COLORS.warning : notice.tone === 'good' ? COLORS.success : COLORS.border}`,
              }}
            >
              <span style={{ flex: 1 }}>{notice.text}</span>
              <button type="button" className="s3d-btn" onClick={() => setNotice(null)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: COLORS.textMuted, padding: 0, display: 'flex' }}><X size={14} /></button>
            </div>
          ) : null}
          {ready && !selected && recording === null ? (
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', fontSize: 10.5, color: 'rgba(245,246,248,0.55)', pointerEvents: 'none' }}>
              Drag to orbit · right-drag to pan · scroll to zoom · click to select · double-click to focus
            </div>
          ) : null}
        </div>

        {/* Timeline */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Btn small onClick={togglePlay} disabled={!ready || recording !== null} title={playing ? 'Pause' : 'Play the animation'}>
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </Btn>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: COLORS.textMuted, minWidth: 86 }}>{`${playhead.toFixed(1)}s / ${duration.toFixed(1)}s`}</span>
            <div style={{ flex: '1 1 200px', minWidth: 160, position: 'relative', paddingTop: 8 }}>
              <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 8 }}>
                {doc.animation.camera.map((key) => (
                  <button key={`c${key.t}`} type="button" onClick={() => scrub(key.t)} title={`Camera key ${key.t.toFixed(1)}s`} tabIndex={-1}
                    style={{ position: 'absolute', left: `calc(${(key.t / duration) * 100}% - 4px)`, top: 0, width: 8, height: 8, borderRadius: 2, border: 'none', padding: 0, background: COLORS.text, cursor: 'pointer' }} />
                ))}
                {track.map((key) => (
                  <button key={`e${key.t}`} type="button" onClick={() => scrub(key.t)} title={`${selected?.name} key ${key.t.toFixed(1)}s`} tabIndex={-1}
                    style={{ position: 'absolute', left: `calc(${(key.t / duration) * 100}% - 4px)`, top: 0, width: 8, height: 8, transform: 'rotate(45deg)', border: 'none', padding: 0, background: COLORS.accent, cursor: 'pointer' }} />
                ))}
              </div>
              <input
                className="s3d-range"
                type="range"
                min={0}
                max={duration}
                step={0.01}
                value={Math.min(playhead, duration)}
                onChange={(event) => scrub(Number(event.target.value))}
                aria-label="Playhead"
              />
            </div>
            <div style={{ width: 74 }}>
              <NumberField
                value={duration}
                step={0.5}
                min={MIN_DURATION}
                max={MAX_DURATION}
                onCommit={(next) => {
                  commit((d) => ({ ...d, animation: { ...d.animation, duration: next } }), 'duration');
                  if (playheadRef.current > next) setPlayhead(next);
                }}
              />
            </div>
            <span style={{ fontSize: 10.5, color: COLORS.textFaint }}>sec</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Btn small onClick={keySelected} disabled={!selected || !ready} title="Record the selected element's pose at the playhead"><Key size={12} /> Key selected</Btn>
            {track.length ? <Btn small onClick={() => unkeySelected(false)}>Remove key here</Btn> : null}
            {track.length ? <Btn small onClick={() => unkeySelected(true)}>Clear element keys</Btn> : null}
            <Btn small onClick={keyCamera} disabled={!ready} title="Record the current camera view at the playhead"><Camera size={12} /> Key camera</Btn>
            {doc.animation.camera.length ? <Btn small onClick={clearCameraKeys}>{`Clear camera keys (${doc.animation.camera.length})`}</Btn> : null}
            <span style={{ ...helperText, flex: '1 1 220px' }}>
              {animated
                ? 'Keyed elements and the camera move between their keys. Transforming a keyed element sets a key at the playhead.'
                : 'Set a key, move the playhead, change the pose, set another key. Two keys make a move.'}
            </span>
          </div>
        </div>
      </section>

      {/* Inspector + outputs */}
      <aside className="s3d-side" style={{ borderLeft: `1px solid ${COLORS.border}`, background: COLORS.surface }} aria-label="Inspector">
        <div role="tablist" aria-label="Builder panels" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, background: COLORS.bg, borderRadius: 10, padding: 3 }}>
          {([['element', 'Element'], ['scene', 'Scene'], ['shots', 'Shots'], ['render', 'Render']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className="s3d-btn"
              onClick={() => setTab(id)}
              style={{ minHeight: 32, borderRadius: 8, border: 'none', fontSize: 11.5, fontWeight: 700, background: tab === id ? COLORS.raised : 'transparent', color: tab === id ? COLORS.text : COLORS.textFaint }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'element' ? (
          selected && shownTransform ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={panelTitle}>Name</span>
                <input className="s3d-field" value={selected.name} maxLength={80} onChange={(event) => updateElement(selected.id, { name: event.target.value }, `name:${selected.id}`)} />
              </label>
              {selected.kind === 'text' ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={panelTitle}>Text</span>
                  <input className="s3d-field" value={selected.text || ''} maxLength={40} onChange={(event) => updateElement(selected.id, { text: event.target.value }, `text:${selected.id}`)} />
                </label>
              ) : null}
              {transformRow('Position (m)', 'position', 0.1)}
              {transformRow('Rotation (°)', 'rotation', 5)}
              {transformRow('Scale', 'scale', 0.1, 0.01)}
              {track.length ? (
                <p style={{ ...helperText, color: COLORS.accent }}>{`Animated · ${track.length} key${track.length === 1 ? '' : 's'}. Edits here set a key at ${playhead.toFixed(1)}s.`}</p>
              ) : null}

              {selected.kind !== 'model' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={panelTitle}>{selected.kind === 'billboard' ? 'Tint' : 'Colour'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={selected.color}
                      onChange={(event) => updateElement(selected.id, { color: event.target.value }, `color:${selected.id}`)}
                      aria-label="Colour"
                      style={{ width: 44, height: 36, padding: 0, border: `1px solid ${COLORS.controlBorder}`, borderRadius: 8, background: 'none', cursor: 'pointer' }}
                    />
                    {['#ffffff', '#d4af37', '#e5484d', '#3fb950', '#4c8dff', '#1a1d26'].map((swatch) => (
                      <button key={swatch} type="button" className="s3d-btn" aria-label={`Colour ${swatch}`} onClick={() => updateElement(selected.id, { color: swatch })}
                        style={{ width: 22, height: 22, borderRadius: 6, padding: 0, background: swatch, border: `1px solid ${selected.color === swatch ? COLORS.accent : COLORS.border}` }} />
                    ))}
                  </div>
                </div>
              ) : null}

              {selected.kind !== 'model' && selected.kind !== 'billboard' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={panelTitle}>Material</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {MATERIALS.map((item) => (
                      <Btn key={item.id} small active={selected.material === item.id} onClick={() => updateElement(selected.id, { material: item.id })} title={item.helper}>{item.label}</Btn>
                    ))}
                  </div>
                  <p style={helperText}>{MATERIALS.find((item) => item.id === selected.material)?.helper}</p>
                </div>
              ) : null}

              {selected.kind === 'model' || selected.kind === 'billboard' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={panelTitle}>File</span>
                  <span style={{ fontSize: 11.5, color: COLORS.textMuted, wordBreak: 'break-all' }}>{selected.assetName || 'Uploaded file'}</span>
                  {selected.kind === 'model' ? <p style={helperText}>Models keep their own materials and colours.</p> : null}
                  {selected.assetUrl && !/^https:/i.test(selected.assetUrl) ? <p style={{ ...helperText, color: COLORS.warning }}>Only on this device — it will be missing when the scene is reopened.</p> : null}
                </div>
              ) : null}
              {assetErrors[selected.id] ? <p role="alert" style={{ ...helperText, color: COLORS.error }}>{assetErrors[selected.id]}</p> : null}

              <div style={{ display: 'flex', gap: 6 }}>
                <Btn small onClick={() => duplicateElement(selected.id)}><Copy size={12} /> Duplicate</Btn>
                <Btn small onClick={() => deleteElement(selected.id)}><Trash2 size={12} /> Delete</Btn>
              </div>
            </div>
          ) : (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Nothing selected</div>
              <p style={helperText}>Click an element in the view or in “In this scene”, or add one from the library. Then move, rotate or scale it with the gizmo (W / E / R) or type exact values here.</p>
            </div>
          )
        ) : null}

        {tab === 'scene' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={panelTitle}>Scene name</span>
              <input className="s3d-field" value={doc.name} maxLength={80} onChange={(event) => commit((d) => ({ ...d, name: event.target.value }), 'scene-name')} />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={panelTitle}>Lighting</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {LIGHTING_PRESETS.map((preset) => {
                  const active = doc.lighting === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className="s3d-btn"
                      aria-pressed={active}
                      onClick={() => commit((d) => ({ ...d, lighting: preset.id, backdropColor: preset.backdropColor }))}
                      style={{
                        padding: 6, borderRadius: 10, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4,
                        border: `1px solid ${active ? COLORS.accent : COLORS.border}`, background: active ? COLORS.accentSoft : COLORS.bg, color: COLORS.text,
                      }}
                    >
                      <Thumb src={thumbs.lighting[preset.id]} swatch={preset.swatch} Icon={Lightbulb} size={52} />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{preset.label}</span>
                      <span style={{ fontSize: 10, color: COLORS.textFaint, lineHeight: 1.35 }}>{preset.helper}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={panelTitle}>Backdrop</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {BACKDROPS.map((item) => (
                  <Btn key={item.id} small active={doc.backdrop === item.id} onClick={() => commit((d) => ({ ...d, backdrop: item.id }))} title={item.helper}>{item.label}</Btn>
                ))}
              </div>
              <p style={helperText}>{BACKDROPS.find((item) => item.id === doc.backdrop)?.helper}</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLORS.textMuted }}>
                <input
                  type="color"
                  value={doc.backdropColor}
                  onChange={(event) => commit((d) => ({ ...d, backdropColor: event.target.value }), 'backdrop-color')}
                  style={{ width: 44, height: 32, padding: 0, border: `1px solid ${COLORS.controlBorder}`, borderRadius: 8, background: 'none', cursor: 'pointer' }}
                />
                Backdrop colour
                <Btn small onClick={() => commit((d) => ({ ...d, backdropColor: lightingPreset(d.lighting).backdropColor }))}>Match lighting</Btn>
              </label>
            </div>

            <div style={{ ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Folder size={14} color={COLORS.accent} />
                <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>Saved scenes</span>
                <Btn small onClick={() => void openDoc(createDoc(), null)} title="Save this scene and start a new one">New scene</Btn>
              </div>
              <p style={helperText}>{sceneId ? 'This scene autosaves to your account as you edit.' : 'This scene saves to your account on the next edit.'}</p>
              {scenesState === 'loading' ? <p style={helperText}>Loading your scenes…</p> : null}
              {scenesState === 'ready' && !scenes.length ? <p style={helperText}>No saved scenes yet{databaseAvailable() ? '' : ' (sign in to sync scenes across devices)'}.</p> : null}
              {scenes.map((scene) => (
                <div key={scene.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 10, border: `1px solid ${scene.id === sceneId ? COLORS.accent : COLORS.border}`, background: COLORS.bg }}>
                  <Thumb src={scene.thumbnail || undefined} swatch={lightingPreset(scene.doc.lighting).swatch} Icon={Hexagon} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scene.name}</div>
                    <div style={{ fontSize: 10, color: COLORS.textFaint }}>{scene.updatedAt ? new Date(scene.updatedAt).toLocaleString() : ''}</div>
                  </div>
                  {scene.id === sceneId
                    ? <span style={{ fontSize: 10.5, color: COLORS.accent, fontWeight: 700 }}>Open</span>
                    : <Btn small onClick={() => void openDoc(scene.doc, scene.id)}>Open</Btn>}
                  <button type="button" className="s3d-btn" aria-label={`Delete ${scene.name}`} onClick={() => void removeScene(scene)} style={{ background: 'none', border: 'none', color: COLORS.textFaint, padding: 4, display: 'flex' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'shots' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Btn primary onClick={saveShot} disabled={!ready}><Bookmark size={13} /> Save current view as a shot</Btn>
            <p style={helperText}>Frame the view with the mouse, then save it. Shots can be rendered on their own or used as the first and last frame of an AI video.</p>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={panelTitle}>{`Lens · ${Math.round(fov)}° field of view`}</span>
              <input
                className="s3d-range"
                type="range"
                min={15}
                max={90}
                step={1}
                value={fov}
                disabled={!ready}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setFov(next);
                  const engine = engineRef.current;
                  if (engine) engine.setView({ ...engine.getView(), fov: next });
                  scheduleSaveRef.current();
                }}
              />
            </label>
            {!doc.shots.length ? <p style={helperText}>No shots yet.</p> : null}
            {doc.shots.map((shot) => (
              <div key={shot.id} style={{ ...card, padding: 8, gap: 6 }}>
                <input className="s3d-field" value={shot.name} maxLength={60} aria-label="Shot name"
                  onChange={(event) => commit((d) => ({ ...d, shots: d.shots.map((item) => (item.id === shot.id ? { ...item, name: event.target.value } : item)) }), `shot:${shot.id}`)} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Btn small onClick={() => goToShot(shot)}><Camera size={12} /> View</Btn>
                  <Btn small onClick={() => { const engine = engineRef.current; if (!engine) return; const view = engine.getView(); commit((d) => ({ ...d, shots: d.shots.map((item) => (item.id === shot.id ? { ...item, ...view } : item)) })); }}>Update to current view</Btn>
                  <Btn small onClick={() => commit((d) => ({ ...d, shots: d.shots.filter((item) => item.id !== shot.id) }))}><Trash2 size={12} /></Btn>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'render' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {ASPECTS.map((item) => (
                <Btn key={item.id} small active={doc.aspect === item.id} onClick={() => commit((d) => ({ ...d, aspect: item.id }))} style={{ flex: 1 }}>{item.label}</Btn>
              ))}
            </div>

            <div style={card}>
              <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><ImageIcon size={14} color={COLORS.accent} /> Still image</div>
              <p style={helperText}>{`A PNG of exactly what the frame shows, ${exportSize(doc.aspect, 1920).width}×${exportSize(doc.aspect, 1920).height}. Free.`}</p>
              <Btn onClick={exportStill} disabled={!ready || recording !== null}><Download size={13} /> Export PNG</Btn>
              {still ? <img src={still} alt="Latest still render" style={{ width: '100%', borderRadius: 8, border: `1px solid ${COLORS.border}` }} /> : null}
            </div>

            <div style={card}>
              <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Film size={14} color={COLORS.accent} /> Record a clip</div>
              <p style={helperText}>
                {recordingSupport.ok
                  ? animated
                    ? `Plays your ${duration.toFixed(1)}s keyframe animation once and records it from the frame (${exportSize(doc.aspect, 1280).width}×${exportSize(doc.aspect, 1280).height}). Free.`
                    : `No keyframes yet, so this records a slow ${duration.toFixed(1)}s orbit of the current view. Free.`
                  : recordingSupport.reason}
              </p>
              <Btn onClick={() => void recordClip()} disabled={!ready || !recordingSupport.ok || recording !== null}><Film size={13} /> {recording !== null ? 'Recording…' : 'Record clip'}</Btn>
              {clip ? (
                <>
                  <video src={clip.url} controls playsInline style={{ width: '100%', borderRadius: 8, background: '#000', border: `1px solid ${COLORS.border}` }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Btn small onClick={() => triggerDownload(clip.url, `${safeFileName(doc.name, 'scene')}.${clip.extension}`)}><Download size={12} /> Download .{clip.extension}</Btn>
                    <Btn small onClick={() => void saveClip()} disabled={clipSaving || Boolean(clip.savedUrl)}>
                      {clip.savedUrl ? <><CheckCircle2 size={12} /> Saved</> : clipSaving ? 'Uploading…' : 'Save to Your videos'}
                    </Btn>
                  </div>
                  {clip.savedUrl ? <a href={clip.savedUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: COLORS.accent, wordBreak: 'break-all' }}>{clip.savedUrl}</a> : null}
                </>
              ) : null}
            </div>

            <div style={card}>
              <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} color={COLORS.accent} /> Animate with AI video</div>
              <p style={helperText}>Your render goes to the Generate tab as the start image, where you check the model and its credit cost before anything is charged.</p>
              <textarea className="s3d-field" rows={3} value={aiPrompt} maxLength={2000} placeholder="Make this scene come alive — e.g. the camera slowly pushes in as the figure turns toward the light…" onChange={(event) => setAiPrompt(event.target.value)} />
              <div role="radiogroup" aria-label="How to use the render" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  ['seed', 'Current view as the start frame', 'The model animates forward from this frame.'],
                  ['frames', 'First shot → last shot', 'The model moves between two of your saved shots.'],
                  ['reference', 'Current view + shots as references', 'Up to 3 renders guide the look without fixing the first frame.'],
                ] as const).map(([id, label, hint]) => {
                  const disabled = id === 'frames' && doc.shots.length < 2;
                  return (
                    <label key={id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                      <input type="radio" name="s3d-ai-role" checked={aiRole === id} disabled={disabled} onChange={() => setAiRole(id)} style={{ marginTop: 2 }} />
                      <span><strong style={{ fontWeight: 700 }}>{label}</strong><br /><span style={{ color: COLORS.textFaint, fontSize: 10.5 }}>{disabled ? 'Save at least two shots first.' : hint}</span></span>
                    </label>
                  );
                })}
              </div>
              {aiRole === 'frames' && doc.shots.length >= 2 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <select className="s3d-field" value={firstShot} onChange={(event) => setFirstShot(event.target.value)} aria-label="First frame shot">
                    {doc.shots.map((shot) => <option key={shot.id} value={shot.id}>{shot.name}</option>)}
                  </select>
                  <select className="s3d-field" value={lastShot} onChange={(event) => setLastShot(event.target.value)} aria-label="Last frame shot">
                    {doc.shots.map((shot) => <option key={shot.id} value={shot.id}>{shot.name}</option>)}
                  </select>
                </div>
              ) : null}
              <Btn primary onClick={() => sendToLab()} disabled={!ready}><Send size={13} /> Send to Generate</Btn>
              <p style={helperText}>{`Uses ${activeModelName} if it accepts this kind of image input; otherwise the Lab switches to Gemini Omni 1.1 Flash, which takes all three.`}</p>
            </div>

            <div style={card}>
              <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Wand2 size={14} color={COLORS.accent} /> Stylise</div>
              <p style={helperText}>Sends the current view to the image model, which repaints the blockout in a finished style while keeping the layout. Image passes use no Vidverge credits.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {STYLE_PRESETS.map((preset) => (
                  <Btn key={preset.id} small active={styleId === preset.id} onClick={() => setStyleId(preset.id)} title={preset.helper}>{preset.label}</Btn>
                ))}
              </div>
              <p style={helperText}>{STYLE_PRESETS.find((preset) => preset.id === styleId)?.helper}</p>
              <input className="s3d-field" value={styleNotes} maxLength={600} placeholder="Optional: what the shapes are — e.g. the sphere is a perfume bottle…" onChange={(event) => setStyleNotes(event.target.value)} />
              <Btn onClick={() => void runStylise()} disabled={!ready || stylised.busy}><Wand2 size={13} /> {stylised.busy ? 'Stylising… (about 20s)' : 'Stylise current view'}</Btn>
              {stylised.error ? <p role="alert" style={{ ...helperText, color: COLORS.error }}>{stylised.error}</p> : null}
              {stylised.url ? (
                <>
                  <img src={stylised.url} alt="Stylised render" style={{ width: '100%', borderRadius: 8, border: `1px solid ${COLORS.border}` }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Btn small onClick={() => triggerDownload(stylised.url, `${safeFileName(doc.name, 'scene')}-${styleId}.${/image\/png/.test(stylised.url) ? 'png' : 'jpg'}`)}><Download size={12} /> Download</Btn>
                    <Btn small onClick={() => void animateStylised()}><Send size={12} /> Animate this image</Btn>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
