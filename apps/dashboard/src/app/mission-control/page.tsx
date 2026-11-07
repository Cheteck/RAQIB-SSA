'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, ApiError } from '../../lib/api';
import { Mission, Subagent, SubagentMissionHistoryEntry, AuditEvent, MissionStepInfo } from '../../types/missionControl';
import {
  MISSION_STATUS_COLORS,
  AGENT_STATUS_COLORS,
  missionColor,
  agentColor,
  ROLE_ICONS,
  ROLE_LABELS,
  missionRank,
  stepVisual,
  isStepDone,
} from '../../lib/statusColors';

// ── Indicateurs Runtime ───────────────────────────────────────────
interface RuntimeStatus {
  status: string;
  emergencyStop: boolean;
  readOnlyMode: boolean;
  timestamp: string;
}

interface CounterCardProps {
  label: string;
  value: number | string;
  color?: string;
  icon?: string;
  sub?: string;
}

function CounterCard({ label, value, color = 'rgb(var(--tx))', icon, sub }: CounterCardProps) {
  return (
    <div className="fi" style={{
      padding: '10px 12px',
      background: 'linear-gradient(160deg, rgba(14,26,40,0.5), rgba(5,10,18,0.7))',
      border: '1px solid rgba(var(--c), 0.12)',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: '140px',
    }}>
      {icon && <span className="ms" style={{ fontSize: '18px', color }}>{icon}</span>}
      <div>
        <div style={{ font: '600 18px Oxanium', color, letterSpacing: '0.08em' }}>{value}</div>
        <div style={{ font: '400 9px "JetBrains Mono"', color: 'var(--mu)' }}>{label}</div>
      </div>
      {sub && <small style={{ marginLeft: 'auto', opacity: 0.7 }}>{sub}</small>}
    </div>
  );
}

// ── Carte Mission ────────────────────────────────────────────────
interface MissionCardProps {
  mission: Mission;
  agents: Subagent[];
  isSelected: boolean;
  onSelect: (id: string) => void;
  onSelectAgent?: (agentId: string) => void;
  onAssignAgent: (agentId: string, missionId: string) => void;
  onUnassignAgent: (agentId: string) => void;
  availableAgents: Subagent[];
}

function MissionCard({ mission, agents, isSelected, onSelect, onSelectAgent, onAssignAgent, onUnassignAgent, availableAgents }: MissionCardProps) {
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const reportError = (err: unknown) => {
    const e = err as { status?: number; message?: string };
    const status = e?.status;
    let label = 'Erreur';
    if (status === 400) label = `400 — Rejetée par le Runtime : ${e?.message || 'règle métier non satisfait'}`;
    else if (status === 404) label = '404 — Ressource introuvable (agent ou mission)';
    else if (status && status >= 500) label = `HTTP ${status} — Erreur interne du Runtime`;
    else label = e?.message || 'Erreur de connexion';
    setActionError(label);
    setTimeout(() => setActionError(null), 6000);
  };

  const budgetPct = mission.budgetLimitEur > 0
    ? Math.min(100, (mission.budgetUsedEur / mission.budgetLimitEur) * 100)
    : 0;
  const isCritical = budgetPct > 80;
  const isWarning = budgetPct > 50 && budgetPct <= 80;

  const handleAssign = async () => {
    if (!selectedAgent || assigning) return;
    setAssigning(true);
    setActionError(null);
    try {
      await api.post(`/api/subagents/${selectedAgent}/assign`, { missionId: mission.id, assignedBy: 'operator' });
      onAssignAgent(selectedAgent, mission.id);
      setShowAssign(false);
      setSelectedAgent('');
    } catch (err) {
      reportError(err);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (agentId: string) => {
    if (assigning) return;
    setAssigning(true);
    setActionError(null);
    try {
      await api.post(`/api/subagents/${agentId}/unassign`, { reason: 'Désattribution manuelle' });
      onUnassignAgent(agentId);
    } catch (err) {
      reportError(err);
    } finally {
      setAssigning(false);
    }
  };

  const statusColor = missionColor(mission.status);

  return (
    <article
      className="mission-card fi"
      tabIndex={0}
      role="article"
      aria-labelledby={`mission-${mission.id}`}
      aria-selected={isSelected}
      onClick={() => onSelect(mission.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(mission.id);
        }
      }}
      style={{
        borderColor: isSelected ? 'rgba(var(--c), 0.6)' : 'rgba(var(--c), 0.15)',
        background: isSelected ? 'rgba(var(--c), 0.08)' : undefined,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {actionError && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '6px 8px',
            marginBottom: '8px',
            background: 'rgba(var(--r), 0.08)',
            border: '1px solid rgba(var(--r), 0.3)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            fontFamily: '"JetBrains Mono", monospace',
            color: 'rgb(var(--r))',
          }}
        >
          <span className="ms" style={{ fontSize: '12px', flexShrink: 0 }}>error</span>
          {actionError}
        </div>
      )}
      <header className="mission-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
        <div>
          <span id={`mission-${mission.id}`} className="mission-card__id" style={{ font: '400 9px "JetBrains Mono"', color: 'var(--mu)', display: 'block', marginBottom: '2px' }}>
            {mission.id.slice(0, 8)}…
          </span>
          <h4 className="mission-card__name" style={{ font: '600 13px Oxanium', color: '#fff', margin: 0 }}>{mission.name}</h4>
        </div>
        <span
          className="mission-card__status"
          style={{
            color: statusColor,
            font: '600 10px "JetBrains Mono"',
            padding: '2px 6px',
            border: `1px solid ${statusColor}`,
            borderRadius: '4px',
            background: `${statusColor}15`,
          }}
          role="status"
        >
          {mission.status}
        </span>
      </header>

      <p className="mission-card__objective" style={{ font: '400 11.5px Geist', color: 'var(--tx)', marginBottom: '10px', lineHeight: 1.4 }}>
        {mission.objective}
      </p>

      {/* Budget */}
      <div className="mission-budget" role="group" aria-label={`Budget: ${Math.round(budgetPct)}% utilisé`} style={{ marginBottom: '10px' }}>
        <div
          className="mission-budget__bar"
          style={{
            width: `${budgetPct}%`,
            background: isCritical ? 'rgb(var(--r))' : isWarning ? 'rgb(var(--g))' : 'rgb(var(--m))',
            boxShadow: isCritical ? '0 0 12px rgba(var(--r), 0.6)' : 'none',
            height: '6px',
            borderRadius: '3px',
            transition: 'width 0.3s',
          }}
          role="progressbar"
          aria-valuenow={Math.round(budgetPct)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
        <span className="mission-budget__label" style={{ font: '400 9px "JetBrains Mono"', color: 'var(--mu)', display: 'block', marginTop: '4px' }}>
          {mission.budgetUsedEur.toFixed(2)}€ / {mission.budgetLimitEur.toFixed(2)}€ ({Math.round(budgetPct)}%)
        </span>
      </div>

      {/* Steps */}
      {mission.steps && mission.steps.length > 0 && (
        <div className="mission-steps" style={{ marginBottom: '10px' }}>
          <div style={{ font: '600 9px Oxanium', color: 'var(--mu)', marginBottom: '4px', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between' }}>
            <span>ÉTAPES</span>
            <span style={{ color: 'var(--mu)' }}>
              {mission.steps.filter((s) => isStepDone(s.status)).length}/{mission.steps.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {mission.steps.slice(0, 4).map((step, idx) => {
              const v = stepVisual(step.status);
              return (
                <div
                  key={idx}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '400 10px Geist', color: isStepDone(step.status) ? 'var(--tx)' : 'var(--mu)' }}
                  title={`${step.name} — ${v.label}`}
                >
                  <span className="ms" style={{ fontSize: '12px', color: v.color }}>{v.icon}</span>
                  <span>{step.name}</span>
                </div>
              );
            })}
            {mission.steps.length > 4 && (
              <small style={{ font: '400 9px "JetBrains Mono"', color: 'var(--mu)', marginTop: '2px' }}>
                +{mission.steps.length - 4} autres
              </small>
            )}
          </div>
        </div>
      )}

      {/* Agents attachés */}
      <div className="mission-agents" style={{ marginBottom: '10px' }}>
        <div style={{ font: '600 9px Oxanium', color: 'var(--mu)', marginBottom: '6px', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>SOUS-AGENTS</span>
          {availableAgents.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAssign(!showAssign); }}
              style={{
                font: '600 9px Oxanium',
                color: 'rgb(var(--c))',
                background: 'rgba(var(--c), 0.1)',
                border: '1px solid rgba(var(--c), 0.3)',
                borderRadius: '4px',
                padding: '2px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Assigner un agent à cette mission"
            >
              <span className="ms" style={{ fontSize: '12px' }}>add</span>
              AGENT
            </button>
          )}
        </div>

        {showAssign && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(14,26,40,0.9)',
              border: '1px solid rgba(var(--c), 0.3)',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '8px',
            }}
          >
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'rgba(5,10,18,0.8)',
                border: '1px solid rgba(var(--c), 0.2)',
                borderRadius: '4px',
                color: 'var(--tx)',
                font: '400 11px Geist',
                marginBottom: '6px',
                cursor: 'pointer',
              }}
            >
              <option value="">Sélectionner un agent disponible…</option>
              {availableAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({ROLE_LABELS[a.role] || a.role})</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleAssign}
                disabled={!selectedAgent || assigning}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  background: selectedAgent ? 'rgba(var(--c), 0.2)' : 'rgba(127,149,166,0.2)',
                  border: 'none',
                  borderRadius: '4px',
                  color: selectedAgent ? '#fff' : 'var(--mu)',
                  font: '600 10px Oxanium',
                  cursor: selectedAgent ? 'pointer' : 'not-allowed',
                }}
              >
                {assigning ? '…' : 'CONFIRMER'}
              </button>
              <button
                onClick={() => setShowAssign(false)}
                style={{
                  padding: '5px 8px',
                  background: 'transparent',
                  border: '1px solid rgba(127,149,166,0.3)',
                  borderRadius: '4px',
                  color: 'var(--mu)',
                  font: '600 10px Oxanium',
                  cursor: 'pointer',
                }}
              >
                ANNULER
              </button>
            </div>
          </div>
        )}

        {agents.length === 0 ? (
          <small style={{ font: '400 9px "JetBrains Mono"', color: 'var(--mu)', fontStyle: 'italic' }}>Aucun agent assigné</small>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {agents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 7px',
                  background: 'rgba(5,10,18,0.6)',
                  border: '1px solid rgba(var(--c), 0.15)',
                  borderRadius: '4px',
                  fontSize: '10px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAgent?.(agent.id);
                  }}
                  title="Inspecter cet sous-agent"
                >
                  <span className="ms" style={{ fontSize: '12px', color: agentColor(agent.status) }}>
                    {ROLE_ICONS[agent.role] || 'smart_toy'}
                  </span>
                  <span style={{ color: 'var(--tx)' }}>{agent.name}</span>
                  <span style={{ color: 'var(--mu)', font: '400 9px "JetBrains Mono"' }}>({ROLE_LABELS[agent.role] || agent.role})</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnassign(agent.id); }}
                  disabled={assigning}
                  style={{
                    padding: '2px 5px',
                    background: 'transparent',
                    border: '1px solid rgba(var(--r), 0.3)',
                    borderRadius: '3px',
                    color: 'rgb(var(--r))',
                    font: '600 8px "JetBrains Mono"',
                    cursor: 'pointer',
                  }}
                  title="Désassigner cet agent"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Résultat */}
      {mission.result?.summary && (
        <div className="mission-card__result" style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          padding: '6px',
          background: 'rgba(var(--m), 0.08)',
          border: '1px solid rgba(var(--m), 0.15)',
          borderRadius: '4px',
          marginBottom: '8px',
        }}>
          <span className="ms" style={{ fontSize: '14px', color: 'rgb(var(--c))', flexShrink: 0 }}>check_circle</span>
          <small style={{ color: 'var(--tx)', lineHeight: 1.4 }}>{mission.result.summary.slice(0, 140)}{mission.result.summary.length > 140 ? '…' : ''}</small>
        </div>
      )}

      {/* Actions */}
      <div className="mission-card__actions" style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
        <button
          onClick={(e) => { e.stopPropagation(); window.location.href = `/missions/${mission.id}`; }}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'rgba(var(--c), 0.12)',
            border: '1px solid rgba(var(--c), 0.3)',
            borderRadius: '6px',
            color: '#fff',
            font: '500 10px Oxanium',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <span className="ms" style={{ fontSize: '14px' }}>visibility</span>
          Détails
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); window.location.href = `/audit?missionId=${mission.id}`; }}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'rgba(var(--m), 0.12)',
            border: '1px solid rgba(var(--m), 0.3)',
            borderRadius: '6px',
            color: '#fff',
            font: '500 10px Oxanium',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <span className="ms" style={{ fontSize: '14px' }}>sensors</span>
          Audit
        </button>
      </div>
    </article>
  );
}

// ── Inspector Panel (Mission ou Agent) ───────────────────────────
interface InspectorProps {
  selectedMissionId: string | null;
  selectedAgentId: string | null;
  missions: Mission[];
  agents: Subagent[];
  onClose: () => void;
}

function Inspector({ selectedMissionId, selectedAgentId, missions, agents, onClose }: InspectorProps) {
  const mission = missions.find((m) => m.id === selectedMissionId);
  const agent = agents.find((a) => a.id === selectedAgentId);
  const [agentHistory, setAgentHistory] = useState<SubagentMissionHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (selectedAgentId) {
      setLoadingHistory(true);
      api.get<{ history: SubagentMissionHistoryEntry[] }>(`/api/subagents/${selectedAgentId}/history`)
        .then((data) => setAgentHistory(data.history || []))
        .catch(() => setAgentHistory([]))
        .finally(() => setLoadingHistory(false));
    } else {
      setAgentHistory([]);
    }
  }, [selectedAgentId]);

  if (!mission && !agent) {
    return (
      <aside className="p" style={{ width: '360px', flexShrink: 0, alignSelf: 'start', position: 'sticky', top: '74px' }}>
        <h3>
          INSPECTEUR
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer' }}>
            <span className="ms">close</span>
          </button>
        </h3>
        <p style={{ color: 'var(--mu)', font: '400 11px Geist' }}>Sélectionnez une mission ou un agent pour afficher les détails.</p>
      </aside>
    );
  }

  if (mission && !agent) {
    const missionAgents = agents.filter((a) => a.missionId === mission.id);
    return (
      <aside className="p" style={{ width: '360px', flexShrink: 0, alignSelf: 'start', position: 'sticky', top: '74px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <h3>
          INSPECTEUR — MISSION
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer' }}>
            <span className="ms">close</span>
          </button>
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>ID</div>
          <div style={{ font: '400 11px "JetBrains Mono"', color: 'rgb(var(--c))', wordBreak: 'break-all' }}>{mission.id}</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>NOM</div>
          <div style={{ font: '600 13px Oxanium', color: '#fff' }}>{mission.name}</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>OBJECTIF</div>
          <p style={{ font: '400 11.5px Geist', color: 'var(--tx)', lineHeight: 1.5 }}>{mission.objective}</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>STATUT</span>
            <span style={{ color: missionColor(mission.status), font: '600 10px "JetBrains Mono"' }}>{mission.status}</span>
          </div>
        </div>

        {mission.steps && mission.steps.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '6px' }}>
              ÉTAPES ({mission.steps.filter((s) => isStepDone(s.status)).length}/{mission.steps.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {mission.steps.map((step, idx) => {
                const v = stepVisual(step.status);
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', font: '400 10px Geist' }} title={v.label}>
                    <span className="ms" style={{ fontSize: '12px', color: v.color }}>{v.icon}</span>
                    <span style={{ color: isStepDone(step.status) ? 'var(--tx)' : 'var(--mu)' }}>{step.name}</span>
                    <span style={{ marginLeft: 'auto', font: '400 8.5px "JetBrains Mono"', color: v.color, opacity: 0.8 }}>{step.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '6px' }}>SOUS-AGENTS ({missionAgents.length})</div>
          {missionAgents.length === 0 ? (
            <small style={{ color: 'var(--mu)', fontStyle: 'italic' }}>Aucun agent assigné</small>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {missionAgents.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(5,10,18,0.5)', borderRadius: '4px' }}>
                  <span className="ms" style={{ fontSize: '12px', color: agentColor(a.status) }}>{ROLE_ICONS[a.role] || 'smart_toy'}</span>
                  <span style={{ color: 'var(--tx)', fontSize: '11px' }}>{a.name}</span>
                  <small style={{ color: 'var(--mu)' }}>({ROLE_LABELS[a.role] || a.role})</small>
                </div>
              ))}
            </div>
          )}
        </div>

        {mission.result?.summary && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>RÉSULTAT</div>
            <p style={{ font: '400 11px Geist', color: 'var(--tx)', lineHeight: 1.4 }}>{mission.result.summary}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
          <button
            onClick={() => window.location.href = `/missions/${mission.id}`}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'rgba(var(--c), 0.15)',
              border: '1px solid rgba(var(--c), 0.3)',
              borderRadius: '5px',
              color: '#fff',
              font: '600 10px Oxanium',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <span className="ms" style={{ fontSize: '13px' }}>shield</span>
            Détails Mission
          </button>
          <button
            onClick={() => window.location.href = `/audit?missionId=${mission.id}`}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'rgba(var(--m), 0.15)',
              border: '1px solid rgba(var(--m), 0.3)',
              borderRadius: '5px',
              color: '#fff',
              font: '600 10px Oxanium',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <span className="ms" style={{ fontSize: '13px' }}>sensors</span>
            Audit
          </button>
        </div>
      </aside>
    );
  }

  if (agent) {
    return (
      <aside className="p" style={{ width: '360px', flexShrink: 0, alignSelf: 'start', position: 'sticky', top: '74px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <h3>
          INSPECTEUR — AGENT
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer' }}>
            <span className="ms">close</span>
          </button>
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>ID</div>
          <div style={{ font: '400 11px "JetBrains Mono"', color: 'rgb(var(--c))', wordBreak: 'break-all' }}>{agent.id}</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>NOM</div>
          <div style={{ font: '600 13px Oxanium', color: '#fff' }}>{agent.name}</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>RÔLE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="ms" style={{ fontSize: '14px', color: agentColor(agent.status) }}>{ROLE_ICONS[agent.role] || 'smart_toy'}</span>
            <span style={{ color: 'var(--tx)' }}>{ROLE_LABELS[agent.role] || agent.role}</span>
          </div>
        </div>

        {agent.specialty && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>SPÉCIALITÉ</div>
            <p style={{ font: '400 11px Geist', color: 'var(--tx)' }}>{agent.specialty}</p>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>STATUT</span>
            <span style={{ color: agentColor(agent.status), font: '600 10px "JetBrains Mono"' }}>{agent.status}</span>
          </div>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>ÉTAT</span>
            <span style={{ color: 'rgb(var(--c))', font: '600 10px "JetBrains Mono"' }}>{agent.state || '—'}</span>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>MISSION COURANTE</div>
          {agent.missionId ? (
            (() => {
              const m = missions.find((x) => x.id === agent.missionId);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--tx)', font: '400 11px Geist' }}>{m?.name || agent.mission?.name || agent.missionId}</span>
                  {m && (
                    <span style={{ color: missionColor(m.status), font: '600 9px "JetBrains Mono"', border: `1px solid ${missionColor(m.status)}`, borderRadius: '3px', padding: '0 4px' }}>
                      {m.status}
                    </span>
                  )}
                </div>
              );
            })()
          ) : (
            <small style={{ color: 'var(--mu)', fontStyle: 'italic' }}>Aucune mission</small>
          )}
        </div>

        {agent.lastError && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '4px' }}>DERNIÈRE ERREUR</div>
            <p style={{ font: '400 10px "JetBrains Mono"', color: 'rgb(var(--r))', background: 'rgba(var(--r), 0.08)', padding: '6px', borderRadius: '4px' }}>{agent.lastError}</p>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ font: '600 10px "JetBrains Mono"', color: 'var(--mu)', marginBottom: '6px' }}>HISTORIQUE MISSIONS ({agentHistory.length})</div>
          {loadingHistory ? (
            <small style={{ color: 'var(--mu)' }}>Chargement…</small>
          ) : agentHistory.length === 0 ? (
            <small style={{ color: 'var(--mu)', fontStyle: 'italic' }}>Aucun historique</small>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
              {agentHistory.map((h) => (
                <div key={h.id} style={{ padding: '5px', background: 'rgba(5,10,18,0.5)', borderRadius: '4px' }}>
                  <div style={{ font: '400 10px Geist', color: 'var(--tx)' }}>{h.missionName || h.missionId}</div>
                  <small style={{ color: 'var(--mu)', font: '400 9px "JetBrains Mono"' }}>
                    {new Date(h.assignedAt).toLocaleDateString('fr-FR')}
                    {h.unassignedAt && ` → ${new Date(h.unassignedAt).toLocaleDateString('fr-FR')}`}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
          <button
            onClick={() => window.location.href = `/conversations?agentId=${agent.id}`}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'rgba(var(--c), 0.15)',
              border: '1px solid rgba(var(--c), 0.3)',
              borderRadius: '5px',
              color: '#fff',
              font: '600 10px Oxanium',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <span className="ms" style={{ fontSize: '13px' }}>history</span>
            Conversation
          </button>
        </div>
      </aside>
    );
  }

  return null;
}

// ── Activity Stream (Live) ───────────────────────────────────────
interface ActivityStreamProps {
  events: AuditEvent[];
  lastSync: Date | null;
  isStale: boolean;
}

function ActivityStream({ events, lastSync, isStale }: ActivityStreamProps) {
  return (
    <section className="p" style={{ marginTop: '12px' }}>
      <h3>
        LIVE STREAM — AUDIT LEDGER
        <em style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isStale && <span className="dot" style={{ width: '6px', height: '6px', background: 'rgb(var(--g))', animation: 'ping 1.8s infinite' }} />}
          {lastSync ? `Sync: ${lastSync.toLocaleTimeString('fr-FR')}` : '—'}
        </em>
      </h3>
      {events.length === 0 ? (
        <p style={{ color: 'var(--mu)', font: '400 11px Geist' }}>Aucun événement récent.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
          {events.map((evt) => (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 8px',
                background: 'rgba(5,10,18,0.5)',
                border: '1px solid rgba(var(--c), 0.1)',
                borderRadius: '4px',
                font: '400 10px "JetBrains Mono"',
              }}
            >
              <span style={{ color: 'rgb(var(--m))', opacity: 0.8, flexShrink: 0 }}>
                {new Date(evt.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{ color: 'rgb(var(--c))', fontWeight: 600, flexShrink: 0 }}>{evt.type}</span>
              <span style={{ color: 'var(--mu)', opacity: 0.7, flexShrink: 0 }}>{evt.actor || 'system'}</span>
              {evt.missionId && (
                <span style={{ color: 'var(--tx)', fontSize: '10px', marginLeft: 'auto' }}>
                  {evt.missionId.slice(0, 8)}…
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Page Principale ──────────────────────────────────────────────
const POLL_INTERVAL_MS = 5000;
const STALE_THRESHOLD_MS = 8000;

export default function MissionControlPage() {
  return (
    <Suspense fallback={
      <div className="workspace-content" style={{ padding: '74px 24px 150px' }}>
        <section className="p">
          <h3>MISSION CONTROL</h3>
          <p className="mono" style={{ color: 'var(--mu)' }}>Chargement…</p>
        </section>
      </div>
    }>
      <MissionControlPageInner />
    </Suspense>
  );
}

function MissionControlPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [agents, setAgents] = useState<Subagent[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(searchParams.get('missionId'));
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(searchParams.get('agentId'));

  // Recherche instantanée + filtres combinables (chantier ergonomie Mission Control).
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ALERT' | 'DONE'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'executor' | 'researcher' | 'verifier'>('ALL');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const resetFilters = useCallback(() => {
    setQuery('');
    setStatusFilter('ALL');
    setRoleFilter('ALL');
    setUnassignedOnly(false);
  }, []);

  useEffect(() => {
    setSelectedMissionId(searchParams.get('missionId'));
    setSelectedAgentId(searchParams.get('agentId'));
  }, [searchParams]);

  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      setSelectedMissionId(sp.get('missionId'));
      setSelectedAgentId(sp.get('agentId'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Raccourcis clavier : « / » recherche, ↑/↓ (ou j/k) naviguent entre les
  // cartes, Échap efface/replie. Les champs de saisie sont toujours préservés.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.key === 'Escape' && target === searchRef.current) {
        setQuery('');
        searchRef.current?.blur();
        return;
      }
      if (event.key === 'Escape' && !typing) {
        setSelectedMissionId(null);
        setSelectedAgentId(null);
        window.history.pushState(null, '', window.location.pathname);
        return;
      }

      // Navigation séquentielle dans la grille de missions.
      const isNext = event.key === 'ArrowDown' || event.key === 'j';
      const isPrev = event.key === 'ArrowUp' || event.key === 'k';
      if ((isNext || isPrev) && !typing) {
        const cards = Array.from(
          document.querySelectorAll<HTMLElement>('.mission-card'),
        );
        if (cards.length === 0) return;
        event.preventDefault();
        const currentIndex = cards.findIndex((card) => card === document.activeElement);
        const nextIndex =
          currentIndex === -1
            ? 0
            : Math.min(cards.length - 1, Math.max(0, currentIndex + (isNext ? 1 : -1)));
        cards[nextIndex]?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Chargement des données
  const fetchData = useCallback(async () => {
    try {
      const [missionsRes, agentsRes, eventsRes, statusRes] = await Promise.all([
        api.get<{ missions: Mission[] }>('/api/missions'),
        api.get<{ subagents: Subagent[] }>('/api/subagents'),
        // Pagination serveur : les 30 événements les plus récents, triés côté
        // Runtime (created_at DESC, rowid DESC). Aucun chargement complet.
        api.get<{ events: AuditEvent[] }>('/api/audit?order=desc&limit=30'),
        api.get<RuntimeStatus>('/api/status').catch(() => null),
      ]);

      setMissions(missionsRes.missions || []);
      setAgents(agentsRes.subagents || []);

      // Dédoublonnage défensif par id (le serveur garantit déjà l'unicité).
      const rawEvents = eventsRes.events || [];
      const seen = new Set<string>();
      const unique = rawEvents.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      setEvents(unique.slice(0, 30));

      if (statusRes) setRuntimeStatus(statusRes);

      setLastSync(new Date());
      setIsStale(false);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Erreur de connexion au Runtime');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Détection de péremption indépendante du cycle de polling :
  // stale = aucun rafraîchissement réussi depuis STALE_THRESHOLD_MS.
  useEffect(() => {
    const tick = setInterval(() => {
      if (!lastSync) return;
      setIsStale(Date.now() - lastSync.getTime() > STALE_THRESHOLD_MS);
    }, 1000);
    return () => clearInterval(tick);
  }, [lastSync]);

  // Calcul des compteurs
  const runningMissions = missions.filter((m) => m.status === 'RUNNING' || m.status === 'VERIFYING').length;
  const alertMissions = missions.filter((m) => m.status === 'BLOCKED' || m.status === 'FAILED' || m.status === 'NEEDS_REVIEW').length;
  // « Disponible » = état disponible ET aucune mission en cours : un agent
  // IDLE déjà rattaché ne doit pas être proposé pour une nouvelle affectation.
  const availableAgentList = agents.filter((a) => a.state === 'available' && !a.missionId);
  const availableAgents = availableAgentList.length;
  const busyAgents = agents.filter((a) => a.state === 'busy').length;

  // Tri des missions par missionRank
  const sortedMissions = [...missions].sort((a, b) => missionRank(a.status) - missionRank(b.status));

  // Agents par mission
  const getAgentsForMission = (missionId: string) => agents.filter((a) => a.missionId === missionId);

  // ── Recherche instantanée + filtres combinables ─────────────────────
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (values: Array<string | undefined>): boolean =>
    normalizedQuery.length === 0 ||
    values.some((value) => (value ?? '').toLowerCase().includes(normalizedQuery));

  const matchesStatusFilter = (status: string): boolean => {
    const rank = missionRank(status);
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return rank === 0;
    if (statusFilter === 'ALERT') return rank === 1;
    return rank === 3;
  };

  const matchesRoleFilter = (missionAgents: Subagent[]): boolean =>
    roleFilter === 'ALL' || missionAgents.some((agent) => agent.role === roleFilter);

  // Une mission correspond aussi si l'un de ses agents correspond (recherche
  // transversale : « quel agent travaille sur quoi ? »).
  const filteredMissions = sortedMissions.filter((mission) => {
    if (!matchesStatusFilter(mission.status)) return false;
    const missionAgents = getAgentsForMission(mission.id);
    if (unassignedOnly && missionAgents.length > 0) return false;
    if (!matchesRoleFilter(missionAgents)) return false;
    return matchesQuery([
      mission.id,
      mission.name,
      mission.objective,
      mission.status,
      ...missionAgents.flatMap((agent) => [agent.name, agent.role, agent.specialty]),
    ]);
  });

  const filteredAvailableAgents = availableAgentList.filter(
    (agent) =>
      (roleFilter === 'ALL' || agent.role === roleFilter) &&
      matchesQuery([agent.id, agent.name, agent.role, agent.specialty]),
  );

  const hasActiveFilters =
    normalizedQuery.length > 0 ||
    statusFilter !== 'ALL' ||
    roleFilter !== 'ALL' ||
    unassignedOnly;

  // Sélection URL + État Synchrone
  const selectMission = (id: string) => {
    setSelectedMissionId(id);
    setSelectedAgentId(null);
    const params = new URLSearchParams(window.location.search);
    params.set('missionId', id);
    params.delete('agentId');
    window.history.pushState(null, '', `?${params.toString()}`);
  };

  const selectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    const agent = agents.find((a) => a.id === agentId);
    const mId = agent?.missionId || selectedMissionId;
    if (mId) setSelectedMissionId(mId);
    const params = new URLSearchParams(window.location.search);
    params.set('agentId', agentId);
    if (mId) params.set('missionId', mId);
    window.history.pushState(null, '', `?${params.toString()}`);
  };

  const clearSelection = () => {
    setSelectedMissionId(null);
    setSelectedAgentId(null);
    window.history.pushState(null, '', window.location.pathname);
  };

  // Gestion assignation (mutation optimiste locale, source de vérité = Runtime)
  const handleAssignAgent = useCallback((agentId: string, missionId: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId ? { ...a, missionId, state: 'busy' as const } : a
      )
    );
  }, []);

  const handleUnassignAgent = useCallback((agentId: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId ? { ...a, missionId: '', state: 'available' as const } : a
      )
    );
  }, []);

  return (
    <div className="workspace-content" style={{ padding: '74px 24px 220px', maxWidth: '100%', margin: 0 }}>
      {/* Header — Indicateurs Runtime */}
      <section className="p" style={{ marginBottom: '12px' }}>
        <h3>
          MISSION CONTROL
          <em>
            {runtimeStatus ? `${runtimeStatus.status}${runtimeStatus.readOnlyMode ? ' · READ-ONLY' : ''}` : 'Runtime injoignable'}
          </em>
        </h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
          <CounterCard
            label="MISSIONS"
            value={missions.length}
            color="rgb(var(--c))"
            icon="shield"
            sub={`${runningMissions} en cours`}
          />
          <CounterCard
            label="AGENTS"
            value={agents.length}
            color="rgb(var(--m))"
            icon="groups"
            sub={`${availableAgents} dispo`}
          />
          <CounterCard
            label="RUNNING"
            value={runningMissions}
            color="rgb(var(--m))"
            icon="play_circle"
          />
          <CounterCard
            label="ALERTES"
            value={alertMissions}
            color={alertMissions > 0 ? 'rgb(var(--r))' : 'rgb(var(--mu))'}
            icon="warning"
          />
        </div>
      </section>

      {/* Mission Field */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start' }}>
        <div ref={containerRef}>
          <div className="p" style={{ marginBottom: '12px' }}>
            <h3>
              MISSION FIELD
              <em>
                {loading
                  ? 'Chargement…'
                  : error
                    ? 'ERREUR'
                    : hasActiveFilters
                      ? `${filteredMissions.length}/${sortedMissions.length} missions`
                      : `${sortedMissions.length} missions`}
              </em>
            </h3>

            {/* Barre de recherche + filtres (recherche instantanée côté client) */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
                <span
                  className="ms"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: 'var(--mu)' }}
                >
                  search
                </span>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher une mission, un agent…  ( / )"
                  aria-label="Rechercher des missions et des agents"
                  style={{
                    width: '100%',
                    padding: '7px 30px 7px 30px',
                    background: 'rgba(5, 10, 18, 0.8)',
                    border: '1px solid rgba(var(--c), 0.2)',
                    borderRadius: '5px',
                    color: 'var(--tx)',
                    font: '400 11px Geist',
                    outline: 'none',
                  }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    title="Effacer la recherche"
                    aria-label="Effacer la recherche"
                    style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', display: 'flex' }}
                  >
                    <span className="ms" style={{ fontSize: '13px' }}>close</span>
                  </button>
                )}
              </div>

              {([
                ['ALL', 'Toutes'],
                ['ACTIVE', 'Actives'],
                ['ALERT', 'Alertes'],
                ['DONE', 'Terminées'],
              ] as const).map(([value, label]) => {
                const active = statusFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    aria-pressed={active}
                    style={{
                      font: '600 9px Oxanium',
                      letterSpacing: '0.06em',
                      padding: '5px 9px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: active ? '#04101a' : 'var(--mu)',
                      background: active ? 'rgb(var(--c))' : 'rgba(5, 10, 18, 0.6)',
                      border: active ? '1px solid rgb(var(--c))' : '1px solid rgba(var(--c), 0.2)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}

              {/* Filtre de rôle : les missions sont filtrées via leurs agents. */}
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
                aria-label="Filtrer par rôle d’agent"
                title="Filtrer les missions et les agents par rôle"
                style={{
                  padding: '5px 7px',
                  background: 'rgba(5, 10, 18, 0.6)',
                  border: roleFilter === 'ALL' ? '1px solid rgba(var(--c), 0.2)' : '1px solid rgb(var(--c))',
                  borderRadius: '4px',
                  color: roleFilter === 'ALL' ? 'var(--mu)' : 'var(--tx)',
                  font: '600 9px Oxanium',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">Tous rôles</option>
                <option value="executor">Exécuteur</option>
                <option value="researcher">Chercheur</option>
                <option value="verifier">Vérificateur</option>
              </select>

              {/* Missions sans agent : file d’attente d’affectation. */}
              <button
                type="button"
                onClick={() => setUnassignedOnly((value) => !value)}
                aria-pressed={unassignedOnly}
                title="Afficher uniquement les missions sans agent affecté"
                style={{
                  font: '600 9px Oxanium',
                  letterSpacing: '0.06em',
                  padding: '5px 9px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: unassignedOnly ? '#04101a' : 'var(--mu)',
                  background: unassignedOnly ? 'rgb(var(--m))' : 'rgba(5, 10, 18, 0.6)',
                  border: unassignedOnly ? '1px solid rgb(var(--m))' : '1px solid rgba(var(--c), 0.2)',
                }}
              >
                Sans agent
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Réinitialiser la recherche et les filtres"
                  style={{ font: '600 9px Oxanium', color: 'var(--mu)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Réinitialiser
                </button>
              )}

              <span style={{ marginLeft: 'auto', font: '400 9px "JetBrains Mono"', color: 'var(--mu)' }}>
                {filteredMissions.length} résultat{filteredMissions.length > 1 ? 's' : ''}
              </span>
            </div>

            {loading && <p className="mono" style={{ color: 'var(--mu)' }}>Chargement des données Runtime…</p>}

            {!loading && error && (
              <div className="fi w" style={{ padding: '16px', background: 'rgba(var(--r), 0.08)', border: '1px solid rgba(var(--r), 0.3)', borderRadius: '6px' }}>
                <header style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="ms" style={{ color: 'rgb(var(--r))', fontSize: '16px' }}>error</span>
                  <span style={{ color: 'rgb(var(--r))', font: '600 11px Oxanium' }}>Erreur de connexion</span>
                </header>
                <p style={{ color: 'var(--tx)', marginBottom: '6px' }}>{error}</p>
                <small style={{ color: 'var(--mu)' }}>Vérifiez que le serveur RAQIB est démarré sur le port 4000.</small>
              </div>
            )}

            {!loading && !error && sortedMissions.length === 0 && (
              <p className="mono" style={{ color: 'var(--mu)' }}>Aucune mission enregistrée.</p>
            )}

            {!loading && !error && sortedMissions.length > 0 && filteredMissions.length === 0 && (
              <div
                className="fi"
                style={{ padding: '16px', border: '1px dashed rgba(var(--c), 0.25)', borderRadius: '6px', color: 'var(--mu)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
              >
                <span className="ms" style={{ fontSize: '16px' }}>search_off</span>
                <span style={{ font: '400 11px Geist' }}>
                  Aucun résultat pour les filtres actifs
                  {query ? ` · recherche « ${query} »` : ''}
                  {statusFilter !== 'ALL' ? ` · statut ${statusFilter.toLowerCase()}` : ''}
                  {roleFilter !== 'ALL' ? ` · rôle ${ROLE_LABELS[roleFilter] || roleFilter}` : ''}
                  {unassignedOnly ? ' · sans agent' : ''}.
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{ font: '600 9px Oxanium', color: 'rgb(var(--c))', background: 'rgba(var(--c), 0.1)', border: '1px solid rgba(var(--c), 0.3)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
                >
                  RÉINITIALISER
                </button>
              </div>
            )}

            {!loading && !error && filteredMissions.length > 0 && (
              <div className="missions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: '14px' }}>
                {filteredMissions.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    agents={getAgentsForMission(mission.id)}
                    isSelected={selectedMissionId === mission.id}
                    onSelect={selectMission}
                    onSelectAgent={selectAgent}
                    onAssignAgent={handleAssignAgent}
                    onUnassignAgent={handleUnassignAgent}
                    availableAgents={availableAgentList}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Available Agents Zone */}
          {availableAgentList.length > 0 && (
            <div className="p" style={{ marginTop: '12px' }}>
              <h3>
                AVAILABLE AGENTS
                <em>{availableAgents} disponible{availableAgents > 1 ? 's' : ''}</em>
              </h3>
              {filteredAvailableAgents.length === 0 ? (
                <p style={{ font: '400 11px Geist', color: 'var(--mu)', margin: 0 }}>
                  Aucun agent disponible ne correspond à la recherche.
                </p>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredAvailableAgents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => selectAgent(agent.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: selectedAgentId === agent.id ? 'rgba(var(--c), 0.08)' : 'rgba(5,10,18,0.5)',
                      border: selectedAgentId === agent.id ? '1px solid rgba(var(--c), 0.4)' : '1px solid rgba(var(--c), 0.12)',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      transition: '0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ms" style={{ fontSize: '14px', color: agentColor(agent.status) }}>{ROLE_ICONS[agent.role] || 'smart_toy'}</span>
                      <div>
                        <div style={{ font: '600 11px Oxanium', color: 'var(--tx)' }}>{agent.name}</div>
                        <small style={{ color: 'var(--mu)' }}>{ROLE_LABELS[agent.role] || agent.role} · {agent.specialty || 'Généraliste'}</small>
                      </div>
                    </div>
                    <span className="ms" style={{ fontSize: '14px', color: 'var(--mu)' }}>chevron_right</span>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}
        </div>

        {/* Inspector */}
        <Inspector
          selectedMissionId={selectedMissionId}
          selectedAgentId={selectedAgentId}
          missions={missions}
          agents={agents}
          onClose={clearSelection}
        />
      </section>

      {/* Activity Stream */}
      <ActivityStream events={events} lastSync={lastSync} isStale={isStale} />
    </div>
  );
}
