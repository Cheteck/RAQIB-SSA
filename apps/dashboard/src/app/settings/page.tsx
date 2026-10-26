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
    <div style={{ padding: '80px 24px 100px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <section className="p w" style={{ opacity: 1, borderColor: 'rgb(255, 107, 94)' }}>
        <h3>Interrupteur d'Urgence <em>Emergency Lock Matrix</em></h3>
        <p style={{ margin: '8px 0 16px 0', color: '#d9e6ef' }}>
          L'activation écrit le verrou <code className="mono" style={{ color: '#ff6b5e' }}>data/emergency.lock</code> et bloque immédiatement et sans exception toutes les actions d'écriture et d'exécution dans RAQIB.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            id="btn-activate-emergency"
            onClick={() => toggleEmergency('activate')}
            style={{ padding: '8px 16px', background: 'rgb(255, 107, 94)', color: '#04060b', fontWeight: 'bold', borderRadius: '4px' }}
          >
            ACTIVER EMERGENCY STOP
          </button>
          <button
            id="btn-deactivate-emergency"
            onClick={() => toggleEmergency('deactivate')}
            style={{ padding: '8px 16px', border: '1px solid rgb(125, 255, 200)', color: 'rgb(125, 255, 200)', borderRadius: '4px' }}
          >
            DÉSACTIVER (RÉINITIALISER)
          </button>
        </div>
        {msg && <p id="emergency-toggle-message" className="mono" style={{ marginTop: '12px', color: 'rgb(98, 230, 255)' }}>{msg}</p>}
      </section>
    </div>
  );
}
