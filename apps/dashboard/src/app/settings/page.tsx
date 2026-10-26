'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function SettingsPage() {
  const [msg, setMsg] = useState('');

  const toggleEmergency = async (action: 'activate' | 'deactivate') => {
    try {
      const res = await fetch(`${API_BASE}/api/emergency-stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'activate' ? 'Declenché depuis le Dashboard' : undefined,
          confirmedBy: action === 'deactivate' ? 'fondateur' : undefined
        })
      });
      const data = await res.json();
      setMsg(`Statut Emergency Stop: ${data.active ? 'ACTIF' : 'INACTIF'}`);
    } catch {
      setMsg('Erreur de communication avec le serveur Runtime.');
    }
  };

  return (
    <div className="hud-panel rounded-2xl p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-3">
        <span className="material-symbols-outlined text-error text-[24px]">gavel</span>
        <div>
          <h1 className="text-lg font-mono font-bold text-primary neon-cyan-text m-0">Paramètres & Interrupteur d'Urgence</h1>
          <p className="text-xs text-on-surface-variant font-mono m-0">Gouvernance absolue et coupe-circuit immédiat</p>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-error-container/20 border border-error/50 flex flex-col gap-3">
        <h3 className="text-sm font-mono font-bold text-error m-0 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          Bouton d'Arrêt d'Urgence (Emergency Stop)
        </h3>
        <p className="text-xs text-on-surface leading-relaxed m-0">
          L'activation écrit le verrou <code className="font-mono bg-surface-container-high px-1 py-0.5 rounded text-error">data/emergency.lock</code> et bloque immédiatement et sans exception toutes les actions d'écriture et d'exécution dans RAQIB.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <button
            id="btn-activate-emergency"
            onClick={() => toggleEmergency('activate')}
            className="px-4 py-2 rounded-lg bg-error hover:bg-red-600 text-black font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(255,180,171,0.4)] cursor-pointer"
          >
            ACTIVER EMERGENCY STOP
          </button>
          <button
            id="btn-deactivate-emergency"
            onClick={() => toggleEmergency('deactivate')}
            className="px-4 py-2 rounded-lg bg-tertiary/20 hover:bg-tertiary/30 border border-tertiary text-tertiary font-mono text-xs font-bold transition-all cursor-pointer"
          >
            DÉSACTIVER (RÉINITIALISER)
          </button>
        </div>
        {msg && <p id="emergency-toggle-message" className="text-xs font-mono font-bold text-primary-container mt-2">{msg}</p>}
      </div>
    </div>
  );
}
