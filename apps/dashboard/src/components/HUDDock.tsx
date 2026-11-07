'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useHud } from './HudContext';
import { api } from '../lib/api';
import AuditLedgerFeed from './AuditLedgerFeed';

interface RuntimeStatus {
  status: string;
  emergencyStop: boolean;
  readOnlyMode: boolean;
  timestamp: string;
}

interface ContextMetrics {
  totalBudget: number;
  usedTokens: number;
  availableTokens: number;
}

/** Sous-ensemble de l'API Web Speech utilisée pour la dictée vocale. */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function HUDDock() {
  const router = useRouter();
  const { go, publish } = useHud();
  const [prompt, setPrompt] = useState('');
  const barsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [tz, setTz] = useState('');
  const [providerHealth, setProviderHealth] = useState<string>('Vérification…');
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [contextMetrics, setContextMetrics] = useState<ContextMetrics | null>(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [synthesisBusy, setSynthesisBusy] = useState(false);

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

  // Chips Runtime / Context Engine alimentées par les API réelles.
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const s = await api.get<RuntimeStatus>('/api/status');
        if (!stop) setStatus(s);
      } catch {
        if (!stop) setStatus(null);
      }
      try {
        const c = await api.get<ContextMetrics>('/api/context');
        if (!stop) setContextMetrics(c);
      } catch {
        if (!stop) setContextMetrics(null);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    api.get<{ providers: Array<{ id: string; healthy: boolean; latencyMs?: number }> }>('/api/models/health')
      .then((data) => {
        const active = data.providers?.find((p) => p.healthy);
        if (active) {
          setProviderHealth(`${active.id} (${active.latencyMs ?? 0}ms)`);
        } else {
          setProviderHealth('Aucun provider sain');
        }
      })
      .catch(() => setProviderHealth('Déconnecté'));
  }, []);

  // Dictée vocale réelle via l'API Web Speech du navigateur.
  useEffect(() => {
    const w = window as any;
    setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec: SpeechRecognitionLike = new Ctor();
    rec.lang = 'fr-FR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) setPrompt(transcript.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) return;
      go(prompt);
      setPrompt('');
    },
    [go, prompt]
  );

  /**
   * Synthèse exécutive calculée localement à partir des API du runtime.
   * Aucune réponse n'est simulée : si le runtime est injoignable, on l'affiche.
   */
  const buildSynthesis = useCallback(async () => {
    setSynthesisBusy(true);
    try {
      const [s, m, a, au] = await Promise.all([
        api.get<RuntimeStatus>('/api/status'),
        api.get<{ missions: Array<{ id: string; status: string }> }>('/api/missions'),
        api.get<{ approvals: Array<{ id: string; status: string }> }>('/api/approvals'),
        api.get<{ events: Array<{ id: string }> }>('/api/audit'),
      ]);
      const missions = m.missions || [];
      const approvals = a.approvals || [];
      const running = missions.filter((x) => x.status === 'RUNNING').length;
      const pending = approvals.filter((x) => x.status === 'PENDING').length;
      const text = [
        `Synthèse exécutive — ${new Date().toLocaleString('fr-FR')}`,
        `Runtime : ${s.status} · arrêt d'urgence ${s.emergencyStop ? 'ACTIF' : 'désactivé'} · PolicyEngine ${s.readOnlyMode ? 'READ-ONLY' : 'READ/WRITE'}`,
        `Missions : ${missions.length} au total · ${running} en cours d'exécution`,
        `Approbations : ${pending} en attente de signature`,
        `Audit : ${(au.events || []).length} événements enregistrés`,
        `Model Gateway : ${providerHealth}`,
      ].join('\n');
      publish(text, 'Synthèse exécutive', 'Données runtime · calcul local');
    } catch (err: any) {
      publish(
        `Synthèse impossible : ${err?.message || 'runtime injoignable'}. Aucune donnée simulée.`,
        'Synthèse exécutive',
        'Erreur runtime'
      );
    } finally {
      setSynthesisBusy(false);
    }
  }, [publish, providerHealth]);

  const runtimeLabel = status
    ? `${status.status}${status.readOnlyMode ? ' · READ-ONLY' : ''}`
    : 'Hors ligne';
  const contextLabel = contextMetrics
    ? `${Math.round(contextMetrics.totalBudget / 1000)}k max`
    : 'Indisponible';

  return (
    <footer className="dock">
      <div className="env">
        <small>Zone locale · <span>{tz}</span></small>
        <small>Runtime · <span>{runtimeLabel}</span></small>
        <small>Context Engine · <span>{contextLabel}</span></small>
        <small>Model Gateway · <span>{providerHealth}</span></small>
      </div>
      <div className="cm">
        {/* Audit Ledger Feed — au-dessus du champ de saisie */}
        <AuditLedgerFeed />

        <form className="cmd" onSubmit={onSubmit} autoComplete="off">
          <button
            type="button"
            className={`mic${listening ? ' on' : ''}`}
            aria-label={listening ? 'Arrêter la dictée vocale' : 'Démarrer la dictée vocale'}
            aria-pressed={listening}
            disabled={!speechSupported}
            title={
              speechSupported
                ? listening
                  ? 'Arrêter la dictée vocale'
                  : 'Dictée vocale (fr-FR)'
                : 'Reconnaissance vocale non supportée par ce navigateur'
            }
            onClick={toggleVoice}
          >
            <span className="ms">mic</span>
          </button>
          {listening && (
            <div className="wv on" ref={barsRef} aria-hidden="true">
              <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
          )}
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
          <button type="button" onClick={() => router.push('/mission-control')}>Mission Control</button>
          <button type="button" onClick={() => router.push('/coding-engine')}>Analyser le projet</button>
          <button type="button" onClick={() => router.push('/missions')}>Afficher les missions</button>
          <button type="button" onClick={() => router.push('/approvals')}>Consulter les approbations</button>
          <button type="button" onClick={() => router.push('/audit')}>Vérifier l'audit</button>
        </div>
      </div>
      <button className="bf" onClick={buildSynthesis} disabled={synthesisBusy}>
        <span className="ms">summarize</span>
        <span>{synthesisBusy ? 'Synthèse en cours…' : 'Synthèse exécutive'}</span>
      </button>
    </footer>
  );
}
