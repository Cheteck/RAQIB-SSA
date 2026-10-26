'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function Navigation() {
  const pathname = usePathname();
  const [timeStr, setTimeStr] = useState<string>('--:--:--');
  const [dateStr, setDateStr] = useState<string>('');
  const [tzStr, setTzStr] = useState<string>('');
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US'));
      setDateStr(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    try {
      setTzStr(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {}

    fetch(`${API_BASE}/api/status`)
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(() => setStatus({ status: 'OFFLINE', emergencyStop: false }));

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="top">
      <div className="brand">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="#62e6ff">
          <circle cx="17" cy="17" r="15" strokeDasharray="4 3" opacity=".6">
            <animateTransform attributeName="transform" type="rotate" from="0 17 17" to="360 17 17" dur="14s" repeatCount="indefinite" />
          </circle>
          <circle cx="17" cy="17" r="9" />
          <circle cx="17" cy="17" r="3" fill="#7dffc8" stroke="none" />
        </svg>
        <div>
          <b>RAQIB</b>
          <span className="chip">WORKSPACE</span>
          <span className="chip d">PREVIEW</span>
          <small>Software engineering · Project workspace</small>
        </div>
      </div>

      <div className="clk">
        <small id="dt">{dateStr}</small>
        <b id="tm">{timeStr}</b>
        <small id="tz">{tzStr} · local</small>
      </div>

      <div className="tr">
        <span className={`pill ${status?.emergencyStop ? 'eng' : ''}`} id="def">
          <i className="dot"></i>
          <span id="dft">
            {status?.status === 'OK'
              ? status?.emergencyStop
                ? 'Arrêt d’urgence actif'
                : 'Espace de travail · mode démonstration'
              : 'Serveur hors ligne'}
          </span>
        </span>

        <Link href="/" className={`ib ${pathname === '/' ? 'on' : ''}`} title="Workspace">
          <span className="ms">grid_view</span>
        </Link>
        <Link href="/missions" className={`ib ${pathname === '/missions' ? 'on' : ''}`} title="Missions">
          <span className="ms">shield</span>
        </Link>
        <Link href="/audit" className={`ib ${pathname === '/audit' ? 'on' : ''}`} title="Audit Ledger">
          <span className="ms">sensors</span>
          <em></em>
        </Link>
        <Link href="/settings" className={`ib ${pathname === '/settings' ? 'on' : ''}`} title="Emergency Stop">
          <span className="ms">warning</span>
        </Link>

        <div className="who">
          <span className="ms">person</span>
          <div>
            <b>WORKSPACE</b>
            <small>Local preview</small>
          </div>
        </div>
      </div>
    </header>
  );
}
