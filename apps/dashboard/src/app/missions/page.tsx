'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function MissionsPage() {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/missions`)
      .then(res => res.json())
      .then(data => setMissions(data.missions || []))
      .catch(() => setMissions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Suivi des Missions</h1>
      {loading ? (
        <p>Chargement des missions...</p>
      ) : missions.length === 0 ? (
        <p id="no-missions-msg" style={{ color: '#94a3b8' }}>Aucune mission enregistrée pour le moment.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
          {missions.map((m) => (
            <div key={m.id} className="mission-card" style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>{m.id} — {m.name}</strong>
                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '4px', background: '#334155', fontSize: '0.85rem' }}>{m.status}</span>
              </div>
              <p style={{ margin: '0.5rem 0', color: '#cbd5e1' }}>{m.objective}</p>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Budget: {m.budgetUsedEur.toFixed(2)} / {m.budgetLimitEur.toFixed(2)} € | Niveau: {m.autonomyLevel} | Étapes: {m.steps?.length || 0}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
