import { useState } from 'react';

/**
 * WorkflowSetup — lets admin/manager drag-order people into a workflow chain.
 * Props:
 *   users        — array of available users
 *   steps        — current ordered list  [ { user_id, name } ]
 *   onChange(steps) — called when order changes
 */
export default function WorkflowSetup({ users, steps, onChange }) {
  const [search, setSearch] = useState('');

  const addUser = (u) => {
    if (steps.some(s => s.user_id === u.id)) return;
    onChange([...steps, { user_id: u.id, name: u.name }]);
  };

  const removeStep = (idx) => {
    onChange(steps.filter((_, i) => i !== idx));
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const arr = [...steps];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onChange(arr);
  };

  const moveDown = (idx) => {
    if (idx === steps.length - 1) return;
    const arr = [...steps];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onChange(arr);
  };

  const available = users.filter(u =>
    !steps.some(s => s.user_id === u.id) &&
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Current chain */}
      {steps.length > 0 && (
        <div className="mb-3">
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Workflow order — task passes from top to bottom:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {steps.map((step, idx) => (
              <div key={step.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '8px 12px',
              }}>
                {/* Step number */}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  {idx + 1}
                </div>

                {/* Arrow connector */}
                {idx > 0 && (
                  <div style={{
                    position: 'absolute', left: 23, top: -10,
                    width: 2, height: 10, background: 'var(--accent)',
                  }} />
                )}

                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{step.name}</span>

                {/* Move up/down */}
                <button onClick={() => moveUp(idx)} disabled={idx === 0}
                  style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1, fontSize: 14 }}>
                  ▲
                </button>
                <button onClick={() => moveDown(idx)} disabled={idx === steps.length - 1}
                  style={{ background: 'none', border: 'none', cursor: idx === steps.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === steps.length - 1 ? 0.3 : 1, fontSize: 14 }}>
                  ▼
                </button>
                <button onClick={() => removeStep(idx)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Chain visual */}
          {steps.length > 1 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', textAlign: 'center' }}>
              {steps.map((s, i) => (
                <span key={s.user_id}>
                  <strong>{s.name}</strong>
                  {i < steps.length - 1 && <span style={{ margin: '0 6px', color: 'var(--text-secondary)' }}>→</span>}
                </span>
              ))}
              <span style={{ marginLeft: 6, color: '#10b981' }}>✓ Done</span>
            </div>
          )}
        </div>
      )}

      {steps.length < 2 && (
        <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8, padding: '6px 10px', background: '#fef3c720', borderRadius: 6 }}>
          ⚠️ Workflow needs at least 2 people.
        </div>
      )}

      {/* Add users */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Add people to the chain:</div>
        <input
          className="form-control form-control-sm mb-2"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
          {available.length === 0 && (
            <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
              {users.length === 0 ? 'No users available' : 'All users added'}
            </div>
          )}
          {available.map(u => (
            <div
              key={u.id}
              onClick={() => addUser(u)}
              style={{
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                fontSize: 13, transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>
                {u.name?.slice(0, 2).toUpperCase()}
              </div>
              <span>{u.name}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 16 }}>+</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
