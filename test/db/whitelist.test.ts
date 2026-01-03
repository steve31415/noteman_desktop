import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-db';
import {
  getWhitelistPages,
  addWhitelistPage,
  removeWhitelistPage,
  getWhitelistParents,
  addWhitelistParent,
  removeWhitelistParent,
} from '../../src/db/whitelist';

describe('whitelist-pages', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns empty array when no pages', async () => {
    const pages = await getWhitelistPages(db);
    expect(pages).toEqual([]);
  });

  it('adds and retrieves a page', async () => {
    await addWhitelistPage(db, 'page-123', 'Test Page');
    const pages = await getWhitelistPages(db);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_id).toBe('page-123');
    expect(pages[0].page_title).toBe('Test Page');
  });

  it('updates existing page on add', async () => {
    await addWhitelistPage(db, 'page-123', 'Original');
    await addWhitelistPage(db, 'page-123', 'Updated');
    const pages = await getWhitelistPages(db);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_title).toBe('Updated');
  });

  it('removes a page', async () => {
    await addWhitelistPage(db, 'page-123', 'Test');
    await addWhitelistPage(db, 'page-456', 'Test 2');
    await removeWhitelistPage(db, 'page-123');
    const pages = await getWhitelistPages(db);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_id).toBe('page-456');
  });

  it('orders alphabetically by title', async () => {
    await addWhitelistPage(db, 'page-1', 'Zebra');
    await addWhitelistPage(db, 'page-2', 'Apple');
    await addWhitelistPage(db, 'page-3', 'Mango');
    const pages = await getWhitelistPages(db);
    expect(pages.map((p) => p.page_title)).toEqual(['Apple', 'Mango', 'Zebra']);
  });
});

describe('whitelist-parents', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns empty array when no parents', async () => {
    const pages = await getWhitelistParents(db);
    expect(pages).toEqual([]);
  });

  it('adds and retrieves a parent', async () => {
    await addWhitelistParent(db, 'parent-123', 'Parent Page');
    const pages = await getWhitelistParents(db);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_id).toBe('parent-123');
    expect(pages[0].page_title).toBe('Parent Page');
  });

  it('removes a parent', async () => {
    await addWhitelistParent(db, 'parent-123', 'Parent 1');
    await addWhitelistParent(db, 'parent-456', 'Parent 2');
    await removeWhitelistParent(db, 'parent-123');
    const pages = await getWhitelistParents(db);
    expect(pages).toHaveLength(1);
    expect(pages[0].page_id).toBe('parent-456');
  });
});
