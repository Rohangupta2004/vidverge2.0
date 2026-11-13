import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { ImagePlus, UserRound } from 'lucide-react';
import { T } from './api';

export interface MentionOption {
  slug: string;
  label: string;
  imageUrl?: string;
  note?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: MentionOption[];
  /** Opens the "add a character from an image" flow; returns the new option. */
  onAddCharacter?: () => Promise<MentionOption | null>;
  placeholder?: string;
  rows?: number;
  ariaLabel: string;
  style?: CSSProperties;
  disabled?: boolean;
}

function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = before.match(/(^|[\s(])@([\w-]{0,40})$/);
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2].toLowerCase() };
}

/**
 * Textarea with an @ character picker. Typing @ lists saved characters and
 * uploaded reference images; choosing one inserts @slug, which the planner
 * resolves into a reference image on every scene that mentions it.
 */
export default function MentionTextarea({ value, onChange, options, onAddCharacter, placeholder, rows = 8, ariaLabel, style, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [adding, setAdding] = useState(false);

  const matches = useMemo(() => {
    if (!mention) return [];
    return options.filter((o) => !mention.query || o.slug.includes(mention.query) || o.label.toLowerCase().includes(mention.query)).slice(0, 8);
  }, [mention, options]);

  const refresh = (text: string, caret: number) => {
    const next = activeMention(text, caret);
    setMention(next);
    setHighlight(0);
  };

  const insert = (option: MentionOption) => {
    const el = ref.current;
    if (!el || !mention) return;
    const caret = el.selectionStart ?? value.length;
    const next = `${value.slice(0, mention.start)}@${option.slug} ${value.slice(caret)}`;
    onChange(next);
    setMention(null);
    const pos = mention.start + option.slug.length + 2;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos); });
  };

  const addNew = async () => {
    if (!onAddCharacter) return;
    setAdding(true);
    try {
      const created = await onAddCharacter();
      if (created) insert(created);
    } finally {
      setAdding(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mention) return;
    const total = matches.length + (onAddCharacter ? 1 : 0);
    if (event.key === 'Escape') { setMention(null); return; }
    if (!total) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((h) => (h + 1) % total); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((h) => (h - 1 + total) % total); }
    else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      if (highlight < matches.length) insert(matches[highlight]);
      else void addNew();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); refresh(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
        onKeyDown={onKeyDown}
        onClick={(e) => refresh(value, (e.target as HTMLTextAreaElement).selectionStart ?? value.length)}
        onBlur={() => setTimeout(() => setMention(null), 160)}
        className="stv3-input"
        style={{ width: '100%', resize: 'vertical', minHeight: rows * 22, ...style }}
      />
      {mention && (matches.length > 0 || onAddCharacter) && (
        <div role="listbox" aria-label="Characters" className="stv3-popover">
          <div style={{ padding: '8px 12px 4px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.dim }}>Characters</div>
          {matches.map((option, i) => (
            <button
              key={option.slug}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => { e.preventDefault(); insert(option); }}
              className={`stv3-option${i === highlight ? ' is-active' : ''}`}
            >
              {option.imageUrl
                ? <img src={option.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
                : <span className="stv3-avatar"><UserRound size={14} aria-hidden="true" /></span>}
              <span style={{ display: 'grid', textAlign: 'left' }}>
                <span style={{ fontWeight: 600 }}>@{option.slug}</span>
                <span style={{ fontSize: 12, color: T.muted }}>{option.label}{option.note ? ` · ${option.note}` : ''}</span>
              </span>
            </button>
          ))}
          {!matches.length && <div style={{ padding: '6px 12px', fontSize: 13, color: T.muted }}>No saved character matches “{mention.query}”.</div>}
          {onAddCharacter && (
            <button
              type="button"
              role="option"
              aria-selected={highlight === matches.length}
              disabled={adding}
              onMouseDown={(e) => { e.preventDefault(); void addNew(); }}
              className={`stv3-option${highlight === matches.length ? ' is-active' : ''}`}
            >
              <span className="stv3-avatar"><ImagePlus size={14} aria-hidden="true" /></span>
              <span style={{ fontWeight: 600 }}>{adding ? 'Uploading…' : 'Add a character from an image'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
