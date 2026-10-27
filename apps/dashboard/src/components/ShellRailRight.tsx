'use client';

import { useHud } from './HudContext';
import { usePathname } from 'next/navigation';

// Actions rapides (fidèles au template)
const QUICK_ACTIONS = [
  { icon: 'account_tree', label: "Analyser l'architecture",  q: "Analyse l'architecture du projet" },
  { icon: 'checklist',    label: 'Découper une fonctionnalité', q: 'Découpe cette fonctionnalité en tâches' },
  { icon: 'bug_report',   label: 'Préparer les tests',      q: 'Prépare une stratégie de tests' },
  { icon: 'rocket_launch',label: 'Préparer une release',    q: 'Prépare la prochaine release' },
];

// Points réseau de contexte
const NP = [
  [12,16],[36,8],[60,18],[88,10],
  [20,42],[46,34],[72,44],[94,36],
  [10,68],[34,60],[58,70],[84,66],
];

// Calculer les edges (liens entre points proches)
const EDGES: [number,number,number,number][] = [];
NP.forEach(([ax,ay], i) => NP.forEach(([bx,by], j) => {
  if (j > i && Math.hypot(ax-bx, ay-by) < 30) EDGES.push([ax,ay,bx,by]);
}));

export default function ShellRailRight() {
  const { feed, turns, vectors, go } = useHud();
  const pathname = usePathname();
  const isEmergency = pathname === '/settings';

  return (
    <aside className="rail r" id="R" aria-label="Journal, actions rapides et contexte">

      {/* ── Panneau 1 : Journal d'activité ── */}
      <section className="p" style={{ '--i': 3 } as any}>
        <h3>
          Journal d'activité
          <em>{feed.length > 0 ? `${feed.length} entrées` : 'Événements de démonstration'}</em>
        </h3>
        <div className="feed" id="fd" aria-live="polite">
          {feed.length === 0 ? (
            <>
              <div className="fi w">
                <header><span>Connexion au dépôt</span><em>À FAIRE</em></header>
                <p>Connecter un dépôt Git pour afficher les branches, commits et l'état réel du projet.</p>
                <small>État : non connecté</small>
              </div>
              <div className="fi">
                <header><span>Contexte projet</span><em>DÉMO</em></header>
                <p>Les informations affichées illustrent l'interface. Aucun projet réel n'est chargé.</p>
                <small>Données de démonstration</small>
              </div>
              <div className="fi">
                <header><span>Exécution des commandes</span><em>LOCAL</em></header>
                <p>Les commandes saisies ne sont pas exécutées sur un backend dans cette version.</p>
                <small>Mode prototype frontend</small>
              </div>
            </>
          ) : (
            feed.map((f) => (
              <div key={f.key} className={`fi${f.w ? ' w' : ''}`}>
                <header>
                  <span>{f.title}</span>
                  <em>{f.tag}</em>
                </header>
                <p>{f.body}</p>
                <small>{f.meta}</small>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Panneau 2 : Actions rapides ── */}
      <section className="p" style={{ '--i': 4 } as any}>
        <h3>Actions rapides<em>Suggestions · simulation</em></h3>
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
            <small>Activité locale</small>
            <b id="vc">{turns}</b>
            <small><span id="tn">{turns}</span> demandes · backend non connecté</small>
          </div>
        </div>
      </section>

      {/* ── Panneau 4 (conditionnel) : Emergency info sur /settings ── */}
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
              <small>Désactivation requiert clé à usage unique</small>
            </div>
          </div>
        </section>
      )}

    </aside>
  );
}
