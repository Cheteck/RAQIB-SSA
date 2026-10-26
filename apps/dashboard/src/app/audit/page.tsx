'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/audit`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '80px 24px 100px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <section className="p" style={{ opacity: 1 }}>
        <h3>Audit Ledger — Journal Inaltérable <em>{events.length} Événements</em></h3>
        {loading ? (
          <p className="mono">Chargement des événements...</p>
        ) : events.length === 0 ? (
          <p className="mono">Aucun événement enregistré dans le journal d'audit.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {events.map((evt) => (
              <div key={evt.id} className="fi">
                <header>
                  <span>[{evt.timestamp}] {evt.type}</span>
                  <em>Acteur: {evt.actor}</em>
                </header>
                <pre style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#d9e6ef' }}>
                  {JSON.stringify(evt.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
