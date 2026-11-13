/**
 * S2V 2.0 styles. Built on the workspace's Vidverge tokens (--vg-*), so it
 * follows the suite's dark, champagne-gold design system without a second
 * palette. Every rule is scoped under .s2.
 */
export const S2_CSS = `
.s2 { --s2-gap: 16px; --s2-radius: 14px; --s2-radius-sm: 10px;
  --s2-head: 'Bricolage Grotesque', 'Geist', system-ui, sans-serif;
  --s2-body: 'Geist', 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --s2-mono: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  --s2-line: var(--vg-control-border, #2a2416); --s2-line-strong: var(--vg-border-strong, #4a4024);
  --s2-text: var(--vg-text, #fbf4e2); --s2-text-2: var(--vg-secondary, #cfc3a6); --s2-text-3: var(--vg-muted, #8e856d);
  --s2-bg: var(--vg-bg, #000); --s2-raised: var(--vg-raised, #0f0c08); --s2-surface: var(--vg-surface, #17130c);
  --s2-accent: var(--vg-accent, #f2c14a); --s2-on-accent: var(--vg-on-accent, #000);
  --s2-ok: var(--vg-success, #35c9b4); --s2-warn: var(--vg-warning, #ff7d45); --s2-bad: var(--vg-danger, #ff6b6b);
  position: relative; display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 520px;
  color: var(--s2-text); font-family: var(--s2-body); font-size: 14px; line-height: 1.5; overflow: hidden;
  background: radial-gradient(ellipse 70% 45% at 50% -12%, color-mix(in srgb, var(--s2-accent) 13%, transparent), transparent 62%), var(--s2-bg);
}
.s2 *, .s2 *::before, .s2 *::after { box-sizing: border-box; }
.s2 h1, .s2 h2, .s2 h3 { font-family: var(--s2-head); letter-spacing: -0.02em; margin: 0; color: var(--s2-text); }
.s2 h1 { font-size: clamp(26px, 4vw, 38px); line-height: 1.08; font-weight: 700; }
.s2 h2 { font-size: 19px; font-weight: 700; }
.s2 h3 { font-size: 15px; font-weight: 700; }
.s2 p { margin: 0; }
.s2 button, .s2 input, .s2 textarea, .s2 select { font: inherit; color: inherit; }
.s2 button { cursor: pointer; }
.s2 button:disabled { cursor: not-allowed; opacity: 0.5; }
.s2 :focus-visible { outline: 2px solid var(--s2-accent); outline-offset: 3px; }
.s2-muted { color: var(--s2-text-2); }
.s2-faint { color: var(--s2-text-3); font-size: 12.5px; }
.s2-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--s2-accent); }
.s2-mono { font-family: var(--s2-mono); font-size: 12px; }

/* top bar */
.s2-top { flex-shrink: 0; display: flex; align-items: center; gap: 14px; padding: 12px clamp(14px, 3vw, 28px); border-bottom: 1px solid var(--s2-line); background: color-mix(in srgb, var(--s2-bg) 82%, transparent); backdrop-filter: blur(12px); }
.s2-brand { display: flex; align-items: center; gap: 9px; font-family: var(--s2-head); font-weight: 800; font-size: 16px; letter-spacing: -0.02em; white-space: nowrap; }
.s2-brand-mark { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: linear-gradient(140deg, var(--s2-accent), color-mix(in srgb, var(--s2-accent) 55%, #7d5a0c)); color: var(--s2-on-accent); }
.s2-brand-ver { font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--s2-accent) 50%, transparent); color: var(--s2-accent); }
.s2-steps { flex: 1; display: flex; justify-content: center; gap: 4px; min-width: 0; }
.s2-step { display: flex; align-items: center; gap: 7px; padding: 6px 11px; border-radius: 999px; color: var(--s2-text-3); font-size: 12.5px; font-weight: 650; white-space: nowrap; border: 0; background: transparent; }
.s2-step-n { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; border: 1px solid var(--s2-line-strong); }
.s2-step.is-on { color: var(--s2-text); background: var(--s2-surface); }
.s2-step.is-on .s2-step-n { background: var(--s2-accent); border-color: var(--s2-accent); color: var(--s2-on-accent); }
.s2-step.is-done { color: var(--s2-text-2); }
.s2-step.is-done .s2-step-n { border-color: var(--s2-ok); color: var(--s2-ok); }
@media (max-width: 760px) { .s2-step-label { display: none; } .s2-step { padding: 6px; } }

/* layout */
.s2-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.s2-page { width: 100%; max-width: 1140px; margin: 0 auto; padding: 28px clamp(16px, 3vw, 28px) 120px; }
.s2-narrow { max-width: 860px; }
.s2-split { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
.s2-aside { position: sticky; top: 16px; display: grid; gap: 14px; }
@media (max-width: 980px) { .s2-split { grid-template-columns: minmax(0, 1fr); } .s2-aside { position: static; } }
.s2-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.s2-between { justify-content: space-between; }
.s2-stack { display: grid; gap: var(--s2-gap); }
.s2-section { margin-top: 28px; }
.s2-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }

/* surfaces */
.s2-card { background: var(--s2-raised); border: 1px solid var(--s2-line); border-radius: var(--s2-radius); padding: 18px; }
.s2-card.is-tight { padding: 14px; }
.s2-card.is-glow { border-color: color-mix(in srgb, var(--s2-accent) 45%, var(--s2-line)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--s2-accent) 18%, transparent), 0 18px 48px color-mix(in srgb, var(--s2-accent) 9%, transparent); }
.s2-divider { height: 1px; background: var(--s2-line); margin: 14px 0; border: 0; }

/* buttons */
.s2-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border-radius: 11px; border: 1px solid var(--s2-line-strong); background: var(--s2-surface); color: var(--s2-text); font-weight: 700; font-size: 13.5px; transition: transform .16s ease, background-color .16s ease, border-color .16s ease, box-shadow .16s ease; white-space: nowrap; }
.s2-btn:hover:not(:disabled) { border-color: color-mix(in srgb, var(--s2-accent) 55%, var(--s2-line-strong)); }
.s2-btn.is-primary { border-color: transparent; color: var(--s2-on-accent); background: linear-gradient(135deg, color-mix(in srgb, var(--s2-accent) 92%, #fff), var(--s2-accent) 45%, color-mix(in srgb, var(--s2-accent) 72%, #7d5a0c)); box-shadow: 0 8px 26px color-mix(in srgb, var(--s2-accent) 26%, transparent); }
.s2-btn.is-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 32px color-mix(in srgb, var(--s2-accent) 34%, transparent); }
.s2-btn.is-ghost { background: transparent; border-color: transparent; color: var(--s2-text-2); }
.s2-btn.is-ghost:hover:not(:disabled) { color: var(--s2-text); background: var(--s2-surface); }
.s2-btn.is-danger { color: var(--s2-bad); border-color: color-mix(in srgb, var(--s2-bad) 40%, var(--s2-line)); background: transparent; }
.s2-btn.is-small { min-height: 36px; padding: 6px 12px; font-size: 12.5px; border-radius: 9px; }
.s2-btn.is-wide { width: 100%; }
.s2-icon-btn { width: 36px; height: 36px; min-height: 36px; padding: 0; }

/* choice controls */
.s2-seg { display: inline-flex; padding: 4px; border-radius: 12px; background: var(--s2-raised); border: 1px solid var(--s2-line); gap: 4px; flex-wrap: wrap; }
.s2-seg button { min-height: 38px; padding: 7px 14px; border: 0; border-radius: 9px; background: transparent; color: var(--s2-text-2); font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 7px; }
.s2-seg button[aria-pressed="true"] { background: var(--s2-surface); color: var(--s2-text); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--s2-accent) 45%, transparent); }
.s2-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.s2-chip { min-height: 36px; padding: 6px 13px; border-radius: 999px; border: 1px solid var(--s2-line); background: transparent; color: var(--s2-text-2); font-weight: 700; font-size: 12.5px; }
.s2-chip[aria-pressed="true"], .s2-chip.is-on { border-color: var(--s2-accent); color: var(--s2-text); background: color-mix(in srgb, var(--s2-accent) 12%, transparent); }
.s2-frames { display: flex; gap: 10px; flex-wrap: wrap; }
.s2-frame { display: grid; justify-items: center; gap: 8px; min-width: 84px; padding: 12px 10px 10px; border-radius: 12px; border: 1px solid var(--s2-line); background: transparent; color: var(--s2-text-2); font-weight: 700; font-size: 12px; }
.s2-frame-shape { border: 2px solid currentColor; border-radius: 4px; opacity: .8; }
.s2-frame[aria-pressed="true"] { border-color: var(--s2-accent); color: var(--s2-text); background: color-mix(in srgb, var(--s2-accent) 10%, transparent); }
.s2-toggle { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--s2-line); background: transparent; text-align: left; width: 100%; }
.s2-toggle-box { flex-shrink: 0; width: 40px; height: 24px; border-radius: 999px; background: var(--s2-surface); border: 1px solid var(--s2-line-strong); position: relative; transition: background-color .16s ease; margin-top: 2px; }
.s2-toggle-box::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--s2-text-3); transition: transform .16s ease, background-color .16s ease; }
.s2-toggle[aria-checked="true"] .s2-toggle-box { background: color-mix(in srgb, var(--s2-accent) 30%, var(--s2-surface)); border-color: var(--s2-accent); }
.s2-toggle[aria-checked="true"] .s2-toggle-box::after { transform: translateX(16px); background: var(--s2-accent); }

/* fields */
.s2-label { display: block; font-size: 12.5px; font-weight: 750; color: var(--s2-text-2); margin-bottom: 8px; }
.s2-input, .s2-textarea { width: 100%; border-radius: 12px; border: 1px solid var(--s2-line); background: var(--s2-bg); color: var(--s2-text); padding: 11px 13px; transition: border-color .16s ease, box-shadow .16s ease; }
.s2-input:focus, .s2-textarea:focus { outline: none; border-color: var(--s2-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--s2-accent) 18%, transparent); }
.s2-textarea { resize: vertical; min-height: 110px; line-height: 1.55; }
.s2-textarea.is-hero { min-height: 190px; font-size: 15.5px; padding: 16px 18px; }
@media (max-width: 760px) { .s2-textarea, .s2-input { font-size: 16px; } }

/* model cards */
.s2-models { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
.s2-model { text-align: left; display: grid; gap: 10px; padding: 14px; border-radius: 14px; border: 1px solid var(--s2-line); background: var(--s2-raised); color: var(--s2-text); }
.s2-model[aria-pressed="true"] { border-color: var(--s2-accent); box-shadow: 0 0 0 1px var(--s2-accent), 0 14px 40px color-mix(in srgb, var(--s2-accent) 12%, transparent); }
.s2-model-name { font-family: var(--s2-head); font-weight: 700; font-size: 15px; }
.s2-meter { display: grid; grid-template-columns: 78px 1fr auto; align-items: center; gap: 8px; font-size: 12px; color: var(--s2-text-2); }
.s2-meter-bar { display: flex; gap: 3px; }
.s2-meter-bar i { flex: 1; height: 5px; border-radius: 3px; background: var(--s2-surface); }
.s2-meter-bar i.is-on { background: var(--s2-accent); }

/* badges */
.s2-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 750; border: 1px solid var(--s2-line); color: var(--s2-text-2); white-space: nowrap; }
.s2-badge.is-ok { color: var(--s2-ok); border-color: color-mix(in srgb, var(--s2-ok) 40%, transparent); background: color-mix(in srgb, var(--s2-ok) 9%, transparent); }
.s2-badge.is-warn { color: var(--s2-warn); border-color: color-mix(in srgb, var(--s2-warn) 40%, transparent); background: color-mix(in srgb, var(--s2-warn) 9%, transparent); }
.s2-badge.is-bad { color: var(--s2-bad); border-color: color-mix(in srgb, var(--s2-bad) 40%, transparent); background: color-mix(in srgb, var(--s2-bad) 9%, transparent); }
.s2-badge.is-accent { color: var(--s2-accent); border-color: color-mix(in srgb, var(--s2-accent) 45%, transparent); background: color-mix(in srgb, var(--s2-accent) 9%, transparent); }

/* banners */
.s2-banner { display: flex; gap: 12px; align-items: flex-start; padding: 13px 15px; border-radius: 12px; border: 1px solid var(--s2-line); background: var(--s2-raised); }
.s2-banner.is-bad { border-color: color-mix(in srgb, var(--s2-bad) 45%, transparent); background: color-mix(in srgb, var(--s2-bad) 7%, var(--s2-raised)); }
.s2-banner.is-warn { border-color: color-mix(in srgb, var(--s2-warn) 45%, transparent); background: color-mix(in srgb, var(--s2-warn) 7%, var(--s2-raised)); }
.s2-banner.is-ok { border-color: color-mix(in srgb, var(--s2-ok) 40%, transparent); }
.s2-banner-body { flex: 1; min-width: 0; display: grid; gap: 8px; }

/* progress */
.s2-progress { height: 8px; border-radius: 999px; background: var(--s2-surface); overflow: hidden; }
.s2-progress > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--s2-accent) 70%, #7d5a0c), var(--s2-accent)); transition: width .5s ease; }
.s2-tasks { display: grid; gap: 10px; }
.s2-task { display: flex; align-items: center; gap: 12px; font-size: 13.5px; color: var(--s2-text-2); }
.s2-task-dot { width: 24px; height: 24px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--s2-line-strong); color: var(--s2-text-3); }
.s2-task.is-done { color: var(--s2-text); } .s2-task.is-done .s2-task-dot { border-color: var(--s2-ok); color: var(--s2-ok); }
.s2-task.is-active { color: var(--s2-text); } .s2-task.is-active .s2-task-dot { border-color: var(--s2-accent); color: var(--s2-accent); }
.s2-task.is-error .s2-task-dot { border-color: var(--s2-bad); color: var(--s2-bad); }

/* cast */
.s2-cast { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.s2-person { display: grid; gap: 10px; padding: 12px; border-radius: 14px; border: 1px solid var(--s2-line); background: var(--s2-raised); }
.s2-person-img { aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: var(--s2-surface); display: grid; place-items: center; color: var(--s2-text-3); }
.s2-person-img img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* shots */
.s2-shots { display: grid; gap: 12px; }
.s2-shot { display: grid; grid-template-columns: 168px minmax(0, 1fr); gap: 16px; padding: 14px; border-radius: 14px; border: 1px solid var(--s2-line); background: var(--s2-raised); }
@media (max-width: 680px) { .s2-shot { grid-template-columns: minmax(0, 1fr); } }
.s2-shot-media { border-radius: 10px; overflow: hidden; background: var(--s2-surface); display: grid; place-items: center; color: var(--s2-text-3); position: relative; align-self: start; }
.s2-shot-media img, .s2-shot-media video { width: 100%; height: 100%; object-fit: cover; display: block; }
.s2-shot-num { position: absolute; top: 8px; left: 8px; min-width: 26px; height: 26px; padding: 0 7px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; font-size: 12px; background: color-mix(in srgb, var(--s2-bg) 78%, transparent); color: var(--s2-text); }
.s2-beats { display: flex; gap: 3px; margin: 2px 0 4px; }
.s2-beat { min-width: 0; padding: 6px 8px; border-radius: 7px; background: var(--s2-surface); border-top: 2px solid color-mix(in srgb, var(--s2-accent) 70%, transparent); font-size: 12px; color: var(--s2-text-2); }
.s2-beat b { display: block; font-family: var(--s2-mono); font-size: 10.5px; color: var(--s2-accent); font-weight: 700; margin-bottom: 2px; }
.s2-kv { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 4px 12px; font-size: 13px; }
.s2-kv dt { color: var(--s2-text-3); font-weight: 650; }
.s2-kv dd { margin: 0; color: var(--s2-text-2); overflow-wrap: anywhere; }
.s2-pre { white-space: pre-wrap; font-family: var(--s2-mono); font-size: 11.5px; line-height: 1.55; color: var(--s2-text-2); background: var(--s2-bg); border: 1px solid var(--s2-line); border-radius: 10px; padding: 12px; max-height: 320px; overflow: auto; }
.s2 details > summary { cursor: pointer; list-style: none; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; font-weight: 700; font-size: 12.5px; color: var(--s2-text-2); }
.s2 details > summary::-webkit-details-marker { display: none; }

/* production grid */
.s2-clips { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
.s2-clip { display: grid; gap: 10px; padding: 10px; border-radius: 14px; border: 1px solid var(--s2-line); background: var(--s2-raised); }
.s2-clip.is-active { border-color: color-mix(in srgb, var(--s2-accent) 60%, var(--s2-line)); }
.s2-clip.is-bad { border-color: color-mix(in srgb, var(--s2-bad) 50%, var(--s2-line)); }
.s2-clip-media { position: relative; border-radius: 10px; overflow: hidden; background: var(--s2-surface); display: grid; place-items: center; color: var(--s2-text-3); }
.s2-clip-media video, .s2-clip-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.s2-shimmer { background: linear-gradient(110deg, var(--s2-surface) 20%, color-mix(in srgb, var(--s2-accent) 12%, var(--s2-surface)) 40%, var(--s2-surface) 60%); background-size: 220% 100%; animation: s2-shimmer 1.6s linear infinite; }
@keyframes s2-shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
.s2-spin { animation: s2-spin 1s linear infinite; }
@keyframes s2-spin { to { transform: rotate(360deg); } }

/* library */
.s2-films { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.s2-film { text-align: left; display: grid; gap: 10px; padding: 10px; border-radius: 14px; border: 1px solid var(--s2-line); background: var(--s2-raised); color: var(--s2-text); transition: border-color .16s ease, transform .16s ease; }
.s2-film:hover { border-color: color-mix(in srgb, var(--s2-accent) 50%, var(--s2-line)); transform: translateY(-1px); }
.s2-film-thumb { aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: var(--s2-surface); display: grid; place-items: center; color: var(--s2-text-3); }
.s2-film-thumb img, .s2-film-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
.s2-empty { display: grid; justify-items: center; text-align: center; gap: 12px; padding: 56px 20px; border: 1px dashed var(--s2-line-strong); border-radius: 18px; }

/* sticky footer action */
.s2-footer { position: sticky; bottom: 0; z-index: 5; margin-top: 28px; padding: 14px 0 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; background: linear-gradient(180deg, transparent, var(--s2-bg) 30%); }

/* modal */
.s2-modal-back { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; padding: 16px; background: color-mix(in srgb, #000 62%, transparent); backdrop-filter: blur(4px); }
.s2-modal { width: min(100%, 480px); max-height: 100%; overflow-y: auto; background: var(--s2-raised); border: 1px solid var(--s2-line-strong); border-radius: 18px; padding: 22px; box-shadow: 0 30px 80px #000a; display: grid; gap: 14px; }

/* toast */
.s2-toast { position: absolute; left: 50%; bottom: 18px; z-index: 30; transform: translateX(-50%); max-width: min(92%, 620px); display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 12px; background: var(--s2-surface); border: 1px solid var(--s2-line-strong); box-shadow: 0 16px 40px #0008; font-size: 13px; }

@media (prefers-reduced-motion: reduce) { .s2 *, .s2 *::before, .s2 *::after { animation: none !important; transition: none !important; } }
`;
