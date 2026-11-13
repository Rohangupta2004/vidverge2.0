import { Component } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { T } from './api';

interface Props {
  children: ReactNode;
  /** Short name of the area, used in the friendly message. */
  area?: string;
  onReset?: () => void;
  /** Changing this value clears a caught error (for example the open film id). */
  resetKey?: unknown;
}

interface State { error: Error | null; resetKey: unknown }

/**
 * Keeps one broken panel from blanking the whole Script-to-Video app. The
 * customer sees a plain-language message and a Try again button; the
 * technical detail goes to the console only.
 */
export default class StudioErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error(`[ScriptToVideo] ${this.props.area || 'panel'} crashed`, error, info);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ margin: 24, padding: 24, borderRadius: 18, border: `1px solid color-mix(in srgb, ${T.fault} 40%, transparent)`, background: `color-mix(in srgb, ${T.fault} 8%, ${T.card})`, color: T.bone, fontFamily: T.sans, display: 'grid', gap: 12, maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 16 }}>
          <AlertCircle size={20} color={T.fault} aria-hidden="true" />
          Something went wrong{this.props.area ? ` in ${this.props.area}` : ''}.
        </div>
        <div style={{ color: T.muted, fontSize: 14, lineHeight: 1.5 }}>
          Your saved projects, scripts and any clips already made are safe. Try again, and if it keeps happening, reopen the project from your library.
        </div>
        <div>
          <button type="button" onClick={this.reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, border: 'none', background: T.live, color: 'var(--vg-on-accent, #111)', fontWeight: 700, cursor: 'pointer' }}>
            <RotateCcw size={16} aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    );
  }
}
