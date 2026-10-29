import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import GroupSubtaskModal from '../groups/GroupSubtaskModal';
import DueBadge from '../../components/common/DueBadge';
import { openAttachment } from '../../utils/downloadAttachment';
import { useLive } from '../../context/LiveContext';
import MentionTextarea from '../../components/common/MentionTextarea';
import { extractMentionIds, splitMentions } from '../../utils/mentions';
import { Pencil } from 'lucide-react';
import { t, formatDate, formatDateTime } from '../../i18n';
import ReactionBar from '../../components/common/ReactionBar';

const priorityBadge = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high' };
const statusBadge   = { pending: 'badge-pending', in_progress: 'badge-in_progress', completed: 'badge-completed' };
const statusLabel   = { pending: t('Pending'), in_progress: t('In Progress'), completed: t('Completed') };

export default function TaskDetailModal({ taskId, onClose, onStatusChanged }) {
  const [task, setTask]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('details');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completingStep, setCompletingStep] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  // Q&A state
  const [comments, setComments]       = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment]   = useState('');
  const [isQuestion, setIsQuestion]   = useState(false);
  const [replyTo, setReplyTo]         = useState(null);   // { id, user }
  const [replyText, setReplyText]     = useState('');
  const [posting, setPosting]         = useState(false);
  const commentsEndRef = useRef(null);
  const { user, isAdminOrAbove, isManager, isSuperAdmin }  = useAuth();
  const [closing, setClosing] = useState(false);
  const { tasks_unread, refresh: refreshLive } = useLive();
  const commentsSig = useRef('');
  const lastMarked = useRef('');
  // Assignee management
  const [candidateUsers, setCandidateUsers] = useState([]);
  const [newAssigneeId, setNewAssigneeId]   = useState('');
  const [assigneeBusy, setAssigneeBusy]     = useState(false);
  // Mention management
  const [candidateManagers, setCandidateManagers] = useState([]);
  const [newMentionId, setNewMentionId]     = useState('');
  const [mentionBusy, setMentionBusy]       = useState(false);
  // Checklist
  const [checklist, setChecklist]           = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [checklistBusy, setChecklistBusy]   = useState(false);
  // Tasks-inside-a-group
  const [subtasks, setSubtasks]             = useState([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [openSubtaskId, setOpenSubtaskId]   = useState(null);
  // "Seen by" markers + inline rename (private groups / their tasks)
  const [readers, setReaders]               = useState([]);
  const readersSig = useRef('');
  const [editing, setEditing]               = useState(false);
  const [editForm, setEditForm]             = useState({ title: '', description: '' });
  const [savingEdit, setSavingEdit]         = useState(false);
  const [groupBusy, setGroupBusy]           = useState(false);

  const loadTask = () =>
    api.get(`/tasks/${taskId}`)
      .then(r => setTask(r.data))
      .catch(() => { toast.error(t('Failed to load task')); onClose(); })
      .finally(() => setLoading(false));

  // A cheap fingerprint of a comment list, so live polling only re-renders when something changed.
  const reactionSig = (x) => (x.reaction_summary || []).map(r => `${r.emoji}${r.count}${r.reacted ? '*' : ''}`).join('');
  const signature = (list) => list.map(c => `${c.id}:${c.replies?.length || 0}:${c.is_answered ? 1 : 0}:${reactionSig(c)}:${(c.replies || []).map(reactionSig).join('|')}`).join(',');

  const loadComments = () => {
    setCommentsLoading(true);
    api.get(`/tasks/${taskId}/comments`)
      .then(r => { commentsSig.current = signature(r.data); setComments(r.data); })
      .finally(() => setCommentsLoading(false));
  };

  const loadReaders = () =>
    api.get(`/tasks/${taskId}/readers`).then(r => {
      const next = JSON.stringify(r.data);
      if (next !== readersSig.current) { readersSig.current = next; setReaders(r.data); }
    }).catch(() => {});

  // Quiet refresh for the live poll: no spinner, no state churn unless there's something new.
  const pollComments = () => {
    loadReaders();
    return api.get(`/tasks/${taskId}/comments`).then(r => {
      const next = signature(r.data);
      if (next !== commentsSig.current) { commentsSig.current = next; setComments(r.data); }
    }).catch(() => {});
  };

  const loadChecklist = () => {
    setChecklistLoading(true);
    api.get(`/tasks/${taskId}/checklist`)
      .then(r => setChecklist(r.data))
      .catch(() => {})
      .finally(() => setChecklistLoading(false));
  };

  const loadSubtasks = () => {
    setSubtasksLoading(true);
    api.get(`/tasks/${taskId}/subtasks`)
      .then(r => setSubtasks(r.data))
      .catch(() => {})
      .finally(() => setSubtasksLoading(false));
  };

  useEffect(() => {
    loadTask();
    loadComments();
    loadChecklist();
    loadSubtasks();
  }, [taskId]);

  // ── Assignee management ───────────────────────────────────────────────────
  // A private group's membership is locked down to its creator (+ Super Admin) —
  // no department-manager fallback, since a group is meant to cross departments.
  // A sub-task inside a group additionally lets the *group's* creator manage it.
  const lockedAt = task?.closed_at || task?.archived_at || task?.parent_group?.closed_at || task?.parent_group?.archived_at;
  const isArchived = !!(task?.archived_at || task?.parent_group?.archived_at) && !(task?.closed_at || task?.parent_group?.closed_at);
  const locked = !!lockedAt && !isSuperAdmin();
  const canManageAssignees = task && !locked && (
    task.parent_group_id
      ? (isSuperAdmin() || task.creator_id === user?.id || task.parent_group?.creator_id === user?.id)
      : task.is_private
        ? (isSuperAdmin() || task.creator_id === user?.id)
        : (
            isAdminOrAbove() ||
            (isManager() && (
              (task.department?.id && task.department.id === user?.department?.id) ||
              task.mentions?.some(m => m.id === user?.id)
            ))
          )
  );

  useEffect(() => {
    if (!canManageAssignees) return;
    if (task?.parent_group_id) {
      // Candidates for a sub-task are strictly the parent group's own members —
      // never the company directory, a sub-task can't reach outside the group.
      setCandidateUsers(task.parent_group?.assignees || []);
    } else if (task?.is_private) {
      // The permission-gated /users list may not be reachable by a non-admin
      // group creator — the directory endpoint is open to any authenticated user.
      api.get('/users/directory').then(r => setCandidateUsers(r.data || []));
    } else {
      api.get('/users', { params: { per_page: 200 } }).then(r => setCandidateUsers(r.data.data || []));
    }
    // eslint-disable-next-line
  }, [canManageAssignees]);

  const addAssignee = async () => {
    if (!newAssigneeId) return;
    setAssigneeBusy(true);
    try {
      await api.post(`/tasks/${taskId}/assignees`, { user_id: newAssigneeId });
      setNewAssigneeId('');
      await loadTask();
      toast.success(t('Assignee added'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to add assignee'));
    } finally { setAssigneeBusy(false); }
  };

  const removeAssignee = async (userId) => {
    setAssigneeBusy(true);
    try {
      await api.delete(`/tasks/${taskId}/assignees/${userId}`);
      await loadTask();
      toast.success(t('Assignee removed'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to remove assignee'));
    } finally { setAssigneeBusy(false); }
  };

  // ── Mention management ────────────────────────────────────────────────────
  // On a sub-task inside a group, mentioning is allowed (tagging a fellow group
  // member) and gated the same way editing is — its own creator, the group's
  // creator, or Super Admin.
  const canManageMentions = task && !locked && (
    task.parent_group_id
      ? (isSuperAdmin() || task.creator_id === user?.id || task.parent_group?.creator_id === user?.id)
      : (
          isAdminOrAbove() ||
          task.creator_id === user?.id ||
          (isManager() && task.department?.id && task.department.id === user?.department?.id)
        )
  );

  useEffect(() => {
    if (!canManageMentions) return;
    if (task?.parent_group_id) {
      // Candidates are the whole group's membership — same pool used for @tags.
      const pool = [task.parent_group?.creator, ...(task.parent_group?.assignees || [])]
        .filter((u, idx, arr) => u && arr.findIndex(x => x?.id === u.id) === idx);
      setCandidateManagers(pool);
    } else {
      api.get('/departments/managers-list').then(r => setCandidateManagers(r.data || []));
    }
    // eslint-disable-next-line
  }, [canManageMentions]);

  const addMention = async () => {
    if (!newMentionId) return;
    setMentionBusy(true);
    try {
      await api.post(`/tasks/${taskId}/mentions`, { user_id: newMentionId });
      setNewMentionId('');
      await loadTask();
      toast.success(t('Manager mentioned'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to add mention'));
    } finally { setMentionBusy(false); }
  };

  const removeMention = async (userId) => {
    setMentionBusy(true);
    try {
      await api.delete(`/tasks/${taskId}/mentions/${userId}`);
      await loadTask();
      toast.success(t('Mention removed'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to remove mention'));
    } finally { setMentionBusy(false); }
  };

  // ── Checklist ──────────────────────────────────────────────────────────────
  const canEditChecklist = task && !locked && (
    task.parent_group_id
      ? (isSuperAdmin() || task.creator_id === user?.id || task.parent_group?.creator_id === user?.id)
      : task.is_private
        ? (isSuperAdmin() || task.creator_id === user?.id)
        : (
            isAdminOrAbove() ||
            task.creator_id === user?.id ||
            (isManager() && task.department?.id && task.department.id === user?.department?.id)
          )
  );
  const canToggleChecklist = !locked && (canEditChecklist || (task?.assignees?.some(a => a.id === user?.id)));

  const addChecklistItem = async () => {
    if (!newChecklistTitle.trim()) return;
    setChecklistBusy(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/checklist`, { title: newChecklistTitle.trim() });
      setChecklist(prev => [...prev, data]);
      setNewChecklistTitle('');
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to add item'));
    } finally { setChecklistBusy(false); }
  };

  const toggleChecklistItem = async (item) => {
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, is_done: !i.is_done } : i));
    try {
      await api.put(`/tasks/${taskId}/checklist/${item.id}`, { is_done: !item.is_done });
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to update item'));
      setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, is_done: item.is_done } : i));
    }
  };

  const deleteChecklistItem = async (itemId) => {
    try {
      await api.delete(`/tasks/${taskId}/checklist/${itemId}`);
      setChecklist(prev => prev.filter(i => i.id !== itemId));
    } catch { toast.error(t('Failed to delete item')); }
  };

  // While the chat tab is open: pick up other people's messages every few seconds…
  useEffect(() => {
    if (tab !== 'qa') return undefined;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') pollComments(); }, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, [tab, taskId]);

  // …and tell the server I've read them, which clears the unread badges (private chats only).
  useEffect(() => {
    if (tab !== 'qa' || !task?.is_private || commentsLoading) return;
    const key = `${taskId}:${signature(comments)}`;
    if (key === lastMarked.current) return;
    lastMarked.current = key;
    api.post(`/tasks/${taskId}/read`).then(() => { refreshLive(); loadReaders(); }).catch(() => {});
    // eslint-disable-next-line
  }, [tab, task?.is_private, comments, commentsLoading, taskId]);

  // scroll to bottom when comments tab opened
  useEffect(() => {
    if (tab === 'qa') setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [tab, comments]);

  // ── Status (non-workflow) ─────────────────────────────────────────────────
  const changeStatus = async (status) => {
    setUpdatingStatus(true);
    try {
      const { data } = await api.put(`/tasks/${taskId}/status`, { status });
      setTask(t => ({ ...t, status: data.status }));
      toast.success(t('Status updated'));
      onStatusChanged?.();
    } catch { toast.error(t('Failed to update status')); }
    finally { setUpdatingStatus(false); }
  };

  // ── Close / reopen (private groups, Super Admin only) ────────────────────
  const closeGroup = async () => {
    if (!confirm(t('Close this group? Members will no longer be able to post, edit, or add anyone until it is reopened.'))) return;
    setClosing(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/close`);
      setTask(t => ({ ...t, closed_at: data.closed_at }));
      toast.success(t('Group closed'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to close group'));
    } finally { setClosing(false); }
  };

  const reopenGroup = async () => {
    setClosing(true);
    try {
      await api.post(`/tasks/${taskId}/reopen`);
      setTask(t => ({ ...t, closed_at: null }));
      toast.success(t('Group reopened'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to reopen group'));
    } finally { setClosing(false); }
  };

  // ── Workflow step ─────────────────────────────────────────────────────────
  const completeMyStep = async () => {
    setCompletingStep(true);
    try {
      const { data } = await api.put(`/tasks/${taskId}/workflow/complete-step`, { notes: completeNotes });
      toast.success(data.message);
      setShowCompleteForm(false);
      setCompleteNotes('');
      onStatusChanged?.();
      await loadTask();
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to complete step'));
    } finally { setCompletingStep(false); }
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/tasks/${taskId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { data } = await api.get(`/tasks/${taskId}`);
      setTask(data);
      toast.success(t('File uploaded'));
    } catch { toast.error(t('Upload failed')); }
    finally { setUploading(false); }
  };

  const deleteAttachment = async (attachId) => {
    if (!confirm(t('Delete this file?'))) return;
    try {
      await api.delete(`/attachments/${attachId}`);
      setTask(t => ({ ...t, attachments: t.attachments.filter(a => a.id !== attachId) }));
      toast.success(t('File deleted'));
    } catch { toast.error(t('Failed to delete')); }
  };

  // ── Comments / Q&A ────────────────────────────────────────────────────────
  const postComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/comments`, {
        content: newComment.trim(),
        is_question: isQuestion,
        mentioned_user_ids: extractMentionIds(newComment, taggableUsers),
      });
      setComments(prev => [data, ...prev]);
      setNewComment('');
      setIsQuestion(false);
      toast.success(isQuestion ? t('Question posted') : t('Comment added'));
    } catch (err) { toast.error(err.response?.data?.message || t('Failed to post')); }
    finally { setPosting(false); }
  };

  const postReply = async (parentId) => {
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/comments`, {
        content: replyText.trim(),
        parent_id: parentId,
        is_question: false,
        mentioned_user_ids: extractMentionIds(replyText, taggableUsers),
      });
      setComments(prev => prev.map(c =>
        c.id === parentId ? { ...c, replies: [...(c.replies || []), data] } : c
      ));
      setReplyTo(null);
      setReplyText('');
    } catch (err) { toast.error(err.response?.data?.message || t('Failed to reply')); }
    finally { setPosting(false); }
  };

  const resolveQuestion = async (commentId) => {
    try {
      await api.put(`/tasks/${taskId}/comments/${commentId}/resolve`);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_answered: true } : c));
      toast.success(t('Marked as answered'));
    } catch { toast.error(t('Failed to resolve')); }
  };

  // Toggle my reaction on a comment or a reply; the server returns that message's fresh summary.
  const reactToComment = async (commentId, emoji) => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/comments/${commentId}/reactions`, { emoji });
      const apply = (m) => (m.id === commentId ? { ...m, reaction_summary: data.reactions } : m);
      setComments(prev => prev.map(c => ({ ...apply(c), replies: (c.replies || []).map(apply) })));
    } catch (err) { toast.error(err.response?.data?.message || t('Failed to react')); }
  };

  const deleteComment = async (commentId) => {
    if (!confirm(t('Delete this comment?'))) return;
    try {
      await api.delete(`/tasks/${taskId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { toast.error(t('Failed to delete')); }
  };

  // ── Rename / leave / archive (private groups) ─────────────────────────────
  const canRename = !!task?.is_private && !locked &&
    (isSuperAdmin() || task.creator_id === user?.id || task.parent_group?.creator_id === user?.id);
  const isGroupRoot = !!task?.is_private && !task?.parent_group_id;
  const canArchive = isGroupRoot && (isSuperAdmin() || task.creator_id === user?.id);
  const canLeave = isGroupRoot && task.creator_id !== user?.id && task.assignees?.some(a => a.id === user?.id) && !locked;

  const startEdit = () => {
    setEditForm({ title: task.title, description: task.description || '' });
    setTab('details');
    setEditing(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await api.put(`/tasks/${taskId}`, { title: editForm.title.trim(), description: editForm.description });
      setTask(t => ({ ...t, title: editForm.title.trim(), description: editForm.description }));
      setEditing(false);
      toast.success(t('Saved'));
      onStatusChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to save'));
    } finally { setSavingEdit(false); }
  };

  const groupAction = async (path, confirmText, successText) => {
    if (confirmText && !confirm(confirmText)) return;
    setGroupBusy(true);
    try {
      await api.post(`/tasks/${taskId}/${path}`);
      toast.success(successText);
      onStatusChanged?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || t('Something went wrong'));
    } finally { setGroupBusy(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const myActiveStep  = task?.workflow_steps?.find(s => s.user_id === user?.id && s.status === 'active');
  const canChangeStatus = !task?.workflow_enabled && !locked &&
    (isAdminOrAbove() || isManager() || task?.assignees?.some(a => a.id === user?.id) || task?.creator_id === user?.id);
  const nextStatuses  = task ? ['pending', 'in_progress', 'completed'].filter(s => s !== task.status) : [];
  const fileIcon      = (t) => t?.includes('image') ? '🖼️' : t?.includes('pdf') ? '📄' : '📎';
  const unansweredQ   = comments.filter(c => c.is_question && !c.is_answered).length;
  // Who can be @tagged in a comment. Inside a group's sub-task this widens to
  // the *whole* group's membership (not just this sub-task's own narrower
  // assignees) — any task inside the group can tag any member of the group.
  const taggableUsers = task
    ? (
        task.parent_group_id && task.parent_group
          ? [task.parent_group.creator, ...(task.parent_group.assignees || [])]
          : [task.creator, ...(task.assignees || [])]
      ).filter((u, idx, arr) => u && u.id !== user?.id && arr.findIndex(x => x?.id === u.id) === idx)
    : [];
  const showTasksTab = task?.is_private && !task?.parent_group_id;

  const tabStyle = (t) => ({
    padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'none', cursor: 'pointer',
    color: tab === t ? 'var(--accent-ink)' : 'var(--text-secondary)',
  });

  return (
    <>
    <div className="modal show d-block" style={{ background: 'var(--scrim)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">

          {loading ? (
            <div className="modal-body text-center p-5" style={{ color: 'var(--text-secondary)' }}>{t('Loading task...')}</div>
          ) : task ? (
            <>
              {/* ── Header ── */}
              <div className="modal-header" style={{ paddingBottom: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
                  <div style={{ flex: 1, paddingInlineEnd: 12 }}>
                    <div className="d-flex gap-2 mb-2 flex-wrap">
                      <span className={`badge ${priorityBadge[task.priority]}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
                        {t('{priority} priority', { priority: t(task.priority) })}
                      </span>
                      <span className={`badge ${statusBadge[task.status]}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
                        {statusLabel[task.status]}
                      </span>
                      <DueBadge task={task} />
                      {task.is_private && (
                        <span style={{ fontSize: 12, background: 'var(--accent-light)', color: 'var(--accent-ink)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                          {t('🔒 Private Group')}
                        </span>
                      )}
                      {task.closed_at && (
                        <span style={{ fontSize: 12, background: 'var(--danger-light)', color: 'var(--danger)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                          {t('🚫 Closed')}
                        </span>
                      )}
                      {task.archived_at && (
                        <span style={{ fontSize: 12, background: 'var(--purple-light)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                          {t('📦 Archived')}
                        </span>
                      )}
                      {task.workflow_enabled && (
                        <span style={{ fontSize: 12, background: 'var(--accent-light)', color: 'var(--accent-ink)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                          {t('🔄 Workflow')}
                        </span>
                      )}
                      {task.recurrence && (
                        <span style={{ fontSize: 12, background: 'var(--accent-light)', color: 'var(--accent-ink)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                          {t('🔁 Repeats')} {t(task.recurrence)}
                        </span>
                      )}
                      {task.recurrence_parent_id && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 10px', background: 'var(--bg-primary)', borderRadius: 20, border: '1px solid var(--border-color)' }}>
                          {t('Auto-generated')}
                        </span>
                      )}
                      {task.department && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 10px', background: 'var(--bg-primary)', borderRadius: 20, border: '1px solid var(--border-color)' }}>
                          🏢 {task.department.name}
                        </span>
                      )}
                    </div>
                    {task.parent_group_id && task.parent_group && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {t('↳ Part of')} <strong>{task.parent_group.title}</strong>
                      </div>
                    )}
                    <h5 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {task.title}
                      {canRename && (
                        <button type="button" onClick={startEdit} title={t("Rename / edit description")}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', padding: 2 }}>
                          <Pencil size={14} />
                        </button>
                      )}
                    </h5>
                  </div>
                  <button className="btn-close" onClick={onClose} />
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', width: '100%' }}>
                  <button style={tabStyle('details')} onClick={() => setTab('details')}>{t('Details')}</button>
                  <button style={tabStyle('qa')} onClick={() => setTab('qa')}>
                    💬 Q&A
                    {unansweredQ > 0 && (
                      <span style={{ marginInlineStart: 6, background: 'var(--danger)', color: 'var(--on-danger)', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>
                        {unansweredQ}
                      </span>
                    )}
                  </button>
                  {showTasksTab && (
                    <button style={tabStyle('tasks')} onClick={() => setTab('tasks')}>
                      {t('📋 Tasks')}
                      {subtasks.length > 0 && (
                        <span style={{ marginInlineStart: 6, background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>
                          {subtasks.length}
                        </span>
                      )}
                    </button>
                  )}
                  {task.workflow_enabled && (
                    <button style={tabStyle('workflow')} onClick={() => setTab('workflow')}>
                      {t('🔄 Workflow')}
                      {myActiveStep && (
                        <span style={{ marginInlineStart: 6, background: 'var(--danger)', color: 'var(--on-danger)', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>
                          {t('Your Turn!')}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="modal-body">

                {lockedAt && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: isArchived ? 'var(--purple-light)' : 'var(--danger-light)', border: `1px solid ${isArchived ? 'color-mix(in srgb, var(--steel) 35%, transparent)' : 'color-mix(in srgb, var(--danger) 35%, transparent)'}`, borderRadius: 8, fontSize: 13, color: isArchived ? 'var(--text-secondary)' : 'var(--danger)', fontWeight: 500 }}>
                    {isArchived
                      ? t('📦 This group is archived — it is read-only until the creator restores it.')
                      : (isSuperAdmin() ? t('🚫 This group is closed — as Super Admin you can still act on it, but others cannot.') : t('🚫 This group is closed. No one can post, edit, or add members until it is reopened.'))}
                  </div>
                )}

                {/* ── DETAILS TAB ── */}
                {tab === 'details' && (
                  <>
                    {editing ? (
                      <form onSubmit={saveEdit} className="mb-4 p-3" style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                        <label className="form-label" style={{ fontSize: 12 }}>{t('Name')}</label>
                        <input className="form-control mb-2" value={editForm.title} maxLength={255} required autoFocus
                          onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                        <label className="form-label" style={{ fontSize: 12 }}>{t('Description')}</label>
                        <textarea className="form-control mb-3" rows={3} value={editForm.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                        <div className="d-flex gap-2">
                          <button className="btn-accent" type="submit" disabled={savingEdit || !editForm.title.trim()} style={{ fontSize: 13 }}>
                            {savingEdit ? t('Saving...') : t('Save changes')}
                          </button>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditing(false)}>{t('Cancel')}</button>
                        </div>
                      </form>
                    ) : task.description ? (
                      <div className="mb-4">
                        <SectionTitle>{t('Description')}</SectionTitle>
                        <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{task.description}</p>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>{t('No description.')}</p>
                    )}

                    <div className="row g-4">
                      <div className="col-md-6">
                        <SectionTitle>{t('Details')}</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <MetaRow icon="👤" label={t('Created by')} value={task.creator?.name} />
                          {task.due_date && (
                            <MetaRow icon="📅" label={t('Due date')}
                              value={formatDate(task.due_date, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-GB')} />
                          )}
                          <MetaRow icon="🕒" label={t('Created')} value={formatDate(task.created_at)} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <SectionTitle>{t('Assigned to')}</SectionTitle>
                        {task.assignees?.length ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {task.assignees.map(u => (
                              <div key={u.id} className="d-flex align-items-center gap-2">
                                <UserAvatar user={u} size={28} />
                                <span style={{ fontSize: 13, flex: 1 }}>{u.name}</span>
                                {u.id === user?.id && <YouBadge />}
                                {canManageAssignees && (
                                  <button
                                    onClick={() => removeAssignee(u.id)}
                                    disabled={assigneeBusy}
                                    title={t("Remove assignee")}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13, padding: '0 4px' }}
                                  >✕</button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('No one assigned')}</span>}

                        {canManageAssignees && (
                          <div className="d-flex gap-2 mt-2">
                            <select
                              className="form-select form-select-sm"
                              value={newAssigneeId}
                              onChange={e => setNewAssigneeId(e.target.value)}
                              style={{ fontSize: 12 }}
                            >
                              <option value="">{t('+ Add assignee...')}</option>
                              {candidateUsers
                                .filter(u => !task.assignees?.some(a => a.id === u.id))
                                .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={addAssignee}
                              disabled={!newAssigneeId || assigneeBusy}
                              style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                            >{t('Add')}</button>
                          </div>
                        )}

                        {/* Hidden for the group itself (its assignees already are its members) — shown for a sub-task inside one, or a normal task. */}
                        {(!task.is_private || task.parent_group_id) && (task.mentions?.length > 0 || canManageMentions) && (
                          <div className="mt-3">
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                              {task.parent_group_id ? t('Mentioned:') : t('Mentioned managers:')}
                            </div>
                            {task.mentions?.length > 0 ? (
                              <div className="d-flex flex-wrap gap-1 mb-2">
                                {task.mentions.map(u => (
                                  <span key={u.id} style={{ fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    @{u.name}
                                    {canManageMentions && (
                                      <button
                                        onClick={() => removeMention(u.id)}
                                        disabled={mentionBusy}
                                        title={t("Remove mention")}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 12, padding: 0, lineHeight: 1 }}
                                      >✕</button>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('No one mentioned')}</span>
                            )}

                            {canManageMentions && (
                              <div className="d-flex gap-2 mt-1">
                                <select
                                  className="form-select form-select-sm"
                                  value={newMentionId}
                                  onChange={e => setNewMentionId(e.target.value)}
                                  style={{ fontSize: 12 }}
                                >
                                  <option value="">{task.parent_group_id ? t('+ Mention a group member...') : t('+ Mention a manager...')}</option>
                                  {candidateManagers
                                    .filter(u => !task.mentions?.some(m => m.id === u.id))
                                    .map(u => (
                                      <option key={u.id} value={u.id}>
                                        {u.name}{u.department?.name ? ` (${u.department.name})` : ''}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={addMention}
                                  disabled={!newMentionId || mentionBusy}
                                  style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                                >{t('Add')}</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Change status */}
                    {canChangeStatus && nextStatuses.length > 0 && (
                      <div className="mt-4 p-3" style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t('Move task to:')}</div>
                        <div className="d-flex gap-2 flex-wrap">
                          {nextStatuses.map(s => (
                            <button key={s} onClick={() => changeStatus(s)} disabled={updatingStatus}
                              className={`badge ${statusBadge[s]}`}
                              style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                              {updatingStatus ? '...' : `→ ${statusLabel[s]}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Checklist */}
                    {(checklist.length > 0 || canEditChecklist) && (
                      <div className="mt-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <SectionTitle>
                            {t('Checklist')} {checklist.length > 0 && `(${checklist.filter(i => i.is_done).length}/${checklist.length})`}
                          </SectionTitle>
                        </div>
                        {checklist.length > 0 && (
                          <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-primary)', overflow: 'hidden', marginBottom: 12 }}>
                            <div style={{
                              height: '100%',
                              width: `${(checklist.filter(i => i.is_done).length / checklist.length) * 100}%`,
                              background: 'var(--accent-gradient)',
                              transition: 'width 0.2s',
                            }} />
                          </div>
                        )}
                        {checklistLoading ? (
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('Loading...')}</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: canEditChecklist ? 10 : 0 }}>
                            {checklist.map(item => (
                              <div key={item.id} className="d-flex align-items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={item.is_done}
                                  disabled={!canToggleChecklist}
                                  onChange={() => toggleChecklistItem(item)}
                                  style={{ flexShrink: 0, margin: 0 }}
                                />
                                <span style={{
                                  fontSize: 13.5, flex: 1,
                                  color: item.is_done ? 'var(--text-secondary)' : 'var(--text-primary)',
                                  textDecoration: item.is_done ? 'line-through' : 'none',
                                }}>
                                  {item.title}
                                </span>
                                {canEditChecklist && (
                                  <button
                                    onClick={() => deleteChecklistItem(item.id)}
                                    title={t("Remove item")}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13, padding: '0 4px' }}
                                  >✕</button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {canEditChecklist && (
                          <div className="d-flex gap-2">
                            <input
                              className="form-control form-control-sm"
                              placeholder={t("Add a checklist item...")}
                              value={newChecklistTitle}
                              onChange={e => setNewChecklistTitle(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                              style={{ fontSize: 13 }}
                            />
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={addChecklistItem}
                              disabled={!newChecklistTitle.trim() || checklistBusy}
                              style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                            >{t('Add')}</button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attachments */}
                    <div className="mt-4">
                      <SectionTitle>{t('Attachments (')}{task.attachments?.length || 0})</SectionTitle>
                      {task.attachments?.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                          {task.attachments.map(att => (
                            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: 20 }}>{fileIcon(att.file_type)}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <button type="button" onClick={() => openAttachment(att)}
                                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent-ink)', wordBreak: 'break-all', background: 'none', border: 'none', padding: 0, textAlign: 'start', cursor: 'pointer' }}>
                                  {att.file_name}
                                </button>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {t('by')} {att.user?.name} · {(att.file_size / 1024).toFixed(0)} {t('KB')}
                                </div>
                              </div>
                              {(isAdminOrAbove() || att.user?.id === user?.id) && (
                                <button onClick={() => deleteAttachment(att.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16 }}>🗑️</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {!locked && (
                        <label style={{ cursor: 'pointer' }}>
                          <input type="file" style={{ display: 'none' }} onChange={uploadFile} disabled={uploading}
                            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
                            color: uploading ? 'var(--text-secondary)' : 'var(--accent-ink)',
                            border: '1px dashed var(--border-color)', borderRadius: 8, padding: '8px 14px',
                            cursor: uploading ? 'not-allowed' : 'pointer' }}>
                            📎 {uploading ? t('Uploading...') : t('Add Attachment')}
                          </span>
                        </label>
                      )}
                    </div>
                  </>
                )}

                {/* ── Q&A TAB ── */}
                {tab === 'qa' && (
                  <div>
                    {/* Post new */}
                    <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <button
                          onClick={() => setIsQuestion(false)}
                          style={{ fontSize: 13, padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border-color)',
                            background: !isQuestion ? 'var(--accent)' : 'transparent',
                            color: !isQuestion ? 'var(--on-accent)' : 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                          {t('💬 Comment')}
                        </button>
                        <button
                          onClick={() => setIsQuestion(true)}
                          style={{ fontSize: 13, padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border-color)',
                            background: isQuestion ? 'var(--warning)' : 'transparent',
                            color: isQuestion ? 'var(--on-warning)' : 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                          {t('❓ Ask a Question')}
                        </button>
                      </div>
                      <MentionTextarea
                        rows={3}
                        placeholder={isQuestion ? t('Ask something about this task… (type @ to tag someone)') : t('Leave a comment… (type @ to tag someone)')}
                        value={newComment}
                        onChange={setNewComment}
                        users={taggableUsers}
                        style={{ marginBottom: 10 }}
                      />
                      <button className="btn-accent" onClick={postComment} disabled={posting || !newComment.trim() || locked} style={{ fontSize: 13 }}>
                        {posting ? t('Posting...') : isQuestion ? t('❓ Post Question') : t('💬 Post Comment')}
                      </button>
                    </div>

                    {/* Comments list */}
                    {commentsLoading && (
                      <div className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>{t('Loading...')}</div>
                    )}

                    {!commentsLoading && comments.length === 0 && (
                      <div className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
                        <p style={{ fontSize: 13 }}>{t('No comments yet. Be the first!')}</p>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {comments.map(comment => (
                        <CommentCard
                          key={comment.id}
                          comment={comment}
                          taskId={taskId}
                          currentUser={user}
                          isAdmin={isAdminOrAbove()}
                          isCreator={task.creator_id === user?.id}
                          taggableUsers={taggableUsers}
                          canReact={!locked || isSuperAdmin()}
                          onReact={reactToComment}
                          readers={task.is_private ? readers : []}
                          replyTo={replyTo}
                          replyText={replyText}
                          posting={posting}
                          onSetReply={(r) => { setReplyTo(r); setReplyText(''); }}
                          onReplyTextChange={setReplyText}
                          onPostReply={postReply}
                          onResolve={resolveQuestion}
                          onDelete={deleteComment}
                        />
                      ))}
                    </div>
                    <div ref={commentsEndRef} />
                  </div>
                )}

                {/* ── TASKS TAB (inside a group) ── */}
                {tab === 'tasks' && showTasksTab && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {t("Every group member can see these tasks; only its own creator (or the group's creator) can edit one.")}
                      </div>
                      {!locked && (
                        <button className="btn btn-sm btn-accent" onClick={() => setShowSubtaskModal(true)} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {t('+ New Task')}
                        </button>
                      )}
                    </div>

                    {subtasksLoading ? (
                      <div className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>{t('Loading...')}</div>
                    ) : subtasks.length === 0 ? (
                      <div className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                        <p style={{ fontSize: 13 }}>{t('No tasks yet. Create one for a specific member (or a few) to work on.')}</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {subtasks.map(st => (
                          <div key={st.id} onClick={() => setOpenSubtaskId(st.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer' }}>
                            <span className={`badge ${statusBadge[st.status]}`} style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, flexShrink: 0 }}>
                              {statusLabel[st.status]}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{st.title}</span>
                            <DueBadge task={st} size="sm" />
                            {tasks_unread[st.id] > 0 && <span className="unread-pill" title={t("Unread messages")}>{tasks_unread[st.id]}</span>}
                            <div className="d-flex gap-1">
                              {st.assignees?.slice(0, 3).map(u => <UserAvatar key={u.id} user={u} size={22} />)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── WORKFLOW TAB ── */}
                {tab === 'workflow' && task.workflow_steps && (
                  <WorkflowPanel
                    steps={task.workflow_steps}
                    myActiveStep={myActiveStep}
                    completeNotes={completeNotes}
                    setCompleteNotes={setCompleteNotes}
                    showCompleteForm={showCompleteForm}
                    setShowCompleteForm={setShowCompleteForm}
                    onComplete={completeMyStep}
                    completing={completingStep}
                    taskCompleted={task.status === 'completed'}
                  />
                )}
              </div>

              <div className="modal-footer">
                {canLeave && (
                  <button className="btn btn-outline-secondary" disabled={groupBusy} style={{ fontSize: 13, marginInlineEnd: 'auto' }}
                    onClick={() => groupAction('leave', 'Leave this group? You will lose access to it and everything inside, until someone adds you again.', 'You left the group')}>
                    {t('🚪 Leave group')}
                  </button>
                )}
                {canArchive && (
                  task.archived_at ? (
                    <button className="btn btn-outline-primary" disabled={groupBusy} style={{ fontSize: 13 }}
                      onClick={() => groupAction('unarchive', null, 'Group restored')}>
                      {t('♻️ Restore group')}
                    </button>
                  ) : (
                    <button className="btn btn-outline-secondary" disabled={groupBusy} style={{ fontSize: 13 }}
                      onClick={() => groupAction('archive', 'Archive this group? It becomes read-only and moves to the Archived tab. You can restore it any time.', 'Group archived')}>
                      {t('📦 Archive')}
                    </button>
                  )
                )}
                {showTasksTab && isSuperAdmin() && (
                  task.closed_at ? (
                    <button className="btn btn-outline-success" onClick={reopenGroup} disabled={closing} style={{ fontSize: 13 }}>
                      {closing ? '...' : t('▶ Reopen Group')}
                    </button>
                  ) : (
                    <button className="btn btn-outline-danger" onClick={closeGroup} disabled={closing} style={{ fontSize: 13 }}>
                      {closing ? '...' : t('🚫 Close Group')}
                    </button>
                  )
                )}
                <button className="btn btn-secondary" onClick={onClose}>{t('Close')}</button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>

    {showSubtaskModal && (
      <GroupSubtaskModal
        groupId={taskId}
        groupMembers={task?.assignees || []}
        mentionCandidates={
          task
            ? [task.creator, ...(task.assignees || [])]
                .filter((u, idx, arr) => u && arr.findIndex(x => x?.id === u.id) === idx)
            : []
        }
        onClose={() => setShowSubtaskModal(false)}
        onSaved={loadSubtasks}
      />
    )}

    {openSubtaskId && (
      <TaskDetailModal
        taskId={openSubtaskId}
        onClose={() => setOpenSubtaskId(null)}
        onStatusChanged={loadSubtasks}
      />
    )}
    </>
  );
}

/* ── Comment Card ──────────────────────────────────────────────────────────── */

function CommentCard({ comment, taskId, currentUser, isAdmin, isCreator, taggableUsers, canReact, onReact, readers, replyTo, replyText, posting, onSetReply, onReplyTextChange, onPostReply, onResolve, onDelete }) {
  const canResolve  = (isAdmin || isCreator) && comment.is_question && !comment.is_answered;
  const canDelete   = isAdmin || comment.user_id === currentUser?.id;
  const isMyReplyOpen = replyTo?.id === comment.id;

  return (
    <div style={{ background: comment.is_question ? 'var(--warning-light)' : 'var(--bg-primary)', border: `1px solid ${comment.is_question ? (comment.is_answered ? 'color-mix(in srgb, var(--accent-ink) 35%, transparent)' : 'color-mix(in srgb, var(--warning) 35%, transparent)') : 'var(--border-color)'}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Comment header */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <UserAvatar user={comment.user} size={32} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{comment.user?.name}</span>
              {comment.is_question && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: comment.is_answered ? 'var(--accent-light)' : 'var(--warning-light)', color: comment.is_answered ? 'var(--accent-ink)' : 'var(--warning)', fontWeight: 600 }}>
                  {comment.is_answered ? t('✅ Answered') : t('❓ Question')}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {formatDateTime(comment.created_at)}
              </span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
              <MessageText text={comment.content} tagged={comment.mentioned_users} />
            </p>
            <ReactionBar reactions={comment.reaction_summary} disabled={!canReact} onToggle={(emoji) => onReact(comment.id, emoji)} />
            <SeenBy message={comment} readers={readers} authorId={comment.user_id} />
          </div>
        </div>

        {/* Actions */}
        <div className="d-flex gap-2 mt-2" style={{ paddingInlineStart: 42 }}>
          <button onClick={() => onSetReply(isMyReplyOpen ? null : { id: comment.id, user: comment.user })}
            style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-ink)' }}>
            {t('↩ Reply')}
          </button>
          {canResolve && (
            <button onClick={() => onResolve(comment.id)}
              style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)' }}>
              {t('✅ Mark Answered')}
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(comment.id)}
              style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
              {t('🗑️ Delete')}
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          {comment.replies.map(reply => (
            <div key={reply.id} style={{ padding: '10px 14px 10px 52px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 10 }}>
              <UserAvatar user={reply.user} size={26} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{reply.user?.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatDateTime(reply.created_at)}</span>
                </div>
                <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  <MessageText text={reply.content} tagged={reply.mentioned_users} />
                </p>
                <ReactionBar reactions={reply.reaction_summary} disabled={!canReact} onToggle={(emoji) => onReact(reply.id, emoji)} />
                <SeenBy message={reply} readers={readers} authorId={reply.user_id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {isMyReplyOpen && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {t('Replying to')} <strong>{replyTo.user?.name}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <MentionTextarea
                rows={2}
                placeholder={t("Write your reply… (type @ to tag someone)")}
                value={replyText}
                onChange={onReplyTextChange}
                users={taggableUsers}
                style={{ fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn-accent" onClick={() => onPostReply(comment.id)} disabled={posting || !replyText.trim()} style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}>
                {posting ? '...' : t('Reply')}
              </button>
              <button onClick={() => onSetReply(null)} style={{ fontSize: 12, background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {t('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Workflow Panel ──────────────────────────────────────────────────────────  */

function WorkflowPanel({ steps, myActiveStep, completeNotes, setCompleteNotes, showCompleteForm, setShowCompleteForm, onComplete, completing, taskCompleted }) {
  const stepColors = { waiting: 'var(--text-muted)', active: 'var(--accent-ink)', completed: 'var(--accent-ink)' };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t('Sequential Workflow')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('Task moves step by step through the chain.')}</div>
      </div>

      <div>
        {steps.map((step, idx) => (
          <div key={step.id} style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                background: step.status === 'completed' ? 'var(--accent)' : 'var(--bg-secondary)',
                border: `2px solid ${stepColors[step.status]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: step.status === 'completed' ? 'var(--on-accent)' : stepColors[step.status],
                fontWeight: 700, fontSize: 14,
              }}>
                {step.status === 'completed' ? '✓' : step.step_order}
              </div>
              {idx < steps.length - 1 && (
                <div style={{ width: 2, flex: 1, minHeight: 24, background: step.status === 'completed' ? 'var(--accent)' : 'var(--border-color)' }} />
              )}
            </div>

            <div style={{ flex: 1, marginInlineStart: 14, paddingBottom: idx < steps.length - 1 ? 20 : 0 }}>
              <div style={{ background: step.status === 'active' ? 'var(--accent-light)' : 'var(--bg-primary)', border: `1px solid ${step.status === 'active' ? 'var(--accent-ink)' : 'var(--border-color)'}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <UserAvatar user={step.user} size={28} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{step.user?.name}</span>
                    <span style={{ marginInlineStart: 8, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `color-mix(in srgb, ${stepColors[step.status]} 15%, transparent)`, color: stepColors[step.status], fontWeight: 600 }}>
                      {step.status === 'waiting' ? t('⏳ Waiting') : step.status === 'active' ? t('🔵 Active') : t('✅ Done')}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('Step')} {step.step_order}</span>
                </div>
                {step.status === 'completed' && step.notes && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontStyle: 'italic', fontSize: 12 }}>
                    💬 "{step.notes}"
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {taskCompleted && (
        <div style={{ marginTop: 20, padding: '14px 18px', background: 'var(--accent-light)', borderRadius: 10, border: '1px solid var(--accent-ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>{t('All steps completed!')}</div>
            <div style={{ fontSize: 12, color: 'var(--accent-ink)' }}>{t('This task has been fully completed.')}</div>
          </div>
        </div>
      )}

      {myActiveStep && !taskCompleted && (
        <div style={{ marginTop: 24, padding: '18px', background: 'var(--accent-light)', borderRadius: 12, border: '2px solid var(--accent-ink)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent-ink)', marginBottom: 4 }}>{t("🔵 It's your turn!")}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>{t('You are on Step')} {myActiveStep.step_order}.</div>
          {!showCompleteForm ? (
            <button onClick={() => setShowCompleteForm(true)} className="btn-accent" style={{ fontSize: 14 }}>
              {t('✓ Mark My Step as Done')}
            </button>
          ) : (
            <div>
              <label className="form-label">{t('Note for the next person (optional):')}</label>
              <textarea className="form-control mb-3" rows={3} value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} />
              <div className="d-flex gap-2">
                <button onClick={onComplete} disabled={completing} className="btn-accent">
                  {completing ? t('Completing...') : t('✓ Complete & Pass On')}
                </button>
                <button onClick={() => setShowCompleteForm(false)} className="btn btn-secondary" disabled={completing}>{t('Cancel')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Message text with highlighted @tags + "seen by" ─────────────────────────── */

function MessageText({ text, tagged }) {
  return splitMentions(text, tagged).map((part, i) =>
    part.mention ? <span key={i} className="mention-chip">{part.text}</span> : <span key={i}>{part.text}</span>
  );
}

/** Small avatars of members who have read up to (at least) this message — shown under your own messages. */
function SeenBy({ message, readers, authorId }) {
  const { user } = useAuth();
  if (!readers?.length || authorId !== user?.id) return null;

  const seen = readers.filter(r => r.id !== user.id && r.last_read_comment_id >= message.id);
  if (seen.length === 0) return null;

  return (
    <div className="seen-by" title={`Seen by ${seen.map(r => r.name).join(', ')}`} style={{ marginTop: 4 }}>
      👁
      {seen.slice(0, 5).map(r => <UserAvatar key={r.id} user={r} size={16} />)}
      {seen.length > 5 && <span>+{seen.length - 5}</span>}
      <span>{t('Seen by')} {seen.length === 1 ? seen[0].name : `${seen.length} people`}</span>
    </div>
  );
}

/* ── Shared micro-components ────────────────────────────────────────────────── */

function UserAvatar({ user, size = 32 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, flexShrink: 0 }}>
      {user?.avatar
        ? <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        : user?.name?.slice(0, 2).toUpperCase() || '?'}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function MetaRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 70 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function YouBadge() {
  return <span style={{ fontSize: 11, background: 'var(--accent-light)', color: 'var(--accent-ink)', padding: '1px 7px', borderRadius: 20 }}>{t('You')}</span>;
}
