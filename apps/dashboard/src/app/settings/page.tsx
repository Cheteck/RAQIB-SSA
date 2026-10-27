'use client';

import { useState } from 'react';
import { useEmergencyStop } from '../../hooks/useEmergencyStop';

export default function SettingsPage() {
  const { active, loading, message, messageType, toggle } = useEmergencyStop();
  const [confirming, setConfirming] = useState(false);

  const toggleEmergency = async (action: 'activate' | 'deactivate') => {
    if (action === 'deactivate' && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    await toggle(action, true);
  };

  const isArmed = active === true;
  const msg = confirming ? 'Confirmez la désactivation en recliquant sur le bouton.' : message;
  const msgType = messageType;

  return (
    <div className="workspace-content">
      {/* Main emergency panel */}
      <section
        className="p"
        style={{
          '--i': 0,
          boxShadow: isArmed
            ? 'inset 0 0 0 1px rgba(var(--r), 0.6), 0 0 32px rgba(var(--r), 0.12)'
            : 'inset 0 0 0 1px rgba(var(--r), 0.25)',
        } as any}
      >
        <h3 style={{ borderColor: 'rgba(var(--r), 0.3)' }}>
          Interrupteur d'Urgence
          <em style={{ color: isArmed ? 'rgb(var(--r))' : 'rgb(var(--m))' }}>
            {loading ? '…' : isArmed ? 'ARMED' : 'CLEAR'}
          </em>
        </h3>

        {/* Status indicator */}
        <div className="ag" style={{ marginBottom: '16px' }}>
          <span
            className="ms"
            style={{ color: isArmed ? 'rgb(var(--r))' : 'rgb(var(--m))', fontSize: '22px' }}
          >
            {isArmed ? 'lock' : 'lock_open'}
          </span>
          <div>
            <b style={{ color: isArmed ? 'rgb(var(--r))' : '#fff' }}>
              {loading ? 'Vérification…' : isArmed
                ? 'Emergency Stop ACTIF — toutes les exécutions sont bloquées'
                : 'Emergency Stop INACTIF — opérations autorisées'}
            </b>
            <small>
              L'activation écrit le verrou{' '}
              <code
                className="mono"
                style={{ color: 'rgb(var(--r))', background: 'rgba(var(--r),0.1)', padding: '0 4px' }}
              >
                data/emergency.lock
              </code>{' '}
              et bloque immédiatement toutes les actions d'écriture et d'exécution.
            </small>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            id="btn-activate-emergency"
            onClick={() => toggleEmergency('activate')}
            disabled={isArmed || loading}
            style={{
              padding: '9px 18px',
              background: isArmed ? 'rgba(255,107,94,0.1)' : 'rgb(255, 107, 94)',
              color: isArmed ? 'rgb(var(--r))' : '#04060b',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid rgb(var(--r))',
              cursor: isArmed || loading ? 'not-allowed' : 'pointer',
              opacity: isArmed ? 0.5 : 1,
              font: '700 12px Oxanium',
              letterSpacing: '0.08em',
              transition: '0.2s',
            }}
          >
            ACTIVER EMERGENCY STOP
          </button>
          <button
            id="btn-deactivate-emergency"
            onClick={() => toggleEmergency('deactivate')}
            disabled={!isArmed || loading}
            style={{
              padding: '9px 18px',
              border: `1px solid ${confirming ? 'rgb(var(--g))' : 'rgba(var(--m), 0.5)'}`,
              color: confirming ? 'rgb(var(--g))' : 'rgb(var(--m))',
              borderRadius: '6px',
              background: confirming ? 'rgba(var(--g), 0.1)' : 'transparent',
              cursor: !isArmed || loading ? 'not-allowed' : 'pointer',
              opacity: !isArmed ? 0.4 : 1,
              font: '400 12px Oxanium',
              letterSpacing: '0.08em',
              transition: '0.2s',
            }}
          >
            {confirming ? 'CONFIRMER LA DÉSACTIVATION' : 'DÉSACTIVER (RÉINITIALISER)'}
          </button>
        </div>

        {msg && (
          <p
            id="emergency-toggle-message"
            className="mono"
            style={{
              marginTop: '12px',
              color: msgType === 'err' ? 'rgb(var(--r))' : 'rgb(var(--m))',
            }}
          >
            {msg}
          </p>
        )}
      </section>

      {/* Safety protocol info */}
      <section className="p" style={{ '--i': 1, marginTop: '12px' } as any}>
        <h3>
          Protocole de Sécurité
          <em>Zero-Trust Matrix</em>
        </h3>
        <div className="ag">
          <span className="ms" style={{ color: 'rgb(var(--r))' }}>block</span>
          <div>
            <b>Blocage immédiat</b>
            <small>Toutes les exécutions et écritures sont bloquées sans exception dès l'activation</small>
          </div>
        </div>
        <div className="ag">
          <span className="ms" style={{ color: 'rgb(var(--g))' }}>history</span>
          <div>
            <b>Trace inaltérable</b>
            <small>Chaque activation et désactivation est enregistrée dans le ledger d'audit</small>
          </div>
        </div>
        <div className="ag">
          <span className="ms" style={{ color: 'rgb(var(--m))' }}>person</span>
          <div>
            <b>Désactivation fondateur uniquement</b>
            <small>La désactivation requiert la signature du fondateur — clé à usage unique</small>
          </div>
        </div>
      </section>
    </div>
  );
}
