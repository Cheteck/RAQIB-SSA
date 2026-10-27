'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * ModuleOverlay — panneau de contenu des routes modules.
 *
 * Stratégie :
 * - Sur "/" : le conteneur existe dans le DOM mais est invisible (display:none).
 *   Le centre RAQIB est seul visible.
 * - Sur les autres routes : s'affiche dans la 3e colonne (zone rail droit)
 *   via une grille CSS miroir de .st
 * - Focus mode (body.fm) : masqué par CSS, le centre prend tout l'espace.
 * - Transitions : exit 200ms → swap → enter 300ms
 */

type Phase = 'enter' | 'idle' | 'exit';
const HOME = '/';

export default function ModuleOverlay({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === HOME;

  const [phase, setPhase] = useState<Phase>('idle');
  const [displayed, setDisplayed] = useState(children);
  const prev = useRef(pathname);
  const reduced = useRef(
    typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (pathname === prev.current) return;
    const goingHome = pathname === HOME;
    prev.current = pathname;

    if (reduced.current) {
      setDisplayed(children);
      return;
    }

    if (goingHome) {
      setPhase('exit');
      const t = setTimeout(() => { setPhase('idle'); }, 220);
      return () => clearTimeout(t);
    }

    // module → module ou home → module
    setPhase('exit');
    const t1 = setTimeout(() => {
      setDisplayed(children);
      setPhase('enter');
      const t2 = setTimeout(() => setPhase('idle'), 340);
      return () => clearTimeout(t2);
    }, 200);
    return () => clearTimeout(t1);
  }, [pathname, children]);

  return (
    <div
      className="module-overlay"
      data-phase={phase}
      style={{ display: isHome ? 'none' : undefined }}
      aria-hidden={isHome}
    >
      <div className="module-overlay__inner">
        {displayed}
      </div>
    </div>
  );
}
