import './globals.css';
import { HudProvider } from '../components/HudContext';
import NeuralCanvas from '../components/NeuralCanvas';
import HUDHeader from '../components/HUDHeader';
import ShellDock from '../components/ShellDock';
import ShellRailLeft from '../components/ShellRailLeft';
import ShellRailRight from '../components/ShellRailRight';
import BootScreen from '../components/BootScreen';
import ModuleOverlay from '../components/ModuleOverlay';

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
          <div className="relative z-10 w-full min-h-[calc(100vh-80px)] flex pt-14 pb-20">
            <ShellRailLeft />
            <main className="flex-1 min-w-0 relative px-4">
              <ModuleOverlay>{children}</ModuleOverlay>
            </main>
            <ShellRailRight />
          </div>
          <ShellDock />
        </HudProvider>
      </body>
    </html>
  );
}
