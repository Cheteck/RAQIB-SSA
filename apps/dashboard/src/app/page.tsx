'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function OverviewPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      {/* LEFT COLUMN (3 Cols): METRICS & COMMAND MODULES */}
      <div className="xl:col-span-3 flex flex-col gap-3">
        <div className="hud-panel rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
            <span className="text-xs font-mono text-primary tracking-wider uppercase font-semibold">Gouvernance Système</span>
            <span className="material-symbols-outlined text-[16px] text-primary-container">security</span>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40 flex items-center justify-between">
              <span className="text-outline font-mono text-[11px]">Runtime Status</span>
              <span id="runtime-status-badge" className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${status?.status === 'OK' ? 'bg-tertiary/20 text-tertiary border border-tertiary/40' : 'bg-error-container text-error border border-error/40'}`}>
                {loading ? 'CHARGEMENT...' : status?.status || 'INCONNU'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40 flex items-center justify-between">
              <span className="text-outline font-mono text-[11px]">Emergency Stop</span>
              <span id="emergency-status-badge" className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${status?.emergencyStop ? 'bg-error-container text-error border border-error/40 animate-pulse' : 'bg-tertiary/20 text-tertiary border border-tertiary/40'}`}>
                {status?.emergencyStop ? 'ACTIF (BLOCKED)' : 'INACTIF (NORMAL)'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40 flex items-center justify-between">
              <span className="text-outline font-mono text-[11px]">Mode Sécurité</span>
              <span id="mode-status-badge" className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${status?.readOnlyMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-primary-container/20 text-primary border border-primary-container/40'}`}>
                {status?.readOnlyMode ? 'LECTURE SEULE' : 'LECTURE / ÉCRITURE'}
              </span>
            </div>
          </div>
        </div>

        <div className="hud-panel rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
            <span className="text-xs font-mono text-primary tracking-wider uppercase font-semibold">Télémétrie Moteur</span>
            <span className="material-symbols-outlined text-[16px] text-tertiary">sensors</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/40 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">memory</span>
              <div className="flex flex-col">
                <span className="text-[9px] text-outline uppercase font-mono">SQLite DB</span>
                <span className="text-xs font-semibold text-primary">raqib.db</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/40 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-[18px]">shield</span>
              <div className="flex flex-col">
                <span className="text-[9px] text-outline uppercase font-mono">Rules</span>
                <span className="text-xs font-semibold text-tertiary">7 Inviolables</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER COLUMN (6 Cols): HOLOGRAPHIC COMMAND SPHERE */}
      <div className="xl:col-span-6 flex flex-col gap-3">
        <div className="hud-panel rounded-2xl p-6 relative overflow-hidden flex flex-col items-center justify-center min-h-[380px] holo-glow">
          <div className="absolute inset-0 bg-[radial-gradient(#42d9ff_0.75px,transparent_0.75px)] [background-size:20px_20px] opacity-15"></div>
          <div className="w-full flex items-center justify-between z-10 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-ping"></span>
              <span className="font-mono text-xs text-primary font-semibold tracking-widest uppercase">RAQIB GOVERNANCE CORE</span>
            </div>
            <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary border border-primary-container/30">
              v1.0.0 STABLE
            </span>
          </div>

          <div className="relative w-64 h-64 my-4 flex items-center justify-center select-none">
            <div className="relative z-10 w-44 h-44 rounded-full bg-[#0a1524]/90 border border-primary-container/60 backdrop-blur-md flex flex-col items-center justify-center text-center holo-glow-strong p-3">
              <div className="font-mono text-xs text-primary-fixed-dim tracking-wider font-semibold">RAQIB OS</div>
              <div className="text-xl font-bold tracking-widest text-primary neon-cyan-text my-0.5">COMMAND</div>
              <div className="font-mono text-[10px] text-tertiary">OPERATIONAL</div>
              <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-primary-container to-transparent mt-1"></div>
            </div>
          </div>

          <div className="z-10 mt-1 flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low/90 border border-primary-container/40 shadow-[0_0_12px_rgba(66,217,255,0.25)]">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              <span className="font-mono text-xs text-tertiary font-bold tracking-wider">SYSTEM STATUS: OPTIMAL</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low/90 border border-outline-variant/40">
              <span className="font-mono text-[11px] text-outline">API PORT:</span>
              <span className="font-mono text-[11px] text-primary font-semibold">4000</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN (3 Cols): QUICK ACTIONS & INSIGHTS */}
      <div className="xl:col-span-3 flex flex-col gap-3">
        <div className="hud-panel rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
            <span className="text-xs font-mono text-primary tracking-wider uppercase font-semibold">Contrôle Réseau & API</span>
            <span className="material-symbols-outlined text-[15px] text-outline">bolt</span>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40">
              <span className="text-[10px] font-mono text-outline block uppercase">CORS Allowed Origin</span>
              <span className="font-mono text-tertiary text-xs">http://localhost:3000</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40">
              <span className="text-[10px] font-mono text-outline block uppercase">API Base URL</span>
              <span className="font-mono text-primary text-xs">{API_BASE}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
