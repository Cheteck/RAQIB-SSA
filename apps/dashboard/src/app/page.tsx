'use client';

import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function OverviewPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [feedback, setFeedback] = useState('At your service, sir. All systems nominal.');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(() => setStatus({ status: 'OFFLINE', emergencyStop: false, readOnlyMode: true }))
      .finally(() => setLoading(false));
  }, []);

  // 3D Fibonacci Particle Sphere Animation from Stitch
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

  const handleDirectiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setFeedback(`Directive acknowledged, sir: "${prompt}"`);
    setPrompt('');
  };

  return (
    <div className="relative flex-1 w-full flex flex-col justify-between overflow-hidden">
      {/* 3D Fibonacci Sphere Canvas */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(98,230,255,0.08)_0%,rgba(6,13,24,0.45)_55%,#04060b_88%)]"></div>
        <canvas ref={canvasRef} className="w-full h-full opacity-90"></canvas>
      </div>

      {/* Main Grid Content */}
      <main className="relative z-20 flex-1 w-full px-5 py-2 grid grid-cols-12 gap-4 items-stretch overflow-hidden">
        {/* Left Wing */}
        <section className="col-span-12 xl:col-span-3 flex flex-col gap-2.5 justify-between h-full max-h-[calc(100vh-140px)] overflow-y-auto">
          <div className="hud-cut-card p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-[#62e6ff]/15">
              <span className="font-hud text-xs font-semibold text-[#62e6ff] tracking-wider uppercase">Tactical modules</span>
              <span className="text-[9px] font-mono text-[#62e6ff]/80 px-1.5 py-0.2 rounded bg-[#62e6ff]/10 border border-[#62e6ff]/30">08 armed</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
              <div className="p-2 rounded bg-slate-900/80 border border-[#62e6ff]/40 flex flex-col gap-1">
                <span className="text-slate-400 text-[10px]">Runtime Service</span>
                <span id="runtime-status-badge" className={`font-mono text-xs font-bold ${status?.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {loading ? 'CHECKING...' : status?.status || 'UNKNOWN'}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-[#62e6ff]/40 flex flex-col gap-1">
                <span className="text-slate-400 text-[10px]">Emergency Lock</span>
                <span id="emergency-status-badge" className={`font-mono text-xs font-bold ${status?.emergencyStop ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                  {status?.emergencyStop ? 'ARMED' : 'CLEAR'}
                </span>
              </div>
            </div>
          </div>

          <div className="hud-cut-card p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-[#62e6ff]/15">
              <span className="font-hud text-xs font-semibold text-[#62e6ff] tracking-wider uppercase">Arc Telemetry</span>
              <span className="text-[9px] font-mono text-[#62e6ff]/80">3.8 GHz · 16 cores</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="flex flex-col items-center">
                <span className="font-hud font-bold text-xs text-[#62e6ff]">32%</span>
                <span className="text-[9px] font-mono text-slate-400 uppercase">Synapse</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-hud font-bold text-xs text-emerald-400">65%</span>
                <span className="text-[9px] font-mono text-slate-400 uppercase">Memory</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-hud font-bold text-xs text-amber-400 glow-amber">98%</span>
                <span className="text-[9px] font-mono text-slate-400 uppercase">Reactor</span>
              </div>
            </div>
          </div>
        </section>

        {/* Center Wing */}
        <section className="col-span-12 xl:col-span-6 flex flex-col justify-between items-center text-center relative pointer-events-none py-4">
          <div className="flex flex-col items-center gap-1 z-20 pointer-events-auto">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#62e6ff]/10 border border-[#62e6ff]/40 text-[9px] font-mono text-[#62e6ff] tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#62e6ff] animate-ping"></span>
              <span>STANDBY</span>
            </div>
            <h1 className="font-hud font-extrabold text-4xl sm:text-5xl tracking-[0.45em] text-white my-1 drop-shadow-[0_0_24px_rgba(98,230,255,0.5)]">
              R.A.Q.I.B
            </h1>
            <p className="text-[10px] font-mono text-[#62e6ff]/80 tracking-wider max-w-xl px-4 leading-relaxed">
              Arc core · 98.4% flux · Stark-Sat 09 online · quantum core 1.21 GW · repulsor matrix 100% · neural load 18.4 TFLOPS · Shield-512 · 42.894°N 71.021°W
            </p>
          </div>

          <div className="flex-1 w-full min-h-[220px]"></div>

          <div className="z-20 pointer-events-auto mb-2">
            <div className="px-5 py-2 rounded-full bg-[#050b14]/75 backdrop-blur-md border border-[#62e6ff]/30 shadow-[0_0_20px_rgba(98,230,255,0.15)] flex items-center gap-1.5">
              <span className="text-sm font-mono text-[#62e6ff] tracking-wide">
                {feedback}<span className="inline-block w-2 h-4 bg-[#62e6ff] ml-1 cursor-blink align-middle"></span>
              </span>
            </div>
          </div>
        </section>

        {/* Right Wing */}
        <section className="col-span-12 xl:col-span-3 flex flex-col gap-2.5 justify-between h-full max-h-[calc(100vh-140px)] overflow-y-auto">
          <div className="hud-cut-card p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-[#62e6ff]/15">
              <span className="font-hud text-xs font-semibold text-[#62e6ff] tracking-wider uppercase">Live Intel Stream</span>
              <span className="text-[9px] font-mono text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-950/40 border border-emerald-500/30">secure · 120 fps</span>
            </div>
            <div className="p-2 rounded bg-slate-900/60 border border-[#62e6ff]/25 flex flex-col gap-1 text-[10px]">
              <span className="text-slate-200 font-medium">PolicyEngine Governance</span>
              <span className="text-slate-400 text-[9px]">Routing policy_decision set to none (No AI decision making)</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Dock */}
      <footer className="relative z-30 w-full px-5 py-2.5 bg-[#050912]/90 backdrop-blur-xl border-t border-[#62e6ff]/20 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
          <div>Local grid · <span className="text-[#62e6ff]">Africa/Lagos</span></div>
          <span className="text-slate-700">|</span>
          <div>Satellite link · <span className="text-emerald-400 font-medium">5G quantum</span></div>
        </div>

        <form onSubmit={handleDirectiveSubmit} className="flex-1 max-w-2xl w-full flex items-center justify-between px-3 py-1.5 rounded-full bg-[#081322] border border-[#62e6ff]/50 shadow-[0_0_20px_rgba(98,230,255,0.25)] focus-within:border-[#62e6ff] transition-all">
          <button type="button" className="w-7 h-7 rounded-full bg-[#62e6ff]/20 border border-[#62e6ff]/70 flex items-center justify-center text-[#62e6ff] hover:bg-[#62e6ff] hover:text-black transition-colors">
            <span className="material-symbols-outlined text-[16px]">mic</span>
          </button>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-transparent border-none text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none w-full px-2 font-mono"
            placeholder="Speak or type a directive…"
          />
          <kbd className="text-[9px] font-mono text-[#62e6ff]/80 bg-slate-900 px-1.5 py-0.5 rounded border border-[#62e6ff]/30">⌘K</kbd>
        </form>

        <button onClick={() => setFeedback("Executive Briefing: All 25/25 system tests PASS.")} className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500 text-amber-400 font-hud text-xs font-semibold tracking-wider shadow-[0_0_16px_rgba(245,158,11,0.3)] transition-all">
          <span className="material-symbols-outlined text-[16px]">play_circle</span>
          <span>Executive Briefing</span>
        </button>
      </footer>
    </div>
  );
}
