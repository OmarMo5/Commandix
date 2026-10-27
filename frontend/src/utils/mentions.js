// "@Name" helpers for chat messages. Tags live in the text itself; the people they refer
// to are re-derived from it when sending, so there's no hidden state to keep in sync.

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NOT_WORD = '(?![\\p{L}\\p{N}_])';
const NOT_AFTER_WORD = '(?<![\\p{L}\\p{N}_])';

/** Ids of the users whose "@Name" appears in `text`. Longest names go first so "@Omar Mokhtar" isn't also read as "@Omar". */
export function extractMentionIds(text, users) {
  let rest = text;
  const ids = [];

  [...users].sort((a, b) => b.name.length - a.name.length).forEach((u) => {
    const pattern = `${NOT_AFTER_WORD}@${escapeRegExp(u.name)}${NOT_WORD}`;
    if (new RegExp(pattern, 'iu').test(rest)) {
      ids.push(u.id);
      rest = rest.replace(new RegExp(pattern, 'giu'), ' ');
    }
  });

  return ids;
}

/** Splits a message into plain / tagged chunks: [{ text }, { text: '@Ali', mention: true }, …] */
export function splitMentions(text, users) {
  if (!users?.length) return [{ text }];

  const names = users.map((u) => u.name).sort((a, b) => b.length - a.length).map(escapeRegExp);
  const re = new RegExp(`${NOT_AFTER_WORD}(@(?:${names.join('|')}))${NOT_WORD}`, 'giu');

  const parts = [];
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[1], mention: true });
    last = match.index + match[1].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });

  return parts.length ? parts : [{ text }];
}
