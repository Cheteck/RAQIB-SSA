'use client';

import { useHud } from './HudContext';
import NeuralCanvas from './NeuralCanvas';

/**
 * Connecte NeuralCanvas au mode HUD.
 * Les barres waveform sont trouvées automatiquement via .wv dans le DOM.
 * Ce composant ne re-monte jamais — il vit dans le layout.
 */
export default function NeuralCanvasConnected() {
  const { mode, go } = useHud();

  return (
    <NeuralCanvas
      mode={mode}
      onClick={() => go('État du système')}
    />
  );
}
