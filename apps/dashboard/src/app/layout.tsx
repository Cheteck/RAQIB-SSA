import './globals.css';
import Navigation from '../components/Navigation';

export const metadata = {
  title: 'RAQIB // Development & Project Workspace',
  description: 'RAQIB Strategic Governance & AI Control Center',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="on">
        <Navigation />
        {children}
      </body>
    </html>
  );
}
