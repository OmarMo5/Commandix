import { useState, useEffect, useRef } from 'react';
import { SmilePlus } from 'lucide-react';
import { t } from '../../i18n';

// Keep in sync with CommentReaction::ALLOWED on the server.
const REACTION_EMOJI = ['👍', '❤️', '🎉', '😂', '👀', '✅'];

/**
 * Reactions under a message: a chip per emoji (highlighted when you used it, tooltip lists who),
 * plus a small "add reaction" picker. Clicking a chip toggles your own reaction.
 */
export default function ReactionBar({ reactions = [], onToggle, disabled = false }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (reactions.length === 0 && disabled) return null;

  return (
    <div className="reactions" ref={box}>
      {reactions.map((r) => (
        <button
          type="button"
          key={r.emoji}
          className={`reaction-chip ${r.reacted ? 'mine' : ''}`}
          title={r.users.join(', ')}
          disabled={disabled}
          aria-pressed={r.reacted}
          onClick={() => onToggle(r.emoji)}
        >
          <span className="reaction-emoji">{r.emoji}</span>
          <span className="reaction-count">{r.count}</span>
        </button>
      ))}

      {!disabled && (
        <span className="reaction-add-wrap">
          <button type="button" className="reaction-add" title={t('Add reaction')} aria-label={t('Add reaction')} onClick={() => setOpen((v) => !v)}>
            <SmilePlus size={15} />
          </button>
          {open && (
            <div className="reaction-picker" role="menu">
              {REACTION_EMOJI.map((emoji) => (
                <button type="button" key={emoji} role="menuitem" onClick={() => { setOpen(false); onToggle(emoji); }}>{emoji}</button>
              ))}
            </div>
          )}
        </span>
      )}
    </div>
  );
}
