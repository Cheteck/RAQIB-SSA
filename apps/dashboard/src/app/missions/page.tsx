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
    <div className="hud-panel rounded-2xl flex flex-col gap-4">
      <h3 className="flex items-baseline justify-between font-oxanium text-base font-semibold text-white border-b border-[#62e6ff]/20 pb-3">
        Suivi des Missions & Exécutions <em>{missions.length} Missions Enregistrées</em>
      </h3>

      {loading ? (
        <p className="text-xs font-mono text-[#7f95a6]">Chargement des missions...</p>
      ) : missions.length === 0 ? (
        <div className="p-8 text-center bg-[#0a1019] rounded-xl border border-white/10">
          <p id="no-missions-msg" className="text-xs font-mono text-[#7f95a6] m-0">Aucune mission enregistrée pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {missions.map((m) => (
            <div key={m.id} className="mission-card p-4 rounded-xl bg-[#0a1019] border border-[#62e6ff]/20 flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="font-oxanium text-xs font-bold text-[#62e6ff]">{m.id} — {m.name}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/10 text-[#7dffc8]">{m.status}</span>
              </div>
              <p className="text-xs text-[#d9e6ef] m-0">{m.objective}</p>
              <div className="flex justify-between items-center font-mono text-[11px] text-[#7f95a6] pt-1">
                <span>Budget: {m.budgetUsedEur.toFixed(2)} / {m.budgetLimitEur.toFixed(2)} €</span>
                <span className="text-[#62e6ff] font-semibold">Niveau: {m.autonomyLevel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
