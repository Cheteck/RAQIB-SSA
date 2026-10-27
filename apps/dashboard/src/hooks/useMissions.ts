import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface Mission {
  id: string;
  name: string;
  objective: string;
  status: string;
  autonomyLevel: string;
  budgetLimitEur: number;
  budgetUsedEur: number;
}

export function useMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ missions: Mission[] }>('/api/missions');
      setMissions(data.missions || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { missions, loading, error, refresh, setMissions };
}