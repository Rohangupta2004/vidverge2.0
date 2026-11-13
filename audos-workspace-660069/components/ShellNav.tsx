import { ComponentType, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Music, X } from 'lucide-react';
import { useAmbientMusic } from '../hooks/useAmbientMusic';
import { MobileDock, Rail, Switcher, TopBar } from './secondcut/Shell';

// Second design: a 76px labelled rail on desktop, a 56px top bar everywhere and a
// bottom dock on phones. Desktop.tsx reserves this space with its root padding.
export const SHELL_HEADER_HEIGHT = 56;
export const SHELL_DOCK_WIDTH = 76;
export type WorkspaceMode = 'agent' | 'manual';

export interface ShellNavItem {
  id: string;
  label: string;
  Icon: ComponentType<any>;
}

function AmbientMusicChip({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const music = useAmbientMusic();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = music.tracks.find((track) => track.id === music.trackId) || music.tracks[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          music.toggle();
          setOpen(true);
        }}
        aria-expanded={open}
        aria-pressed={music.enabled}
        aria-label={`Ambient music: ${music.enabled ? 'on' : 'off'} — ${selected.label}`}
        className={`flex min-h-10 w-full items-center rounded-full border border-[var(--space-border-default)] bg-[color-mix(in_srgb,var(--space-surface-panel)_88%,transparent)] text-xs font-semibold text-[var(--space-text-secondary)] transition-[border-color,background-color] duration-200 hover:border-[color-mix(in_srgb,var(--vg-accent)_32%,transparent)] hover:bg-[var(--vg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vg-focus)] ${compact ? 'justify-center px-2' : 'gap-2.5 px-3'}`}
        title={`Music ${music.enabled ? 'on' : 'off'}: ${selected.label}`}
      >
        <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--vg-selected-soft)] text-[var(--vg-selected)]">
          <Music className="h-4 w-4" aria-hidden="true" />
          {music.error ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--vg-warning)] shadow-[0_0_8px_var(--vg-warning)]" /> : music.playing ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--vg-selected)] shadow-[0_0_8px_var(--vg-selected)]" /> : null}
        </span>
        {compact ? null : <span className="truncate">{music.enabled ? selected.label : 'Music off'}</span>}
      </button>
      {music.error && !open ? <p role="status" className="absolute right-0 top-12 z-[129] w-48 rounded-lg border border-[var(--vg-warning)] bg-[var(--space-surface-card)] px-2 py-1 text-[10px] text-[var(--vg-warning)] shadow-lg">{music.error}</p> : null}
      {open ? (
        <div className="absolute right-0 top-12 z-[130] max-h-[min(70vh,520px)] w-64 overflow-y-auto rounded-2xl border border-[color-mix(in_srgb,var(--vg-accent)_24%,var(--space-border-default))] bg-[color-mix(in_srgb,var(--space-surface-card)_97%,transparent)] p-3 shadow-[0_22px_60px_color-mix(in_srgb,var(--space-surface-page)_80%,transparent)] backdrop-blur-xl" role="dialog" aria-label="Ambient music">
          <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
            <p className="text-xs font-bold text-[var(--space-text-primary)]">Ambient music</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close ambient music" className="grid h-9 w-9 place-items-center rounded-lg text-[var(--space-text-muted)] hover:bg-[var(--vg-hover)] hover:text-[var(--space-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vg-focus)]"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <div className="space-y-1">
            {music.tracks.map((track) => (
              <button key={track.id} type="button" onClick={() => { music.selectTrack(track.id); setOpen(false); }} className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vg-focus)] ${track.id === music.trackId ? 'bg-[var(--vg-selected-soft)] text-[var(--vg-selected)]' : 'text-[var(--space-text-secondary)] hover:bg-[var(--vg-hover)]'}`}>
                <span>{track.label}</span>{track.id === music.trackId ? '✓' : ''}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs text-[var(--space-text-muted)]">Volume <span className="font-mono tabular-nums">{Math.round(music.volume * 100)}%</span><input className="mt-2 w-full accent-[var(--vg-selected)]" type="range" min="3" max="35" value={Math.round(music.volume * 100)} onChange={(event) => music.setVolume(Number(event.target.value) / 100)} /></label>
          {music.error ? <p className="mt-2 text-xs text-[var(--vg-warning)]">{music.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export interface ShellDockProps {
  workspaceName: string;
  items: ShellNavItem[];
  utilityItems: ShellNavItem[];
  homeItem: ShellNavItem;
  activeId: string | null;
  onSelect: (id: string) => void;
  onHome: () => void;
  drawerOpen: boolean;
  onDrawerClose: () => void;
  onDrawerOpen?: () => void;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  jobsSlot?: ReactNode;
  creditsSlot?: ReactNode;
  onPlans?: () => void;
  planLabel?: string;
}

/** The rail (desktop), the dock (phones) and the studio switcher, which is the shell's drawer. */
export function ShellDock({ workspaceName, items, homeItem, activeId, onSelect, onHome, drawerOpen, onDrawerClose, onDrawerOpen, onPlans, planLabel = 'Credits' }: ShellDockProps) {
  useEffect(() => {
    document.documentElement.style.setProperty('--vv-sidebar-width', `${SHELL_DOCK_WIDTH}px`);
    return () => { document.documentElement.style.removeProperty('--vv-sidebar-width'); };
  }, []);

  const select = useCallback((id: string) => {
    if (id === homeItem.id) onHome(); else onSelect(id);
    onDrawerClose();
  }, [homeItem.id, onDrawerClose, onHome, onSelect]);
  const goHome = useCallback(() => { onHome(); onDrawerClose(); }, [onHome, onDrawerClose]);
  const toggleSwitcher = useCallback(() => {
    if (drawerOpen) onDrawerClose();
    else onDrawerOpen?.();
  }, [drawerOpen, onDrawerClose, onDrawerOpen]);

  return (
    <>
      <Rail
        workspaceName={workspaceName}
        items={items}
        activeId={activeId}
        homeId={homeItem.id}
        switcherOpen={drawerOpen}
        onToggleSwitcher={toggleSwitcher}
        onSelect={select}
        onHome={goHome}
        onPlans={onPlans}
        planLabel={planLabel}
      />
      <MobileDock
        items={items}
        activeId={activeId}
        homeId={homeItem.id}
        switcherOpen={drawerOpen}
        onToggleSwitcher={toggleSwitcher}
        onSelect={select}
        onHome={goHome}
      />
      {drawerOpen ? <Switcher items={items} activeId={activeId} homeId={homeItem.id} onSelect={select} onClose={onDrawerClose} /> : null}
    </>
  );
}

export interface ShellHeaderProps {
  workspaceName: string;
  sectionLabel: string | null;
  activeId?: string | null;
  jobsSlot?: ReactNode;
  creditsSlot?: ReactNode;
  onHome: () => void;
  onSettings: () => void;
  ownerLinks?: ShellNavItem[];
  onOpenOwnerLink?: (id: string) => void;
  onPlans: () => void;
  planLabel: string;
  onCloseSection?: () => void;
  onOpenDrawer: () => void;
  onVerger?: () => void;
  drawerOpen: boolean;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
}

/** The top bar on every screen size. Opening "Studios" opens the switcher (the shell drawer). */
export function ShellHeader({ workspaceName, sectionLabel, activeId, jobsSlot, creditsSlot, onHome, onOpenDrawer, onVerger, mode, onModeChange }: ShellHeaderProps) {
  return (
    <TopBar
      workspaceName={workspaceName}
      sectionLabel={sectionLabel}
      activeId={activeId}
      mode={mode}
      onModeChange={onModeChange}
      onHome={onHome}
      onOpenStudios={onOpenDrawer}
      onVerger={onVerger}
      jobsSlot={jobsSlot}
      creditsSlot={creditsSlot}
      musicSlot={<AmbientMusicChip compact />}
    />
  );
}
