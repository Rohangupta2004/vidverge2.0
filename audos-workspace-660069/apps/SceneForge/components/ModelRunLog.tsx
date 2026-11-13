/**
 * SceneForge — "Models used" panel. Shows which model ran each role of the edit
 * (layered agent: script reviewer, Director, Coder, Gemini visual QA), any
 * fallback and why, plus the caption typo fixes the reviewer made. Auto Editor
 * projects without a layered log fall back to their recorded planner calls.
 */
import { AlertTriangle, Cpu } from 'lucide-react';
import { COLORS, FONT, RADIUS } from '../../../components/theme';
import type { ForgeModelLogEntry, ForgeProject } from '../lib/forgeTypes';
import { forgeModelName } from '../lib/forgeModels';
import { SOFT_BUTTON_BG, SOFT_PANEL } from './StagePreviews';

const ROLE_ORDER = ['boss_planner', 'director_style_pick', 'script_reviewer', 'director', 'coder', 'visual_qa'];

const ROLE_LABELS: Record<string, string> = {
  boss_planner: 'Boss planner (plan + assets)',
  director_style_pick: 'Style pick',
  script_reviewer: 'Script & caption reviewer',
  director: 'Director',
  coder: 'Coder (Remotion)',
  visual_qa: 'Visual QA',
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  ok: { label: 'OK', color: COLORS.success, bg: COLORS.successBg },
  retry: { label: 'Repairing', color: COLORS.warning, bg: COLORS.warningBg },
  fallback: { label: 'Fallback', color: COLORS.warning, bg: COLORS.warningBg },
  failed: { label: 'Failed', color: COLORS.danger, bg: COLORS.dangerBg },
  skipped: { label: 'Skipped', color: COLORS.danger, bg: COLORS.dangerBg },
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role.replace(/[_-]+/g, ' ');
}

function timeLabel(at: string): string {
  const date = new Date(at);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

/** Latest entry per role (and per draft for the per-draft roles), in pipeline order. */
function latestByRole(entries: ForgeModelLogEntry[]): ForgeModelLogEntry[] {
  const latest = new Map<string, ForgeModelLogEntry>();
  entries.forEach((entry) => latest.set(`${entry.role}|${entry.draft ?? ''}`, entry));
  return Array.from(latest.values()).sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(a.role);
    const rb = ROLE_ORDER.indexOf(b.role);
    if (ra !== rb) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
    return (a.draft ?? 0) - (b.draft ?? 0);
  });
}

function autoUsageEntries(project: ForgeProject): ForgeModelLogEntry[] {
  return (project.auto?.usage || []).map((usage) => ({
    at: usage.at,
    role: usage.step,
    model: usage.model,
    status: usage.ok ? 'ok' : 'failed',
    fallback_reason: usage.ok ? null : usage.note || null,
    detail: usage.ok ? usage.note || null : null,
    draft: null,
  }));
}

export default function ModelRunLog({ project }: { project: ForgeProject }) {
  const layered = Array.isArray(project.model_log) ? project.model_log : [];
  const entries = layered.length ? layered : autoUsageEntries(project);
  const review = project.script_review || null;
  if (!entries.length && !review) return null;
  const rows = latestByRole(entries);
  const qaSkipped = layered.some((entry) => entry.role === 'visual_qa' && entry.status === 'skipped');
  const corrections = review?.corrections || [];
  const rejected = review?.rejected || [];
  const spoken = review?.spoken_hints || [];

  return (
    <section style={{ ...SOFT_PANEL, display: 'grid', gap: 12, padding: 16 }} data-testid="sceneforge-model-log">
      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Cpu size={16} color={COLORS.accent} />
        <strong style={{ color: COLORS.text, fontFamily: FONT.heading, fontSize: 14.5 }}>Models used</strong>
        <span style={{ color: COLORS.muted, fontSize: 12 }}>{layered.length ? 'Which model ran each role of this edit' : 'Model calls recorded by the Auto Editor'}</span>
      </div>

      {qaSkipped ? (
        <div role="alert" style={{ alignItems: 'flex-start', background: COLORS.warningBg, borderRadius: RADIUS.card, color: COLORS.text, display: 'flex', fontSize: 12.5, gap: 8, lineHeight: '18px', padding: '9px 11px' }} data-testid="sceneforge-qa-skipped">
          <AlertTriangle size={15} color={COLORS.warning} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span>{project.auto
            ? 'Visual QA was skipped for this video because Gemini vision could not be reached. It was rendered but not visually checked, and no other model stood in.'
            : 'Visual QA was skipped for some drafts because Gemini vision could not be reached. Those drafts passed the compile checks but were not visually checked, and no other model stood in.'}</span>
        </div>
      ) : null}

      {rows.length ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {rows.map((entry) => {
            const badge = STATUS_STYLE[entry.status] || STATUS_STYLE.ok;
            return (
              <div key={`${entry.role}-${entry.draft ?? 'all'}`} style={{ alignItems: 'baseline', background: SOFT_BUTTON_BG, borderRadius: RADIUS.sm, display: 'grid', gap: '4px 10px', gridTemplateColumns: 'minmax(150px, 1.1fr) minmax(120px, 1fr) auto', padding: '8px 10px' }} data-testid={`sceneforge-model-row-${entry.role}${entry.draft ? `-${entry.draft}` : ''}`}>
                <span style={{ color: COLORS.text, fontSize: 12.5, fontWeight: 600 }}>{roleLabel(entry.role)}{entry.draft ? ` · draft ${entry.draft}` : ''}</span>
                <span style={{ color: COLORS.secondary, fontFamily: FONT.mono, fontSize: 12 }} title={entry.model || ''}>{forgeModelName(entry.model)}</span>
                <span style={{ background: badge.bg, borderRadius: 999, color: badge.color, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 8px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{badge.label}</span>
                {entry.fallback_reason || entry.detail ? (
                  <span style={{ color: entry.fallback_reason ? COLORS.warning : COLORS.muted, fontSize: 11.5, gridColumn: '1 / -1', lineHeight: '16px' }}>
                    {entry.fallback_reason ? `Why: ${entry.fallback_reason}` : entry.detail}
                    {entry.at ? <span style={{ color: COLORS.muted }}> · {timeLabel(entry.at)}</span> : null}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {review ? (
        <div style={{ display: 'grid', gap: 6 }} data-testid="sceneforge-caption-review">
          <strong style={{ color: COLORS.text, fontSize: 12.5 }}>
            Caption review · {review.status === 'ok' ? `${corrections.length} typo fix${corrections.length === 1 ? '' : 'es'} on ${review.caption_words_changed} caption word${review.caption_words_changed === 1 ? '' : 's'}` : 'reviewer unavailable, captions use your script unchanged'}
          </strong>
          {corrections.length ? (
            <ul style={{ color: COLORS.secondary, display: 'grid', fontSize: 12.5, gap: 3, lineHeight: '18px', margin: 0, paddingLeft: 18 }}>
              {corrections.map((fix, index) => <li key={`fix-${index}`}><span style={{ textDecoration: 'line-through' }}>{fix.from}</span> → <strong style={{ color: COLORS.text }}>{fix.to}</strong>{fix.reason ? ` · ${fix.reason}` : ''}</li>)}
            </ul>
          ) : null}
          {rejected.length ? <span style={{ color: COLORS.muted, fontSize: 11.5 }}>Not applied (looked like rewrites, not typos): {rejected.map((fix) => `${fix.from} → ${fix.to}`).join(', ')}</span> : null}
          {spoken.length ? (
            <span style={{ color: COLORS.muted, fontSize: 11.5, lineHeight: '17px' }}>
              Voiceover pronunciation hints kept separately from the captions: {spoken.map((hint) => `${hint.from} → “${hint.to}”`).join(', ')}. {review.spoken_in_voice
                ? `The voiceover read these spoken forms; the captions keep your written words${review.voice_alignment && review.voice_alignment.chosen === 'plain_script' ? ' (caption timing uses the plain script alignment)' : ''}.`
                : 'This video reused its recorded voice, so they apply the next time the voice is generated.'}
            </span>
          ) : null}
          <span style={{ color: COLORS.muted, fontSize: 11.5 }}>Your script stays the source of truth; only clear typos are corrected in the captions.</span>
        </div>
      ) : null}
    </section>
  );
}
