'use client';

export default function ApprovalsPage() {
  return (
    <div style={{ padding: '80px 24px 100px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <section className="p" style={{ opacity: 1 }}>
        <h3>Gestion des Approbations <em>Single-Use Authorization</em></h3>
        <p className="mono">Aucune demande d'approbation en attente.</p>
      </section>
    </div>
  );
}
