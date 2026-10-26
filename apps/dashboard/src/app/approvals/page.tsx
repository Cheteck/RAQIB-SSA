'use client';

export default function ApprovalsPage() {
  return (
    <div>
      <h1>Gestion des Approbations</h1>
      <p style={{ color: '#94a3b8' }}>Consultation et validation des demandes d'approbation d'actions sensibles.</p>
      <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
        <p style={{ color: '#94a3b8' }}>Aucune demande d'approbation en attente.</p>
      </div>
    </div>
  );
}
