import { useState, useCallback } from 'react';
import { api } from '../lib/api';

export function useEmergencyStop() {
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ emergencyStop: boolean }>('/api/status');
      setActive(data.emergencyStop ?? false);
    } catch {
      setActive(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(async (action: 'activate' | 'deactivate', confirmed = false) => {
    if (action === 'deactivate' && !confirmed) {
      setMessage('Confirmez la désactivation en recliquant sur le bouton.');
      setMessageType('ok');
      return false;
    }
    try {
      const data = await api.post<{ active: boolean }>('/api/emergency-stop', {
        action,
        reason: action === 'activate' ? 'Déclenché depuis le Dashboard' : undefined,
        confirmedBy: action === 'deactivate' ? 'fondateur' : undefined,
      });
      setActive(data.active);
      setMessage(`Emergency Stop: ${data.active ? '⚠ ACTIF — toutes les exécutions bloquées' : '✓ DÉSACTIVÉ — opérations autorisées'}`);
      setMessageType(data.active ? 'err' : 'ok');
      return true;
    } catch {
      setMessage('Erreur de communication avec le serveur Runtime.');
      setMessageType('err');
      return false;
    }
  }, []);

  return { active, loading, message, messageType, refresh, toggle, setActive };
}