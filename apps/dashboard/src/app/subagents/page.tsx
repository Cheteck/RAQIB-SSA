'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface Mission {
  id: string;
  name: string;
  status: string;
}

interface Subagent {
  id: string;
  name: string;
  role: 'executor' | 'researcher' | 'verifier';
  missionId: string;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'FAILED';
  stepsExecuted: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  IDLE: 'rgb(var(--mu))',
  RUNNING: 'rgb(var(--m))',
  COMPLETED: 'rgb(var(--c))',
  BLOCKED: 'rgb(var(--g))',
  FAILED: 'rgb(var(--r))',
};

const ROLES: Array<{ value: Subagent['role']; label: string }> = [
  { value: 'executor', label: 'Exécuteur' },
  { value: 'researcher', label: 'Chercheur' },
  { value: 'verifier', label: 'Vérificateur' },
];

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR');
  } catch {
    return iso;
  }
}

export default function SubagentsPage() {
  const [subagents, setSubagents] = useState<Subagent[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState<Subagent['role']>('executor');
  const [missionId, setMissionId] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subagentData, missionData] = await Promise.all([
        api.get<{ subagents: Subagent[] }>('/api/subagents'),
        api.get<{ missions: Mission[] }>('/api/missions'),
      ]);
      setSubagents(subagentData.subagents || []);
      setMissions(missionData.missions || []);
    } catch (err: any) {
      setSubagents([]);
      setMissions([]);
      setError(err?.message || 'Runtime injoignable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Le nom du sous-agent est requis.');
      return;
    }
    if (!missionId) {
      setFormError('Sélectionnez une mission à exécuter.');
      return;
    }
    setCreating(true);
    try {
      await api.post<{ subagent: Subagent }>('/api/subagents', {
        name: name.trim(),
        role,
        missionId,
      });
      setName('');
      setRole('executor');
      await load();
    } catch (err: any) {
      setFormError(err?.message || 'Création impossible');
    } finally {
      setCreating(false);
    }
  };

  const run = async (id: string) => {
    setRunningId(id);
    setError(null);
    try {
      await api.post<{ subagent: Subagent }>(`/api/subagents/${encodeURIComponent(id)}/run`, {});
      await load();
    } catch (err: any) {
      setError(err?.message || 'Exécution impossible');
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="workspace-content">
      <section className="p" style={{ '--i': 0 } as any}>
        <h3>
          Sous-agents
          <em>{loading ? '…' : error ? 'ERREUR' : `${subagents.length} sous-agent(s)`}</em>
        </h3>

        <p className="mono" style={{ marginBottom: '0.75rem' }}>
          Un sous-agent exécute la mission assignée étape par étape via le MissionEngine.
          Il est soumis au PolicyEngine, aux budgets et à l&apos;audit, et ne déclare jamais
          un succès à la place du VerificationEngine.
        </p>

        <form
          onSubmit={create}
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            marginBottom: '1rem',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <small className="mono">Nom</small>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Exécuteur audit"
              aria-label="Nom du sous-agent"
              style={{ padding: '0.4rem 0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <small className="mono">Rôle</small>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Subagent['role'])}
              aria-label="Rôle du sous-agent"
              style={{ padding: '0.4rem 0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit' }}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '260px' }}>
            <small className="mono">Mission</small>
            <select
              value={missionId}
              onChange={(e) => setMissionId(e.target.value)}
              aria-label="Mission assignée"
              style={{ padding: '0.4rem 0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit' }}
            >
              <option value="">Sélectionner une mission…</option>
              {missions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  [{mission.status}] {mission.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="bf" disabled={creating || missions.length === 0}>
            <span className="ms">smart_toy</span>
            <span>{creating ? 'Création…' : 'Créer le sous-agent'}</span>
          </button>
        </form>

        {formError && <small style={{ color: 'rgb(var(--r))' }}>⚠ {formError}</small>}

        {loading && <p className="mono" aria-live="polite">Chargement des sous-agents…</p>}

        {!loading && error && (
          <div className="fi w">
            <header><span>Erreur</span><em>ERR</em></header>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && subagents.length === 0 && (
          <div className="fi">
            <header><span>Aucun sous-agent</span><em>VIDE</em></header>
            <p>Créez un sous-agent et assignez-lui une mission pour qu&apos;il l&apos;exécute.</p>
            <small>Les créations et exécutions sont journalisées (SUBAGENT_*).</small>
          </div>
        )}

        {!loading && subagents.length > 0 && (
          <div className="feed">
            {subagents.map((subagent) => (
              <div key={subagent.id} className="fi">
                <header>
                  <span>{subagent.name} · {subagent.role}</span>
                  <em style={{ color: STATUS_COLORS[subagent.status] ?? 'var(--mu)' }}>
                    {subagent.status}
                  </em>
                </header>
                <p className="mono">Mission : {subagent.missionId}</p>
                <small>
                  {subagent.stepsExecuted} étape(s) exécutée(s) · démarré {formatDate(subagent.startedAt)} ·
                  terminé {formatDate(subagent.completedAt)}
                </small>
                {subagent.lastError && (
                  <small style={{ color: 'rgb(var(--g))', display: 'block' }}>
                    ⚠ {subagent.lastError}
                  </small>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => run(subagent.id)}
                    disabled={runningId === subagent.id || subagent.status === 'RUNNING'}
                  >
                    {runningId === subagent.id ? 'Exécution en cours…' : 'Exécuter la mission'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
