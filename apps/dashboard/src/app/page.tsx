'use client';

import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function OverviewPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [consoleMsg, setConsoleMsg] = useState('All systems nominal, Commander.');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ status: 'OFFLINE', emergencyStop: false, readOnlyMode: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // 3D Particle Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 300);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 300);

    const particles: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number }> = [];
    const count = 350;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        z: (Math.random() - 0.5) * 200,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4,
      });
    }

    let angleY = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      angleY += 0.008;

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);

      ctx.fillStyle = '#62e6ff';

      for (let i = 0; i < count; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        if (Math.abs(p.x) > 120) p.vx *= -1;
        if (Math.abs(p.y) > 120) p.vy *= -1;
        if (Math.abs(p.z) > 120) p.vz *= -1;

        const rx = p.x * cosY + p.z * sinY;
        const rz = -p.x * sinY + p.z * cosY;

        const scale = 220 / (220 + rz);
        const px = cx + rx * scale;
        const py = cy + p.y * scale;

        const size = Math.max(0.8, 1.8 * scale);
        const alpha = Math.min(1, Math.max(0.15, (rz + 120) / 240));

        ctx.fillStyle = `rgba(98, 230, 255, ${alpha.toFixed(2)})`;
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setConsoleMsg(`Directive executed: "${prompt}"`);
    setPrompt('');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN (3 Cols): TACTICAL MODULES & GAUGES */}
      <div className="xl:col-span-3 flex flex-col gap-4">
        <div className="hud-panel rounded-xl flex flex-col gap-3">
          <h3 className="flex items-baseline justify-between font-oxanium text-sm font-semibold text-white border-b border-[#62e6ff]/20 pb-2">
            System Governance <em>07 Rules Active</em>
          </h3>
          <div className="flex flex-col gap-2">
            <div className="p-2.5 rounded bg-[#0a1019] border border-white/10 flex justify-between items-center">
              <span className="font-mono text-xs text-[#7f95a6]">Runtime Service</span>
              <span id="runtime-status-badge" className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${status?.status === 'OK' ? 'bg-[#7dffc8]/20 text-[#7dffc8] border border-[#7dffc8]/40' : 'bg-red-900/40 text-red-300 border border-red-500/40'}`}>
                {loading ? 'CHECKING...' : status?.status || 'UNKNOWN'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-[#0a1019] border border-white/10 flex justify-between items-center">
              <span className="font-mono text-xs text-[#7f95a6]">Emergency Lock</span>
              <span id="emergency-status-badge" className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${status?.emergencyStop ? 'bg-red-900/40 text-red-300 border border-red-500/40 animate-pulse' : 'bg-[#7dffc8]/20 text-[#7dffc8] border border-[#7dffc8]/40'}`}>
                {status?.emergencyStop ? 'ARMED (BLOCKED)' : 'CLEAR (NORMAL)'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-[#0a1019] border border-white/10 flex justify-between items-center">
              <span className="font-mono text-xs text-[#7f95a6]">Governance Mode</span>
              <span id="mode-status-badge" className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${status?.readOnlyMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-[#62e6ff]/20 text-[#62e6ff] border border-[#62e6ff]/40'}`}>
                {status?.readOnlyMode ? 'READ-ONLY' : 'READ / WRITE'}
              </span>
            </div>
          </div>
        </div>

        <div className="hud-panel rounded-xl flex flex-col gap-3">
          <h3 className="flex items-baseline justify-between font-oxanium text-sm font-semibold text-white border-b border-[#62e6ff]/20 pb-2">
            Arc Telemetry <em>SQLite WAL</em>
          </h3>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="p-2 rounded bg-[#0a1019] border border-white/10 flex flex-col">
              <span className="text-[9px] text-[#7f95a6] uppercase">Database</span>
              <span className="text-white font-semibold mt-0.5">raqib.db</span>
            </div>
            <div className="p-2 rounded bg-[#0a1019] border border-white/10 flex flex-col">
              <span className="text-[9px] text-[#7f95a6] uppercase">PathGuard</span>
              <span className="text-[#7dffc8] font-semibold mt-0.5">ENABLED</span>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER COLUMN (6 Cols): SPHERICAL NEURAL CORE */}
      <div className="xl:col-span-6 flex flex-col gap-4 items-center">
        <div className="hud-panel w-full rounded-2xl p-6 relative overflow-hidden flex flex-col items-center justify-center min-h-[380px] holo-glow">
          <div className="w-full flex items-center justify-between border-b border-white/10 pb-2 mb-2 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#62e6ff] animate-ping"></span>
              <span className="font-oxanium text-xs font-bold tracking-widest text-[#62e6ff] uppercase">RAQIB NEURAL CORE</span>
            </div>
            <span className="font-mono text-[10px] px-2 py-0.5 border border-[#7dffc8]/40 text-[#7dffc8]">QUANTUM STABLE</span>
          </div>

          <div className="relative w-72 h-72 my-2 flex items-center justify-center">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-pointer"></canvas>
            <div className="relative z-10 w-44 h-44 rounded-full bg-[#0a1524]/90 border border-[#62e6ff]/60 backdrop-blur-md flex flex-col items-center justify-center text-center holo-glow-strong p-3">
              <div className="font-oxanium text-xs text-[#62e6ff] tracking-wider font-bold">RAQIB</div>
              <div className="font-oxanium text-xl font-bold tracking-widest text-white neon-cyan-text my-0.5">AI CORE</div>
              <div className="font-mono text-[10px] text-[#7dffc8]">3.8 GHz // 1.21 GW</div>
            </div>
          </div>

          <div className="z-10 mt-2 flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0a1019] border border-[#62e6ff]/40 shadow-[0_0_12px_rgba(98,230,255,0.25)]">
              <span className="w-2 h-2 rounded-full bg-[#7dffc8] animate-pulse"></span>
              <span className="font-mono text-xs text-[#7dffc8] font-bold tracking-wider">SYSTEM OPTIMAL</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0a1019] border border-white/14">
              <span className="font-mono text-[11px] text-[#7f95a6]">API LATENCY:</span>
              <span className="font-mono text-[11px] text-[#62e6ff] font-semibold">11ms</span>
            </div>
          </div>
        </div>

        {/* INTERACTIVE COMMAND DOCK */}
        <form onSubmit={handleCommandSubmit} className="w-full flex items-center gap-3 p-2 rounded-full bg-[#050a12]/90 border border-[#62e6ff]/50 backdrop-blur-xl shadow-[0_0_24px_rgba(98,230,255,0.25)]">
          <button type="button" className="w-10 h-10 rounded-full bg-[#62e6ff]/15 border border-[#62e6ff]/60 flex items-center justify-center text-[#62e6ff] hover:bg-[#62e6ff]/30 transition-all">
            <span className="material-symbols-outlined text-[20px]">mic</span>
          </button>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Speak or type a directive for RAQIB OS..."
            className="flex-1 bg-transparent border-0 text-white font-mono text-xs focus:outline-none placeholder-[#7f95a6]"
          />
          <kbd className="font-mono text-[10px] text-[#7f95a6] border border-white/14 px-2 py-0.5 rounded">⌘K</kbd>
        </form>
        <p className="font-mono text-xs text-[#62e6ff] text-center m-0">{consoleMsg}</p>
      </div>

      {/* RIGHT COLUMN (3 Cols): LIVE INTEL FEED */}
      <div className="xl:col-span-3 flex flex-col gap-4">
        <div className="hud-panel rounded-xl flex flex-col gap-3">
          <h3 className="flex items-baseline justify-between font-oxanium text-sm font-semibold text-white border-b border-[#62e6ff]/20 pb-2">
            Live Intelligence Stream <em>120 FPS</em>
          </h3>
          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="p-2.5 rounded border-l-2 border-l-[#62e6ff] bg-[#62e6ff]/5 flex flex-col gap-1">
              <span className="text-white font-semibold">PolicyEngine Routing</span>
              <span className="text-[#7f95a6] text-[11px]">policy_decision set to "none" (Zero LLM reliance)</span>
            </div>
            <div className="p-2.5 rounded border-l-2 border-l-[#7dffc8] bg-[#7dffc8]/5 flex flex-col gap-1">
              <span className="text-[#7dffc8] font-semibold">Audit Ledger Active</span>
              <span className="text-[#7f95a6] text-[11px]">Append-only SQLite event logger initialized</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
