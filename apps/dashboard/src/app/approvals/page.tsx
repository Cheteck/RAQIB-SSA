'use client';

export default function ApprovalsPage() {
  return (
    <div className="hud-panel rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[24px]">verified_user</span>
          <div>
            <h1 className="text-lg font-mono font-bold text-primary neon-cyan-text m-0">Gestion des Approbations</h1>
            <p className="text-xs text-on-surface-variant font-mono m-0">Autorisation d'actions sensibles et consommation à usage unique</p>
          </div>
        </div>
      </div>
      <div className="p-8 text-center bg-surface-container-low/50 rounded-xl border border-outline-variant/30">
        <span className="material-symbols-outlined text-outline text-[32px]">thumb_up</span>
        <p className="text-xs font-mono text-outline mt-2">Aucune demande d'approbation en attente.</p>
      </div>
    </div>
  );
}
