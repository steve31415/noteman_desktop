import type { RecentPage } from '../types';

export async function getRecentPages(db: D1Database, limit = 50): Promise<RecentPage[]> {
  const result = await db.prepare(`
    SELECT page_id, page_title, last_used
    FROM recent_pages
    ORDER BY last_used DESC
    LIMIT ?
  `).bind(limit).all<RecentPage>();

  return result.results;
}

export async function upsertRecentPage(
  db: D1Database,
  pageId: string,
  pageTitle: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO recent_pages (page_id, page_title, last_used)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(page_id) DO UPDATE SET
      page_title = excluded.page_title,
      last_used = datetime('now')
  `).bind(pageId, pageTitle).run();

  // Keep only the 50 most recent entries
  await db.prepare(`
    DELETE FROM recent_pages
    WHERE page_id NOT IN (
      SELECT page_id FROM recent_pages
      ORDER BY last_used DESC
      LIMIT 50
    )
  `).run();
}
