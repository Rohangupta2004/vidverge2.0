import React, { ComponentType, ReactNode, useEffect, useState } from 'react';
import { Icon, Logo, Seg, STUDIOS, StudioInfo, studioInfo, mediaSrc } from './base';
import { SecondCutStyles } from './styles';
import { applyVidvergeTheme, readVidvergeTheme, VIDVERGE_THEME_EVENT } from '../ui/Molten';

export interface ShellLink {
  id: string;
  label: string;
  Icon: ComponentType<any>;
}

const RECENTS_KEY = 'vv-recent-studios';
const AGENT_ID = 'vidverge-agent';

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** The three studios opened most recently, kept per browser. */
export function useRecentStudios(activeId: string | null): string[] {
  const [recents, setRecents] = useState<string[]>(() => readRecents());
  useEffect(() => {
    if (!activeId || !studioInfo(activeId)) return;
    setRecents((current) => {
      const next = [activeId].concat(current.filter((id) => id !== activeId)).slice(0, 3);
      try { window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [activeId]);
  return recents;
}

export function useShellTheme(): ['dark' | 'light', () => void] {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => readVidvergeTheme());
  useEffect(() => {
    const sync = (event: Event) => setTheme((event as CustomEvent).detail?.theme === 'light' ? 'light' : 'dark');
    window.addEventListener(VIDVERGE_THEME_EVENT, sync);
    return () => window.removeEventListener(VIDVERGE_THEME_EVENT, sync);
  }, []);
  const toggle = () => { const next = theme === 'dark' ? 'light' : 'dark'; applyVidvergeTheme(next); setTheme(next); };
  return [theme, toggle];
}

function RailButton({ label, icon, on, onClick }: { label: string; icon: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={'rnav' + (on ? ' on' : '')} aria-current={on ? 'page' : undefined} onClick={onClick} title={label}>
      <Icon n={icon} size={20} /><span>{label}</span>
    </button>
  );
}

export interface RailProps {
  workspaceName: string;
  items: ShellLink[];
  activeId: string | null;
  homeId: string;
  switcherOpen: boolean;
  onToggleSwitcher: () => void;
  onSelect: (id: string) => void;
  onHome: () => void;
  onPlans?: () => void;
  planLabel?: string;
  bottomSlot?: ReactNode;
}

/** Labelled rail: Home, Verger, Studios, Library, recent studios, then credits and account. */
export function Rail({ workspaceName, items, activeId, homeId, switcherOpen, onToggleSwitcher, onSelect, onHome, onPlans, planLabel = 'Credits', bottomSlot }: RailProps) {
  const recents = useRecentStudios(activeId).filter((id) => items.some((item) => item.id === id));
  const isStudio = !!studioInfo(activeId);
  const hasAgent = items.some((item) => item.id === AGENT_ID);
  return (
    <div className="vx" style={{ display: 'contents' }}>
      <SecondCutStyles />
      <nav className="rail vx-fixed" aria-label={`${workspaceName} navigation`}>
        <button type="button" className="rlogo" onClick={onHome} aria-label={`${workspaceName} home`}><Logo size={34} /></button>
        <RailButton label="Home" icon="home" on={activeId === homeId && !switcherOpen} onClick={onHome} />
        {hasAgent ? <RailButton label="Verger" icon="bot" on={activeId === AGENT_ID && !switcherOpen} onClick={() => onSelect(AGENT_ID)} /> : null}
        <RailButton label="Studios" icon="grid" on={switcherOpen || isStudio || activeId === null} onClick={onToggleSwitcher} />
        <RailButton label="Library" icon="library" on={activeId === 'library' && !switcherOpen} onClick={() => onSelect('library')} />
        {recents.length ? <span className="rsep" /> : null}
        {recents.map((id) => {
          const s = studioInfo(id)!;
          return (
            <button type="button" key={id} className={'rrec tinted' + (activeId === id ? ' on' : '')} style={{ ['--hue' as any]: s.hue }} title={'Recent: ' + s.name} aria-label={s.name} onClick={() => onSelect(id)}>
              <Icon n={s.icon} size={18} />
            </button>
          );
        })}
        <span className="grow" />
        {bottomSlot}
        {onPlans ? <RailButton label={planLabel === 'Pro access' ? 'Credits' : planLabel} icon="coins" on={false} onClick={onPlans} /> : null}
        <button type="button" className="avatar" style={{ marginTop: 6 }} onClick={() => onSelect('settings')} aria-label="Account and settings" title="Account and settings">
          {workspaceName.charAt(0).toUpperCase()}
        </button>
      </nav>
    </div>
  );
}

/** Phone navigation: Home, Studios, Library, Verger, Account. */
export function MobileDock({ items, activeId, homeId, switcherOpen, onToggleSwitcher, onSelect, onHome }: Omit<RailProps, 'workspaceName' | 'onPlans' | 'planLabel' | 'bottomSlot'>) {
  const isStudio = !!studioInfo(activeId);
  const hasAgent = items.some((item) => item.id === AGENT_ID);
  const B = ({ on, label, icon, onClick }: { on: boolean; label: string; icon: string; onClick: () => void }) => (
    <button type="button" className={on ? 'on' : ''} onClick={onClick} aria-current={on ? 'page' : undefined}><Icon n={icon} />{label}</button>
  );
  return (
    <div className="vx" style={{ display: 'contents' }}>
      <nav className="glass dock" aria-label="Main">
        <B on={activeId === homeId && !switcherOpen} label="Home" icon="home" onClick={onHome} />
        <B on={switcherOpen || isStudio} label="Studios" icon="grid" onClick={onToggleSwitcher} />
        <B on={activeId === 'library' && !switcherOpen} label="Library" icon="library" onClick={() => onSelect('library')} />
        {hasAgent ? <B on={activeId === AGENT_ID && !switcherOpen} label="Verger" icon="bot" onClick={() => onSelect(AGENT_ID)} /> : null}
        <B on={activeId === 'settings' && !switcherOpen} label="Account" icon="settings" onClick={() => onSelect('settings')} />
      </nav>
    </div>
  );
}

function StudioTile({ s, index, on, onClick }: { s: StudioInfo; index?: number; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={'stile tinted' + (on ? ' on' : '')} style={{ ['--hue' as any]: s.hue }} onClick={onClick}>
      <img src={mediaSrc(s.img)} alt="" loading="lazy" />
      <span className="row between" style={{ width: '100%' }}><span className="xicon"><Icon n={s.icon} size={18} /></span>{index !== undefined ? <kbd className="hide-sm">{index + 1}</kbd> : null}</span>
      <b>{s.name}</b><span className="ln">{s.line}</span>
    </button>
  );
}

/** Studios that exist in this workspace, in the design's order. */
function availableStudios(items: ShellLink[]): StudioInfo[] {
  return STUDIOS.filter((s) => items.some((item) => item.id === s.id));
}

export function Switcher({ items, activeId, homeId, onSelect, onClose }: { items: ShellLink[]; activeId: string | null; homeId: string; onSelect: (id: string) => void; onClose: () => void }) {
  const studios = availableStudios(items);
  const others = items.filter((item) => item.id !== homeId && item.id !== AGENT_ID && !studioInfo(item.id));
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      const tag = ((e.target as HTMLElement | null)?.tagName) || '';
      if (/input|textarea|select/i.test(tag) || (e.target as HTMLElement | null)?.isContentEditable) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && studios[n - 1]) { e.preventDefault(); onSelect(studios[n - 1].id); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [studios, onSelect, onClose]);
  return (
    <div className="vx" style={{ display: 'contents' }}>
      <div className="veil" style={{ zIndex: 96 }} onMouseDown={onClose} />
      <div className="glass switcher vx-shell" role="dialog" aria-label="Studios" style={{ zIndex: 97 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <div><h2 style={{ fontSize: 24 }}>Studios</h2><p className="hint hide-sm">Press 1 to {Math.min(9, studios.length)} to open one.</p></div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close studios"><Icon n="x" /></button>
        </div>
        <div className="sgrid">{studios.map((s, i) => <StudioTile key={s.id} s={s} index={i} on={activeId === s.id} onClick={() => onSelect(s.id)} />)}</div>
        {others.length ? (
          <div style={{ marginTop: 16 }}>
            <span className="label">More</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {others.map((item) => { const ItemIcon = item.Icon; return <button type="button" key={item.id} className={'chip' + (activeId === item.id ? ' on' : '')} onClick={() => onSelect(item.id)}><ItemIcon className="h-[14px] w-[14px]" aria-hidden="true" />{item.label}</button>; })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface TopBarProps {
  workspaceName: string;
  sectionLabel: string | null;
  activeId?: string | null;
  mode: 'agent' | 'manual';
  onModeChange: (mode: 'agent' | 'manual') => void;
  onHome: () => void;
  onOpenStudios: () => void;
  onVerger?: () => void;
  jobsSlot?: ReactNode;
  creditsSlot?: ReactNode;
  musicSlot?: ReactNode;
}

/** Top bar: where you are, Agent/Manual, running jobs, credits, Verger and the theme switch. */
export function TopBar({ workspaceName, sectionLabel, activeId, mode, onModeChange, onHome, onOpenStudios, onVerger, jobsSlot, creditsSlot, musicSlot }: TopBarProps) {
  const [theme, toggleTheme] = useShellTheme();
  const st = studioInfo(activeId);
  return (
    <div className="vx" style={{ display: 'contents' }}>
      <SecondCutStyles />
      <header className="top vx-fixed">
        <button type="button" className="mlogo" onClick={onHome} aria-label={`${workspaceName} home`}><Logo size={30} /></button>
        <div className="crumb">
          {st ? (
            <>
              <button type="button" className="hide-sm" onClick={onOpenStudios}>Studios</button>
              <Icon n="chevR" size={13} className="hide-sm" />
              <b className="tinted trunc" style={{ ['--hue' as any]: st.hue }}><i className="dot" />{st.name}</b>
            </>
          ) : <b className="trunc">{sectionLabel || 'Home'}</b>}
        </div>
        <span className="hide-sm">
          <Seg value={mode} onChange={onModeChange} options={[{ v: 'agent', l: 'Agent', icon: 'bot' }, { v: 'manual', l: 'Manual', icon: 'grid' }]} label="Workspace mode" />
        </span>
        <span className="grow" />
        <span className="slot">{jobsSlot}</span>
        <span className="slot">{creditsSlot}</span>
        {musicSlot ? <span className="slot hide-sm" style={{ width: 44 }}>{musicSlot}</span> : null}
        {onVerger ? (
          <button type="button" className={'btn btn-sm vbtn' + (activeId === AGENT_ID ? ' on' : '')} onClick={onVerger} aria-pressed={activeId === AGENT_ID} aria-label="Verger, your agent">
            <Icon n="bot" size={16} /><span className="hide-sm">Verger</span>
          </button>
        ) : null}
        <button type="button" className="iconbtn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to the ivory theme' : 'Switch to gold on black'}><Icon n={theme === 'dark' ? 'sun' : 'moon'} /></button>
      </header>
    </div>
  );
}

/** One header for every studio: its colour, its name and what it does. The studio itself renders below. */
export function StudioHead({ appId }: { appId?: string | null }) {
  const s = studioInfo(appId);
  if (!s) return null;
  return (
    <div className="vx" data-vv-studio={s.id}>
      <SecondCutStyles />
      <header className="ws-head vx-studio-head tinted" style={{ ['--hue' as any]: s.hue }}>
        <span className="badge"><Icon n={s.icon} size={20} /></span>
        <div className="grow"><h1>{s.name}</h1><p className="hint trunc">{s.line}</p></div>
        <span className="pill hide-sm" style={{ color: 'var(--hue-ink)', background: 'color-mix(in srgb, var(--hue) 12%, transparent)' }}>{s.tag}</span>
      </header>
    </div>
  );
}

/** Manual mode: open any studio directly. Non-studio apps follow under "More tools". */
export function Launcher({ items, onOpen, onOpenLibrary }: { items: ShellLink[]; onOpen: (id: string) => void; onOpenLibrary: () => void }) {
  const studios = availableStudios(items);
  const others = items.filter((item) => !studioInfo(item.id));
  return (
    <div className="vx" style={{ height: '100%', overflowY: 'auto' }}>
      <SecondCutStyles />
      <div className="page view">
        <div className="row between wrap head">
          <div><h1>Open a studio directly</h1><p className="sub">Manual mode skips Verger. Pick a studio and set every option yourself. Finished videos land in the same Library.</p></div>
          <button type="button" className="btn btn-sm" onClick={onOpenLibrary}><Icon n="library" size={15} />Library</button>
        </div>
        <div className="sgrid">{studios.map((s, i) => <StudioTile key={s.id} s={s} index={i} onClick={() => onOpen(s.id)} />)}</div>
        {others.length ? (
          <div>
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>More tools</h2>
            <div className="row wrap" style={{ gap: 8 }}>
              {others.map((item) => { const ItemIcon = item.Icon; return <button type="button" key={item.id} className="chip" onClick={() => onOpen(item.id)}><ItemIcon className="h-[14px] w-[14px]" aria-hidden="true" />{item.label}</button>; })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
