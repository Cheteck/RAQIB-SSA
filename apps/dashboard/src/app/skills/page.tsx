'use client';

import { useState } from 'react';
import { useSkills } from '../../hooks/useSkills';

export default function SkillsPage() {
  const { skills, loading, executeSkill } = useSkills();
  const [output, setOutput] = useState<any>(null);
  const [executing, setExecuting] = useState(false);

  const handleExecute = async (name: string) => {
    setExecuting(true);
    try {
      const res = await executeSkill(name, {});
      setOutput(res);
    } catch (err: any) {
      setOutput({ error: err.message });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-[#203548] pb-4">
        <h2 className="text-xl font-bold tracking-wider text-[#62e6ff]">SKILLS REGISTRY // COMPETENCES SANDBOXÉES</h2>
        <p className="text-xs text-[#8aa5b8] mt-1">
          Catalogue de compétences découvertes dynamiquement et exécutées dans le Tool Gateway.
        </p>
      </header>

      {loading ? (
        <div className="p-8 text-center text-xs text-[#8aa5b8] animate-pulse">Chargement des compétences...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#7dffc8] tracking-wider">COMPÉTENCES DISPONIBLES</h3>
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="border border-[#203548] bg-[#09131d]/80 p-3 rounded space-y-2 hover:border-[#62e6ff]/50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#62e6ff]">{skill.name}</span>
                  <span className="text-[10px] bg-[#203548] px-2 py-0.5 rounded text-emerald-400">
                    {skill.requiredPermission || 'SANDBOX'}
                  </span>
                </div>
                <p className="text-xs text-[#8aa5b8]">{skill.description}</p>
                <button
                  onClick={() => handleExecute(skill.name)}
                  disabled={executing}
                  className="w-full bg-[#203548] hover:bg-[#62e6ff]/20 text-[#62e6ff] border border-[#62e6ff]/30 py-1 rounded text-xs transition-colors"
                >
                  Exécuter la Compétence
                </button>
              </div>
            ))}
          </div>

          <div className="border border-[#203548] bg-[#09131d]/80 p-4 rounded space-y-3">
            <h3 className="text-xs font-bold text-[#7dffc8] tracking-wider">RÉSULTAT D'EXÉCUTION</h3>
            {executing ? (
              <div className="p-4 text-center text-xs text-[#8aa5b8] animate-pulse">Exécution du skill en cours...</div>
            ) : output ? (
              <pre className="p-3 bg-[#04060b] text-[#d9e6ef] font-mono text-xs overflow-x-auto rounded border border-[#203548]">
                {JSON.stringify(output, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-[#8aa5b8] italic">Sélectionnez et exécutez un skill pour observer le retour.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
