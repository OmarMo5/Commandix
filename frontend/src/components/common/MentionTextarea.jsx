import { useRef, useState } from 'react';

/**
 * A textarea that suggests people as you type "@": ↑/↓ to move, Enter or Tab to pick,
 * Esc to dismiss. Picking inserts "@Full Name " — the message's tagged people are worked
 * out from that text when it's sent (see utils/mentions.js).
 */
export default function MentionTextarea({ value, onChange, users = [], className = 'form-control', ...rest }) {
  const ref = useRef(null);
  const [menu, setMenu] = useState(null);   // { start, query, index } while a "@…" token is being typed

  const matches = menu
    ? users.filter((u) => u.name.toLowerCase().includes(menu.query.toLowerCase())).slice(0, 6)
    : [];

  // Looks at the text before the caret for an unfinished "@word" (names may have one space: "@Ali ma").
  const detect = (text, caret) => {
    const token = /(^|\s)@([^\s@]*(?: [^\s@]*)?)$/u.exec(text.slice(0, caret));
    setMenu(token ? { start: caret - token[2].length - 1, query: token[2], index: 0 } : null);
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    detect(e.target.value, e.target.selectionStart);
  };

  const choose = (user) => {
    const caret = ref.current.selectionStart;
    const inserted = `@${user.name} `;
    onChange(value.slice(0, menu.start) + inserted + value.slice(caret));
    const position = menu.start + inserted.length;
    setMenu(null);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(position, position);
    });
  };

  const handleKeyDown = (e) => {
    if (!menu || matches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenu((m) => ({ ...m, index: (m.index + 1) % matches.length }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenu((m) => ({ ...m, index: (m.index - 1 + matches.length) % matches.length }));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      choose(matches[menu.index]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMenu(null);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        className={className}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => detect(e.target.value, e.target.selectionStart)}
        onBlur={() => setTimeout(() => setMenu(null), 120)}
        {...rest}
      />

      {menu && matches.length > 0 && (
        <ul className="mention-menu" role="listbox">
          {matches.map((u, i) => (
            <li
              key={u.id}
              role="option"
              aria-selected={i === menu.index}
              className={i === menu.index ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); choose(u); }}
              onMouseEnter={() => setMenu((m) => ({ ...m, index: i }))}
            >
              <span className="avatar" style={{ width: 22, height: 22, fontSize: 10, flexShrink: 0 }}>
                {u.avatar
                  ? <img src={u.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : u.name?.slice(0, 2).toUpperCase()}
              </span>
              <span>{u.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
