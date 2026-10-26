'use client';

import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function OverviewPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [echoText, setEchoText] = useState('› RAQIB OS initialized');
  const [outputText, setOutputText] = useState('At your service, sir. All systems nominal.');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ status: 'OFFLINE', emergencyStop: false, readOnlyMode: true }))
      .finally(() => setLoading(false));
  }, []);

  // 3D Fibonacci Canvas Sphere Rendering (Original JS logic from HTML template)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const PARTICLE_COUNT = 1100;
    const particles: Array<{ x: number; y: number; z: number; isAmber: boolean }> = [];
    const phi = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      const isAmber = Math.random() < 0.08;
      particles.push({ x, y, z, isAmber });
    }

    let rotationY = 0;
    let rotationX = 0.25;
    let animId: number;

    const renderSphere = () => {
      ctx.clearRect(0, 0, width, height);
      rotationY += 0.0025;
      const sphereRadius = Math.min(width, height) * 0.32;
      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.z * cosY + p.x * sinY;

        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.y * sinX;

        const depth = 2.2;
        const scale = 1 / (depth - z2 * 0.7);
        const projX = centerX + x1 * sphereRadius * scale;
        const projY = centerY + y2 * sphereRadius * scale;

        const alpha = Math.max(0.08, (z2 + 1) / 2);
        const size = Math.max(0.6, (z2 + 1.2) * 1.4);

        ctx.fillStyle = p.isAmber
          ? `rgba(245, 158, 11, ${alpha * 0.95})`
          : `rgba(98, 230, 255, ${alpha * 0.85})`;

        ctx.beginPath();
        ctx.arc(projX, projY, size, 0, Math.PI * 2);
        ctx.fill();
      }
      animId = requestAnimationFrame(renderSphere);
    };

    renderSphere();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleDirective = (cmd: string) => {
    if (!cmd.trim()) return;
    setEchoText(`› ${cmd}`);
    setOutputText(`Command received: "${cmd}". Runtime Status: ${status?.status || 'OK'}`);
    setPrompt('');
  };

  return (
    <>
      <canvas id="c" ref={canvasRef} aria-label="Noyau visuel RAQIB"></canvas>
      <div className="vg"></div>

      <div className="st">
        {/* LEFT RAIL */}
        <aside className="rail l" id="L">
          <section className="p" style={{ '--i': 0 } as any}>
            <h3>Modules de travail<em>{loading ? '...' : status?.status === 'OK' ? '08 ARMED' : 'OFFLINE'}</em></h3>
            <div className="mods">
              <button className="on"><span className="ms">terminal</span><span>Workspace</span></button>
              <button><span className="ms">account_tree</span><span>Architecture</span></button>
              <button><span className="ms">smart_toy</span><span>Agents</span><b>DEMO</b></button>
              <button><span className="ms">checklist</span><span>Backlog</span><b className="a">LOCAL</b></button>
              <button><span className="ms">history</span><span>Historique</span></button>
              <button><span className="ms">hub</span><span>Contexte projet</span></button>
            </div>
          </section>

          <section className="p" style={{ '--i': 1 } as any}>
            <h3>Gouvernance & Sécurité<em>Real Engine</em></h3>
            <div className="ag act">
              <span className="ms">shield</span>
              <div>
                <b>Policy Engine</b>
                <small id="runtime-status-badge">{status?.status || 'UNKNOWN'}</small>
              </div>
              <span className="eq"><i></i><i></i><i></i><i></i></span>
            </div>
            <div className="ag act">
              <span className="ms">warning</span>
              <div>
                <b>Emergency Lock</b>
                <small id="emergency-status-badge">{status?.emergencyStop ? 'ARMED' : 'CLEAR'}</small>
              </div>
              <span className="eq"><i></i><i></i><i></i><i></i></span>
            </div>
          </section>

          <section className="p" style={{ '--i': 2 } as any}>
            <h3>Indicateurs Runtime<em>RAQIB Core</em></h3>
            <div className="gs">
              <div className="g" style={{ color: 'rgb(98,230,255)' }}>
                <svg viewBox="0 0 36 36">
                  <circle className="b" cx="18" cy="18" r="15.9" />
                  <circle className="f" cx="18" cy="18" r="15.9" stroke="rgb(98,230,255)" style={{ strokeDasharray: '32 100' }} />
                </svg>
                <b>32%</b>
                <small>Rules</small>
              </div>
              <div className="g" style={{ color: 'rgb(125,255,200)' }}>
                <svg viewBox="0 0 36 36">
                  <circle className="b" cx="18" cy="18" r="15.9" />
                  <circle className="f" cx="18" cy="18" r="15.9" stroke="rgb(125,255,200)" style={{ strokeDasharray: '65 100' }} />
                </svg>
                <b>65%</b>
                <small>Memory</small>
              </div>
              <div className="g" style={{ color: 'rgb(255,179,71)' }}>
                <svg viewBox="0 0 36 36">
                  <circle className="b" cx="18" cy="18" r="15.9" />
                  <circle className="f" cx="18" cy="18" r="15.9" stroke="rgb(255,179,71)" style={{ strokeDasharray: '98 100' }} />
                </svg>
                <b>98%</b>
                <small>Reactor</small>
              </div>
            </div>
          </section>
        </aside>

        {/* CENTER STAGE */}
        <section className="mid">
          <div className="hd">
            <span id="sl"><i className="dot"></i><span id="st">STANDBY</span></span>
            <h1>RAQIB</h1>
            <small>Development workspace · project data connected · local runtime port 4000</small>
          </div>
          <div className="bt">
            <small id="echo">{echoText}</small>
            <div id="out" aria-live="polite">{outputText}</div>
            <section className="p tl" id="TL" style={{ '--i': 5 } as any}>
              <h3>Mission chronos<em>active deck · 4 objectives</em></h3>
              <div className="tm d"><i></i><b>Initialisation du Runtime</b><small>09:30 AM · Done</small></div>
              <div className="tm n"><i></i><b>Vérification Policy Engine</b><small>12:00 PM · In progress</small></div>
              <div className="tm"><i></i><b>Audit Ledger Verification</b><small>02:00 PM · Queued</small></div>
              <div className="tm"><i></i><b>Validation finale MVP</b><small>04:30 PM · Queued</small></div>
            </section>
          </div>
        </section>

        {/* RIGHT RAIL */}
        <aside className="rail r" id="R">
          <section className="p" style={{ '--i': 3 } as any}>
            <h3>Journal d’activité<em>Audit Engine</em></h3>
            <div className="feed" id="fd">
              <div className="fi">
                <header><span>System Initialization</span><em>LOG</em></header>
                <p>RAQIB Autonomous Runtime Service running on port 4000.</p>
                <small>11:15 AM · RAQIB core</small>
              </div>
              <div className="fi w">
                <header><span>Emergency Stop Status</span><em>STATUS</em></header>
                <p>{status?.emergencyStop ? 'Emergency stop active: write actions locked.' : 'Emergency stop inactive: normal mode.'}</p>
                <small>10:54 AM · Safety</small>
              </div>
            </div>
          </section>

          <section className="p" style={{ '--i': 4 } as any}>
            <h3>Actions rapides<em>Directives</em></h3>
            <div className="dir">
              <button onClick={() => handleDirective("Analyse l’architecture du projet")}><span className="ms">account_tree</span><span>Analyser l’architecture</span></button>
              <button onClick={() => handleDirective("Découpe cette fonctionnalité en tâches")}><span className="ms">checklist</span><span>Découper une tâche</span></button>
              <button onClick={() => handleDirective("Prépare une stratégie de tests")}><span className="ms">bug_report</span><span>Préparer les tests</span></button>
              <button onClick={() => handleDirective("Prépare la prochaine release")}><span className="ms">rocket_launch</span><span>Préparer release</span></button>
            </div>
          </section>

          <section className="p" style={{ '--i': 5 } as any}>
            <h3>Réseau de contexte<em>Graph</em></h3>
            <div className="cs">
              <svg id="cn" viewBox="0 0 100 80">
                <line x1="12" y1="16" x2="36" y2="8" />
                <line x1="36" y1="8" x2="60" y2="18" />
                <line x1="60" y1="18" x2="88" y2="10" />
                <line x1="20" y1="42" x2="46" y2="34" />
                <circle cx="12" cy="16" r="2.4" />
                <circle cx="36" cy="8" r="1.6" />
                <circle cx="60" cy="18" r="2.4" />
                <circle cx="88" cy="10" r="1.6" />
              </svg>
              <div>
                <small>Activité locale</small>
                <b id="vc">25</b>
                <small><span id="tn">25</span> tests PASS · 100% PASS</small>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* DOCK */}
      <footer className="dock">
        <div className="env">
          <small>Local grid · <span>Africa/Lagos</span></small>
          <small>Weather · <span>28°C overcast</span></small>
          <small>Execution · <span>RAQIB Autonomous Engine</span></small>
        </div>

        <div className="cm">
          <form className="cmd" onSubmit={(e) => { e.preventDefault(); handleDirective(prompt); }}>
            <button type="button" className="mic" id="mic">
              <span className="ms">mic</span>
            </button>
            <div className="wv" id="wv">
              <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
            <input
              id="q"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Demande à RAQIB : analyser un projet, planifier une fonctionnalité…"
            />
            <kbd>⌘K</kbd>
          </form>

          <div className="chips">
            <button onClick={() => handleDirective("Analyse l’architecture du projet")}>Analyse l’architecture</button>
            <button onClick={() => handleDirective("Découpe cette fonctionnalité en tâches")}>Découper une fonctionnalité</button>
            <button onClick={() => handleDirective("Prépare une stratégie de tests")}>Préparer les tests</button>
            <button onClick={() => handleDirective("Prépare la prochaine release")}>Préparer une release</button>
          </div>
        </div>

        <button className="bf" onClick={() => handleDirective("Synthèse projet")}>
          <span className="ms">summarize</span><span>Synthèse projet</span>
        </button>
      </footer>
    </>
  );
}
