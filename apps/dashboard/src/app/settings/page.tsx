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
    <div>
      <h1>Paramètres & Urgence</h1>
      <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', border: '1px solid #7f1d1d', marginTop: '1.5rem' }}>
        <h3 style={{ color: '#f87171' }}>⚠️ Bouton d'Arrêt d'Urgence (Emergency Stop)</h3>
        <p style={{ color: '#cbd5e1' }}>
          L'activation bloque immédiatement et sans exception toutes les actions d'écriture et d'exécution dans RAQIB.
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button
            id="btn-activate-emergency"
            onClick={() => toggleEmergency('activate')}
            style={{ padding: '0.75rem 1.5rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ACTIVER EMERGENCY STOP
          </button>
          <button
            id="btn-deactivate-emergency"
            onClick={() => toggleEmergency('deactivate')}
            style={{ padding: '0.75rem 1.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            DÉSACTIVER (RÉINITIALISER)
          </button>
        </div>
        {msg && <p id="emergency-toggle-message" style={{ marginTop: '1rem', fontWeight: 'bold', color: '#38bdf8' }}>{msg}</p>}
      </div>
    </div>
  );
}
