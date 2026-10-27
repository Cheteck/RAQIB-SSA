'use client';

import { useState, useEffect } from 'react';
import { useHud } from '../components/HudContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const MODS = [
  ['terminal', 'Command Center'],
  ['neurology', 'Neural Core'],
  ['smart_toy', 'Fleet Agents', 6],
  ['warning', 'Priorities', 3, 'a'],
  ['calendar_month', 'Chronos Log'],
  ['hub', 'Quantum Mem'],
];

const FL = [
  ['code', 'Coding Unit', 'AUTONOMOUS', 1],
  ['search_insights', 'Aegis Intel', 'SCANNING', 1],
  ['hub', 'Quantum Mem', 'IDLE', 0],
  ['shield', 'Shield Daemon', 'ARMED', 0],
];

const EN = [
  ['Claude Opus', 'Synchronized'],
  ['Groq LPU', 'Ultra-low lat'],
  ['Cursor IDE', 'Active link'],
  ['Copilot Core', 'Paired'],
];

const DIR = [
  ['shield', 'Defense Protocol'],
  ['explore', 'Orbital Recon'],
  ['energy_program_saving', 'Arc Overcharge'],
  ['flight_takeoff', 'Mark 85 Deploy'],
];

const TLN = [
  ['d', 'Daily Global Intelligence Brief', '09:30 AM', 'Done'],
  ['n', 'Finalize HUD Holographic Spacing', '12:00 PM', 'In 42 min'],
  ['', 'Vocal Pipeline Calibration', '02:00 PM', 'In 2h 42m'],
  ['', 'Avengers Command Center Review', '04:30 PM', 'In 5h 12m'],
];

const NP = [
  [12, 16], [36, 8], [60, 18], [88, 10], [20, 42], [46, 34],
  [72, 44], [94, 36], [10, 68], [34, 60], [58, 70], [84, 66],
];

export default function OverviewPage() {
  const { statusLabel, output, echo, feed, turns, vectors, go } = useHud();
  const [status, setStatus] = useState<any>(null);
  const [activeMod, setActiveMod] = useState('Command Center');
  const [gauges, setGauges] = useState([18, 54, 92]);

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus({ status: 'OFFLINE', emergencyStop: false, readOnlyMode: true }));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setGauges(([a, b, c]) => [
        Math.min(98, Math.max(8, a + (Math.random() - 0.5) * 6)),
        Math.min(90, Math.max(30, b + (Math.random() - 0.5) * 4)),
        Math.min(99, Math.max(85, c + (Math.random() - 0.5) * 2)),
      ]);
    }, 1600);
    return () => clearInterval(id);
  }, []);

  const edges: JSX.Element[] = [];
  NP.forEach((a, i) =>
    NP.forEach((b, j) => {
      if (j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < 30) {
        edges.push(
          <line key={`e-${i}-${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        );
      }
    })
  );

  return (
    <div className="st">
      {/* LEFT RAIL */}
      <aside className="rail l">
        {/* Tactical modules */}
        <section className="p">
          <h3>
            Tactical modules<em>08 armed</em>
          </h3>
          <div className="mods">
            {MODS.map(([icon, label, badge, badgeStyle]) => (
              <button
                key={label as string}
                className={activeMod === label ? 'on' : ''}
                onClick={() => {
                  setActiveMod(label as string);
                  go(`module: ${label}`);
                }}
              >
                <span className="ms">{icon}</span>
                <span>{label}</span>
                {badge && <b className={badgeStyle as string}>{badge}</b>}
              </button>
            ))}
          </div>
        </section>

        {/* Neural fleet */}
        <section className="p">
          <h3>
            Neural fleet<em>6 synced · stream 98%</em>
          </h3>
          {FL.map(([icon, name, state, active]) => (
            <div key={name as string} className={`ag${active ? ' act' : ''}`}>
              <span className="ms">{icon}</span>
              <div>
                <b>{name}</b>
                <small>{state}</small>
              </div>
              <span className="eq">
                <i></i><i></i><i></i><i></i>
              </span>
            </div>
          ))}
          <div className="eng">
            {EN.map(([name, statusText]) => (
              <div key={name} className="en">
                <i className="dot"></i>
                <b>{name}</b>
                <small>{statusText}</small>
              </div>
            ))}
          </div>
        </section>

        {/* Arc telemetry */}
        <section className="p">
          <h3>
            Arc telemetry<em>3.8 GHz · 16 cores</em>
          </h3>
          <div className="gs">
            {[
              ['Synapse', '#62e6ff', gauges[0]],
              ['Memory', '#7dffc8', gauges[1]],
              ['Reactor', '#ffb347', gauges[2]],
            ].map(([label, color, val], i) => (
              <div key={label as string} className="g" style={{ color: color as string }}>
                <svg viewBox="0 0 36 36">
                  <circle className="b" cx="18" cy="18" r="15.9" />
                  <circle
                    className="f"
                    cx="18"
                    cy="18"
                    r="15.9"
                    stroke={color as string}
                    style={{ strokeDasharray: `${(val as number).toFixed(1)} 100` }}
                  />
                </svg>
                <b>{Math.round(val as number)}%</b>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </section>
      </aside>

      {/* CENTER STAGE */}
      <section className="mid">
        <div className="hd">
          <span className="sl">
            <i className="dot"></i>
            <span>{statusLabel}</span>
          </span>
          <h1>RAQIB</h1>
          <small>
            Arc core · {gauges[2].toFixed(1)}% flux · Stark-Sat 09 online · quantum core 1.21 GW ·
            repulsor matrix 100% · neural load 18.4 TFLOPS · Shield-512 · 42.894°N 71.021°W
          </small>
        </div>

        <div className="bt">
          <small className="echo">{echo}</small>
          <div className="out" aria-live="polite">
            {output || 'At your service, Commander. All systems nominal.'}
          </div>

          <section className="p tl">
            <h3>
              Mission chronos<em>active deck · 4 objectives</em>
            </h3>
            {TLN.map(([cls, title, timeStr, dueStr], idx) => (
              <div key={idx} className={`tm ${cls}`}>
                <i></i>
                <b>{title}</b>
                <small>
                  {timeStr} · {dueStr}
                </small>
              </div>
            ))}
          </section>
        </div>
      </section>

      {/* RIGHT RAIL */}
      <aside className="rail r">
        {/* Live intel feed */}
        <section className="p">
          <h3>
            Live intel stream<em>secure · 120 fps</em>
          </h3>
          <div className="feed">
            {feed.length === 0 ? (
              <>
                <div className="fi w">
                  <header>
                    <span>Voice pipeline benchmark delay</span>
                    <em>WARN</em>
                  </header>
                  <p>
                    Acoustic synthesis latency exceeded 15ms target. RAQIB auto-rerouting to Groq
                    LPU.
                  </p>
                  <small>
                    10:54 AM · overdue
                    <button onClick={() => go('Authorize fix')}>Authorize fix</button>
                  </small>
                </div>
                <div className="fi">
                  <header>
                    <span>Runtime Service Status</span>
                    <em>{status?.status || 'OK'}</em>
                  </header>
                  <p>
                    PolicyEngine operating in{' '}
                    {status?.readOnlyMode ? 'READ-ONLY' : 'READ/WRITE'} mode. Emergency stop{' '}
                    {status?.emergencyStop ? 'ARMED' : 'CLEAR'}.
                  </p>
                  <small>Live runtime feed</small>
                </div>
              </>
            ) : (
              feed.map((item) => (
                <div key={item.key} className={`fi${item.w ? ' w' : ''}`}>
                  <header>
                    <span>{item.title}</span>
                    <em>{item.tag}</em>
                  </header>
                  <p>{item.body}</p>
                  <small>{item.meta}</small>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Combat directives */}
        <section className="p">
          <h3>
            Combat &amp; flight directives<em>hotkeys armed</em>
          </h3>
          <div className="dir">
            {DIR.map(([icon, label]) => (
              <button key={label} onClick={() => go(label)}>
                <span className="ms">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Neural constellation */}
        <section className="p">
          <h3>
            Neural constellation<em>{vectors.toLocaleString('en-US')} synapses</em>
          </h3>
          <div className="cs">
            <svg viewBox="0 0 100 80">
              {edges}
              {NP.map((p, i) => (
                <circle
                  key={i}
                  cx={p[0]}
                  cy={p[1]}
                  r={i % 4 ? 1.6 : 2.4}
                  style={{ animationDelay: `${i * 0.35}s` }}
                />
              ))}
            </svg>
            <div>
              <small>Quantum vectors</small>
              <b>{vectors.toLocaleString('en-US')}</b>
              <small>
                <span>{turns}</span> turns · 14 tools
              </small>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
