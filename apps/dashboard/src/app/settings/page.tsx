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
    <div className="hud-panel rounded-2xl flex flex-col gap-6">
      <h3 className="flex items-baseline justify-between font-oxanium text-base font-semibold text-white border-b border-[#62e6ff]/20 pb-3">
        Paramètres & Coupe-Circuit d'Urgence <em>Emergency Lock Matrix</em>
      </h3>

      <div className="p-6 rounded-xl bg-red-950/30 border border-red-500/50 flex flex-col gap-3">
        <h4 className="font-oxanium text-sm font-bold text-[#ff6b5e] m-0 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          Bouton d'Arrêt d'Urgence (Emergency Stop)
        </h4>
        <p className="text-xs text-[#d9e6ef] leading-relaxed m-0 font-sans">
          L'activation écrit le verrou <code className="font-mono bg-white/10 px-1 py-0.5 rounded text-[#ff6b5e]">data/emergency.lock</code> et bloque immédiatement et sans exception toutes les actions d'écriture et d'exécution dans RAQIB.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <button
            id="btn-activate-emergency"
            onClick={() => toggleEmergency('activate')}
            className="px-4 py-2 rounded bg-[#ff6b5e] hover:bg-red-600 text-black font-oxanium text-xs font-bold tracking-wider transition-all cursor-pointer shadow-[0_0_12px_rgba(255,107,94,0.4)]"
          >
            ACTIVER EMERGENCY STOP
          </button>
          <button
            id="btn-deactivate-emergency"
            onClick={() => toggleEmergency('deactivate')}
            className="px-4 py-2 rounded bg-[#7dffc8]/20 hover:bg-[#7dffc8]/30 border border-[#7dffc8] text-[#7dffc8] font-oxanium text-xs font-bold tracking-wider transition-all cursor-pointer"
          >
            DÉSACTIVER (RÉINITIALISER)
          </button>
        </div>
        {msg && <p id="emergency-toggle-message" className="text-xs font-mono font-bold text-[#62e6ff] mt-2">{msg}</p>}
      </div>
    </div>
  );
}
