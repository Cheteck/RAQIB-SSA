'use client';

import { useState, useEffect } from 'react';

const BL = [
  'neural lattice ......... assembled',
  'arc reactor ............ 98.4%',
  'voice pipeline ......... synced',
  'RAQIB ................. online',
];

export default function BootScreen({ onDone }: { onDone?: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BL.length) {
        setLines((prev) => [...prev, BL[i++]]);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setVisible(false);
          document.body.classList.add('on');
          onDone?.();
        }, 500);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div className="boot">
      <pre>{lines.join('\n')}</pre>
    </div>
  );
}
