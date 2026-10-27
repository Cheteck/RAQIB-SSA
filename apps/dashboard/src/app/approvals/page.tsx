'use client';

import { useApprovals } from '../../hooks/useApprovals';

export default function ApprovalsPage() {
  const { approvals, loading, error, decide } = useApprovals();

  const handleDecision = (id: string, decision: 'approve' | 'reject') => {
    decide(id, decision);
  };

  return (
    <div className="workspace-content">
      <section className="p" style={{ '--i': 0 } as any}>
        <h3>
          Gestion des Approbations
          <em>Single-Use Authorization</em>
        </h3>

        {loading && (
          <p className="mono" aria-live="polite">Vérification des demandes en attente…</p>
        )}

        {!loading && approvals.length === 0 && (
          <div className="fi">
            <header>
              <span>Matrice d'approbation</span>
              <em>CLEAR</em>
            </header>
            <p>Aucune demande d'approbation en attente.</p>
            <small>
              Toute action élevée générera ici une demande de signature unique
              avant exécution.
            </small>
          </div>
        )}

        {!loading && approvals.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {approvals.map((a) => (
              <div key={a.id} className="fi">
                <header>
                  <span>{a.actionType ?? 'Autorisation requise'} — {a.id}</span>
                  <em>{a.status ?? 'PENDING'}</em>
                </header>
                <p>{a.justification ?? 'Aucune description disponible.'}</p>
                <small style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span>{new Date(a.createdAt * 1000).toLocaleString()} · {a.grantedBy ?? 'system'}</span>
                  <button
                    onClick={() => handleDecision(a.id, 'approve')}
                    style={{
                      padding: '2px 10px',
                      border: '1px solid rgb(var(--m))',
                      borderRadius: '4px',
                      color: 'rgb(var(--m))',
                      background: 'rgba(var(--m), 0.08)',
                      cursor: 'pointer',
                    }}
                  >
                    Autoriser
                  </button>
                  <button
                    onClick={() => handleDecision(a.id, 'reject')}
                    style={{
                      padding: '2px 10px',
                      border: '1px solid rgba(var(--r), 0.6)',
                      borderRadius: '4px',
                      color: 'rgb(var(--r))',
                      background: 'rgba(var(--r), 0.08)',
                      cursor: 'pointer',
                    }}
                  >
                    Rejeter
                  </button>
                </small>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Approval matrix info */}
      <section className="p" style={{ '--i': 1, marginTop: '12px' } as any}>
        <h3>
          Matrice de gouvernance
          <em>Policy Engine</em>
        </h3>
        <div className="ag act">
          <span className="ms">how_to_reg</span>
          <div>
            <b>Signature unique</b>
            <small>Chaque autorisation est à usage unique et ne peut pas être réutilisée</small>
          </div>
        </div>
        <div className="ag">
          <span className="ms">lock</span>
          <div>
            <b>Audit trail</b>
            <small>Toute décision est enregistrée dans le ledger inaltérable</small>
          </div>
        </div>
        <div className="ag">
          <span className="ms">policy</span>
          <div>
            <b>Contrôle budgétaire</b>
            <small>Les dépassements de budget déclenchent automatiquement une demande</small>
          </div>
        </div>
      </section>
    </div>
  );
}
