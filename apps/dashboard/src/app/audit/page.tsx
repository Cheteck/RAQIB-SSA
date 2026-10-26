'use client';

import { useState, useEffect } from 'react';

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:4000/api/audit')
      .then(res => res.json())
      .then(data => setEvents(data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Audit Ledger — Traçabilité Append-Only</h1>
      {loading ? (
        <p>Chargement des événements d'audit...</p>
      ) : events.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Aucun événement enregistré dans le journal d'audit.</p>
      ) : (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {events.map((evt) => (
            <div key={evt.id} style={{ background: '#1e293b', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#94a3b8' }}>
                <span>[{evt.timestamp}] <strong>{evt.type}</strong></span>
                <span>Acteur: {evt.actor}</span>
              </div>
              <pre style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#e2e8f0', overflowX: 'auto' }}>
                {JSON.stringify(evt.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
