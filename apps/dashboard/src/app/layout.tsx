import './globals.css';
import Navigation from '../components/Navigation';

export const metadata = {
  title: 'RAQIB — AI Command Center & Security Control',
  description: 'Supervision & Safety Governance for AI Engineering Agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-[#06090e] text-on-surface font-sans text-sm antialiased selection:bg-primary-container selection:text-black min-h-screen flex flex-col justify-between">
        <Navigation />
        <main className="flex-1 w-full max-w-[1920px] mx-auto p-3 lg:p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
