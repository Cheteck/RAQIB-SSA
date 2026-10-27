'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useHud } from './HudContext';

export default function HUDDock() {
  const { go } = useHud();
  const [prompt, setPrompt] = useState('');
  const barsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [tz, setTz] = useState('');

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) return;
      go(prompt);
      setPrompt('');
    },
    [go, prompt]
  );

  return (
    <footer className="dock">
      <div className="env">
        <small>Zone locale · <span>{tz}</span></small>
        <small>Runtime · <span>Actif</span></small>
        <small>Context Engine · <span>128k max</span></small>
        <small>Model Gateway · <span>Prêt</span></small>
      </div>
      <div className="cm">
        <form className="cmd" onSubmit={onSubmit} autoComplete="off">
          <button type="button" className="mic" aria-label="Entrée vocale RAQIB">
            <span className="ms">mic</span>
          </button>
          <div className="wv" ref={barsRef}>
            <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
          </div>
          <input
            ref={inputRef}
            id="q"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Saisissez une directive pour RAQIB…"
            aria-label="Directive"
          />
          <kbd>⌘K</kbd>
        </form>
        <div className="chips">
          <button type="button" onClick={() => go('Analyser le projet')}>Analyser le projet</button>
          <button type="button" onClick={() => go('Afficher les missions')}>Afficher les missions</button>
          <button type="button" onClick={() => go('Consulter les approbations')}>Consulter les approbations</button>
          <button type="button" onClick={() => go('Vérifier l\'audit')}>Vérifier l'audit</button>
        </div>
      </div>
      <button className="bf" onClick={() => go('Synthèse exécutive')}>
        <span className="ms">summarize</span>
        <span>Synthèse exécutive</span>
      </button>
    </footer>
  );
}
