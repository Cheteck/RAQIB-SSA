'use client';

import { useRef, useState, useEffect } from 'react';
import { useHud } from './HudContext';
import { usePathname } from 'next/navigation';

/**
 * Dock de commande persistant — migré depuis page.tsx vers le shell partagé.
 * Affiché sur toutes les routes via layout.tsx.
 */
const SECTION_PROMPTS: Record<string, string[]> = {
  '/': [
    "Analyse l'architecture du projet",
    'Découper une fonctionnalité',
    'Préparer les tests',
    'Préparer une release',
  ],
  '/missions': [
    'Missions overview',
    "Analyser l'état des missions",
    'Priorités du prochain sprint',
    'Vérifier les budgets',
  ],
  '/approvals': [
    'Lister les approbations en attente',
    'Vérifier la matrice de gouvernance',
    'Historique des autorisations',
    'Politiques de validation',
  ],
  '/audit': [
    "Résumé de l'audit ledger",
    'Anomalies détectées',
    'Dernières entrées du journal',
    'Vérification cryptographique',
  ],
  '/settings': [
    'État du verrou emergency',
    'Vérifier le Policy Engine',
    'Diagnostics de sécurité',
    'Brief système complet',
  ],
};

const DEFAULT_PROMPTS = [
  "Analyse l'architecture du projet",
  'Découper une fonctionnalité',
  'Préparer les tests',
  'Préparer une release',
];

export default function ShellDock() {
  const { go, mode } = useHud();
  const pathname = usePathname();
  const [tz, setTz] = useState('—');

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || '—');
    } catch {
      setTz('—');
    }
  }, []);

  const wvRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chips = SECTION_PROMPTS[pathname] ?? DEFAULT_PROMPTS;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputRef.current?.value.trim();
    if (val) {
      go(val);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <footer className="dock">
      {/* Left — env info */}
      <div className="env">
        <small>Local grid · <span>{tz}</span></small>
        <small>Runtime · <span>RAQIB Autonomous Engine</span></small>
        <small>Execution · <span>Mode autonome</span></small>
      </div>

      {/* Centre — command bar */}
      <div className="cm">
        <form className="cmd" onSubmit={submit} autoComplete="off">
          <button
            type="button"
            className="mic"
            aria-label="Activer la commande vocale (Espace)"
            data-mode={mode}
          >
            <span className="ms">mic</span>
          </button>
          <div className="wv" ref={wvRef} aria-hidden>
            <i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <input
            ref={inputRef}
            id="q"
            placeholder="Demande à RAQIB…"
            aria-label="Demande à RAQIB"
          />
          <kbd>⌘K</kbd>
        </form>
        <div className="chips">
          {chips.map((c) => (
            <button key={c} onClick={() => go(c)}>{c}</button>
          ))}
        </div>
      </div>

      {/* Right — synthesis button */}
      <button
        className="bf"
        onClick={() => go('Prépare une synthèse du projet et des prochaines priorités')}
      >
        <span className="ms">summarize</span>
        <span>Synthèse projet</span>
      </button>
    </footer>
  );
}
