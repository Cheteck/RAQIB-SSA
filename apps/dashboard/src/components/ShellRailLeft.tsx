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
  '/settings':  { icon: 'warning',    label: 'Emergency',  color: 'rgb(var(--r))' },
};

const NAV_ITEMS = [
  { href: '/',          icon: 'grid_view',  label: 'Workspace' },
  { href: '/missions',  icon: 'shield',     label: 'Missions' },
  { href: '/approvals', icon: 'how_to_reg', label: 'Approvals' },
  { href: '/audit',     icon: 'sensors',    label: 'Audit' },
  { href: '/settings',  icon: 'warning',    label: 'Emergency', danger: true },
];

// Modules de travail (fidèles au template HTML)
const WORK_MODS = [
  { icon: 'terminal',      label: 'Workspace',      badge: '' },
  { icon: 'account_tree',  label: 'Architecture',   badge: '' },
  { icon: 'smart_toy',     label: 'Agents',         badge: 'DEMO' },
  { icon: 'checklist',     label: 'Backlog',        badge: 'LOCAL', badgeAlert: true },
  { icon: 'history',       label: 'Historique',     badge: '' },
  { icon: 'hub',           label: 'Contexte projet',badge: '' },
];

// Rôles de travail (fidèles au template)
const ROLES = [
  { icon: 'code',        label: 'Développement',   sub: 'EXEMPLE',     active: true },
  { icon: 'schema',      label: 'Architecture',    sub: 'EXEMPLE',     active: true },
  { icon: 'fact_check',  label: 'Tests & qualité', sub: 'À CONNECTER', active: false },
  { icon: 'assignment',  label: 'Gestion projet',  sub: 'LOCAL',       active: false },
];

const ENV_LINKS = [
  { label: 'Dépôt Git',     value: 'Non connecté' },
  { label: 'Backend IA',    value: 'Non connecté' },
  { label: 'Environnement', value: 'Prototype local' },
  { label: 'CI / CD',       value: 'Non connecté' },
];

const GAUGES = [
  { label: 'Rules',   color: '98,230,255',  pct: 32 },
  { label: 'Memory',  color: '125,255,200', pct: 65 },
  { label: 'Reactor', color: '255,179,71',  pct: 98 },
];

export default function ShellRailLeft() {
  const { online } = useHud();
  const pathname = usePathname();
  const section = SECTION_META[pathname] ?? SECTION_META['/'];
  const [activeMod, setActiveMod] = useState(0);

  const [status, setStatus] = useState<any>(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ status: 'OFFLINE', emergencyStop: false }));
  }, []);

  return (
    <aside className="rail l" id="L" aria-label="Navigation et modules">

      {/* ── Panneau 1 : Navigation (remplace "Modules de travail" du template) ── */}
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

      {/* ── Panneau 2 : Modules de travail (fidèle au template) ── */}
      <section className="p" style={{ '--i': 1 } as any}>
        <h3>Modules de travail<em>Prototype</em></h3>
        <div className="mods">
          {WORK_MODS.map((m, i) => (
            <button
              key={m.label}
              className={activeMod === i ? 'on' : ''}
              onClick={() => setActiveMod(i)}
            >
              <span className="ms">{m.icon}</span>
              <span>{m.label}</span>
              {m.badge && <b className={m.badgeAlert ? 'a' : ''}>{m.badge}</b>}
            </button>
          ))}
        </div>
      </section>

      {/* ── Panneau 3 : Rôles de travail + env links (fidèle au template) ── */}
      <section className="p" style={{ '--i': 2 } as any}>
        <h3>Rôles de travail<em>Exemples · non connectés</em></h3>
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
          {ENV_LINKS.map((e) => (
            <div key={e.label} className="en">
              <i className="dot" />
              <b>{e.label}</b>
              <small>{e.value}</small>
            </div>
          ))}
        </div>
      </section>

      {/* ── Panneau 4 : Indicateurs Runtime (gauges circulaires) ── */}
      <section className="p" style={{ '--i': 3 } as any}>
        <h3>
          Indicateurs Runtime
          <em style={{ color: 'rgb(var(--m))' }}>
            {status ? 'RAQIB Core' : 'Aucune donnée réelle'}
          </em>
        </h3>
        <div className="gs">
          {GAUGES.map((g) => (
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
