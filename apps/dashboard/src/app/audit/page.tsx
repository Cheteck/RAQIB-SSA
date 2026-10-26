'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/audit`)
      .then(res => res.json())
      .then(data => setEvents(data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="hud-panel rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[24px]">history_edu</span>
          <div>
            <h1 className="text-lg font-mono font-bold text-primary neon-cyan-text m-0">Audit Ledger — Journal Inaltérable</h1>
            <p className="text-xs text-on-surface-variant font-mono m-0">Traçabilité Append-Only SQLite (aucun UPDATE/DELETE possible)</p>
          </div>
        </div>
        <span className="font-mono text-xs text-tertiary px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/30">
          {events.length} ÉVÉNEMENTS LOGGUÉS
        </span>
      </div>

      {loading ? (
        <p className="text-xs font-mono text-outline">Chargement du journal d'audit...</p>
      ) : events.length === 0 ? (
        <div className="p-8 text-center bg-surface-container-low/50 rounded-xl border border-outline-variant/30">
          <p className="text-xs font-mono text-outline">Aucun événement enregistré dans le journal d'audit.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((evt) => (
            <div key={evt.id} className="audit-event-card p-3.5 rounded-xl bg-surface-container-low border-l-4 border-l-primary-container border border-outline-variant/30 flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono text-outline">
                <span>[{evt.timestamp}] <strong className="text-primary">{evt.type}</strong></span>
                <span>Acteur: <strong className="text-on-surface">{evt.actor}</strong></span>
              </div>
              <pre className="m-0 p-2 rounded bg-surface-container-lowest text-xs font-mono text-on-surface overflow-x-auto border border-outline-variant/20">
                {JSON.stringify(evt.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
