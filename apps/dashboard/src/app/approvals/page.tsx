'use client';

export default function ApprovalsPage() {
  return (
    <div className="hud-panel rounded-2xl flex flex-col gap-4">
      <h3 className="flex items-baseline justify-between font-oxanium text-base font-semibold text-white border-b border-[#62e6ff]/20 pb-3">
        Gestion des Approbations <em>Single-Use Authorization</em>
      </h3>
      <div className="p-8 text-center bg-[#0a1019] rounded-xl border border-white/10">
        <p className="text-xs font-mono text-[#7f95a6] m-0">Aucune demande d'approbation en attente.</p>
      </div>
    </div>
  );
}
