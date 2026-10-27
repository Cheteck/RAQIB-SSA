'use client';

import { useHud } from './HudContext';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAudit } from '../hooks/useAudit';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const QUICK_ACTIONS = [
  { icon: 'account_tree', label: "Analyser une mission",      q: "Analyse la mission courante" },
  { icon: 'checklist',    label: 'Vérifier les approbations', q: 'Consulte les approbations en attente' },
  { icon: 'bug_report',   label: "Consulter l'audit",          q: 'Affiche le registre d\'audit immuable' },
  { icon: 'rocket_launch',label: 'Lancer auto-amélioration',  q: 'Déclenche la mission de self-improvement' },
];

const NP = [
  [12,16],[36,8],[60,18],[88,10],
  [20,42],[46,34],[72,44],[94,36],
  [10,68],[34,60],[58,70],[84,66],
];

const EDGES: [number,number,number,number][] = [];
NP.forEach(([ax,ay], i) => NP.forEach(([bx,by], j) => {
  if (j > i && Math.hypot(ax-bx, ay-by) < 30) EDGES.push([ax,ay,bx,by]);
}));

export default function ShellRailRight() {
  const { turns, go } = useHud();
  const pathname = usePathname();
  const isEmergency = pathname === '/settings';
  const { events } = useAudit();
  const [contextMetrics, setContextMetrics] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/context`)
      .then((r) => r.json())
      .then((d) => setContextMetrics(d))
      .catch(() => setContextMetrics(null));
  }, []);

  return (
    <aside className="rail r" id="R" aria-label="Journal, actions rapides et contexte">

      {/* ── Panneau 1 : Journal d'activité ── */}
      <section className="p" style={{ '--i': 3 } as any}>
        <h3>
          Journal d'activité
          <em>{events.length > 0 ? `${events.length} événements` : 'Registre d\'audit'}</em>
        </h3>
        <div className="feed" id="fd" aria-live="polite">
          {events.length === 0 ? (
            <div className="fi">
              <header><span>Audit Ledger</span><em>SYSTÈME</em></header>
              <p>Aucun événement récent enregistré dans le registre immuable.</p>
              <small>Prêt pour l'enregistrement</small>
            </div>
          ) : (
            events.slice(0, 5).map((e) => (
              <div key={e.id} className="fi">
                <header>
                  <span>{e.type}</span>
                  <em>{e.actor}</em>
                </header>
                <p>{JSON.stringify(e.data).slice(0, 100)}</p>
                <small>{new Date(e.timestamp).toLocaleTimeString()}</small>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Panneau 2 : Actions rapides ── */}
      <section className="p" style={{ '--i': 4 } as any}>
        <h3>Actions rapides<em>Directives d'exécution</em></h3>
        <div className="dir">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} onClick={() => go(a.q)}>
              <span className="ms">{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Panneau 3 : Réseau de contexte ── */}
      <section className="p" style={{ '--i': 5 } as any}>
        <h3>
          Réseau de contexte
          <em><span id="sy">{EDGES.length}</span> liens</em>
        </h3>
        <div className="cs">
          <svg id="cn" viewBox="0 0 100 80" aria-hidden>
            {EDGES.map(([x1,y1,x2,y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
            {NP.map(([cx,cy], i) => (
              <circle
                key={i}
                cx={cx} cy={cy}
                r={i % 4 === 0 ? 2.4 : 1.6}
                style={{ animationDelay: `${i * 0.35}s` }}
              />
            ))}
          </svg>
          <div>
            <small>Context Tokens</small>
            <b id="vc">{contextMetrics?.usedTokens ?? 0}</b>
            <small><span id="tn">{turns}</span> interactions · Mode Sécurisé</small>
          </div>
        </div>
      </section>

      {/* ── Panneau 4 (conditionnel) : Emergency info ── */}
      {isEmergency && (
        <section className="p" style={{
          '--i': 6,
          boxShadow: 'inset 0 0 0 1px rgba(var(--r), 0.4)',
        } as any}>
          <h3 style={{ borderColor: 'rgba(var(--r), 0.3)' }}>
            Protocole d'urgence
            <em style={{ color: 'rgb(var(--r))' }}>ATTENTION</em>
          </h3>
          <div className="ag">
            <span className="ms" style={{ color: 'rgb(var(--r))' }}>block</span>
            <div>
              <b>Blocage immédiat</b>
              <small>Toutes les exécutions bloquées sans exception</small>
            </div>
          </div>
          <div className="ag">
            <span className="ms" style={{ color: 'rgb(var(--g))' }}>person</span>
            <div>
              <b>Signature fondateur uniquement</b>
              <small>Désactivation requiert confirmation administrative</small>
            </div>
          </div>
        </section>
      )}

    </aside>
  );
}
