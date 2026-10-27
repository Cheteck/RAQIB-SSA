'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useSkills() {
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSkills = () => {
    fetch(`${API_BASE}/api/skills`)
      .then((res) => res.json())
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
    const res = await fetch(`${API_BASE}/api/skills/${encodeURIComponent(name)}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return res.json();
  };

  return { skills, loading, executeSkill, refetch: fetchSkills };
}
