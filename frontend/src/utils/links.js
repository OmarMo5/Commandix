// Where things live. A task or group has its own address (/tasks/57, /groups/40), so a link can be
// copied, sent to a colleague, bookmarked, or opened straight from a notification.

/** Notification/server target -> app path. `tab` optionally opens a tab of the task dialog (qa | workflow). */
export function pathFor(target, tab) {
  if (!target) return null;
  const base = target.type === 'group' ? '/groups' : '/tasks';
  return `${base}/${target.id}${tab ? `?tab=${tab}` : ''}`;
}

/** The address of a task object as the API returns it. Groups, and tasks inside a group, live under /groups. */
export function taskPath(task) {
  return pathFor({ type: task.is_private || task.parent_group_id ? 'group' : 'task', id: task.id });
}

/** Which tab of the task dialog a notification is really about. */
export function tabFor(type) {
  if (['task_comment', 'task_question', 'comment_mention', 'comment_reaction'].includes(type)) return 'qa';
  if (type.startsWith('workflow_')) return 'workflow';
  return undefined;
}

const TABS = ['details', 'qa', 'tasks', 'workflow'];
export const validTab = (value) => (TABS.includes(value) ? value : undefined);

/** Query string to keep when moving between a list page and one of its items (everything except ?tab=). */
export function keepSearch(search) {
  const params = new URLSearchParams(search);
  params.delete('tab');
  const text = params.toString();
  return text ? `?${text}` : '';
}
