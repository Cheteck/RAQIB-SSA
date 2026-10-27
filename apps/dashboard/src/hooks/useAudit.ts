import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface AuditEvent {
  id: string;
  type: string;
  timestamp: string;
  actor?: string;
  missionId?: string;
  data?: Record<string, unknown>;
}

export interface AuditFilters {
  type?: string;
  missionId?: string;
  limit?: number;
  offset?: number;
}

export function useAudit(filters: AuditFilters = {}) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.missionId) params.set('missionId', filters.missionId);
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.offset) params.set('offset', String(filters.offset));
      const qs = params.toString();
      const data = await api.get<{ events: AuditEvent[] }>(`/api/audit${qs ? `?${qs}` : ''}`);
      setEvents(data.events || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters.type, filters.missionId, filters.limit, filters.offset]);

  useEffect(() => { refresh(); }, [refresh]);

  return { events, loading, error, refresh, setEvents };
}