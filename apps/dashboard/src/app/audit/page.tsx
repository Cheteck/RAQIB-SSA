'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const EVENT_COLORS: Record<string, string> = {
  MISSION_CREATED:   'rgb(var(--m))',
  MISSION_UPDATED:   'rgb(var(--c))',
  MISSION_COMPLETED: 'rgb(var(--m))',
  EMERGENCY_STOP:    'rgb(var(--r))',
  POLICY_VIOLATION:  'rgb(var(--r))',
  APPROVAL_GRANTED:  'rgb(var(--m))',
  APPROVAL_REJECTED: 'rgb(var(--r))',
  SYSTEM_BOOT:       'rgb(var(--g))',
};

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    fetch(`${API_BASE}/api/audit`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const types = ['ALL', ...Array.from(new Set(events.map((e) => e.type))).sort()];
  const visible = filter === 'ALL' ? events : events.filter((e) => e.type === filter);

  return (
    <div className="workspace-content">
      {/* Header + filter bar */}
      <section className="p" style={{ '--i': 0 } as any}>
        <h3>
          Audit Ledger — Journal Inaltérable
          <em>{loading ? '…' : `${events.length} événements`}</em>
        </h3>

        {/* Type filter */}
        {!loading && events.length > 0 && (
          <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: '12px' }}>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{
                  font: '400 10px "JetBrains Mono"',
                  padding: '3px 10px',
                  border: `1px solid ${filter === t ? 'rgba(var(--c), 0.6)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '99px',
                  color: filter === t ? '#fff' : 'var(--mu)',
                  background: filter === t ? 'rgba(var(--c), 0.12)' : 'none',
                  cursor: 'pointer',
                  transition: '0.2s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <p className="mono" aria-live="polite">Chargement du journal d'audit…</p>
        )}

        {!loading && events.length === 0 && (
          <div className="fi">
            <header><span>Ledger vide</span><em>CLEAR</em></header>
            <p>Aucun événement enregistré dans le journal d'audit.</p>
            <small>Le ledger est append-only et cryptographiquement scellé.</small>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visible.map((evt) => {
              const accentColor = EVENT_COLORS[evt.type] ?? 'rgba(var(--c), 0.5)';
              const isWarning = evt.type?.includes('STOP') || evt.type?.includes('VIOLATION');
              return (
                <div
                  key={evt.id}
                  className={`fi${isWarning ? ' w' : ''}`}
                  style={isWarning ? {} : { borderLeftColor: accentColor }}
                >
                  <header>
                    <span>
                      <span
                        className="mono"
                        style={{ color: 'var(--mu)', marginRight: '8px', fontSize: '10px' }}
                      >
                        {evt.timestamp
                          ? new Date(evt.timestamp).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '—'}
                      </span>
                      {evt.type}
                    </span>
                    <em style={{ color: accentColor }}>
                      {evt.actor ?? 'system'}
                    </em>
                  </header>
                  {evt.data && Object.keys(evt.data).length > 0 && (
                    <pre
                      style={{
                        margin: '4px 0 0 0',
                        fontSize: '10.5px',
                        color: '#d9e6ef',
                        fontFamily: '"JetBrains Mono", monospace',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {JSON.stringify(evt.data, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Ledger integrity info */}
      <section className="p" style={{ '--i': 1, marginTop: '12px' } as any}>
        <h3>
          Intégrité du Ledger
          <em>Append-Only · Sealed</em>
        </h3>
        <div className="ag act">
          <span className="ms">verified</span>
          <div>
            <b>Hash chain</b>
            <small>Chaque entrée est chaînée cryptographiquement à la précédente</small>
          </div>
        </div>
        <div className="ag act">
          <span className="ms">lock</span>
          <div>
            <b>Immutabilité</b>
            <small>Aucune entrée ne peut être modifiée ou supprimée après écriture</small>
          </div>
        </div>
      </section>
    </div>
  );
}
