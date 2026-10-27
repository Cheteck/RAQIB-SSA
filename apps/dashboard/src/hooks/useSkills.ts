'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useSkills() {
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSkills = () => {
    api.get<{ skills: any[] }>('/api/skills')
      .then((data) => {
        setSkills(data.skills || []);
        setLoading(false);
      })
      .catch(() => {
        setSkills([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const executeSkill = async (name: string, args: any) => {
    return api.post(`/api/skills/${encodeURIComponent(name)}/execute`, args);
  };

  return { skills, loading, executeSkill, refetch: fetchSkills };
}
