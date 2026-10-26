import Navigation from '../components/Navigation';

export const metadata = {
  title: 'RAQIB - Control & Governance Dashboard',
  description: 'Supervision & Safety Governance for AI Engineering Agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#020617', color: '#f8fafc' }}>
        <Navigation />
        <main style={{ padding: '2rem' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
