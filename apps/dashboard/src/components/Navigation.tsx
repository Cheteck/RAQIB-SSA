'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const [clockStr, setClockStr] = useState<string>('--:--:--');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockStr(now.toLocaleTimeString('en-US', { hour12: true }));
      setDateStr(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <header className="relative z-30 w-full px-5 py-3 flex items-center justify-between border-b border-[#62e6ff]/20 bg-[#050912]/80 backdrop-blur-md">
      {/* LEFT: RAQIB HUD BRANDING */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg className="w-full h-full animate-radar text-[#62e6ff] opacity-80" viewBox="0 0 40 40">
              <circle cx="20" cy="20" fill="none" r="17" stroke="currentColor" strokeDasharray="8 6" strokeWidth="1.2"></circle>
              <circle cx="20" cy="20" fill="none" opacity="0.6" r="12" stroke="currentColor" strokeDasharray="2 4" strokeWidth="1"></circle>
              <line stroke="currentColor" strokeWidth="1.5" x1="20" x2="20" y1="2" y2="8"></line>
              <line stroke="currentColor" strokeWidth="1.5" x1="20" x2="20" y1="32" y2="38"></line>
              <line stroke="currentColor" strokeWidth="1.5" x1="2" x2="8" y1="20" y2="20"></line>
              <line stroke="currentColor" strokeWidth="1.5" x1="32" x2="38" y1="20" y2="20"></line>
            </svg>
            <span className="absolute w-2 h-2 rounded-full bg-[#62e6ff] shadow-[0_0_8px_#62e6ff]"></span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-hud font-bold text-lg tracking-widest glow-cyan leading-none">RAQIB</span>
              <span className="text-[9px] font-mono text-[#62e6ff] px-1.5 py-0.2 rounded border border-[#62e6ff]/50 uppercase tracking-widest bg-[#62e6ff]/10">MARK LXXXV</span>
              <span className="text-[9px] font-mono text-slate-400 px-1 py-0.2 rounded border border-slate-700 uppercase tracking-widest bg-slate-900/60">CORE v4.9.2</span>
            </div>
            <span className="text-[9px] font-mono tracking-wider text-slate-400 uppercase mt-0.5">Avengers Compound // strategic tactical HUD</span>
          </div>
        </Link>
      </div>

      {/* CENTER: OXANIUM CHRONOMETER */}
      <div className="flex flex-col items-center justify-center">
        <span className="text-[9px] font-mono text-slate-400 tracking-wider">{dateStr}</span>
        <div className="font-hud font-bold text-2xl tracking-widest glow-cyan my-[-2px]">{clockStr}</div>
        <span className="text-[9px] font-mono text-[#62e6ff]/70 tracking-widest">Africa/Lagos · sector 7G</span>
      </div>

      {/* RIGHT: NAVIGATION MODULES & PROFILE */}
      <div className="flex items-center gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <Link href="/" className={`px-2.5 py-1 rounded transition-colors ${isActive('/') ? 'bg-[#62e6ff]/20 text-[#62e6ff] border border-[#62e6ff]/50' : 'text-slate-400 hover:text-slate-200'}`}>
            Command
          </Link>
          <Link href="/missions" className={`px-2.5 py-1 rounded transition-colors ${isActive('/missions') ? 'bg-[#62e6ff]/20 text-[#62e6ff] border border-[#62e6ff]/50' : 'text-slate-400 hover:text-slate-200'}`}>
            Missions
          </Link>
          <Link href="/approvals" className={`px-2.5 py-1 rounded transition-colors ${isActive('/approvals') ? 'bg-[#62e6ff]/20 text-[#62e6ff] border border-[#62e6ff]/50' : 'text-slate-400 hover:text-slate-200'}`}>
            Approvals
          </Link>
          <Link href="/audit" className={`px-2.5 py-1 rounded transition-colors ${isActive('/audit') ? 'bg-[#62e6ff]/20 text-[#62e6ff] border border-[#62e6ff]/50' : 'text-slate-400 hover:text-slate-200'}`}>
            Audit
          </Link>
          <Link href="/settings" className={`px-2.5 py-1 rounded transition-colors ${isActive('/settings') ? 'bg-red-950/40 text-red-400 border border-red-500/40' : 'text-slate-400 hover:text-red-400'}`}>
            Emergency
          </Link>
        </div>

        {/* Stark Commander Profile Pill */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#0a1424] border border-[#62e6ff]/30">
          <div className="w-6 h-6 rounded bg-[#62e6ff]/15 border border-[#62e6ff]/50 flex items-center justify-center text-[#62e6ff]">
            <span className="material-symbols-outlined text-[14px]">shield</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-hud font-bold text-[11px] text-[#62e6ff] leading-none">T. STARK</span>
            <span className="text-[8px] font-mono text-slate-400 leading-tight">Commander</span>
          </div>
        </div>
      </div>
    </header>
  );
}
