'use client';

import { useHud } from './HudContext';
import { usePathname } from 'next/navigation';

/**
 * Espace de réponse RAQIB — colonne centrale UNIQUEMENT.
 * 
 * Contenu : titre RAQIB + status label + output typewriter + timeline (home).
 * Jamais de contenu module ici.
 * 
 * Fidèle au template HTML :
 *   .mid
 *     .hd   → titre centré (haut)
 *     .bt   → output typewriter + .tl (bas, space-between)
 */

const SECTION_SUBTITLES: Record<string, string> = {
  '/':          'Development workspace · runtime port 4000',
  '/missions':  'Mission engine · tracking & autonomy control',
  '/approvals': 'Approval matrix · single-use authorization',
  '/audit':     'Audit ledger · append-only tamper-evident log',
  '/settings':  'Emergency matrix · zero-trust safety protocol',
};

export default function ShellCenter() {
  const { statusLabel, output, echo } = useHud();
  const pathname = usePathname();
  const subtitle = SECTION_SUBTITLES[pathname] ?? SECTION_SUBTITLES['/'];
  const isHome = pathname === '/';

  return (
    <>
      {/* Titre RAQIB — toujours centré, toujours visible */}
      <div className="hd">
        <span id="sl">
          <i className="dot" aria-hidden />
          <span id="st">{statusLabel}</span>
        </span>
        <h1>RAQIB</h1>
        <small>{subtitle}</small>
      </div>

      {/* Output typewriter + timeline — en bas via space-between du .mid */}
      <div className="bt">
        <small id="echo">{echo}</small>
        <div id="out" aria-live="polite">{output}</div>

        {/* Timeline visible uniquement sur la home */}
        {isHome && (
          <section className="p tl" style={{ '--i': 5 } as any}>
            <h3>Mission chronos<em>active deck · 4 objectives</em></h3>
            <div className="tm d"><i /><b>Initialisation du Runtime</b><small>09:30 AM · Done</small></div>
            <div className="tm n"><i /><b>Vérification Policy Engine</b><small>12:00 PM · In progress</small></div>
            <div className="tm"><i /><b>Audit Ledger Verification</b><small>02:00 PM · Queued</small></div>
            <div className="tm"><i /><b>Validation finale MVP</b><small>04:30 PM · Queued</small></div>
          </section>
        )}
      </div>
    </>
  );
}
