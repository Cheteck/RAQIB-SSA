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
    <div className="hud-panel rounded-2xl flex flex-col gap-4">
      <h3 className="flex items-baseline justify-between font-oxanium text-base font-semibold text-white border-b border-[#62e6ff]/20 pb-3">
        Audit Ledger — Journal Inaltérable <em>{events.length} Événements Loggués</em>
      </h3>

      {loading ? (
        <p className="text-xs font-mono text-[#7f95a6]">Chargement du journal d'audit...</p>
      ) : events.length === 0 ? (
        <div className="p-8 text-center bg-[#0a1019] rounded-xl border border-white/10">
          <p className="text-xs font-mono text-[#7f95a6] m-0">Aucun événement enregistré dans le journal d'audit.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((evt) => (
            <div key={evt.id} className="audit-event-card p-3.5 rounded bg-[#0a1019] border-l-2 border-l-[#62e6ff] border border-white/10 flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-mono text-[#7f95a6]">
                <span>[{evt.timestamp}] <strong className="text-[#62e6ff]">{evt.type}</strong></span>
                <span>Acteur: <strong className="text-white">{evt.actor}</strong></span>
              </div>
              <pre className="m-0 p-2 rounded bg-[#04060b] text-xs font-mono text-[#d9e6ef] overflow-x-auto border border-white/10">
                {JSON.stringify(evt.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
