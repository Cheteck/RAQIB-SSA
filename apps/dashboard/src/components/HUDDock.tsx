'use client';

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
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
        <small>Local grid · <span>{tz}</span></small>
        <small>Runtime · <span>Active</span></small>
        <small>Quantum core · <span>1.21 GW</span></small>
        <small>Voice synth · <span>Ready</span></small>
      </div>
      <div className="cm">
        <form className="cmd" onSubmit={onSubmit} autoComplete="off">
          <button type="button" className="mic" aria-label="Talk to RAQIB">
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
            placeholder="Speak or type a directive…"
            aria-label="Directive"
          />
          <kbd>⌘K</kbd>
        </form>
        <div className="chips">
          <button type="button" onClick={() => go('Engage Defense Protocol')}>Engage Defense Protocol</button>
          <button type="button" onClick={() => go('Analyze Threat Vector')}>Analyze Threat Vector</button>
          <button type="button" onClick={() => go('Brief')}>Executive Briefing</button>
          <button type="button" onClick={() => go('Missions')}>Mission Overview</button>
        </div>
      </div>
      <button className="bf" onClick={() => go('Executive Briefing')}>
        <span className="ms">summarize</span>
        <span>Executive Briefing</span>
      </button>
    </footer>
  );
}
