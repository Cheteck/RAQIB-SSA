'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useMemory(namespace: string = 'global', threadId?: string) {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = () => {
    let url = `${API_BASE}/api/memory?namespace=${encodeURIComponent(namespace)}`;
    if (threadId) url += `&threadId=${encodeURIComponent(threadId)}`;

    fetch(url)
      .then((res) => res.json())
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
