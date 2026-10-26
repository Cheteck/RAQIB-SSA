'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const [timeStr, setTimeStr] = useState<string>('--:--:--');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US'));
      setDateStr(now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full h-[58px] bg-[#04060b]/90 backdrop-blur-xl border-b border-primary-container/20 px-6 flex items-center justify-between shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
      {/* BRAND & LOGO */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <svg width="32" height="32" viewBox="0 0 34 34" fill="none" stroke="#62e6ff">
            <circle cx="17" cy="17" r="15" strokeDasharray="4 3" opacity=".6">
              <animateTransform attributeName="transform" type="rotate" from="0 17 17" to="360 17 17" dur="14s" repeatCount="indefinite" />
            </circle>
            <circle cx="17" cy="17" r="9" />
            <circle cx="17" cy="17" r="3" fill="#7dffc8" stroke="none" />
          </svg>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-oxanium text-lg font-bold tracking-widest text-white neon-cyan-text">RAQIB AI</span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 border border-[#7dffc8]/40 text-[#7dffc8]">MARK LXXXV</span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 border border-white/14 text-[#7f95a6]">OS v1.0</span>
            </div>
            <span className="font-mono text-[9px] tracking-widest text-[#7f95a6] uppercase">STRATEGIC GOVERNANCE TACTICAL HUD</span>
          </div>
        </Link>
      </div>

      {/* CENTER CLOCK */}
      <div className="hidden md:flex flex-col items-center">
        <span className="font-mono text-[9px] text-[#7f95a6] tracking-widest uppercase">{dateStr}</span>
        <span className="font-oxanium text-2xl font-light tracking-widest text-white neon-cyan-text">{timeStr}</span>
      </div>

      {/* MODULE LINKS & OPERATOR */}
      <div className="flex items-center gap-2">
        <Link href="/" className={`px-3 py-1.5 font-mono text-xs font-medium transition-all ${isActive('/') ? 'text-white border-b-2 border-[#62e6ff] bg-[#62e6ff]/10' : 'text-[#7f95a6] hover:text-white'}`}>
          Command Core
        </Link>
        <Link href="/missions" className={`px-3 py-1.5 font-mono text-xs font-medium transition-all ${isActive('/missions') ? 'text-white border-b-2 border-[#62e6ff] bg-[#62e6ff]/10' : 'text-[#7f95a6] hover:text-white'}`}>
          Missions
        </Link>
        <Link href="/approvals" className={`px-3 py-1.5 font-mono text-xs font-medium transition-all ${isActive('/approvals') ? 'text-white border-b-2 border-[#62e6ff] bg-[#62e6ff]/10' : 'text-[#7f95a6] hover:text-white'}`}>
          Approvals
        </Link>
        <Link href="/audit" className={`px-3 py-1.5 font-mono text-xs font-medium transition-all ${isActive('/audit') ? 'text-white border-b-2 border-[#62e6ff] bg-[#62e6ff]/10' : 'text-[#7f95a6] hover:text-white'}`}>
          Audit Ledger
        </Link>
        <Link href="/settings" className={`px-3 py-1.5 font-mono text-xs font-medium transition-all ${isActive('/settings') ? 'text-[#ff6b5e] border-b-2 border-[#ff6b5e] bg-[#ff6b5e]/10' : 'text-[#7f95a6] hover:text-[#ff6b5e]'}`}>
          Emergency
        </Link>

        {/* OPERATOR PILL */}
        <div className="flex items-center gap-2 pl-3 ml-2 border-l border-white/10">
          <span className="material-symbols-outlined text-[#62e6ff] text-[20px]">shield_person</span>
          <div className="flex flex-col text-left">
            <span className="font-oxanium text-xs font-semibold text-white tracking-wide">F. OPERATOR</span>
            <span className="font-mono text-[9px] text-[#7f95a6]">Commander</span>
          </div>
        </div>
      </div>
    </header>
  );
}
