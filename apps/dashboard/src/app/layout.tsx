import './globals.css';
import { HudProvider } from '../components/HudContext';
import NeuralCanvas from '../components/NeuralCanvas';
import HUDHeader from '../components/HUDHeader';
import HUDDock from '../components/HUDDock';
import BootScreen from '../components/BootScreen';

export const metadata = {
  title: 'RAQIB // RAQIB AI Command Center',
  description: 'Supervision & Safety Governance for AI Engineering Agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-[#04060b] text-[#d9e6ef] font-sans text-sm antialiased selection:bg-[#62e6ff]/30 selection:text-white min-h-screen">
        <HudProvider>
          <NeuralCanvas />
          <div className="vg"></div>
          <BootScreen />
          <HUDHeader />
          <main className="relative z-10 w-full min-h-screen">{children}</main>
          <HUDDock />
        </HudProvider>
      </body>
    </html>
  );
}
