import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-db';
import { getRecentPages, upsertRecentPage } from '../../src/db/recent-pages';

describe('recent-pages', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns empty array when no pages', async () => {
    const pages = await getRecentPages(db);
    expect(pages).toEqual([]);
  });

  it('inserts and retrieves a page', async () => {
    await upsertRecentPage(db, 'page-123', 'Test Page');
    const pages = await getRecentPages(db);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_id).toBe('page-123');
    expect(pages[0].page_title).toBe('Test Page');
  });

  it('updates existing page on upsert', async () => {
    await upsertRecentPage(db, 'page-123', 'Original Title');
    await upsertRecentPage(db, 'page-123', 'Updated Title');
    const pages = await getRecentPages(db);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_title).toBe('Updated Title');
  });

  it('orders by most recent first', async () => {
    // Insert pages with explicit timestamps using raw SQL
    await db.prepare(`
      INSERT INTO recent_pages (page_id, page_title, last_used) VALUES (?, ?, ?)
    `).bind('page-1', 'First', '2024-01-01 10:00:00').run();
    await db.prepare(`
      INSERT INTO recent_pages (page_id, page_title, last_used) VALUES (?, ?, ?)
    `).bind('page-2', 'Second', '2024-01-01 11:00:00').run();
    await db.prepare(`
      INSERT INTO recent_pages (page_id, page_title, last_used) VALUES (?, ?, ?)
    `).bind('page-3', 'Third', '2024-01-01 12:00:00').run();

    const pages = await getRecentPages(db);
    expect(pages).toHaveLength(3);
    // Most recent first (page-3 at 12:00, page-2 at 11:00, page-1 at 10:00)
    expect(pages[0].page_id).toBe('page-3');
    expect(pages[1].page_id).toBe('page-2');
    expect(pages[2].page_id).toBe('page-1');
  });

  it('prunes to 50 entries', async () => {
    // Insert 55 pages with explicit timestamps
    for (let i = 1; i <= 55; i++) {
      const timestamp = `2024-01-01 ${String(i).padStart(2, '0')}:00:00`;
      await db.prepare(`
        INSERT INTO recent_pages (page_id, page_title, last_used) VALUES (?, ?, ?)
        ON CONFLICT(page_id) DO UPDATE SET page_title = excluded.page_title, last_used = excluded.last_used
      `).bind(`page-${i}`, `Page ${i}`, timestamp).run();
    }

    // Now trigger the prune by upserting one more
    await upsertRecentPage(db, 'page-55', 'Page 55 Updated');

    const pages = await getRecentPages(db);
    expect(pages).toHaveLength(50);
    // Most recent should be page-55, oldest kept should be page-6
    expect(pages[0].page_id).toBe('page-55');
    expect(pages[49].page_id).toBe('page-6');
  });
});
