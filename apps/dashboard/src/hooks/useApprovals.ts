import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface Approval {
  id: string;
  missionId: string;
  actionType: string;
  resource: string;
  estimatedCostEur: number;
  maxDurationMs: number;
  justification: string;
  expiresAt: string;
  status: string;
  grantedBy: string | null;
  consumedAt: string | null;
  createdAt: number;
}

export function useApprovals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ approvals: Approval[] }>('/api/approvals');
      setApprovals(data.approvals || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const decide = useCallback(async (id: string, decision: 'approve' | 'reject') => {
    try {
      const endpoint = decision === 'approve'
        ? `/api/approvals/${id}/grant`
        : `/api/approvals/${id}/reject`;
      await api.post(endpoint, decision === 'approve'
        ? { grantedBy: 'commander' }
        : { rejectedBy: 'commander' });
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // ignore
    }
  }, []);

  return { approvals, loading, error, refresh, decide };
}