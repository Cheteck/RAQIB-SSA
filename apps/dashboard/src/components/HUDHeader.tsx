'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHud } from './HudContext';

type NavItem = { href: string; icon: string; label: string; title: string };

const NAV_ITEMS: NavItem[] = [
  { href: '/',             icon: 'grid_view',   label: 'Workspace',     title: "Vue d'ensemble" },
  { href: '/mission-control', icon: 'dashboard', label: 'Mission Control', title: 'Supervision unifiée missions & agents' },
  { href: '/missions',     icon: 'shield',      label: 'Missions',      title: 'Gestion des missions' },
  { href: '/agents',       icon: 'smart_toy',   label: 'Agents',        title: 'Supervision des agents' },
  { href: '/subagents',    icon: 'groups',      label: 'Sous-agents',   title: 'Sous-agents et affectations' },
  { href: '/approvals',    icon: 'how_to_reg',  label: 'Approbations',  title: "Matrice d'approbation" },
  { href: '/audit',        icon: 'sensors',     label: 'Audit',         title: "Registre d'audit" },
  { href: '/context',      icon: 'data_object', label: 'Contexte',      title: 'Budget de contexte & tokens' },
  { href: '/memory',       icon: 'memory',      label: 'Mémoire',       title: 'Mémoire multi-tier' },
  { href: '/workflows',    icon: 'account_tree',label: 'Workflows',     title: "Workflows d'exécution" },
  { href: '/skills',       icon: 'extension',   label: 'Skills',        title: 'Compétences disponibles' },
  { href: '/coding-engine',icon: 'code',        label: 'Coding Engine', title: 'Moteur de codage IA' },
  { href: '/conversations',icon: 'history',     label: 'Conversations', title: 'Historique des conversations' },
  { href: '/settings',     icon: 'settings',    label: 'Réglages',      title: 'Configuration runtime' },
];

function matches(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function HUDHeader() {
  const { defenseText, defenseEng, online } = useHud();
  const pathname = usePathname() || '/';
  const [time, setTime] = useState('--:--:--');
  const [date, setDate] = useState('');
  const [tz, setTz] = useState('');
  const [focus, setFocus] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('en-US'));
      setDate(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTz(tzName + ' · local');
    return () => clearInterval(id);
  }, []);

  // Fermeture du menu : clic extérieur + Échap.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Fermeture du menu à chaque changement de route.
  useEffect(() => setMenuOpen(false), [pathname]);

  const toggleFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    document.body.classList.toggle('fm');
    e.currentTarget.classList.toggle('on');
    setFocus(!focus);
  };

  const defenseLine = online ? defenseText : 'Runtime link down · standing by';
  const current = NAV_ITEMS.find((item) => matches(pathname, item.href)) ?? NAV_ITEMS[0];

  return (
    <header className="top">
      <div className="brand">
        <Link
          className="brand-link"
          href="/"
          title="Workspace — retour à la vue d'ensemble"
          aria-label="RAQIB — retour au Workspace"
        >
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="#62e6ff" aria-hidden="true">
            <circle cx="17" cy="17" r="15" strokeDasharray="4 3" opacity=".6">
              <animateTransform attributeName="transform" type="rotate" from="0 17 17" to="360 17 17" dur="14s" repeatCount="indefinite" />
            </circle>
            <circle cx="17" cy="17" r="9" />
            <circle cx="17" cy="17" r="3" fill="#7dffc8" stroke="none" />
          </svg>
          <div>
            <b>RAQIB</b>
            <span className="chip">{current.label.toUpperCase()}</span>
            <span className="chip d">CORE v2.0</span>
            <small>MosaiX // Strategic AI Control Center</small>
          </div>
        </Link>
      </div>
      <div className="clk">
        <small>{date}</small>
        <b>{time}</b>
        <small>{tz}</small>
      </div>
      <div className="tr">
        <span className={`pill${defenseEng ? ' eng' : ''}`}>
          <i className="dot"></i>
          <span>{defenseLine}</span>
        </span>

        <Link
          className={`ib${pathname === '/' ? ' on' : ''}`}
          href="/"
          title="Workspace — retour à la page principale"
          aria-label="Retour au Workspace"
        >
          <span className="ms">home</span>
        </Link>

        <button className="ib" title="Focus mode — hide panels" onClick={toggleFocus} aria-pressed={focus}>
          <span className="ms">grid_view</span>
        </button>

        <div className="hdr-menu-wrap" ref={menuRef}>
          <button
            className={`ib${menuOpen ? ' on' : ''}`}
            title="Navigation — tous les modules"
            aria-label="Navigation des modules"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="ms">apps</span>
          </button>

          {menuOpen && (
            <div className="hdr-menu" role="menu" aria-label="Modules RAQIB">
              <div className="hdr-menu-head">
                <span>MODULES</span>
                <em>{NAV_ITEMS.length.toString().padStart(2, '0')}</em>
              </div>
              <div className="hdr-menu-grid">
                {NAV_ITEMS.map((item) => {
                  const active = matches(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      className={`hdr-menu-item${active ? ' on' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      title={item.title}
                    >
                      <span className="ms">{item.icon}</span>
                      <b>{item.label}</b>
                      <small>{item.href}</small>
                    </Link>
                  );
                })}
              </div>
              <div className="hdr-menu-foot">
                <span className="ms">keyboard</span>
                <span>Échap ferme · le logo RAQIB ramène au Workspace</span>
              </div>
            </div>
          )}
        </div>

        <Link
          className={`ib${matches(pathname, '/mission-control') ? ' on' : ''}`}
          href="/mission-control"
          title="Mission Control — supervision unifiée missions & sous-agents"
        >
          <span className="ms">dashboard</span>
        </Link>
        <Link
          className={`ib${matches(pathname, '/missions') ? ' on' : ''}`}
          href="/missions"
          title="Missions — suivi et exécution"
        >
          <span className="ms">shield</span>
        </Link>
        <Link
          className={`ib${matches(pathname, '/conversations') ? ' on' : ''}`}
          href="/conversations"
          title="Historique des conversations — reprise et consultation"
        >
          <span className="ms">history</span>
        </Link>
        <Link
          className={`ib${matches(pathname, '/agents') ? ' on' : ''}`}
          href="/agents"
          title="Agents — supervision, affectation et conversation dédiée"
        >
          <span className="ms">smart_toy</span>
        </Link>
        <Link
          className={`ib${matches(pathname, '/approvals') ? ' on' : ''}`}
          href="/approvals"
          title="Matrice d'approbation — signatures en attente"
        >
          <span className="ms">shield</span>
        </Link>
        <Link
          className={`ib${matches(pathname, '/audit') ? ' on' : ''}`}
          href="/audit"
          title="Registre d'audit — événements récents"
        >
          <span className="ms">sensors</span>
          <em></em>
        </Link>
        <div className="who">
          <span className="ms">shield_person</span>
          <div>
            <b>RAQIB</b>
            <small>Operator</small>
          </div>
        </div>
      </div>
    </header>
  );
}
