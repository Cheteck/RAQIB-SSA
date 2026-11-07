import crypto from 'crypto';
import Database from 'better-sqlite3';

export type ConversationRole = 'user' | 'assistant';
/**
 * `main` = chat principal RAQIB.
 * `agent` = conversation dédiée à un sous-agent (isolée du chat principal).
 */
export type ConversationScope = 'main' | 'agent';

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationRole;
  content: string;
  model?: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  scope: ConversationScope;
  agentId?: string;
  missionId?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
}

export interface ConversationOptions {
  scope?: ConversationScope;
  agentId?: string;
  missionId?: string;
}

export interface ConversationListOptions {
  limit?: number;
  scope?: ConversationScope;
  agentId?: string;
}

/**
 * Stockage append-only des conversations RAQIB.
 *
 * Deux portées cohabitent sans se mélanger :
 *  - `main`  : conversation du chat principal ;
 *  - `agent` : conversation dédiée à un sous-agent (agent_id renseigné).
 *
 * Les colonnes agent_id / mission_id / scope sont ajoutées par migration
 * douce pour rester compatibles avec les bases existantes.
 */
export class ConversationStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role            TEXT NOT NULL,
        content         TEXT NOT NULL,
        model           TEXT,
        created_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_conv_messages ON conversation_messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at);
    `);

    this.ensureColumn('conversations', 'scope', "TEXT NOT NULL DEFAULT 'main'");
    this.ensureColumn('conversations', 'agent_id', 'TEXT');
    this.ensureColumn('conversations', 'mission_id', 'TEXT');
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conv_scope ON conversations(scope, agent_id);
    `);
  }

  private ensureColumn(table: string, column: string, ddl: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }

  private rowToMessage(row: any): ConversationMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      model: row.model ?? undefined,
      createdAt: row.created_at,
    };
  }

  private rowToSummary(row: any): ConversationSummary {
    return {
      id: row.id,
      title: row.title,
      scope: (row.scope as ConversationScope) ?? 'main',
      agentId: row.agent_id ?? undefined,
      missionId: row.mission_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: row.message_count ?? 0,
      lastMessage: row.last_message ?? undefined,
    };
  }

  /** Crée la conversation si elle n'existe pas, sinon la retourne. */
  async ensureConversation(
    id?: string,
    title?: string,
    options: ConversationOptions = {},
  ): Promise<ConversationSummary> {
    const now = new Date().toISOString();
    const conversationId = id?.trim() || crypto.randomUUID();
    const scope: ConversationScope = options.scope ?? 'main';

    const existing = this.db
      .prepare('SELECT id, title, scope, agent_id, mission_id, created_at, updated_at FROM conversations WHERE id = ?')
      .get(conversationId) as
      | { id: string; title: string; scope: string; agent_id: string | null; mission_id: string | null; created_at: string; updated_at: string }
      | undefined;

    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO conversations (id, title, scope, agent_id, mission_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          conversationId,
          title?.trim() || 'Nouvelle conversation',
          scope,
          options.agentId ?? null,
          options.missionId ?? null,
          now,
          now,
        );
    } else if (title && existing.title === 'Nouvelle conversation') {
      // Le premier vrai titre (premier prompt) remplace le titre par défaut.
      this.db
        .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
        .run(title.trim(), now, conversationId);
    }

    // Rattache la conversation à la mission courante quand elle est connue.
    if (options.missionId && existing?.mission_id !== options.missionId) {
      this.db
        .prepare('UPDATE conversations SET mission_id = ? WHERE id = ?')
        .run(options.missionId, conversationId);
    }

    const row = this.db
      .prepare('SELECT id, title, scope, agent_id, mission_id, created_at, updated_at FROM conversations WHERE id = ?')
      .get(conversationId) as any;

    const count = this.db
      .prepare('SELECT COUNT(*) as c FROM conversation_messages WHERE conversation_id = ?')
      .get(conversationId) as { c: number };

    return {
      id: row.id,
      title: row.title,
      scope: (row.scope as ConversationScope) ?? 'main',
      agentId: row.agent_id ?? undefined,
      missionId: row.mission_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: count.c,
    };
  }

  /**
   * Conversation dédiée et stable d'un sous-agent.
   * L'identifiant déterministe garantit l'isolation vis-à-vis du chat principal.
   */
  async ensureAgentConversation(
    agentId: string,
    agentName?: string,
    missionId?: string,
  ): Promise<ConversationSummary> {
    if (!agentId) throw new Error('agentId is required');
    const id = `agent-${agentId}`;
    return this.ensureConversation(id, `Agent · ${agentName ?? agentId}`, {
      scope: 'agent',
      agentId,
      missionId,
    });
  }

  async setConversationContext(
    conversationId: string,
    context: { missionId?: string; agentId?: string },
  ): Promise<void> {
    if (context.missionId !== undefined) {
      this.db
        .prepare('UPDATE conversations SET mission_id = ?, updated_at = ? WHERE id = ?')
        .run(context.missionId ?? null, new Date().toISOString(), conversationId);
    }
    if (context.agentId !== undefined) {
      this.db
        .prepare('UPDATE conversations SET agent_id = ?, scope = ? WHERE id = ?')
        .run(context.agentId ?? null, context.agentId ? 'agent' : 'main', conversationId);
    }
  }

  async addMessage(
    conversationId: string,
    role: ConversationRole,
    content: string,
    model?: string,
  ): Promise<ConversationMessage> {
    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      conversationId,
      role,
      content,
      model,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO conversation_messages
           (id, conversation_id, role, content, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.model ?? null,
        message.createdAt,
      );
    this.db
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(message.createdAt, conversationId);
    return message;
  }

  async getMessages(conversationId: string, limit = 40): Promise<ConversationMessage[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM (
           SELECT rowid AS rid, id, conversation_id, role, content, model, created_at
           FROM conversation_messages
           WHERE conversation_id = ?
           ORDER BY created_at DESC, rowid DESC
           LIMIT ?
         ) ORDER BY created_at ASC, rid ASC`,
      )
      .all(conversationId, limit) as any[];
    return rows.map((row) => this.rowToMessage(row));
  }

  /**
   * Liste les conversations. Accepte l'ancienne signature numérique
   * (`listConversations(50)`) ou des options de filtrage par portée/agent.
   */
  async listConversations(
    options: number | ConversationListOptions = {},
  ): Promise<ConversationSummary[]> {
    const normalized: ConversationListOptions =
      typeof options === 'number' ? { limit: options } : options;
    const limit = normalized.limit ?? 50;
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (normalized.scope) {
      clauses.push('c.scope = ?');
      params.push(normalized.scope);
    }
    if (normalized.agentId) {
      clauses.push('c.agent_id = ?');
      params.push(normalized.agentId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT c.id, c.title, c.scope, c.agent_id, c.mission_id, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id = c.id) AS message_count,
                (SELECT content FROM conversation_messages m
                  WHERE m.conversation_id = c.id
                  ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message
         FROM conversations c
         ${where}
         ORDER BY c.updated_at DESC
         LIMIT ?`,
      )
      .all(...params, limit) as any[];

    return rows.map((row) => this.rowToSummary(row));
  }

  async getConversation(id: string): Promise<ConversationDetail | null> {
    const row = this.db
      .prepare('SELECT id, title, scope, agent_id, mission_id, created_at, updated_at FROM conversations WHERE id = ?')
      .get(id) as any;
    if (!row) return null;
    const messages = await this.getMessages(id, 500);
    return {
      ...this.rowToSummary({ ...row, message_count: messages.length }),
      lastMessage: messages[messages.length - 1]?.content,
      messages,
    };
  }

  async renameConversation(id: string, title: string): Promise<boolean> {
    const result = this.db
      .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(title.trim(), new Date().toISOString(), id);
    return result.changes > 0;
  }

  async deleteConversation(id: string): Promise<boolean> {
    this.db.prepare('DELETE FROM conversation_messages WHERE conversation_id = ?').run(id);
    const result = this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
