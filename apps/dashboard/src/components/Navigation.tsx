'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useHud } from './HudContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const NAV = [
  { href: '/',               icon: 'grid_view',  label: 'Workspace',      title: 'Vue d\'ensemble' },
  { href: '/missions',       icon: 'shield',     label: 'Missions',       title: 'Gestion des missions' },
  { href: '/approvals',      icon: 'how_to_reg', label: 'Approvals',      title: 'Matrice d\'approbation' },
  { href: '/audit',          icon: 'sensors',    label: 'Audit',          title: 'Registre d\'audit', badge: true },
  { href: '/coding-engine', icon: 'code',       label: 'Coding Engine',  title: 'Moteur de codage IA' },
  { href: '/context',        icon: 'data_object',label: 'Contexte',       title: 'Budget de contexte & tokens' },
  { href: '/memory',         icon: 'memory',     label: 'Mémoire',        title: 'Mémoire multi-tier' },
  { href: '/workflows',      icon: 'account_tree',label: 'Workflows',     title: 'Graphes d\'exécution' },
  { href: '/skills',         icon: 'extension',  label: 'Skills',         title: 'Catalogue de compétences' },
  { href: '/settings',       icon: 'warning',    label: 'Urgence',        title: 'Arrêt d\'urgence', danger: true },
];

export default function Navigation() {
  const pathname = usePathname();
  const { online, toggleTheme, theme } = useHud();

  const [time, setTime] = useState('--:--:--');
  const [date, setDate] = useState('');
  const [tz, setTz]   = useState('');
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('fr-FR'));
      setDate(d.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone + ' · local'); } catch {}
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ status: 'OFFLINE', emergencyStop: false }));
  }, []);

  const statusText = !status
    ? 'Connexion…'
    : status.emergencyStop
    ? 'Arrêt d\'urgence actif'
    : online
    ? 'Runtime RAQIB · opérationnel'
    : 'Serveur hors ligne';

  const isEmergencyArmed = status?.emergencyStop;

  const [focus, setFocus] = useState(false);
  const toggleFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    document.body.classList.toggle('fm');
    e.currentTarget.classList.toggle('on');
    setFocus((v) => !v);
  };

  return (
    <header className="top" role="banner">
      <div className="brand">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="#62e6ff" aria-hidden>
          <circle cx="17" cy="17" r="15" strokeDasharray="4 3" opacity=".6">
            <animateTransform
              attributeName="transform" type="rotate"
              from="0 17 17" to="360 17 17"
              dur="14s" repeatCount="indefinite"
            />
          </circle>
          <circle cx="17" cy="17" r="9" />
          <circle cx="17" cy="17" r="3" fill="#7dffc8" stroke="none" />
        </svg>
        <div>
          <b>RAQIB</b>
          <span className="chip">WORKSPACE</span>
          <span className="chip d">CORE v2.0</span>
          <small>Gouvernance stratégique · Centre de contrôle IA</small>
        </div>
      </div>

      <div className="clk" aria-live="off">
        <small>{date}</small>
        <b>{time}</b>
        <small>{tz}</small>
      </div>

      <div className="tr">
        <span
          className={`pill${isEmergencyArmed ? ' eng' : ''}`}
          role="status"
          aria-live="polite"
        >
          <i className="dot" aria-hidden />
          <span>{statusText}</span>
        </span>

        <button
          className={`ib${focus ? ' on' : ''}`}
          title="Focus mode — masquer les panneaux"
          aria-pressed={focus}
          onClick={toggleFocus}
        >
          <span className="ms" aria-hidden>grid_view</span>
        </button>

        <button
          className={`ib theme-toggle${theme === 'amber' ? ' on' : ''}`}
          title={theme === 'cyan' ? 'Passer en palette ambre' : 'Passer en palette cyan'}
          aria-label={`Palette active : ${theme === 'cyan' ? 'Cyan' : 'Ambre'}. Cliquer pour changer.`}
          aria-pressed={theme === 'amber'}
          onClick={toggleTheme}
        >
          <span className="ms" aria-hidden>palette</span>
        </button>

        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`ib nav-ib${pathname === item.href ? ' on' : ''}${item.danger ? ' nav-ib--danger' : ''}`}
            title={`${item.title}${pathname === item.href ? ' (actif)' : ''}`}
            aria-current={pathname === item.href ? 'page' : undefined}
          >
            <span className="ms" aria-hidden>{item.icon}</span>
            {item.badge && <em aria-hidden />}
          </Link>
        ))}

        <div className="who">
          <span className="ms" aria-hidden>shield_person</span>
          <div>
            <b>RAQIB</b>
            <small>Local runtime</small>
          </div>
        </div>
      </div>
    </header>
  );
}
