'use client';

import { useState, useEffect } from 'react';
import { useHud } from './HudContext';

export default function HUDHeader() {
  const { defenseText, defenseEng, online, go } = useHud();
  const [time, setTime] = useState('--:--:--');
  const [date, setDate] = useState('');
  const [tz, setTz] = useState('');
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('en-US'));
      setDate(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTz(tzName + ' · sector 7G');
    return () => clearInterval(id);
  }, []);

  const toggleFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    document.body.classList.toggle('fm');
    e.currentTarget.classList.toggle('on');
    setFocus(!focus);
  };

  const defenseLine = online
    ? defenseText
    : 'Runtime link down · standing by';

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
          <span className="chip">MARK LXXXV</span>
          <span className="chip d">CORE v4.9.2</span>
          <small>MosaiX // strategic tactical HUD</small>
        </div>
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
        <button className="ib" title="Focus mode — hide panels" onClick={toggleFocus}>
          <span className="ms">grid_view</span>
        </button>
        <button className="ib" title="Armor diagnostic" onClick={() => go('Engage Defense Protocol')}>
          <span className="ms">shield</span>
        </button>
        <button className="ib" title="Global alerts" onClick={() => go('Analyze Threat Vector')}>
          <span className="ms">sensors</span>
          <em></em>
        </button>
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
