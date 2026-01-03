import type { WhitelistPage } from '../types';

// Pages whitelist
export async function getWhitelistPages(db: D1Database): Promise<WhitelistPage[]> {
  const result = await db.prepare(`
    SELECT page_id, page_title FROM whitelist_pages ORDER BY page_title
  `).all<WhitelistPage>();

  return result.results;
}

export async function addWhitelistPage(
  db: D1Database,
  pageId: string,
  pageTitle: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO whitelist_pages (page_id, page_title)
    VALUES (?, ?)
    ON CONFLICT(page_id) DO UPDATE SET page_title = excluded.page_title
  `).bind(pageId, pageTitle).run();
}

export async function removeWhitelistPage(db: D1Database, pageId: string): Promise<void> {
  await db.prepare(`DELETE FROM whitelist_pages WHERE page_id = ?`).bind(pageId).run();
}

// Parent pages whitelist
export async function getWhitelistParents(db: D1Database): Promise<WhitelistPage[]> {
  const result = await db.prepare(`
    SELECT page_id, page_title FROM whitelist_parents ORDER BY page_title
  `).all<WhitelistPage>();

  return result.results;
}

export async function addWhitelistParent(
  db: D1Database,
  pageId: string,
  pageTitle: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO whitelist_parents (page_id, page_title)
    VALUES (?, ?)
    ON CONFLICT(page_id) DO UPDATE SET page_title = excluded.page_title
  `).bind(pageId, pageTitle).run();
}

export async function removeWhitelistParent(db: D1Database, pageId: string): Promise<void> {
  await db.prepare(`DELETE FROM whitelist_parents WHERE page_id = ?`).bind(pageId).run();
}
