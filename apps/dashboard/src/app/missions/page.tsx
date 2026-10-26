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
    <div className="hud-panel rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[24px]">task</span>
          <div>
            <h1 className="text-lg font-mono font-bold text-primary neon-cyan-text m-0">Suivi des Missions & Exécutions</h1>
            <p className="text-xs text-on-surface-variant font-mono m-0">Machine à états persistante et contrôle d'autonomie</p>
          </div>
        </div>
        <span className="font-mono text-xs text-tertiary px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/30">
          {missions.length} MISSIONS ENREGISTRÉES
        </span>
      </div>

      {loading ? (
        <p className="text-xs font-mono text-outline">Chargement des missions...</p>
      ) : missions.length === 0 ? (
        <div className="p-8 text-center bg-surface-container-low/50 rounded-xl border border-outline-variant/30">
          <span className="material-symbols-outlined text-outline text-[32px]">check_circle</span>
          <p id="no-missions-msg" className="text-xs font-mono text-outline mt-2">Aucune mission enregistrée pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {missions.map((m) => (
            <div key={m.id} className="mission-card p-4 rounded-xl bg-surface-container-low border border-primary-container/20 flex flex-col gap-2 hover:border-primary-container/50 transition-all shadow-[0_0_12px_rgba(66,217,255,0.05)]">
              <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                <span className="font-mono text-xs font-bold text-primary-container">{m.id} — {m.name}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant text-tertiary">{m.status}</span>
              </div>
              <p className="text-xs text-on-surface leading-snug">{m.objective}</p>
              <div className="flex items-center justify-between text-[11px] font-mono text-outline pt-1">
                <span>Budget: {m.budgetUsedEur.toFixed(2)} / {m.budgetLimitEur.toFixed(2)} €</span>
                <span className="text-primary font-semibold">Niveau: {m.autonomyLevel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
