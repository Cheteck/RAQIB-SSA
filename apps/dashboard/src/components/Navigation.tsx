import Link from 'next/link';

export default function Navigation() {
  return (
    <nav style={{ padding: '1rem', background: '#0f172a', color: '#fff', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
      <strong style={{ fontSize: '1.25rem', color: '#38bdf8' }}>🛡️ RAQIB Supervision</strong>
      <Link href="/" style={{ color: '#f8fafc', textDecoration: 'none' }}>Vue Générale</Link>
      <Link href="/missions" style={{ color: '#f8fafc', textDecoration: 'none' }}>Missions</Link>
      <Link href="/approvals" style={{ color: '#f8fafc', textDecoration: 'none' }}>Approbations</Link>
      <Link href="/audit" style={{ color: '#f8fafc', textDecoration: 'none' }}>Audit Ledger</Link>
      <Link href="/settings" style={{ color: '#f8fafc', textDecoration: 'none' }}>Paramètres & Urgence</Link>
    </nav>
  );
}
