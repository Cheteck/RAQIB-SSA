'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useContextMetrics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/context')
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(() => {
        setMetrics(null);
        setLoading(false);
      });
  }, []);

  return { metrics, loading };
}
