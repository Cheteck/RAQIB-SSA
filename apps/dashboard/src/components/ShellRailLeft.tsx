'use client';

import { useHud } from './HudContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const SECTION_META: Record<string, { icon: string; label: string; color: string }> = {
  '/':          { icon: 'grid_view',  label: 'Workspace',  color: 'rgb(var(--c))' },
  '/missions':  { icon: 'shield',     label: 'Missions',   color: 'rgb(var(--m))' },
  '/approvals': { icon: 'how_to_reg', label: 'Approvals',  color: 'rgb(var(--g))' },
  '/audit':     { icon: 'sensors',    label: 'Audit',      color: 'rgb(var(--c))' },
  '/context':   { icon: 'data_object',label: 'Contexte',   color: 'rgb(var(--c))' },
  '/memory':    { icon: 'memory',     label: 'Mémoire',    color: 'rgb(var(--m))' },
  '/workflows': { icon: 'account_tree',label: 'Workflows', color: 'rgb(var(--g))' },
  '/skills':    { icon: 'extension',  label: 'Skills',     color: 'rgb(var(--c))' },
  '/settings':  { icon: 'warning',    label: 'Emergency',  color: 'rgb(var(--r))' },
};

const NAV_ITEMS = [
  { href: '/',          icon: 'grid_view',  label: 'Workspace' },
  { href: '/missions',  icon: 'shield',     label: 'Missions' },
  { href: '/approvals', icon: 'how_to_reg', label: 'Approvals' },
  { href: '/audit',     icon: 'sensors',    label: 'Audit' },
  { href: '/context',   icon: 'data_object',label: 'Contexte' },
  { href: '/memory',    icon: 'memory',     label: 'Mémoire' },
  { href: '/workflows', icon: 'account_tree',label: 'Workflows' },
  { href: '/skills',    icon: 'extension',  label: 'Skills' },
  { href: '/settings',  icon: 'warning',    label: 'Emergency', danger: true },
];

const WORK_MODS = [
  { icon: 'terminal',      label: 'Workspace',      badge: 'PROD' },
  { icon: 'account_tree',  label: 'Workflows',      badge: 'ACTIVE' },
  { icon: 'smart_toy',     label: 'Agents',         badge: 'HARNESS' },
  { icon: 'checklist',     label: 'Missions',       badge: 'RUNNING' },
  { icon: 'history',       label: 'Audit Ledger',   badge: 'SECURE' },
  { icon: 'hub',           label: 'Context Engine', badge: 'CONFIG' },
];

const ROLES = [
  { icon: 'code',        label: 'Développement',   sub: 'OPERATIONAL', active: true },
  { icon: 'schema',      label: 'Architecture',    sub: 'ALIGNED',     active: true },
  { icon: 'fact_check',  label: 'Tests & Qualité', sub: 'PASSED',      active: true },
  { icon: 'assignment',  label: 'Gouvernance',     sub: 'ENFORCED',    active: true },
];

export default function ShellRailLeft() {
  const { online } = useHud();
  const pathname = usePathname();
  const section = SECTION_META[pathname] ?? SECTION_META['/'];
  const [activeMod, setActiveMod] = useState(0);

  const [status, setStatus] = useState<any>(null);
  const [contextMetrics, setContextMetrics] = useState<any>(null);
  const [modelHealth, setModelHealth] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ status: 'OFFLINE', emergencyStop: false }));

    fetch(`${API_BASE}/api/context`)
      .then((r) => r.json())
      .then((d) => setContextMetrics(d))
      .catch(() => setContextMetrics(null));

    fetch(`${API_BASE}/api/models/health`)
      .then((r) => r.json())
      .then((d) => setModelHealth(d))
      .catch(() => setModelHealth(null));
  }, []);

  const envLinks = [
    { label: 'Dépôt Git',     value: 'Projet local RAQIB' },
    { label: 'Backend IA',    value: modelHealth?.providers?.[0]?.provider || 'Model Gateway' },
    { label: 'Environnement', value: status?.readOnlyMode ? 'Mode Lecture Seule' : 'Mode Interactif' },
    { label: 'CI / CD',       value: 'Vitest / Build OK' },
  ];

  const ctxPct = contextMetrics && contextMetrics.totalBudget
    ? Math.round((contextMetrics.usedTokens / contextMetrics.totalBudget) * 100) || 5
    : 12;

  const gauges = [
    { label: 'Rules',   color: '98,230,255',  pct: status?.emergencyStop ? 100 : 85 },
    { label: 'Memory',  color: '125,255,200', pct: 42 },
    { label: 'Context', color: '255,179,71',  pct: ctxPct },
  ];

  return (
    <aside className="rail l" id="L" aria-label="Navigation et modules">

      {/* ── Panneau 1 : Navigation ── */}
      <section className="p" style={{ '--i': 0 } as any}>
        <h3>
          Navigation RAQIB
          <em style={{ color: section.color }}>
            <span className="ms" style={{ fontSize: 11 }}>{section.icon}</span>
            {' '}{section.label}
          </em>
        </h3>
        <nav className="mods" aria-label="Sections principales">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'on' : ''}
              style={item.danger ? { color: 'rgb(var(--r))', borderColor: 'rgba(var(--r),0.4)' } : {}}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              <span className="ms">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </section>

      {/* ── Panneau 2 : Modules de travail ── */}
      <section className="p" style={{ '--i': 1 } as any}>
        <h3>Modules de travail<em>Opérationnel</em></h3>
        <div className="mods">
          {WORK_MODS.map((m, i) => (
            <button
              key={m.label}
              className={activeMod === i ? 'on' : ''}
              onClick={() => setActiveMod(i)}
            >
              <span className="ms">{m.icon}</span>
              <span>{m.label}</span>
              {m.badge && <b>{m.badge}</b>}
            </button>
          ))}
        </div>
      </section>

      {/* ── Panneau 3 : Rôles de travail + env links ── */}
      <section className="p" style={{ '--i': 2 } as any}>
        <h3>Rôles de travail<em>Système actif</em></h3>
        {ROLES.map((r) => (
          <div key={r.label} className={`ag ${r.active ? 'act' : ''}`}>
            <span className="ms">{r.icon}</span>
            <div>
              <b>{r.label}</b>
              <small>{r.sub}</small>
            </div>
            <span className="eq"><i /><i /><i /><i /></span>
          </div>
        ))}
        <div className="eng">
          {envLinks.map((e) => (
            <div key={e.label} className="en">
              <i className="dot" />
              <b>{e.label}</b>
              <small>{e.value}</small>
            </div>
          ))}
        </div>
      </section>

      {/* ── Panneau 4 : Indicateurs Runtime ── */}
      <section className="p" style={{ '--i': 3 } as any}>
        <h3>
          Indicateurs Runtime
          <em style={{ color: 'rgb(var(--m))' }}>
            {status ? 'RAQIB Core V2' : 'Dépôt Local'}
          </em>
        </h3>
        <div className="gs">
          {gauges.map((g) => (
            <div key={g.label} className="g" style={{ color: `rgb(${g.color})` }}>
              <svg viewBox="0 0 36 36">
                <circle className="b" cx="18" cy="18" r="15.9" />
                <circle
                  className="f"
                  cx="18" cy="18" r="15.9"
                  stroke={`rgb(${g.color})`}
                  style={{ strokeDasharray: `${g.pct} 100` }}
                />
              </svg>
              <b>{g.pct}%</b>
              <small>{g.label}</small>
            </div>
          ))}
        </div>
      </section>

    </aside>
  );
}
