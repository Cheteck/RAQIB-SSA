import './globals.css';
import Navigation from '../components/Navigation';

export const metadata = {
  title: 'RAQIB // J.A.R.V.I.S Tactical HUD — Stitch Design',
  description: 'RAQIB Strategic Governance & AI Control Center',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="w-screen h-screen crt-overlay bg-[#04060b] select-none flex flex-col justify-between relative overflow-hidden font-mono">
        <Navigation />
        {children}
      </body>
    </html>
  );
}
