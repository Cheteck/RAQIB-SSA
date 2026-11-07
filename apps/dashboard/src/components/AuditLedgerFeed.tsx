'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useHud } from './HudContext';
import { api } from '../lib/api';

export interface AuditEvent {
  id: string;
  type: string;
  timestamp: string;
  missionId?: string;
  actor?: string;
  data?: Record<string, unknown>;
}

/**
 * AuditLedgerFeed — feed compact dans le dock, au-dessus du champ de saisie.
 *
 * Hauteur réactive :
 * - 0 événement : invisible (height: 0)
 * - 1-3 événements : height auto, chaque ligne ~24px
 * - 4+ événements : max-height 96px (~4 lignes), scroll interne
 */
const MAX_VISIBLE = 5;

export default function AuditLedgerFeed() {
  const router = useRouter();
  const { publish } = useHud();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res: any = await api.get('/api/audit?limit=' + MAX_VISIBLE);
      if (res?.events) {
        // Les événements arrivent dans l'ordre du ledger (ASC après la régression,
        // on inverse client-side pour afficher les + récents en premier)
        setEvents([...(res.events as AuditEvent[])].reverse());
      }
    } catch {
      // Runtime injoignable : pas de crash, on affiche vide
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading || events.length === 0) {
    return (
      <div className="audit-ledger-feed" style={{ height: 0, overflow: 'hidden' }} />
    );
  }

  const needsScroll = events.length > 4;

  return (
    <div
      className="audit-ledger-feed"
      style={{
        borderBottom: '1px solid rgba(var(--c), 0.1)',
        padding: '2px 16px',
        maxHeight: needsScroll ? '96px' : 'none',
        overflowY: needsScroll ? 'auto' : 'visible',
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
      }}
    >
      {events.map((evt) => (
        <div
          key={evt.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 0',
            fontSize: '10px',
            fontFamily: '"JetBrains Mono", monospace',
            lineHeight: '1.6',
          }}
        >
          <span style={{ color: 'rgb(var(--m))', opacity: 0.7, flexShrink: 0 }}>
            {new Date(evt.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
          <span style={{ color: 'rgb(var(--c))', fontWeight: 600, flexShrink: 0 }}>
            {evt.type}
          </span>
          <span style={{ color: 'var(--mu)', opacity: 0.6, flexShrink: 0 }}>
            {evt.actor ?? 'system'}
          </span>
          {evt.missionId && (
            <span style={{ color: 'var(--mu)', opacity: 0.4, flexShrink: 0 }}>
              · {evt.missionId}
            </span>
          )}
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '2px 0',
          fontSize: '9px',
          fontFamily: 'Oxanium, sans-serif',
          color: 'var(--mu)',
          opacity: 0.5,
        }}
      >
        <span>Audit Ledger — {events.length} événements récents</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              router.push('/audit');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgb(var(--c))',
              cursor: 'pointer',
              font: '500 9px Oxanium',
              padding: 0,
              opacity: 0.8,
              transition: '0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.textShadow = '0 0 8px rgba(var(--c), 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.8';
              e.currentTarget.style.textShadow = 'none';
            }}
          >
            Voir tout →
          </button>
          <button
            onClick={async () => {
              try {
                const res: any = await api.get('/api/audit/integrity');
                if (res.valid) {
                  publish(
                    `✅ Intégrité vérifiée — ${res.totalEvents} événements`,
                    'Audit Ledger',
                    'Intégrité OK'
                  );
                } else {
                  publish(
                    `⚠️ Anomalie détectée : ${res.error}`,
                    'Audit Ledger',
                    'Intégrité COMPROMISE'
                  );
                }
              } catch {
                publish(
                  'Impossible de vérifier l\'intégrité (runtime injoignable)',
                  'Audit Ledger',
                  'ERREUR'
                );
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgb(var(--g))',
              cursor: 'pointer',
              font: '500 9px Oxanium',
              padding: 0,
              opacity: 0.8,
              transition: '0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.textShadow = '0 0 8px rgba(var(--g), 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.8';
              e.currentTarget.style.textShadow = 'none';
            }}
          >
            🔒 Intégrité
          </button>
        </div>
      </div>
    </div>
  );
}
