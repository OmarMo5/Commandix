import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Plus, Send, Search, ArrowLeft, Trash2, CheckCheck, MessageSquare } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../context/LiveContext';
import Avatar from '../../components/common/Avatar';
import { t, locale, formatDate } from '../../i18n';

const POLL_MS = 4000;
const changed = () => window.dispatchEvent(new Event('dm:changed'));   // tells the sidebar to refetch its list

const timeOf = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const dayLabel = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(iso) === dayKey(now.toISOString())) return t('Today');
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return t('Yesterday');
  return formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** The latest page replaces the tail; older pages the user already loaded are kept. */
const mergeLatest = (prev, latest, hasMore) => {
  if (!hasMore || latest.length === 0) return latest;
  return [...prev.filter((m) => m.id < latest[0].id), ...latest];
};

export default function MessagesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { dm_unread: dmUnread } = useLive();
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  // The sidebar's "New message" arrives as /messages?new=1 — that alone opens the people picker.
  const picker = pickerOpen || params.has('new');
  const closePicker = () => { setPickerOpen(false); if (params.has('new')) setParams({}, { replace: true }); };

  const loadList = useCallback(() => {
    api.get('/dm').then((r) => setConversations(r.data)).catch(() => {}).finally(() => setLoadingList(false));
  }, []);

  const unreadSignature = JSON.stringify(dmUnread || {});
  useEffect(() => { loadList(); }, [loadList, unreadSignature]);
  useEffect(() => {
    window.addEventListener('dm:changed', loadList);
    return () => window.removeEventListener('dm:changed', loadList);
  }, [loadList]);

  const open = (conversationId) => navigate(`/messages/${conversationId}`);

  return (
    <div className={`dm-layout ${id ? 'has-thread' : ''}`}>
      <aside className="dm-list">
        <div className="dm-list-header">
          <h1 className="dm-list-title">{t('Messages')}</h1>
          <button type="button" className="btn-accent btn-sm" onClick={() => setPickerOpen(true)}>
            <Plus size={14} /> {t('New message')}
          </button>
        </div>

        <div className="dm-list-body">
          {loadingList && <div className="dm-empty">{t('Loading...')}</div>}
          {!loadingList && conversations.length === 0 && (
            <div className="dm-empty">
              <MessageSquare size={28} strokeWidth={1.5} />
              <div>{t('No conversations yet')}</div>
              <div className="dm-empty-sub">{t('Start a conversation with someone from your team.')}</div>
            </div>
          )}
          {conversations.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`dm-item ${String(c.id) === id ? 'active' : ''}`}
              onClick={() => open(c.id)}
            >
              <Avatar user={c.user} size={38} />
              <span className="dm-item-text">
                <span className="dm-item-name">{c.user?.name}</span>
                <span className={`dm-item-preview ${c.unread ? 'unread' : ''}`} dir="auto">{c.last_message?.body}</span>
              </span>
              <span className="dm-item-side">
                {c.last_message_at && <span className="dm-item-time">{dayLabelShort(c.last_message_at)}</span>}
                {c.unread > 0 && <span className="unread-pill">{c.unread > 99 ? '99+' : c.unread}</span>}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="dm-thread">
        {id
          ? <Thread key={id} conversationId={id} onBack={() => navigate('/messages')} onListChange={loadList} />
          : (
            <div className="dm-empty dm-empty-center">
              <MessageSquare size={40} strokeWidth={1.4} />
              <div>{t('Select a conversation')}</div>
              <div className="dm-empty-sub">{t('Or start a new one with the button on the left.')}</div>
            </div>
          )}
      </section>

      {picker && (
        <PeoplePicker
          onClose={closePicker}
          onPick={async (person) => {
            try {
              const { data } = await api.post('/dm', { user_id: person.id });
              closePicker();
              changed();
              open(data.id);
            } catch (err) {
              toast.error(err.response?.data?.message || t('Could not start the conversation'));
            }
          }}
        />
      )}
    </div>
  );
}

/** "14:05" for today, otherwise a short date — for the list's right-hand corner. */
function dayLabelShort(iso) {
  return dayKey(iso) === dayKey(new Date().toISOString())
    ? timeOf(iso)
    : formatDate(new Date(iso), { day: 'numeric', month: 'short' });
}

function Thread({ conversationId, onBack, onListChange }) {
  const { user } = useAuth();
  const { refresh } = useLive();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [otherRead, setOtherRead] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const bodyRef = useRef(null);
  const stick = useRef(true);        // follow new messages only while the reader is at the bottom
  const lastSeenId = useRef(0);      // newest message id we already told the server we read

  const scrollToEnd = () => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; };

  const markRead = useCallback((list) => {
    const newest = list.length ? list[list.length - 1].id : 0;
    if (!newest || newest <= lastSeenId.current || document.visibilityState !== 'visible') return;
    lastSeenId.current = newest;
    api.post(`/dm/${conversationId}/read`).then(() => { changed(); refresh(); }).catch(() => {});
  }, [conversationId, refresh]);

  // Initial load.
  useEffect(() => {
    let alive = true;
    Promise.all([api.get(`/dm/${conversationId}`), api.get(`/dm/${conversationId}/messages`)])
      .then(([c, m]) => {
        if (!alive) return;
        setConversation(c.data);
        setMessages(m.data.messages);
        setHasMore(m.data.has_more);
        setOtherRead(m.data.other_last_read_id);
        markRead(m.data.messages);
      })
      .catch(() => alive && setMissing(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [conversationId, markRead]);

  // Keep it live: re-read the latest page (also picks up deletions and the other side's "seen").
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      api.get(`/dm/${conversationId}/messages`).then(({ data }) => {
        setMessages((prev) => mergeLatest(prev, data.messages, data.has_more));
        setHasMore((h) => h || data.has_more);
        setOtherRead(data.other_last_read_id);
        markRead(data.messages);
      }).catch(() => {});
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [conversationId, markRead]);

  // Stay glued to the bottom when new messages arrive (unless the reader scrolled up).
  useEffect(() => { if (stick.current) scrollToEnd(); }, [messages]);

  const onScroll = () => {
    const el = bodyRef.current;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const loadEarlier = async () => {
    if (!messages.length) return;
    const el = bodyRef.current;
    const before = el.scrollHeight;
    const { data } = await api.get(`/dm/${conversationId}/messages`, { params: { before_id: messages[0].id } });
    stick.current = false;
    setMessages((prev) => [...data.messages, ...prev]);
    setHasMore(data.has_more);
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - before; });   // keep the reader's place
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/dm/${conversationId}/messages`, { body });
      stick.current = true;
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      lastSeenId.current = data.id;
      setText('');
      changed();
      onListChange();
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const remove = async (message) => {
    try {
      await api.delete(`/dm/${conversationId}/messages/${message.id}`);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setConfirmId(null);
      changed();
      onListChange();
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to delete message'));
    }
  };

  if (loading) return <div className="dm-empty dm-empty-center">{t('Loading...')}</div>;
  if (missing || !conversation) {
    return (
      <div className="dm-empty dm-empty-center">
        <div>{t('This conversation is not available.')}</div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onBack}>{t('Back')}</button>
      </div>
    );
  }

  const other = conversation.user;
  const inactive = other && !other.is_active;
  const lastMine = [...messages].reverse().find((m) => m.sender_id === user.id);

  return (
    <>
      <header className="dm-thread-header">
        <button type="button" className="topbar-icon-btn dm-back" onClick={onBack} aria-label={t('Back')}>
          <ArrowLeft size={18} className="flip-rtl" />
        </button>
        <Avatar user={other} size={40} />
        <div className="dm-thread-who">
          <div className="dm-thread-name">{other?.name}</div>
          <div className="dm-thread-sub">{other?.department?.name || (inactive ? t('Inactive') : '')}</div>
        </div>
      </header>

      <div className="dm-thread-body" ref={bodyRef} onScroll={onScroll}>
        {hasMore && (
          <div className="dm-earlier">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadEarlier}>
              {t('Load earlier messages')}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="dm-empty dm-empty-center">
            <div>{t('Say hello 👋')}</div>
            <div className="dm-empty-sub">{t('Only you and {name} can see this conversation.', { name: other?.name || '' })}</div>
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === user.id;
          const separator = i === 0 || dayKey(messages[i - 1].created_at) !== dayKey(m.created_at) ? dayLabel(m.created_at) : null;
          return (
            <div key={m.id}>
              {separator && <div className="dm-day"><span>{separator}</span></div>}
              <div className={`dm-msg ${mine ? 'mine' : ''}`}>
                {mine && (
                  confirmId === m.id ? (
                    <span className="dm-confirm">
                      <button type="button" className="dm-confirm-yes" onClick={() => remove(m)}>{t('Delete')}</button>
                      <button type="button" className="dm-confirm-no" onClick={() => setConfirmId(null)}>{t('Cancel')}</button>
                    </span>
                  ) : (
                    <button type="button" className="dm-trash" title={t('Delete message')} onClick={() => setConfirmId(m.id)}>
                      <Trash2 size={13} />
                    </button>
                  )
                )}
                <div className="dm-bubble">
                  <span className="dm-text" dir="auto">{m.body}</span>
                  <span className="dm-time">
                    {timeOf(m.created_at)}
                    {mine && lastMine?.id === m.id && otherRead >= m.id && (
                      <span className="dm-seen" title={t('Seen')}><CheckCheck size={12} /> {t('Seen')}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="dm-composer">
        {inactive ? (
          <div className="dm-inactive">{t('This user is inactive and cannot receive messages.')}</div>
        ) : (
          <>
            <textarea
              className="form-control"
              rows={1}
              value={text}
              maxLength={4000}
              dir="auto"
              placeholder={t('Type a message…')}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
              }}
            />
            <button type="button" className="btn-accent dm-send" onClick={send} disabled={!text.trim() || sending} aria-label={t('Send')}>
              <Send size={16} className="flip-rtl" />
            </button>
          </>
        )}
      </footer>
    </>
  );
}

function PeoplePicker({ onClose, onPick }) {
  const [people, setPeople] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/users/directory').then((r) => setPeople(r.data || [])).catch(() => setPeople([]));
  }, []);

  const shown = (people || []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="modal show d-block" style={{ background: 'var(--scrim)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{t('New message')}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label={t('Close')} />
          </div>
          <div className="modal-body">
            <div className="dm-search">
              <Search size={15} />
              <input
                autoFocus
                className="form-control"
                placeholder={t('Search people…')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="dm-people">
              {people === null && <div className="dm-empty">{t('Loading...')}</div>}
              {people !== null && shown.length === 0 && <div className="dm-empty">{t('No people found')}</div>}
              {shown.map((p) => (
                <button type="button" key={p.id} className="dm-item" onClick={() => onPick(p)}>
                  <Avatar user={p} size={36} />
                  <span className="dm-item-text">
                    <span className="dm-item-name">{p.name}</span>
                    {p.department?.name && <span className="dm-item-preview">{p.department.name}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
