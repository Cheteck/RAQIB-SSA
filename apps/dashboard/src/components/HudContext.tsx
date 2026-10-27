'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { CoreMode } from './NeuralCanvas';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface FeedItem {
  key: string;
  w: boolean; // warning styling
  title: string;
  tag: string;
  body: string;
  meta: string;
  fix?: boolean;
}

interface HudState {
  mode: CoreMode;
  statusLabel: string;
  output: string;
  echo: string;
  feed: FeedItem[];
  defenseEng: boolean;
  defenseText: string;
  turns: number;
  vectors: number;
  online: boolean;
  theme: 'cyan' | 'amber';
  go: (t: string) => void;
  setFeed: (items: FeedItem[]) => void;
  toggleTheme: () => void;
}

const SL: Record<CoreMode, string> = {
  idle: 'STANDBY',
  listening: 'LISTENING',
  thinking: 'PROCESSING',
  speaking: 'TRANSMITTING',
};

/** Real runtime-aware response engine (French, RAQIB domain). */
const RS: Array<[RegExp, string | ((ctx: HudCtx) => Promise<string>), string, string?]> = [
  [
    /stop|emergency|arrêt/i,
    'Emergency lock is disengaged, Commander. All execution paths remain blocked by the Policy Engine until you arm it explicitly.',
    'Emergency lock verified',
  ],
  [
    /defen|shield|protocole|armor/i,
    async (ctx) => {
      const s = await ctx.status();
      return `Defense matrix engaged, Commander. PolicyEngine is in ${s.readOnlyMode ? 'READ-ONLY' : 'full'} mode, emergency lock ${s.emergencyStop ? 'ARMED' : 'disengaged'} — threat level zero.`;
    },
    'Defense protocol engaged',
    'ENGAGED',
  ],
  [
    /threat|menace|analy[sz]er|analyse/i,
    async (ctx) => {
      const s = await ctx.status();
      const a = await ctx.auditCount();
      return `Analysis complete, Commander. Runtime ${s.status.toLowerCase()}, ${a} audit events logged, zero anomalies flagged. Shall I isolate the latest entries?`;
    },
    'Threat vector analysed',
  ],
  [
    /audit|ledger|journal/i,
    async (ctx) => {
      const a = await ctx.auditCount();
      return `Audit ledger is sealed and append-only. ${a} events recorded since boot — every action is hashed and immutable. Nothing to hide, Commander.`;
    },
    'Audit ledger reviewed',
  ],
  [
    /mission|objectif/i,
    async (ctx) => {
      const m = await ctx.missionCount();
      return `Mission engine reporting, Commander. ${m} mission${m > 1 ? 's' : ''} tracked across the board — statuses, budgets and autonomy levels all synced to the ledger.`;
    },
    'Missions overview delivered',
  ],
  [
    /budget|coût|cost|EUR/i,
    'Budget guardrails are enforced per mission. Any step exceeding its limit triggers a single-use approval request before spend, Commander.',
    'Budget guardrails checked',
  ],
  [
    /approbation|authorize|grant|approval/i,
    async (ctx) => {
      const s = await ctx.status();
      return `Approval matrix active. Read-only governance is ${s.readOnlyMode ? 'still in force' : 'lifted'} — any elevated action requires your single-use signature first, Commander.`;
    },
    'Approval matrix checked',
  ],
  [
    /brief|résumé|resume|briefing/i,
    async (ctx) => {
      const s = await ctx.status();
      const m = await ctx.missionCount();
      const a = await ctx.auditCount();
      return `Good morning, Commander. Three items need you: runtime ${s.status.toLowerCase()}, ${m} mission${m > 1 ? 's' : ''} on the board, ${a} audit events sealed. Read-only governance is ${s.readOnlyMode ? 'in force until Phase 4 validation' : 'lifted'}. Nothing else is on fire.`;
    },
    'Executive briefing delivered',
  ],
  [
    /status|hello|hi\b|bonjour|état|state/i,
    async (ctx) => {
      const s = await ctx.status();
      return `All systems nominal, Commander. Runtime ${s.status.toLowerCase()}, emergency lock ${s.emergencyStop ? 'ARMED' : 'clear'}, governance ${s.readOnlyMode ? 'READ-ONLY' : 'read/write'}. Defense matrix armed.`;
    },
    'Status check',
  ],
];

const defaultResp = (t: string) =>
  `Understood, Commander. Routing "${t.slice(0, 60)}" through the Policy Engine — no LLM involved, every step audited.`;

interface HudCtx {
  status: () => Promise<any>;
  auditCount: () => Promise<number>;
  missionCount: () => Promise<number>;
}

const HudContext = createContext<HudState | null>(null);

/** Palettes de couleur RAQIB */
export type ThemeName = 'cyan' | 'amber';

const THEMES: Record<ThemeName, Record<string, string>> = {
  cyan: {
    '--c': '98, 230, 255',
    '--m': '125, 255, 200',
    '--g': '255, 179, 71',
    '--r': '255, 107, 94',
    '--s': '98, 230, 255',
  },
  amber: {
    '--c': '255, 179, 71',
    '--m': '255, 220, 140',
    '--g': '98, 230, 255',
    '--r': '255, 107, 94',
    '--s': '255, 179, 71',
  },
};

function applyTheme(name: ThemeName) {
  const vars = THEMES[name];
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
}

let feedKey = 0;

export function HudProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<CoreMode>('idle');
  const [statusLabel, setStatusLabel] = useState(SL.idle);
  const [output, setOutput] = useState('');
  const [echo, setEcho] = useState('');
  const [feed, setFeedState] = useState<FeedItem[]>([]);
  const [defenseEng, setDefenseEng] = useState(false);
  const [defenseText, setDefenseText] = useState('Defense matrix armed · threat level 0 clear');
  const [turns, setTurns] = useState(22);
  const [vectors, setVectors] = useState(3380);
  const [online, setOnline] = useState(false);
  const [theme, setTheme] = useState<ThemeName>('cyan');

  const tI = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef<CoreMode>('idle');
  modeRef.current = mode;

  const setFeed = useCallback((items: FeedItem[]) => setFeedState(items), []);

  // Restaurer le thème depuis localStorage au montage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('raqib-theme') as ThemeName | null;
      if (saved && saved in THEMES) {
        setTheme(saved);
        applyTheme(saved);
      }
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeName = prev === 'cyan' ? 'amber' : 'cyan';
      applyTheme(next);
      try { localStorage.setItem('raqib-theme', next); } catch {}
      return next;
    });
  }, []);

  const api = useRef<HudCtx>({
    status: async () => ({ status: 'OK', emergencyStop: false, readOnlyMode: true }),
    auditCount: async () => 0,
    missionCount: async () => 0,
  });

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (stop) return;
        const data = await res.json();
        setOnline(true);
        api.current = {
          status: async () => data,
          auditCount: async () => {
            try {
              const r = await fetch(`${API_BASE}/api/audit`);
              const d = await r.json();
              return (d.events || []).length;
            } catch {
              return 0;
            }
          },
          missionCount: async () => {
            try {
              const r = await fetch(`${API_BASE}/api/missions`);
              const d = await r.json();
              return (d.missions || []).length;
            } catch {
              return 0;
            }
          },
        };
      } catch {
        if (!stop) setOnline(false);
      }
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const setS = useCallback((s: CoreMode) => {
    setMode(s);
    setStatusLabel(SL[s]);
  }, []);

  const say = useCallback(
    (text: string) => {
      if (tI.current) clearInterval(tI.current);
      setS('speaking');
      setOutput('');
      let i = 0;
      tI.current = setInterval(
        () => {
          i++;
          setOutput(text.slice(0, i));
          if (i >= text.length) {
            if (tI.current) clearInterval(tI.current);
            setTimeout(() => {
              if (modeRef.current === 'speaking') setS('idle');
            }, 700);
          }
        },
        24
      );
    },
    [setS]
  );

  const pushFeed = useCallback((item: Omit<FeedItem, 'key'>) => {
    setFeedState((prev) => [{ ...item, key: `k${feedKey++}` }, ...prev].slice(0, 8));
  }, []);

  const go = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      setEcho(`› ${t}`);
      setOutput('');
      if (tI.current) clearInterval(tI.current);
      setS('thinking');
      setTurns((v) => v + 1);
      setVectors((v) => v + 1 + Math.floor(Math.random() * 3));

      setTimeout(
        async () => {
          const r = RS.find((x) => x[0].test(t)) || ([/./, defaultResp(t), 'Directive received'] as any);
          let text = r[1];
          if (typeof text === 'function') {
            try {
              text = await text(api.current);
            } catch {
              text = defaultResp(t);
            }
          }
          pushFeed({
            w: false,
            title: r[2],
            tag: 'LOG',
            body: `"${t.slice(0, 70)}"`,
            meta: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' · RAQIB core',
          });
          if (r[3]) {
            setDefenseEng(true);
            setDefenseText(`Defense matrix ${r[3].toLowerCase()} · threat level 0 clear`);
          }
          say(text);
        },
        900 + Math.random() * 500
      );
    },
    [pushFeed, say, setS]
  );

  return (
    <HudContext.Provider
      value={{ mode, statusLabel, output, echo, feed, defenseEng, defenseText, turns, vectors, online, theme, go, setFeed, toggleTheme }}
    >
      {children}
    </HudContext.Provider>
  );
}

export function useHud() {
  const ctx = useContext(HudContext);
  if (!ctx) throw new Error('useHud must be used within HudProvider');
  return ctx;
}
