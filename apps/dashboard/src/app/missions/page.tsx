'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function MissionsPage() {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/missions`)
      .then((res) => res.json())
      .then((data) => setMissions(data.missions || []))
      .catch(() => setMissions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '80px 24px 100px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <section className="p" style={{ opacity: 1 }}>
        <h3>Suivi des Missions & Exécutions <em>{missions.length} Missions</em></h3>
        {loading ? (
          <p className="mono">Chargement des missions...</p>
        ) : missions.length === 0 ? (
          <p id="no-missions-msg" className="mono">Aucune mission enregistrée pour le moment.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {missions.map((m) => (
              <div key={m.id} className="fi" style={{ background: 'rgba(98, 230, 255, 0.08)' }}>
                <header>
                  <span>{m.id} — {m.name}</span>
                  <em>{m.status}</em>
                </header>
                <p>{m.objective}</p>
                <small>Budget: {m.budgetUsedEur.toFixed(2)} / {m.budgetLimitEur.toFixed(2)} € · Niveau: {m.autonomyLevel}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
