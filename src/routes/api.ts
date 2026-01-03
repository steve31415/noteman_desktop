import { Hono } from 'hono';
import type { Env, PageInfo } from '../types';
import { getRecentPages, upsertRecentPage } from '../db/recent-pages';
import {
  getWhitelistPages,
  addWhitelistPage,
  removeWhitelistPage,
  getWhitelistParents,
  addWhitelistParent,
  removeWhitelistParent,
} from '../db/whitelist';
import {
  createNotionClient,
  getPage,
  getChildPages,
  insertBlocksNearTop,
  parsePageIdentifier,
} from '../notion/client';
import { markdownToBlocks } from '../markdown/parser';

const api = new Hono<{ Bindings: Env }>();

// GET /api/recent-pages - Returns last 50 recently-used pages
api.get('/recent-pages', async (c) => {
  const pages = await getRecentPages(c.env.DB);
  return c.json({
    pages: pages.map((p) => ({
      id: p.page_id,
      title: p.page_title,
    })),
  });
});

// GET /api/searchable-pages - Returns whitelist pages + children of parent pages
api.get('/searchable-pages', async (c) => {
  const client = createNotionClient(c.env.NOTION_TOKEN);

  // Get whitelist pages
  const whitelistPages = await getWhitelistPages(c.env.DB);
  const pages: PageInfo[] = whitelistPages.map((p) => ({
    id: p.page_id,
    title: p.page_title,
  }));

  // Get children of parent pages
  const parentPages = await getWhitelistParents(c.env.DB);
  for (const parent of parentPages) {
    try {
      const children = await getChildPages(client, parent.page_id);
      pages.push(...children);
    } catch (err) {
      console.error(`Failed to get children of ${parent.page_id}:`, err);
    }
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const uniquePages = pages.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return c.json({ pages: uniquePages });
});

// POST /api/insert - Insert content into a Notion page
api.post('/insert', async (c) => {
  try {
    const body = await c.req.json<{
      pageId: string;
      pageTitle: string;
      content: string;
    }>();

    if (!body.pageId || !body.content) {
      return c.json({ success: false, error: 'Missing pageId or content' }, 400);
    }

    const client = createNotionClient(c.env.NOTION_TOKEN);
    const blocks = markdownToBlocks(body.content);

    await insertBlocksNearTop(client, body.pageId, blocks);
    await upsertRecentPage(c.env.DB, body.pageId, body.pageTitle);

    return c.json({ success: true });
  } catch (err) {
    console.error('Insert error:', err);
    const message = err instanceof Error ? err.message : 'Insert failed';
    return c.json({ success: false, error: message }, 500);
  }
});

// GET /api/whitelist/pages - Get pages whitelist
api.get('/whitelist/pages', async (c) => {
  const pages = await getWhitelistPages(c.env.DB);
  return c.json({
    pages: pages.map((p) => ({
      id: p.page_id,
      title: p.page_title,
    })),
  });
});

// POST /api/whitelist/pages - Add page to whitelist
api.post('/whitelist/pages', async (c) => {
  try {
    const body = await c.req.json<{ pageId?: string; pageUrl?: string }>();

    const input = body.pageId || body.pageUrl;
    if (!input) {
      return c.json({ success: false, error: 'Missing pageId or pageUrl' }, 400);
    }

    const pageId = parsePageIdentifier(input);
    if (!pageId) {
      return c.json({ success: false, error: 'Invalid page ID or URL format' }, 400);
    }

    const client = createNotionClient(c.env.NOTION_TOKEN);
    const page = await getPage(client, pageId);
    if (!page) {
      return c.json({ success: false, error: 'Page not found or not accessible' }, 404);
    }

    await addWhitelistPage(c.env.DB, page.id, page.title);
    return c.json({ success: true, page });
  } catch (err) {
    console.error('Add whitelist page error:', err);
    const message = err instanceof Error ? err.message : 'Failed to add page';
    return c.json({ success: false, error: message }, 500);
  }
});

// DELETE /api/whitelist/pages/:id - Remove page from whitelist
api.delete('/whitelist/pages/:id', async (c) => {
  const pageId = c.req.param('id');
  await removeWhitelistPage(c.env.DB, pageId);
  return c.json({ success: true });
});

// GET /api/whitelist/parents - Get parent pages whitelist
api.get('/whitelist/parents', async (c) => {
  const pages = await getWhitelistParents(c.env.DB);
  return c.json({
    pages: pages.map((p) => ({
      id: p.page_id,
      title: p.page_title,
    })),
  });
});

// POST /api/whitelist/parents - Add parent page to whitelist
api.post('/whitelist/parents', async (c) => {
  try {
    const body = await c.req.json<{ pageId?: string; pageUrl?: string }>();

    const input = body.pageId || body.pageUrl;
    if (!input) {
      return c.json({ success: false, error: 'Missing pageId or pageUrl' }, 400);
    }

    const pageId = parsePageIdentifier(input);
    if (!pageId) {
      return c.json({ success: false, error: 'Invalid page ID or URL format' }, 400);
    }

    const client = createNotionClient(c.env.NOTION_TOKEN);
    const page = await getPage(client, pageId);
    if (!page) {
      return c.json({ success: false, error: 'Page not found or not accessible' }, 404);
    }

    await addWhitelistParent(c.env.DB, page.id, page.title);
    return c.json({ success: true, page });
  } catch (err) {
    console.error('Add whitelist parent error:', err);
    const message = err instanceof Error ? err.message : 'Failed to add parent page';
    return c.json({ success: false, error: message }, 500);
  }
});

// DELETE /api/whitelist/parents/:id - Remove parent page from whitelist
api.delete('/whitelist/parents/:id', async (c) => {
  const pageId = c.req.param('id');
  await removeWhitelistParent(c.env.DB, pageId);
  return c.json({ success: true });
});

export default api;
