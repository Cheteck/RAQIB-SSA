import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface RuntimeStatus {
  status: string;
  emergencyStop: boolean;
  readOnlyMode: boolean;
  timestamp: string;
}

export function useStatus(pollMs = 15000) {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<RuntimeStatus>('/api/status');
      setStatus(data);
      setOnline(true);
    } catch {
      setOnline(false);
      setStatus({ status: 'OFFLINE', emergencyStop: false, readOnlyMode: false, timestamp: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { status, online, loading, refresh };
}