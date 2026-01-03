import { Client } from '@notionhq/client';
import type {
  PageObjectResponse,
  BlockObjectResponse,
  BlockObjectRequest,
} from '@notionhq/client/build/src/api-endpoints';
import type { PageInfo } from '../types';

export function createNotionClient(token: string): Client {
  return new Client({ auth: token });
}

/**
 * Get a page by ID and extract its title.
 * Returns null if page doesn't exist or is inaccessible.
 */
export async function getPage(client: Client, pageId: string): Promise<PageInfo | null> {
  try {
    const page = await client.pages.retrieve({ page_id: pageId }) as PageObjectResponse;
    const title = extractPageTitle(page);
    return { id: page.id, title };
  } catch {
    return null;
  }
}

/**
 * Get immediate child pages of a parent page.
 */
export async function getChildPages(client: Client, parentId: string): Promise<PageInfo[]> {
  const children: PageInfo[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: parentId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if ('type' in block && block.type === 'child_page') {
        const childPage = block as BlockObjectResponse & { type: 'child_page'; child_page: { title: string } };
        children.push({
          id: block.id,
          title: childPage.child_page.title,
        });
      }
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return children;
}

/**
 * Insert blocks near the top of a page.
 * If the page has at least one block, inserts after the first block (position 2).
 * If the page is empty, appends normally (position 1).
 */
export async function insertBlocksNearTop(
  client: Client,
  pageId: string,
  blocks: BlockObjectRequest[]
): Promise<void> {
  // Get the first child block
  const firstChild = await client.blocks.children.list({
    block_id: pageId,
    page_size: 1,
  });

  if (firstChild.results.length > 0) {
    // Insert after first block
    await client.blocks.children.append({
      block_id: pageId,
      children: blocks,
      after: firstChild.results[0].id,
    });
  } else {
    // Page is empty, just append
    await client.blocks.children.append({
      block_id: pageId,
      children: blocks,
    });
  }
}

/**
 * Extract title from a page object.
 */
function extractPageTitle(page: PageObjectResponse): string {
  // Title can be in different property locations depending on page type
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type === 'title' && prop.title.length > 0) {
      return prop.title.map(t => t.plain_text).join('');
    }
  }
  return 'Untitled';
}

/**
 * Extract page ID from a Notion URL.
 * Returns the 32-character hex ID, or null if invalid.
 */
export function extractPageIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Remove query params
    const pathname = urlObj.pathname;
    // Page ID is the last 32 characters of the path (after removing any dashes)
    const match = pathname.match(/([a-f0-9]{32})$/i) ||
                  pathname.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);

    if (match) {
      // Remove dashes and return
      return match[1].replace(/-/g, '');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a page identifier (either ID or URL) and return the page ID.
 */
export function parsePageIdentifier(input: string): string | null {
  const trimmed = input.trim();

  // Check if it's a valid 32-character hex string (page ID)
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // Check if it's a UUID format with dashes
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed)) {
    return trimmed.replace(/-/g, '').toLowerCase();
  }

  // Try to extract from URL
  if (trimmed.startsWith('http')) {
    return extractPageIdFromUrl(trimmed);
  }

  return null;
}
