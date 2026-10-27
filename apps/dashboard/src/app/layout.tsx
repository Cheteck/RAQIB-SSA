import './globals.css';
import { HudProvider } from '../components/HudContext';
import Navigation from '../components/Navigation';
import ShellRailLeft from '../components/ShellRailLeft';
import ShellRailRight from '../components/ShellRailRight';
import ShellDock from '../components/ShellDock';
import ShellCenter from '../components/ShellCenter';
import ModuleOverlay from '../components/ModuleOverlay';
import NeuralCanvasConnected from '../components/NeuralCanvasConnected';

export const metadata = {
  title: 'RAQIB // Development & Project Workspace',
  description: 'RAQIB Strategic Governance & AI Control Center',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="on">
        <HudProvider>
          {/* z=0 — canvas 3D, jamais re-monté */}
          <NeuralCanvasConnected />

          {/* z=1 — vignette scanlines */}
          <div className="vg" aria-hidden />

          {/* z=20 — header fixe */}
          <Navigation />

          {/*
           * .st — grille 3 colonnes exacte du template :
           *   col 1 : rail gauche   (minmax 280-320px)
           *   col 2 : centre RAQIB  (1fr — espace de réponse uniquement)
           *   col 3 : rail droit    (minmax 280-320px)
           *
           * La colonne centre ne contient QUE ShellCenter (titre + output).
           * Les pages modules sont dans ModuleOverlay, positionné
           * en absolute au-dessus de la grille, jamais dans le centre.
           */}
          <div className="st">
            <ShellRailLeft />

            {/* Colonne 2 : espace de réponse RAQIB — titre + output UNIQUEMENT */}
            <section className="mid">
              <ShellCenter />
            </section>

            <ShellRailRight />
          </div>

          {/*
           * ModuleOverlay — drawer fixe au-dessus des rails.
           * Sur route / : invisible.
           * Sur /missions, /audit etc. : panel semi-transparent
           * qui s'ouvre par-dessus le rail droit (ou en overlay centré).
           * Disparaît en focus mode.
           */}
          <ModuleOverlay>{children}</ModuleOverlay>

          {/* z=20 — dock fixe en bas */}
          <ShellDock />
        </HudProvider>
      </body>
    </html>
  );
}
