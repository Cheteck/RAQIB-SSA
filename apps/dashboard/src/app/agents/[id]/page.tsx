'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

interface MissionRef {
  id: string;
  name: string;
  status: string;
}

interface ExecutionContext {
  projectPath?: string;
  files?: string[];
  instructions?: string[];
  constraints?: string[];
  inheritedContext?: string;
}

interface ContextEntry {
  version: number;
  timestamp: string;
  updatedBy: string;
  note?: string;
  patch?: ExecutionContext;
}

interface StatusEntry {
  status: string;
  timestamp: string;
  reason: string;
  actor: string;
}

interface MissionResultView {
  summary?: string;
  success?: boolean;
  artifacts?: string[];
  reports?: string[];
  modifiedFiles?: string[];
  errors?: string[];
}

interface MissionDetail {
  id: string;
  name: string;
  title?: string;
  status: string;
  priority?: string;
  objective: string;
  currentStepIndex: number;
  steps: Array<{ name: string; status: string; error?: string }>;
  executionContext?: ExecutionContext;
  contextLog?: ContextEntry[];
  statusHistory?: StatusEntry[];
  result?: MissionResultView;
  assignedSubagentId?: string;
  assignedAt?: string;
  assignedBy?: string;
}

interface Subagent {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  instructions?: string;
  missionId: string;
  status: string;
  state: string;
  mission?: MissionRef | null;
  stepsExecuted: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

interface HistoryEntry {
  id: string;
  missionId: string;
  missionName?: string;
  missionStatus?: string;
  assignedAt: string;
  unassignedAt?: string;
  assignedBy?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  title: string;
  scope: string;
  agentId?: string;
  missionId?: string;
  messages: ChatMessage[];
}

const STATE_COLORS: Record<string, string> = {
  available: 'rgb(var(--c))',
  busy: 'rgb(var(--m))',
  inactive: 'rgb(var(--mu))',
  error: 'rgb(var(--r))',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR');
  } catch {
    return iso;
  }
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id ?? '');

  const [agent, setAgent] = useState<Subagent | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [missions, setMissions] = useState<MissionDetail[]>([]);
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [allMissions, setAllMissions] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignTarget, setAssignTarget] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await api.get<{
        subagent: Subagent;
        history: HistoryEntry[];
        missions: MissionDetail[];
        conversationId: string;
      }>(`/api/subagents/${encodeURIComponent(id)}`);
      setAgent(detail.subagent);
      setHistory(detail.history || []);
      setMissions(detail.missions || []);
      setMission(detail.missions?.[0] ?? null);
      setAssignTarget(detail.subagent.missionId || '');

      const [conv, missionList] = await Promise.all([
        api.get<{ conversation: ConversationDetail | null }>(
          `/api/subagents/${encodeURIComponent(id)}/conversation`,
        ),
        api.get<{ missions: Array<{ id: string; name: string; status: string }> }>('/api/missions'),
      ]);
      setConversation(conv.conversation);
      setAllMissions(missionList.missions || []);
    } catch (err: any) {
      setError(err?.message || 'Agent introuvable');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  const assign = async () => {
    if (!assignTarget) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/subagents/${encodeURIComponent(id)}/assign`, {
        missionId: assignTarget,
        assignedBy: 'operator',
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Affectation impossible');
    } finally {
      setBusy(false);
    }
  };

  const unassign = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/subagents/${encodeURIComponent(id)}/unassign`, {
        reason: 'Désattribution depuis la fiche agent',
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Désattribution impossible');
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/subagents/${encodeURIComponent(id)}/run`, {});
      await load();
    } catch (err: any) {
      setError(err?.message || 'Exécution impossible');
    } finally {
      setBusy(false);
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/api/subagents/${encodeURIComponent(id)}/chat`, { prompt });
      setChatInput('');
      const conv = await api.get<{ conversation: ConversationDetail | null }>(
        `/api/subagents/${encodeURIComponent(id)}/conversation`,
      );
      setConversation(conv.conversation);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      setError(err?.message || 'Envoi impossible');
    } finally {
      setSending(false);
    }
  };

  const selectMission = async (missionId: string) => {
    const found = missions.find((m) => m.id === missionId);
    if (found) {
      setMission(found);
      return;
    }
    try {
      const data = await api.get<{ mission: MissionDetail }>(
        `/api/missions/${encodeURIComponent(missionId)}`,
      );
      setMission(data.mission);
    } catch {}
  };

  return (
    <div className="workspace-content">
      <section className="p" style={{ '--i': 0 } as any}>
        <h3>
          {agent ? `Agent · ${agent.name}` : 'Agent'}
          <em>{loading ? '…' : error ? 'ERREUR' : agent?.state?.toUpperCase() ?? ''}</em>
        </h3>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button type="button" className="bf" onClick={() => router.push('/agents')}>
            <span className="ms">arrow_back</span>
            <span>Console Agents</span>
          </button>
          <button type="button" className="bf" onClick={load} disabled={loading}>
            <span className="ms">refresh</span>
            <span>Actualiser</span>
          </button>
        </div>

        {loading && <p className="mono" aria-live="polite">Chargement de l’agent…</p>}

        {!loading && error && (
          <div className="fi w">
            <header><span>Erreur</span><em>ERR</em></header>
            <p>{error}</p>
          </div>
        )}

        {!loading && agent && (
          <>
            <div className="fi">
              <header>
                <span>{agent.name} · {agent.role}</span>
                <em style={{ color: STATE_COLORS[agent.state] ?? 'var(--mu)' }}>{agent.state}</em>
              </header>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <small className="mono">ID {agent.id}</small>
                <small className="mono">Statut {agent.status}</small>
                <small className="mono">{agent.stepsExecuted} étape(s)</small>
                <small className="mono">Créé {formatDate(agent.createdAt)}</small>
              </div>
              {agent.specialty && <p>Spécialité : {agent.specialty}</p>}
              {agent.instructions && <p>Instructions permanentes : {agent.instructions}</p>}
              {agent.lastError && (
                <small style={{ color: 'rgb(var(--r))', display: 'block' }}>⚠ {agent.lastError}</small>
              )}
            </div>

            <div className="fi" style={{ marginTop: '1rem' }}>
              <header>
                <span>Affectation de mission</span>
                <em>{agent.missionId ? 'AFFECTÉ' : 'LIBRE'}</em>
              </header>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={assignTarget}
                  onChange={(e) => setAssignTarget(e.target.value)}
                  aria-label="Mission à affecter"
                  style={{ padding: '0.4rem 0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit', minWidth: '260px' }}
                >
                  <option value="">Sélectionner une mission…</option>
                  {allMissions.map((m) => (
                    <option key={m.id} value={m.id}>[{m.status}] {m.name}</option>
                  ))}
                </select>
                <button type="button" onClick={assign} disabled={busy || !assignTarget}>
                  {agent.missionId ? 'Réattribuer' : 'Attribuer'}
                </button>
                {agent.missionId && (
                  <button type="button" onClick={unassign} disabled={busy}>Désattribuer</button>
                )}
                <button type="button" onClick={run} disabled={busy || !agent.missionId || agent.status === 'RUNNING'}>
                  {busy ? 'Traitement…' : 'Exécuter la mission'}
                </button>
              </div>
            </div>

            <div className="fi" style={{ marginTop: '1rem' }}>
              <header>
                <span>Missions de l’agent</span>
                <em>{missions.length}</em>
              </header>
              {missions.length === 0 && <small>Aucune mission actuellement affectée.</small>}
              {missions.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {missions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectMission(m.id)}
                      style={{
                        border: `1px solid ${mission?.id === m.id ? 'rgba(var(--c),0.7)' : 'rgba(255,255,255,0.12)'}`,
                        background: mission?.id === m.id ? 'rgba(var(--c),0.12)' : 'none',
                        color: 'inherit',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      [{m.status}] {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mission && (
              <div className="fi" style={{ marginTop: '1rem' }}>
                <header>
                  <span>Mission · {mission.name}</span>
                  <em>{mission.status}</em>
                </header>
                <p>{mission.objective}</p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <small className="mono">Priorité {mission.priority ?? 'MEDIUM'}</small>
                  <small className="mono">
                    Progression {mission.currentStepIndex}/{mission.steps.length}
                  </small>
                  <small className="mono">Affectée {formatDate(mission.assignedAt)}</small>
                </div>

                <h4 style={{ marginTop: '0.8rem' }}>Contexte d’exécution</h4>
                {mission.executionContext ? (
                  <div style={{ display: 'grid', gap: '0.3rem' }}>
                    <small className="mono">
                      Projet : {mission.executionContext.projectPath || '—'}
                    </small>
                    <small className="mono">
                      Fichiers : {(mission.executionContext.files ?? []).join(', ') || '—'}
                    </small>
                    <small className="mono">
                      Contraintes : {(mission.executionContext.constraints ?? []).join(' · ') || '—'}
                    </small>
                    {(mission.executionContext.instructions ?? []).length > 0 && (
                      <div>
                        <small className="mono">Instructions :</small>
                        <ul style={{ margin: '0.2rem 0 0 1rem' }}>
                          {(mission.executionContext.instructions ?? []).map((instruction, index) => (
                            <li key={index}><small>{instruction}</small></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {mission.executionContext.inheritedContext && (
                      <small style={{ whiteSpace: 'pre-wrap', color: 'var(--mu)' }}>
                        Contexte hérité : {mission.executionContext.inheritedContext}
                      </small>
                    )}
                  </div>
                ) : (
                  <small>Aucun contexte structuré.</small>
                )}

                {(mission.contextLog ?? []).length > 0 && (
                  <>
                    <h4 style={{ marginTop: '0.8rem' }}>Journal de contexte (append-only)</h4>
                    <ul style={{ margin: '0.2rem 0 0 1rem' }}>
                      {(mission.contextLog ?? []).map((entry) => (
                        <li key={`${entry.version}-${entry.timestamp}`}>
                          <small>
                            v{entry.version} · {formatDate(entry.timestamp)} · {entry.updatedBy}
                            {entry.note ? ` · ${entry.note}` : ''}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {mission.steps.length > 0 && (
                  <>
                    <h4 style={{ marginTop: '0.8rem' }}>Étapes</h4>
                    <ul style={{ margin: '0.2rem 0 0 1rem' }}>
                      {mission.steps.map((step, index) => (
                        <li key={`${step.name}-${index}`}>
                          <small>[{step.status}] {step.name}{step.error ? ` — ${step.error}` : ''}</small>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {mission.result && (
                  <>
                    <h4 style={{ marginTop: '0.8rem' }}>Résultats remontés</h4>
                    <p>{mission.result.summary ?? '—'}</p>
                    {(mission.result.modifiedFiles ?? []).length > 0 && (
                      <small className="mono" style={{ display: 'block' }}>
                        Fichiers modifiés : {(mission.result.modifiedFiles ?? []).join(', ')}
                      </small>
                    )}
                    {(mission.result.reports ?? []).length > 0 && (
                      <small className="mono" style={{ display: 'block' }}>
                        Rapports : {(mission.result.reports ?? []).join(' · ')}
                      </small>
                    )}
                    {(mission.result.errors ?? []).length > 0 && (
                      <small style={{ color: 'rgb(var(--r))', display: 'block' }}>
                        Erreurs : {(mission.result.errors ?? []).join(' · ')}
                      </small>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="fi" style={{ marginTop: '1rem' }}>
              <header>
                <span>Historique des missions</span>
                <em>{history.length}</em>
              </header>
              {history.length === 0 && <small>Aucune affectation enregistrée.</small>}
              {history.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {history.map((entry) => (
                    <div key={entry.id} style={{ borderLeft: '2px solid rgba(var(--c),0.5)', paddingLeft: '0.6rem' }}>
                      <small className="mono">
                        [{entry.missionStatus ?? '?'}] {entry.missionName ?? entry.missionId}
                      </small>
                      <small style={{ display: 'block', color: 'var(--mu)' }}>
                        Affectée {formatDate(entry.assignedAt)}
                        {entry.unassignedAt ? ` · clôturée ${formatDate(entry.unassignedAt)}` : ' · en cours'}
                        {entry.assignedBy ? ` · par ${entry.assignedBy}` : ''}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div id="chat" className="fi" style={{ marginTop: '1rem' }}>
              <header>
                <span>Conversation dédiée · {agent.name}</span>
                <em>{conversation?.scope === 'agent' ? 'ISOLÉE' : '…'}</em>
              </header>
              <p className="mono">
                Cette conversation est indépendante du chat principal RAQIB. Elle est persistée
                avec <code>scope=agent</code> et <code>agent_id={agent.id}</code>.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '360px',
                  overflowY: 'auto',
                  padding: '0.5rem',
                  border: '1px solid rgba(var(--c),0.18)',
                  background: 'rgba(5,10,18,0.5)',
                }}
              >
                {(!conversation || conversation.messages.length === 0) && (
                  <small>Aucun message. Adressez une instruction à l’agent ci-dessous.</small>
                )}
                {(conversation?.messages ?? []).map((message) => (
                  <div
                    key={message.id}
                    style={{
                      borderLeft: `2px solid ${message.role === 'user' ? 'rgb(var(--c))' : 'rgb(var(--m))'}`,
                      paddingLeft: '0.6rem',
                    }}
                  >
                    <small className="mono">
                      {message.role === 'user' ? 'OPÉRATEUR' : agent.name.toUpperCase()}
                      {message.model ? ` · ${message.model}` : ''} · {formatDate(message.createdAt)}
                    </small>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={send} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Instruction pour ${agent.name}…`}
                  aria-label="Message à l’agent"
                  style={{ flex: 1, padding: '0.5rem', background: 'rgba(5,10,18,0.82)', border: '1px solid rgba(var(--c),0.4)', color: 'inherit' }}
                />
                <button type="submit" className="bf" disabled={sending || !chatInput.trim()}>
                  <span className="ms">send</span>
                  <span>{sending ? 'Envoi…' : 'Envoyer'}</span>
                </button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
