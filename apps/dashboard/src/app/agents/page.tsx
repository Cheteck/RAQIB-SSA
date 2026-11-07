'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

interface MissionRef {
  id: string;
  name: string;
  status: string;
}

interface Subagent {
  id: string;
  name: string;
  role: 'executor' | 'researcher' | 'verifier';
  specialty?: string;
  instructions?: string;
  missionId: string;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'FAILED';
  state: 'available' | 'busy' | 'inactive' | 'error';
  mission?: MissionRef | null;
  stepsExecuted: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface Mission {
  id: string;
  name: string;
  status: string;
  priority?: string;
  assignedSubagentId?: string;
}

const STATE_COLORS: Record<string, string> = {
  available: 'rgb(var(--c))',
  busy: 'rgb(var(--m))',
  inactive: 'rgb(var(--mu))',
  error: 'rgb(var(--r))',
};

const STATE_LABELS: Record<string, string> = {
  available: 'DISPONIBLE',
  busy: 'OCCUPÉ',
  inactive: 'INACTIF',
  error: 'ERREUR',
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

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Subagent[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>('all');

  const [name, setName] = useState('');
  const [role, setRole] = useState<Subagent['role']>('executor');
  const [specialty, setSpecialty] = useState('');
  const [instructions, setInstructions] = useState('');
  const [missionId, setMissionId] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentData, missionData] = await Promise.all([
        api.get<{ subagents: Subagent[] }>('/api/subagents'),
        api.get<{ missions: Mission[] }>('/api/missions'),
      ]);
      setAgents(agentData.subagents || []);
      setMissions(missionData.missions || []);
    } catch (err: any) {
      setAgents([]);
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
      setFormError('Le nom de l’agent est requis.');
      return;
    }
    setCreating(true);
    try {
      await api.post<{ subagent: Subagent }>('/api/subagents', {
        name: name.trim(),
        role,
        specialty: specialty.trim() || undefined,
        instructions: instructions.trim() || undefined,
        missionId: missionId || undefined,
      });
      setName('');
      setRole('executor');
      setSpecialty('');
      setInstructions('');
      setMissionId('');
      await load();
    } catch (err: any) {
      setFormError(err?.message || 'Création impossible');
    } finally {
      setCreating(false);
    }
  };

  const run = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/api/subagents/${encodeURIComponent(id)}/run`, {});
      await load();
    } catch (err: any) {
      setError(err?.message || 'Exécution impossible');
    } finally {
      setBusyId(null);
    }
  };

  const unassign = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/api/subagents/${encodeURIComponent(id)}/unassign`, {
        reason: 'Désattribution depuis la console Agents',
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Désattribution impossible');
    } finally {
      setBusyId(null);
    }
  };

  const visible = stateFilter === 'all'
    ? agents
    : agents.filter((agent) => agent.state === stateFilter);

  const counts = {
    available: agents.filter((a) => a.state === 'available').length,
    busy: agents.filter((a) => a.state === 'busy').length,
    inactive: agents.filter((a) => a.state === 'inactive').length,
    error: agents.filter((a) => a.state === 'error').length,
  };

  const assignableMissions = missions.filter(
    (mission) => !mission.assignedSubagentId || agents.some((a) => a.missionId === mission.id),
  );

  return (
    <div className="workspace-content">
      <section className="p" style={{ '--i': 0 } as any}>
        <h3>
          Agents · Supervision des sous-agents
          <em>{loading ? '…' : error ? 'ERREUR' : `${agents.length} agent(s)`}</em>
        </h3>

        <p className="mono" style={{ marginBottom: '0.75rem' }}>
          Chaque agent est une unité d’exécution gouvernée : spécialité, mission affectée,
          contexte d’exécution et conversation dédiée. Le chat principal RAQIB reste séparé.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {(['all', 'available', 'busy', 'inactive', 'error'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStateFilter(value)}
              style={{
                border: `1px solid ${stateFilter === value ? 'rgba(var(--c),0.65)' : 'rgba(255,255,255,0.12)'}`,
                background: stateFilter === value ? 'rgba(var(--c),0.12)' : 'none',
                color: stateFilter === value ? '#fff' : 'var(--mu)',
                borderRadius: '99px',
                padding: '0.2rem 0.7rem',
                cursor: 'pointer',
              }}
            >
              {value === 'all' ? `Tous (${agents.length})` : `${STATE_LABELS[value]} (${counts[value]})`}
            </button>
          ))}
          <button type="button" className="bf" onClick={load} disabled={loading}>
            <span className="ms">refresh</span>
            <span>Actualiser</span>
          </button>
        </div>

        <form
          onSubmit={create}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.5rem',
            alignItems: 'end',
            marginBottom: '1rem',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <small className="mono">Nom</small>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Analyste dépendances"
              aria-label="Nom de l’agent"
              style={{ padding: '0.4rem 0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <small className="mono">Rôle</small>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Subagent['role'])}
              aria-label="Rôle de l’agent"
              style={{ padding: '0.4rem 0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit' }}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <small className="mono">Spécialité</small>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ex. audit sécurité"
              aria-label="Spécialité de l’agent"
              style={{ padding: '0.4rem 0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <small className="mono">Mission (optionnelle)</small>
            <select
              value={missionId}
              onChange={(e) => setMissionId(e.target.value)}
              aria-label="Mission affectée"
              style={{ padding: '0.4rem 0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit' }}
            >
              <option value="">Aucune mission</option>
              {assignableMissions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  [{mission.status}] {mission.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
            <small className="mono">Instructions permanentes (optionnel)</small>
            <input
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ex. Toujours citer les fichiers audités"
              aria-label="Instructions permanentes de l’agent"
              style={{ padding: '0.4rem 0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit' }}
            />
          </label>
          <button type="submit" className="bf" disabled={creating}>
            <span className="ms">smart_toy</span>
            <span>{creating ? 'Création…' : 'Créer l’agent'}</span>
          </button>
        </form>

        {formError && <small style={{ color: 'rgb(var(--r))' }}>⚠ {formError}</small>}

        {loading && <p className="mono" aria-live="polite">Chargement des agents…</p>}

        {!loading && error && (
          <div className="fi w">
            <header><span>Erreur</span><em>ERR</em></header>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="fi">
            <header><span>Aucun agent</span><em>VIDE</em></header>
            <p>Créez un agent, affectez-lui une mission contextualisée puis ouvrez sa fiche.</p>
            <small>Les affectations, contextes et résultats sont journalisés.</small>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="feed">
            {visible.map((agent) => (
              <div key={agent.id} className="fi">
                <header>
                  <span>
                    {agent.name} · {agent.role}
                    {agent.specialty ? ` · ${agent.specialty}` : ''}
                  </span>
                  <em style={{ color: STATE_COLORS[agent.state] ?? 'var(--mu)' }}>
                    {STATE_LABELS[agent.state] ?? agent.state}
                  </em>
                </header>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <small className="mono">ID {agent.id.slice(0, 8)}</small>
                  <small className="mono">Statut {agent.status}</small>
                  <small className="mono">{agent.stepsExecuted} étape(s)</small>
                  <small className="mono">Maj {formatDate(agent.updatedAt)}</small>
                </div>

                <p className="mono" style={{ marginTop: '0.4rem' }}>
                  Mission : {agent.mission
                    ? `[${agent.mission.status}] ${agent.mission.name} (${agent.mission.id})`
                    : 'aucune mission affectée'}
                </p>

                {agent.instructions && (
                  <small style={{ display: 'block', color: 'var(--mu)' }}>
                    Instructions : {agent.instructions}
                  </small>
                )}

                {agent.lastError && (
                  <small style={{ color: 'rgb(var(--r))', display: 'block' }}>
                    ⚠ {agent.lastError}
                  </small>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => router.push(`/agents/${agent.id}`)}>
                    Ouvrir la fiche
                  </button>
                  <button type="button" onClick={() => router.push(`/agents/${agent.id}#chat`)}>
                    Conversation
                  </button>
                  <button
                    type="button"
                    onClick={() => run(agent.id)}
                    disabled={busyId === agent.id || agent.status === 'RUNNING' || !agent.missionId}
                  >
                    {busyId === agent.id ? 'Exécution…' : 'Exécuter la mission'}
                  </button>
                  {agent.missionId && (
                    <button type="button" onClick={() => unassign(agent.id)} disabled={busyId === agent.id}>
                      Désassigner
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
