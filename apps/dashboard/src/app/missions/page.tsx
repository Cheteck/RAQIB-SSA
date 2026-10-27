'use client';

import { useMissions } from '../../hooks/useMissions';

const STATUS_COLORS: Record<string, string> = {
  pending:    'rgb(var(--mu))',
  running:    'rgb(var(--m))',
  completed:  'rgb(var(--c))',
  failed:     'rgb(var(--r))',
  paused:     'rgb(var(--g))',
};

export default function MissionsPage() {
  const { missions, loading, error } = useMissions();

  return (
    <div className="workspace-content">
      <section className="p" style={{ '--i': 0 } as any}>
        <h3>
          Suivi des Missions & Exécutions
          <em>{loading ? '…' : error ? 'ERREUR' : `${missions.length} missions`}</em>
        </h3>

        {loading && (
          <p className="mono" aria-live="polite">Chargement des missions…</p>
        )}

        {!loading && error && (
          <div className="fi w">
            <header><span>Erreur de connexion</span><em>ERR</em></header>
            <p>Impossible de joindre le runtime sur port 4000.</p>
            <small>Vérifiez que le serveur RAQIB est démarré.</small>
          </div>
        )}

        {!loading && !error && missions.length === 0 && (
          <p id="no-missions-msg" className="mono">
            Aucune mission enregistrée pour le moment.
          </p>
        )}

        {!loading && !error && missions.length > 0 && (
          <div className="missions-grid">
            {missions.map((m) => {
              const budgetPct = m.budgetLimitEur > 0
                ? Math.min(100, (m.budgetUsedEur / m.budgetLimitEur) * 100)
                : 0;
              const statusColor = STATUS_COLORS[m.status?.toLowerCase()] ?? 'var(--mu)';

              return (
                <div key={m.id} className="mission-card fi">
                  <header>
                    <span>{m.id} — {m.name}</span>
                    <em style={{ color: statusColor }}>{m.status}</em>
                  </header>
                  <p>{m.objective}</p>

                  {/* Budget bar */}
                  <div className="mission-budget">
                    <div
                      className="mission-budget__bar"
                      style={{
                        width: `${budgetPct}%`,
                        background: budgetPct > 80
                          ? 'rgb(var(--r))'
                          : budgetPct > 50
                          ? 'rgb(var(--g))'
                          : 'rgb(var(--m))',
                      }}
                      role="progressbar"
                      aria-valuenow={Math.round(budgetPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Budget utilisé ${Math.round(budgetPct)}%`}
                    />
                  </div>
                  <small>
                    Budget: {m.budgetUsedEur.toFixed(2)} / {m.budgetLimitEur.toFixed(2)} €
                    {' · '}Niveau: {m.autonomyLevel}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
