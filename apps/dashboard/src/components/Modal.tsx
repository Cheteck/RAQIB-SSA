'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  actions,
  size = 'md',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    },
    [isOpen, onClose]
  );

  const handleClickOutside = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClickOutside}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={`relative w-full ${sizeClasses[size]} mx-4 max-h-[85vh] overflow-y-auto`}
        style={{
          background: 'linear-gradient(160deg, rgba(14, 26, 40, 0.95), rgba(5, 10, 18, 0.98))',
          border: '1px solid rgba(var(--c), 0.3)',
          borderRadius: '12px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(var(--c), 0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(var(--c), 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2
              id="modal-title"
              style={{
                font: '600 16px Oxanium',
                color: '#fff',
                margin: '0 0 4px 0',
                textShadow: '0 0 20px rgba(var(--c), 0.4)',
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  font: '400 11px "JetBrains Mono"',
                  color: 'var(--mu)',
                  margin: 0,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mu)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              transition: '0.2s',
            }}
            aria-label="Fermer"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(var(--c), 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--mu)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span className="ms" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>{children}</div>

        {/* Actions */}
        {actions && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(var(--c), 0.15)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
