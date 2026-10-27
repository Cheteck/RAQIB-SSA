'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useMemory(namespace: string = 'global', threadId?: string) {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = () => {
    let url = `/api/memory?namespace=${encodeURIComponent(namespace)}`;
    if (threadId) url += `&threadId=${encodeURIComponent(threadId)}`;

    api.get<{ memories: any[] }>(url)
      .then((data) => {
        setMemories(data.memories || []);
        setLoading(false);
      })
      .catch(() => {
        setMemories([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMemories();
  }, [namespace, threadId]);

  return { memories, loading, refetch: fetchMemories };
}
