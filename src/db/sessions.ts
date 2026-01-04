/**
 * Session management for authentication persistence.
 */

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create a new session with 30-day expiry.
 * @returns The session ID (UUID).
 */
export async function createSession(db: D1Database): Promise<string> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await db
    .prepare(
      `INSERT INTO sessions (id, created_at, expires_at) VALUES (?, datetime('now'), ?)`
    )
    .bind(id, expiresAt)
    .run();

  return id;
}

/**
 * Validate a session ID.
 * @returns true if the session exists and has not expired.
 */
export async function validateSession(
  db: D1Database,
  sessionId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `SELECT id FROM sessions WHERE id = ? AND expires_at > datetime('now')`
    )
    .bind(sessionId)
    .first<{ id: string }>();

  return result !== null;
}

/**
 * Delete expired sessions from the database.
 */
export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
  await db
    .prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`)
    .run();
}

/**
 * Delete a specific session (for logout).
 */
export async function deleteSession(
  db: D1Database,
  sessionId: string
): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}
