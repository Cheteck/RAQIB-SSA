'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';

interface ConversationSummary {
  id: string;
  title: string;
  scope?: 'main' | 'agent';
  agentId?: string;
  missionId?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  createdAt: string;
}

interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
}

const STORAGE_KEY = 'raqib-conversation-id';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR');
  } catch {
    return iso;
  }
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={
      <div className="workspace-content">
        <section className="p">
          <h3>Historique des conversations</h3>
          <p className="mono">Chargement…</p>
        </section>
      </div>
    }>
      <ConversationsPageInner />
    </Suspense>
  );
}

function ConversationsPageInner() {
  const searchParams = useSearchParams();
  const urlAgentId = searchParams.get('agentId');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'main' | 'agent'>(urlAgentId ? 'agent' : 'all');

  useEffect(() => {
    try {
      setActiveId(localStorage.getItem(STORAGE_KEY));
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = scopeFilter === 'all' ? '' : `?scope=${scopeFilter}`;
      const data = await api.get<{ conversations: ConversationSummary[] }>(`/api/conversations${query}`);
      setConversations(data.conversations || []);
    } catch (err: any) {
      setConversations([]);
      setError(err?.message || 'Runtime injoignable');
    } finally {
      setLoading(false);
    }
  }, [scopeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (id: string) => {
    if (selected === id) {
      setSelected(null);
      setDetail(null);
      return;
    }
    setSelected(id);
    setDetail(null);
    setDetailError(null);
    try {
      const data = await api.get<{ conversation: ConversationDetail }>(
        `/api/conversations/${encodeURIComponent(id)}`,
      );
      setDetail(data.conversation);
    } catch (err: any) {
      setDetailError(err?.message || 'Conversation introuvable');
    }
  };

  const resume = (id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
    // Rechargement complet : le HudProvider relit la conversation au montage.
    window.location.href = '/';
  };

  const startNew = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    window.location.href = '/';
  };

  const remove = async (id: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (activeId === id) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        setActiveId(null);
      }
      if (selected === id) {
        setSelected(null);
        setDetail(null);
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible');
    }
  };

  return (
    <div className="workspace-content">
      <section className="p" style={{ '--i': 0 } as any}>
        <h3>
          Historique des conversations
          <em>{loading ? '…' : error ? 'ERREUR' : `${conversations.length} conversation(s)`}</em>
        </h3>

        <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0 1rem', flexWrap: 'wrap' }}>
          <button type="button" className="bf" onClick={startNew}>
            <span className="ms">add_comment</span>
            <span>Nouvelle conversation</span>
          </button>
          <button type="button" className="bf" onClick={load} disabled={loading}>
            <span className="ms">refresh</span>
            <span>Actualiser</span>
          </button>
          {(['all', 'main', 'agent'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScopeFilter(value)}
              style={{
                border: `1px solid ${scopeFilter === value ? 'rgba(var(--c),0.65)' : 'rgba(255,255,255,0.12)'}`,
                background: scopeFilter === value ? 'rgba(var(--c),0.12)' : 'none',
                color: scopeFilter === value ? '#fff' : 'var(--mu)',
                borderRadius: '99px',
                padding: '0.2rem 0.7rem',
                cursor: 'pointer',
              }}
            >
              {value === 'all' ? 'Toutes' : value === 'main' ? 'Chat RAQIB' : 'Agents'}
            </button>
          ))}
        </div>

        {loading && <p className="mono" aria-live="polite">Chargement de l&apos;historique…</p>}

        {!loading && error && (
          <div className="fi w">
            <header><span>Erreur de connexion</span><em>ERR</em></header>
            <p>Impossible de joindre le runtime sur le port 4000.</p>
            <small>{error}</small>
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="fi">
            <header><span>Aucune conversation</span><em>VIDE</em></header>
            <p>
              Les échanges avec RAQIB sont persistés en SQLite et apparaîtront ici
              dès le premier message envoyé depuis le dock.
            </p>
            <small>Aucune donnée simulée.</small>
          </div>
        )}

        {!loading && !error && conversations.length > 0 && (
          <div className="feed">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="fi">
                <header>
                  <span>
                    {conversation.scope === 'agent' ? '🤖 ' : ''}
                    {conversation.title}
                    {activeId === conversation.id ? ' · ACTIVE' : ''}
                  </span>
                  <em>{formatDate(conversation.updatedAt)}</em>
                </header>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.2rem 0' }}>
                  <small
                    className="mono"
                    style={{
                      color: conversation.scope === 'agent' ? 'rgb(var(--m))' : 'rgb(var(--c))',
                    }}
                  >
                    {conversation.scope === 'agent' ? 'CONVERSATION AGENT' : 'CHAT PRINCIPAL'}
                  </small>
                  {conversation.agentId && (
                    <small className="mono">agent {conversation.agentId.slice(0, 8)}</small>
                  )}
                  {conversation.missionId && (
                    <small className="mono">mission {conversation.missionId}</small>
                  )}
                </div>
                <p>
                  {conversation.lastMessage
                    ? conversation.lastMessage.slice(0, 160)
                    : 'Aucun message.'}
                </p>
                <small className="mono">
                  {conversation.messageCount} message(s) · id {conversation.id.slice(0, 8)}… · créée le{' '}
                  {formatDate(conversation.createdAt)}
                </small>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => open(conversation.id)}>
                    {selected === conversation.id ? "Masquer les messages" : 'Voir les messages'}
                  </button>
                  <button type="button" onClick={() => resume(conversation.id)}>
                    Reprendre
                  </button>
                  <button type="button" onClick={() => remove(conversation.id)}>
                    Supprimer
                  </button>
                </div>

                {selected === conversation.id && (
                  <div style={{ marginTop: '0.75rem' }}>
                    {detailError && (
                      <small style={{ color: 'rgb(var(--r))' }}>⚠ {detailError}</small>
                    )}
                    {!detailError && !detail && <small>Chargement des messages…</small>}
                    {!detailError && detail && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {detail.messages.map((message) => (
                          <div
                            key={message.id}
                            style={{
                              borderLeft: `2px solid ${message.role === 'user' ? 'rgb(var(--c))' : 'rgb(var(--m))'}`,
                              paddingLeft: '0.6rem',
                            }}
                          >
                            <small className="mono">
                              {message.role === 'user' ? 'UTILISATEUR' : 'RAQIB'}
                              {message.model ? ` · ${message.model}` : ''} · {formatDate(message.createdAt)}
                            </small>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
