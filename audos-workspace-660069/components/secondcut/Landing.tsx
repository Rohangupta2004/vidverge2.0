import React, { useEffect, useRef, useState } from 'react';
import { Icon, Logo, LOGO_D, Guides, Modal, STUDIOS, StudioInfo, mediaSrc } from './base';
import { VIDEO } from './media';
import { SecondCutStyles } from './styles';
import { applyVidvergeTheme, readVidvergeTheme, VIDVERGE_THEME_EVENT } from '../ui/Molten';
import { quote, CREDIT_VALUE_USD } from '../../lib/pricing';

export interface LandingAuth {
  step: string;
  email: string;
  setEmail: (value: string) => void;
  otpCode: string;
  setOtpCode: (value: string) => void;
  pendingEmail?: string;
  error: string;
  clearError: () => void;
  loading: boolean;
  resendWait: number;
  submitEmail: (event: React.FormEvent) => void;
  submitOtp: (event: React.FormEvent) => void;
  resend: () => void;
  useAnotherEmail: () => void;
  gdprEnabled: boolean;
  marketingConsent: boolean;
  setMarketingConsent: (value: boolean) => void;
  socialProviders: string[];
  onSocial: (provider: string) => void;
  guestModeEnabled: boolean;
  onGuest: () => void;
}

export interface LandingPack {
  name: string;
  price: string;
  period: string;
  credits: string;
  features: string[];
  cta: string;
  featured: boolean;
  badge?: string;
}

/* ---------- The beam: one fixed projector light. It never moves; it only dims and warms as you scroll. ---------- */
const BEAM_VS = 'attribute vec2 a; varying vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }';
const BEAM_FS = `precision highp float; varying vec2 v; uniform float t, light, gain, amt, sx; uniform vec2 res, m; uniform vec3 tint;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ns(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * ns(p); p = p * 2.03 + 11.7; a *= .5; } return s; }
void main(){ vec2 p = (v - .5) * vec2(res.x / res.y, 1.) * 2.;
  vec2 src = vec2(res.x / res.y * sx, 1.46), d = p - src; float r = length(d), a = atan(d.y, d.x), dir = -1.571 - sx * .9 + m.x * .05;
  float cone = smoothstep(.72, .03, abs(a - dir));
  float ray = fbm(vec2(a * 7. + 3., t * .028)) * .64 + fbm(vec2(a * 22., t * .045 + 5.)) * .36; ray = pow(ray, 2.) * 2.25;
  float fall = exp(-r * .38), beam = cone * ray * fall;
  float core = exp(-r * 2.7) * .8;
  float mote = smoothstep(.972, .997, ns(p * 24. + vec2(t * .04, -t * .07))) * cone * fall * .7;
  vec3 warm = mix(vec3(1., .50, .18), vec3(1., .91, .68), smoothstep(0., .45, beam));
  vec3 rc = mix(warm, mix(tint, vec3(1.), smoothstep(.1, .7, beam) * .5), amt) * beam + vec3(1., .96, .84) * (core + mote);
  vec3 floorGlow = mix(vec3(.95, .76, .29), tint, amt) * exp(-length((p - vec2(-res.x / res.y * .55, -1.25)) * vec2(.55, 1.)) * 1.5) * .11;
  vec3 dk = (rc + floorGlow) * gain;
  vec3 bgL = vec3(.965, .945, .894);
  vec3 lt = mix(bgL, mix(vec3(.80, .56, .16), tint * .7, amt * .6), clamp((beam * .85 + core * .4) * gain, 0., .8));
  vec3 o = mix(dk, lt, light); o += (h21(v * res) - .5) * .012; gl_FragColor = vec4(o, 1.); }`;

type BeamState = { gain: number; tgain: number; tint: number[]; ttint: number[]; amt: number; tamt: number; light: number };

function useBeam(cvRef: React.RefObject<HTMLCanvasElement>, live: React.MutableRefObject<BeamState>) {
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    let gl: WebGLRenderingContext | null = null;
    try { gl = cv.getContext('webgl', { antialias: false, alpha: false }) as WebGLRenderingContext | null; } catch {}
    if (!gl) { cv.style.display = 'none'; return; }
    const g = gl;
    const mk = (type: number, src: string) => { const s = g.createShader(type)!; g.shaderSource(s, src); g.compileShader(s); return s; };
    const pr = g.createProgram()!;
    g.attachShader(pr, mk(g.VERTEX_SHADER, BEAM_VS));
    g.attachShader(pr, mk(g.FRAGMENT_SHADER, BEAM_FS));
    g.linkProgram(pr);
    if (!g.getProgramParameter(pr, g.LINK_STATUS)) { cv.style.display = 'none'; return; }
    g.useProgram(pr);
    g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    const at = g.getAttribLocation(pr, 'a');
    g.enableVertexAttribArray(at);
    g.vertexAttribPointer(at, 2, g.FLOAT, false, 0, 0);
    const U: Record<string, WebGLUniformLocation | null> = {};
    ['t', 'res', 'light', 'gain', 'tint', 'amt', 'sx', 'm'].forEach((n) => { U[n] = g.getUniformLocation(pr, n); });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; const t0 = performance.now(); let mx = 0; let tx = 0; let w = 2; let h = 2;
    const size = () => { const s = Math.min(window.devicePixelRatio || 1, 1.25); w = Math.max(2, Math.round(cv.clientWidth * s)); h = Math.max(2, Math.round(cv.clientHeight * s)); cv.width = w; cv.height = h; g.viewport(0, 0, w, h); };
    const move = (e: PointerEvent) => { mx = e.clientX / window.innerWidth - 0.5; };
    const frame = (now: number) => {
      const L = live.current; const t = reduce ? 3 : (now - t0) / 1000; const k = reduce ? 1 : 0.04;
      L.gain += (L.tgain - L.gain) * k; L.amt += (L.tamt - L.amt) * k;
      for (let i = 0; i < 3; i++) L.tint[i] += (L.ttint[i] - L.tint[i]) * k;
      tx += (mx - tx) * 0.04;
      g.uniform1f(U.t, t); g.uniform2f(U.res, w, h); g.uniform1f(U.light, L.light);
      g.uniform1f(U.gain, L.gain * (cv.clientWidth < 820 ? 0.62 : 0.92) * (reduce ? 1 : Math.min(1, t / 1.8)));
      g.uniform3f(U.tint, L.tint[0], L.tint[1], L.tint[2]); g.uniform1f(U.amt, L.amt);
      g.uniform1f(U.sx, cv.clientWidth < 820 ? 0.72 : 0.78); g.uniform2f(U.m, tx, 0);
      g.drawArrays(g.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    size();
    window.addEventListener('resize', size);
    window.addEventListener('pointermove', move);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); window.removeEventListener('pointermove', move); };
  }, []);
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const CHAPTERS: Array<[string, string]> = [['intro', 'Intro'], ['films', 'Films'], ['studios', 'Studios'], ['how', 'How it works'], ['pricing', 'Pricing'], ['end', 'Start']];
const tcOf = (p: number) => { const f = Math.round(Math.min(1, Math.max(0, p)) * 3600); const s = Math.floor(f / 24); return '00:' + pad2(Math.floor(s / 60)) + ':' + pad2(s % 60) + ':' + pad2(f % 24); };
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/* Real frames from Script-to-Video films in this account. */
const REEL = [
  { img: 'film_103_morning', t: 'Morning Headline', m: 'Final film, 9:16, 0:30' },
  { img: 'frame_62_b1', t: 'A Million Possibilities', m: 'Block 2, 16:9' },
  { img: 'frame_103_b1', t: 'Morning Headline', m: 'Block 2, 9:16' },
  { img: 'film_80_ocean', t: 'Ocean Wave at Sunrise', m: 'Final film, 16:9, 0:06' },
  { img: 'frame_68_b0', t: 'The Spark', m: 'Block 1' },
  { img: 'frame_103_b2', t: 'Morning Headline', m: 'Block 3, 9:16' },
  { img: 'film_62_audos', t: 'A Million Possibilities', m: 'Final film, 16:9, 0:31' },
  { img: 'frame_68_b1', t: 'The Spark', m: 'Block 2' },
  { img: 'frame_103_b3', t: 'Morning Headline', m: 'Block 4, 9:16' },
  { img: 'frame_62_b2', t: 'A Million Possibilities', m: 'Block 3, 16:9' },
  { img: 'film_68_the', t: 'The Spark', m: 'Final film, 16:9, 0:24' },
  { img: 'frame_103_b0', t: 'Morning Headline', m: 'Block 1, 9:16' },
];
const SCRIPT = ['A father reads the morning paper at the kitchen table.', 'His son shows him the phone: “Dad, look at this.”', 'Narrator: “Don’t fear AI. Build with it.”'];
const CAST = [{ n: 'Father', img: 'char_103_father' }, { n: 'Son', img: 'char_103_son' }];
const BLOCKS = [
  { n: 'Block 1', d: '8s', img: 'frame_103_b0', line: 'Father reads the morning paper at the kitchen table.' },
  { n: 'Block 2', d: '8s', img: 'frame_103_b1', line: 'Son shows him the phone: “Dad, look at this.”' },
  { n: 'Block 3', d: '8s', img: 'frame_103_b2', line: 'The newspaper lowers. He leans in, curious.' },
  { n: 'Block 4', d: '6s', img: 'frame_103_b3', line: 'Narrator: “Don’t fear AI. Build with it.”' },
];
const HOW: Array<[string, string]> = [
  ['Script', 'Paste a script or type one line. Your wording is kept as you wrote it.'],
  ['Cast sheets', 'Each recurring character gets one identity sheet. You approve every one.'],
  ['Plan', 'The script is split into blocks that fit the video model. You see the cost before anything renders.'],
  ['Render', 'Blocks render in order. Each one starts from the last frame of the block before it.'],
  ['Finish', 'Voice, captions and music go over the joined clips. The film lands in your Library.'],
];
/* Engines priced from the live rate card in lib/pricing.ts (real engine cost plus 30%). */
const RATES: Array<{ label: string; engine: string; options: Record<string, unknown> }> = [
  { label: 'Kling 3.0 Omni', engine: 'kling-3.0-omni', options: {} },
  { label: 'Omni Flash', engine: 'gemini-omni-1.1-flash', options: {} },
  { label: 'Seedance 2.5', engine: 'openrouter/bytedance/seedance-2.5', options: { resolution: '720p' } },
  { label: 'Veo 3.1 with audio', engine: 'openrouter/google/veo-3.1', options: { audio: true } },
  { label: 'HeyGen avatar', engine: 'heygen/avatar_iv', options: {} },
];
function creditsFor(engine: string, options: Record<string, unknown>, seconds: number): number {
  try {
    const q = quote(engine, { ...(options as any), seconds } as any) as any;
    const c = Number(q?.credits);
    return Number.isFinite(c) && c > 0 ? c : 0;
  } catch {
    return 0;
  }
}
const packCredits = (p: LandingPack) => parseInt(String(p.credits).replace(/[^0-9]/g, ''), 10) || 0;

function XCard({ q, onTry }: { q: StudioInfo; onTry: () => void }) {
  return (
    <article className="xcard tinted" style={{ ['--hue' as any]: q.hue }}>
      <div className="xshot"><img src={mediaSrc(q.img)} alt="" /><Guides /></div>
      <div className="xbody">
        <div className="row"><span className="xicon"><Icon n={q.icon} size={19} /></span><h3>{q.name}</h3></div>
        <p className="ink2">{q.line}</p>
        <div className="giveget"><div><span className="label">You give</span><p>{q.give}</p></div><div><span className="label">You get</span><p>{q.get}</p></div></div>
        <ol className="xsteps">{q.steps.map((s, k) => <li key={s}><b className="mono">{k + 1}</b>{s}</li>)}</ol>
        <button type="button" className="btn" onClick={onTry}>Try {q.name}</button>
      </div>
    </article>
  );
}

function Board({ hi, hf }: { hi: number; hf: number }) {
  return (
    <div className="board panel">
      <div className="b-row">
        <div className={'b-cell' + (hi === 0 ? ' now' : '')}><span className="label">Script</span>{SCRIPT.map((l) => <p key={l}>{l}</p>)}</div>
        <div className={'b-cell' + (hi < 1 ? ' dim' : hi === 1 ? ' now' : '')}><span className="label">Cast sheets</span><div className="row" style={{ alignItems: 'flex-start' }}>{CAST.map((c) => <figure key={c.n}><img src={mediaSrc(c.img)} alt="" /><figcaption><Icon n="lock" size={12} />{c.n}</figcaption></figure>)}</div></div>
      </div>
      <div className={'b-blocks' + (hi < 2 ? ' dim' : hi < 4 ? ' now' : '')}>
        {BLOCKS.map((b, i) => (
          <div key={b.n} className="b-block">
            <div className="shot">{i < hf ? <img src={mediaSrc(b.img)} alt="" /> : <span className="mono">{b.d}</span>}{i > 0 && i < hf ? <span className="chain" title="Starts from the last frame of the block before"><Icon n="link" size={11} /></span> : null}</div>
            <b>{b.n}, {b.d}</b><span>{b.line}</span>
          </div>
        ))}
      </div>
      <div className={'b-final' + (hi < 4 ? ' dim' : ' now')}>
        <div className="tracks">
          <div className="trk v">{BLOCKS.map((b) => <i key={b.n} style={{ flex: parseInt(b.d, 10) }}>{b.d}</i>)}</div>
          <div className="trk a"><i style={{ flex: 1 }}>Voice, one narrator</i></div>
          <div className="trk c"><i style={{ flex: 1 }}>Captions, timed to each word</i></div>
        </div>
        <figure className="final"><img src={mediaSrc('film_103_morning')} alt="Morning Headline, the finished film" /></figure>
      </div>
    </div>
  );
}

/* A film tile that plays by itself: muted, looping, and only while it is on screen. The frame shows first. */
function FilmClip({ f }: { f: { img: string; t: string; m: string } }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !VIDEO[f.img] || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); }); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <figure>
      {VIDEO[f.img] ? <video ref={ref} src={VIDEO[f.img]} poster={mediaSrc(f.img)} muted loop playsInline preload="metadata" aria-label={f.t} /> : <img src={mediaSrc(f.img)} alt="" />}
      <figcaption><b>{f.t}</b><span>{f.m}</span></figcaption>
    </figure>
  );
}

function Calc({ packs }: { packs: LandingPack[] }) {
  const [m, setM] = useState(0);
  const [s, setS] = useState(30);
  const cr = Math.max(1, creditsFor(RATES[m].engine, RATES[m].options, s));
  const sorted = packs.map((p) => ({ p, c: packCredits(p) })).filter((x) => x.c > 0).sort((a, b) => a.c - b.c);
  const fit = sorted.find((x) => x.c >= cr);
  return (
    <div className="panel calc">
      <h3 style={{ fontSize: 22 }}>What will my video cost?</h3>
      <div className="row wrap" role="group" aria-label="Video model" style={{ gap: 6 }}>{RATES.map((r, i) => <button type="button" key={r.label} className={'chip' + (i === m ? ' on' : '')} aria-pressed={i === m} onClick={() => setM(i)}>{r.label}</button>)}</div>
      <label className="field"><span className="label">Length of video: <b className="mono">{s} seconds</b></span><input type="range" min="5" max="180" step="5" value={s} onChange={(e) => setS(+e.target.value)} /></label>
      <div className="calc-out"><b>{cr}</b><span style={{ fontSize: 18 }}>credits</span><span className="mono muted">about ${(cr * CREDIT_VALUE_USD).toFixed(2)}</span></div>
      <p className="ink2" style={{ fontSize: 14 }}>{fit ? 'Fits in ' + (fit.p.price === 'Free' ? 'the free starter credits' : 'the ' + fit.p.name + ' pack') + (fit.c > cr ? ', with ' + (fit.c - cr) + ' left over.' : '.') : 'Needs more than one of the largest pack.'}</p>
      <p className="hint" style={{ marginTop: 'auto' }}>Priced from the live rate card: the real engine cost plus 30%. The exact cost is shown before every generation.</p>
    </div>
  );
}

function PackCard({ p, onPick }: { p: LandingPack; onPick: () => void }) {
  return (
    <div className={'panel price' + (p.featured ? ' best' : '')}>
      <div className="row between"><b>{p.name}</b>{p.featured ? <span className="pill gold">{p.badge || 'Most used'}</span> : null}</div>
      <div><span className="amt">{p.price}</span> <span className="muted">{p.period}</span></div>
      <ul>{p.features.map((f) => <li key={f}><Icon n="check" />{f}</li>)}</ul>
      <button type="button" className="btn btn-sm" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} onClick={onPick}>{p.cta}</button>
    </div>
  );
}

/* Sign in: the real email + one-time-code flow from EmailGate. */
function Login({ auth, onClose }: { auth: LandingAuth; onClose: () => void }) {
  const ok = /.+@.+\..+/.test(auth.email);
  const codeStep = auth.step === 'otp';
  return (
    <Modal onClose={auth.loading ? undefined : onClose} label="Sign in">
      <Logo size={54} />
      <h2 style={{ fontSize: 32, marginTop: 18 }}>{codeStep ? 'Check your email' : 'Sign in or start free'}</h2>
      {!codeStep ? (
        <form className="col" style={{ marginTop: 12, gap: 14 }} onSubmit={auth.submitEmail}>
          <p className="ink2">Enter your email and go straight to your studio. Your 30 free credits are ready.</p>
          <input className="input" type="email" autoFocus autoComplete="email" placeholder="you@email.com" value={auth.email} disabled={auth.loading} onChange={(e) => { auth.setEmail(e.target.value); auth.clearError(); }} aria-label="Email" data-testid="input-email-modal" />
          {auth.gdprEnabled ? (
            <label className="row" style={{ alignItems: 'flex-start', gap: 10, fontSize: 12.5 }}>
              <input type="checkbox" checked={auth.marketingConsent} onChange={(e) => auth.setMarketingConsent(e.target.checked)} style={{ marginTop: 3 }} data-testid="checkbox-consent-modal" />
              <span className="ink2">I agree to receive marketing emails and accept the <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-text)', textDecoration: 'underline' }}>privacy policy</a>. Unsubscribe anytime.</span>
            </label>
          ) : null}
          <button type="submit" className="btn btn-gold btn-lg" disabled={!ok || auth.loading} data-testid="button-get-started-modal">{auth.loading ? 'Sending your code…' : 'Send my code'}</button>
          {auth.error ? <p role="alert" style={{ color: 'var(--bad)', fontSize: 13.5 }} data-testid="text-error-modal">{auth.error}</p> : null}
          <p className="hint">No password. We email you a one-time code each time you sign in.</p>
          {auth.socialProviders.length || auth.guestModeEnabled ? (
            <div className="col" style={{ gap: 8 }}>
              {auth.socialProviders.map((provider) => <button key={provider} type="button" className="btn" style={{ textTransform: 'capitalize' }} onClick={() => auth.onSocial(provider)}>Continue with {provider}</button>)}
              {auth.guestModeEnabled ? <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={auth.onGuest}>Continue as guest</button> : null}
            </div>
          ) : null}
        </form>
      ) : (
        <form className="col" style={{ marginTop: 12, gap: 14 }} onSubmit={auth.submitOtp}>
          <p className="ink2">Enter the code sent to <b>{auth.pendingEmail || auth.email}</b>.</p>
          <input className="input code-in" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={8} placeholder="••••" value={auth.otpCode} disabled={auth.loading} onChange={(e) => { auth.setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8)); auth.clearError(); }} aria-label="Verification code" data-testid="input-otp-modal" />
          <button type="submit" className="btn btn-gold btn-lg" disabled={auth.otpCode.length < 4 || auth.loading} data-testid="button-verify-otp-modal">{auth.loading ? 'Verifying…' : 'Verify and open Vidverge'}</button>
          {auth.error ? <p role="alert" style={{ color: 'var(--bad)', fontSize: 13.5 }}>{auth.error}</p> : null}
          <div className="row between">
            <button type="button" className="btn btn-ghost btn-sm" disabled={auth.resendWait > 0 || auth.loading} onClick={auth.resend}>{auth.resendWait > 0 ? 'Resend in ' + auth.resendWait + 's' : 'Resend code'}</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={auth.loading} onClick={auth.useAnotherEmail}>Use another email</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function SecondCutLanding({ auth, packs, brandName = 'Vidverge' }: { auth: LandingAuth; packs: LandingPack[]; brandName?: string }) {
  const sc = useRef<HTMLDivElement | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const nodes = useRef<Record<string, HTMLElement | null>>({});
  const tc = useRef<HTMLSpanElement | null>(null);
  const fill = useRef<HTMLElement | null>(null);
  const logo = useRef<SVGSVGElement | null>(null);
  const live = useRef<BeamState>({ gain: 0, tgain: 1, tint: [0.95, 0.76, 0.29], ttint: [0.95, 0.76, 0.29], amt: 0, tamt: 0, light: 0 });
  const [theme, setTheme] = useState(() => readVidvergeTheme());
  const [ch, setCh] = useState(0);
  const [si, setSi] = useState(0);
  const [hi, setHi] = useState(0);
  const [hf, setHf] = useState(0);
  const [w8, setW8] = useState(CHAPTERS.map(() => 1));
  const [narrow, setNarrow] = useState(() => window.innerWidth < 900);
  const [loginOpen, setLoginOpen] = useState(false);
  live.current.light = theme === 'light' ? 1 : 0;
  useBeam(cv, live);

  useEffect(() => {
    const sync = (event: Event) => setTheme((event as CustomEvent).detail?.theme === 'light' ? 'light' : 'dark');
    window.addEventListener(VIDVERGE_THEME_EVENT, sync);
    return () => window.removeEventListener(VIDVERGE_THEME_EVENT, sync);
  }, []);
  // A code that was requested from the hero opens the sign-in sheet on the code step.
  useEffect(() => { if (auth.step === 'otp') setLoginOpen(true); }, [auth.step]);

  const reg = (id: string) => (el: HTMLElement | null) => { nodes.current[id] = el; };
  useEffect(() => {
    const el = sc.current;
    if (!el) return;
    let raf = 0;
    const was = { ch: -1, si: -1, hi: -1, hf: -1 };
    const cl = (x: number) => Math.min(1, Math.max(0, x));
    const paths = logo.current ? Array.from(logo.current.querySelectorAll('path')) : [];
    const calc = () => {
      raf = 0;
      const st = el.scrollTop; const vh = el.clientHeight; const max = Math.max(1, el.scrollHeight - vh); const n = nodes.current; const L = live.current;
      const loc = (k: string) => { const node = n[k]; return node ? cl((st - node.offsetTop) / Math.max(1, node.offsetHeight - vh)) : 0; };
      let c = 0;
      CHAPTERS.forEach((x, i) => { const node = n[x[0]]; if (node && st + vh * 0.5 >= node.offsetTop) c = i; });
      if (c !== was.ch) { was.ch = c; setCh(c); }
      const p = st / max;
      if (tc.current) tc.current.textContent = tcOf(p);
      if (fill.current) fill.current.style.transform = 'scaleX(' + cl((st + vh * p) / el.scrollHeight) + ')';
      const sidx = Math.min(8, Math.floor(loc('studios') * 9));
      if (sidx !== was.si) { was.si = sidx; setSi(sidx); }
      const hp = loc('how') * 5; const hidx = Math.min(4, Math.floor(hp)); const hfr = hidx > 3 ? 4 : hidx === 3 ? Math.min(4, 1 + Math.floor((hp - 3) * 4)) : 0;
      if (hidx !== was.hi) { was.hi = hidx; setHi(hidx); }
      if (hfr !== was.hf) { was.hf = hfr; setHf(hfr); }
      const end = n.end;
      if (end) { const lp = cl((st + vh - end.offsetTop - vh * 0.22) / (vh * 0.62)); paths.forEach((pa) => { (pa as SVGPathElement).style.strokeDashoffset = String(cl(1 - (lp * 1.3 - Number(pa.getAttribute('data-i') || 0) * 0.15))); }); }
      L.tgain = [1 - cl(st / (vh * 0.8)) * 0.62, 0.36, 0.3, 0.26, 0.2, 0.58][c];
      L.tamt = [0, 0.3, 0.7, 0.35, 0, 0][c];
      L.ttint = c === 2 ? hexRgb(STUDIOS[sidx].hue) : c === 1 ? [0.21, 0.79, 0.71] : c === 3 ? [1, 0.49, 0.27] : [0.95, 0.76, 0.29];
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(calc); };
    const rs = () => { setNarrow(window.innerWidth < 900); setW8(CHAPTERS.map((x) => (nodes.current[x[0]] ? nodes.current[x[0]]!.offsetHeight : 1))); on(); };
    el.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', rs);
    const t = window.setTimeout(rs, 60);
    calc();
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf); el.removeEventListener('scroll', on); window.removeEventListener('resize', rs); };
  }, []);

  const jump = (k: string) => { const nd = nodes.current[k]; if (nd && sc.current) sc.current.scrollTo({ top: nd.offsetTop + (k === 'intro' ? 0 : 2), behavior: 'smooth' }); };
  const toStudio = (i: number) => { const nd = nodes.current.studios; const el = sc.current; if (nd && el) el.scrollTo({ top: nd.offsetTop + ((i + 0.5) / 9) * (nd.offsetHeight - el.clientHeight), behavior: 'smooth' }); };
  const openLogin = () => { auth.clearError(); setLoginOpen(true); };
  const heroSubmit = (e: React.FormEvent) => { setLoginOpen(true); auth.submitEmail(e); };
  const toggleTheme = () => { const next = theme === 'dark' ? 'light' : 'dark'; applyVidvergeTheme(next); setTheme(next); };

  return (
    <div className="vx" style={{ position: 'fixed', inset: 0, background: 'var(--bg)' }} data-testid="second-cut-landing">
      <SecondCutStyles />
      <div className="land" ref={sc}>
        <canvas className="beam" ref={cv} />
        <header className="lnav"><div className="inner">
          <button type="button" className="brand" onClick={() => jump('intro')} aria-label={brandName + ' home'}><Logo size={38} /><span>{brandName}</span></button>
          <span className="grow" />
          <button type="button" className="iconbtn" onClick={toggleTheme} aria-label="Switch theme"><Icon n={theme === 'dark' ? 'sun' : 'moon'} /></button>
          <button type="button" className="btn btn-sm" onClick={openLogin} data-testid="button-nav-start">Sign in</button>
        </div></header>

        <section className="hero" ref={reg('intro')}>
          <div className="inner">
            <h1>Type your idea.<br /><span className="goldline">Get a finished video.</span></h1>
            <p className="lede">{brandName} writes the script, makes the scenes, adds the voice and captions, and hands you a video that is ready to post.</p>
            <form className="cta glass" onSubmit={heroSubmit}>
              <input className="input" type="email" autoComplete="email" placeholder="you@email.com" value={auth.email} onChange={(e) => { auth.setEmail(e.target.value); auth.clearError(); }} aria-label="Email" data-testid="input-email" />
              <button className="btn btn-gold btn-lg" type="submit" disabled={auth.loading} data-testid="button-get-started">{auth.loading ? 'Opening…' : 'Start creating'}</button>
            </form>
            <p className="micro">No credit card. 30 free credits. Instant access.</p>
          </div>
          <div className="reel" aria-hidden="true"><div className="reel-tilt"><div className="reel-in">{REEL.concat(REEL).map((f, i) => <span key={i} className="fr"><img src={mediaSrc(f.img)} alt="" loading="lazy" /></span>)}</div></div></div>
        </section>

        <section className="filmsec" ref={reg('films')}><div className="inner">
          <div className="copy">
            <h2>Videos made in {brandName}.</h2>
            <p className="lead">Every clip is from a film made in this account with Script-to-Video, in vertical, square and wide shapes.</p>
          </div>
          <div className="filmgrid">{REEL.slice(0, 8).map((f, i) => <FilmClip key={i} f={f} />)}</div>
          <p className="lead">Nine studios, one login. Pay per use at ${CREDIT_VALUE_USD.toFixed(2)} a credit, with 30 free credits to start.</p>
        </div></section>

        <section className="studios" ref={reg('studios')} style={narrow ? undefined : { height: 'calc(100vh + 290vh)' }}>
          <div className={narrow ? '' : 'pin'}><div className="inner two">
            <div className="copy">
              <h2>Nine studios. One login.</h2>
              {narrow ? <p className="lead">Each studio makes one kind of video. Here is what you give each one and what you get back.</p> : (
                <ol className="xlist">{STUDIOS.map((q, i) => <li key={q.id} className={'tinted' + (i === si ? ' on' : '')} style={{ ['--hue' as any]: q.hue }}><button type="button" onClick={() => toStudio(i)} aria-current={i === si}><span>{q.name}</span><span className="tg">{q.tag}</span></button></li>)}</ol>
              )}
            </div>
            {narrow ? null : <XCard key={si} q={STUDIOS[si]} onTry={openLogin} />}
          </div>
          {narrow ? <div className="inner xstack">{STUDIOS.map((q) => <XCard key={q.id} q={q} onTry={openLogin} />)}</div> : null}
          </div>
        </section>

        <section className="how" ref={reg('how')} style={narrow ? undefined : { height: '380vh' }}>
          <div className={narrow ? '' : 'pin'}><div className="inner two">
            <div className="copy">
              <h2>How a script becomes a film.</h2>
              <ol className={'hsteps' + (narrow ? ' all' : '')}>{HOW.map((x, i) => <li key={x[0]} className={narrow ? '' : i === hi ? 'on' : i < hi ? 'done' : ''}><span className="n">{i + 1}</span><div><b>{x[0]}</b><p>{x[1]}</p></div></li>)}</ol>
            </div>
            <Board hi={narrow ? 4 : hi} hf={narrow ? 4 : hf} />
          </div></div>
        </section>

        <section className="pricing" ref={reg('pricing')}><div className="inner">
          <div className="copy"><h2>Pay only for what you make.</h2>
            <p className="lead" style={{ maxWidth: '60ch' }}>No subscription. One credit is ${CREDIT_VALUE_USD.toFixed(2)}, which is the real engine cost plus 30%. Text and images are free, and failed renders are refunded.</p></div>
          <div className="pgrid"><Calc packs={packs} /><div className="packs">{packs.map((p) => <PackCard key={p.name} p={p} onPick={openLogin} />)}</div></div>
          <div className="panel concierge"><div className="grow" style={{ minWidth: 220 }}><b style={{ fontFamily: 'var(--display)', fontSize: 20 }}>We make your video for you</b><p className="ink2">Coming soon. Send us your idea and we handle script, characters, editing and delivery.</p></div><button type="button" className="btn" onClick={openLogin}>Join the waitlist</button></div>
        </div></section>

        <section className="finale" ref={reg('end')}>
          <svg ref={logo} className="biglogo" viewBox="-6 -10 112 82" role="img" aria-label={brandName}>
            <defs><linearGradient id="lgb" x1="0" x2="1"><stop offset="0" stopColor="#ffab00" /><stop offset=".5" stopColor="#fff3c2" /><stop offset="1" stopColor="#ffa600" /></linearGradient></defs>
            {LOGO_D.map((d, i) => <g key={i} opacity={1 - i * 0.14}><path d={d} pathLength={1} data-i={i} className="g2" /><path d={d} pathLength={1} data-i={i} className="g1" /><path d={d} pathLength={1} data-i={i} className="core" /></g>)}
          </svg>
          <div className="inner copy">
            <h2>Make your first video today.</h2>
            <p className="lead" style={{ marginInline: 'auto' }}>30 free credits, no card, every studio open from the first minute.</p>
            <button type="button" className="btn btn-gold btn-lg" style={{ marginTop: 26 }} onClick={openLogin}>Start free</button>
          </div>
          <footer className="lfoot"><div className="inner"><span>© {new Date().getFullYear()} {brandName}</span><span className="row wrap" style={{ gap: 18 }}><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refund">Refund Policy</a><a href="/pricing">Pricing</a></span></div></footer>
        </section>

        <nav className="scrub glass" aria-label="Page chapters">
          <span className="tc" ref={tc}>00:00:00:00</span><span className="cur">{CHAPTERS[ch][1]}</span>
          <div className="scrub-track">{CHAPTERS.map((x, i) => <button type="button" key={x[0]} className={i === ch ? 'on' : ''} style={{ flex: w8[i] }} onClick={() => jump(x[0])} aria-current={i === ch} aria-label={x[1]}><span>{x[1]}</span></button>)}<i ref={fill as any} /></div>
          <span className="sc mono muted" style={{ fontSize: 12 }}>{ch + 1} of {CHAPTERS.length}</span>
        </nav>
      </div>
      {loginOpen ? <Login auth={auth} onClose={() => setLoginOpen(false)} /> : null}
    </div>
  );
}
