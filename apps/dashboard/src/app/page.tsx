'use client';

import { useState, useEffect } from 'react';

export default function OverviewPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ status: 'OFFLINE', emergencyStop: false, readOnlyMode: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div>
      <h1>Tableau de Bord RAQIB</h1>
      <p>Supervision en temps réel du moteur de gouvernance et de sécurité.</p>

      {loading ? (
        <p>Chargement du statut...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3>Statut du Runtime</h3>
            <span style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              fontWeight: 'bold',
              backgroundColor: status?.status === 'OK' ? '#166534' : '#991b1b',
              color: '#fff'
            }}>
              {status?.status || 'INCONNU'}
            </span>
          </div>

          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3>Arrêt d'urgence (Emergency Stop)</h3>
            <span style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              fontWeight: 'bold',
              backgroundColor: status?.emergencyStop ? '#dc2626' : '#15803d',
              color: '#fff'
            }}>
              {status?.emergencyStop ? 'ACTIF (BLOCKED)' : 'INACTIF (NORMAL)'}
            </span>
          </div>

          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3>Mode de Fonctionnement</h3>
            <span style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              fontWeight: 'bold',
              backgroundColor: status?.readOnlyMode ? '#854d0e' : '#1e40af',
              color: '#fff'
            }}>
              {status?.readOnlyMode ? 'LECTURE SEULE' : 'LECTURE / ÉCRITURE'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
