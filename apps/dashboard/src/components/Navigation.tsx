'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full h-14 bg-[#0a111c]/90 backdrop-blur-xl border-b border-primary-container/20 px-4 flex items-center justify-between shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
      {/* LEFT: BRAND + SYSTEM STATUS */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 rounded-lg bg-primary-container/15 border border-primary-container/40 flex items-center justify-center text-primary-container shadow-[0_0_12px_rgba(66,217,255,0.3)]">
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-widest text-primary neon-cyan-text">RAQIB</span>
              <span className="text-[10px] text-outline font-mono px-1 py-0.5 rounded bg-surface-container-high border border-outline-variant">OS v1.0</span>
            </div>
            <span className="text-[9px] font-mono tracking-widest text-on-surface-variant uppercase">AI COMMAND CENTER</span>
          </div>
        </Link>

        {/* SYSTEM STATUS PILL */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low/90 border border-tertiary/30 shadow-[0_0_10px_rgba(114,253,196,0.15)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
          </span>
          <span className="font-mono text-[11px] text-tertiary font-semibold tracking-wider uppercase">GOVERNANCE ENGINE ACTIVE</span>
        </div>
      </div>

      {/* CENTER: MODULE LINKS */}
      <div className="flex items-center gap-2">
        <Link href="/" className={`px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all ${isActive('/') ? 'bg-primary-container/15 text-primary border border-primary-container/40 shadow-[0_0_10px_rgba(66,217,255,0.2)]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>
          Vue Générale
        </Link>
        <Link href="/missions" className={`px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all ${isActive('/missions') ? 'bg-primary-container/15 text-primary border border-primary-container/40 shadow-[0_0_10px_rgba(66,217,255,0.2)]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>
          Missions
        </Link>
        <Link href="/approvals" className={`px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all ${isActive('/approvals') ? 'bg-primary-container/15 text-primary border border-primary-container/40 shadow-[0_0_10px_rgba(66,217,255,0.2)]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>
          Approbations
        </Link>
        <Link href="/audit" className={`px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all ${isActive('/audit') ? 'bg-primary-container/15 text-primary border border-primary-container/40 shadow-[0_0_10px_rgba(66,217,255,0.2)]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>
          Audit Ledger
        </Link>
        <Link href="/settings" className={`px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all ${isActive('/settings') ? 'bg-error-container/30 text-error border border-error/40 shadow-[0_0_10px_rgba(255,180,171,0.2)]' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>
          Urgence & Parameters
        </Link>
      </div>

      {/* RIGHT: COMMANDER PROFILE */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 pl-1 py-0.5 pr-2.5 rounded-full bg-surface-container-low border border-primary-container/20">
          <div className="w-7 h-7 rounded-full bg-primary-container/20 border border-primary-container/40 flex items-center justify-center text-primary-container">
            <span className="material-symbols-outlined text-[17px]">account_circle</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-mono text-[11px] font-semibold text-primary leading-tight">Commander</span>
            <span className="text-[9px] font-mono text-outline leading-none">Fondateur Operator</span>
          </div>
        </div>
      </div>
    </header>
  );
}
