import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const priorityBadge = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high' };
const statusBadge   = { pending: 'badge-pending', in_progress: 'badge-in_progress', completed: 'badge-completed' };
const statusLabel   = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' };

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
  const { user, isAdmin, isManager }  = useAuth();

  const loadTask = () =>
    api.get(`/tasks/${taskId}`)
      .then(r => setTask(r.data))
      .catch(() => { toast.error('Failed to load task'); onClose(); })
      .finally(() => setLoading(false));

  const loadComments = () => {
    setCommentsLoading(true);
    api.get(`/tasks/${taskId}/comments`)
      .then(r => setComments(r.data))
      .finally(() => setCommentsLoading(false));
  };

  useEffect(() => {
    loadTask();
    loadComments();
  }, [taskId]);

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
      toast.success('Status updated');
      onStatusChanged?.();
    } catch { toast.error('Failed to update status'); }
    finally { setUpdatingStatus(false); }
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
      toast.error(err.response?.data?.message || 'Failed to complete step');
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
      toast.success('File uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const deleteAttachment = async (attachId) => {
    if (!confirm('Delete this file?')) return;
    try {
      await api.delete(`/attachments/${attachId}`);
      setTask(t => ({ ...t, attachments: t.attachments.filter(a => a.id !== attachId) }));
      toast.success('File deleted');
    } catch { toast.error('Failed to delete'); }
  };

  // ── Comments / Q&A ────────────────────────────────────────────────────────
  const postComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/comments`, {
        content: newComment.trim(),
        is_question: isQuestion,
      });
      setComments(prev => [data, ...prev]);
      setNewComment('');
      setIsQuestion(false);
      toast.success(isQuestion ? 'Question posted' : 'Comment added');
    } catch { toast.error('Failed to post'); }
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
      });
      setComments(prev => prev.map(c =>
        c.id === parentId ? { ...c, replies: [...(c.replies || []), data] } : c
      ));
      setReplyTo(null);
      setReplyText('');
    } catch { toast.error('Failed to reply'); }
    finally { setPosting(false); }
  };

  const resolveQuestion = async (commentId) => {
    try {
      await api.put(`/tasks/${taskId}/comments/${commentId}/resolve`);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_answered: true } : c));
      toast.success('Marked as answered');
    } catch { toast.error('Failed to resolve'); }
  };

  const deleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.delete(`/tasks/${taskId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { toast.error('Failed to delete'); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const myActiveStep  = task?.workflowSteps?.find(s => s.user_id === user?.id && s.status === 'active');
  const canChangeStatus = !task?.workflow_enabled &&
    (isAdmin() || isManager() || task?.assignees?.some(a => a.id === user?.id) || task?.creator_id === user?.id);
  const nextStatuses  = task ? ['pending', 'in_progress', 'completed'].filter(s => s !== task.status) : [];
  const fileIcon      = (t) => t?.includes('image') ? '🖼️' : t?.includes('pdf') ? '📄' : '📎';
  const unansweredQ   = comments.filter(c => c.is_question && !c.is_answered).length;

  const tabStyle = (t) => ({
    padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'none', cursor: 'pointer',
    color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
  });

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">

          {loading ? (
            <div className="modal-body text-center p-5" style={{ color: 'var(--text-secondary)' }}>Loading task...</div>
          ) : task ? (
            <>
              {/* ── Header ── */}
              <div className="modal-header" style={{ paddingBottom: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
                  <div style={{ flex: 1, paddingRight: 12 }}>
                    <div className="d-flex gap-2 mb-2 flex-wrap">
                      <span className={`badge ${priorityBadge[task.priority]}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
                        {task.priority} priority
                      </span>
                      <span className={`badge ${statusBadge[task.status]}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
                        {statusLabel[task.status]}
                      </span>
                      {task.workflow_enabled && (
                        <span style={{ fontSize: 12, background: '#6366f120', color: '#6366f1', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                          🔄 Workflow
                        </span>
                      )}
                      {task.department && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 10px', background: 'var(--bg-primary)', borderRadius: 20, border: '1px solid var(--border-color)' }}>
                          🏢 {task.department.name}
                        </span>
                      )}
                    </div>
                    <h5 style={{ fontWeight: 700, margin: 0 }}>{task.title}</h5>
                  </div>
                  <button className="btn-close" onClick={onClose} />
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', width: '100%' }}>
                  <button style={tabStyle('details')} onClick={() => setTab('details')}>Details</button>
                  <button style={tabStyle('qa')} onClick={() => setTab('qa')}>
                    💬 Q&A
                    {unansweredQ > 0 && (
                      <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>
                        {unansweredQ}
                      </span>
                    )}
                  </button>
                  {task.workflow_enabled && (
                    <button style={tabStyle('workflow')} onClick={() => setTab('workflow')}>
                      🔄 Workflow
                      {myActiveStep && (
                        <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>
                          Your Turn!
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="modal-body">

                {/* ── DETAILS TAB ── */}
                {tab === 'details' && (
                  <>
                    {task.description ? (
                      <div className="mb-4">
                        <SectionTitle>Description</SectionTitle>
                        <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{task.description}</p>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>No description.</p>
                    )}

                    <div className="row g-4">
                      <div className="col-md-6">
                        <SectionTitle>Details</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <MetaRow icon="👤" label="Created by" value={task.creator?.name} />
                          {task.due_date && (
                            <MetaRow icon="📅" label="Due date"
                              value={new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
                          )}
                          <MetaRow icon="🕒" label="Created" value={new Date(task.created_at).toLocaleDateString()} />
                        </div>
                      </div>

                      <div className="col-md-6">
                        <SectionTitle>Assigned to</SectionTitle>
                        {task.assignees?.length ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {task.assignees.map(u => (
                              <div key={u.id} className="d-flex align-items-center gap-2">
                                <UserAvatar user={u} size={28} />
                                <span style={{ fontSize: 13 }}>{u.name}</span>
                                {u.id === user?.id && <YouBadge />}
                              </div>
                            ))}
                          </div>
                        ) : <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No one assigned</span>}

                        {task.mentions?.length > 0 && (
                          <div className="mt-3">
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Mentioned:</div>
                            <div className="d-flex flex-wrap gap-1">
                              {task.mentions.map(u => (
                                <span key={u.id} style={{ fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: 20 }}>
                                  @{u.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Change status */}
                    {canChangeStatus && nextStatuses.length > 0 && (
                      <div className="mt-4 p-3" style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Move task to:</div>
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

                    {/* Attachments */}
                    <div className="mt-4">
                      <SectionTitle>Attachments ({task.attachments?.length || 0})</SectionTitle>
                      {task.attachments?.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                          {task.attachments.map(att => (
                            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: 20 }}>{fileIcon(att.file_type)}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <a href={att.url} target="_blank" rel="noreferrer"
                                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)', wordBreak: 'break-all' }}>
                                  {att.file_name}
                                </a>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  by {att.user?.name} · {(att.file_size / 1024).toFixed(0)} KB
                                </div>
                              </div>
                              {(isAdmin() || att.user?.id === user?.id) && (
                                <button onClick={() => deleteAttachment(att.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }}>🗑️</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <label style={{ cursor: 'pointer' }}>
                        <input type="file" style={{ display: 'none' }} onChange={uploadFile} disabled={uploading}
                          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
                          color: uploading ? 'var(--text-secondary)' : 'var(--accent)',
                          border: '1px dashed var(--border-color)', borderRadius: 8, padding: '8px 14px',
                          cursor: uploading ? 'not-allowed' : 'pointer' }}>
                          📎 {uploading ? 'Uploading...' : 'Add Attachment'}
                        </span>
                      </label>
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
                            color: !isQuestion ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                          💬 Comment
                        </button>
                        <button
                          onClick={() => setIsQuestion(true)}
                          style={{ fontSize: 13, padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border-color)',
                            background: isQuestion ? '#f59e0b' : 'transparent',
                            color: isQuestion ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                          ❓ Ask a Question
                        </button>
                      </div>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder={isQuestion ? 'Ask something about this task...' : 'Leave a comment...'}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        style={{ marginBottom: 10 }}
                      />
                      <button className="btn-accent" onClick={postComment} disabled={posting || !newComment.trim()} style={{ fontSize: 13 }}>
                        {posting ? 'Posting...' : isQuestion ? '❓ Post Question' : '💬 Post Comment'}
                      </button>
                    </div>

                    {/* Comments list */}
                    {commentsLoading && (
                      <div className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
                    )}

                    {!commentsLoading && comments.length === 0 && (
                      <div className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
                        <p style={{ fontSize: 13 }}>No comments yet. Be the first!</p>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {comments.map(comment => (
                        <CommentCard
                          key={comment.id}
                          comment={comment}
                          taskId={taskId}
                          currentUser={user}
                          isAdmin={isAdmin()}
                          isCreator={task.creator_id === user?.id}
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

                {/* ── WORKFLOW TAB ── */}
                {tab === 'workflow' && task.workflowSteps && (
                  <WorkflowPanel
                    steps={task.workflowSteps}
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
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Comment Card ──────────────────────────────────────────────────────────── */

function CommentCard({ comment, taskId, currentUser, isAdmin, isCreator, replyTo, replyText, posting, onSetReply, onReplyTextChange, onPostReply, onResolve, onDelete }) {
  const canResolve  = (isAdmin || isCreator) && comment.is_question && !comment.is_answered;
  const canDelete   = isAdmin || comment.user_id === currentUser?.id;
  const isMyReplyOpen = replyTo?.id === comment.id;

  return (
    <div style={{ background: comment.is_question ? '#fef3c710' : 'var(--bg-primary)', border: `1px solid ${comment.is_question ? (comment.is_answered ? '#10b98130' : '#f59e0b40') : 'var(--border-color)'}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Comment header */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <UserAvatar user={comment.user} size={32} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{comment.user?.name}</span>
              {comment.is_question && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: comment.is_answered ? '#d1fae5' : '#fef3c7', color: comment.is_answered ? '#059669' : '#d97706', fontWeight: 600 }}>
                  {comment.is_answered ? '✅ Answered' : '❓ Question'}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {new Date(comment.created_at).toLocaleString()}
              </span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{comment.content}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="d-flex gap-2 mt-2" style={{ paddingLeft: 42 }}>
          <button onClick={() => onSetReply(isMyReplyOpen ? null : { id: comment.id, user: comment.user })}
            style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}>
            ↩ Reply
          </button>
          {canResolve && (
            <button onClick={() => onResolve(comment.id)}
              style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }}>
              ✅ Mark Answered
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(comment.id)}
              style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
              🗑️ Delete
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
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(reply.created_at).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {isMyReplyOpen && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Replying to <strong>{replyTo.user?.name}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Write your reply..."
              value={replyText}
              onChange={e => onReplyTextChange(e.target.value)}
              style={{ fontSize: 13 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn-accent" onClick={() => onPostReply(comment.id)} disabled={posting || !replyText.trim()} style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}>
                {posting ? '...' : 'Reply'}
              </button>
              <button onClick={() => onSetReply(null)} style={{ fontSize: 12, background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Cancel
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
  const stepColors = { waiting: '#94a3b8', active: '#6366f1', completed: '#10b981' };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Sequential Workflow</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Task moves step by step through the chain.</div>
      </div>

      <div>
        {steps.map((step, idx) => (
          <div key={step.id} style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                background: step.status === 'completed' ? '#10b981' : step.status === 'active' ? '#6366f1' : 'var(--bg-secondary)',
                border: `2px solid ${stepColors[step.status]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: step.status === 'waiting' ? stepColors.waiting : '#fff',
                fontWeight: 700, fontSize: 14,
              }}>
                {step.status === 'completed' ? '✓' : step.step_order}
              </div>
              {idx < steps.length - 1 && (
                <div style={{ width: 2, flex: 1, minHeight: 24, background: step.status === 'completed' ? '#10b981' : 'var(--border-color)' }} />
              )}
            </div>

            <div style={{ flex: 1, marginLeft: 14, paddingBottom: idx < steps.length - 1 ? 20 : 0 }}>
              <div style={{ background: step.status === 'active' ? '#6366f110' : 'var(--bg-primary)', border: `1px solid ${step.status === 'active' ? '#6366f1' : 'var(--border-color)'}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <UserAvatar user={step.user} size={28} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{step.user?.name}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: stepColors[step.status] + '20', color: stepColors[step.status], fontWeight: 600 }}>
                      {step.status === 'waiting' ? '⏳ Waiting' : step.status === 'active' ? '🔵 Active' : '✅ Done'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Step {step.step_order}</span>
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
        <div style={{ marginTop: 20, padding: '14px 18px', background: '#d1fae5', borderRadius: 10, border: '1px solid #10b981', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, color: '#059669' }}>All steps completed!</div>
            <div style={{ fontSize: 12, color: '#047857' }}>This task has been fully completed.</div>
          </div>
        </div>
      )}

      {myActiveStep && !taskCompleted && (
        <div style={{ marginTop: 24, padding: '18px', background: '#6366f110', borderRadius: 12, border: '2px solid #6366f1' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#6366f1', marginBottom: 4 }}>🔵 It's your turn!</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>You are on Step {myActiveStep.step_order}.</div>
          {!showCompleteForm ? (
            <button onClick={() => setShowCompleteForm(true)} className="btn-accent" style={{ fontSize: 14 }}>
              ✓ Mark My Step as Done
            </button>
          ) : (
            <div>
              <label className="form-label">Note for the next person (optional):</label>
              <textarea className="form-control mb-3" rows={3} value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} />
              <div className="d-flex gap-2">
                <button onClick={onComplete} disabled={completing} className="btn-accent">
                  {completing ? 'Completing...' : '✓ Complete & Pass On'}
                </button>
                <button onClick={() => setShowCompleteForm(false)} className="btn btn-secondary" disabled={completing}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
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
  return <span style={{ fontSize: 11, background: 'var(--accent)20', color: 'var(--accent)', padding: '1px 7px', borderRadius: 20 }}>You</span>;
}
