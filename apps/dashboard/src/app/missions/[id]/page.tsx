'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../lib/api';

interface Mission {
  id: string;
  name: string;
  status: string;
  description?: string;
  objective: string;
  autonomyLevel: string;
  approvalRequired: boolean;
  budgetLimitEur: number;
  maxDurationMs: number;
  priority: string;
  steps: Array<{
    id: string;
    name: string;
    type?: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    result?: any;
    error?: string;
  }>;
  currentStepIndex: number;
  executionContext?: {
    projectPath?: string;
    files?: string[];
    instructions?: string[];
    constraints?: string[];
  };
  result?: {
    summary?: string;
    success?: boolean;
    artifacts?: string[];
    modifiedFiles?: string[];
    reports?: string[];
    errors?: string[];
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  timeoutAt: string;
  statusHistory?: Array<{
    status: string;
    timestamp: string;
    reason: string;
    actor?: string;
  }>;
  contextLog?: Array<{
    version: number;
    timestamp: string;
    updatedBy: string;
    note?: string;
    patch?: any;
  }>;
}

interface AuditEvent {
  id: string;
  type: string;
  timestamp: string;
  missionId?: string;
  actor?: string;
  data?: Record<string, unknown>;
}

interface Subagent {
  id: string;
  name: string;
  role: string;
  status: string;
  state: string;
  missionId: string;
}

export default function MissionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const missionId = params.id as string;

  const [mission, setMission] = useState<Mission | null>(null);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [subagents, setSubagents] = useState<Subagent[]>([]);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMission = useCallback(async () => {
    try {
      const [missionData, historyData, subagentsData] = await Promise.all([
        api.get<any>(`/api/missions/${missionId}`),
        api.get<any>(`/api/missions/${missionId}/history`),
        api.get<any>(`/api/subagents`),
      ]);

      setMission(missionData.mission);
      setHistory(historyData.events || []);
      // Filtrer les sous-agents affectés à cette mission
      const missionSubagents = subagentsData.subagents?.filter(
        (s: Subagent) => s.missionId === missionId
      ) || [];
      setSubagents(missionSubagents);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement de la mission');
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => {
    fetchMission();
  }, [fetchMission]);

  if (loading) {
    return (
      <div className="workspace-content">
        <section className="p">
          <h3>
            Chargement...
            <em>Connexion au Runtime</em>
          </h3>
          <div className="fi">
            <header>
              <span>Chargement des données</span>
              <em>WAIT</em>
            </header>
            <p>Récupération des informations de la mission {missionId}...</p>
          </div>
        </section>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="workspace-content">
        <section className="p">
          <h3>
            Mission introuvable
            <em>ERREUR</em>
          </h3>
          <div className="fi">
            <header>
              <span>Erreur de chargement</span>
              <em>FAIL</em>
            </header>
            <p>{error || `La mission ${missionId} n'existe pas.`}</p>
            <button
              onClick={() => router.push('/missions')}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                background: 'rgba(var(--c), 0.12)',
                border: '1px solid rgba(var(--c), 0.3)',
                borderRadius: '6px',
                color: '#fff',
                font: '500 11px Oxanium',
                cursor: 'pointer',
              }}
            >
              ← Retour aux missions
            </button>
          </div>
        </section>
      </div>
    );
  }

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'rgb(var(--mu))',
      PLANNED: 'rgb(var(--g))',
      APPROVAL_REQUIRED: 'rgb(var(--g))',
      APPROVED: 'rgb(var(--c))',
      RUNNING: 'rgb(var(--m))',
      VERIFYING: 'rgb(var(--m))',
      SUCCEEDED: 'rgb(var(--c))',
      COMPLETED: 'rgb(var(--c))',
      FAILED: 'rgb(var(--r))',
      BLOCKED: 'rgb(var(--g))',
      CANCELLED: 'rgb(var(--mu))',
      NEEDS_REVIEW: 'rgb(var(--g))',
    };
    return colors[status] || 'rgb(var(--mu))';
  };

  return (
    <div className="workspace-content mission-detail-page">
      {/* En-tête : statut et actions */}
      <section className="p" style={{ '--i': 0 } as any}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <button
            onClick={() => router.push('/missions')}
            style={{
              padding: '8px',
              background: 'transparent',
              border: '1px solid rgba(var(--c), 0.3)',
              borderRadius: '6px',
              color: 'rgb(var(--c))',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Retour"
          >
            <span className="ms" style={{ fontSize: '18px' }}>arrow_back</span>
          </button>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0 }}>
              {mission.name}
              <em style={{ color: statusColor(mission.status), marginLeft: '12px' }}>{mission.status}</em>
            </h3>
            <small style={{ opacity: 0.6 }}>{missionId}</small>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(mission.status === 'RUNNING' || mission.status === 'PLANNED' || mission.status === 'APPROVED') && (
            <button
              disabled={canceling}
              onClick={async () => {
                if (canceling) return;
                if (!confirm(`Annuler la mission ${missionId} ?\n\n⚠️ Attention : l'annulation est "cancel-at-boundary".\nSi une étape est en cours d'exécution, elle se terminera avant que l'annulation ne prenne effet.`)) return;
                setCanceling(true);
                try {
                  await api.post(`/api/missions/${missionId}/transition`, {
                    status: 'CANCELLED',
                    reason: "Annulation demandée par l'utilisateur via le dashboard",
                  });
                  alert(`✅ Annulation enregistrée.\n\nLa mission passera à CANCELLED après la fin de l'étape en cours (le cas échéant).`);
                  fetchMission();
                } catch (err: any) {
                  let msg = err.message || 'Erreur inconnue';
                  if (err.status === 400) msg = `Transition refusée : ${err.message}`;
                  else if (err.status === 404) msg = `Mission introuvable : ${missionId}`;
                  else if (err.status >= 500) msg = `Erreur serveur (HTTP ${err.status}) : ${err.message}`;
                  alert(`❌ Erreur : ${msg}`);
                } finally {
                  setCanceling(false);
                }
              }}
              style={{
                padding: '8px 16px',
                background: 'rgba(var(--r), 0.12)',
                border: '1px solid rgba(var(--r), 0.3)',
                borderRadius: '6px',
                color: '#fff',
                font: '500 11px Oxanium',
                cursor: canceling ? 'wait' : 'pointer',
                opacity: canceling ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span className="ms" style={{ fontSize: '16px' }}>{canceling ? 'hourglass_empty' : 'cancel'}</span>
              {canceling ? 'Annulation...' : 'Annuler la mission'}
            </button>
          )}
          <button
            onClick={() => router.push(`/audit?missionId=${missionId}`)}
            style={{
              padding: '8px 16px',
              background: 'rgba(var(--m), 0.12)',
              border: '1px solid rgba(var(--m), 0.3)',
              borderRadius: '6px',
              color: '#fff',
              font: '500 11px Oxanium',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span className="ms" style={{ fontSize: '16px' }}>sensors</span>
            Voir l'audit
          </button>
        </div>
      </section>

      {/* Informations principales */}
      <section className="p" style={{ '--i': 1 } as any}>
        <h3>
          Contexte de la mission
          <em>{mission.autonomyLevel} · Priorité: {mission.priority}</em>
        </h3>
        <div className="fi">
          <header>
            <span>Objectif</span>
            <em>{mission.approvalRequired ? 'APPROVAL REQUIRED' : 'AUTO'}</em>
          </header>
          <p>{mission.objective}</p>
          <small>
            Budget: {mission.budgetLimitEur}€ · Durée max: {Math.round(mission.maxDurationMs / 60000)} min
          </small>
        </div>

        {mission.description && (
          <div className="fi" style={{ marginTop: '8px' }}>
            <header>
              <span>Description</span>
              <em>INFO</em>
            </header>
            <p>{mission.description}</p>
          </div>
        )}

        {mission.executionContext && (
          <div className="fi" style={{ marginTop: '8px' }}>
            <header>
              <span>Contexte d'exécution</span>
              <em>CTX</em>
            </header>
            {mission.executionContext.projectPath && (
              <small>Projet: {mission.executionContext.projectPath}</small>
            )}
            {mission.executionContext.files && mission.executionContext.files.length > 0 && (
              <small>Fichiers: {mission.executionContext.files.join(', ')}</small>
            )}
            {mission.executionContext.instructions && mission.executionContext.instructions.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                {mission.executionContext.instructions.map((inst, i) => (
                  <small key={i}>• {inst}</small>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Étapes de la mission */}
      <section className="p" style={{ '--i': 2 } as any}>
        <h3>
          Étapes d'exécution
          <em>{mission.steps.length} étapes · {mission.currentStepIndex}/{mission.steps.length}</em>
        </h3>
        {mission.steps.map((step, index) => {
          const isCurrent = index === mission.currentStepIndex;
          const isDone = index < mission.currentStepIndex;
          const stepStatusColor = step.status === 'DONE' ? 'rgb(var(--c))' :
                                  step.status === 'RUNNING' ? 'rgb(var(--m))' :
                                  step.status === 'FAILED' ? 'rgb(var(--r))' :
                                  'rgb(var(--mu))';
          
          return (
            <div
              key={step.id}
              className="fi"
              style={{
                marginTop: index > 0 ? '8px' : '0',
                borderLeft: isCurrent ? '2px solid rgb(var(--m))' : '2px solid transparent',
                paddingLeft: isCurrent ? '12px' : '14px',
                opacity: isDone ? 0.7 : 1,
              }}
            >
              <header>
                <span>Étape {index + 1}: {step.name}</span>
                <em style={{ color: stepStatusColor }}>{step.status}</em>
              </header>
              {step.type && <small>Type: {step.type}</small>}
              {step.startedAt && (
                <small>
                  Début: {new Date(step.startedAt).toLocaleString('fr-FR')}
                  {step.completedAt && ` · Fin: ${new Date(step.completedAt).toLocaleString('fr-FR')}`}
                </small>
              )}
              {step.result && (
                <div style={{ marginTop: '4px' }}>
                  <small>Résultat: {JSON.stringify(step.result).slice(0, 200)}</small>
                </div>
              )}
              {step.error && (
                <div style={{ marginTop: '4px' }}>
                  <small style={{ color: 'rgb(var(--r))' }}>Erreur: {step.error}</small>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Sous-agents affectés */}
      {subagents.length > 0 && (
        <section className="p" style={{ '--i': 3 } as any}>
          <h3>
            Sous-agents affectés
            <em>{subagents.length} agent(s)</em>
          </h3>
          {subagents.map((agent) => (
            <div key={agent.id} className="fi" style={{ marginTop: '8px' }}>
              <header>
                <span>{agent.name}</span>
                <em style={{ color: statusColor(agent.status) }}>{agent.status}</em>
              </header>
              <small>Rôle: {agent.role} · État: {agent.state}</small>
              <small>ID: {agent.id}</small>
            </div>
          ))}
        </section>
      )}

      {/* Résultats */}
      {mission.result && (
        <section className="p" style={{ '--i': 4 } as any}>
          <h3>
            Résultats
            <em style={{ color: mission.result.success ? 'rgb(var(--c))' : 'rgb(var(--r))' }}>
              {mission.result.success ? 'SUCCÈS' : 'ÉCHEC'}
            </em>
          </h3>
          {mission.result.summary && (
            <div className="fi">
              <header>
                <span>Résumé</span>
                <em>SUMMARY</em>
              </header>
              <p>{mission.result.summary}</p>
            </div>
          )}
          {mission.result.artifacts && mission.result.artifacts.length > 0 && (
            <div className="fi" style={{ marginTop: '8px' }}>
              <header>
                <span>Artifacts</span>
                <em>{mission.result.artifacts.length} fichiers</em>
              </header>
              {mission.result.artifacts.map((artifact, i) => (
                <small key={i}>• {artifact}</small>
              ))}
            </div>
          )}
          {mission.result.modifiedFiles && mission.result.modifiedFiles.length > 0 && (
            <div className="fi" style={{ marginTop: '8px' }}>
              <header>
                <span>Fichiers modifiés</span>
                <em>{mission.result.modifiedFiles.length} fichiers</em>
              </header>
              {mission.result.modifiedFiles.map((file, i) => (
                <small key={i}>• {file}</small>
              ))}
            </div>
          )}
          {mission.result.errors && mission.result.errors.length > 0 && (
            <div className="fi" style={{ marginTop: '8px' }}>
              <header>
                <span>Erreurs</span>
                <em style={{ color: 'rgb(var(--r))' }}>{mission.result.errors.length} erreurs</em>
              </header>
              {mission.result.errors.map((err, i) => (
                <small key={i} style={{ color: 'rgb(var(--r))' }}>• {err}</small>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Historique des statuts */}
      {mission.statusHistory && mission.statusHistory.length > 0 && (
        <section className="p" style={{ '--i': 5 } as any}>
          <h3>
            Historique des transitions
            <em>{mission.statusHistory.length} événements</em>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {mission.statusHistory.map((evt, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  background: 'rgba(var(--c), 0.05)',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                <span style={{ color: 'rgb(var(--m))', opacity: 0.7, minWidth: '60px' }}>
                  {new Date(evt.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span style={{ color: 'rgb(var(--c))', fontWeight: 600, minWidth: '120px' }}>
                  {evt.status}
                </span>
                <span style={{ color: 'var(--mu)', opacity: 0.6, flex: 1 }}>
                  {evt.reason}
                </span>
                {evt.actor && (
                  <span style={{ color: 'var(--mu)', opacity: 0.4, fontSize: '9px' }}>
                    [{evt.actor}]
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Timeline Audit (5 derniers événements) */}
      <section className="p" style={{ '--i': 6 } as any}>
        <h3>
          Timeline Audit
          <em>{history.length} événements</em>
        </h3>
        {history.length === 0 ? (
          <div className="fi">
            <header>
              <span>Aucun événement</span>
              <em>VIDE</em>
            </header>
            <p>Aucun événement d'audit enregistré pour cette mission.</p>
          </div>
        ) : (
          <div className="feed" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {history.slice(-5).reverse().map((evt) => (
              <div key={evt.id} className="fi" style={{ padding: '4px 8px' }}>
                <header>
                  <span>{evt.type}</span>
                  <em>
                    {new Date(evt.timestamp).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </em>
                </header>
                {evt.actor && <small>Acteur: {evt.actor}</small>}
                {evt.data && (
                  <small className="mono" style={{ fontSize: '9px' }}>
                    {JSON.stringify(evt.data).slice(0, 120)}
                    {JSON.stringify(evt.data).length > 120 ? '…' : ''}
                  </small>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
