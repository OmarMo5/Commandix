import { AlertTriangle, Clock } from 'lucide-react';
import { dueState, dueLabel, DUE_STYLES } from '../../utils/dueDate';
import { t } from '../../i18n';

/** Red "Overdue N days" / amber "Due today|tomorrow" pill. Renders nothing when there's nothing to flag. */
export default function DueBadge({ task, size = 'md' }) {
  const state = dueState(task);
  if (!state) return null;

  const s = DUE_STYLES[state.kind];
  const Icon = state.kind === 'overdue' ? AlertTriangle : Clock;
  const small = size === 'sm';

  return (
    <span
      title={t('Due {date}', { date: String(task.due_date).slice(0, 10) })}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap',
        fontSize: small ? 10 : 12, padding: small ? '1px 7px' : '3px 10px',
      }}
    >
      <Icon size={small ? 10 : 12} />
      {dueLabel(state)}
    </span>
  );
}
