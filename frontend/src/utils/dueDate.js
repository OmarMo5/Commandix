// Due-date helpers shared by the board, the task detail view and group task rows.
// The API sends `due_date` as an ISO date (time part is always midnight UTC), so we
// only ever look at the first 10 characters and compare plain calendar days.

import { t } from '../i18n';

const dayKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysBetween = (fromKey, toKey) =>
  Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86400000);

/**
 * @returns {null | { kind: 'overdue'|'today'|'tomorrow', days: number }}
 *  null when there is nothing to flag (no date, already completed, or due later).
 */
export function dueState(task) {
  if (!task?.due_date || task.status === 'completed') return null;

  const due = String(task.due_date).slice(0, 10);
  const diff = daysBetween(dayKey(new Date()), due);

  if (diff < 0) return { kind: 'overdue', days: -diff };
  if (diff === 0) return { kind: 'today', days: 0 };
  if (diff === 1) return { kind: 'tomorrow', days: 1 };
  return null;
}

export const DUE_STYLES = {
  overdue:  { bg: 'var(--danger-light)', color: 'var(--danger)', border: 'color-mix(in srgb, var(--danger) 35%, transparent)' },
  today:    { bg: 'var(--warning-light)', color: 'var(--warning)', border: 'color-mix(in srgb, var(--warning) 35%, transparent)' },
  tomorrow: { bg: 'color-mix(in srgb, var(--warning) 8%, transparent)', color: 'var(--warning)', border: 'color-mix(in srgb, var(--warning) 25%, transparent)' },
};

export function dueLabel(state) {
  if (!state) return '';
  if (state.kind === 'overdue') return state.days === 1 ? t('Overdue 1 day') : t('Overdue {n} days', { n: state.days });
  return state.kind === 'today' ? t('Due today') : t('Due tomorrow');
}
