'use client';

import { useHud } from './HudContext';
import { usePathname } from 'next/navigation';
import { useMissions } from '../hooks/useMissions';

const SECTION_SUBTITLES: Record<string, string> = {
  '/':          'Espace de développement · Port Runtime 4000',
  '/missions':  'Moteur de missions · Suivi et contrôle d\'autonomie',
  '/approvals': 'Matrice d\'approbation · Autorisation à usage unique',
  '/audit':     'Registre d\'audit · Traçabilité immuable',
  '/context':   'Context Engine · Budget de tokens & fenêtre glissante',
  '/memory':    'Memory Engine · Mémoire court/long terme multi-tier',
  '/workflows': 'Workflow Engine · Graphes d\'exécution multi-agents',
  '/skills':    'Skills Registry · Catalogue de compétences sandboxées',
  '/settings':  'Protocole d\'urgence · Sécurité Zero-Trust',
};

export default function ShellCenter() {
  const { statusLabel, output, echo } = useHud();
  const pathname = usePathname();
  const subtitle = SECTION_SUBTITLES[pathname] ?? SECTION_SUBTITLES['/'];
  const isHome = pathname === '/';
  const { missions } = useMissions();

  return (
    <>
      <div className="hd">
        <span id="sl">
          <i className="dot" aria-hidden />
          <span id="st">{statusLabel}</span>
        </span>
        <h1>RAQIB</h1>
        <small>{subtitle}</small>
      </div>

      <div className="bt">
        <small id="echo">{echo}</small>
        <div id="out" aria-live="polite">{output}</div>

        {isHome && (
          <section className="p tl" style={{ '--i': 5 } as any}>
            <h3>Missions récentes<em>{missions.length} missions en cours</em></h3>
            {missions.length === 0 ? (
              <div className="tm d"><i /><b>Aucune mission enregistrée</b><small>Système prêt</small></div>
            ) : (
              missions.slice(0, 4).map((m: any) => (
                <div key={m.id} className={`tm ${m.status === 'SUCCEEDED' ? 'd' : m.status === 'RUNNING' ? 'n' : ''}`}>
                  <i />
                  <b>{m.name || m.id}</b>
                  <small>{m.status} · {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : 'Inconnu'}</small>
                </div>
              ))
            )}
          </section>
        )}
      </div>
    </>
  );
}
